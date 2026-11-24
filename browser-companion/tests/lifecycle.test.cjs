const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path')
const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn)},emit(...args){for(const f of this.listeners)f(...args)}})
test('real extension worker keeps one native port across tabs, focuses existing site, ends on final browser window',async()=>{
 const calls={native:0,disconnect:0,updates:[],focus:[],created:[],messages:[]},ports=[]
 let tabs=[{id:1,windowId:100,url:'http://127.0.0.1:15185/',active:true}],windows=[{id:100}]
 const chrome={runtime:{getURL:f=>'chrome-extension://test/'+f,onMessage:event(),onStartup:event(),connectNative(name){assert.equal(name,'com.xingtu.companion');calls.native++;const p={onMessage:event(),onDisconnect:event(),closed:false,postMessage(m){if(m.type==='connect')setImmediate(()=>p.onMessage.emit({type:'ready'}))},disconnect(){if(this.closed)return;this.closed=true;calls.disconnect++;setImmediate(()=>this.onDisconnect.emit())}};ports.push(p);return p}},tabs:{query:async()=>tabs,sendMessage:async(id,msg)=>calls.messages.push({id,msg}),update:async(id,value)=>calls.updates.push({id,value}),create:async value=>calls.created.push(value),onUpdated:event()},windows:{getAll:async()=>windows,update:async(id,value)=>calls.focus.push({id,value}),onRemoved:event()},action:{onClicked:event()}}
 const config=require('../sites.json');const context=vm.createContext({chrome,fetch:async()=>({json:async()=>config}),URL,Promise,setTimeout,clearTimeout})
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../background.js'),'utf8'),context)
 const request=(url,type='xingtu-page-ready',frameId=0)=>new Promise(resolve=>{const handled=chrome.runtime.onMessage.listeners[0]({type},{tab:{id:1,url},frameId},resolve);if(!handled)resolve('ignored')})
 assert.equal((await request(tabs[0].url)).available,true);assert.equal(calls.native,1)
 tabs.push({id:2,windowId:100,url:'http://127.0.0.1:15185/login/jobseeker'});await request(tabs[1].url);assert.equal(calls.native,1)
 assert.equal((await request('https://unrelated.example/')).available,false);assert.equal(await request(tabs[0].url,'xingtu-page-ready',1),'ignored');assert.equal(calls.native,1)
 ports[0].onMessage.emit({type:'open-star-map'});await new Promise(r=>setTimeout(r,10));assert.equal(calls.updates.at(-1).id,1);assert.equal(calls.focus.at(-1).id,100)
 tabs=[];ports[0].onMessage.emit({type:'open-star-map'});await new Promise(r=>setTimeout(r,10));assert.equal(calls.created.at(-1).url,'http://127.0.0.1:15185/')
 chrome.windows.onRemoved.emit(101);await new Promise(r=>setTimeout(r,10));assert.equal(calls.disconnect,0)
 windows=[];chrome.windows.onRemoved.emit(100);await new Promise(r=>setTimeout(r,10));assert.equal(calls.disconnect,1)
 windows=[{id:200}];tabs=[{id:3,windowId:200,url:'http://127.0.0.1:15185/'}];assert.equal((await request(tabs[0].url)).available,true);assert.equal(calls.native,2)
 windows=[];chrome.windows.onRemoved.emit(200);await new Promise(r=>setTimeout(r,10))
 const manifest=require('../manifest.json');assert.deepEqual(manifest.permissions,['nativeMessaging']);assert.ok(!manifest.host_permissions.includes('<all_urls>'))
})
