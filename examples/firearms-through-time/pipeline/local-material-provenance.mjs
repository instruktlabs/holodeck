import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
// Serve one original-source notice on loopback while importing; never a file browser.
export async function openProvenanceDocument({port=4199}={}){
 const doc=new URL('../materials/procedural-wood/README.md',import.meta.url);
 const server=createServer(async(req,res)=>{
  if(req.method!=='GET'||req.url!=='/original-wood-license'){res.writeHead(404);res.end();return;}
  try{res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(await readFile(doc));}
  catch{res.writeHead(500);res.end('Local provenance unavailable');}
 });
 let owned=true;
 try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});}
 catch(e){if(e.code!=='EADDRINUSE')throw e;owned=false;}
 const boundPort=owned?server.address().port:port,url='http://127.0.0.1:'+boundPort+'/original-wood-license';
 const close=async()=>{if(owned)await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));};
 try{
  const r=await fetch(url,{signal:AbortSignal.timeout(4000)});
  if(!r.ok||await r.text()!==await readFile(doc,'utf8'))throw Error('Local provenance port is occupied by different content');
  return {url,owned,close};
 }catch(e){await close();throw e;}
}
