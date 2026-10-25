import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTerrain,createTerrain,validateWater,sampleWater} from './terrain.mjs';

const terrain=extra=>({type:'heightfield',bounds:[-2,2,-2,2],segments:[4,4],baseHeight:-2,stamps:[{id:'rise',center:[0,0],radius:[2,2],height:4,falloff:2}],...extra});
const water=extra=>({type:'ocean',bounds:[-8,8,-8,8],level:1,waves:[],...extra});
const near=(actual,expected,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);
const face=(positions,indices,offset)=>{
 const points=Array.from(indices.slice(offset,offset+3),i=>Array.from(positions.slice(i*3,i*3+3)));
 const [a,b,c]=points,u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]);
 const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n);
 return {points,normal:n.map(x=>x/length)};
};

test('terrain produces deterministic owned buffers without changing authored records',()=>{
 const config=terrain(),before=structuredClone(config),a=createTerrain(config),b=createTerrain(config);
 assert.deepEqual(config,before);assert.deepEqual(a.positions,b.positions);assert.deepEqual(a.heights,b.heights);
 assert.ok(a.positions instanceof Float32Array);assert.ok(a.heights instanceof Float32Array);assert.ok(a.indices instanceof Uint32Array);
 assert.equal(a.heights.length,25);assert.equal(a.positions.length,75);assert.equal(a.normals.length,75);assert.equal(a.indices.length,96);
 near(a.sample(0,0).height,2);near(a.sample(2,0).height,-2);assert.notEqual(a.heights,b.heights);
});

test('support matches every rendered triangle, including its face normal and slope',()=>{
 // Uneven decimal bounds also exercise Float32 positions, not an assumed double grid.
 const mesh=createTerrain(terrain({bounds:[-2.123456,2.765432,-3.123456,3.765432],segments:[7,9]}));
 for(let offset=0;offset<mesh.indices.length;offset+=3){
  const {points,normal}=face(mesh.positions,mesh.indices,offset);
  for(const weights of [[.2,.3,.5],[.7,.2,.1],[.03,.48,.49]]){
   const p=[0,1,2].map(axis=>points.reduce((n,v,i)=>n+v[axis]*weights[i],0)),sample=mesh.sample(p[0],p[2]);
   near(sample.height,p[1],1e-9);normal.forEach((v,i)=>near(sample.normal[i],v,1e-9));near(sample.slope,Math.acos(normal[1]),1e-9);assert.equal(sample.inBounds,true);
  }
 }
});

test('triangle support differs from bilinear interpolation on a nonplanar cell',()=>{
 const mesh=createTerrain(terrain()),x=-.75,z=-.75;
 // Cell corners: (-1,-1)=-1, (0,-1)=.25, (-1,0)=.25, (0,0)=2.
 near(mesh.sample(x,z).height,-.375);
 assert.ok(Math.abs(mesh.sample(x,z).height-(-.34375))>.02);
});

test('boundary queries are defined and report when the queried point leaves support',()=>{
 const mesh=createTerrain(terrain());
 for(const p of [[-2,-2],[-2,2],[2,-2],[2,2],[2,0]]){const q=mesh.sample(...p);assert.equal(q.inBounds,true);assert.ok(q.normal.every(Number.isFinite));}
 const outside=mesh.sample(3,0);assert.equal(outside.inBounds,false);near(outside.height,mesh.sample(2,0).height);
 assert.throws(()=>mesh.sample(NaN,0),/coordinates/);
});

test('ordered flatten stamps provide a plateau and added stamps retain explicit order',()=>{
 const hill={id:'rise',center:[0,0],radius:[2,2],height:4,plateau:.5};
 const pad={id:'pad',operation:'flatten',center:[0,0],radius:[1.5,1.5],height:0,plateau:.5};
 const mesh=createTerrain(terrain({segments:[16,16],stamps:[hill,pad]}));
 near(mesh.sample(0,0).height,0);near(mesh.sample(.25,.25).height,0);near(mesh.sample(.25,.25).slope,0);
 assert.ok(createTerrain(terrain({stamps:[pad,hill]})).sample(0,0).height>0);
});

test('terrain schema rejects unsupported data and bounds resource use',()=>{
 assert.equal(validateTerrain(terrain()).type,'heightfield');
 for(const config of [terrain({type:'island'}),terrain({segments:[257,4]}),terrain({segments:[1.5,4]}),terrain({bounds:[2,2,-2,2]}),terrain({baseHeight:NaN}),terrain({stamps:Array.from({length:33},(_,i)=>({id:`s${i}`,center:[0,0],radius:[1,1],height:1}))}),terrain({unknown:true}),terrain({appearance:{grassStart:2,grassEnd:1}}),terrain({appearance:{rockSlope:2}})])assert.throws(()=>validateTerrain(config));
 for(const change of [{radius:[0,1]},{operation:'subtract'},{falloff:0},{plateau:1},{height:Infinity}]){const config=terrain();Object.assign(config.stamps[0],change);assert.throws(()=>validateTerrain(config));}
 const duplicate=terrain();duplicate.stamps.push({...duplicate.stamps[0]});assert.throws(()=>validateTerrain(duplicate),/stamp/);
 assert.doesNotThrow(()=>validateTerrain(terrain({appearance:{sandColor:'#e8d4a4',wetSandColor:'#aa9966',grassColor:'#558844',rockColor:'#777777',grassStart:1,grassEnd:2,rockSlope:.8,textureScale:.5}})));
});

test('flat ocean and boundaries have stable support',()=>{
 const config=water(),sample=sampleWater(config,0,0,0);
 assert.equal(validateWater(config),config);assert.deepEqual(sample,{height:1,normal:[0,1,0],slope:0,inBounds:true});
 assert.equal(sampleWater(config,8,-8,10).inBounds,true);assert.equal(sampleWater(config,8.01,0,10).inBounds,false);
});

test('ocean uses metre-per-second phase travel and exact analytic gradient normals',()=>{
 const config=water({waves:[{direction:[1,0],amplitude:.4,wavelength:8,speed:2,phase:.3},{direction:[0,.9999999999],amplitude:.1,wavelength:3,speed:.7,phase:1}]}),x=.7,z=-.4,t=2;
 const sample=sampleWater(config,x,z,t),epsilon=1e-5;
 const dx=(sampleWater(config,x+epsilon,z,t).height-sampleWater(config,x-epsilon,z,t).height)/(2*epsilon),dz=(sampleWater(config,x,z+epsilon,t).height-sampleWater(config,x,z-epsilon,t).height)/(2*epsilon);
 const length=Math.hypot(dx,1,dz);[-dx/length,1/length,-dz/length].forEach((v,i)=>near(sample.normal[i],v,1e-9));
 const single=water({waves:[config.waves[0]]});near(sampleWater(single,1,0,0).height,sampleWater(single,3,0,1).height);
 const expected=config.level+config.waves.reduce((n,w)=>n+w.amplitude*Math.sin(2*Math.PI/w.wavelength*(w.direction[0]*x+w.direction[1]*z-w.speed*t)+(w.phase||0)),0);near(sample.height,expected,1e-12);
 near(sample.slope,Math.acos(sample.normal[1]),1e-12);
});

test('ocean schema rejects invalid directions, unbounded waves and nonfinite queries',()=>{
 const wave={direction:[1,0],amplitude:.3,wavelength:4,speed:1};
 for(const config of [water({waves:Array(5).fill(wave)}),water({waves:[{...wave,direction:[0,0]}]}),water({waves:[{...wave,direction:[2,0]}]}),water({waves:[{...wave,wavelength:0}]}),water({waves:[{...wave,amplitude:-1}]}),water({foamWidth:0}),water({unknown:true})])assert.throws(()=>validateWater(config));
 assert.throws(()=>sampleWater(water(),0,0,Infinity),/coordinates|time/);
});

test('water may opt into a planar reflection, and nothing else (H82)',()=>{
 assert.equal(validateWater(water({reflection:'planar'})).reflection,'planar');
 for(const reflection of ['probe','mirror',true])assert.throws(()=>validateWater(water({reflection})),/Water reflection must be "planar"/);
});
