import {open,opendir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
export {validateScenarios,summarize,assertObservation} from './benchmark-protocol.mjs';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
async function boundedFile(file,limit){
 const handle=await open(file,'r');try{
  const stat=await handle.stat();if(!stat.isFile()||stat.size>limit)throw Error('Export exceeds bounded file size');
  const buffer=Buffer.alloc(stat.size+1);let offset=0;
  while(offset<buffer.length){const {bytesRead}=await handle.read(buffer,offset,buffer.length-offset,null);if(!bytesRead)break;offset+=bytesRead;}
  if(offset!==stat.size)throw Error('Export file size changed while reading');return buffer.subarray(0,offset);
 }finally{await handle.close();}
}
export async function verifyExport(root,expected){
 if(!/^[a-f0-9]{64}$/.test(expected))throw Error('Exact manifest hash required');
 const base=await realpath(root),bytes=await boundedFile(path.join(base,'manifest.json'),4*1024*1024);
 if(sha256(bytes)!==expected)throw Error('Static export manifest hash mismatch');
 const manifest=JSON.parse(bytes);if(manifest.format!=='holodeck-static-v1'||!Array.isArray(manifest.files)||manifest.files.length>10000||!Number.isSafeInteger(manifest.revision))throw Error('Invalid static export manifest');
 const inventory=[];let visited=0;async function walk(dir='',depth=0){if(depth>24)throw Error('Export inventory depth exceeds limit');for await(const e of await opendir(path.join(base,dir))){if(++visited>20000)throw Error('Export inventory entry limit exceeded');const f=dir?`${dir}/${e.name}`:e.name;if(e.isDirectory())await walk(f,depth+1);else if(e.isFile())inventory.push(f);else throw Error('Export links and special files forbidden');}}await walk();
 if(inventory.some(f=>/(^|\/)(EXPORT|INSTALL|EXAMPLE|REMIX)-INCOMPLETE\.txt$/.test(f)))throw Error('Export is incomplete');
 const entries=new Map(),files=new Map([['manifest.json',bytes]]);let total=bytes.length;
 for(const entry of manifest.files){
  const f=entry.file;if(typeof f!=='string'||f==='manifest.json'||f.startsWith('/')||f.includes('\\')||f.split('/').some(p=>!p||p==='.'||p==='..')||/[\x00-\x1f:?%#]/.test(f)||entries.has(f))throw Error('Unsafe or duplicate manifest file');
  if(!Number.isSafeInteger(entry.bytes)||entry.bytes<0||! /^[a-f0-9]{64}$/.test(entry.sha256))throw Error('Invalid manifest file receipt');
  total+=entry.bytes;if(total>256*1024*1024)throw Error('Export exceeds bounded benchmark inventory');entries.set(f,entry);
 }
 if(inventory.length!==entries.size+1||inventory.some(f=>f!=='manifest.json'&&!entries.has(f)))throw Error('Export inventory mismatch');
 for(const [f,entry] of entries){const data=await boundedFile(path.join(base,f),entry.bytes);if(data.length!==entry.bytes||sha256(data)!==entry.sha256)throw Error(`Export file mismatch: ${f}`);files.set(f,data);}
 return {revision:manifest.revision,manifestSha256:expected,bytes:total,files};
}
export function assertHardware(proof,backend,vendor){
 if(proof.backend!==backend)throw Error('Requested backend was not used');
 if(backend==='webgpu'){
  if(proof.adapter?.isFallbackAdapter!==false)throw Error('Actual GPUDevice fallback status unknown or true');
  const text=Object.values(proof.adapter).join(' ');if(/swiftshader|llvmpipe|lavapipe|software/i.test(text))throw Error('Software adapter rejected');if(!text.toLowerCase().includes(vendor.toLowerCase()))throw Error('Expected hardware vendor missing');
 }else{if(!proof.renderer||/swiftshader|llvmpipe|lavapipe|software/i.test(proof.renderer))throw Error('Unknown or software GL renderer');if(!proof.renderer.toLowerCase().includes(vendor.toLowerCase()))throw Error('Expected hardware vendor missing');}
}
export function assessAdmission(samples,busyCores,competing){
 const reasons=[];if(samples.length!==2)reasons.push('Two samples required');
 for(const s of samples){if(!Number.isFinite(s.load1)||s.load1<0||s.load1>=1)reasons.push('load1 is unavailable, invalid or >=1');if(!Number.isFinite(s.gpu)||s.gpu<0||s.gpu>5)reasons.push('GPU is unavailable, invalid or >5%');if(!(s.temp>=0&&s.temp<80))reasons.push('GPU temperature is unavailable or >=80C');if(!(s.availableMemory>=2e9))reasons.push('Available memory below 2GB or unavailable');}
 if(!Number.isFinite(busyCores)||busyCores<0||busyCores>=1)reasons.push('Interval CPU unavailable, invalid or >=1 busy core');if(competing.length)reasons.push('Competing build/render/test processes: '+competing.join(', '));
 return {passed:reasons.length===0,reasons,busyCores,scope:'Two-sample advisory admission, not exclusivity or during-run evidence'};
}
