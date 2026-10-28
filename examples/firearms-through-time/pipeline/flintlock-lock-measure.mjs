// Pattern 1742 lock: measure the cock and frizzen rotation range from the exported model (round v14).
// Usage: node pipeline/flintlock-lock-measure.mjs <musket.glb> [out.json]
// Each moving owner is rotated about its exported pivot (gun-frame +Z through Joint_Cock / Joint_Frizzen, the axis the
// v1 ExteriorInspection clip used) and sampled against the static parts. Clearance is the minimum vertex-to-surface
// distance both ways plus exact edge crossings, on exported triangles. Attached joins are excluded as in the v1
// inspection: the cock's pivot boss and neck root within 12.5 mm of its axis (they lie on the lock-plate face at every
// angle), and the frizzen boss within 7.5 mm of its axis. Their authored overlap depths are reported separately.
// Sampled poses, not a swept-volume certificate. All chosen angles are Estimates measured from the model.
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadMusket,rotAbout,clearance,transformTris,surface,nearest,isInside,insideBox,deg} from './flintlock-geometry.mjs';
const [glbPath,outPath]=process.argv.slice(2);if(!glbPath)throw Error('usage: flintlock-lock-measure.mjs <musket.glb> [out.json]');
const m=await loadMusket(glbPath),r=(v,d=2)=>+v.toFixed(d),rv=(a,d=4)=>a.map(v=>r(v,d)),assert=(c,msg)=>{if(!c)throw Error(msg);};
const part=(owner,...roles)=>m.byPart.filter(p=>p.owner===owner&&roles.includes(p.role)).flatMap(p=>p.tris);
const cockN=m.node('Joint_Cock'),frizN=m.node('Joint_Frizzen'),cockO=cockN.world.p,frizO=frizN.world.p,Z=[0,0,1];
assert(Math.abs(cockN.world.q[3]-1)<1e-9&&Math.abs(frizN.world.q[3]-1)<1e-9,'pivots are unrotated at rest');
const within=(o,rad)=>t=>t.every(p=>Math.hypot(p[0]-o[0],p[1]-o[1])<rad);
const lockBox=t=>t.some(p=>p[0]>-.2&&p[0]<.16&&p[1]>-.1&&p[1]<.12&&p[2]>-.005&&p[2]<.07);
const S={pan:part('Joint_Body','PanExterior'),lockPlate:part('Joint_Body','LockPlate'),barrel:part('Joint_Body','BarrelBlindCavity').filter(lockBox),tang:part('Joint_Body','Tang'),
 stock:part('Joint_Body','WalnutFurniture').filter(lockBox),spring:part('Joint_Body','ExteriorSpring'),screws:part('Joint_Body','PlateScrew','ScrewSlot').filter(lockBox)};
const cock=part('Joint_Cock','CockPivotBoss','CockNeck','LowerJaw','UpperJaw','JawScrew','JawScrewHead','Stone'),stone=part('Joint_Cock','Stone'),friz=part('Joint_Frizzen','FrizzenShell','FrizzenBoss');
const COCK_JOIN=.0125,NECK_JOIN=.020,FRIZ_JOIN=.0075,frizJoin=within(frizO,FRIZ_JOIN);
// The cock's join: its pivot boss and the neck tube within 20 mm of the axis lie on the lock-plate face at every angle.
const neckRoot=new Set(part('Joint_Cock','CockNeck').filter(within(cockO,NECK_JOIN)).map(t=>t.flat().map(v=>v.toFixed(7)).join()));
const cockFree=cock.filter(t=>!within(cockO,COCK_JOIN)(t)&&!neckRoot.has(t.flat().map(v=>v.toFixed(7)).join())),cockJoinTris=cock.filter(t=>!cockFree.includes(t));
const cockAt=a=>transformTris(cockFree,p=>rotAbout(p,cockO,Z,a*deg)),cockJoinAt=a=>transformTris(cockJoinTris,p=>rotAbout(p,cockO,Z,a*deg)),stoneAt=a=>transformTris(stone,p=>rotAbout(p,cockO,Z,a*deg)),frizAt=a=>transformTris(friz,p=>rotAbout(p,frizO,Z,a*deg));
// Depth of A's vertices inside the closed surface B (parity of three skew rays).
function depth(A,B){const s=surface('b',B);let worst={mm:0};const seen=new Set();for(const t of A)for(const p of t){const k=p.join();if(seen.has(k))continue;seen.add(k);if(!insideBox(p,s,1e-4)||!isInside(p,s))continue;const d=nearest(p,s).d*1000;if(d>worst.mm)worst={mm:r(d,2),at:rv(p)};}return worst;}
const C=(A,B,ex)=>{const q=clearance(A,B,{exclude:ex});return q.distance===null?null:r(q.distance*1000,2);};
const cockTargets=['pan','lockPlate','barrel','tang','stock','spring','screws'];
function cockState(a,f){const c=cockAt(a),F=frizAt(f),row={cockDeg:a,frizzenDeg:f};for(const k of cockTargets)row[k]=C(c,S[k]);row.frizzen=C(c,F,t=>frizJoin(t));row.flintToFrizzen=C(stoneAt(a),F);
 row.minMM=Math.min(...[...cockTargets,'frizzen'].map(k=>row[k]).filter(v=>v!==null));return row;}
const frizTargets=['pan','lockPlate','barrel','stock','spring','screws'];
function frizState(f){const F=frizAt(f),row={frizzenDeg:f};for(const k of frizTargets)row[k]=C(F,S[k],frizJoin);row.minMM=Math.min(...frizTargets.map(k=>row[k]).filter(v=>v!==null));return row;}
// Reach: the flint's leading point and the frizzen's nearest point to the cock axis.
const stoneTip=stone.flat().reduce((b,p)=>p[0]>b[0]?p:b,[-9,0,0]),tipR=Math.hypot(stoneTip[0]-cockO[0],stoneTip[1]-cockO[1]);
const fz=friz.flat().reduce((b,p)=>{const d=Math.hypot(p[0]-cockO[0],p[1]-cockO[1]);return d<b.d?{d,p}:b;},{d:9});
// Down: the closed frizzen is out of the flint's reach, so down is the angle of the flint's closest approach to it.
const coarse=[];for(let a=-80;a<=0;a+=2)coarse.push({a,d:clearance(stoneAt(a),frizAt(0)).distance});
const c0=coarse.reduce((b,s)=>s.d<b.d?s:b);let fine=[];for(let a=c0.a-3;a<=c0.a+3+1e-9;a+=.25)fine.push({a,d:clearance(stoneAt(a),frizAt(0)).distance});
const best=fine.reduce((b,s)=>s.d<b.d?s:b),DOWN=Math.round(best.a*2)/2;
const HALF=-14,FULL=18,CLOSED=0,OPEN=-45;
const cockSweep=[];for(let a=-80;a<=40;a+=2)cockSweep.push(cockState(a,0));
const frizSweep=[];for(let f=5;f>=-70;f-=5)frizSweep.push(frizState(f));
const forwardLimit=[...cockSweep].reverse().find(s=>s.cockDeg<0&&s.minMM<.5)??null,openLimit=frizSweep.find(s=>s.frizzenDeg<0&&s.lockPlate!==null&&s.lockPlate<.5)??null;
// The poses the motion uses, and the Fire and drill transitions sampled every 2.5% between them.
const poses={readyFullCockClosed:cockState(FULL,CLOSED),firedDownOpen:cockState(DOWN,OPEN),strikeDownClosed:cockState(DOWN,CLOSED),halfCockOpen:cockState(HALF,OPEN),halfCockClosed:cockState(HALF,CLOSED)};
const lerp=(a,b,u)=>a+(b-a)*u,transitions={};
for(const [name,[c0_,c1,f0,f1]]of Object.entries({fireCockFall:[FULL,DOWN,CLOSED,CLOSED],fireFrizzenOpens:[DOWN,DOWN,CLOSED,OPEN],halfCockFromFired:[DOWN,HALF,OPEN,OPEN],shutPanAtHalfCock:[HALF,HALF,OPEN,CLOSED],fullCockFromHalf:[HALF,FULL,CLOSED,CLOSED]})){
 let worst=null;for(let k=0;k<=40;k++){const s=cockState(lerp(c0_,c1,k/40),lerp(f0,f1,k/40));if(!worst||s.minMM<worst.minMM)worst=s;}transitions[name]={from:{cockDeg:c0_,frizzenDeg:f0},to:{cockDeg:c1,frizzenDeg:f1},samples:41,worst};}
const joins={cockNeckRootOnLockPlate:{excluded:'cock pivot boss and anything within 12.5 mm of the axis, plus the neck tube within 20 mm of the axis',joinTriangles:cockJoinTris.length,depthAt:{full:depth(cockJoinAt(FULL),S.lockPlate),half:depth(cockJoinAt(HALF),S.lockPlate),down:depth(cockJoinAt(DOWN),S.lockPlate),rest:depth(cockJoinAt(0),S.lockPlate)},otherPartsDepthAt:{full:depth(cockAt(FULL),S.lockPlate),half:depth(cockAt(HALF),S.lockPlate),down:depth(cockAt(DOWN),S.lockPlate)},note:'The pivot boss and neck root lie on the lock-plate face at every angle (authored v1 join).'},
 frizzenSeatInPan:{excludedWithinMM:FRIZ_JOIN*1000,closedDepth:depth(frizAt(CLOSED).filter(t=>!frizJoin(t)),S.pan),openDepth:depth(frizAt(OPEN).filter(t=>!frizJoin(t)),S.pan),bossDepthClosed:depth(frizAt(CLOSED).filter(frizJoin),S.pan),clearOfPanFromDeg:frizSweep.find(s=>s.frizzenDeg<0&&s.pan>0)?.frizzenDeg??null,note:'At rest the shell\'s lower rear edge is seated in the pan front (authored v1 closed position).'}};
const out={schemaVersion:1,generated:new Date().toISOString(),glb:{path:glbPath,sha256:createHash('sha256').update(m.glb.b).digest('hex')},
 method:'pipeline/flintlock-lock-measure.mjs: exported triangles rotated about the exported pivots (gun +Z); minimum vertex-to-surface distance both ways plus exact edge crossings, in mm; attached joins excluded (cock within 12.5 mm and frizzen within 7.5 mm of their axes) and reported as overlap depths. Sampled angles, not a swept-volume certificate.',
 pivots:{cock:{node:'Joint_Cock',origin:rv(cockO),axis:Z,positive:'top toward the butt (cocking)'},frizzen:{node:'Joint_Frizzen',origin:rv(frizO),axis:Z,positive:'top toward the butt; negative throws it toward the muzzle (open)'}},
 reach:{flintLeadingPoint:rv(stoneTip),flintRadiusFromCockAxisMM:r(tipR*1000,1),nearestFrizzenPoint:rv(fz.p),frizzenRadiusFromCockAxisMM:r(fz.d*1000,1),
  finding:`The flint swings on a ${r(tipR*1000,1)} mm radius about the cock axis and the nearest frizzen point is ${r(fz.d*1000,1)} mm from it, so the modelled cock cannot touch the frizzen. Down is therefore the angle of the flint's closest approach to the closed frizzen.`},
 chosen:{cock:{downDeg:DOWN,halfDeg:HALF,fullDeg:FULL,downBasis:`Estimate: closest flint approach to the closed frizzen (${r(best.d*1000,1)} mm short); the neck then leans about 45 degrees toward the muzzle`,halfBasis:'Estimate: neck upright between fired and full cock',fullBasis:'Estimate: neck leaning back about 32 degrees from upright (the GLB rest leans back 14 degrees)'},
  frizzen:{closedDeg:CLOSED,openDeg:OPEN,closedBasis:'Model: the authored GLB rest over the pan',openBasis:`Estimate: thrown toward the muzzle, ${frizState(OPEN).lockPlate} mm clear of the lock plate (contact near ${openLimit?.frizzenDeg??'?'} degrees)`}},
 closestFlintApproach:{angleDeg:best.a,flintToFrizzenMM:r(best.d*1000,2),coarse:coarse.map(s=>({a:s.a,mm:r(s.d*1000,2)}))},forwardContactLimit:forwardLimit,frizzenOpenContactLimit:openLimit,joins,poses,transitions,cockSweep,frizzenSweep:frizSweep};
if(outPath)await writeFile(outPath,JSON.stringify(out,null,1)+'\n');
console.log(JSON.stringify({reach:out.reach,chosen:out.chosen,closest:{a:best.a,mm:r(best.d*1000,2)},forwardContactLimit:forwardLimit&&{deg:forwardLimit.cockDeg,min:forwardLimit.minMM},frizzenOpenContactLimit:openLimit&&{deg:openLimit.frizzenDeg},joins,poses,transitions:Object.fromEntries(Object.entries(transitions).map(([k,v])=>[k,{minMM:v.worst.minMM,at:[v.worst.cockDeg,v.worst.frizzenDeg]}]))},null,1));
