const test=require('node:test'),assert=require('node:assert/strict'),net=require('node:net'),fs=require('node:fs'),path=require('node:path')
const {frame,decoder,MAX_MESSAGE}=require('../native-protocol.cjs')
const {createBrowserBridge,pipeName,secretFor}=require('../browser-bridge.cjs')
const {siteOrigin}=require('../site-policy.cjs')
test('native protocol accepts fragmented and joined frames, rejects invalid lengths and shape',()=>{
 const actual=[],consume=decoder(v=>actual.push(v)),a=frame({type:'connect',origin:'http://127.0.0.1:15185'})
 consume(a.subarray(0,2));consume(Buffer.concat([a.subarray(2),frame({type:'site-active'})]));assert.equal(actual.length,2)
 for(const n of [0,1,MAX_MESSAGE+1]){const b=Buffer.alloc(4);b.writeUInt32LE(n);assert.throws(()=>decoder(()=>{})(b))}
 assert.throws(()=>decoder(()=>{})(frame([])));assert.equal(siteOrigin('https://example.com'),null);assert.equal(siteOrigin('http://name:secret@127.0.0.1:15185'),null)
})
test('real pipe authenticates browsers, routes open to latest session and exits only after final disconnect',async()=>{
 const base=path.resolve(__dirname,'../.local-data/tests');fs.mkdirSync(base,{recursive:true});const dataRoot=fs.mkdtempSync(path.join(base,'bridge-'));let quits=0,attaches=0
 const bridge=createBrowserBridge({dataRoot,onLastDisconnect:()=>quits++,onAttach:()=>attaches++});await bridge.ready
 const connect=async auth=>{const s=net.connect(pipeName(dataRoot));s.setEncoding('utf8');await new Promise((r,j)=>{s.once('connect',r);s.once('error',j)});s.write(JSON.stringify({type:'attach',auth,origin:'http://127.0.0.1:15185'})+'\n');return s}
 const waitData=s=>new Promise(resolve=>s.once('data',resolve));const auth=secretFor(dataRoot)
 const first=await connect(auth);assert.match(await waitData(first),/ready/)
 const second=await connect(auth);assert.match(await waitData(second),/ready/);assert.equal(bridge.count(),2);assert.equal(attaches,2)
 const opened=waitData(second);assert.equal(bridge.openSite(),true);assert.match(await opened,/open-star-map/)
 first.destroy();await new Promise(r=>setTimeout(r,100));assert.equal(bridge.count(),1);assert.equal(quits,0)
 second.destroy();await new Promise(r=>setTimeout(r,2000));assert.equal(quits,1);assert.equal(bridge.count(),0);bridge.close()
})
test('unknown local clients cannot attach or open a browser session',async()=>{
 const base=path.resolve(__dirname,'../.local-data/tests');fs.mkdirSync(base,{recursive:true});const dataRoot=fs.mkdtempSync(path.join(base,'reject-'))
 const bridge=createBrowserBridge({dataRoot,onLastDisconnect:()=>{throw Error('unexpected expiry')}});await bridge.ready
 const socket=net.connect(pipeName(dataRoot));await new Promise(r=>socket.once('connect',r));socket.write(JSON.stringify({type:'attach',auth:'wrong',origin:'http://127.0.0.1:15185'})+'\n');await new Promise(r=>socket.once('close',r));assert.equal(bridge.count(),0);assert.equal(bridge.openSite(),false);bridge.close()
})
