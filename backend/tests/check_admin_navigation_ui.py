"""Verify that grouped navigation retains every admin page, history and mobile access."""
import os
import threading
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[2]
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT/'frontend/dist'),**kwargs)
    def log_message(self,*args): pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
threading.Thread(target=server.serve_forever,daemon=True).start()
origin=f'http://127.0.0.1:{server.server_port}'
output=ROOT/'tmp/admin-navigation';output.mkdir(parents=True,exist_ok=True)
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH',r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'),headless=True)
        page=browser.new_page(viewport={'width':1440,'height':1000})
        errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
        # Keep business pages in their normal empty/error states; this test never writes data.
        page.route(origin+'/api/**',lambda route:route.fulfill(status=503,json={'success':False,'message':'离线导航测试','detail':'离线导航测试','data':{'list':[],'total':0,'roles':[]}}))
        page.add_init_script("localStorage.setItem('xingtu_token','offline-test');localStorage.setItem('xingtu_role','admin');")
        page.goto(origin+'/#/admin/dashboard')
        primary=page.get_by_role('navigation',name='管理员主导航')
        expect(primary.get_by_role('button')).to_have_count(5)
        groups=[('平台总览',[('工作台','dashboard'),('数据大屏','databoard')]),('用户管理',[('求职者管理','jobseekers'),('企业管理','enterprises')]),('岗位与图谱',[('职位管理','jobs'),('分类审核','classification-review'),('岗位定义','role-definitions'),('数据质检','quality')]),('学习内容',[('学习资源','resources')]),('系统设置',[('模型配置','models')])]
        for group,entries in groups:
            primary.get_by_role('button',name=group,exact=True).click()
            secondary=page.get_by_role('navigation',name=group+'功能导航')
            for label,key in entries:
                secondary.get_by_role('button',name=label,exact=True).click()
                expect(page).to_have_url(origin+'/#/admin/'+key)
                expect(secondary.get_by_role('button',name=label,exact=True)).to_have_attribute('aria-current','page')
        primary.get_by_role('button',name='岗位与图谱',exact=True).click()
        expect(page).to_have_url(origin+'/#/admin/quality')
        page.reload()
        expect(page.get_by_role('navigation',name='岗位与图谱功能导航')).to_be_visible()
        page.screenshot(path=str(output/'desktop.png'))
        page.get_by_role('navigation',name='岗位与图谱功能导航').get_by_role('button',name='职位管理',exact=True).click()
        page.go_back()
        expect(page).to_have_url(origin+'/#/admin/quality')
        page.set_viewport_size({'width':390,'height':844})
        page.get_by_role('button',name='展开管理导航').click()
        mobile=page.get_by_role('navigation',name='管理员移动导航')
        expect(mobile.get_by_role('button')).to_have_count(10)
        mobile.get_by_role('button',name='企业管理',exact=True).click()
        expect(mobile).to_have_count(0)
        expect(page).to_have_url(origin+'/#/admin/enterprises')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),'mobile horizontal overflow'
        page.screenshot(path=str(output/'mobile.png'))
        assert not errors,errors
        browser.close()
    print('PASS: five admin groups retain ten pages, active states, remembered group, reload, history and mobile navigation')
finally: server.shutdown()
