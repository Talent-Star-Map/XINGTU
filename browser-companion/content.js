(() => {
 if(window.top!==window||/^\/(print|share|resume-reader)(\/|$)/.test(location.pathname))return;
 let available=false;
 const notify=()=>window.postMessage({type:'xingtu-desktop-state',available},location.origin);
 const connect=()=>chrome.runtime.sendMessage({type:'xingtu-page-ready'}).then(result=>{available=result?.available===true;notify();}).catch(()=>{available=false;notify();});
 chrome.runtime.onMessage.addListener(message=>{if(message?.type==='xingtu-desktop-state'){available=message.available===true;notify();}});
 window.addEventListener('message',event=>{if(event.source===window&&event.origin===location.origin&&event.data?.type==='xingtu-desktop-status-request'){
  try{chrome.runtime.sendMessage({type:'xingtu-page-status'}).then(result=>{available=result?.available===true;notify();}).catch(()=>{available=false;notify();});}catch{available=false;notify();}
 }});
 void connect();
})();
