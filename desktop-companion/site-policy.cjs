const config=require('../browser-companion/sites.json')
function siteOrigin(raw){try{const u=new URL(raw);return !u.username&&!u.password&&config.origins.includes(u.origin)?u.origin:null}catch{return null}}
module.exports={siteOrigin,config}
