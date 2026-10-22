// Stdio MCP server that Claude Code launches from Holodeck's --mcp-config.
// It holds no world state: tools/list and tools/call are forwarded over a
// local pipe to the Holodeck host, which owns the store and approval cards.
import net from 'node:net';
import {createInterface} from 'node:readline';

const pipe=process.env.HOLODECK_BRIDGE_PIPE,token=process.env.HOLODECK_BRIDGE_TOKEN;
const write=m=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',...m})+'\n');
const pending=new Map();let next=0,socket=null;

function host(){
  if(socket)return socket;
  socket=net.connect(pipe);socket.setEncoding('utf8');
  createInterface({input:socket}).on('line',line=>{
    let m;try{m=JSON.parse(line);}catch{return;}
    const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);
  });
  const fail=()=>{for(const p of pending.values())p.reject(new Error('Holodeck host is unavailable'));pending.clear();socket=null;};
  socket.on('error',fail);socket.on('close',fail);
  return socket;
}
function forward(method,params){
  return new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});host().write(JSON.stringify({id,token,method,params})+'\n');});
}

createInterface({input:process.stdin}).on('line',async line=>{
  let m;try{m=JSON.parse(line);}catch{return;}
  if(m.id===undefined)return; // Notifications such as notifications/initialized need no reply.
  try{
    if(m.method==='initialize')return write({id:m.id,result:{protocolVersion:m.params?.protocolVersion||'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'holodeck',version:'0.0.0'}}});
    if(m.method==='ping')return write({id:m.id,result:{}});
    if(m.method==='tools/list'||m.method==='tools/call')return write({id:m.id,result:await forward(m.method,m.params||{})});
    write({id:m.id,error:{code:-32601,message:'Unsupported request'}});
  }catch(e){write({id:m.id,error:{code:-32603,message:e.message}});}
}).on('close',()=>{socket?.end();process.exit(0);});
