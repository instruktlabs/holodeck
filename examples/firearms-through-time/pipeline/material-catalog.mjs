// Small local metadata tool; no remote downloads, engine mutation or activation.
import {readFile,writeFile,mkdir,rename,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),target=resolve(root,'materials/catalog.json');
const sha=b=>createHash('sha256').update(b).digest('hex');
export function validate(c){
 if(c.schemaVersion!==2||!Array.isArray(c.entries))throw Error('Expected catalog schemaVersion 2 and entries');
 const ids=new Set();for(const e of c.entries){
  if(!/^[a-z0-9][a-z0-9_-]*$/.test(e.id)||ids.has(e.id))throw Error('Invalid or duplicate id '+e.id);ids.add(e.id);
  for(const k of ['name','provider','family'])if(typeof e[k]!=='string'||!e[k].trim())throw Error(e.id+' requires '+k);
  if(new URL(e.url).protocol!=='https:')throw Error(e.id+' source must use HTTPS');
  for(const a of [e.tags,e.proceduralInspiration?.features,e.proceduralInspiration?.parameters])if(!Array.isArray(a)||a.some(v=>typeof v!=='string'))throw Error(e.id+' requires text arrays');
  if(!e.curation?.status||!['not-enabled','proposed-not-implemented','implemented'].includes(e.proceduralInspiration.status))throw Error(e.id+' incomplete metadata');
  if(!e.qualification||typeof e.qualification!=='object')throw Error(e.id+' requires qualification');
  for(const [engine,q] of Object.entries(e.qualification))if(!['pending','rendered','passed','conditional','failed'].includes(q.status)||!Array.isArray(q.evidence)||q.evidence.some(v=>typeof v!=='string')||typeof q.notes!=='string')throw Error(e.id+' invalid '+engine+' qualification');
  if(e.physicalSizeMeters!=null&&![e.physicalSizeMeters.width,e.physicalSizeMeters.height].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0))throw Error(e.id+' invalid physical size');
 }return c;
}
const [cmd='list',file,...args]=process.argv.slice(2),current=await readFile(target),catalog=validate(JSON.parse(current));
if(cmd==='list')console.log(JSON.stringify({sha256:sha(current),entries:catalog.entries.map(e=>({id:e.id,name:e.name,family:e.family,status:e.curation.status}))},null,2));
else if(cmd==='validate'){const candidate=file?validate(JSON.parse(await readFile(resolve(file),'utf8'))):catalog;console.log(JSON.stringify({ok:true,entries:candidate.entries.length,sha256:sha(file?await readFile(resolve(file)):current)}));}
else if(cmd==='apply'){
 if(!file||args[0]!=='--expect'||args[1]!==sha(current))throw Error('Apply requires a draft file and --expect <current SHA256 from list>');
 const next=validate(JSON.parse(await readFile(resolve(file),'utf8')));
 for(const old of catalog.entries){const n=next.entries.find(e=>e.id===old.id);if(!n)throw Error('Draft removes existing entry '+old.id);for(const k of ['qualification','materialPin'])if(JSON.stringify(n[k])!==JSON.stringify(old[k]))throw Error('Editorial changes cannot replace evidence or material pins: '+old.id);}
 const backups=resolve(root,'materials/catalog-backups');await mkdir(backups,{recursive:true});await copyFile(target,resolve(backups,Date.now()+'-'+sha(current).slice(0,12)+'.json'));
 const fresh=await readFile(target);if(sha(fresh)!==sha(current))throw Error('Catalog changed while applying');
 const tmp=target+'.'+process.pid+'.tmp';await writeFile(tmp,JSON.stringify(next,null,2)+'\n');await rename(tmp,target);console.log('Applied metadata draft; original retained in catalog-backups. Rebuild catalog.html to refresh the editor.');
}else throw Error('Commands: list | validate [file] | apply <draft> --expect <sha256>');
