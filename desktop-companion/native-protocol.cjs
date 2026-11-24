const MAX_MESSAGE=64*1024
function frame(value){const body=Buffer.from(JSON.stringify(value));if(body.length>MAX_MESSAGE)throw Error('Native message too large');const header=Buffer.alloc(4);header.writeUInt32LE(body.length);return Buffer.concat([header,body])}
function decoder(onMessage){let pending=Buffer.alloc(0);return chunk=>{pending=Buffer.concat([pending,chunk]);while(pending.length>=4){const n=pending.readUInt32LE();if(n<2||n>MAX_MESSAGE)throw Error('Invalid native message size');if(pending.length<4+n)return;const value=JSON.parse(pending.subarray(4,4+n).toString('utf8'));pending=pending.subarray(4+n);if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid native message');onMessage(value)}}}
module.exports={MAX_MESSAGE,frame,decoder}
