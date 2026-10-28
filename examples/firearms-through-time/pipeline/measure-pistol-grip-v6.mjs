// Measure the pistol two-hand grip exactly as the browser adapter poses it.
// Usage: node pipeline/measure-pistol-grip-v6.mjs <hands.glb> <rig.json> [out.json]
// Bend = angle between the displayed forearm (elbow bone -> wrist bone) and the hand's long axis
// (wrist -> knuckle midpoint of the four finger bases), both after the clip and live IK are applied.
import {readFile,writeFile} from 'node:fs/promises';
import {readGLB,poseGLB} from './glb-analysis.mjs';
import {sampleTimeline} from '../game/animation-sampler.mjs';
const [glbPath='authoring/first-hands.glb',rigPath='game/arm-rig-v6.json',outPath]=process.argv.slice(2);
const rig=JSON.parse(await readFile(rigPath,'utf8')),motion=JSON.parse(await readFile('game/animation-v3.json','utf8')),view=JSON.parse(await readFile('game/pistol-view-v2.json','utf8'));
const threeUrl=new URL('../../../holodeck/node_modules/three/build/three.webgpu.js',import.meta.url).href;
const THREE=await import(threeUrl),src=await readFile(new URL('../game/arm-ik-three-v5.mjs',import.meta.url),'utf8');
const adapter=await import('data:text/javascript;base64,'+Buffer.from(src.replace("'three/webgpu'",JSON.stringify(threeUrl)).replace("'./arm-ik.mjs'",JSON.stringify(new URL('../game/arm-ik.mjs',import.meta.url).href)).replace("'./forearm-twist.mjs'",JSON.stringify(new URL('../game/forearm-twist.mjs',import.meta.url).href))).toString('base64'));
const {twistAngle}=await import('../game/forearm-twist.mjs');
const g=await readGLB(glbPath),bones=new Set(g.j.skins[0].joints),nodes=g.j.nodes.map((n,i)=>{const o=bones.has(i)?new THREE.Bone():new THREE.Group();o.name=n.name;o.position.fromArray(n.translation??[0,0,0]);o.quaternion.fromArray(n.rotation??[0,0,0,1]);return o;});
for(const [i,n]of g.j.nodes.entries())for(const c of n.children??[])nodes[i].add(nodes[c]);const root=new THREE.Group();for(const i of g.j.scenes[g.j.scene??0].nodes)root.add(nodes[i]);root.updateMatrixWorld(true);
const by=n=>root.getObjectByName(n),wp=o=>root.worldToLocal(o.getWorldPosition(new THREE.Vector3()));
// Hand long axis in the wrist's rest frame (bones are world-aligned at rest).
const restAxis={};for(const side of ['right','left']){const w=wp(by(`Joint_${side}_${side}_wrist`)),k=[0,1,2,3].map(f=>wp(by(`Joint_${side}Finger${f}_${side}_finger${f}_base`))).reduce((a,b)=>a.add(b),new THREE.Vector3()).multiplyScalar(.25);restAxis[side]=k.sub(w).normalize();}
const glbShoulder=Object.fromEntries(['right','left'].map(s=>[s,wp(by(`Joint_${s}Arm_${s}_shoulder`)).toArray()]));
const chains=adapter.bindArmIK(root,rig),deg=r=>+(r*180/Math.PI).toFixed(1),r4=v=>v.map(x=>+x.toFixed(4));
const eye=new THREE.Vector3(...view.eye.position),half=view.aimFovDeg/2;
// Angular position in the aim view: camera looks +X, up +Y, right +Z. Positive "below" means under the view axis.
const inView=p=>{const d=p.clone().sub(eye);return {forward:+d.x.toFixed(3),belowDeg:deg(Math.atan2(-d.y,d.x)),sideDeg:deg(Math.atan2(d.z,d.x)),onScreenVertically:d.x>0&&Math.atan2(-d.y,d.x)*180/Math.PI<half};};
function measure(clip,phase){const c=motion.clips[clip],world=poseGLB(g,clip,c.duration*phase),p=sampleTimeline(motion,clip,phase);
 for(const o of nodes){const w=world.get(o.name);if(!w)continue;const parent=world.get(o.parent?.name),q=new THREE.Quaternion().fromArray(w.q);if(parent)q.premultiply(new THREE.Quaternion().fromArray(parent.q).invert());o.quaternion.copy(q);}
 root.updateMatrixWorld(true);adapter.applyArmIK(root,chains,{...p,rightHandX:0,rightHandY:0,rightHandZ:0});const out={};
 for(const ch of chains){const s=wp(ch.shoulder),e=wp(ch.elbow),w=wp(ch.wrist),fore=w.clone().sub(e).normalize(),upper=e.clone().sub(s).normalize(),wq=ch.wrist.getWorldQuaternion(new THREE.Quaternion()),hand=restAxis[ch.side].clone().applyQuaternion(wq),
  target=ch.spec.wrist.map((v,i)=>v+(ch.side==='left'?[p.handX,p.handY,p.handZ][i]:0)),dist=Math.hypot(...target.map((v,i)=>v-ch.spec.shoulder[i]));
  out[ch.side]={shoulderDisplayed:r4(s.toArray()),elbow:r4(e.toArray()),wrist:r4(w.toArray()),wristTargetError:+w.distanceTo(new THREE.Vector3(...target)).toFixed(4),upperLengthDisplayed:+s.distanceTo(e).toFixed(4),
   forearmDir:r4(fore.toArray()),forearmSlopeDeg:deg(Math.asin(fore.y)),forearmInwardDeg:deg(Math.atan2(ch.side==='right'?-fore.z:fore.z,fore.x)),handAxis:r4(hand.toArray()),wristBendDeg:deg(fore.angleTo(hand)),
   forearmTwistDeg:deg(twistAngle(ch.wrist.quaternion.toArray(),ch.lower.toArray())),elbowInteriorDeg:deg(Math.PI-upper.angleTo(fore)),reach:+(dist/(ch.spec.upperLength+ch.spec.forearmLength)).toFixed(3),
   aimView:{shoulder:inView(s),elbow:inView(e)}};}
 return out;}
const report={hands:glbPath,rig:rigPath,glbShoulder,restHandAxis:Object.fromEntries(Object.entries(restAxis).map(([k,v])=>[k,r4(v.toArray())])),eye:view.eye.position,aimHalfFovDeg:half,
 poses:{ready:measure('Ready',0),reloadGrasp:measure('Reload',.26),reloadInsert:measure('Reload',.69),reloadSeat:measure('Reload',.77),inspectLeft:measure('Inspect',.43),inspectRight:measure('Inspect',.75)}};
if(outPath)await writeFile(outPath,JSON.stringify(report,null,2));
const brief=Object.fromEntries(Object.entries(report.poses).map(([k,v])=>[k,Object.fromEntries(Object.entries(v).map(([s,m])=>[s,{bend:m.wristBendDeg,twist:m.forearmTwistDeg,err:m.wristTargetError,reach:m.reach,elbowDeg:m.elbowInteriorDeg,slope:m.forearmSlopeDeg,inward:m.forearmInwardDeg}]))]));
console.log(JSON.stringify({glbShoulder,ready:report.poses.ready,brief},null,1));
