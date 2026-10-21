import test from 'node:test';
import assert from 'node:assert/strict';
import {createInhabitant,stepInhabitant} from './inhabitant.mjs';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
const surface=(height=()=>0,slope=0)=>({sample:(x,z)=>({height:height(x,z),normal:[0,1,0],slope,inBounds:Math.abs(x)<=10&&Math.abs(z)<=10})});
const water={level:0,bounds:[-10,10,-10,10],waves:[]};
const fixture=(terrain=surface(),possession={})=>({terrain,time:0,scene:{runtime:{spawn:[0,1.72,0],look:[0,0],possession},water:null}});

test('walking builds momentum, changes direction continuously and brakes to a bounded stop',()=>{
 const terrain=surface(),a=createInhabitant(fixture(terrain));
 stepInhabitant(a,{forward:1},1/60,{terrain});assert.ok(a.speed>0&&a.speed<.5);
 for(let i=0;i<45;i++)stepInhabitant(a,{forward:1},1/60,{terrain});near(a.speed,a.config.walkSpeed);
 const before=[...a.velocity];stepInhabitant(a,{strafe:1},1/60,{terrain});
 assert.ok(a.velocity[2]<-2&&a.velocity[0]>0&&a.velocity[0]<.5,'a direction change does not snap the travel vector');
 const stop=[...a.position];for(let i=0;i<30;i++)stepInhabitant(a,{},1/60,{terrain});
 near(a.speed,0);assert.ok(Math.hypot(a.position[0]-stop[0],a.position[2]-stop[2])<.25);
 const settled=[...a.position];stepInhabitant(a,{},.1,{terrain});assert.deepEqual(a.position,settled);assert.ok(before[2]<0);
});

test('momentum integration is stable across frame sizes and collision clears stored wall velocity',()=>{
 const terrain=surface(),coarse=createInhabitant(fixture(terrain)),fine=createInhabitant(fixture(terrain));
 for(let i=0;i<6;i++)stepInhabitant(coarse,{forward:1},.1,{terrain});
 for(let i=0;i<36;i++)stepInhabitant(fine,{forward:1},1/60,{terrain});near(coarse.position[2],fine.position[2]);
 const start=fine.position[2];
 // Pin the plane independently of the evolving actor.
 const wall=(x,z)=>z<start-.005;
 for(let i=0;i<12;i++)stepInhabitant(fine,{forward:1},1/60,{terrain,blocked:wall});
 near(fine.movementVelocity[1],0);const stopped=fine.position[2];stepInhabitant(fine,{},.1,{terrain});near(fine.position[2],stopped);
});

test('unpossessing stops horizontal momentum while an airborne actor still falls',()=>{
 const terrain=surface(),a=createInhabitant(fixture(terrain));
 for(let i=0;i<20;i++)stepInhabitant(a,{forward:1},1/60,{terrain});stepInhabitant(a,{forward:1,jump:true},1/60,{terrain});
 const position=[...a.position];stepInhabitant(a,{stop:true},.1,{terrain});
 near(a.position[0],position[0]);near(a.position[2],position[2]);assert.notEqual(a.position[1],position[1]);
});

test('creation uses terrain support and the possession camera without treating spawn Y as feet',()=>{
 const actor=createInhabitant(fixture(surface(()=>2.4),{preset:'maker',camera:'third',walkSpeed:3,runSpeed:5,swimSpeed:2,thirdPerson:{distance:4,height:2}}));
 assert.deepEqual(actor.position,[0,2.4,0]);assert.equal(actor.camera,'third');
 assert.equal(actor.eyeHeight,1.72);assert.equal(actor.mode,'grounded');assert.equal(actor.config.walkSpeed,3);
 const flat=createInhabitant({scene:{runtime:{spawn:[2,1.72,3],look:[.4,0]}}});
 assert.deepEqual(flat.position,[2,0,3]);assert.equal(flat.yaw,.4);
});

test('normalized input follows terrain support and reports actual velocity and traveled distance',()=>{
 const terrain=surface((x,z)=>x*.2-z*.1,.22),actor=createInhabitant(fixture(terrain));
 stepInhabitant(actor,{forward:1,strafe:1,yaw:0},.1,{terrain});
 near(Math.hypot(actor.position[0],actor.position[2]),.08);
 near(actor.position[1],actor.position[0]*.2-actor.position[2]*.1);
 near(actor.velocity[0],actor.position[0]/.1);near(actor.velocity[1],actor.position[1]/.1);
 near(actor.speed,.8);near(actor.distance,.08);assert.ok(actor.gaitPhase>0);
 for(let i=0;i<8;i++)stepInhabitant(actor,{forward:1,sprint:true,yaw:Math.PI/2},.1,{terrain});
 const before=[...actor.position];stepInhabitant(actor,{forward:1,sprint:true,yaw:Math.PI/2},.1,{terrain});
 near(actor.position[0],before[0]-.45);near(actor.position[2],before[2]);
});

test('steep slopes, unsupported terrain and blockers stop displacement and gait',()=>{
 const terrain=surface(),actor=createInhabitant(fixture(terrain));
 stepInhabitant(actor,{forward:1},.1,{terrain:surface(()=>0,Math.PI/3)});
 assert.deepEqual(actor.position,[0,0,0]);assert.equal(actor.gaitPhase,0);
 stepInhabitant(actor,{forward:1},.1,{terrain:{sample:()=>({height:0,normal:[0,1,0],slope:0,inBounds:false})}});
 assert.deepEqual(actor.position,[0,0,0]);
 const calls=[];stepInhabitant(actor,{forward:1},.1,{terrain,blocked:(...args)=>{calls.push(args);return true;}});
 assert.ok(calls.length>0);assert.ok(calls.every(([, ,feetY,height])=>feetY===0&&height===actor.height));
 assert.deepEqual(actor.velocity,[0,0,0]);assert.equal(actor.speed,0);assert.equal(actor.gaitPhase,0);
});

test('small movement steps prevent crossing thin walls and allow sliding along them',()=>{
 const terrain=surface(),actor=createInhabitant(fixture(terrain));
 const blocked=(x,z)=>z<=-.12&&z>=-.18;
 for(let i=0;i<2;i++)stepInhabitant(actor,{forward:1,strafe:1,sprint:true},.1,{terrain,blocked});
 const before=actor.position[2];stepInhabitant(actor,{forward:1,strafe:1,sprint:true},.1,{terrain,blocked});
 assert.ok(actor.position[2]>-.12);assert.ok(actor.position[0]>.2);
 near(actor.velocity[2],(actor.position[2]-before)/.1);assert.ok(actor.speed<actor.config.runSpeed);
});

test('wading and swimming use depth hysteresis and keep the floating eye above the surface',()=>{
 let floor=-.5;const terrain=surface(()=>floor),runtime=fixture(terrain);runtime.scene.water=water;
 const actor=createInhabitant(runtime);assert.equal(actor.mode,'wading');near(actor.position[1],-.5);
 floor=-1.3;stepInhabitant(actor,{},.1,{terrain,water,time:0});
 assert.equal(actor.mode,'swimming');near(actor.position[1],-1);near(actor.position[1]+actor.eyeHeight,.25);
 floor=-1.05;stepInhabitant(actor,{},.1,{terrain,water,time:0});assert.equal(actor.mode,'swimming');
 floor=-.85;stepInhabitant(actor,{},.1,{terrain,water,time:0});assert.equal(actor.mode,'wading');near(actor.position[1],-.85);
 floor=.1;stepInhabitant(actor,{},.1,{terrain,water,time:0});assert.equal(actor.mode,'grounded');near(actor.position[1],.1);
});

test('deep water permits swimming above steep submerged terrain and uses configured speed',()=>{
 const terrain=surface(()=>-3,Math.PI/3),runtime=fixture(terrain,{swimSpeed:2.2});runtime.scene.water=water;
 const actor=createInhabitant(runtime);
 for(let i=0;i<8;i++)stepInhabitant(actor,{forward:1,sprint:true},.1,{terrain,water});
 const before=actor.position[2];stepInhabitant(actor,{forward:1,sprint:true},.1,{terrain,water});
 assert.equal(actor.mode,'swimming');near(actor.position[2]-before,-.22);near(actor.speed,2.2);
 for(let i=0;i<6;i++)stepInhabitant(actor,{},.1,{terrain,water});
 const phase=actor.gaitPhase;stepInhabitant(actor,{},.1,{terrain,water});near(actor.speed,0);near(actor.gaitPhase,phase);
});

test('swimming enters at 1.25 metres, exits at .9 metres and follows the shared wave surface',()=>{
 let floor=-1.25;const terrain=surface(()=>floor),runtime=fixture(terrain);runtime.scene.water=water;
 const actor=createInhabitant(runtime);assert.equal(actor.mode,'swimming');
 floor=-.9;stepInhabitant(actor,{},.1,{terrain,water});assert.equal(actor.mode,'wading');
 floor=-3;const waves={...water,waves:[{direction:[1,0],amplitude:.2,wavelength:4,speed:1,phase:0}]};
 stepInhabitant(actor,{},.1,{terrain,water:waves,time:1});
 assert.equal(actor.mode,'swimming');near(actor.position[1],-1.2);near(actor.surfaceHeight,-.2);
 const phase=actor.gaitPhase;
 stepInhabitant(actor,{},.1,{terrain,water:waves,time:2});
 near(actor.position[1],-1);near(actor.velocity[1],2);near(actor.speed,0);near(actor.gaitPhase,phase);
 const distantWater={...water,bounds:[2,5,2,5]};
 stepInhabitant(actor,{},.1,{terrain,water:distantWater});assert.equal(actor.mode,'grounded');near(actor.position[1],-3);
});

test('bounded time and an explicit unpossess stop preserve one actor position',()=>{
 const terrain=surface(),actor=createInhabitant(fixture(terrain));
 stepInhabitant(actor,{forward:1},20,{terrain});near(actor.position[2],-.08);
 const position=[...actor.position];actor.camera='third';stepInhabitant(actor,{stop:true},.016,{terrain});
 assert.deepEqual(actor.position,position);assert.deepEqual(actor.velocity,[0,0,0]);
 stepInhabitant(actor,{forward:1},NaN,{terrain});assert.deepEqual(actor.position,position);
});

test('grounded jump rises, falls and lands without air jumps or held-key bouncing',()=>{
 const terrain=surface(),actor=createInhabitant(fixture(terrain));
 stepInhabitant(actor,{jump:true},1/60,{terrain});assert.equal(actor.grounded,false);assert.equal(actor.mode,'airborne');assert.ok(actor.position[1]>0);assert.ok(actor.verticalVelocity>0);
 stepInhabitant(actor,{jump:false},1/60,{terrain});const velocity=actor.verticalVelocity;
 stepInhabitant(actor,{jump:true},1/60,{terrain});assert.ok(actor.verticalVelocity<velocity,'another airborne press cannot add an impulse');
 let maxY=actor.position[1];for(let i=0;i<120;i++){stepInhabitant(actor,{jump:true},1/60,{terrain});maxY=Math.max(maxY,actor.position[1]);}
 assert.ok(maxY>.65&&maxY<1);near(actor.position[1],0);assert.equal(actor.grounded,true);assert.equal(actor.verticalVelocity,0);
 stepInhabitant(actor,{jump:false},1/60,{terrain});stepInhabitant(actor,{jump:true},1/60,{terrain});assert.equal(actor.mode,'airborne');
});

test('airborne movement keeps actual feet height for walls and lands on a gentle slope',()=>{
 const terrain=surface((x,z)=>-z*.2,.2),actor=createInhabitant(fixture(terrain)),calls=[];
 stepInhabitant(actor,{jump:true,forward:1},1/60,{terrain,blocked:(x,z,y,h)=>{calls.push([y,h]);return false;}});
 for(let i=0;i<60;i++)stepInhabitant(actor,{forward:1},1/60,{terrain});
 assert.equal(actor.grounded,true);near(actor.position[1],terrain.sample(...[actor.position[0],actor.position[2]]).height);assert.ok(calls.some(([y])=>y>0));
});

test('jump respects overhead box clearance and cannot tunnel through a ceiling',()=>{
 const terrain=surface(),actor=createInhabitant(fixture(terrain)),ceiling=2.1;
 for(let i=0;i<60;i++){stepInhabitant(actor,{jump:i===0},1/60,{terrain,blocked:(x,z,y,h)=>y+h>ceiling});assert.ok(actor.position[1]+actor.height<=ceiling+1e-8);}
 assert.equal(actor.grounded,true);near(actor.position[1],0);
});

test('jumping into deep water lands into swimming and swim input cannot jump',()=>{
 const terrain=surface((x,z)=>z<-.15?-3:0),runtime=fixture(terrain);runtime.scene.water=water;const actor=createInhabitant(runtime);
 stepInhabitant(actor,{jump:true,forward:1},1/60,{terrain,water});
 for(let i=0;i<90;i++)stepInhabitant(actor,{forward:1},1/60,{terrain,water});
 assert.equal(actor.mode,'swimming');assert.equal(actor.grounded,false);near(actor.position[1],-1);
 stepInhabitant(actor,{jump:true},.1,{terrain,water});assert.equal(actor.mode,'swimming');near(actor.position[1],-1);assert.equal(actor.verticalVelocity,0);
});

test('walking off a drop falls under gravity instead of snapping to the lower ground',()=>{
 const terrain=surface((x,z)=>z<-.1?-2:0),actor=createInhabitant(fixture(terrain));
 for(let i=0;i<2;i++)stepInhabitant(actor,{forward:1},.1,{terrain});assert.equal(actor.mode,'airborne');assert.ok(actor.position[1]>-2&&actor.position[1]<0);
 for(let i=0;i<90;i++)stepInhabitant(actor,{},1/60,{terrain});
 assert.equal(actor.grounded,true);near(actor.position[1],-2);
});

test('jump trajectory is stable across frame sizes and continues after controls release',()=>{
 const terrain=surface(),coarse=createInhabitant(fixture(terrain)),fine=createInhabitant(fixture(terrain));
 for(let i=0;i<3;i++)stepInhabitant(coarse,{jump:i===0},.1,{terrain});
 for(let i=0;i<18;i++)stepInhabitant(fine,{jump:i===0},1/60,{terrain});
 near(coarse.position[1],fine.position[1]);near(coarse.verticalVelocity,fine.verticalVelocity);assert.equal(fine.mode,'airborne');
 for(let i=0;i<45;i++)stepInhabitant(fine,{},1/60,{terrain});
 assert.equal(fine.grounded,true);near(fine.position[1],0);
});
