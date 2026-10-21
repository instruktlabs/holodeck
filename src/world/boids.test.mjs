import test from 'node:test';
import assert from 'node:assert/strict';
import {validateFlock,createFlock,stepFlock,renderFlockAgent} from './boids.mjs';

const behavior=()=>({type:'flock',count:12,bounds:[-8,8,2,7,-8,8],speed:2,neighborRadius:4,separationRadius:1,terrainClearance:1,seed:7});
const placement=()=>({position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],behavior:behavior()});
const flat={sample:()=>({height:0,inBounds:true})};
const tick=(s,b,n=1,terrain=flat)=>{for(let i=0;i<n;i++)stepFlock(s,b,1/60,{terrain});};
test('flock schema bounds count, radii, volume, speed, seed and clearance',()=>{
 assert.doesNotThrow(()=>validateFlock(behavior()));
 for(const patch of [{count:0},{count:49},{count:1.5},{seed:-1},{seed:2**32},{speed:13},{speed:0},{neighborRadius:31},{separationRadius:5},{terrainClearance:0},{bounds:[0,.1,2,7,-8,8]},{bounds:[-8,8,7,2,-8,8]},{bounds:[0,Infinity,2,7,-8,8]}])assert.throws(()=>validateFlock({...behavior(),...patch}));
});
test('seeded initial spread and fixed-step flock motion are deterministic and immutable',()=>{
 const o=placement(),before=JSON.stringify(o),a=createFlock(o,flat),b=createFlock(o,flat);assert.equal(a.agents.length,12);assert.deepEqual(a,b);tick(a,o.behavior,120);tick(b,o.behavior,120);assert.deepEqual(a,b);assert.equal(JSON.stringify(o),before);
 const different=placement();different.behavior.seed=8;assert.notDeepEqual(createFlock(different,flat).agents,b.agents);
});
test('flock remains in its local world flight volume above terrain at bounded speed',()=>{
 const o=placement(),terrain={sample:(x,z)=>({height:1+Math.sin(x)*.5+Math.cos(z)*.5,inBounds:true})},s=createFlock(o,terrain);tick(s,o.behavior,1200,terrain);
 for(const a of s.agents){const [x,y,z]=a.position;assert.ok(x>=-8&&x<=8&&z>=-8&&z<=8&&y>=2&&y<=7);assert.ok(y>=terrain.sample(x,z).height+1-1e-8);assert.ok(Math.hypot(...a.velocity)<=2+1e-8);assert.ok(a.distance>10);}
});
test('separation pushes close neighbors apart while alignment and cohesion remain active',()=>{
 const o=placement();o.behavior.count=2;const s=createFlock(o,flat);s.agents[0].position=[-.05,4,0];s.agents[1].position=[.05,4,0];s.agents[0].velocity=[0,0,2];s.agents[1].velocity=[0,0,2];
 tick(s,o.behavior,20);assert.ok(s.agents[1].position[0]-s.agents[0].position[0]>.1);
 assert.ok(s.agents[0].velocity[2]>0&&s.agents[1].velocity[2]>0);
});
test('distant neighbors cohere and differing headings align',()=>{
 const o=placement();o.behavior.count=2;const s=createFlock(o,flat);
 s.agents[0].position=[-1.5,4,0];s.agents[1].position=[1.5,4,0];s.agents[0].velocity=[0,0,2];s.agents[1].velocity=[0,0,2];
 tick(s,o.behavior,1);assert.ok(s.agents[0].velocity[0]>0&&s.agents[1].velocity[0]<0);
 s.agents[0].position=[-1,4,0];s.agents[1].position=[1,4,0];s.agents[0].velocity=[2,0,0];s.agents[1].velocity=[0,0,2];
 tick(s,o.behavior,1);assert.ok(s.agents[0].velocity[2]>0&&s.agents[1].velocity[0]>0);
});
test('incompatible terrain reports a disabled flock and pause does not advance agents',()=>{
 const o=placement(),blocked=createFlock(o,{sample:()=>({height:20,inBounds:true})});assert.equal(blocked.agents.length,0);assert.match(blocked.diagnostics[0],/terrain/);
 const s=createFlock(o,flat);tick(s,o.behavior,4);s.running=false;const before=structuredClone(s.agents);tick(s,o.behavior,20);assert.deepEqual(s.agents,before);
});
test('render interpolation stays between states and cannot change simulation arrays',()=>{
 const o=placement(),s=createFlock(o,flat);tick(s,o.behavior,1);const a=s.agents[0],render=renderFlockAgent(a,.5);
 for(let i=0;i<3;i++)assert.ok(Math.abs(render.position[i]-(a.position[i]+a.previousPosition[i])/2)<1e-9);
 render.position[0]=999;assert.notEqual(a.position[0],999);assert.ok(render.distance>=a.previousDistance&&render.distance<=a.distance);
});
