// Arm reach for a pistol rig over every authored key: the distance from shoulder to wrist goal must stay below upper+forearm.
// Interpolation keeps each goal on the segment between keys, and distance is convex along a segment, so the keys bound it.
import {readFile} from 'node:fs/promises';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const [rigFile='game/arm-rig-v5.json']=process.argv.slice(2),rig=await read(rigFile),motion=await read('game/animation-v3.json'),ch=motion.channels;
const out={rig:rigFile,arms:{}};
for(const [side,a] of Object.entries(rig.arms)){const len=a.upperLength+a.forearmLength;let max=0,at='';
 for(const [clip,c] of Object.entries(motion.clips))for(const k of c.keys){const v=k.v??k.values;const d=side==='left'?['handX','handY','handZ'].map(n=>v[ch.indexOf(n)]??0):[0,0,0];
  const goal=a.wrist.map((w,i)=>w+d[i]),dist=Math.hypot(...goal.map((g,i)=>g-a.shoulder[i]));if(dist>max){max=dist;at=clip+'@'+(k.t??k.time);}}
 out.arms[side]={reach:+max.toFixed(4),length:len,extension:+(max/len).toFixed(3),worstKey:at};}
console.log(JSON.stringify(out));
