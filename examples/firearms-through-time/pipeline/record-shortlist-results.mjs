import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {shareGlbImages} from '../../../server/texture-store.mjs';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8')),require=createRequire(new URL('tools/kiln-1.5.0/package.json',root)),sharp=require('sharp');
const rows=await read('evidence/shortlist-swatches-saved.json'),base='http://127.0.0.1:4197',r=await fetch(base+'/api/session'),cookie=r.headers.get('set-cookie')?.split(';')[0],session=await r.json(),delivery=[];
for(const row of rows){
 const asset=session.assets[row.id];assert.equal('sha256:'+asset.hash,row.saved.sha256);
 const original=await readFile(new URL('holodeck-material-library/.holodeck/blobs/'+asset.hash+'.glb',root));assert.equal(createHash('sha256').update(original).digest('hex'),asset.hash);
 const derived=shareGlbImages(original);const served=Buffer.from(await(await fetch(new URL(asset.url,base),{headers:{Cookie:cookie}})).arrayBuffer());assert.deepEqual(served,derived.glb);
 for(const img of derived.images){const u=new URL('/api/textures/'+img.hash+'.'+img.ext,base);u.search=new URL(asset.url,base).search;const response=await fetch(u,{headers:{Cookie:cookie}});assert(response.ok);assert.deepEqual(Buffer.from(await response.arrayBuffer()),img.bytes);}
 delivery.push({id:row.id,sha256:asset.hash,textureImages:derived.images.length,ok:true});
}
await writeFile(new URL('evidence/shortlist-holodeck-delivery.json',root),JSON.stringify({ok:true,revision:session.world.revision,checks:delivery},null,2));
const metrics=[];
for(const row of rows){
 const rect={left:280+(row.index%4)*195,top:row.index<4?285:486,width:130,height:130},stats={};
 for(const [engine,path] of [['unreal','calibration-native-shortlist-clean.png'],['webgpu','shortlist-holodeck-webgpu.png'],['webgl','shortlist-holodeck-webgl.png']]){
  const buf=await sharp(new URL('evidence/'+path,root).pathname.replace(/^\/([A-Z]:)/,'$1')).extract(rect).toBuffer();
  stats[engine]=(await sharp(buf).stats()).channels.slice(0,3).map(c=>Number(c.mean.toFixed(2)));
 }
 metrics.push({id:row.id,rect,meanRgb:stats,meanChannelDifferenceUEvsWebGPU:stats.unreal.map((n,i)=>Number((n-stats.webgpu[i]).toFixed(2))),meanChannelDifferenceWebGLvsWebGPU:stats.webgl.map((n,i)=>Number((n-stats.webgpu[i]).toFixed(2)))});
}
await writeFile(new URL('evidence/shortlist-capture-comparison.json',root),JSON.stringify({scope:'Same frontal camera and neutral directional light. Interior swatch mean RGB only; not perceptual, BRDF, geometry, or performance equivalence.',entries:metrics},null,2));
const c=await read('materials/catalog.json');
for(const row of rows){const e=c.entries.find(e=>e.id==='polyhaven-'+row.id);e.swatch=row.saved;e.qualification.holodeck={status:'rendered',evidence:['../evidence/shortlist-holodeck-delivery.json','../evidence/shortlist-holodeck-webgpu.png','../evidence/shortlist-holodeck-webgl.png'],notes:'Seven surfaces reviewed in WebGPU and WebGL2 at measured scale; source and served texture bytes checked. Neutral frontal-light test only.'};}
await writeFile(new URL('materials/catalog.json',root),JSON.stringify(c,null,2)+'\n');
const panels=[];for(const [i,p] of ['calibration-native-shortlist-clean.png','shortlist-holodeck-webgpu.png'].entries()){panels.push({input:await sharp(new URL('evidence/'+p,root).pathname.replace(/^\/([A-Z]:)/,'$1')).extract({left:240,top:250,width:800,height:410}).toBuffer(),left:i*800,top:56});}
const svg=Buffer.from('<svg width="1600" height="56"><rect width="1600" height="56" fill="#17201a"/><text x="24" y="35" fill="#e6eddf" font-size="23" font-family="Segoe UI">Unreal · neutral frontal light</text><text x="824" y="35" fill="#e6eddf" font-size="23" font-family="Segoe UI">Holodeck · WebGPU</text></svg>');
await sharp({create:{width:1600,height:466,channels:3,background:'#17201a'}}).composite([{input:svg,left:0,top:0},...panels]).png().toFile(new URL('evidence/shortlist-comparison.png',root).pathname.replace(/^\/([A-Z]:)/,'$1'));
console.log(JSON.stringify({ok:true,entries:metrics.map(x=>({id:x.id,unrealDelta:x.meanChannelDifferenceUEvsWebGPU,webglDelta:x.meanChannelDifferenceWebGLvsWebGPU}))},null,2));

