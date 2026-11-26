"""Real DeerFlow runtime smoke test against a local OpenAI-compatible stub, no API key."""
import json
import os
from pathlib import Path
import sys
import threading
import time
from unittest.mock import patch
from http.server import BaseHTTPRequestHandler,HTTPServer

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
root=Path(__file__).resolve().parents[2]
os.environ['DEER_FLOW_PROJECT_ROOT']=str(root/'backend')
os.environ['DEER_FLOW_HOME']=str(root/'tmp/career-sdk/runtime-smoke')
os.environ['DATABASE_URL']='sqlite://'
os.environ['JWT_SECRET']='offline-sdk-check-only-long-secret'
answer=json.dumps({'approved':True,'issues':[],'questions':[]})
calls=[]


class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_POST(self):
        body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        calls.append(body)
        if body.get('tools'):raise AssertionError('Domain agent must not receive executable tools')
        self.send_response(200)
        if body.get('stream'):
            self.send_header('Content-Type','text/event-stream');self.end_headers()
            for delta,finish in [({'role':'assistant','content':answer},None),({},'stop')]:
                payload={'id':'offline-1','object':'chat.completion.chunk','created':1,'model':'offline',
                         'choices':[{'index':0,'delta':delta,'finish_reason':finish}]}
                self.wfile.write(('data: '+json.dumps(payload)+'\n\n').encode())
            self.wfile.write(b'data: [DONE]\n\n');self.wfile.flush()
        else:
            self.send_header('Content-Type','application/json');self.end_headers()
            self.wfile.write(json.dumps({'id':'offline-1','object':'chat.completion','created':1,'model':'offline',
                'choices':[{'index':0,'message':{'role':'assistant','content':answer},'finish_reason':'stop'}]}).encode())


if __name__=='__main__':
    server=HTTPServer(('127.0.0.1',0),Handler)
    threading.Thread(target=server.serve_forever,daemon=True).start()
    from services import career_deerflow
    try:
        stamp=time.perf_counter()
        if '--bridge' in sys.argv:
            from services import llm
            assert os.environ.get('CAREER_SDK_PYTHON')
            with patch.object(llm,'_get_api_key',return_value='offline-only'),patch.object(llm,'_get_base_url',return_value=f'http://127.0.0.1:{server.server_port}/v1'),\
                 patch.object(llm,'_get_model',return_value='offline'),patch.object(llm,'is_global_enabled',return_value=True),patch.object(llm,'is_mock_mode',return_value=False):
                first=career_deerflow._run_domain('审核监督Agent',{'_actor':'jobseeker:7','marker':'PRIVATE_FIRST_USER'})
                cold=time.perf_counter()-stamp
                warm_stamp=time.perf_counter()
                result=career_deerflow._run_domain('审核监督Agent',{'_actor':'jobseeker:8','marker':'SECOND_USER'})
                warm=time.perf_counter()-warm_stamp
                assert 'PRIVATE_FIRST_USER' not in json.dumps(calls[-1])
                print(json.dumps({'isolated_worker':'pass','cross_user_context':'isolated','cold_s':round(cold,3),'warm_s':round(warm,3)}))
        else:
            from services import career_model
            career_model._WORKER_SETTINGS={'api_key':'offline-only','base_url':f'http://127.0.0.1:{server.server_port}/v1',
                                          'model':'offline','timeout':10,'max_retries':0}
            result=career_deerflow._invoke('审核监督Agent',{'draft':{},'evidence':[],'_actor':'jobseeker:7'})
        assert result['approved'] is True
        assert len(calls)>=1
        print(json.dumps({'sdk':'real_official_deerflow','local_protocol_smoke':'pass',
                          'external_model_calls':0,'elapsed_s':round(time.perf_counter()-stamp,3)},ensure_ascii=False))
    finally:
        server.shutdown();server.server_close()
