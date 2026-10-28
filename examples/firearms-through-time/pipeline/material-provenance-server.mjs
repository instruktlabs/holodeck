// Loopback-only provenance document for unpublished, original local materials.
// The material library currently requires HTTP(S) even for private local recipes.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const doc=new URL('../materials/procedural-wood/README.md',import.meta.url);
createServer(async(req,res)=>{
 if(req.method!=='GET'||req.url!=='/original-wood-license'){res.writeHead(404);res.end();return;}
 try{const text=await readFile(doc);res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(text);}catch{res.writeHead(500);res.end('Local provenance unavailable');}
}).listen(4199,'127.0.0.1',()=>console.log('Original material provenance: http://127.0.0.1:4199/original-wood-license'));
