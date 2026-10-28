// Actual booth-GLB console fit and canvas-command qualification; no browser/rendering claim.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hostThree=process.env.RANGE_TEST_THREE_ROOT??'node_modules/three';
const uri=p=>pathToFileURL(p).href,hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const report={schemaVersion:1,ok:false,qualification:'headless actual-geometry and canvas-command tests',inputs:{},tests:[],
 scope:{browserRendered:false,webGPU:false,nativeTested:false,fontRasterizationTested:false,performanceQualified:false}};
const near=(a,b,t=1e-6)=>{assert.equal(a.length,b.length);a.forEach((x,i)=>assert(Math.abs(x-b[i])<=t,`${a} != ${b}`));};
const freeze=v=>{if(v&&typeof v==='object'){Object.freeze(v);Object.values(v).forEach(freeze);}return v;};
try{
 const THREE=await import(uri(path.join(hostThree,'build/three.webgpu.js')));
 const {GLTFLoader}=await import(uri(path.join(hostThree,'examples/jsm/loaders/GLTFLoader.js')));
 report.runtime={node:process.version,three:(await read(path.join(hostThree,'package.json'))).version};
 const consoleFile=path.join(root,'game/range-console.mjs'),sessionFile=path.join(root,'game/range-session.mjs');
 const consoleBytes=await readFile(consoleFile);let code=consoleBytes.toString('utf8');
 for(const [before,after]of [
  ["import * as THREE from 'three/webgpu';",`import * as THREE from ${JSON.stringify(uri(path.join(hostThree,'build/three.webgpu.js')))};`],
  ["import {rules} from './range-session.mjs';",`import {rules} from ${JSON.stringify(uri(sessionFile))};`]
 ]){assert.equal(code.split(before).length,2);code=code.replace(before,after);}
 const {bindRangeConsoles,drawConsole,consoleFrame,consoleIds}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
 const {rangeView}=await import(uri(path.join(root,'game/range-view.mjs')));
 const {createRange,rangeAction,recordShot}=await import(uri(sessionFile));
 report.inputs.console={path:consoleFile,sha256:hash(consoleBytes),executedSourceSha256:hash(code),adaptation:'Only two import declarations redirected; source body unchanged'};
 for(const filename of ['game/range-view.mjs','game/range-session.mjs','game/range-rules-v1.json','evidence/range-v8-world-proof.json'])report.inputs[filename]={sha256:hash(await readFile(path.join(root,filename)))};
 const proof=await read(path.join(root,'evidence/range-v8-world-proof.json'));assert(proof.ok&&proof.world.revision===8);
 const placements=proof.world.scene.objects.filter(x=>consoleIds.includes(x.id));assert.equal(placements.length,3);
 assert(placements.every(p=>p.asset==='booth-console'&&p.rotation.every(v=>v===0)&&p.scale.every(v=>v===1)));
 const pin=proof.world.scene.assets.find(a=>a.id==='booth-console').provenance;
 const folder=path.join(root,'authoring/assets/kiln',pin.assetId,'revisions',pin.revisionId),glb=await readFile(path.join(folder,'asset.glb'));
 const manifest=await read(path.join(folder,'manifest.json'));assert.equal(hash(glb),manifest.files['asset.glb'].sha256);
 const jsonLength=glb.readUInt32LE(12),original=JSON.parse(glb.subarray(20,20+jsonLength).toString('utf8')),derived=structuredClone(original);
 const stripTextures=value=>{if(!value||typeof value!=='object')return;for(const key of Object.keys(value)){if(key.endsWith('Texture'))delete value[key];else stripTextures(value[key]);}};
 derived.materials.forEach(stripTextures);delete derived.images;delete derived.textures;delete derived.samplers;
 for(const key of ['meshes','nodes','accessors','bufferViews','buffers','scenes'])assert.deepEqual(derived[key],original[key],`Headless derivative changed ${key}`);
 const rawJSON=Buffer.from(JSON.stringify(derived)),jsonPad=Buffer.alloc((4-rawJSON.length%4)%4,32),json=Buffer.concat([rawJSON,jsonPad]);
 const binChunk=glb.subarray(20+jsonLength),header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(20+json.length+binChunk.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
 const derivative=Buffer.concat([header,json,binChunk]);
 const parsed=await new GLTFLoader().parseAsync(derivative.buffer.slice(derivative.byteOffset,derivative.byteOffset+derivative.byteLength),'');
 report.asset={...pin,path:path.join(folder,'asset.glb'),sha256:hash(glb),derivativeSha256:hash(derivative),
  originalImages:original.images?.length??0,headlessDerivation:'Removed image/sampler/texture declarations and material texture references in memory only; original binary, nodes, accessors, geometry and material names unchanged. No PBR/wood-image decoding claim.'};
 function recorder(){
  const calls=[],ctx={};for(const name of ['clearRect','fillRect','fillText','beginPath','arc','stroke','fill','moveTo','lineTo'])ctx[name]=(...args)=>calls.push({name,args,font:ctx.font,fillStyle:ctx.fillStyle,strokeStyle:ctx.strokeStyle,lineWidth:ctx.lineWidth});
  const canvas={width:0,height:0,getContext:name=>name==='2d'?ctx:null};return {calls,ctx,canvas};
 }
 function fixture(ids=consoleIds){
  const scene=new THREE.Scene(),screens=[],authored=[];
  for(const obj of placements.filter(p=>ids.includes(p.id))){const group=new THREE.Group();group.userData.target=obj.id;group.position.fromArray(obj.position);group.add(parsed.scene.clone(true));scene.add(group);const screen=group.getObjectByName('Mesh_Body_screen');assert(screen);screens.push(screen);}
  scene.traverse(n=>{if(n.isMesh)authored.push({node:n,material:n.material,materialJSON:JSON.stringify(n.material.toJSON()),geometry:n.geometry,position:n.position.toArray(),quaternion:n.quaternion.toArray(),scale:n.scale.toArray()});});scene.updateMatrixWorld(true);
  const canvas=recorder();return {scene,screens,authored,...canvas,binding:null};
 }
 function groupState(){
  const state=createRange('console-fixture');rangeAction(state,'start');const face={id:'paper.sheet.front',lane:'paper',origin:[23.984,1.425,-2.6],normal:[-1,0,0],right:[0,0,1],up:[0,1,0],width:.56,height:.74};
  for(const [i,x]of [-.05,0,.05].entries())recordShot(state,'console-'+i,{origin:[20,1.42,-2.6+x],direction:[1,0,0]},[face]);
  return state;
 }
 function preserved(f){for(const a of f.authored){assert.equal(a.node.material,a.material);assert.equal(JSON.stringify(a.node.material.toJSON()),a.materialJSON);assert.equal(a.node.geometry,a.geometry);assert.deepEqual(a.node.position.toArray(),a.position);assert.deepEqual(a.node.quaternion.toArray(),a.quaternion);assert.deepEqual(a.node.scale.toArray(),a.scale);}}
 const run=async(name,fn)=>{let f;try{f=fixture();const details=await fn(f);report.tests.push({name,ok:true,details:details??null});}catch(e){report.tests.push({name,ok:false,error:e.message,stack:e.stack});}finally{f?.binding?.dispose();}};
 await run('all three overlays fit the actual decoded flat screen face and face the authored approach',f=>{
  f.binding=bindRangeConsoles(f.scene,()=>f.canvas,placements);assert(f.binding);assert.equal(f.binding.overlays.length,3);
  const center=new THREE.Vector3(...consoleFrame.center),normal=new THREE.Vector3(...consoleFrame.normal),right=new THREE.Vector3(...consoleFrame.right),up=new THREE.Vector3(...consoleFrame.up),fits=[];
  for(let i=0;i<3;i++){
   const screen=f.screens[i],overlay=f.binding.overlays[i];assert.equal(overlay.parent,screen);near(screen.position.toArray(),[0,0,0]);near(screen.quaternion.toArray(),[0,0,0,1]);
   const pos=screen.geometry.attributes.position,norm=screen.geometry.attributes.normal,uv=screen.geometry.attributes.uv,front=[];
   for(let v=0;v<pos.count;v++){const n=new THREE.Vector3().fromBufferAttribute(norm,v);if(n.dot(normal)>.999999){const p=new THREE.Vector3().fromBufferAttribute(pos,v).sub(center);front.push({right:p.dot(right),up:p.dot(up),normal:p.dot(normal),uv:[uv.getX(v),uv.getY(v)]});}}
   assert(front.length>=4);const extent=key=>[Math.min(...front.map(p=>p[key])),Math.max(...front.map(p=>p[key]))];
   const horizontal=extent('right'),vertical=extent('up');near(horizontal,[-.23664,.23664]);near(vertical,[-.16914,.16914]);
   near([Math.min(...front.map(p=>p.uv[0])),Math.max(...front.map(p=>p.uv[0]))],[.007,.993]);
   near([Math.min(...front.map(p=>p.uv[1])),Math.max(...front.map(p=>p.uv[1]))],[.00973914,.99026084]);
   overlay.updateMatrix();for(const [x,y]of [[-1,-1],[-1,1],[1,-1],[1,1]]){
    const p=new THREE.Vector3(x*consoleFrame.width/2,y*consoleFrame.height/2,0).applyMatrix4(overlay.matrix).sub(center);
    assert(p.dot(right)>horizontal[0]&&p.dot(right)<horizontal[1]);assert(p.dot(up)>vertical[0]&&p.dot(up)<vertical[1]);near([p.dot(normal)],[.0008]);
   }
   f.scene.updateMatrixWorld(true);const q=overlay.getWorldQuaternion(new THREE.Quaternion());near(new THREE.Vector3(0,0,1).applyQuaternion(q).toArray(),normal.toArray());
   near(new THREE.Vector3(1,0,0).applyQuaternion(q).toArray(),right.toArray());near(new THREE.Vector3(0,1,0).applyQuaternion(q).toArray(),up.toArray());
   const obj=placements.find(p=>p.id===consoleIds[i]);near(overlay.getWorldPosition(new THREE.Vector3()).toArray(),obj.position.map((v,k)=>v+consoleFrame.center[k]+consoleFrame.normal[k]*consoleFrame.offset));
   fits.push({id:obj.id,widthMarginEach:(horizontal[1]-horizontal[0]-consoleFrame.width)/2,heightMarginEach:(vertical[1]-vertical[0]-consoleFrame.height)/2});
  }
  preserved(f);return {fits,frontOffset:.0008,actualFrame:consoleFrame};
 });
 await run('three screens share one texture and draw only when read-model key changes',f=>{
  let canvases=0;f.binding=bindRangeConsoles(f.scene,()=>{canvases++;return f.canvas;},placements);assert(f.binding);assert.equal(canvases,1);assert.equal(f.canvas.width,1024);assert.equal(f.canvas.height,728);
  assert(f.binding.overlays.every(m=>m.material.map===f.binding.texture));assert(f.binding.overlays.every(m=>m.material===f.binding.overlays[0].material&&m.geometry===f.binding.overlays[0].geometry));
  const state=groupState(),view=rangeView(state);f.binding.update(view);assert.equal(f.binding.updates,1);const calls=f.calls.length,version=f.binding.texture.version;
  f.binding.update(structuredClone(view));assert.equal(f.calls.length,calls);assert.equal(f.binding.updates,1);assert.equal(f.binding.texture.version,version);
  rangeAction(state,'end');f.binding.update(rangeView(state));assert.equal(f.binding.updates,2);assert(f.binding.texture.version>version);preserved(f);
  return {canvases,sharedTextures:1,updates:2,unchangedModelSkipped:true,colorSpace:f.binding.texture.colorSpace};
 });
 await run('selected paper archive drives all physical displays with numbered group and exact statistics',f=>{
  const state=groupState();rangeAction(state,'end');rangeAction(state,'select','plates');const ledger=JSON.stringify(state);freeze(state);
  const view=rangeView(state,0);assert.equal(view.lane,'paper');assert.equal(view.archived,true);assert.equal(view.stats.points,30);near([view.stats.group.spread,view.stats.group.rms],[.1,.0408248290463863]);
  f.binding=bindRangeConsoles(f.scene,()=>f.canvas,placements);f.binding.update(view);
  const text=f.calls.filter(c=>c.name==='fillText').map(c=>String(c.args[0]));
  for(const required of ['30','3 / 3 HITS','10.00 cm','4.08 cm','0.00, -0.50','1','2','3'])assert(text.includes(required),`Missing canvas command text ${required}`);
  assert(text.some(t=>t.startsWith('ARCHIVE  /  PAPER')));assert(text.some(t=>t.startsWith('SAVED GROUP')));
  const impactArcs=f.calls.filter(c=>c.name==='arc'&&c.args[2]===7);assert.equal(impactArcs.length,3);near(impactArcs.map(c=>c.args[0]),[322-.05*430/.74,322,322+.05*430/.74]);
  assert.equal(JSON.stringify(state),ledger);assert(f.binding.overlays.every(m=>m.material.map===f.binding.texture));preserved(f);
  return {points:view.stats.points,spread:view.stats.group.spread,rms:view.stats.group.rms,numberedMarks:3,selectedArchive:0,allThreeMirror:true,ledgerUnchanged:true};
 });
 await run('dispose restores original material identities and releases owned overlays, canvas texture and resources once',f=>{
  f.binding=bindRangeConsoles(f.scene,()=>f.canvas,placements);f.binding.update(rangeView(groupState()));
  const overlay=f.binding.overlays[0];let geometry=0,material=0,texture=0;
  overlay.geometry.addEventListener('dispose',()=>geometry++);overlay.material.addEventListener('dispose',()=>material++);f.binding.texture.addEventListener('dispose',()=>texture++);
  const updates=f.binding.updates,calls=f.calls.length;f.binding.dispose();f.binding.dispose();f.binding.update({...rangeView(groupState()),key:'after-dispose'});
  assert(f.binding.overlays.every(m=>m.parent===null));assert.equal(geometry,1);assert.equal(material,1);assert.equal(texture,1);assert.equal(f.binding.updates,updates);assert.equal(f.calls.length,calls);preserved(f);
  return {originalMeshCount:f.authored.length,originalMaterialsAndPosesPreserved:true,geometryDisposed:geometry,materialDisposed:material,textureDisposed:texture,idempotent:true};
 });
 await run('drawConsole emits finite canvas commands within the 1024 by 728 display',f=>{
  const state=groupState();drawConsole(f.ctx,rangeView(state));const commands=f.calls.length;
  for(const call of f.calls){for(const arg of call.args)if(typeof arg==='number')assert(Number.isFinite(arg));
   if(['fillText','moveTo','lineTo','arc','fillRect','clearRect'].includes(call.name)){const start=call.name==='fillText'?1:0;assert(call.args[start]>=0&&call.args[start]<=1024);assert(call.args[start+1]>=0&&call.args[start+1]<=728);}}
  return {commands,finiteAndInCanvas:true,limitation:'Command coordinates only; font glyph metrics and rasterized appearance require browser/native review'};
 });
 // A source-ready fallback will be exercised here as well; missing placement/unknown assets must fail closed.
 await run('batched preview consoles use exact pinned placement fallbacks while original screen remains attached',f=>{
  const mixed=fixture(['booth-console']);f.scene=mixed.scene;f.screens=mixed.screens;f.authored=mixed.authored;
  const nodesBefore=[];f.scene.traverse(n=>nodesBefore.push(n));
  f.binding=bindRangeConsoles(f.scene,()=>f.canvas,placements);assert(f.binding,'Mixed real and batched screens must bind with known placements');assert.equal(f.binding.overlays.length,3);
  assert.equal(f.binding.overlays[0].parent,f.screens[0]);f.scene.updateMatrixWorld(true);
  for(let i=0;i<3;i++){const obj=placements.find(p=>p.id===consoleIds[i]);near(f.binding.overlays[i].getWorldPosition(new THREE.Vector3()).toArray(),obj.position.map((v,k)=>v+consoleFrame.center[k]+consoleFrame.normal[k]*consoleFrame.offset));}
  f.binding.update(rangeView(groupState()));assert(f.binding.overlays.every(m=>m.material.map===f.binding.texture));preserved(f);
  f.binding.dispose();const nodesAfter=[];f.scene.traverse(n=>nodesAfter.push(n));assert.deepEqual(nodesAfter,nodesBefore,'Fallback frames must be removed on dispose');
  return {attachedScreens:1,fallbackScreens:2,worldTransformsMatchAuthoredPlacements:true,fallbackFramesRemovedOnDispose:true};
 });
 await run('fallback rejects unknown asset or missing placement without leaving scene nodes',f=>{
  for(const bad of [placements.filter(p=>p.id!=='booth-paper'),placements.map(p=>p.id==='booth-paper'?{...p,asset:'unknown-console'}:p)]){
   const mixed=fixture(['booth-console']);const before=[];mixed.scene.traverse(n=>before.push(n));const result=bindRangeConsoles(mixed.scene,()=>mixed.canvas,bad);
   if(result)result.dispose();assert.equal(result,null,'Unknown asset/missing placement must reject');const after=[];mixed.scene.traverse(n=>after.push(n));assert.deepEqual(after,before,'Failed binding left fallback nodes behind');preserved(mixed);
  }
  return {missingPlacementRejected:true,unknownAssetRejected:true,failedBindingLeavesNoNodes:true};
 });
 report.ok=report.tests.every(t=>t.ok);report.passed=report.tests.filter(t=>t.ok).length;report.failed=report.tests.filter(t=>!t.ok).length;
 assert.equal(hash(await readFile(consoleFile)),report.inputs.console.sha256,'Console source changed during test');
 for(const [name,pin]of Object.entries(report.inputs).filter(([key])=>key!=='console'))assert.equal(hash(await readFile(path.join(root,name))),pin.sha256,`Input changed: ${name}`);
}catch(error){report.ok=false;report.setupError={message:error.message,stack:error.stack};}
report.limitations=['No browser or native rendered readability/typography qualification.','Texture-image references removed only in the headless GLB derivative; original bytes and files untouched.','Canvas is a 2D command recorder, not a pixel renderer.','No performance verdict under PC and hub load.'];
const output=path.join(root,'evidence/range-v9-console-test.json');await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ok:report.ok,passed:report.passed??0,failed:report.failed??0,setupError:report.setupError?.message,failures:report.tests.filter(t=>!t.ok).map(t=>({name:t.name,error:t.error})),report:output},null,2));
if(!report.ok)process.exitCode=1;
