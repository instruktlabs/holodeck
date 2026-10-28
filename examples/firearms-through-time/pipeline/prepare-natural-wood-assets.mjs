import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const call=args=>{const p=spawnSync(process.execPath,[fileURLToPath(new URL('authoring/kiln.mjs',root)),...args],{cwd:fileURLToPath(root),encoding:'utf8',maxBuffer:20*1024*1024,env:{...process.env,KILN_RENDER_SERVICE_PORT:'8010',KILN_RENDER_PORT_URL:'http://127.0.0.1:8010'}});assert.equal(p.status,0,p.stderr||p.stdout);const r=JSON.parse(p.stdout);assert(r.ok!==false,JSON.stringify(r));return r;};
const mapCode=`function mapTimber(g,along,seed){
 g.computeBoundingBox();const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
 const lo=g.boundingBox.min.toArray(),hi=g.boundingBox.max.toArray(),extent=hi.map((v,i)=>v-lo[i]);
 for(let i=0;i<p.count;i++){
  const xyz=[p.getX(i),p.getY(i),p.getZ(i)],nn=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))];
  const face=nn.indexOf(Math.max(...nn)),end=face===along,axes=[0,1,2].filter(a=>a!==face);
  const a=end?axes[0]:axes.find(a=>a!==along),b=end?axes[1]:along,scale=end?.6:1.2;
  if(extent[a]>scale||extent[b]>scale)throw Error('Timber face exceeds atlas region; split or use another scale');
  const ou=((seed*.61803398875)%1)*(1-extent[a]/scale),ov=((seed*.41421356237)%1)*(1-extent[b]/scale);
  const u=(xyz[a]-lo[a])/scale+ou,v=(xyz[b]-lo[b])/scale+ov;
  uv.setXY(i,((end?1024:0)+16+u*992)/2048,(16+v*992)/1024);
 }
 return g;
}`;
await writeFile(new URL('authoring/timber-atlas-uv.js.txt',root),mapCode);
const mat=await read('materials/procedural-wood/natural-v1/material.json');
let edited=process.argv.includes('--remaining')?await read('evidence/natural-wood-case-edit.json'):null;
if(!edited){
const old=await readFile(new URL('authoring/opening-case-procedural-wood.kiln.js',root),'utf8'),anchor=old.split('\n').find(l=>l.includes('const wood=await'));
const start=old.indexOf('  if(group===0){'),end=old.indexOf('  g.rotateX',start),oldUV=old.slice(start,end);
const edits=[{oldString:anchor,newString:' const wood=await compilePortableMaterialSpecV2('+JSON.stringify(mat.portableSpec)+');'},
 {oldString:'async function build(){',newString:mapCode+'\nasync function build(){'},
 {oldString:oldUV,newString:'  if(group===0){const along=y>=.64||Math.abs(x)>.45?2:y<.15?0:1;mapTimber(g,along,Math.abs(Math.round(x*701+y*433+z*971))+1);}\n'}];
await writeFile(new URL('evidence/natural-wood-case-edits.json',root),JSON.stringify(edits,null,2));
edited=call(['edit','p_9e17cb8743e9','--edits','evidence/natural-wood-case-edits.json','--json']);await writeFile(new URL('evidence/natural-wood-case-edit.json',root),JSON.stringify(edited,null,2));
const render=call(['render',edited.programRef,'--materials','materials/procedural-wood/natural-v1/pins.json','--out','authoring/opening-case-natural-wood.glb','--views','evidence/natural-wood-case-kiln.png','--render','gpu','--json']);await writeFile(new URL('evidence/natural-wood-case-render.json',root),JSON.stringify(render,null,2));
const exported=spawnSync(process.execPath,[fileURLToPath(new URL('authoring/kiln.mjs',root)),'source',edited.programRef,'--out','authoring/opening-case-natural-wood.kiln.js'],{cwd:fileURLToPath(root),encoding:'utf8'});assert.equal(exported.status,0,exported.stderr);
}
const boardCode=`const meta={name:'Timber finish specimen',role:'prop'};${mapCode}\nasync function build(){const root=createRoot('TimberSpecimen');const mat=await compilePortableMaterialSpecV2(${JSON.stringify(mat.portableSpec)});mat.name='';mat.map.name='Timber_Albedo';mat.normalMap.name='Timber_Normal';mat.roughnessMap.name='Timber_ORM';mat.aoMap.name='Timber_AO';createPart('LongGrainAndCutEnds',mapTimber(boxGeo(.32,.7,.12).clone(),1,5),mat,{position:[0,.65,0],rotation:[0,-20,12],parent:root});return root;}`;
await writeFile(new URL('authoring/timber-specimen.kiln.js',root),boardCode);
const board=call(['source','authoring/timber-specimen.kiln.js','--json']);await writeFile(new URL('evidence/timber-specimen-source.json',root),JSON.stringify(board,null,2));
const br=call(['render',board.programRef,'--materials','materials/procedural-wood/natural-v1/pins.json','--out','authoring/timber-specimen.glb','--views','evidence/timber-specimen-kiln.png','--render','gpu','--json']);await writeFile(new URL('evidence/timber-specimen-render.json',root),JSON.stringify(br,null,2));
const lab=await readFile(new URL('authoring/procedural-wood-comparison.kiln.js',root),'utf8');
const noNormal=[...lab.matchAll(/mat.normalMap.name='Wood\d_Normal';/g)].map(m=>({oldString:m[0],newString:'mat.normalMap=null;'}));
await writeFile(new URL('evidence/wood-light-control-edits.json',root),JSON.stringify(noNormal,null,2));
const control=call(['edit','p_83fe892570d3','--edits','evidence/wood-light-control-edits.json','--json']);await writeFile(new URL('evidence/wood-light-control-edit.json',root),JSON.stringify(control,null,2));
const cr=call(['render',control.programRef,'--materials','evidence/procedural-wood-comparison-pins.json','--out','authoring/wood-light-control.glb','--views','evidence/wood-light-control-kiln.png','--render','gpu','--json']);await writeFile(new URL('evidence/wood-light-control-render.json',root),JSON.stringify(cr,null,2));
console.log(JSON.stringify({case:edited.programRef,board:board.programRef,control:control.programRef}));
