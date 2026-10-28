// Powered by Poly Haven. Local, cached qualification adapter; not a released extension.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createMaterialRecordV1,createMaterialLibraryPayload} from '../tools/kiln-1.5.0/node_modules/@instruktlabs/kiln/lib/material-library-node.js';
const root=new URL('../',import.meta.url),require=createRequire(new URL('tools/kiln-1.5.0/package.json',root)),sharp=require('sharp');
const ids=['fine_grained_wood','weathered_brown_planks','white_plaster_02','concrete_floor_02','corrugated_iron','red_brick_03','stone_brick_wall_001'];
const sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const headers={'User-Agent':'Kiln-MaterialQualification-Prototype/0.1 (Powered by Poly Haven)'};
const existsRead=async p=>{try{return await readFile(p);}catch(e){if(e.code!=='ENOENT')throw e;return null;}};
async function cached(url,path){const old=await existsRead(path);if(old)return old;const r=await fetch(url,{headers,signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(url+' '+r.status);const b=Buffer.from(await r.arrayBuffer());if(b.length>24*1024*1024)throw Error('Download exceeds bounded map size');await writeFile(path,b);return b;}
const results=[];
for(const id of ids){
 const dir=new URL('materials/polyhaven/'+id+'/',root);await mkdir(new URL('original/',dir),{recursive:true});
 const info=JSON.parse(await cached('https://api.polyhaven.com/info/'+id,new URL('info.json',dir)));
 const files=JSON.parse(await cached('https://api.polyhaven.com/files/'+id,new URL('files.json',dir)));
 const stampFile=new URL('acquired-at.txt',dir),oldStamp=await existsRead(stampFile),accessedAt=oldStamp?.toString()||new Date().toISOString();if(!oldStamp)await writeFile(stampFile,accessedAt);
 if(!info.dimensions?.every(n=>Number.isFinite(n)&&n>0))throw Error(id+' missing measured dimensions');
 const physicalSizeMeters={width:info.dimensions[0]/1000,height:info.dimensions[1]/1000};
 const originalFiles=[],maps=[];
 for(const [slot,key] of [['baseColor','Diffuse'],['normal','nor_gl'],['metallicRoughness','arm']]){
  const f=files[key]?.['1k']?.png;if(!f)throw Error(id+' missing PNG '+key);
  const url=new URL(f.url);if(url.protocol!=='https:'||url.hostname!=='dl.polyhaven.org')throw Error('Unexpected download host');
  const name=url.pathname.split('/').at(-1),bytes=await cached(url,new URL('original/'+name,dir));
  if(bytes.length!==f.size||createHash('md5').update(bytes).digest('hex')!==f.md5)throw Error(id+' upstream integrity failure');
  originalFiles.push({name,bytes:bytes.length,sha256:sha(bytes)});
  const metadata=await sharp(bytes).metadata();
  // Decode to eight-bit pixels without creative edits; no gamma operation on data maps.
  const raw=await sharp(bytes).removeAlpha().raw({depth:'uchar'}).toBuffer({resolveWithObject:true});
  const normalized=await sharp(raw.data,{raw:raw.info}).png().toBuffer();
  const transforms=[{operation:'decode-to-rgb8-png',tool:'sharp',version:sharp.versions.sharp,parameters:{sourceBitDepth:metadata.bitsPerSample||8,outputBitDepth:8,resampled:false,gammaOperation:false}}];
  const map={slot,sourceId:id,originalFile:name,bytes:normalized,transforms,...(slot==='normal'?{normalConvention:'opengl'}:{}),...(slot==='metallicRoughness'?{channelPacking:'r-occlusion-g-roughness-b-metallic'}:{})};maps.push(map);
  if(slot==='metallicRoughness')maps.push({...map,slot:'occlusion'});
  await writeFile(new URL(slot+'.png',dir),normalized);
 }
 const record=await createMaterialRecordV1({materialId:'polyhaven-'+id.replaceAll('_','-'),name:info.name,tags:[...new Set(['polyhaven','cc0',...info.tags.slice(0,6)])],tileable:true,physicalSizeMeters,parameters:{baseColor:0xffffff,roughness:1,metalness:1},sources:[{id,kind:'external',provider:'Poly Haven',creator:Object.keys(info.authors).join(', '),assetId:id,assetUrl:'https://polyhaven.com/a/'+id,accessedAt,license:{spdx:'CC0-1.0',url:'https://polyhaven.com/license',attribution:info.name+' by '+Object.keys(info.authors).join(', ')+' / Poly Haven'},originalFiles}],maps});
 await writeFile(new URL('material-payload.json',dir),JSON.stringify(await createMaterialLibraryPayload([record])));
 const pins=[{resourceId:record.manifest.materialId,revisionId:record.manifest.revisionId,sha256:record.manifest.revisionId}];await writeFile(new URL('pins.json',dir),JSON.stringify(pins,null,2));
 const run=args=>{const r=spawnSync(process.execPath,[fileURLToPath(new URL('authoring/kiln.mjs',root)),...args],{cwd:fileURLToPath(root),encoding:'utf8',maxBuffer:20*1024*1024});if(r.status!==0)throw Error(r.stderr||r.stdout);return JSON.parse(r.stdout);};
 run(['material','import','--file',fileURLToPath(new URL('material-payload.json',dir)),'--json']);
 const got=run(['material','get',record.manifest.materialId,record.manifest.revisionId,'--json']);await writeFile(new URL('material.json',dir),JSON.stringify(got,null,2));
 const row={id,name:info.name,materialId:record.manifest.materialId,revisionId:record.manifest.revisionId,physicalSizeMeters,legacyScale:info.scale,sourceFiles:originalFiles,normalizedMaps:record.manifest.maps,portableSpec:got.portableSpec};results.push(row);
 console.log(JSON.stringify({id,materialId:row.materialId,revisionId:row.revisionId,physicalSizeMeters,originalBytes:originalFiles.reduce((s,f)=>s+f.bytes,0)}));
}
await writeFile(new URL('evidence/shortlist-materials.json',root),JSON.stringify({provider:'Powered by Poly Haven',resolution:'1k',entries:results},null,2));
