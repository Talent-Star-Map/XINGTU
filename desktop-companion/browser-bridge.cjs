const net=require('node:net'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const {siteOrigin}=require('./site-policy.cjs')
function pipeName(dataRoot){return '\\\\.\\pipe\\xingtu-companion-'+crypto.createHash('sha256').update(path.resolve(dataRoot).toLowerCase()).digest('hex').slice(0,24)}
function secretFor(dataRoot){
 fs.mkdirSync(dataRoot,{recursive:true});const f=path.join(dataRoot,'browser-bridge-secret.json')
 try{const key=JSON.parse(fs.readFileSync(f,'utf8'));if(typeof key==='string'&&/^[a-f0-9]{64}$/.test(key))return key}catch{}
 const key=crypto.randomBytes(32).toString('hex');fs.writeFileSync(f,JSON.stringify(key),{mode:0o600});return key
}
function createBrowserBridge({dataRoot,onLastDisconnect,onAttach}){
 const secret=secretFor(dataRoot),clients=new Map();let closing=false,quitTimer,order=0
 const schedule=delay=>{clearTimeout(quitTimer);quitTimer=setTimeout(()=>{if(!clients.size&&!closing)onLastDisconnect()},delay)}
 const server=net.createServer(socket=>{
  let buffer='',attached=false;socket.setEncoding('utf8');socket.on('error',()=>{})
  socket.on('data',data=>{
   buffer+=data;if(Buffer.byteLength(buffer)>16384){socket.destroy();return;}
   let at;while((at=buffer.indexOf('\n'))>=0){
    const line=buffer.slice(0,at);buffer=buffer.slice(at+1);let msg;try{msg=JSON.parse(line)}catch{socket.destroy();return;}
    if(!attached){if(msg.type!=='attach'||msg.auth!==secret||!siteOrigin(msg.origin)){socket.destroy();return;}attached=true;clients.set(socket,{origin:siteOrigin(msg.origin),at:++order});clearTimeout(quitTimer);socket.write('{"type":"ready"}\n');onAttach?.();}
    else if(msg.type==='site-active'&&siteOrigin(msg.origin))clients.set(socket,{origin:siteOrigin(msg.origin),at:++order});
    else{socket.destroy();return;}
   }
  });
  socket.on('close',()=>{if(clients.delete(socket)&&!clients.size&&!closing)schedule(1800)});
 });
 const ready=new Promise((resolve,reject)=>{server.once('error',reject);server.listen(pipeName(dataRoot),()=>{schedule(15000);resolve()})});
 return{ready,openSite(){const current=[...clients.entries()].sort((a,b)=>b[1].at-a[1].at)[0];if(!current)return false;current[0].write('{"type":"open-star-map"}\n');return true;},close(){closing=true;clearTimeout(quitTimer);for(const s of clients.keys())s.destroy();server.close();},count(){return clients.size}}
}
module.exports={pipeName,secretFor,createBrowserBridge}
