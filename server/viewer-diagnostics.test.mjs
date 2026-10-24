import test from 'node:test';
import assert from 'node:assert/strict';
import {parseScenarios,hardwareEvidence,recordDiagnostic,createReportDownload,createJsonDownload,SCENARIO_TEXT_LIMIT} from '../src/viewer/diagnostics.mjs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createServer} from 'vite';
import {BENCHMARK_PROTOCOL} from '../src/viewer/benchmark-protocol.mjs';

const cameras=()=>['arrival','inside','forest'].map(id=>({id,position:[0,2,8],target:[0,2,0],fov:63,cove:false}));
function fixture(){
 const f={time:0,applied:0,calls:[],errors:[],sampleError:null,onWait:()=>{},onSample:()=>{}};
 f.status={protocol:BENCHMARK_PROTOCOL,ready:true,renderReady:true,pendingCompiles:0,settledFrames:3,revision:8,scenario:null,position:[0,0,0],fov:63,cameraMode:'free',paused:false,manualCounters:true,appliedCove:true,errors:[],proof:{backend:'webgpu',adapter:{vendor:'nvidia',architecture:'turing',isFallbackAdapter:false},renderer:null,visibility:'visible',viewport:{width:1920,height:1080,dpr:1,canvasWidth:1920,canvasHeight:1080}}};
 f.api={
  status:()=>structuredClone(f.status),
  scenario(s){f.calls.push(['scenario',f.time]);f.status.scenario=structuredClone(s);},
  async sample(ms){
   f.calls.push(['sample',ms,f.time]);if(f.sampleError)throw f.sampleError;
   f.time+=ms;
   f.sample={...structuredClone(f.status),durationMs:ms,rows:[{t:16,intervalMs:16,cpuFrameSpanMs:3,drawCalls:200,triangles:400000,renderReady:true,pendingCompiles:0,settledFrames:3},{t:60,intervalMs:44,cpuFrameSpanMs:9,drawCalls:220,triangles:450000,renderReady:true,pendingCompiles:0,settledFrames:3}],longTasks:[],runtimeTime:70};
   f.onSample();return f.sample;
  }
 };
 f.currentApi=f.api;
 f.options={getApi:()=>f.currentApi,scenario:cameras()[0],expectedBackend:'webgpu',manifestSha256:'a'.repeat(64),readErrors:()=>f.errors,now:()=>f.time,date:()=>new Date(f.time).toISOString(),wait:async ms=>{
  f.time+=ms;
  if(!f.applied&&f.status.scenario){f.status.position=[...f.status.scenario.position];f.status.appliedCove=f.status.scenario.cove;f.applied=f.time;}
  f.onWait();
 }};
 return f;
}
test('bounded camera JSON rejects extra executable fields, duplicate IDs, wrong counts and oversized input',()=>{
 assert.equal(parseScenarios(JSON.stringify(cameras())).length,3);
 assert.throws(()=>parseScenarios(' '.repeat(SCENARIO_TEXT_LIMIT+1)),/limit/);
 assert.throws(()=>parseScenarios(JSON.stringify(cameras().slice(1))),/three/);
 const duplicate=cameras();duplicate[1].id=duplicate[0].id;assert.throws(()=>parseScenarios(JSON.stringify(duplicate)),/unique/);
 const extra=cameras();extra[0].code='alert(1)';assert.throws(()=>parseScenarios(JSON.stringify(extra)),/Invalid scenario/);
 const invalid=cameras();invalid[0].target=[0,2,8];assert.throws(()=>parseScenarios(JSON.stringify(invalid)),/distinct/);
});
test('run waits for the actual camera, warms up for ten seconds and records once for sixty seconds',async()=>{
 const f=fixture(),report=await recordDiagnostic(f.options);
 assert.equal(report.outcome,'recorded');assert.equal(report.warmupMs,10000);
 assert.deepEqual(f.calls,[['scenario',0],['sample',60000,10100]]);
 assert.equal(report.start.position[1],2);assert.equal(report.end.revision,8);
 assert.equal(report.summary.intervalMs.p95,44);assert.equal(report.summary.over33_4ms,1);
 assert.equal(report.measurement.rows.length,2);assert.equal(report.manifestSha256,'a'.repeat(64));
 assert.match(report.manifestVerification,/not performed/);assert.deepEqual(report.errors,[]);
});
test('presentation and readiness failures are bounded and never start a sample',async()=>{
 for(const mutate of [s=>s.proof.viewport.dpr=2,s=>s.proof.viewport.width=1280,s=>s.ready=false,s=>s.renderReady=false,s=>s.pendingCompiles=1,s=>s.paused=true,s=>s.manualCounters=false]){
  const f=fixture();mutate(f.status);const report=await recordDiagnostic(f.options);
  assert.equal(report.outcome,'rejected');assert.equal(f.calls.length,1);assert.ok(f.time<=5000);assert.match(report.errors.join(' '),/deadline/);
 }
});
test('warmup rejects a lost visible presentation, ordinary browser error or API replacement',async()=>{
 for(const change of [f=>f.status.proof.visibility='hidden',f=>f.errors.push('JavaScript failure'),f=>f.currentApi={...f.api}]){
  const f=fixture();f.onWait=()=>{if(f.time>=3100)change(f);};const report=await recordDiagnostic(f.options);
  assert.equal(report.outcome,'rejected');assert.equal(f.calls.length,1);assert.ok(report.errors.length);
 }
});
test('new shader compilation during warmup rejects before recording',async()=>{
 const f=fixture();f.onWait=()=>{if(f.time>=3100){f.status.renderReady=false;f.status.pendingCompiles=2;}};
 const report=await recordDiagnostic(f.options);
 assert.equal(report.outcome,'rejected');assert.equal(f.calls.length,1);
 assert.match(report.errors.join(' '),/not settled/);assert.equal(report.end.pendingCompiles,2);
});
test('compilation in a retained frame invalidates a recording even when its final view has settled again',async()=>{
 const f=fixture();f.onSample=()=>Object.assign(f.sample.rows[0],{renderReady:false,pendingCompiles:2,settledFrames:0});
 const report=await recordDiagnostic(f.options);
 assert.equal(report.end.renderReady,true);assert.equal(report.end.pendingCompiles,0);
 assert.equal(report.outcome,'rejected');assert.match(report.errors.join(' '),/not settled/);
 assert.equal(report.measurement.rows[0].pendingCompiles,2);assert.equal(report.measurement.rows.length,2);
 assert.ok(report.summary,'rejected raw evidence and summaries remain available');
 f.onSample=()=>{};
 const retry=await recordDiagnostic(f.options);
 assert.equal(retry.outcome,'recorded','a later settled attempt is not poisoned by the prior compilation');
 assert.equal(report.outcome,'rejected');assert.equal(report.measurement.rows[0].pendingCompiles,2,'earlier failure evidence is unchanged');
});
test('render-readiness markup uses the dynamic state rather than legacy ready',async t=>{
 const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,watch:null},appType:'custom'});t.after(()=>server.close());
 const {RenderReadiness}=await server.ssrLoadModule('/src/viewer/diagnostics.jsx');
 const html=renderToStaticMarkup(React.createElement(RenderReadiness,{evidence:{ready:true,renderReady:false,pendingCompiles:4,settledFrames:0}}));
 assert.match(html,/<strong>Compiling<\/strong>/);assert.match(html,/4 pending programs/);assert.match(html,/0 \/ 3 settled frames/);
 const settled=renderToStaticMarkup(React.createElement(RenderReadiness,{evidence:{renderReady:true,pendingCompiles:0,settledFrames:3}}));
 assert.match(settled,/<strong>Settled<\/strong>/);assert.match(settled,/not a visual quality verdict/);
});
test('resolved sample errors reject the result while retaining raw records and summaries',async()=>{
 const f=fixture();f.onSample=()=>f.sample.errors.push('Presentation changed');const report=await recordDiagnostic(f.options);
 assert.equal(report.outcome,'rejected');assert.equal(report.measurement.rows.length,2);assert.equal(report.summary.drawCalls.max,220);assert.ok(report.errors.includes('Presentation changed'));
});
test('final camera, revision, renderer and JavaScript errors cannot yield accepted evidence',async()=>{
 for(const change of [f=>f.status.position[0]++,f=>f.status.revision++,f=>f.status.proof.adapter.vendor='other',f=>f.errors.push('Unhandled rejection')]){
  const f=fixture();f.onSample=()=>change(f);const report=await recordDiagnostic(f.options);
  assert.equal(report.outcome,'rejected');assert.equal(report.measurement.rows.length,2);assert.ok(report.errors.length);
 }
});
test('empty, invalid or short samples remain downloadable rejected evidence',async()=>{
 for(const change of [s=>s.rows=[],s=>s.rows[0].intervalMs=NaN,s=>s.durationMs=1000]){
  const f=fixture();f.onSample=()=>change(f.sample);const report=await recordDiagnostic(f.options);
  assert.equal(report.outcome,'rejected');assert.ok(report.measurement);assert.equal(report.summary,null);assert.ok(report.errors.length);
 }
});
test('sampler deadline rejection records failure with no invented rows',async()=>{
 const f=fixture();f.sampleError=Error('Frame collection deadline exceeded');const report=await recordDiagnostic(f.options);
 assert.equal(report.outcome,'rejected');assert.equal(report.measurement,null);assert.ok(report.errors.includes('Frame collection deadline exceeded'));assert.ok(report.end);
});
test('unavailable fallback proof is unverified; forced fallback or software fails before recording',async()=>{
 const unknown=fixture();delete unknown.status.proof.adapter.isFallbackAdapter;
 assert.equal((await recordDiagnostic(unknown.options)).outcome,'unverified');
 for(const change of [p=>p.backend='webgl',p=>p.adapter.isFallbackAdapter=true,p=>p.adapter.vendor='SwiftShader']){
  const f=fixture();change(f.status.proof);const report=await recordDiagnostic(f.options);assert.equal(report.outcome,'rejected');assert.equal(f.calls.length,1);
 }
 assert.equal(hardwareEvidence(null,'webgpu').status,'unverified');
 assert.equal(hardwareEvidence({backend:'webgl',renderer:'WebKit WebGL'},'webgl').status,'unverified');
 assert.equal(hardwareEvidence({backend:'webgl',renderer:'ANGLE NVIDIA GeForce'},'webgl').status,'reported');
});
test('invalid optional manifest identity rejects before scene mutation',async()=>{
 const f=fixture(),report=await recordDiagnostic({...f.options,manifestSha256:'not a hash'});
 assert.equal(report.outcome,'rejected');assert.deepEqual(f.calls,[]);assert.match(report.errors[0],/SHA-256/);
});
test('result markup and native download retain the measured camera after another scenario is applied',async t=>{
 const f=fixture();f.options.scenario={...cameras()[1],position:[1,2,8],target:[1,2,0]};
 const report=await recordDiagnostic(f.options),original=structuredClone(report);
 f.api.scenario({...cameras()[2],position:[8,2,4]});f.options.scenario.position[0]=9;
 const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,watch:null},appType:'custom'});t.after(()=>server.close());
 const {MeasurementResult}=await server.ssrLoadModule('/src/viewer/diagnostics.jsx');
 const markup=renderToStaticMarkup(React.createElement(MeasurementResult,{report,download:{href:'blob:retained-report',filename:'holodeck-inside-webgpu-recorded.json'}}));
 assert.match(markup,/Result scenario: <strong>inside<\/strong>/);
 assert.match(markup,/<dt>Camera position<\/dt><dd>1, 2, 8<\/dd>/);
 assert.match(markup,/<dt>Camera target<\/dt><dd>1, 2, 0<\/dd>/);
 assert.match(markup,/<dt>FOV \/ cove<\/dt><dd>63° \/ hidden<\/dd>/);
 assert.match(markup,/<a href="blob:retained-report" download="holodeck-inside-webgpu-recorded.json">Download result JSON<\/a>/);
 assert.doesNotMatch(markup,/forest/);assert.deepEqual(report,original);
 const rejected={...report,outcome:'rejected',summary:null};
 assert.match(renderToStaticMarkup(React.createElement(MeasurementResult,{report:rejected})),/Declared camera for this result/);
});
test('full-size report download retains complete JSON and revokes only on explicit disposal',async()=>{
 const f=fixture(),report=await recordDiagnostic(f.options);
 report.measurement.rows=Array.from({length:32768},(_,i)=>({...report.measurement.rows[0],t:i*16}));
 let blob;const revoked=[],urlApi={createObjectURL:b=>{blob=b;return 'blob:retained-report';},revokeObjectURL:url=>revoked.push(url)};
 const link=createReportDownload(report,urlApi);
 assert.equal(blob.type,'application/json');assert.ok(blob.size>1000000);
 assert.deepEqual(JSON.parse(await blob.text()),report);assert.equal(link.filename,'holodeck-arrival-webgpu-recorded.json');
 assert.equal(link.href,'blob:retained-report');assert.deepEqual(revoked,[]);
 link.dispose();assert.deepEqual(revoked,['blob:retained-report']);
});

test('failed renderer initialization is visible and downloadable without a benchmark API or camera',async t=>{
 const evidence={format:'holodeck-renderer-initialization-v1',requestedBackend:'webgpu',forceWebGL:false,secureContext:true,webgpuApiPresent:true,status:'failed',actualBackend:null,webgpuAttempt:'failed',primaryError:{name:'OperationError',message:'Adapter unavailable'},initializationError:{name:'Error',message:'GL context unavailable'}};
 let blob;const revoked=[],link=createJsonDownload(evidence,'holodeck-renderer-webgpu-failed.json',{createObjectURL:value=>{blob=value;return 'blob:initialization';},revokeObjectURL:url=>revoked.push(url)});
 const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false,watch:null},appType:'custom'});t.after(()=>server.close());
 const {InitializationEvidence}=await server.ssrLoadModule('/src/viewer/diagnostics.jsx');
 const html=renderToStaticMarkup(React.createElement(InitializationEvidence,{evidence,download:link}));
 assert.match(html,/OperationError: Adapter unavailable/);assert.match(html,/Renderer initialization failed: Error: GL context unavailable/);
 assert.match(html,/None initialized/);assert.match(html,/href="blob:initialization" download="holodeck-renderer-webgpu-failed.json"/);
 assert.deepEqual(JSON.parse(await blob.text()),evidence);assert.deepEqual(revoked,[]);link.dispose();assert.deepEqual(revoked,['blob:initialization']);
 const forced={...evidence,forceWebGL:true,webgpuAttempt:'not-attempted',primaryError:null,initializationError:null};
 assert.match(renderToStaticMarkup(React.createElement(InitializationEvidence,{evidence:forced})),/WebGPU was not attempted because WebGL2 was forced/);
 const report=await recordDiagnostic({...fixture().options,getApi:()=>null,readInitialization:()=>evidence});
 assert.equal(report.outcome,'rejected');assert.equal(report.measurement,null);assert.deepEqual(report.rendererInitialization,evidence);
 evidence.primaryError.message='Changed later';assert.equal(report.rendererInitialization.primaryError.message,'Adapter unavailable');
});
