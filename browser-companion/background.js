let nativePort=null, nativeReady=false, siteOrigin='', connecting=null;
const config=fetch(chrome.runtime.getURL('sites.json')).then(r=>r.json());
const normalSite=async raw=>{try{const u=new URL(raw),c=await config;return c.origins.includes(u.origin)&&!/^\/(print|share|resume-reader)(\/|$)/.test(u.pathname)?u.origin:null;}catch{return null;}};
async function starTabs(){const c=await config;const tabs=await chrome.tabs.query({url:c.origins.map(o=>o+'/*')});return tabs.filter(t=>c.origins.includes(new URL(t.url).origin));}
async function broadcast(){for(const t of await starTabs())chrome.tabs.sendMessage(t.id,{type:'xingtu-desktop-state',available:nativeReady}).catch(()=>{});}
async function openStarMap(){
 const tabs=await starTabs();const target=tabs.find(t=>t.active)||tabs.find(t=>new URL(t.url).origin===siteOrigin)||tabs[0];
 if(target){await chrome.tabs.update(target.id,{active:true});await chrome.windows.update(target.windowId,{focused:true});}
 else await chrome.tabs.create({url:(siteOrigin||new URL((await config).defaultSite).origin)+'/'});
}
function disconnect(){const old=nativePort;nativePort=null;nativeReady=false;connecting=null;old?.disconnect();void broadcast();}
async function ensureNative(raw){
 const origin=await normalSite(raw);if(!origin)return false;siteOrigin=origin;
 if(nativePort){nativePort.postMessage({type:'site-active',origin});return nativeReady;}
 if(connecting)return connecting;
 connecting=new Promise(resolve=>{
  let settled=false;const finish=ready=>{if(!settled){settled=true;clearTimeout(timeout);resolve(ready);}};
  const port=chrome.runtime.connectNative('com.xingtu.companion');nativePort=port;
  const timeout=setTimeout(()=>{finish(false);if(nativePort===port)disconnect();},12000);
  port.onMessage.addListener(message=>{
   if(message?.type==='ready'){nativeReady=true;finish(true);void broadcast();}
   else if(message?.type==='open-star-map')void openStarMap();
  });
  port.onDisconnect.addListener(()=>{void chrome.runtime.lastError;if(nativePort===port){nativePort=null;nativeReady=false;connecting=null;void broadcast();}finish(false);});
  port.postMessage({type:'connect',origin});
 });
 const result=await connecting;connecting=null;return result;
}
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(!['xingtu-page-ready','xingtu-page-status'].includes(message?.type)||!sender.tab||sender.frameId!==0)return false;
 void normalSite(sender.tab.url).then(async origin=>{if(!origin){reply({available:false});return;}const available=message.type==='xingtu-page-status'?nativeReady:await ensureNative(sender.tab.url);reply({available});});return true;
});
chrome.tabs.onUpdated.addListener((_id,change,tab)=>{if(change.status==='complete'&&tab.url)void normalSite(tab.url).then(o=>o&&ensureNative(tab.url));});
chrome.windows.onRemoved.addListener(()=>{void chrome.windows.getAll({windowTypes:['normal']}).then(windows=>{if(!windows.length)disconnect();});});
chrome.runtime.onStartup.addListener(()=>{void starTabs().then(t=>t[0]&&ensureNative(t[0].url));});
chrome.action.onClicked.addListener(()=>{void starTabs().then(async tabs=>{if(tabs[0]){await ensureNative(tabs[0].url);await openStarMap();}else await chrome.tabs.create({url:(await config).defaultSite});});});
