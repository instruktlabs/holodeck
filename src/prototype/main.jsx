import React, { Suspense, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, WebGPURenderer } from 'three/webgpu';
import { Scene, probe } from './scene.jsx';
import { initialSession, interpret, sessionReducer } from './session.mjs';
import { useVoice } from './voice.js';
import './style.css';
import { WorldApp } from '../world/app.jsx';

function Icon({name,...props}){
  const paths={mic:<><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8"/></>,arrow:<path d="M12 19V5m-6 6 6-6 6 6"/>,close:<path d="m6 6 12 12M6 18 18 6"/>,book:<><path d="M5 3h12a2 2 0 0 1 2 2v16H6a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Zm-2 15a3 3 0 0 1 3-3h13M7 7h8M7 10h6"/></>,home:<><path d="m3 11 9-8 9 8M6 9v12h12V9M10 21v-7h4v7"/></>,move:<><path d="M12 3v18M3 12h18m-12-6 3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/></>,image:<><rect x="3" y="3" width="18" height="18" rx="3"/><path d="m3 17 6-6 5 5 3-3 4 4"/><circle cx="16" cy="8" r="1"/></>,eye:<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>};
  return <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]||paths.move}</svg>;
}
class SceneBoundary extends React.Component {
  state={error:null};static getDerivedStateFromError(error){return {error};}
  render(){return this.state.error?<div className="render-error"><h2>The scene could not load.</h2><p>{String(this.state.error.message)}</p><a href="?backend=webgl">Try WebGL2</a></div>:this.props.children;}
}
function App(){
  const [s,dispatch]=useReducer(sessionReducer,initialSession),[text,setText]=useState(''),[cove,setCove]=useState(true),[homeTick,setHomeTick]=useState(0),[locked,setLocked]=useState(false),[moving,setMoving]=useState(false),[selected,setSelected]=useState(null),[aim,setAim]=useState(null),[drawer,setDrawer]=useState(null),[progress,setProgress]=useState(0),[lockError,setLockError]=useState('');
  const input=useRef(),focusInput=useCallback(()=>requestAnimationFrame(()=>input.current?.focus()),[]),select=useCallback(value=>{setSelected(value);},[]);
  const voice=useVoice(t=>{setText(t);focusInput();});
  const forcedGL=new URLSearchParams(location.search).get('backend')==='webgl';
  useEffect(()=>{probe.session=s;probe.cove=cove;probe.selected=selected;probe.locked=locked;},[s,cove,selected,locked]);
  useEffect(()=>{
    if(s.phase!=='building'){setProgress(0);return;}
    const job=s.job,start=performance.now(),duration=s.task==='world'?4200:3200;
    const update=setInterval(()=>setProgress(Math.min(99,Math.floor((performance.now()-start)/duration*100))),100);
    const finish=setTimeout(()=>dispatch({type:'COMPLETE',job}),duration);
    return()=>{clearInterval(update);clearTimeout(finish);};
  },[s.phase,s.job,s.task]);
  const send=(message=text)=>{if(!message.trim())return;dispatch(interpret(message.trim(),s,selected));setText('');};
  async function explore(){
    document.activeElement?.blur();setDrawer(null);setLockError('');
    try{await document.querySelector('canvas')?.requestPointerLock();}catch{setLockError('Use right-drag to look and WASD to move.');}
  }
  function home(){document.exitPointerLock?.();setCove(true);setHomeTick(n=>n+1);setSelected(null);}
  const title=s.phase==='welcome'?'A place to begin.':s.phase==='decision'?'Keep the path walkable?':s.phase==='building'?(s.task==='world'?'A woodland is taking shape.':'A crossing for this path.'):s.phase==='preview'?'A quieter way across.':s.phase==='applied'?'The crossing is yours.':'Step into the woodland.';
  const compact=(locked||moving)&&!drawer;
  return <main className={compact?'is-exploring':''}>
    <div className="scene"><SceneBoundary><Canvas shadows="percentage" dpr={[1,1.5]} camera={{position:[1.25,1.72,2.35],fov:63,near:.05,far:160}} gl={async props=>{
      const renderer=new WebGPURenderer({...props,forceWebGL:forcedGL,antialias:true});renderer.toneMapping=ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.info.autoReset=false;await renderer.init();return renderer;
    }}><Suspense fallback={null}><Scene {...{session:s,cove,homeTick,setLocked,setMoving,setAim,select,focusInput,selected}}/></Suspense></Canvas></SceneBoundary></div>
    <header className="topbar"><div className="identity glass"><span className="brand">holodeck</span><i/><span className="mode"><b/>Create</span></div><span className="mock-label">LOCAL PROTOTYPE <span>·</span> MOCK AGENT</span><div className="top-actions"><button className="glass" onClick={()=>setCove(v=>!v)}><Icon name="eye"/>{cove?'Hide cove':'Show cove'}</button><button className="glass" onClick={home}><Icon name="home"/>Return to cove</button></div></header>
    <div className={`reticle ${aim?'has-target':''}`} aria-hidden="true"/><div className="aim-label">{aim?'Stream crossing · E to select':''}</div>
    <section className="conversation" aria-label="Conversation with mock agent">
      <button className="compact-card glass" onClick={()=>{document.exitPointerLock?.();focusInput();}}><span className="status-dot"/>{title}<kbd>Enter</kbd></button>
      <div className="expanded-cards">
        {s.request&&<div className="you-card glass"><span className="eyebrow">YOU {s.target&&<em> / Stream crossing</em>}</span><p>{s.request}</p></div>}
        <article className="agent-card glass" aria-live="polite">
          <div className="card-meta"><span className="eyebrow"><span className="status-dot"/>{s.phase==='decision'?'DECISION':s.phase==='building'?'BUILDING':s.phase==='preview'?'READY TO REVIEW':s.phase==='applied'?'APPLIED':'YOUR GUIDE'}</span><span className="mock-tag">mock</span></div>
          <h1>{title}</h1>
          {s.phase==='welcome'&&<><p>A small cove in an empty construct.<br/>Let’s make somewhere to wander.</p><button className="primary wide" onClick={()=>send('A quiet woodland, with a stream and a path.')}>Create a quiet woodland <span>↗</span></button><p className="footnote">Try the conversation, then walk into what you make.</p></>}
          {s.phase==='decision'&&<><p>The route stays clear as the world grows. Or we can let the edges grow wild.</p><div className="button-row"><button className="primary" onClick={()=>dispatch({type:'CHOOSE_RULE',clear:true})}>Keep it clear</button><button onClick={()=>dispatch({type:'CHOOSE_RULE',clear:false})}>Let it grow wild</button></div></>}
          {s.phase==='building'&&<><p>{s.task==='world'?'Growing a woodland around your cove.':'Trying timber planks and simple rails at the selected crossing.'}</p><div className="progress"><div style={{width:`${progress}%`}}/></div><div className="progress-label"><span>{progress<35?'Reading the world rules':progress<70?'Placing the scene':'Preparing the preview'}</span><span>{progress}%</span></div><div className="button-row"><button onClick={()=>dispatch({type:'STOP'})}>Stop</button><details><summary>Details</summary><p>A scripted local sequence. No agent is connected and no source files are being edited.</p></details></div></>}
          {s.phase==='world'&&<><p>Follow the path to the stream. Select the crossing, then ask me to build a bridge.</p><button className="primary wide" onClick={()=>{setSelected('crossing');focusInput();}}>Select crossing <span>⌖</span></button><p className="footnote">Or look at the water and press E.</p></>}
          {s.phase==='preview'&&<><p>{s.preview==='low'?'Lower rails, with a more open view of the water.':'An amber preview is waiting at the stream. Walk around it before deciding.'}</p><ul className="checks"><li>1 crossing · {s.preview==='low'?'low':'waist-height'} rails</li><li>Walking collision activates on Apply</li></ul><div className="button-row"><button className="primary" onClick={()=>dispatch({type:'APPLY'})}>Apply</button><button onClick={()=>dispatch({type:'REVISE'})}>Lower rails</button><button className="text-button" onClick={()=>dispatch({type:'DISCARD'})}>Discard</button></div></>}
          {s.phase==='applied'&&<><p>The bridge is solid now. Cross the stream, hide the cove, or keep refining.</p><div className="button-row"><button className="primary" onClick={explore}>Walk across</button>{s.canUndo&&<button onClick={()=>dispatch({type:'UNDO'})}>Undo</button>}</div></>}
          {s.notice&&<p className="notice" role="status">{s.notice}</p>}
        </article>
        <button className="bible-toggle glass" onClick={()=>setDrawer(drawer==='bible'?null:'bible')}><Icon name="book"/><span>World bible <em>· {s.world?'3 rules':'2 intentions'}</em></span><span>↗</span></button>
      </div>
    </section>
    <div className="place-caption"><span className="eyebrow">{s.world?'01 / THE WOODLAND':'00 / THE CONSTRUCT'}</span><h2>{s.world?'Somewhere to wander.':'Nothing here. Yet.'}</h2><span>{s.world?'Your cove is always within reach.':'A little warmth at the origin of a world.'}</span></div>
    <nav className="world-tools" aria-label="World tools"><button className="glass" onClick={explore}><Icon name="move"/>Explore <kbd>W A S D</kbd></button><button className="glass" onClick={()=>setDrawer(drawer==='references'?null:'references')}><Icon name="image"/>References <span>2</span></button></nav>
    {drawer&&<aside className="drawer glass"><div className="card-meta"><span className="eyebrow">{drawer==='bible'?'SHARED INTENTIONS':'PINNED DIRECTION'}</span><button className="icon-button" aria-label="Close panel" onClick={()=>setDrawer(null)}><Icon name="close"/></button></div><h2>{drawer==='bible'?'The rules of this place.':'A feeling to build toward.'}</h2>{drawer==='bible'?<><ol className="bible-rules"><li><b>A quiet woodland</b><p>Warm light, moss, timber, and a stream. The cove stays the origin.</p></li><li><b>{s.world?(s.clear?'Keep the path clear':'Let the edges grow wild'):'A path to explore'}</b><p>{s.world?(s.clear?'Leave a broad, open route through the scene.':'A narrower path with growth closer to its edges.'):'We’ll decide how open it should be before building.'}</p></li>{s.world&&<li><b>Changes stay reviewable</b><p>Preview the bridge in place. Apply, revise, discard, or undo.</p></li>}</ol><small>Session only · these choices reset on refresh.</small></>:<><img src="/design/first-person/01-discuss.png" alt="Concept reference for warm clay, linen canopy, and the kiln seedstone"/><h3>01 / Warmth at the origin</h3><p>Clay, linen, moss, and a small living core.</p><img src="/design/first-person/02-direct.png" alt="Concept reference for the woodland path and stream crossing"/><h3>02 / A world beyond the cove</h3><p>Soft woodland edges. A path inviting you out.</p><small>Generated concept references · the current scene is a procedural prototype.</small></>}</aside>}
    <footer className="composer-area">
      {selected&&<div className="context-chip glass"><span className="status-dot"/>Stream crossing <span>selected</span><button aria-label="Clear selected target" onClick={()=>setSelected(null)}>×</button></div>}
      <div className="suggestions">{!s.world?<button onClick={()=>send('A quiet woodland, with a stream and a path.')}>“A woodland with a stream…”</button>:s.preview||s.bridge?<button onClick={()=>send('Make the rails lower.')}>“Make the rails lower…”</button>:<button onClick={()=>send('Build a simple timber bridge here.')}>“Build a bridge here…”</button>}</div>
      <form className="composer glass" onSubmit={e=>{e.preventDefault();send();}}><button type="button" className={`mic ${voice.recording?'recording':''}`} disabled={voice.busy} aria-label={voice.recording?'Stop recording':'Start voice input'} title="Local speech · first use downloads a speech model" onClick={voice.toggle}><Icon name="mic"/></button><input ref={input} aria-label="Message the mock agent" value={text} onChange={e=>setText(e.target.value)} onFocus={()=>document.exitPointerLock?.()} placeholder={voice.recording?'Listening…':'Describe, ask, or change something…'} maxLength={500}/><button className="send" aria-label="Send message" disabled={!text.trim()}><Icon name="arrow"/></button></form>
      <div className="controls-hint" role="status">{voice.status||lockError||(locked?'WASD move · Shift faster · E select · Enter to talk · Esc release':'Click Explore to look freely · WASD move · right-drag to look · Enter to send')}</div>
    </footer>
  </main>;
}
createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).has('demo')?<App/>:<WorldApp/>);
