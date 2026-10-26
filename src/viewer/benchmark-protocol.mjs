export const BENCHMARK_PROTOCOL='holodeck-benchmark-v1';
export const MAX_FRAMES=32768;
export function assertRenderReady(value){
 if(value?.renderReady!==true||value.pendingCompiles!==0)throw Error('Scene rendering is not settled; shader compilation may be in progress');
}
export function scenarioCamera(s){
 const [x,y,z]=s.target.map((n,i)=>n-s.position[i]);return {position:[...s.position],rotation:[Math.atan2(y,Math.hypot(x,z)),Math.atan2(-x,-z),0,'YXZ'],fov:s.fov};
}
// maker:false (optional) leaves the walker out of a capture, for site shots of a place rather than a body.
export function validateScenario(s){
 if(!s||Object.keys(s).some(k=>!['id','position','target','fov','cove','maker'].includes(k))||!/^[-a-z0-9]{1,40}$/.test(s.id))throw Error('Invalid scenario');
 if(s.maker!==undefined&&s.maker!==false)throw Error('Invalid scenario maker setting');
 for(const k of ['position','target'])if(!Array.isArray(s[k])||s[k].length!==3||!s[k].every(n=>Number.isFinite(n)&&Math.abs(n)<=1000))throw Error('Invalid bounded camera vector');
 if(Math.hypot(...s.position.map((n,i)=>n-s.target[i]))<.1)throw Error('Camera and target must be distinct');
 if(!Number.isFinite(s.fov)||s.fov<30||s.fov>90||typeof s.cove!=='boolean')throw Error('Invalid scenario settings');
 return structuredClone(s);
}
// The world as an unpossessed scene, as worlds were before the maker, for a maker:false capture.
export function withoutMaker(world){
 const runtime=world.scene.runtime;if(!runtime?.possession)return world;
 const {possession,...rest}=runtime;return {...world,scene:{...world.scene,runtime:{...rest,modules:rest.modules.filter(m=>m!=='inhabitant.maker@1')}}};
}
export function validateScenarios(value){
 if(!Array.isArray(value)||value.length!==3)throw Error('Exactly three camera scenarios required');
 const list=value.map(validateScenario);if(new Set(list.map(s=>s.id)).size!==3)throw Error('Scenario IDs must be unique');return list;
}
export function summarize(values){
 if(!values.length||values.some(n=>!Number.isFinite(n)||n<0))throw Error('Valid nonempty samples required');
 const v=[...values].sort((a,b)=>a-b),q=p=>v[Math.max(0,Math.ceil(v.length*p)-1)];
 return {count:v.length,min:v[0],p50:q(.5),p95:q(.95),p99:q(.99),max:v.at(-1),mean:v.reduce((a,b)=>a+b,0)/v.length};
}
export function assertObservation(value,expected){
 const p=value.proof,v=p?.viewport;
 if(p?.visibility!=='visible'||v?.width!==1920||v?.height!==1080||v?.dpr!==1||v?.canvasWidth!==1920||v?.canvasHeight!==1080)throw Error('Visible 1920x1080 DPR1 presentation changed');
 if(value.cameraMode!=='free'||value.paused!==false)throw Error('Free-camera activity changed');
 if(value.manualCounters!==true)throw Error('Manual per-frame counter policy changed');
 const sameVector=(a,b)=>Array.isArray(a)&&a.length===3&&a.every((n,i)=>Number.isFinite(n)&&Math.abs(n-b[i])<=1e-6),s=value.scenario;
 if(!s||s.id!==expected.id||s.fov!==expected.fov||s.cove!==expected.cove||!sameVector(s.position,expected.position)||!sameVector(s.target,expected.target)||value.fov!==expected.fov||!sameVector(value.position,expected.position))throw Error('Declared camera changed');
}
