import {BENCHMARK_PROTOCOL,validateScenario,validateScenarios,assertObservation,summarize} from './benchmark-protocol.mjs';

export const SCENARIO_TEXT_LIMIT=16384;
export const WARMUP_MS=10000;
export const SAMPLE_MS=60000;
export const DIAGNOSTIC_LIMITATIONS=[
 'Frame intervals and callback spans are not GPU execution timings. Counters include all render passes.',
 'This visible fixed-camera session does not establish cold-profile startup, host exclusivity, GPU temperature, traversal or visual quality.',
 'The revision and optional user-supplied manifest hash identify the intended export; this panel does not verify the export inventory.',
 'Diagnostics add collection and overlay overhead. Use identical scenarios, exports and presentation settings for comparisons.'
];
// Keep a native download URL alive until its displayed report is replaced.
export function createJsonDownload(report,filename,urlApi=URL){
 const href=urlApi.createObjectURL(new Blob([JSON.stringify(report,null,2)+'\n'],{type:'application/json'}));
 return {href,filename,dispose:()=>urlApi.revokeObjectURL(href)};
}
export function createReportDownload(report,urlApi=URL){
 return createJsonDownload(report,`holodeck-${report.scenario?.id??'unknown'}-${report.expectedBackend}-${report.outcome}.json`,urlApi);
}
export function parseScenarios(text){
 if(typeof text!=='string'||text.length>SCENARIO_TEXT_LIMIT)throw Error('Camera JSON exceeds the 16,384-character limit');
 return validateScenarios(JSON.parse(text));
}
export function hardwareEvidence(proof,expectedBackend){
 const reasons=[];
 if(!proof?.backend)return {status:'unverified',reasons:['Renderer proof is unavailable']};
 if(proof?.backend!==expectedBackend)return {status:'rejected',reasons:['Requested backend was not used']};
 const adapter=proof.adapter,text=expectedBackend==='webgpu'?Object.values(adapter??{}).join(' '):proof.renderer;
 if(/swiftshader|llvmpipe|lavapipe|software/i.test(text??'')||adapter?.isFallbackAdapter===true)return {status:'rejected',reasons:['Software or fallback renderer reported']};
 if(expectedBackend==='webgpu'){
  if(adapter?.isFallbackAdapter!==false)reasons.push('GPUDevice fallback status is unverified');
  if(!['vendor','architecture','device','description'].some(k=>typeof adapter?.[k]==='string'&&adapter[k].trim()))reasons.push('Adapter identity is unverified');
 }else if(!text||/^(webkit\s+)?webgl(2)?(\s+renderer)?$/i.test(text.trim()))reasons.push('GL hardware identity is unverified');
 return {status:reasons.length?'unverified':'reported',reasons};
}
function assertStatus(status,scenario){
 if(status?.protocol!==BENCHMARK_PROTOCOL||!status.ready)throw Error('Benchmark API is not ready');
 assertObservation(status,scenario);
 if(status.appliedCove!==scenario.cove)throw Error('Requested cove visibility has not been applied');
}
function summarizeSample(sample){
 if(!sample||sample.durationMs<SAMPLE_MS||sample.durationMs>SAMPLE_MS+15000)throw Error('Recording duration is outside the bounded 60-second sample');
 if(!Array.isArray(sample.rows)||!sample.rows.length)throw Error('No frame samples recorded');
 const summary=Object.fromEntries(['intervalMs','cpuFrameSpanMs','drawCalls','triangles'].map(k=>[k,summarize(sample.rows.map(r=>r[k]))]));
 return {...summary,over16_7ms:sample.rows.filter(r=>r.intervalMs>16.7).length,over33_4ms:sample.rows.filter(r=>r.intervalMs>33.4).length,longTaskCount:sample.longTasks?.length??0};
}
const errorText=e=>String(e?.message??e);
const identity=p=>JSON.stringify([p?.backend,p?.adapter??null,p?.renderer??null]);

// Uses only the public benchmark API. Injectable time makes lifecycle failures
// testable without launching a renderer or shortening production measurements.
export async function recordDiagnostic({getApi,scenario,expectedBackend,manifestSha256='',readErrors=()=>[],readInitialization=()=>null,onProgress=()=>{},now=()=>performance.now(),date=()=>new Date().toISOString(),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 const report={format:'holodeck-viewer-diagnostics-v1',protocol:BENCHMARK_PROTOCOL,startedAt:date(),expectedBackend,scenario:structuredClone(scenario),manifestSha256:manifestSha256||null,manifestVerification:'not performed; hash is user-supplied',rendererInitialization:null,warmupMs:0,requestedSampleMs:SAMPLE_MS,start:null,warmupEnd:null,end:null,measurement:null,summary:null,errors:[],outcome:'rejected',limitations:DIAGNOSTIC_LIMITATIONS};
 const retainErrors=errors=>{for(const e of errors??[]){const text=errorText(e);if(!report.errors.includes(text)&&report.errors.length<100)report.errors.push(text);}};
 let api;
 const observe=()=>{
  if(getApi()!==api)throw Error('Benchmark API changed during the run');
  const status=structuredClone(api.status());retainErrors(status.errors);retainErrors(readErrors());return status;
 };
 try{
  report.rendererInitialization=structuredClone(readInitialization());
  scenario=validateScenario(scenario);
  if(!['webgpu','webgl'].includes(expectedBackend))throw Error('Invalid expected backend');
  if(manifestSha256&&!/^[a-f0-9]{64}$/.test(manifestSha256))throw Error('Manifest SHA-256 must be 64 lowercase hex characters');
  api=getApi();if(!api)throw Error('Benchmark API is not ready');
  api.scenario(scenario);onProgress({phase:'Preparing camera',elapsedMs:0});
  const preparationStart=now();let lastError;
  while(true){
   report.start=observe();
   try{assertStatus(report.start,scenario);break;}catch(e){lastError=e;}
   if(now()-preparationStart>=5000)throw Error(`Camera readiness deadline exceeded: ${errorText(lastError)}`);
   if(report.errors.length)throw Error('Browser or renderer errors were recorded');
   await wait(100);
  }
  const warmupStart=now();
  while(now()-warmupStart<WARMUP_MS){
   const status=observe();assertStatus(status,scenario);
   report.warmupMs=now()-warmupStart;
   if(status.revision!==report.start.revision||identity(status.proof)!==identity(report.start.proof))throw Error('Scene or renderer identity changed during warmup');
   const hardware=hardwareEvidence(status.proof,expectedBackend);
   if(hardware.status==='rejected')throw Error(hardware.reasons.join('; '));
   if(report.errors.length)throw Error('Browser or renderer errors were recorded');
   onProgress({phase:'Warming up',elapsedMs:now()-warmupStart});
   await wait(Math.min(1000,WARMUP_MS-(now()-warmupStart)));
  }
  report.warmupMs=now()-warmupStart;report.warmupEnd=observe();assertStatus(report.warmupEnd,scenario);
  if(report.errors.length)throw Error('Browser or renderer errors were recorded');
  onProgress({phase:'Recording',elapsedMs:0});
  report.measurement=await api.sample(SAMPLE_MS);
  report.end=observe();retainErrors(report.measurement.errors);
  assertStatus(report.end,scenario);assertObservation(report.measurement,scenario);
  if(report.start.revision!==report.end.revision)throw Error('Scene revision changed during the run');
  if([report.warmupEnd.proof,report.end.proof,report.measurement.proof].some(p=>identity(p)!==identity(report.start.proof)))throw Error('Renderer identity changed during the run');
  report.summary=summarizeSample(report.measurement);
  report.hardware=hardwareEvidence(report.end.proof,expectedBackend);
  if(report.hardware.status==='rejected')retainErrors(report.hardware.reasons);
  report.outcome=report.errors.length?'rejected':report.hardware.status==='unverified'?'unverified':'recorded';
 }catch(e){retainErrors([e]);}
 finally{
  try{if(!report.end&&api)report.end=structuredClone(api.status());retainErrors(readErrors());retainErrors(report.end?.errors);}catch(e){retainErrors([e]);}
  if(report.errors.length)report.outcome='rejected';
  report.finishedAt=date();
 }
 return report;
}
