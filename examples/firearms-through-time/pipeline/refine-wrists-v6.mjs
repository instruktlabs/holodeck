import {readFile,writeFile} from 'node:fs/promises';
const source=await readFile('authoring/first-hands-v5-final3-exact.kiln.js','utf8');
const body=source.match(/  function body\(p\)\{[^\n]+/)[0];
const replacement=`  // The wrist is an oval continuation of the forearm, not a spherical heel.
  const wristAxis=new THREE.Vector3(...wrist).sub(new THREE.Vector3(...rest.elbow)).normalize(),wristBack=new THREE.Vector3(...wrist).addScaledVector(wristAxis,-.030).toArray();
  function wristField(p){const depth=.70,q=[p[0],p[1],wrist[2]+(p[2]-wrist[2])/depth],end=[palm[0]-.009,palm[1]-.011,wrist[2]+(palm[2]-wrist[2])/depth],start=[wristBack[0],wristBack[1],wrist[2]+(wristBack[2]-wrist[2])/depth];return capsule(q,start,end,.0175,.022).field*depth;}
  function body(p){let d=ellipsoid(p,palm,[.034,.038,.014]);d=smoothUnion(d,ellipsoid(p,[palm[0]-.014,palm[1]+.015,palm[2]-side*.002],[.020,.024,.014]),.008);d=smoothUnion(d,wristField(p),.006);if(right)d=smoothUnion(d,capsule(p,[-.064,-.030,.031],[-.034,.007,.031],.014,.0078).field,.005);return d;}`;
const edits=[{oldString:body,newString:replacement},
{oldString:"radius=t<.5?.052+(.042-.052)*t*2:.042+(.022-.042)*(t-.5)*2;",newString:"radius=t<.5?.052+(.042-.052)*t*2:.042+(.020-.042)*(t-.5)*2,oval=1-.30*ease((t-.72)/.28);"},
{oldString:"addScaledVector(n,Math.cos(angle)*radius)",newString:"addScaledVector(n,Math.cos(angle)*radius*oval)"},
{oldString:"Collection gloves - contact and distributed forearm twist v5",newString:"Collection gloves - tapered oval wrists v6"}];
await writeFile('evidence/wrist-v6-edits.json',JSON.stringify(edits,null,2));
