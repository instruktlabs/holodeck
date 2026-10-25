import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Canvas} from '@react-three/fiber';
import {WebGPURenderer,ACESFilmicToneMapping} from 'three/webgpu';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RuntimeScene} from '../world/runtime-scene.jsx';
import {WorldRuntime} from '../world/runtime.mjs';
import {validateWorld} from '../world/contract.mjs';
import {CoveEffects} from '../world/effects.jsx';
import {probe} from '../prototype/scene.jsx';
import {loadTerrainTextures} from '../world/terrain-textures.js';
import {tagGltfTextures} from '../world/material-share.mjs';
import './viewer.css';
import {Benchmark} from './benchmark.jsx';
import {Diagnostics,RenderReadiness} from './diagnostics.jsx';
import {createInitializationEvidence} from './renderer-diagnostics.mjs';
import {enableParallelCompile} from '../world/parallel-compile.js';
import {DEFAULT_EXPOSURE} from '../world/lighting.mjs';
import {validateScenario,scenarioCamera} from './benchmark-protocol.mjs';
import {createTouchInput} from '../world/touch-input.mjs';
import {TouchControls,useTouchMode} from '../world/touch.jsx';
const benchmarkEnabled=new URLSearchParams(location.search).get('benchmark')==='1';
const benchmarkCamera=benchmarkEnabled&&window.holodeckBenchmarkScenario?scenarioCamera(validateScenario(window.holodeckBenchmarkScenario)):{};
const initialization=benchmarkEnabled?createInitializationEvidence({forceWebGL:new URLSearchParams(location.search).get('backend')==='webgl'}):null;

const noop=()=>{};
const readViewerErrors=()=>probe.errors;
function disposeModels(models){
 const resources=new Set();for(const model of new Set(models))model.scene.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of [].concat(o.material||[])){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});
 for(const resource of resources)resource.dispose();
}
function useStaticBundle(){
 const [result,setResult]=useState({bundle:null,error:null});
 useEffect(()=>{
  let stopped=false;const controller=new AbortController(),loaded=new Set();
  (async()=>{
   const response=await fetch(new URL('./scene.json',document.baseURI),{signal:controller.signal});if(!response.ok)throw new Error('The exported scene file could not be loaded.');
   const payload=await response.json();if(payload.format!=='holodeck-view-v1')throw new Error('Unsupported static scene format');validateWorld(payload.world);
   const loader=new GLTFLoader(),byUrl=new Map();
   const entries=await Promise.all(payload.world.scene.assets.map(async asset=>{
    const entry=payload.assets[asset.id];if(!entry||!/^\.\/assets\/imports\/[a-f0-9]{64}\.glb$/.test(entry.url)||entry.url!==`./assets/imports/${entry.hash}.glb`)throw new Error('Invalid exported asset path');
    if(!byUrl.has(entry.url))byUrl.set(entry.url,loader.loadAsync(entry.url).then(tagGltfTextures).then(model=>{loaded.add(model);if(stopped)disposeModels([model]);return model;}));
    return [asset.id,await byUrl.get(entry.url)];
   }));
   for(const [file,entry] of Object.entries(payload.textures||{}))if(!/^\.\/assets\/imports\/terrain\/[a-f0-9]{64}\.png$/.test(entry?.url)||entry.url!==`./${file}`)throw new Error('Invalid exported terrain texture path');
   const textures=await loadTerrainTextures(payload.textures,{signal:controller.signal});
   if(!stopped)setResult({bundle:{payload,models:Object.fromEntries(entries),textures},error:null});
  })().catch(error=>{if(!stopped)setResult({bundle:null,error:error.message});});
  return()=>{stopped=true;controller.abort();disposeModels(loaded);};
 },[]);return result;
}
class RenderBoundary extends React.Component{
 state={error:null};static getDerivedStateFromError(error){return {error:error.message};}
 render(){return this.state.error?<div className="viewer-error" role="alert">The scene could not be rendered. {this.state.error}</div>:this.props.children;}
}
function Viewer(){
 const {bundle,error}=useStaticBundle(),runtime=useMemo(()=>bundle?new WorldRuntime(bundle.payload.world.scene):null,[bundle]);
 const [inhabiting,setInhabiting]=useState(benchmarkEnabled),[cameraMode,setCameraMode]=useState(benchmarkEnabled?'free':'walk'),[person,setPerson]=useState('first'),[cove,setCove]=useState(true),[homeTick,setHomeTick]=useState(0),[locked,setLocked]=useState(false),[aim,setAim]=useState(null),[hidden,setHidden]=useState(benchmarkEnabled),[paused,setPaused]=useState(false),[notice,setNotice]=useState(''),[observation,setObservation]=useState({});
 const touch=useMemo(createTouchInput,[]),touchMode=useTouchMode(),[menu,setMenu]=useState(false);
 const leaveWorld=useCallback(()=>{setInhabiting(false);setLocked(false);document.exitPointerLock?.();document.activeElement?.blur();},[]);
 const requestLook=useCallback(()=>{try{const canvas=document.querySelector('canvas');if(!canvas?.requestPointerLock){setNotice('Right-drag to look.');return;}canvas.requestPointerLock()?.catch(()=>setNotice('Right-drag to look.'));}catch{setNotice('Right-drag to look.');}},[]);
 const toggleHud=useCallback(()=>setHidden(v=>!v),[]),toggleFree=useCallback(()=>{setCameraMode(m=>m==='free'?'walk':'free');document.activeElement?.blur();},[]);
 const interact=useCallback(id=>{if(!runtime)return;const position=probe.actorEye??probe.position,query=runtime.interaction(id,position);setNotice(runtime.act(id,position)?query.label:query.reason==='out-of-reach'?'Move closer to interact.':'No action available here.');},[runtime]);
 // Legacy readiness still owns control availability; current render readiness
 // can become false again without resetting the player or disabling movement.
 useEffect(()=>{const timer=setInterval(()=>setObservation({ready:probe.ready,renderReady:probe.renderReady===true,pendingCompiles:probe.pendingCompiles,settledFrames:probe.settledFrames,backend:probe.backend,position:probe.position,actor:probe.actor,errors:probe.errors}),500);return()=>clearInterval(timer);},[]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4000);return()=>clearTimeout(timer);},[notice]);
 useEffect(()=>{const fail=()=>setNotice('Mouse capture is unavailable. Right-drag to look.');document.addEventListener('pointerlockerror',fail);return()=>document.removeEventListener('pointerlockerror',fail);},[]);
 // The phone menu closes when a choice is made or the scene is touched.
 useEffect(()=>{if(!menu)return;const outside=e=>{if(!e.target.closest?.('.viewer-view'))setMenu(false);};window.addEventListener('pointerdown',outside,true);return()=>window.removeEventListener('pointerdown',outside,true);},[menu]);
 if(runtime){runtime.paused=paused||!inhabiting;runtime.originVisible=cove;}
 const possessed=!!runtime?.scene.runtime.possession,interaction=runtime?.interaction(aim,probe.actorEye??probe.position),effectiveMode=inhabiting?cameraMode:'overview',forcedGL=new URLSearchParams(location.search).get('backend')==='webgl';
 function enterWorld(){setInhabiting(true);setCameraMode('walk');setHidden(false);document.activeElement?.blur();if(!touchMode)requestLook();}
 const hint=touchMode?(inhabiting?(cameraMode==='free'?'Left thumb flies · drag to look · Up and Down rise and sink':`Left thumb moves, push to the edge to run · drag to look${possessed?' · tap to interact':''}`):'Drag to orbit · pinch to zoom · Enter the world to walk.')
  :inhabiting?(cameraMode==='free'?'WASD fly · Q / E down / up · Shift faster · G return':possessed?'WASD move · Space jump · Shift run · V view · E interact':'WASD move · Shift faster · E interact'):'Enter the world to explore. Right-drag to orbit; scroll to zoom.';
 const view=!inhabiting?'Overlook':cameraMode==='free'?'Free camera':possessed?(person==='first'?'First person':'Third person'):'Walking';
 function chooseCamera(view){setInhabiting(true);if(view==='free')setCameraMode('free');else{setCameraMode('walk');setPerson(view);}document.activeElement?.blur();}
 return <main className={`static-viewer ${inhabiting?'inhabiting':''} ${hidden&&inhabiting?'hud-hidden':''}`}>
  <div className="viewer-scene" inert={benchmarkEnabled}><RenderBoundary>{bundle&&<Canvas shadows="percentage" dpr={benchmarkEnabled?1:[1,1.5]} camera={{position:bundle.payload.world.scene.runtime.overview,fov:63,near:.05,far:160,...benchmarkCamera}} gl={async props=>{const renderer=new WebGPURenderer({...props,forceWebGL:forcedGL,antialias:true});renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=DEFAULT_EXPOSURE;renderer.info.autoReset=false;await (initialization?initialization.initialize(renderer):renderer.init());enableParallelCompile(renderer);return renderer;}}>
   <RuntimeScene {...{bundle,runtime,cove,homeTick,setLocked,setAim,inhabiting,leaveWorld,interact,requestLook,toggleHud,toggleFree,person,setPerson,touch}} cameraMode={effectiveMode} setMoving={noop} select={noop} focusInput={leaveWorld}/><CoveEffects effects={bundle.payload.world.scene.environment?.effects}/>{benchmarkEnabled&&<Benchmark runtime={runtime} revision={bundle.payload.world.revision} cove={cove} setCove={setCove} cameraMode={effectiveMode}/>}
  </Canvas>}</RenderBoundary></div>
  {benchmarkEnabled&&<Diagnostics readErrors={readViewerErrors} readInitialization={initialization.read}/>}
  <header className="viewer-toolbar" inert={benchmarkEnabled}><a className="viewer-brand" href="./">holodeck <span>world</span></a><div>{inhabiting?<button onClick={leaveWorld}>Stop exploring <kbd>Esc</kbd></button>:<button className="primary" disabled={!observation.ready||!!error} onClick={enterWorld}>Enter world ↗</button>}</div></header>
  {error?<section className="viewer-card viewer-error" role="alert">{error}</section>:!bundle?<section className="viewer-card" role="status">Loading the scene…</section>:!benchmarkEnabled&&!observation.renderReady?<section className="viewer-card" role="status">Preparing the current view…</section>:null}
  {/* Benchmark captures show the world alone, without the walk reticle (H78). */}
  {inhabiting&&!benchmarkEnabled&&<><div className="viewer-reticle"/><div className="viewer-aim">{cameraMode==='walk'&&interaction?.action?(interaction.available?`${touchMode?'Tap':'E'} · ${interaction.label}`:'Move closer to interact'):''}</div></>}
  <TouchControls touch={touch} active={!benchmarkEnabled&&touchMode&&!!observation.ready} mode={effectiveMode} possessed={possessed} interaction={interaction} onInteract={()=>interact(aim)} bottom={hidden&&inhabiting?24:150}>
   {inhabiting&&<button type="button" className="touch-button quiet" aria-pressed={hidden} onClick={toggleHud}>{hidden?'Show controls':'Clear view'}</button>}
  </TouchControls>
  <footer className="viewer-footer" inert={benchmarkEnabled}>
   <div className={`viewer-view ${menu?'open':''}`}>
   <button className="viewer-view-toggle" aria-expanded={menu} aria-controls="viewer-controls" onClick={()=>setMenu(v=>!v)}>View · {view}</button>
   <div id="viewer-controls" className="viewer-controls" role="group" aria-label="Scene controls" onClick={e=>{if(e.target.closest('button'))setMenu(false);}}>
    {possessed&&<><button aria-pressed={inhabiting&&cameraMode==='walk'&&person==='first'} onClick={()=>chooseCamera('first')}>First person</button><button aria-pressed={inhabiting&&cameraMode==='walk'&&person==='third'} onClick={()=>chooseCamera('third')}>Third person</button></>}
    <button aria-pressed={inhabiting&&cameraMode==='free'} onClick={()=>chooseCamera('free')}>Free camera <kbd>G</kbd></button><button onClick={leaveWorld}>Overlook</button>
    <button onClick={()=>{setCove(v=>!v);document.activeElement?.blur();}}>{cove?'Hide cove':'Show cove'}</button><button onClick={()=>{setHomeTick(n=>n+1);setCove(true);setCameraMode('walk');document.activeElement?.blur();}}>Return to arrival</button>
    <button aria-pressed={paused} onClick={()=>setPaused(v=>!v)}>{paused?'Resume activity':'Pause activity'}</button>
   </div>
   </div>
   <p role="status">{notice||hint}{inhabiting&&!locked&&!touchMode?' · Right-drag to look, or click the scene to capture the mouse.':''}</p>
   <details><summary>{observation.backend??'Preparing renderer'} · Revision {bundle?.payload.world.revision??'…'} · Static scene</summary><RenderReadiness evidence={observation}/><p>Scene activity stays in this browser session. No agent or backend connection.</p><p>Camera: {effectiveMode}{possessed?` / ${person}`:''} · Feet: {observation.actor?.position?.map(n=>n.toFixed(2)).join(', ')??'—'} · State: {observation.actor?.mode??'—'}</p>{observation.errors?.length>0&&<p role="alert">{observation.errors.join(' · ')}</p>}</details>
  </footer>
 </main>;
}
createRoot(document.getElementById('root')).render(<Viewer/>);
