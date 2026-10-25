// Observe the renderer's own initialization; never request an adapter or device.
const backendName=backend=>backend?.isWebGPUBackend?'webgpu':backend?.isWebGLBackend?'webgl':null;
function errorField(error,key,fallback,limit){
 try{return String(error?.[key]??fallback).slice(0,limit);}catch{return fallback;}
}
function errorRecord(error){
 return {name:errorField(error,'name','Error',128),message:errorField(error,'message',typeof error==='string'?error:'Initialization failed',2048)};
}
export function createInitializationEvidence({forceWebGL=false,environment=globalThis,date=()=>new Date().toISOString()}={}){
 let snapshot=null;
 return {
  read:()=>snapshot,
  async initialize(renderer){
   const record={format:'holodeck-renderer-initialization-v1',requestedBackend:forceWebGL?'webgl':'webgpu',forceWebGL,secureContext:typeof environment.isSecureContext==='boolean'?environment.isSecureContext:null,webgpuApiPresent:!!environment.navigator?.gpu,startedAt:date(),finishedAt:null,status:'initializing',actualBackend:null,webgpuAttempt:forceWebGL?'not-attempted':'not-observed',primaryError:null,initializationError:null};
   const publish=()=>{snapshot=structuredClone(record);};
   const backend=renderer.backend,originalInit=backend.init,owned=Object.hasOwn(backend,'init');
   const observe=async function(...args){
    record.webgpuAttempt='initializing';publish();
    try{const result=await originalInit.apply(this,args);record.webgpuAttempt='succeeded';return result;}
    catch(error){record.webgpuAttempt='failed';record.primaryError=errorRecord(error);publish();throw error;}
   };
   // backend and init are public Three surfaces. Leave its fallback callback
   // intact, and rethrow the same exception so its ordinary fallback still runs.
   const wrapped=!forceWebGL&&backend.isWebGPUBackend===true;
   if(wrapped)backend.init=observe;
   publish();
   try{
    const result=await renderer.init();record.status='ready';record.actualBackend=backendName(renderer.backend);return result;
   }catch(error){record.status='failed';record.initializationError=errorRecord(error);throw error;}
   finally{
    if(wrapped&&backend.init===observe){if(owned)backend.init=originalInit;else delete backend.init;}
    record.finishedAt=date();publish();
   }
  }
 };
}
