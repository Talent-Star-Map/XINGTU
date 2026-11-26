"""Download official CPU models; run once before enabling interview audio.

python backend/scripts/setup_interview_models.py [--vision-only | --include-local-asr]
"""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tarfile
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
GITHUB = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/'


def download(url, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.is_file():
        return
    part = dest.with_suffix(dest.suffix + '.download')
    print('Downloading', dest.name, flush=True)
    with urllib.request.urlopen(url, timeout=120) as response, part.open('wb') as out:
        shutil.copyfileobj(response, out)
    part.replace(dest)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--vision-only', action='store_true')
    parser.add_argument('--speaker-only', action='store_true', help='API deployments: download vision + speaker only, skip local ASR model')
    parser.add_argument('--include-local-asr', action='store_true', help='Optional CPU ASR experiment only; browser mode does not need this')
    args = parser.parse_args()
    vision = ROOT / 'frontend/public/models/interview'
    sources = {
        'face.tflite': 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
        'objects.tflite': 'https://storage.googleapis.com/mediapipe-models/object_detector/ssd_mobilenet_v2/float32/1/ssd_mobilenet_v2.tflite',
    }
    for name, url in sources.items():
        download(url, vision / name)
    manifest = {name: {'source': url, 'sha256': hashlib.sha256((vision/name).read_bytes()).hexdigest()}
                for name, url in sources.items()}
    (vision/'sources.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    if not args.vision_only:
        audio = ROOT / 'backend/resources/interview-models'
        download(GITHUB+'speaker-recongition-models/3dspeaker_speech_campplus_sv_zh-cn_16k-common.onnx', audio/'speaker.onnx')
        if args.include_local_asr and not args.speaker_only and not (audio/'sensevoice/model.int8.onnx').is_file():
            with tempfile.TemporaryDirectory(dir=ROOT/'tmp') as temp:
                archive = Path(temp)/'sensevoice.tar.bz2'
                download(GITHUB+'asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2', archive)
                with tarfile.open(archive) as tar:
                    for name in ('model.int8.onnx', 'tokens.txt'):
                        members = [m for m in tar.getmembers() if m.isfile() and Path(m.name).name == name]
                        if len(members) != 1:
                            raise RuntimeError('Unexpected model archive')
                        dest = audio/'sensevoice'/name
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        with tar.extractfile(members[0]) as src, dest.open('wb') as out:
                            shutil.copyfileobj(src, out)
        entries = {str(p.relative_to(audio)): hashlib.sha256(p.read_bytes()).hexdigest()
                   for p in audio.rglob('*') if p.is_file() and p.name != 'sha256.json'}
        (audio/'sha256.json').write_text(json.dumps(entries, indent=2), encoding='utf-8')
    print('Interview models ready. Run npm run prepare:interview in frontend for WASM assets.')


if __name__ == '__main__':
    (ROOT/'tmp').mkdir(exist_ok=True)
    main()
