"""Headless UI acceptance against a local build and deterministic API/media fixtures."""
import json
import os
import threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[2]
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(ROOT/'frontend/dist'), **kwargs)
    def log_message(self, *args): pass
server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
output = ROOT/'tmp/interview-ui'
output.mkdir(parents=True, exist_ok=True)

def mock(route):
    path = urlparse(route.request.url).path
    data = {}
    if path == '/api/kg/explorer/employment':
        params = parse_qs(urlparse(route.request.url).query)
        if params.get('stage') == ['roles']:
            nodes = [{'id':'role:frontend','name':'Web前端开发','type':'Cluster','member_count':12}]
        else:
            nodes = [{'id':'nature:software','name':'软件研发','type':'Nature','member_count':30}]
        data = {'success':True,'data':{'ready':True,'nodes':nodes}}
    elif path == '/api/interview/bootstrap': data = {'target_role':'前端开发工程师','resume_title':'我的前端简历','profile_available':True,'skills':['React']}
    elif path == '/api/interview/voice/status': data = {'configured':False}
    elif path == '/api/interview/prepare': data = {'context_id':'offline-context','target_questions':7,'resume_title':'我的前端简历','job_evidence_count':3,'question_bank_count':5}
    elif path == '/api/interview/conversation':
        body = route.request.post_data_json
        previous = max([t.get('main_index',0) for t in body['history']] or [0])
        index = min(previous+1,7)
        text = f'你的回答提到了实践。第{index}道问题，请介绍你如何定位问题。'
        events = [{'type':'context','main_index':index,'target_questions':7,'focus':'项目实践','complete':previous>=7}, {'type':'delta','text':text}, {'type':'sentence','text':text}, {'type':'done'}]
        route.fulfill(content_type='application/x-ndjson', body=''.join(json.dumps(e,ensure_ascii=False)+'\n' for e in events)); return
    elif path == '/api/interview/report':
        body = route.request.post_data_json
        data = {'summary':'你完成了本次练习。','items':[{'index':i+1,'quote':t['answer'][:10],'strength':'描述了实践','improvement':'补充验证结果','outline':'背景、行动、结果'} for i,t in enumerate(body['history'])], 'notice':'AI练习反馈'}
    else: data = {'success':True,'data':[]}
    route.fulfill(json=data)

try:
    with sync_playwright() as p:
        exe = os.getenv('CHROMIUM_PATH', r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe')
        browser = p.chromium.launch(executable_path=exe, headless=True, args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'])
        page = browser.new_page(viewport={'width':1440,'height':1000}, permissions=['camera','microphone'])
        errors = []; page.on('pageerror', lambda err: errors.append(str(err)))
        page.route(origin+'/api/**', mock)
        page.add_init_script("""localStorage.setItem('xingtu_token','offline-test');localStorage.setItem('xingtu_role','jobseeker');
        Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{name:'Microsoft Huihui',lang:'zh-CN',voiceURI:'huihui'}],addEventListener(){},removeEventListener(){},cancel(){},speak(u){setTimeout(()=>u.onstart?.(),0);setTimeout(()=>u.onend?.(),50)}}});
        window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
        window.SpeechRecognition=class{start(){window.__lastRecognition=this;window.__recognitionStarts=(window.__recognitionStarts||0)+1}stop(){this.onend?.()}abort(){}};
        """)
        page.goto(origin+'/#/interview')
        expect(page.get_by_role('button',name='开始面试 · 自动准备资料')).to_be_visible()
        expect(page.get_by_text('我的前端简历',exact=True)).to_be_visible()
        expect(page.get_by_text('资料暂时无法读取，开始时将重新准备。', exact=True)).to_have_count(0)
        page.get_by_role('button', name='软件研发').click()
        page.get_by_role('button', name='Web前端开发').click()
        expect(page.get_by_role('textbox', name='目标岗位')).to_have_value('Web前端开发')
        assert page.get_by_placeholder('粘贴与目标岗位相关的项目经历或岗位要求，无需填写姓名、电话等个人信息。').count()==0
        page.screenshot(path=str(output/'setup.png'))
        page.get_by_role('button',name='开始面试 · 自动准备资料').click()
        expect(page.get_by_text('你的回答提到了实践。第1道问题，请介绍你如何定位问题。',exact=True)).to_be_visible()
        page.wait_for_function('window.__recognitionStarts > 0')
        assert page.locator('video').nth(1).evaluate('(v)=>!!v.srcObject')
        initial_height = page.locator('video').nth(1).bounding_box()['height']
        assert initial_height >= 300, 'camera preview should be prominent on desktop'
        page.get_by_role('button',name='缩小我的画面').click()
        assert page.locator('video').nth(1).bounding_box()['height'] < initial_height
        page.get_by_role('button',name='放大我的画面').click()
        page.screenshot(path=str(output/'room.png'))
        page.evaluate('''() => {
          const result = [{ transcript: '我会先检查日志和指标，再验证改进。' }]; result.isFinal = true;
          window.__lastRecognition.onresult({ resultIndex: 0, results: [result] });
        }''')
        expect(page.get_by_text('你的回答提到了实践。第2道问题，请介绍你如何定位问题。',exact=True)).to_be_visible(timeout=15000)
        assert page.get_by_role('textbox',name='文字回答').count() == 0
        assert page.get_by_role('region', name='面试官字幕').count() == 1
        for i in range(2,8):
            page.wait_for_function('window.__lastRecognition != null')
            page.evaluate("""(i) => {
              const result = [{transcript:'我通过日志和压测验证改进，这是第'+i+'次实践。'}]; result.isFinal=true;
              window.__lastRecognition.onresult({resultIndex:0,results:[result]});
            }""", i)
            if i<7:
                expect(page.get_by_text(f'你的回答提到了实践。第{i+1}道问题，请介绍你如何定位问题。',exact=True)).to_be_visible(timeout=15000)
            else: expect(page.get_by_text('面试完成，看看你的练习反馈',exact=True)).to_be_visible(timeout=15000)
        assert page.locator('video').nth(1).evaluate('(v)=>!v.srcObject || v.srcObject.getTracks().every(t=>t.readyState==="ended")')
        page.screenshot(path=str(output/'report.png'))
        assert not errors, errors
        page.get_by_role('button',name='再练一次',exact=True).click()
        page.set_viewport_size({'width':390,'height':844})
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'mobile horizontal overflow'
        browser.close()
    print('PASS: interview setup, automatic camera/listening, scroll conversation, seven-question report and mobile layout')
finally:
    server.shutdown()
