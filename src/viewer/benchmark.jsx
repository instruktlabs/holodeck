import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {BENCHMARK_PROTOCOL,MAX_FRAMES,validateScenario,assertObservation} from './benchmark-protocol.mjs';

// Opt-in diagnostic for an exact exported viewer. No network or authoring access.
export function Benchmark({runtime,revision,cove,setCove,cameraMode}){
 const {gl,camera}=useThree(),state=useRef({frames:0,scenario:window.holodeckBenchmarkScenario?validateScenario(window.holodeckBenchmarkScenario):null,sample:null,errors:[],frameStart:0});
 const presentation=()=>({viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio,canvasWidth:gl.domElement.width,canvasHeight:gl.domElement.height},visibility:document.visibilityState});
 const observation=()=>({scenario:state.current.scenario,position:camera.position.toArray(),fov:camera.fov,cameraMode,paused:runtime.paused,manualCounters:gl.info.autoReset===false});
 const proof=()=>{
  const backend=gl.backend,device=backend.device,ctx=backend.gl,ext=ctx?.getExtension('WEBGL_debug_renderer_info'),info=device?.adapterInfo;
  return {backend:backend.isWebGPUBackend?'webgpu':'webgl',adapter:info?Object.fromEntries(['vendor','architecture','device','description','isFallbackAdapter'].map(k=>[k,info[k]])):null,renderer:ctx?(ext?ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL):ctx.getParameter(ctx.RENDERER)):null,...presentation()};
 };
 useEffect(()=>{
  const s=state.current,device=gl.backend.device;let alive=true;
  if(s.scenario){runtime.reset();setCove(s.scenario.cove);}
  const fail=message=>{s.errors.push(String(message));if(s.errors.length>50)s.errors.shift();};
  const gpuError=e=>fail(e.error?.message??'GPU validation error');device?.addEventListener('uncapturederror',gpuError);device?.lost.then(x=>{if(alive&&x.reason!=='destroyed')fail(`Device lost: ${x.reason} ${x.message}`);});
  const api={protocol:BENCHMARK_PROTOCOL,
   status:()=>({protocol:BENCHMARK_PROTOCOL,ready:s.frames>=3&&(!s.scenario||s.cove===s.scenario.cove),revision,...observation(),appliedCove:s.cove,proof:proof(),errors:[...s.errors],runtimeTime:runtime.time}),
   scenario(value){if(s.sample)throw Error('Measurement in progress');s.scenario=validateScenario(value);runtime.reset();setCove(value.cove);return s.scenario;},
   sample(durationMs=60000){
    if(!s.scenario||s.sample||!Number.isInteger(durationMs)||durationMs<1000||durationMs>60000)throw Error('Invalid or concurrent bounded sample');
    assertObservation({...observation(),proof:presentation()},s.scenario);
    return new Promise((resolve,reject)=>{const row={start:performance.now(),durationMs,rows:[],longTasks:[],resolve,reject,timer:null,observer:null};
     row.timer=setTimeout(()=>{if(s.sample===row){s.sample=null;row.observer?.disconnect();reject(Error('Frame collection deadline exceeded'));}},durationMs+15000);
     if(globalThis.PerformanceObserver&&PerformanceObserver.supportedEntryTypes.includes('longtask')){row.observer=new PerformanceObserver(list=>{for(const e of list.getEntries())if(row.longTasks.length<2000)row.longTasks.push({start:e.startTime,duration:e.duration});});row.observer.observe({type:'longtask'});}
     s.sample=row;
    });
   }
  };
  window.holodeckBenchmark=api;
  return()=>{alive=false;device?.removeEventListener('uncapturederror',gpuError);if(window.holodeckBenchmark===api)delete window.holodeckBenchmark;const row=s.sample;if(row){clearTimeout(row.timer);row.observer?.disconnect();row.reject(Error('Benchmark unmounted'));s.sample=null;}};
 },[runtime,revision,gl,camera,setCove,cameraMode]);
 useFrame(()=>{state.current.frameStart=performance.now();},-3);
 // The regular camera controller still runs; apply the declared fixed observation afterward.
 useFrame(()=>{const s=state.current;s.cove=cove;if(s.scenario){camera.position.set(...s.scenario.position);camera.lookAt(...s.scenario.target);if(camera.fov!==s.scenario.fov){camera.fov=s.scenario.fov;camera.updateProjectionMatrix();}camera.updateMatrixWorld();}},-.4);
 // CoveEffects renders at priority 1; read this frame's all-pass counters afterward.
 useFrame((_,dt)=>{
  const s=state.current;s.frames++;const row=s.sample;if(!row)return;const t=performance.now();
  try{assertObservation({...observation(),proof:presentation()},s.scenario);}catch(e){if(!s.errors.includes(e.message))s.errors.push(e.message);}
  row.rows.push({t:t-row.start,intervalMs:dt*1000,cpuFrameSpanMs:t-s.frameStart,drawCalls:gl.info.render.drawCalls,triangles:gl.info.render.triangles});
  if(row.rows.length>=MAX_FRAMES||t-row.start>=row.durationMs){clearTimeout(row.timer);row.observer?.disconnect();s.sample=null;if(row.rows.length>=MAX_FRAMES)row.reject(Error('Bounded frame capacity exceeded'));else row.resolve({durationMs:t-row.start,rows:row.rows.slice(1),longTasks:row.longTasks,errors:[...s.errors],proof:proof(),...observation(),runtimeTime:runtime.time});}
 },2);
 return null;
}
