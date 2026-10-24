import React,{useEffect,useRef,useState} from 'react';
import {createJsonDownload,createReportDownload,hardwareEvidence,parseScenarios,recordDiagnostic,SCENARIO_TEXT_LIMIT,DIAGNOSTIC_LIMITATIONS} from './diagnostics.mjs';

const getApi=()=>window.holodeckBenchmark;
const value=text=>text===undefined||text===null||text===''?'Unverified':String(text);
const stop=e=>e.stopPropagation();
function backendLink(backend){const url=new URL(location.href);url.searchParams.set('benchmark','1');if(backend==='webgl')url.searchParams.set('backend','webgl');else url.searchParams.delete('backend');return url.href;}
export function InitializationEvidence({evidence,download}){
 if(!evidence)return <p>Renderer initialization has not been observed yet.</p>;
 return <section aria-label="Renderer initialization"><h2>Renderer initialization</h2>
  <dl><dt>Status</dt><dd>{evidence.status}</dd><dt>Requested / initialized backend</dt><dd>{evidence.requestedBackend} / {evidence.actualBackend??'None initialized'}</dd><dt>Secure context / WebGPU API present</dt><dd>{value(evidence.secureContext)} / {value(evidence.webgpuApiPresent)}</dd><dt>WebGPU attempt</dt><dd>{evidence.webgpuAttempt}</dd></dl>
  {evidence.forceWebGL&&<p>WebGPU was not attempted because WebGL2 was forced.</p>}
  {evidence.primaryError&&<p>Primary WebGPU initialization error: {evidence.primaryError.name}: {evidence.primaryError.message}</p>}
  {evidence.initializationError&&<p role="alert">Renderer initialization failed: {evidence.initializationError.name}: {evidence.initializationError.message}</p>}
  <p>Captured during this renderer's own initialization. API presence does not establish adapter availability; the browser may not expose the underlying reason.</p>
  {download&&<a href={download.href} download={download.filename}>Download initialization JSON</a>}
 </section>;
}
export function MeasurementResult({report,download}){
 const camera=report.scenario,vector=v=>Array.isArray(v)?v.join(', '):'Unverified';
 return <section aria-label="Measurement result"><h2>{report.outcome==='recorded'?'Recorded — session checks met':report.outcome==='unverified'?'Recorded — hardware unverified':'Rejected measurement'}</h2>
  <p>Result scenario: <strong>{value(camera?.id)}</strong></p>
  <dl><dt>Camera position</dt><dd>{vector(camera?.position)}</dd><dt>Camera target</dt><dd>{vector(camera?.target)}</dd><dt>FOV / cove</dt><dd>{value(camera?.fov)}° / {typeof camera?.cove==='boolean'?(camera.cove?'shown':'hidden'):'Unverified'}</dd></dl>
  <p>Declared camera for this result. Applying another camera does not change these results. This is session evidence, not final world qualification.</p>
  {report.summary&&<table><caption>Milliseconds, draws and all-pass triangles</caption><thead><tr><th>Metric</th><th>p50</th><th>p95</th><th>p99</th><th>Max</th></tr></thead><tbody>{['intervalMs','cpuFrameSpanMs','drawCalls','triangles'].map(k=><tr key={k}><th>{k}</th>{['p50','p95','p99','max'].map(q=><td key={q}>{report.summary[k][q].toFixed(2)}</td>)}</tr>)}</tbody></table>}
  {report.summary&&<p>{report.summary.intervalMs.count} frames · {report.summary.over16_7ms} over 16.7ms · {report.summary.over33_4ms} over 33.4ms · {report.summary.longTaskCount} long tasks</p>}
  {report.errors.length>0&&<p role="alert">{report.errors.join(' · ')}</p>}
  {report.hardware?.reasons.length>0&&<p>{report.hardware.reasons.join(' · ')}</p>}
  {download&&<a href={download.href} download={download.filename}>Download result JSON</a>}
 </section>;
}
export function Diagnostics({readErrors,readInitialization}){
 const [status,setStatus]=useState(null),[text,setText]=useState(''),[scenarios,setScenarios]=useState([]),[selected,setSelected]=useState(''),[manifest,setManifest]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState(null),[report,setReport]=useState(null);
 const [download,setDownload]=useState(null);
 const [initialization,setInitialization]=useState(null),[initializationDownload,setInitializationDownload]=useState(null);
 const mounted=useRef(false),running=useRef(false),events=useRef([]),phaseStart=useRef(0);
 const expectedBackend=new URLSearchParams(location.search).get('backend')==='webgl'?'webgl':'webgpu';
 useEffect(()=>{
  if(!report)return;
  const link=createReportDownload(report);setDownload({report,...link});return link.dispose;
 },[report]);
 useEffect(()=>{
  if(!initialization||!initialization.finishedAt&&!initialization.primaryError)return;
  const link=createJsonDownload(initialization,`holodeck-renderer-${initialization.requestedBackend}-${initialization.status}.json`);setInitializationDownload({evidence:initialization,...link});return link.dispose;
 },[initialization]);
 useEffect(()=>{
  mounted.current=true;
  const fail=message=>{if(events.current.length<50)events.current.push(String(message));};
  const changed=()=>{if(running.current)fail('Presentation changed during warmup or recording; reload before retrying');};
  // Benchmark mode starts at navigation, before any scene input. The canvas and
  // normal controls are inert; panel keys must not reach window gameplay listeners.
  const key=e=>{if(!e.target.closest?.('.viewer-diagnostics'))e.stopImmediatePropagation();};
  const update=()=>{setInitialization(readInitialization());try{setStatus(getApi()?.status()??null);}catch(e){fail(e.message);}if(running.current)setProgress(p=>p?{...p,elapsedMs:performance.now()-phaseStart.current}:p);};
  window.addEventListener('keydown',key,true);window.addEventListener('keyup',key,true);
  window.addEventListener('resize',changed);document.addEventListener('visibilitychange',changed);
  const timer=setInterval(update,1000);update();
  return()=>{mounted.current=false;clearInterval(timer);window.removeEventListener('keydown',key,true);window.removeEventListener('keyup',key,true);window.removeEventListener('resize',changed);document.removeEventListener('visibilitychange',changed);};
 },[]);
 const allErrors=()=>[...readErrors(),...events.current];
 function load(){try{const list=parseScenarios(text);setScenarios(list);setSelected(list[0].id);setError('');}catch(e){setError(e.message);}}
 function apply(){try{getApi().scenario(scenarios.find(s=>s.id===selected));setError('');}catch(e){setError(e.message);}}
 async function record(){
  if(running.current)return;
  running.current=true;setBusy(true);setError('');
  const result=await recordDiagnostic({getApi,scenario:scenarios.find(s=>s.id===selected),expectedBackend,manifestSha256:manifest,readErrors:allErrors,readInitialization,onProgress:p=>{phaseStart.current=performance.now()-p.elapsedMs;if(mounted.current)setProgress(p);}});
  running.current=false;if(mounted.current){setReport(result);setBusy(false);setProgress(null);}
 }
 const proof=status?.proof,view=proof?.viewport,hardware=hardwareEvidence(proof,expectedBackend),ready=!!status?.ready&&scenarios.length===3;
 return <aside className="viewer-diagnostics" aria-label="Viewer diagnostics" onKeyDown={stop} onKeyUp={stop}>
  <h1>Viewer diagnostics</h1>
  <p>Fixed-camera measurements · {status?.protocol??'Waiting for renderer'} · Revision {status?.revision??'unverified'}</p>
  <InitializationEvidence evidence={initialization} download={initializationDownload?.evidence===initialization?initializationDownload:null}/>
  <p>Actual backend: <strong>{value(proof?.backend)}</strong> · Hardware evidence: <strong>{hardware.status}</strong></p>
  <dl><dt>Adapter vendor</dt><dd>{value(proof?.adapter?.vendor)}</dd><dt>Architecture</dt><dd>{value(proof?.adapter?.architecture)}</dd><dt>Device / description</dt><dd>{value(proof?.adapter?.device)} / {value(proof?.adapter?.description)}</dd><dt>Fallback adapter</dt><dd>{value(proof?.adapter?.isFallbackAdapter)}</dd><dt>GL renderer</dt><dd>{value(proof?.renderer)}</dd><dt>Presentation</dt><dd>{view?`${view.width}×${view.height} · device DPR ${view.dpr} · canvas ${view.canvasWidth}×${view.canvasHeight}`:'Unverified'} · {value(proof?.visibility)}</dd></dl>
  <p>Requires a visible 1920×1080 viewport, device DPR1 and 1920×1080 canvas. Missing hardware fields remain unverified. Reload to clear a rejected session.</p>
  <fieldset disabled={busy}><legend>Declared camera scenarios</legend>
   <label htmlFor="diagnostic-cameras">Paste exactly three camera records as JSON</label>
   <textarea id="diagnostic-cameras" rows="4" value={text} maxLength={SCENARIO_TEXT_LIMIT} spellCheck="false" onChange={e=>setText(e.target.value)}/>
   <p>Each record: id, position [x,y,z], target [x,y,z], fov (30–90), cove (true/false). Maximum 16,384 characters.</p>
   <button onClick={load}>Load camera JSON</button>
   <label htmlFor="diagnostic-scenario">Scenario</label><select id="diagnostic-scenario" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a loaded scenario</option>{scenarios.map(s=><option key={s.id} value={s.id}>{s.id}</option>)}</select>
   <button disabled={!ready||!selected} onClick={apply}>Apply camera for framing</button>
   <label htmlFor="diagnostic-manifest">Export manifest SHA-256 (optional, externally verified)</label><input id="diagnostic-manifest" value={manifest} maxLength="64" onChange={e=>setManifest(e.target.value)} spellCheck="false"/>
   <button className="primary" disabled={!ready||!selected} onClick={record}>Warm up 10s and record 60s</button>
  </fieldset>
  {busy?<p role="status">{progress?.phase??'Preparing'} · {Math.floor((progress?.elapsedMs??0)/1000)}s. Keep this tab visible. Reload ends the session.</p>:<p><a href={backendLink('webgpu')}>Reload: prefer WebGPU</a> · <a href={backendLink('webgl')}>Reload: force WebGL2</a> · <a href="./">Return to normal player</a></p>}
  {error&&<p role="alert">{error}</p>}
  {(status?.errors?.length>0||allErrors().length>0)&&<p role="alert">Session errors: {[...(status?.errors??[]),...allErrors()].slice(0,50).join(' · ')}</p>}
  {report&&<MeasurementResult report={report} download={download?.report===report?download:null}/>}
  <details><summary>Evidence limits</summary>{DIAGNOSTIC_LIMITATIONS.map(t=><p key={t}>{t}</p>)}</details>
 </aside>;
}
