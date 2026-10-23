import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {WorldRuntime} from './runtime.mjs';

const courtyard=JSON.parse(await readFile(new URL('../../test/fixtures/courtyard-template.json',import.meta.url),'utf8'));
const at=(o,x,z)=>Math.abs(x-o.position[0])<=o.shape.size[0]/2+.001&&Math.abs(z-o.position[2])<=o.shape.size[2]/2+.001;

test('courtyard planting footprints sit in continuous soil beds with clearance from masonry',()=>{
 const beds=courtyard.objects.filter(o=>o.shape?.surface==='soil');
 const masonry=courtyard.objects.filter(o=>o.shape?.surface==='stone'&&o.collider);
 for(const tree of courtyard.objects.filter(o=>o.shape?.type==='tree')){
  // The authored plant envelope includes its canopy, not only the trunk pivot.
  const [x,,z]=tree.position,[w,,d]=tree.shape.size,a=tree.rotation[1],hx=(Math.abs(Math.cos(a))*w+Math.abs(Math.sin(a))*d)/2,hz=(Math.abs(Math.sin(a))*w+Math.abs(Math.cos(a))*d)/2;
  for(const dx of [-hx,0,hx])for(const dz of [-hz,0,hz])assert.ok(beds.some(b=>at(b,x+dx,z+dz)),`${tree.id} canopy/root envelope escapes the dirt bed at ${x+dx}, ${z+dz}`);
  assert.ok(!masonry.some(o=>at(o,x,z)),`${tree.id} root intersects masonry`);
  const supporting=beds.filter(b=>at(b,x,z));
  const groundY=Math.max(...supporting.map(b=>b.position[1]+b.shape.size[1]/2));
  assert.ok(Math.abs(tree.position[1]-tree.shape.size[1]/2-groundY)<.025,`${tree.id} root does not meet the soil surface`);
 }
});

test('courtyard modular perimeter joins at every corner while the open gate remains passable',()=>{
 const runtime=new WorldRuntime(courtyard);runtime.originVisible=false;
 for(let x=-7.9;x<=7.9;x+=.1){if(Math.abs(x)>1.02)assert.ok(runtime.collisionAt(x,-7,.01),`front wall gap at ${x}`);assert.ok(runtime.collisionAt(x,-19,.01),`rear wall gap at ${x}`);}
 for(let z=-19;z<=-7;z+=.1)for(const x of [-7.9,7.9])assert.ok(runtime.collisionAt(x,z,.01),`side wall gap at ${x}, ${z}`);
 assert.equal(runtime.act('garden-gate',[0,1.72,-5.5]),true);for(let i=0;i<120;i++)runtime.step(1/60);
 for(let z=-8;z<=-6;z+=.1)assert.equal(runtime.collisionAt(0,z,.22),null,`open gate obstructs central route at ${z}`);
 const walls=courtyard.objects.filter(o=>/^threshold-wall|^garden-boundary/.test(o.id));
 const tops=walls.map(o=>o.position[1]+o.shape.size[1]/2);assert.ok(Math.max(...tops)-Math.min(...tops)<.01,'perimeter wall heights do not join');
});

const boxBounds=o=>{
 assert.ok(o.rotation.every(n=>n===0),`${o.id} needs an axis-aligned join check`);
 return o.position.map((p,i)=>{const center=p+(o.shape.offset?.[i]||0)*o.scale[i],half=o.shape.size[i]*Math.abs(o.scale[i])/2;return [center-half,center+half];});
};
const overlap=(a,b)=>Math.min(a[1],b[1])-Math.max(a[0],b[0]);

test('coping terminates at its corner piers without coincident exposed faces',()=>{
 const byId=new Map(courtyard.objects.map(o=>[o.id,o]));
 const joints=[];
 for(const side of ['west','east']){
  joints.push([`threshold-coping-${side==='west'?'-1':'1'}`,`garden-corner-${side}-front`,0]);
  for(const end of ['front','rear'])joints.push([`garden-coping-${side}`,`garden-corner-${side}-${end}`,2]);
  joints.push(['garden-coping-rear',`garden-corner-${side}-rear`,0]);
 }
 for(const [copingId,cornerId,runAxis] of joints){
  const coping=boxBounds(byId.get(copingId)),corner=boxBounds(byId.get(cornerId));
  assert.ok(coping.every((axis,i)=>overlap(axis,corner[i])>=-1e-9),`${copingId} does not meet ${cornerId}`);
  const faceAxis=runAxis===0?2:0;
  for(const edge of [0,1])if(Math.abs(coping[faceAxis][edge]-corner[faceAxis][edge])<1e-9){
   assert.ok(overlap(coping[runAxis],corner[runAxis])<=1e-9||overlap(coping[1],corner[1])<=1e-9,`${copingId} and ${cornerId} share an exposed coplanar face`);
  }
 }
});

test('the gate leaf and collider clear both piers throughout the full hinge sweep',()=>{
 const byId=new Map(courtyard.objects.map(o=>[o.id,o]));
 const gate=byId.get('garden-gate'),west=boxBounds(byId.get('gate-pier-west')),east=boxBounds(byId.get('gate-pier-east'));
 const lo=gate.rotation[1]+Math.min(0,gate.behavior.angle),hi=gate.rotation[1]+Math.max(0,gate.behavior.angle);
 for(const [label,box] of [['leaf',gate.shape],['collider',gate.collider]]){
  const xs=[];
  // Each corner follows x = pivot + u*cos(angle) + v*sin(angle).
  // Check the endpoints and every stationary point, covering the whole sweep.
  for(const ux of [-1,1])for(const vz of [-1,1]){
   const u=(box.offset[0]+ux*box.size[0]/2)*gate.scale[0],v=(box.offset[2]+vz*box.size[2]/2)*gate.scale[2];
   const angles=[lo,hi],stationary=Math.atan2(v,u);
   for(let k=-2;k<=2;k++){const angle=stationary+k*Math.PI;if(angle>lo&&angle<hi)angles.push(angle);}
   for(const angle of angles)xs.push(gate.position[0]+u*Math.cos(angle)+v*Math.sin(angle));
  }
  assert.ok(Math.min(...xs)>=west[0][1]-1e-9,`gate ${label} sweeps into the west pier`);
  assert.ok(Math.max(...xs)<=east[0][0]+1e-9,`gate ${label} sweeps into the east pier`);
 }
});

test('water sits within an open basin recess above its floor and below its rim',()=>{
 const byId=new Map(courtyard.objects.map(o=>[o.id,o]));
 const base=byId.get('water-basin'),water=byId.get('water-surface'),rim=byId.get('water-basin-rim');
 assert.ok(rim,'basin needs an open rim instead of a solid tabletop');assert.equal(rim.shape.type,'torus');
 const floorTop=base.position[1]+base.shape.size[1]/2,waterTop=water.position[1]+water.shape.size[1]/2;
 assert.ok(floorTop<waterTop-.1,'water has no recess below it');
 assert.ok(waterTop<rim.position[1]+rim.shape.size[2]*.1,'water overtops basin rim');
 assert.ok(water.shape.size[0]/2<rim.shape.size[0]*.38,'water protrudes beyond rim center');
});
