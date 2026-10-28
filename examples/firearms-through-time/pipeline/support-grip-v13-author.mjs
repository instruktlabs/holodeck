// v13 support grip: rebuild the left hand of the 1866 and No.4 hands so the fingers wrap round the forend.
// Usage: node pipeline/support-grip-v13-author.mjs [rifle1866|boltNo4 ...] [--metadata-only]
//  - designs the grip (pipeline/support-grip-v13-design.mjs) against the pinned gun forend,
//  - writes game/rifle-arm-rig-v2.json / game/bolt-no4-arm-rig-v2.json (left wrist, pole and rest hand rotation;
//    the shoulder and the whole right arm are unchanged),
//  - applies anchored edits to the exact saved parent hands source and records the new programRef.
// Nothing here wires the game: the v1 rigs, pins and aliases stay as they are.
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import * as THREE from '../../../holodeck/node_modules/three/build/three.module.js';
import {design,anatomy,atnToGun,vec,tubeRadius,catmull} from './support-grip-v13-design.mjs';
import {solveArmIK} from '../game/arm-ik.mjs';
const root=new URL('../',import.meta.url),text=async p=>(await readFile(new URL(p,root),'utf8')).replace(/^﻿/,'');
const r5=v=>Array.isArray(v)?v.map(r5):Math.round(v*1e5)/1e5;

// Chosen design parameters (degrees, metres). Yaw/pitch are the forearm = hand-axis direction; palmZ places the palm
// centre toward the near side so the index knuckle sits under the near-lower edge and the web takes the wood.
const supportKnuckles=[[.0905,.0295,0],[.0885,.0100,0],[.0835,-.0080,0],[.0745,-.0250,0]];
export const choices={
 rifle1866:{yaw:40,pitch:18,roll:0,palmZ:-.018,palmGap:.0015,fingerGap:.0012,fingerSplay:28,fingerRadii:[.0070,.0078,.0071,.0061],mcp:supportKnuckles,thumbGap:.0012,thumbHeight:-.4,thumbRiseDeg:4,thumbContact:.03,thumbBulge:.004,curvePoints:8},
 boltNo4:{yaw:40,pitch:18,roll:0,palmZ:-.018,palmGap:.0015,fingerGap:.0012,fingerSplay:28,fingerRadii:[.0070,.0078,.0071,.0061],mcp:supportKnuckles,thumbGap:.0012,thumbHeight:-.4,thumbRiseDeg:4,thumbContact:.03,thumbBulge:.004,curvePoints:8}};
// fingerSplay: ulnar deviation at the knuckles so each finger wraps more squarely across the forend.
// fingerRadii: the glove's right-hand finger radii, so both hands of the glove match (the v1 left fingers were thinner).
// mcp: support-hand knuckles (hand axis, thumb side, palmar). With the shared 17 mm layout and a uniform 28 degree
// splay the index tube crossed the middle knuckle (-0.7 mm) and the glove mesh pinched into non-manifold edges
// (saved revisions r_00eb48c3 and r_b215c532). This layout keeps every pair of neighbouring flexion planes at least
// r_i + r_j + 3.3 mm apart, so the fingers stay separate on the 2.65 mm implicit-surface grid. Checked in design.
const minFingerClearanceMM=3;
const jobs={
 rifle1866:{rigV1:'game/rifle-arm-rig-v1.json',rigV2:'game/rifle-arm-rig-v2.json',parentRef:'p_9a97eea44a1f',parentSource:'assets/next-firearm-v1/a_e22b20538f204e1ca7a86886cf630a89/revisions/r_3fcbc30917df47179ebe0efa04281019/source.kiln.js',
  oldName:"name:'Rifle gloves - stock wrist and foreend support v1'",newName:"name:'Rifle gloves - stock wrist and forend wrap v2'",stem:'rifle-hands-v2',alias:'authoring/rifle-hands-v2.glb'},
 boltNo4:{rigV1:'game/bolt-no4-arm-rig-v1.json',rigV2:'game/bolt-no4-arm-rig-v2.json',parentRef:'p_ca7db75b8587',parentSource:'authoring/assets/kiln/a_50e7dd03d75544139214de00422ee64e/revisions/r_ab70dc958c86494cbc5364fcd7bf5ff9/source.kiln.js',
  oldName:"name:'No.4 gloves - stock wrist, bolt and charger v1'",newName:"name:'No.4 gloves - stock wrist, bolt, charger and forend wrap v2'",stem:'bolt-hands-v2',alias:'authoring/bolt-no4-hands-v2.glb'}};
const handLocalWrist=[-.105,-.079,-.040];// any value works; mirrors the right glove's local wrist

export async function author(profile){const job=jobs[profile],rigV1=JSON.parse(await text(job.rigV1)),params=choices[profile];
 let d=await design(profile,params,{shoulder:rigV1.arms.left.shoulder});
 // Round the rig values once, then rebuild the hand from the rounded wrist so the GLB and rig agree exactly.
 const W=r5(d.rig.wrist),pole=r5(d.rig.pole);d=await design(profile,{...params,fixedWrist:W},{shoulder:rigV1.arms.left.shoulder});
 for(const [pair,c]of Object.entries(d.fingerClearance))assert(c.minGapMM>=minFingerClearanceMM,`${profile} ${pair} tubes only ${c.minGapMM} mm apart`);
 const F=d.frame,R=new THREE.Matrix4().makeBasis(new THREE.Vector3(...F.a),new THREE.Vector3(...F.t),new THREE.Vector3(...F.n)),euler=new THREE.Euler().setFromRotationMatrix(R,'XYZ');
 const rig=structuredClone(rigV1);rig.version=2;rig.arms.left={...rig.arms.left,wrist:W,pole};rig.restHandRotations={...rig.restHandRotations,left:[euler.x,euler.y,euler.z]};
 const ik=solveArmIK(rig.arms.left.shoulder,W,pole,rig.arms.left.upperLength,rig.arms.left.forearmLength),fore=vec.unit(vec.sub(W,ik.elbow)),bendDeg=Math.acos(Math.min(1,vec.dot(fore,F.a)))*180/Math.PI;
 rig.derivation={from:job.rigV1,hands:job.alias,design:'pipeline/support-grip-v13-author.mjs (pipeline/support-grip-v13-design.mjs)',measurement:'pipeline/measure-support-grip-v13.mjs',
  reason:'Support hand rebuilt to wrap the forend (owner report 27 Oct 2026). The left forearm now runs along the left hand axis (wrist to knuckle midpoint), so the support wrist is straight; to put the palm under the forend with the thumb on the near side and the fingers round the far side, the left wrist moves toward the near side and the pole puts the elbow out and down-left. The left shoulder, both arm lengths and the whole right arm are unchanged. The hands revision is rebuilt from this exact rig, so use the two together.',
  leftArm:{forearmYawDeg:+d.rig.forearmYawDeg.toFixed(2),forearmPitchDeg:+d.rig.forearmPitchDeg.toFixed(2),elbow:r5(ik.elbow),elbowInteriorDeg:+d.rig.elbowInteriorDeg.toFixed(1),reach:+d.rig.reach.toFixed(3),designWristBendDeg:+bendDeg.toFixed(3)},
  restHandRotationsLeft:'Euler XYZ of the left hand frame [axis, thumb side, palmar normal] in gun axes; used only to author the bind pose. Runtime IK keeps the clip wrist orientation.',
  shoulderStatus:'Unchanged view-model placement from '+job.rigV1};
 // Hand-local layout: x = hand axis, y = thumb side, z = palmar (the program maps it with restHandRotations.left).
 const local=p=>vec.add(handLocalWrist,p),atn=p=>{const q=vec.sub(p,W);return [vec.dot(q,F.a),vec.dot(q,F.t),vec.dot(q,F.n)];};
 const ext={min:[1,1,1],max:[-1,-1,-1]},grow=(p,r)=>{for(let k=0;k<3;k++){ext.min[k]=Math.min(ext.min[k],p[k]-r);ext.max[k]=Math.max(ext.max[k],p[k]+r);}};
 grow(anatomy.palm,0);for(const s of [1,-1])for(let k=0;k<3;k++){const p=[...anatomy.palm];p[k]+=s*anatomy.palmR[k];grow(p,0);const q=[...anatomy.thenar];q[k]+=s*anatomy.thenarR[k];grow(q,0);}
 grow([-anatomy.wristBack,0,0],anatomy.wristR[0]);grow(anatomy.wristEnd,anatomy.wristR[1]);
 for(const [i,f]of d.fingers.entries()){const c=catmull(f.points);for(let k=0;k<=48;k++)grow(atn(c(k/48)),tubeRadius(f.radius,k/48));}
 {const c=catmull(d.thumb.points);for(let k=0;k<=48;k++)grow(atn(c(k/48)),tubeRadius(anatomy.thumbR,k/48));}
 const margin=.008,bounds={min:r5(local(ext.min.map(v=>v-margin))),max:r5(local(ext.max.map(v=>v+margin)))},cells=[0,1,2].reduce((a,k)=>a*(bounds.max[k]-bounds.min[k])/.00265,1);
 assert(cells<1e6,'left implicit-surface grid too large: '+cells);
 // Metacarpal capsules: the palm ellipsoid ends short of the knuckles, so each finger root is joined to the palm by a
 // capsule from inside the palm to 3 mm behind its knuckle (radius just under the finger's), as the palm of a glove
 // runs out to the knuckles. Hand-local coordinates; blended into the body like the right glove's thumb capsule.
 const knuckles=(params.mcp??anatomy.mcp).map((m,f)=>{const s=(Array.isArray(params.fingerSplay)?params.fingerSplay[f]:params.fingerSplay??0)*Math.PI/180,u=[Math.cos(s),-Math.sin(s),0];
  return [r5(local([anatomy.palm[0],.8*m[1]+.2*anatomy.palm[1],.004])),r5(local(vec.sub(m,vec.mul(u,.003)))),.0085,r5(d.fingers[f].radius-.0008)];});
 const grip={wrist:handLocalWrist,palm:r5(local(anatomy.palm)),bounds,knuckles,fingerRadii:d.fingers.map(f=>f.radius),fingers:d.fingers.map(f=>r5(f.points)),thumb:r5(d.thumb.points),
  frame:'gun frame metres; fingers and thumb are mapped into the hand-local frame with fromHand',source:'pipeline/support-grip-v13-author.mjs'};
 // Anchored edits against the exact saved parent source.
 const old=await text(job.parentSource),edits=[],rep=(a,b)=>{assert.equal(old.split(a).length,2,'anchor must be unique: '+a.slice(0,80));edits.push({oldString:a,newString:b});};
 const rigLine=old.slice(old.indexOf('const rig='),old.indexOf('// Extract only axial'));rep(rigLine,'const rig='+JSON.stringify({...rig,derivation:undefined})+';\n');
 rep(job.oldName,job.newName);
 rep('wrist=right?[-.105,-.079,.04]:[-.102,-.088,-.052],palm=right?[-.062,-.049,.031]:[-.052,-.056,-.045]','wrist=right?[-.105,-.079,.04]:supportGrip.wrist,palm=right?[-.062,-.049,.031]:supportGrip.palm');
 rep(':[[-.073,-.090,-.050],[-.055,-.092,-.040],[-.047,-.086,-.029],[-.042,-.081,-.027]];',':supportGrip.thumb.map(fromHand);');
 rep('else points=[[-.026,yy,-.047],[.001,yy-.002,-.029],[.006,yy-.003,.012],[-.022,yy-.005,.037]];','else points=supportGrip.fingers[finger].map(fromHand);');
 rep('(right?[.0070,.0078,.0071,.0061]:[.0065,.0068,.0064,.0057])[finger]','(right?[.0070,.0078,.0071,.0061]:supportGrip.fingerRadii)[finger]');
 rep('const bounds={min:[-.150,-.135,-.085],max:[.057,.029,.075]};','const bounds=right?{min:[-.150,-.135,-.085],max:[.057,.029,.075]}:supportGrip.bounds;');
 rep('if(right)d=smoothUnion(d,capsule(p,[-.064,-.030,.031],[-.034,-.012,.031],.014,.0078).field,.005);return d;}','if(right)d=smoothUnion(d,capsule(p,[-.064,-.030,.031],[-.034,-.012,.031],.014,.0078).field,.005);else for(const k of supportGrip.knuckles)d=smoothUnion(d,capsule(p,k[0],k[1],k[2],k[3]).field,.005);return d;}');
 rep('async function build(){','// Support hand v13: palm under the forend, fingers wrapped round the far side, thumb along the near side.\n// Authored in the gun frame by pipeline/support-grip-v13-author.mjs against the pinned gun forend.\nconst supportGrip='+JSON.stringify(grip)+';\nasync function build(){');
 if(profile==='boltNo4')rep('keep=thumb?0:fingerLengths[name][finger]','keep=thumb||!right?0:fingerLengths[name][finger]');
 return {profile,job,params,design:d,rig,grip,edits,cells};}

const want=process.argv.slice(2).filter(a=>!a.startsWith('--')),profilesToRun=want.length?want:Object.keys(jobs);
for(const profile of profilesToRun){const out=await author(profile),{job}=out;
 await writeFile(new URL(job.rigV2,root),JSON.stringify(out.rig,null,2)+'\n');
 const summary={profile,rig:job.rigV2,wrist:out.rig.arms.left.wrist,pole:out.rig.arms.left.pole,restHandLeft:out.rig.restHandRotations.left,leftArm:out.rig.derivation.leftArm,cells:Math.round(out.cells),fingerClearance:out.design.fingerClearance,
  palmGapMM:+out.design.palm.gapMM.toFixed(2),fingers:out.design.fingers.map(f=>({pad:+f.padGapMM.toFixed(2),side:f.padSide,minGap:+f.minGapMM.toFixed(2),mcpFlexDeg:+f.mcpFlexDeg.toFixed(1)})),thumb:{pad:+out.design.thumb.padGapMM.toFixed(2),side:out.design.thumb.padSide,minGap:+out.design.thumb.minGapMM.toFixed(2)},penetration:out.design.penetration};
 await writeFile(new URL('authoring/'+job.stem+'-design.json',root),JSON.stringify({...summary,params:out.params,grip:out.grip,fingerDesign:out.design.fingers,thumbDesign:out.design.thumb,palm:out.design.palm},null,1)+'\n');
 console.log(JSON.stringify(summary));
 if(process.argv.includes('--metadata-only'))continue;
 const env={...process.env,KILN_RENDER_SERVICE_PORT:'8010',KILN_RENDER_PORT_URL:'http://127.0.0.1:8010',KILN_GLTF_EXPORTER:'three'};let ref=job.parentRef;
 for(let i=0;i<out.edits.length;i+=18){const file='authoring/'+job.stem+'-edits-'+i+'.json';await writeFile(new URL(file,root),JSON.stringify(out.edits.slice(i,i+18),null,1));
  const p=spawnSync(process.execPath,['authoring/kiln.mjs','edit',ref,'--edits',file,'--json'],{cwd:root,env,encoding:'utf8',windowsHide:true,maxBuffer:30e6}),result=JSON.parse(p.stdout);
  await writeFile(new URL('authoring/'+job.stem+'-edit-'+i+'.json',root),JSON.stringify(result,null,1));assert(result.ok,result.error?.message??JSON.stringify(result.error));ref=result.programRef;}
 await writeFile(new URL('authoring/'+job.stem+'-working.json',root),JSON.stringify({programRef:ref,parent:job.parentRef,rig:job.rigV2},null,1)+'\n');console.log(profile,'programRef',ref);}
