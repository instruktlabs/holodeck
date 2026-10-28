import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),entries=JSON.parse(await readFile(new URL('evidence/shortlist-materials.json',root),'utf8')).entries;
const call=(args)=>{const r=spawnSync(process.execPath,[fileURLToPath(new URL('authoring/kiln.mjs',root)),...args],{cwd:fileURLToPath(root),encoding:'utf8',maxBuffer:20*1024*1024,env:{...process.env,KILN_RENDER_SERVICE_PORT:'8010',KILN_RENDER_PORT_URL:'http://127.0.0.1:8010'}});if(r.status!==0)throw Error(r.stderr||r.stdout);const j=JSON.parse(r.stdout);if(j.ok===false)throw Error(r.stdout);return j;};
await mkdir(new URL('authoring/shortlist/',root),{recursive:true});
const results=[];
for(const [index,e] of entries.entries()){
 const path='authoring/shortlist/'+e.id,receipt='evidence/shortlist-'+e.id;
 const source=`const meta={name:${JSON.stringify(e.name+' qualification swatch')}};
async function build(){
 const root=createRoot('Swatch');
 const mat=await compilePortableMaterialSpecV2(${JSON.stringify(e.portableSpec)});
 mat.name='';mat.map.name='${e.id}_Albedo';mat.normalMap.name='${e.id}_Normal';mat.roughnessMap.name='${e.id}_ORM';mat.aoMap.name='${e.id}_AO';
 // Physical one-metre square; no displacement: silhouette limitations stay visible.
 createPart('Surface',projectUV(boxGeo(1,1,.06),{projection:'box',metersPerUnit:${e.physicalSizeMeters.width}}),mat,{position:[0,.5,0],parent:root});
 return root;
}`;
 await writeFile(new URL(path+'.kiln.js',root),source);
 const registered=call(['source',path+'.kiln.js','--json']);
 await writeFile(new URL(receipt+'-source.json',root),JSON.stringify(registered,null,2));
 const ref=registered.programRef,pins='materials/polyhaven/'+e.id+'/pins.json';
 const rendered=call(['render',ref,'--materials',pins,'--out',path+'.glb','--views',receipt+'.png','--render','gpu','--json']);
 await writeFile(new URL(receipt+'-render.json',root),JSON.stringify(rendered,null,2));
 results.push({id:e.id,name:e.name,index,programRef:ref,path,position:[(index%4-1.5)*1.12,index<4?1.25:.1,0],renderReceipt:receipt+'-render.json'});
 await writeFile(new URL('evidence/shortlist-swatches.json',root),JSON.stringify(results,null,2));
 console.log(JSON.stringify({id:e.id,programRef:ref,ok:rendered.ok,fidelity:rendered.viewFidelity}));
}
