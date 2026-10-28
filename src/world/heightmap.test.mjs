import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateTerrain,createTerrain,sharedTerrain,decodeHeightSamples,registerHeightSamples,heightSamples,retainHeightSamples,releaseHeightSamples,terrainSignature,terrainSegments,checkHeightSamples,HEIGHTMAP_LIMITS} from './terrain.mjs';
import {WorldRuntime} from './runtime.mjs';
import {DEFAULT_WORLD,validateWorld} from './contract.mjs';
import {createInhabitant,stepInhabitant,inhabitantContext} from './inhabitant.mjs';
import {expandScatters} from './scatter.mjs';
import {terrainRayDistance} from './aim.mjs';
import {Ray,Vector3} from 'three';

// Independent fixture: an angled ridge, a meandering gully and a bench, which
// no set of axis-aligned elliptical stamps reproduces exactly.
const ground=(x,z)=>2+1.6*Math.sin(.35*x+.21*z)-2.4*Math.exp(-((z-1.8*Math.sin(x*.4))**2)/3)+(x>4?.8:0)+.05*x*z/8;
function r32(size,bounds,height=ground){
 const [nx,nz]=size,[xmin,xmax,zmin,zmax]=bounds,bytes=Buffer.alloc(nx*nz*4);
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)bytes.writeFloatLE(height(xmin+(xmax-xmin)*i/(nx-1),zmin+(zmax-zmin)*j/(nz-1)),(j*nx+i)*4);
 return bytes;
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
// Decodes and registers samples the way a host or viewer does after verifying them.
function heightmap({size=[17,13],bounds=[-8,8,-6,6],height=ground,...extra}={}){
 const bytes=r32(size,bounds,height),hash=sha(bytes);registerHeightSamples(hash,decodeHeightSamples(bytes,size));
 return {terrain:{type:'heightmap',bounds,size,height:{file:'assets/imports/terrain/fixture.r32',sha256:hash,format:'r32'},stamps:[],...extra},bytes,hash};
}
const near=(actual,expected,tolerance=1e-6,label='')=>assert.ok(Math.abs(actual-expected)<=tolerance,`${label}${actual} differs from ${expected}`);
// The rendered triangle under (x,z), found and interpolated by plain 2D
// barycentrics over the index buffer, without the support query's own code.
function renderedHeight(mesh,x,z){
 const p=mesh.positions,idx=mesh.indices;
 for(let i=0;i<idx.length;i+=3){
  const [a,b,c]=[idx[i]*3,idx[i+1]*3,idx[i+2]*3];
  const d=(p[b+2]-p[c+2])*(p[a]-p[c])+(p[c]-p[b])*(p[a+2]-p[c+2]);
  const u=((p[b+2]-p[c+2])*(x-p[c])+(p[c]-p[b])*(z-p[c+2]))/d,v=((p[c+2]-p[a+2])*(x-p[c])+(p[a]-p[c])*(z-p[c+2]))/d,w=1-u-v;
  if(u>=-1e-9&&v>=-1e-9&&w>=-1e-9)return u*p[a+1]+v*p[b+1]+w*p[c+1];
 }
 return null;
}

test('a heightmap record is strict, and its samples decode only when complete and finite',()=>{
 const {terrain}=heightmap();
 assert.equal(validateTerrain(terrain),terrain);
 for(const change of [{size:[1,13]},{size:[1026,4]},{size:[17.5,13]},{height:{...terrain.height,file:'assets/imports/terrain/fixture.png'}},{height:{...terrain.height,file:'../fixture.r32'}},{height:{...terrain.height,sha256:'ABC'}},{height:{...terrain.height,format:'r16'}},{height:{...terrain.height,extra:1}},{scale:0},{scale:-1},{offset:2000},{segments:[0,4]},{segments:[1025,4]},{baseHeight:0},{stamps:undefined},{unknown:true}])
  assert.throws(()=>validateTerrain({...terrain,...change}),undefined,JSON.stringify(change));
 assert.doesNotThrow(()=>validateTerrain({...terrain,scale:.5,offset:-3,segments:[32,24],stamps:[{id:'pad',operation:'flatten',center:[0,0],radius:[2,2],height:1}]}));
 const bytes=r32([3,2],[0,1,0,1],()=>1);
 assert.deepEqual(Array.from(decodeHeightSamples(bytes,[3,2])),[1,1,1,1,1,1]);
 assert.throws(()=>decodeHeightSamples(bytes.subarray(4),[3,2]),/20 bytes; size \[3,2\] needs 24/);
 for(const bad of [NaN,Infinity,-Infinity]){const copy=Buffer.from(bytes);copy.writeFloatLE(bad,16);assert.throws(()=>decodeHeightSamples(copy,[3,2]),/column 1, row 1 is not a finite number/);}
 // Little-endian regardless of the platform, and an ArrayBuffer decodes the same.
 const one=Buffer.from([0,0,128,63]);assert.equal(decodeHeightSamples(new Uint8Array([...one,...one,...one,...one]).buffer,[2,2])[3],1);
});

test('the lattice vertices are the samples, and support matches every rendered triangle',()=>{
 const {terrain,bytes}=heightmap(),mesh=createTerrain(terrain),[nx,nz]=terrain.size;
 assert.deepEqual(mesh.segments,[nx-1,nz-1]);assert.deepEqual(terrainSegments(terrain),[nx-1,nz-1]);
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const sample=bytes.readFloatLE((j*nx+i)*4),k=j*nx+i;
  assert.equal(mesh.heights[k],sample);assert.equal(mesh.positions[k*3+1],sample);
  assert.equal(mesh.sample(mesh.positions[k*3],mesh.positions[k*3+2]).height,sample);
 }
 for(const [x,z] of [[-7.3,-5.1],[0.2,0.3],[3.9,-2.25],[7.99,5.99],[-.6,4.4]])near(mesh.sample(x,z).height,renderedHeight(mesh,x,z),1e-9,`(${x},${z}) `);
 assert.deepEqual(mesh.bounds,terrain.bounds);
});

test('stamps apply over the sampled base, and a flatten pad stays exact',()=>{
 const pad={id:'build-pad',operation:'flatten',center:[2,-1],radius:[3,2.5],height:1.25,plateau:.6,falloff:2};
 const rise={id:'cairn',center:[-5,3],radius:[1.5,1.5],height:.75};
 const {terrain}=heightmap({size:[33,25]}),base=createTerrain(terrain),stamped=createTerrain({...terrain,stamps:[pad,rise]});
 // Inside the plateau the pad is the authored height, flat, wherever the samples were.
 for(const [x,z] of [[2,-1],[2.9,-1.4],[1.2,-.4]]){const s=stamped.sample(x,z);assert.equal(s.height,Math.fround(1.25));near(s.slope,0,1e-9);}
 assert.ok(Math.abs(base.sample(2,-1).height-1.25)>.1,'the samples alone are not already flat there');
 // An add stamp is a delta over the samples at its centre; beyond every stamp the samples are untouched.
 near(stamped.sample(-5,3).height-base.sample(-5,3).height,.75,1e-5);
 for(const [x,z] of [[-7,-5],[7,5],[6,-5.5]])assert.equal(stamped.sample(x,z).height,base.sample(x,z).height);
 // Order matters as on a heightfield: a later stamp acts on the earlier result.
 assert.notEqual(createTerrain({...terrain,stamps:[{...rise,center:[2,-1]},pad]}).sample(2,-1).height,createTerrain({...terrain,stamps:[pad,{...rise,center:[2,-1]}]}).sample(2,-1).height);
});

test('other segments resample bilinearly, and every query still samples the rendered lattice',()=>{
 const {terrain,bytes}=heightmap({size:[17,13]}),coarse=createTerrain({...terrain,segments:[8,6]}),fine=createTerrain({...terrain,segments:[40,30]});
 // Every second sample when the ratio is whole.
 for(let j=0;j<=6;j++)for(let i=0;i<=8;i++)assert.equal(coarse.heights[j*9+i],bytes.readFloatLE((2*j*17+2*i)*4));
 // A finer lattice interpolates the samples bilinearly between them.
 const at=(i,j)=>bytes.readFloatLE((j*17+i)*4),u=5*16/40,v=7*12/30,i0=Math.floor(u),j0=Math.floor(v),fu=u-i0,fv=v-j0;
 near(fine.heights[7*41+5],(at(i0,j0)*(1-fu)+at(i0+1,j0)*fu)*(1-fv)+(at(i0,j0+1)*(1-fu)+at(i0+1,j0+1)*fu)*fv,1e-5);
 for(const mesh of [coarse,fine])for(const [x,z] of [[-6.2,4.7],[1.1,-3.3],[5.5,.5]])near(mesh.sample(x,z).height,renderedHeight(mesh,x,z),1e-9);
 // Signatures differ by lattice and by samples, never by appearance alone.
 assert.notEqual(terrainSignature({...terrain,segments:[8,6]}),terrainSignature(terrain));
 assert.equal(terrainSignature({...terrain,appearance:{rockSlope:.5}}),terrainSignature(terrain));
 assert.equal(terrainSignature({...terrain,height:{...terrain.height,file:'assets/imports/terrain/renamed.r32'}}),terrainSignature(terrain),'a renamed copy of the same bytes is the same surface');
 assert.ok(terrainSignature(terrain).includes(terrain.height.sha256));
});

test('a heightmap builds only from loaded samples that fit its size and elevation range',()=>{
 const {terrain}=heightmap();
 assert.throws(()=>createTerrain({...terrain,height:{...terrain.height,sha256:'f'.repeat(64)}}),/Terrain height ffffffffffff is not loaded/);
 assert.throws(()=>createTerrain({...terrain,size:[17,12]}),/has 221 samples; size \[17,12\] needs 204/);
 const tall=heightmap({height:()=>600});
 assert.throws(()=>createTerrain({...tall.terrain,scale:2}),/spans 1200\.00 to 1200\.00 m after scale and offset; keep it within ±1000 m/);
 assert.throws(()=>createTerrain({...tall.terrain,offset:450}),/spans 1050\.00 to 1050\.00/);
 const deep=heightmap({height:()=>-600});assert.throws(()=>createTerrain({...deep.terrain,offset:-450}),/spans -1050\.00 to -1050\.00/);
 near(createTerrain({...tall.terrain,scale:.5,offset:-100}).sample(0,0).height,200);
 assert.deepEqual(checkHeightSamples(tall.terrain,heightSamples(tall.hash)),{min:600,max:600});
 assert.equal(HEIGHTMAP_LIMITS.samples,1025);assert.equal(HEIGHTMAP_LIMITS.bytes,1025*1025*4);
});

test('samples in use stay resident while others come and go',()=>{
 const kept=heightmap({height:()=>3});assert.ok(retainHeightSamples(kept.hash));
 const others=Array.from({length:12},(_,i)=>heightmap({height:()=>i+10}));
 assert.ok(heightSamples(kept.hash),'a retained height survives other loads');
 assert.equal(heightSamples(others[0].hash),null,'the least recently used unretained heights are dropped');
 assert.ok(heightSamples(others[11].hash));
 releaseHeightSamples(kept.hash);assert.ok(heightSamples(kept.hash),'released samples become ordinary recent entries');
 assert.equal(retainHeightSamples('e'.repeat(64)),false);
});

function world({terrain,scatters,objects=[],stamps}){
 const w=structuredClone(DEFAULT_WORLD);w.schemaVersion=2;
 w.scene.runtime={version:1,modules:['collision.boxes@1','camera.walk-orbit@1','inhabitant.maker@1','terrain.heightfield@1',...(scatters?['scatter.seeded@1']:[])],spawn:[-6,1.72,-4],look:[0,0],overview:[8,12,14],target:[0,0,0],bounds:[-7.9,7.9,-5.9,5.9],blockers:[],possession:{preset:'maker',camera:'first'}};
 w.scene.terrain={...terrain,...(stamps?{stamps}:{})};w.scene.objects=objects;
 if(scatters){w.scene.assets.push({id:'boulder',file:'assets/imports/boulder.glb'});w.scene.scatters=scatters;}
 return w;
}

test('the runtime rebuilds the surface when the samples change, not when only appearance does',()=>{
 const a=heightmap(),b=heightmap({height:(x,z)=>ground(x,z)+.5}),w=world({terrain:a.terrain});
 validateWorld(w);const runtime=new WorldRuntime(w.scene),lattice=runtime.terrain;
 runtime.reconcile({...w.scene,terrain:{...a.terrain,appearance:{rockSlope:.4}}});assert.equal(runtime.terrain,lattice);
 runtime.reconcile({...w.scene,terrain:b.terrain});assert.notEqual(runtime.terrain,lattice);
 near(runtime.terrain.sample(1,1).height-lattice.sample(1,1).height,.5,1e-5);
});

test('the walker stands on the sampled surface the renderer draws',()=>{
 const {terrain}=heightmap({size:[65,49]}),pad={id:'pad',operation:'flatten',center:[3,2],radius:[2.5,2],height:2.2,plateau:.5};
 const w=world({terrain,stamps:[pad]});validateWorld(w);
 const runtime=new WorldRuntime(w.scene),mesh=runtime.terrain,actor=createInhabitant(runtime);
 let steps=0,worst=0;
 // A loop over the ridge, through the gully and across the pad, turning as it goes.
 for(let frame=0;frame<900;frame++){
  stepInhabitant(actor,{forward:1,sprint:frame%300>150,yaw:-frame/140},1/60,inhabitantContext(runtime,actor.radius));
  if(actor.mode!=='grounded')continue;
  const [x,y,z]=actor.position,expected=renderedHeight(mesh,x,z);
  worst=Math.max(worst,Math.abs(y-expected));steps++;
 }
 assert.ok(steps>600,`the walk stays grounded (${steps} grounded frames)`);
 assert.ok(worst<=1e-6,`walker feet stay on the rendered triangles (worst ${worst} m)`);
 const moved=Math.hypot(actor.position[0]+6,actor.position[2]+4);assert.ok(moved>2,`the walker travelled ${moved} m`);
});

test('scatter placement, aim rays and the runtime use one heightmap lattice',()=>{
 const {terrain}=heightmap({size:[33,25]});
 const scatter={id:'boulders',seed:9,variants:[{asset:'boulder'}],region:{polygon:[[-7,-5],[7,-5],[7,5],[-7,5]]},density:20,maxCount:60,minSpacing:1};
 const w=world({terrain,scatters:[scatter]});validateWorld(w);
 const {placements}=expandScatters(w.scene),mesh=createTerrain(terrain);
 assert.ok(placements.length>20);
 // Counting the scatter during validation built the lattice; the runtime reuses that one copy.
 assert.equal(new WorldRuntime(w.scene).terrain,sharedTerrain(terrain));
 for(const p of placements)assert.equal(p.position[1],mesh.sample(p.position[0],p.position[2]).height);
 for(const [x,z] of [[-3.2,1.7],[4.6,-2.2]]){
  const ray=new Ray(new Vector3(x,40,z),new Vector3(0,-1,0)),distance=terrainRayDistance(ray,mesh,0,100);
  near(40-distance,renderedHeight(mesh,x,z),1e-4);
 }
});
