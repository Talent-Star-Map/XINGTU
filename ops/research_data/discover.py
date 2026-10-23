"""Read public release metadata. This script does not train models."""
import json
from pathlib import Path
import requests

root=Path(__file__).resolve().parents[2]/'data'/'external'
root.mkdir(parents=True,exist_ok=True)
urls={
 'job_sdf':'https://api.github.com/repos/Job-SDF/benchmark/git/trees/main?recursive=1',
 'jobed':'https://api.github.com/repos/BahajAdil/JobEd/git/trees/main?recursive=1',
 'linkedin':'https://www.kaggle.com/api/v1/datasets/view/arshkon/linkedin-job-postings',
}
for key,url in urls.items():
    try:
        response=requests.get(url,timeout=40)
        response.raise_for_status()
        data=response.json()
        (root/f'{key}_metadata.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
        if key!='linkedin':
            entries=[{'path':e['path'],'size':e.get('size')} for e in data.get('tree',[]) if e['type']=='blob' and (e['path'].startswith(('dataset/','data/')) or 'LICENSE' in e['path'])]
            print(key,'files',len(entries),'bytes',sum(e['size'] or 0 for e in entries),'sample',json.dumps(entries[:35],ensure_ascii=True))
        else:
            print(key,json.dumps({k:v for k,v in data.items() if any(t in k.lower() for t in ['license','size','version'])},ensure_ascii=True))
    except Exception as exc:
        print(key,'ERROR',type(exc).__name__,str(exc)[:200])
