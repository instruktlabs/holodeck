// Keep the public debug object stable while clearing per-activation observations.
// Position remains an array for existing consumers; ready/frameContext qualify it.
export function resetWorldProbe(probe,contextKey){
 Object.assign(probe,{activationKey:contextKey,frameContext:null,frameRevision:null,ready:false,frames:[],position:[0,0,0],look:null,actor:null,actorEye:null,runtime:null,arrivalReset:null,backend:null,cameraMode:null,drawCalls:0,triangles:0,world:null,loadedRevision:undefined,assets:null,selected:null,cove:true,locked:false,session:null});
}
export function completeWorldFrame(probe,contextKey,revision){
 if(probe.activationKey!==contextKey){probe.ready=false;probe.frameContext=null;probe.frameRevision=null;probe.frames=[];return false;}
 const ready=Number.isSafeInteger(revision)&&Array.isArray(probe.position)&&probe.position.length===3&&probe.position.every(Number.isFinite)&&probe.frames.length>0;
 probe.frameContext=ready?contextKey:null;probe.frameRevision=ready?revision:null;probe.ready=ready;return ready;
}
export function canObserveWorld(probe,contextKey,revision){return probe.ready===true&&probe.activationKey===contextKey&&probe.frameContext===contextKey&&probe.frameRevision===revision;}
