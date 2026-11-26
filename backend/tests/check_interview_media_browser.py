"""Integration test. Start frontend dev server, install model assets and ffmpeg first.
Uses deterministic API fixtures, real CPU vision models, RNNoise and synthetic media.
Run: INTERVIEW_TEST_ORIGIN=http://127.0.0.1:5173 python backend/tests/check_interview_media_browser.py
"""
import json
import os
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[2]
origin=os.getenv('INTERVIEW_TEST_ORIGIN', 'http://127.0.0.1:5173')
output=ROOT/'tmp/interview-guard'
output.mkdir(parents=True,exist_ok=True)
fixture=output/'mic-fixture.wav'
subprocess.run(['ffmpeg','-loglevel','error','-y','-i',str(ROOT/'frontend/public/media/interview/interviewer-720p.mp4'),'-t','8','-ar','16000','-ac','1',str(output/'benchmark.wav')],check=True)
subprocess.run(['ffmpeg','-loglevel','error','-y','-i',str(output/'benchmark.wav'),'-af','apad=pad_dur=3','-t','11',str(fixture)],check=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'),headless=True,args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+str(fixture)])
    page=browser.new_page(viewport={'width':1440,'height':1000},permissions=['camera','microphone'])
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    def mock(route):
        path=route.request.url.split('?')[0]
        if path.endswith('/bootstrap'): data={'target_role':'Web前端开发','profile_available':True,'skills':['React'],'resume_title':'测试简历'}
        elif path.endswith('/audio/status'): data={'configured':True,'speaker_configured':True,'asr':'browser'}
        elif path.endswith('/voice/status'):data={'configured':False}
        elif path.endswith('/audio/session') and route.request.method=='POST':data={'session_id':'test-room','challenge_id':'one','phrase':'我正在参加星图面试，苹果森林蓝天白云花园。','enrolled':False}
        elif path.endswith('/audio/verify'):data={'accepted':True,'text':''}
        elif path.endswith('/prepare'):data={'context_id':'test-context','target_questions':7,'question_bank_count':2,'job_evidence_count':1}
        elif path.endswith('/conversation'):
            route.fulfill(content_type='application/x-ndjson',body='\n'.join(json.dumps(e,ensure_ascii=False) for e in [{'type':'context','main_index':1,'target_questions':7,'focus':'项目实践','complete':False},{'type':'delta','text':'请介绍你的项目。'},{'type':'done'}])+'\n');return
        elif path.endswith('/speech'):route.fulfill(status=503,json={'detail':'test speech disabled'});return
        else:data={'success':True,'data':[]}
        route.fulfill(json=data)
    page.route(origin+'/api/**',mock)
    page.add_init_script("""localStorage.setItem('xingtu_token','test');localStorage.setItem('xingtu_role','jobseeker');
    window.SpeechRecognition=class {
      start(track){this.track=track;window.__browserRecognition=this;this.timer=setTimeout(()=>{
        const result=[{transcript:'我正在参加星图面试，苹果森林蓝天白云花园。'}];result.isFinal=true;
        this.onresult?.({resultIndex:0,results:[result]});},500);}
      stop(){clearTimeout(this.timer);this.onend?.();}
      abort(){clearTimeout(this.timer);this.onend?.();}
    };
    """)
    page.goto(origin+'/#/interview')
    expect(page.get_by_role('button',name='同意本次声音核验并检查设备')).to_be_visible()
    page.screenshot(path=str(ROOT/'tmp/interview-guard/setup.png'))
    # Real downloaded CPU vision models: a face image then a blank frame.
    result=page.evaluate('''async () => {
      const {InterviewVision}=await import('/src/lib/interviewVision.ts');
      const image=new Image();image.src='/media/interview/interviewer-idle.jpg';await image.decode();
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
      const ctx=canvas.getContext('2d');let blank=false;
      const draw=setInterval(()=>{ctx.fillStyle='white';ctx.fillRect(0,0,640,480);if(!blank)ctx.drawImage(image,185,0,270,480)},60);
      const video=document.createElement('video');video.muted=true;video.srcObject=canvas.captureStream(15);await video.play();
      let states=[];const detector=new InterviewVision(s=>states.push(s));await detector.start(video);
      await new Promise(r=>setTimeout(r,4000));const good=states.some(s=>s.allowed);
      blank=true;await new Promise(r=>setTimeout(r,1800));const blocked=states.at(-1);
      detector.dispose();clearInterval(draw);video.srcObject.getTracks().forEach(t=>t.stop());
      return {good,blocked};
    }''')
    assert result['good'],result
    assert not result['blocked']['allowed'],result
    # RNNoise + worklet must run in Chromium without a server/GPU or audible monitoring.
    capture=page.evaluate('''async()=>{
      const {InterviewCapture}=await import('/src/lib/interviewCapture.ts');
      let segments=0,activities=0;const mic=new InterviewCapture(()=>segments++,()=>activities++);
      await mic.start();mic.setEnabled(true);await new Promise(r=>setTimeout(r,13500));mic.dispose();
      return {started:true,segments,activities};
    }''')
    # Production hook integration with real CPU CV and real RNNoise, mock API only.
    page.evaluate("""async()=>{
      const React=(await import('/node_modules/.vite/deps/react.js')).default;
      const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
      const {useInterviewMedia}=await import('/src/components/interview/useInterviewMedia.ts');
      const real=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      const img=new Image();img.src='/media/interview/interviewer-idle.jpg';await img.decode();
      const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
      window.__blank=false;const ctx=canvas.getContext('2d');
      window.__draw=setInterval(()=>{ctx.fillStyle='white';ctx.fillRect(0,0,640,480);if(!window.__blank)ctx.drawImage(img,185,0,270,480)},50);
      navigator.mediaDevices.getUserMedia=async options=>options.video?canvas.captureStream(15):real(options);
      window.__blocked=0;window.__answers=[];
      function Harness(){
        const video=React.useRef(null);
        const media=useInterviewMedia(video,true,true,t=>window.__answers.push(t),()=>{},()=>window.__blocked++);
        window.__media=media;
        return React.createElement('div',null,React.createElement('video',{ref:video,muted:true,autoPlay:true}),React.createElement('button',{id:'check-media',onClick:()=>media.prepare()},'test devices'));
      }
      const mount=document.createElement('div');document.body.appendChild(mount);window.__root=createRoot(mount);window.__root.render(React.createElement(Harness));
    }""")
    page.locator('#check-media').click()
    page.wait_for_function('window.__media.enrolled',timeout=35000)
    assert page.evaluate('window.__media.allowed')
    assert page.evaluate('window.__browserRecognition != null')
    page.evaluate('window.__blank=true')
    page.wait_for_function('!window.__media.allowed',timeout=6000)
    assert page.evaluate('window.__blocked>0')
    page.evaluate('window.__blank=false')
    page.wait_for_function('window.__media.allowed',timeout=6000)
    page.evaluate('window.__media.stop();window.__root.unmount();clearInterval(window.__draw)')
    print(json.dumps({'real_cpu_vision':result,'rnnoise_worklet':capture,'page_errors':errors},ensure_ascii=True))
    assert capture['segments'] > 0,capture
    assert not errors,errors
    browser.close()
