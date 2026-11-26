"""Real CPU models, synthetic voice fixtures; isolated from production DB/users.

Run with requirements-interview plus fastapi/httpx/requests/sqlalchemy installed.
Report includes warm P50/P95, cold load and 1/2/4 concurrent API requests.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import io
import json
import os
from pathlib import Path
import platform
import sys
from threading import Barrier
import time
import wave

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['JWT_SECRET'] = 'isolated-interview-benchmark-not-for-production-2026'
os.environ['INTERVIEW_ASR_MODE'] = 'cpu'
os.environ['INTERVIEW_AUDIO_THREADS'] = '1'
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'backend'))
import numpy as np
from fastapi import FastAPI
from fastapi.testclient import TestClient
from auth_guard import require_jobseeker
from routers.interview_media import router
from services import interview_audio as audio


def summary(values):
    return {'n': len(values), 'p50_ms': round(float(np.percentile(values, 50)), 1),
            'p95_ms': round(float(np.percentile(values, 95)), 1), 'max_ms': round(max(values), 1)} if values else None


def wav(samples):
    out = io.BytesIO()
    with wave.open(out, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000)
        w.writeframes((samples*32767).clip(-32768, 32767).astype('<i2').tobytes())
    return out.getvalue()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--wav', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--runs', type=int, default=12)
    args = parser.parse_args()
    with wave.open(str(args.wav), 'rb') as w:
        assert (w.getframerate(), w.getnchannels(), w.getsampwidth()) == (16000, 1, 2)
        base = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype('float32')/32768
    began = time.perf_counter()
    recognizer, speaker = audio.models()
    load_ms = (time.perf_counter()-began)*1000
    output = {'machine': {'system': platform.platform(), 'processor': platform.processor(), 'logical_cpus': os.cpu_count()},
              'provider': 'cpu', 'threads': 1, 'cold_model_load_ms': round(load_ms, 1),
              'fixture': 'Original supplied AI-avatar narration, cropped/repeated to requested lengths; not spontaneous user recordings.',
              'serial': [], 'concurrent': [], 'scope': 'Model timings and in-process authenticated test-client API; excludes WAN, LLM and TTS.'}
    baseline = None
    for seconds in (3, 8, 16, 24):
        samples = np.tile(base, int(np.ceil(seconds*16000/len(base))))[:seconds*16000]
        data = wav(samples)
        rows = []
        for i in range(args.runs):
            start = time.perf_counter(); decoded = audio.decode_wav(data); decode_ms=(time.perf_counter()-start)*1000
            start = time.perf_counter(); text = audio.transcribe(data, decoded, recognizer); asr_ms=(time.perf_counter()-start)*1000
            start = time.perf_counter()
            s=speaker.create_stream();s.accept_waveform(sample_rate=16000,waveform=decoded);s.input_finished()
            embedding=np.array(speaker.compute(s),dtype='float32');embedding/=np.linalg.norm(embedding)
            speaker_ms=(time.perf_counter()-start)*1000
            rows.append({'decode_ms':decode_ms,'asr_ms':asr_ms,'speaker_ms':speaker_ms,'total_ms':decode_ms+asr_ms+speaker_ms,'text_chars':len(text)})
            if seconds==8: baseline=embedding
        output['serial'].append({'seconds':seconds,**{key:summary([row[key] for row in rows]) for key in ('decode_ms','asr_ms','speaker_ms','total_ms')},'raw':rows})
        print(json.dumps({'seconds':seconds,'total':output['serial'][-1]['total_ms']}),flush=True)
    app=FastAPI();app.include_router(router,prefix='/api/interview')
    app.dependency_overrides[require_jobseeker]=lambda:{'user_id':987654,'role':'jobseeker'}
    samples=base[:8*16000];data=wav(samples)
    for concurrent in (1,2,4):
        batches=[]
        for trial in range(8):
            # Reuse the same speaker in distinct independently-owned temporary rooms.
            rooms=[]
            for index in range(concurrent):
                value=audio.create_session(987654)
                room=audio.get_room(value['session_id'],987654)
                room['embedding']=baseline
                rooms.append(room)
            # create_session intentionally caps two per account: restore bounded test fixtures after creation.
            for room in rooms: audio.SESSIONS[room['id']]=room
            barrier=Barrier(concurrent)
            def send(room):
                with TestClient(app) as client:
                    barrier.wait();start=time.perf_counter()
                    result=client.post('/api/interview/audio/recognize',params={'session_id':room['id']},content=data,headers={'Content-Type':'audio/wav'})
                    return {'status':result.status_code,'ms':(time.perf_counter()-start)*1000,'accepted':result.json().get('accepted',False)}
            with ThreadPoolExecutor(max_workers=concurrent) as pool: batches.extend(pool.map(send,rooms))
            for room in rooms:audio.SESSIONS.pop(room['id'],None)
        ok=[r['ms'] for r in batches if r['status']==200]
        busy=[r['ms'] for r in batches if r['status']==429]
        result={'users':concurrent,'requests':len(batches),'successes':len(ok),'accepted':sum(r['accepted'] for r in batches),
                'busy_429':len(busy),'success_latency':summary(ok),'busy_latency':summary(busy),'raw':batches}
        output['concurrent'].append(result)
        print(json.dumps({k:v for k,v in result.items() if k!='raw'}),flush=True)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Saved',args.out,flush=True)


if __name__=='__main__':main()
