// Headless functional qualification of the ACTUAL adapter and immutable target GLBs.
// Run: node pipeline/test-range-adapter.mjs. No renderer, browser, native process or installs.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hostThree=process.env.RANGE_TEST_THREE_ROOT??'node_modules/three';
const out=path.join(root,'evidence/range-v9-adapter-test.json');
const digest=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const uri=p=>pathToFileURL(p).href;
const report={schemaVersion:1,ok:false,qualification:'headless adapter functional only',
 scope:{browserRendered:false,webGPU:false,nativeTested:false,performanceQualified:false},
 runtime:{node:process.version,threeRoot:hostThree},inputs:{},assets:[],tests:[]};
const approx=(a,b,epsilon=1e-7)=>assert(Math.abs(a-b)<=epsilon,`${a} differs from ${b} by more than ${epsilon}`);
const near=(a,b,e=1e-7)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>approx(v,b[i],e));};
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const v of Object.values(value))freeze(v);}return value;};
try{
 const threePackage=await read(path.join(hostThree,'package.json'));report.runtime.three=threePackage.version;
 const THREE=await import(uri(path.join(hostThree,'build/three.webgpu.js')));
 const {GLTFLoader}=await import(uri(path.join(hostThree,'examples/jsm/loaders/GLTFLoader.js')));
 const sessionFile=path.join(root,'game/range-session.mjs');
 const {createRange,rangeAction,recordShot,stepRange,stats,intersectSurface,rules}=await import(uri(sessionFile));
 const adapterFile=path.join(root,'game/range-three.mjs');
 const adapterBytes=await readFile(adapterFile);let adapterSource=adapterBytes.toString('utf8');
 const collisionFile=path.join(root,'game/range-collision-v1.json');
 const collisionBytes=await readFile(collisionFile);const collision=JSON.parse(collisionBytes);
 // Only imports are adapted for Node: the source body remains byte-for-byte unchanged.
 const replacements=[
  ["import * as THREE from 'three/webgpu';",`import * as THREE from ${JSON.stringify(uri(path.join(hostThree,'build/three.webgpu.js')))};`],
  ["import collision from './range-collision-v1.json';",`import collision from ${JSON.stringify(uri(collisionFile))} with {type:'json'};`],
  ["import {rules} from './range-session.mjs';",`import {rules} from ${JSON.stringify(uri(sessionFile))};`]
 ];
 for(const [before,after]of replacements){assert.equal(adapterSource.split(before).length,2,`Exact import declaration absent/duplicated: ${before}`);adapterSource=adapterSource.replace(before,after);}
 const {bindRange}=await import('data:text/javascript;base64,'+Buffer.from(adapterSource).toString('base64'));
 report.inputs.adapter={path:adapterFile,sha256:digest(adapterBytes),importAdaptation:'Exactly 3 import declarations redirected in memory; adapter body unchanged',executedSourceSha256:digest(adapterSource)};
 for(const filename of ['game/range-session.mjs','game/range-rules-v1.json','game/range-collision-v1.json','evidence/range-v8-world-proof.json']){
  const bytes=await readFile(path.join(root,filename));report.inputs[filename]={sha256:digest(bytes),bytes:bytes.length};
 }
 const proof=await read(path.join(root,'evidence/range-v8-world-proof.json'));
 assert(proof.ok);assert.equal(proof.world.revision,8);assert.equal(collision.worldRevision,8);
 const world=proof.world.scene,ids=['paper-carrier','plate-rack','range-target'];const loaded=[];
 for(const id of ids){
  const obj=world.objects.find(x=>x.id===id);assert(obj,`Missing object ${id}`);
  const asset=world.assets.find(x=>x.id===obj.asset);assert(asset?.provenance);
  const {assetId,revisionId}=asset.provenance;
  const dir=path.join(root,'authoring/assets/kiln',assetId,'revisions',revisionId);
  const glbFile=path.join(dir,'asset.glb'),bytes=await readFile(glbFile),manifest=await read(path.join(dir,'manifest.json'));
  assert.equal(digest(bytes),manifest.files['asset.glb'].sha256,`Saved GLB hash ${id}`);
  const jsonLength=bytes.readUInt32LE(12),json=JSON.parse(bytes.subarray(20,20+jsonLength).toString('utf8'));
  assert.equal(json.textures?.length??0,0);assert.equal(json.images?.length??0,0);
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  assert(obj.rotation.every(v=>v===0)&&obj.scale.every(v=>v===1),'This fixture uses the pinned unrotated unit-scale placements');
  loaded.push({id,obj,gltf});
  report.assets.push({id,assetId,revisionId,glb:glbFile,sha256:digest(bytes),position:obj.position,rotation:obj.rotation,scale:obj.scale,textureCount:0});
 }
 function fixture(){
  const scene=new THREE.Scene(),objects={};
  for(const {id,obj,gltf}of loaded){const wrapper=new THREE.Group();wrapper.name='Fixture_'+id;wrapper.userData.target=id;
   wrapper.position.fromArray(obj.position);wrapper.scale.fromArray(obj.scale);wrapper.add(gltf.scene.clone(true));scene.add(wrapper);objects[id]=wrapper;}
  scene.updateMatrixWorld(true);
  const state=createRange('adapter-fixture'),calls=[];
  function previous(...args){calls.push({receiver:this,args});return args[0]===-999?'existing-static-blocker':null;}
  const runtime={collisionAt:previous,playerBody:{position:[-100,0,-100],radius:.22,height:1.72}};
  const carrier=objects['paper-carrier'].getObjectByName('pivot_carrier'),sheet=objects['paper-carrier'].getObjectByName('anchor_sheet_front');
  const pivots=Array.from({length:5},(_,i)=>objects['plate-rack'].getObjectByName('pivot_plate_'+String(i+1).padStart(2,'0')));
  const original=objects['range-target'].getObjectByName('Joint_Target');
  const rest={carrier:carrier.position.toArray(),rotations:pivots.map(p=>p.rotation.toArray()),originalChildren:original.children.length};
  const adapter=bindRange(scene,runtime,state);assert(adapter,'Actual pinned targets failed to bind');
  return {scene,objects,state,runtime,previous,calls,carrier,sheet,pivots,original,rest,adapter};
 }
 const rayAt=(f,u=0,v=0,distance=4)=>{
  const point=f.origin.map((n,i)=>n+f.right[i]*u+f.up[i]*v);
  return {origin:point.map((n,i)=>n+f.normal[i]*distance),direction:f.normal.map(v=>-v)};
 };
 const markerMeshes=f=>{const a=[];f.scene.traverse(n=>{if(n.isMesh&&n.userData.rangeMark===true)a.push(n);});return a;};
 const run=async(name,fn)=>{let f;try{f=fixture();const details=await fn(f);report.tests.push({name,ok:true,details:details??null});}
  catch(error){report.tests.push({name,ok:false,error:error.message,stack:error.stack});}
  finally{f?.adapter.dispose();}};

 await run('seven surfaces use the actual pinned anchors and world coordinate frames',f=>{
  const surfaces=f.adapter.surfaces();assert.equal(surfaces.length,7);assert.equal(new Set(surfaces.map(x=>x.id)).size,7);
  const expected=[['paper.sheet.front',[23.984,1.425,-2.6],.56,.74],['original.face',[23.9525,1.7,0],.59,.67],
   ...Array.from({length:5},(_,i)=>['plate.'+String(i+1).padStart(2,'0')+'.front',[24.083,1.313,2.6-.72+i*.36],.272,.272])];
  for(const [id,origin,width,height]of expected){const s=surfaces.find(x=>x.id===id);assert(s);near(s.origin,origin);near(s.normal,[-1,0,0]);near(s.right,[0,0,1]);near(s.up,[0,1,0]);approx(s.width,width);approx(s.height,height);}
  near(surfaces[0].origin,f.sheet.getWorldPosition(new THREE.Vector3()).toArray());
  const paper=surfaces[0];near(intersectSurface(rayAt(paper,paper.width/2,paper.height/2),paper).uv,[1,1]);
  assert.equal(intersectSurface(rayAt(paper,paper.width/2+.001,0),paper),null);
  assert.equal(intersectSurface({origin:paper.origin.map((v,i)=>v-paper.normal[i]),direction:paper.normal},paper),null);
  return {surfaces,cornerUV:[1,1],outsideAndBackFaceRejected:true};
 });
 await run('three paper impacts yield 30 points, 0.1 m spread and 0.040824829 m RMS',f=>{
  assert(rangeAction(f.state,'start'));const paper=f.adapter.surfaces().find(x=>x.lane==='paper');
  for(const [i,u]of [-.05,0,.05].entries()){
   const shot=recordShot(f.state,'paper-'+i,rayAt(paper,u,-.005),f.adapter.surfaces(),f.adapter.boxes());
   assert.equal(shot.outcome,'hit');assert.equal(shot.points,10);near(shot.impact.local,[u,-.005]);assert.equal(shot.sequence,i+1);assert.equal(shot.impact.surfaceId,'paper.sheet.front');
   near(shot.impact.frame.origin,paper.origin);near(shot.impact.world,[paper.origin[0],paper.origin[1]-.005,paper.origin[2]+u]);
  }
  const result=stats(f.state.shots);assert.equal(result.points,30);assert.equal(result.hits,3);near(result.group.centroid,[0,-.005]);approx(result.group.spread,.1);approx(result.group.rms,.0408248290463863,1e-10);
  f.adapter.apply();assert.equal(markerMeshes(f).length,3);return result;
 });
 await run('only the struck first plate changes pose; other four plates and paper stay fixed',f=>{
  assert(rangeAction(f.state,'select','plates'));assert(rangeAction(f.state,'start'));
  const before=f.adapter.surfaces(),plate=before.find(x=>x.id==='plate.01.front');
  const shot=recordShot(f.state,'plate-first',rayAt(plate),before,f.adapter.boxes());assert.equal(shot.outcome,'hit');assert.equal(shot.points,10);
  for(let i=0;i<40;i++)stepRange(f.state,1/60);const after=f.adapter.surfaces();
  approx(f.pivots[0].rotation.z,-rules.plateAngle);assert.equal(f.state.plates.filter(Boolean).length,1);
  for(let i=1;i<5;i++)assert.deepEqual(f.pivots[i].rotation.toArray(),f.rest.rotations[i]);
  for(const surface of before.filter(s=>s.id!=='plate.01.front'))assert.deepEqual(after.find(s=>s.id===surface.id),surface);
  assert.notDeepEqual(after.find(s=>s.id===plate.id).origin,plate.origin);assert.notDeepEqual(after.find(s=>s.id===plate.id).normal,plate.normal);
  near(after.find(s=>s.id===plate.id).origin,f.objects['plate-rack'].getObjectByName('anchor_plate_01_face').getWorldPosition(new THREE.Vector3()).toArray());
  return {angles:f.state.angles,firstSurfaceBefore:plate,firstSurfaceAfter:after.find(s=>s.id===plate.id)};
 });
 await run('paper marker follows retrieval while immutable historical world/local/frame data stay fixed',f=>{
  rangeAction(f.state,'start');const paper=f.adapter.surfaces().find(x=>x.lane==='paper');
  recordShot(f.state,'retained',rayAt(paper,.025,-.015),f.adapter.surfaces(),f.adapter.boxes());f.adapter.apply();
  const marker=markerMeshes(f)[0];assert.equal(marker.parent,f.sheet);const local=marker.position.toArray(),worldBefore=marker.getWorldPosition(new THREE.Vector3()).toArray();
  rangeAction(f.state,'return');const history=JSON.stringify({shots:f.state.shots,archives:f.state.archives});
  f.state.shots.forEach(freeze);f.state.archives.forEach(freeze);
  for(let i=0;i<260;i++){stepRange(f.state,1/60,{blocked:f.adapter.blocked});f.adapter.apply();}
  assert.equal(f.state.phase,'review');assert.equal(f.state.travel,1);near(marker.position.toArray(),local);
  const worldAfter=marker.getWorldPosition(new THREE.Vector3()).toArray();near(worldAfter,[worldBefore[0]-3.2,worldBefore[1],worldBefore[2]]);
  assert.equal(JSON.stringify({shots:f.state.shots,archives:f.state.archives}),history);assert.equal(markerMeshes(f).length,1);
  assert(rangeAction(f.state,'replace'));f.adapter.apply();assert.equal(marker.visible,false);assert.equal(marker.parent,null);assert.equal(JSON.stringify({shots:f.state.shots,archives:f.state.archives}),history);
  return {carrierStart:f.rest.carrier,carrierEnd:f.carrier.position.toArray(),worldBefore,worldAfter,historyUnchanged:true,replacedSheetHidesOldMark:true};
 });
 await run('all 49 static boxes permit the full retrieval corridor and every incremental sweep',f=>{
  assert.equal(collision.boxes.length,49);assert.equal(f.adapter.boxes().length,50);
  assert.deepEqual(f.adapter.boxes().slice(0,49),collision.boxes);
  assert.equal(f.adapter.blocked(1),false,'Whole start-to-end swept carrier envelope unexpectedly blocked');
  for(let i=0;i<240;i++){f.state.travel=i/240;assert.equal(f.adapter.blocked((i+1)/240),false,`Blocked incremental segment ${i}`);}
  f.state.travel=1;assert.equal(f.adapter.blocked(0),false,'Whole end-to-start sweep unexpectedly blocked');
  return {staticBoxes:49,dynamicBackingBoxes:1,incrementalSegments:240,fullSweepBothDirectionsClear:true};
 });
 await run('swept player collision pauses travel and explicit resume completes without teleporting',f=>{
  f.runtime.playerBody.position=[22.4,0,-2.6];assert.equal(f.adapter.blocked(1),true,'Mid-route player must block whole sweep');
  f.state.travel=1;assert.equal(f.runtime.collisionAt(22.4,-2.6,.22,0,1.72),null,'Player is clear of final carrier pose');f.state.travel=0;
  f.runtime.playerBody.position=[23.67,0,-2.6];assert.equal(f.runtime.collisionAt(23.67,-2.6,.22,0,1.72),null,'Initial pose must be clear before first sweep');
  rangeAction(f.state,'start');rangeAction(f.state,'return');stepRange(f.state,1/60,{blocked:f.adapter.blocked});
  assert.equal(f.state.phase,'blocked');assert.equal(f.state.travel,0);assert.equal(f.state.events.at(-1).type,'TargetTravelBlocked');
  f.runtime.playerBody.position=[-100,0,-100];assert(rangeAction(f.state,'return'));stepRange(f.state,1/60,{blocked:f.adapter.blocked});
  assert(f.state.travel>0&&f.state.travel<.01,'Resume should advance one tick, not teleport');
  const firstResumeTravel=f.state.travel;for(let i=0;i<260;i++)stepRange(f.state,1/60,{blocked:f.adapter.blocked});f.adapter.apply();
  assert.equal(f.state.travel,1);assert.equal(f.state.phase,'review');near(f.carrier.position.toArray(),[-3.2,2.25,0]);
  return {blockedAtTravel:0,firstResumeTravel,completedTravel:f.state.travel};
 });
 await run('collision wrapper retains receiver, arguments and earlier blockers; ignore bypasses carrier only',f=>{
  const args=[-999,7,.31,.2,1.8,'custom-ignore',.09];assert.equal(f.runtime.collisionAt(...args),'existing-static-blocker');
  assert.equal(f.calls[0].receiver,f.runtime);assert.deepEqual(f.calls[0].args,args);
  assert.equal(f.runtime.collisionAt(24,-2.6,.22,0,1.72),'paper-moving');
  assert.equal(f.runtime.collisionAt(24,-2.6,.22,0,1.72,'paper-carrier'),null);
  assert.equal(f.runtime.collisionAt(24,-2.6,.22,3,1.72),null);
  return {priorCollisionPreserved:true,carrierBodyRecognized:true,carrierIgnoreAndVerticalSeparation:true};
 });
 await run('dispose restores authored poses and original collision function and removes marker resources',f=>{
  rangeAction(f.state,'start');const paper=f.adapter.surfaces().find(x=>x.lane==='paper');recordShot(f.state,'cleanup',rayAt(paper),f.adapter.surfaces(),f.adapter.boxes());
  f.state.travel=.5;f.state.angles[0]=.7;f.adapter.apply();const marker=markerMeshes(f)[0];let geometryDisposed=0,materialDisposed=0;
  marker.geometry.addEventListener('dispose',()=>geometryDisposed++);marker.material.addEventListener('dispose',()=>materialDisposed++);
  assert.notDeepEqual(f.carrier.position.toArray(),f.rest.carrier);assert.notDeepEqual(f.pivots[0].rotation.toArray(),f.rest.rotations[0]);
  f.adapter.dispose();assert.equal(f.runtime.collisionAt,f.previous);assert.deepEqual(f.carrier.position.toArray(),f.rest.carrier);
  f.pivots.forEach((p,i)=>assert.deepEqual(p.rotation.toArray(),f.rest.rotations[i]));assert.equal(f.original.children.length,f.rest.originalChildren);
  assert.equal(marker.parent,null);assert.equal(markerMeshes(f).length,0);assert.equal(geometryDisposed,1);assert.equal(materialDisposed,1);
  f.scene.updateMatrixWorld(true);near(f.sheet.getWorldPosition(new THREE.Vector3()).toArray(),[23.984,1.425,-2.6]);
  // Prevent the harness finally clause from disposing twice after this explicit lifecycle assertion.
  f.adapter={dispose(){}};return {posesRestored:true,collisionFunctionRestored:true,markersRemoved:true,geometryDisposed,materialDisposed};
 });
 await run('impact bursts deduplicate and never replay restored shot history or mutate the ledger',f=>{
  rangeAction(f.state,'select','plates');rangeAction(f.state,'start');const plate=f.adapter.surfaces().find(s=>s.id==='plate.01.front');
  const shot=recordShot(f.state,'effect-once',rayAt(plate),f.adapter.surfaces(),f.adapter.boxes());assert.equal(shot.outcome,'hit');
  const history=JSON.stringify(f.state);freeze(shot);f.adapter.impact(shot);f.adapter.impact(shot);f.adapter.tickEffects(0);
  assert.equal(f.adapter.effects.bursts,1);assert.equal(f.adapter.effects.streaks,5);assert.equal(JSON.stringify(f.state),history);
  f.adapter.dispose();f.adapter=bindRange(f.scene,f.runtime,f.state);assert(f.adapter);f.adapter.impact(shot);f.adapter.tickEffects(0);
  assert.equal(f.adapter.effects.bursts,0);assert.equal(f.adapter.effects.streaks,0);assert.equal(JSON.stringify(f.state),history);
  return {deduplicated:true,historyReplayPrevented:true,historyUnchanged:true};
 });
 await run('steel effects cap at 16 bursts and 80 finite streaks, expire at .22 seconds and clear on pause',f=>{
  const plate=f.adapter.surfaces().find(s=>s.id==='plate.01.front'),history=JSON.stringify(f.state);
  const shot=i=>({id:'bounded-effect-'+i,sequence:i,impact:{lane:'plates',world:[...plate.origin],frame:structuredClone(plate)}});
  for(let i=0;i<24;i++)f.adapter.impact(freeze(shot(i)));f.adapter.tickEffects(0);
  assert.equal(f.adapter.effects.bursts,16);assert.equal(f.adapter.effects.streaks,80);const sparks=f.scene.getObjectByName('RangeSteelSparks');assert(sparks?.isInstancedMesh);
  const matrix=new THREE.Matrix4();for(let i=0;i<sparks.count;i++){sparks.getMatrixAt(i,matrix);assert(matrix.elements.every(Number.isFinite));}
  f.adapter.tickEffects(.1);f.adapter.tickEffects(.1);assert.equal(f.adapter.effects.streaks,80);f.adapter.tickEffects(.021);assert.equal(f.adapter.effects.bursts,0);assert.equal(f.adapter.effects.streaks,0);
  f.adapter.impact(shot(99));f.adapter.tickEffects(.01);assert.equal(f.adapter.effects.streaks,5);f.adapter.tickEffects(0,true);
  assert.equal(f.adapter.effects.bursts,0);assert.equal(f.adapter.effects.streaks,0);f.adapter.impact(shot(99));f.adapter.tickEffects(0);assert.equal(f.adapter.effects.streaks,0,'Paused effect must not replay');
  assert.equal(JSON.stringify(f.state),history);return {maxBursts:16,maxStreaks:80,lifetimeSeconds:.22,pausePolicy:'clear; no replay',ledgerUnchanged:true};
 });
 await run('latest 256 marks per surface are bounded while every ledger record remains intact',f=>{
  rangeAction(f.state,'start');const paper=f.adapter.surfaces().find(s=>s.lane==='paper');
  const surfaces=f.adapter.surfaces(),original=surfaces.find(s=>s.lane==='original');
  const template=recordShot(f.state,'cap-seed',rayAt(paper),surfaces,f.adapter.boxes());
  const originalTemplate=structuredClone(template);originalTemplate.impact={...originalTemplate.impact,lane:'original',surfaceId:'original.face',world:[...original.origin],frame:structuredClone(original)};
  f.state.shots=[...Array.from({length:300},(_,i)=>({...structuredClone(template),id:'cap-'+i,commandId:'cap-command-'+i,sequence:i+1})),
   ...Array.from({length:300},(_,i)=>({...structuredClone(originalTemplate),id:'original-cap-'+i,commandId:'original-cap-command-'+i,sequence:i+301}))];
  f.state.shots.forEach(freeze);const history=JSON.stringify(f.state.shots);f.adapter.apply();
  const marks=markerMeshes(f);assert.equal(marks.length,512);assert.equal(f.adapter.effects.marks,512);
  assert.deepEqual(new Set(marks.map(m=>m.userData.shotId)),new Set(['cap-','original-cap-'].flatMap(prefix=>Array.from({length:256},(_,i)=>prefix+(i+44)))));
  assert(marks.every(m=>m.children.length===1),'Paper/original marks include their rim child');f.adapter.apply();assert.equal(markerMeshes(f).length,512);
  assert.equal(f.state.shots.length,600);assert.equal(JSON.stringify(f.state.shots),history);return {ledgerRecords:600,renderedMarks:512,perSurfaceCap:256,firstPaperRenderedSequence:45,rimChildren:512};
 });
 await run('impact cleanup disposes transient resources and preserves all saved-asset material identities',f=>{
  const authored=[];for(const obj of Object.values(f.objects))obj.traverse(n=>{if(n.isMesh)authored.push({node:n,material:n.material,materialJSON:JSON.stringify(n.material.toJSON()),geometry:n.geometry});});
  const plate=f.adapter.surfaces().find(s=>s.lane==='plates');f.adapter.impact({id:'cleanup-spark',sequence:1,impact:{lane:'plates',world:plate.origin,frame:plate}});f.adapter.tickEffects(.05);
  const sparks=f.scene.getObjectByName('RangeSteelSparks');let geometry=0,material=0,instances=0;
  sparks.geometry.addEventListener('dispose',()=>geometry++);sparks.material.addEventListener('dispose',()=>material++);sparks.addEventListener('dispose',()=>instances++);
  f.adapter.dispose();assert.equal(sparks.parent,null);assert.equal(f.scene.getObjectByName('RangeSteelSparks'),undefined);
  assert.equal(f.adapter.effects.bursts,0);assert.equal(f.adapter.effects.marks,0);assert.equal(geometry,1);assert.equal(material,1);assert.equal(instances,1);
  for(const record of authored){assert.equal(record.node.material,record.material);assert.equal(JSON.stringify(record.node.material.toJSON()),record.materialJSON);assert.equal(record.node.geometry,record.geometry);}
  f.adapter.impact({id:'late-after-dispose',sequence:2,impact:{lane:'plates',world:plate.origin,frame:plate}});assert.equal(f.adapter.effects.bursts,0,'Late impact must not repopulate disposed effect queues');
  f.adapter.dispose();assert.equal(geometry,1);assert.equal(material,1);assert.equal(instances,1);f.adapter={dispose(){}};
  return {savedAssetMeshes:authored.length,authoredMaterialAndGeometryIdentitiesPreserved:true,disposedSparkGeometry:geometry,disposedSparkMaterial:material,disposedInstanceResource:instances};
 });
 await run('original bullseye punctures clear the actual teal layer while peripheral marks retain their shallow offset and scores',f=>{
  const teal=f.objects['range-target'].getObjectByName('Mesh_Moving_teal'),cream=f.objects['range-target'].getObjectByName('Mesh_Moving_cream');
  assert(teal?.isMesh&&cream?.isMesh,'Expected exact saved target visual layers');
  teal.geometry.computeBoundingBox();cream.geometry.computeBoundingBox();f.scene.updateMatrixWorld(true);
  const layerBounds=mesh=>{
   const box=mesh.geometry.boundingBox,vertices=[];
   for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])vertices.push(f.original.worldToLocal(mesh.localToWorld(new THREE.Vector3(x,y,z))));
   return new THREE.Box3().setFromPoints(vertices);
  };
  const tealBounds=layerBounds(teal),creamBounds=layerBounds(cream);approx(tealBounds.min.x,-.055);approx(tealBounds.max.x,-.051);approx(creamBounds.min.x,-.047);
  assert(rangeAction(f.state,'select','original'));assert(rangeAction(f.state,'start'));
  const surface=f.adapter.surfaces().find(s=>s.lane==='original');near(surface.origin,[23.9525,1.7,0]);const samples=[0,.029,.05];
  const shots=samples.map((u,i)=>{const shot=recordShot(f.state,'layer-'+i,rayAt(surface,u,0),f.adapter.surfaces(),f.adapter.boxes());assert.equal(shot.outcome,'hit');assert.equal(shot.points,10);near(shot.impact.local,[u,0]);near(shot.impact.frame.origin,surface.origin);return shot;});
  const history=JSON.stringify(f.state.shots),scoreBefore=stats(f.state.shots);shots.forEach(freeze);f.adapter.apply();f.scene.updateMatrixWorld(true);
  const marks=markerMeshes(f),details=[];assert.equal(marks.length,3);
  for(let i=0;i<shots.length;i++){
   const mark=marks.find(m=>m.userData.shotId===shots[i].id);assert(mark);const local=f.original.worldToLocal(mark.getWorldPosition(new THREE.Vector3()));
   const offset=i<2?.0085:.0012;approx(mark.position.x,-offset);near([local.y,local.z],[0,samples[i]]);approx(local.x,-.0475-offset);
   if(i<2){assert(local.x<tealBounds.min.x);approx(tealBounds.min.x-local.x,.001);const rim=mark.children[0];assert(rim);const rimLocal=f.original.worldToLocal(rim.getWorldPosition(new THREE.Vector3()));assert(rimLocal.x<tealBounds.min.x,'Rim must also clear the teal graphic');}
   else{approx(creamBounds.min.x-local.x,.0017);assert(local.x>tealBounds.min.x,'Peripheral mark must not inherit the raised bullseye offset');}
   details.push({radius:samples[i],presentationOffset:offset,markTargetLocalX:local.x,scoringWorldX:shots[i].impact.world[0],points:shots[i].points});
  }
  assert.equal(JSON.stringify(f.state.shots),history);assert.deepEqual(stats(f.state.shots),scoreBefore);assert.equal(scoreBefore.points,30);near(f.adapter.surfaces().find(s=>s.lane==='original').origin,surface.origin);
  return {savedTealFrontX:tealBounds.min.x,savedCreamFrontX:creamBounds.min.x,samples:details,ledgerAndScoresUnchanged:true,scope:'Fixed pinned layered-graphic offset; not generic decal conformance'};
 });
 report.ok=report.tests.every(t=>t.ok);report.passed=report.tests.filter(t=>t.ok).length;report.failed=report.tests.filter(t=>!t.ok).length;
 // Detect source edits during qualification, so receipt hashes identify what was actually executed.
 for(const [filename,record]of Object.entries(report.inputs).filter(([key])=>key!=='adapter'))assert.equal(digest(await readFile(path.join(root,filename))),record.sha256,`Input changed during test: ${filename}`);
 assert.equal(digest(await readFile(adapterFile)),report.inputs.adapter.sha256,'Adapter changed during test');
}catch(error){report.ok=false;report.setupError={message:error.message,stack:error.stack};}
report.limitations=['No browser DOM, UI, rendering or WebGPU qualification.','No Unreal/native runtime qualification.','Collision proxy and headless geometry behavior only; no physical mechanism claim.','No frame timing or performance verdict; PC and hub load are dirty.'];
await writeFile(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ok:report.ok,passed:report.passed??0,failed:report.failed??0,setupError:report.setupError?.message,failures:report.tests.filter(t=>!t.ok).map(t=>({name:t.name,error:t.error})),report:out},null,2));
if(!report.ok)process.exitCode=1;
