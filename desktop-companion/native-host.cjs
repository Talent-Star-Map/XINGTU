const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),crypto=require('node:crypto'),{spawn}=require('node:child_process')
const {decoder,frame}=require('./native-protocol.cjs'),{pipeName}=require('./browser-bridge.cjs'),{siteOrigin}=require('./site-policy.cjs')
const manifest=require('../browser-companion/manifest.json')
const id=[...crypto.createHash('sha256').update(Buffer.from(manifest.key,'base64')).digest().subarray(0,16)].map(x=>String.fromCharCode(97+(x>>4),97+(x&15))).join('')
if(process.argv[2]!==`chrome-extension://${id}/`){process.stderr.write('Unexpected extension origin\n');process.exit(1)}
const dataRoot=path.join(__dirname,'.local-data'),pipe=pipeName(dataRoot)
let client,alive=true,launched=false,buffer='',connecting=false
const send=value=>{if(alive)process.stdout.write(frame(value))}
function stop(){if(!alive)return;alive=false;client?.destroy();process.stdin.pause();process.exit(0)}
async function attach(origin){
 if(connecting)return;connecting=true;const deadline=Date.now()+10000
 while(alive&&Date.now()<deadline){
  try{
   const socket=await new Promise((resolve,reject)=>{const s=net.connect(pipe);s.once('error',reject);s.once('connect',()=>{s.removeListener('error',reject);resolve(s)})});client=socket
   const auth=JSON.parse(fs.readFileSync(path.join(dataRoot,'browser-bridge-secret.json'),'utf8'))
   socket.setEncoding('utf8');socket.on('error',stop);socket.on('close',stop);socket.on('data',data=>{buffer+=data;if(buffer.length>16384){stop();return;}let i;while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);try{const m=JSON.parse(line);if(['ready','open-star-map'].includes(m.type))send(m);else stop()}catch{stop()}}});socket.write(JSON.stringify({type:'attach',auth,origin})+'\n');return
  }catch{
   client?.destroy();client=null
   if(!launched){launched=true;const executable=process.env.XINGTU_COMPANION_ELECTRON||path.resolve(__dirname,'../../runtime/electron.exe');const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const child=spawn(executable,[__dirname],{env,stdio:'ignore',detached:true,windowsHide:true});child.on('error',()=>{});child.unref()}
   await new Promise(resolve=>setTimeout(resolve,150))
  }
 }
 send({type:'unavailable'});stop()
}
const consume=decoder(message=>{
 const origin=siteOrigin(message.origin);if(!origin||!['connect','site-active'].includes(message.type)){stop();return}
 if(message.type==='connect'){if(!connecting)void attach(origin)}
 else if(client)client.write(JSON.stringify({type:'site-active',origin})+'\n')
});
process.stdin.on('data',chunk=>{try{consume(chunk)}catch{stop()}});process.stdin.on('end',stop);process.stdin.on('error',stop)
