import React, { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas,useFrame } from '@react-three/fiber';
import { ACESFilmicToneMapping, WebGPURenderer } from 'three/webgpu';
import { enableParallelCompile } from './parallel-compile.js';
import { Scene, probe } from '../prototype/scene.jsx';
import { useVoice } from '../prototype/voice.js';
import {useAssetBundle,useWorld,useWorldClient,WorldClientContext} from './client.js';
import {worldContextKey} from './world-client.mjs';
import {resetWorldProbe,completeWorldFrame,canObserveWorld} from './world-probe.mjs';
import {DEFAULT_EXPOSURE} from './lighting.mjs';
import {useWorldDrafts,useDraftUnloadGuard} from './world-drafts.jsx';
import {WorldPicker} from './world-picker.jsx';
import './style.css';
import { MoodBoardEditor } from './moodboard.jsx';
import {CoveEffects} from './effects.jsx';
import {WorldRuntime} from './runtime.mjs';
import {RuntimeScene} from './runtime-scene.jsx';
import {toggleSelectedRef,pruneSelectedRefs,selectableItem} from './selection.mjs';
import {SelectionPanel} from './selection-panel.jsx';
import {HistoryPanel} from './history-panel.jsx';
import {ProposalReview} from './proposal-review.jsx';
import {diffProposal} from './proposal-diff.mjs';
import {Icon} from './icons.jsx';
import {Presence,DecisionSlot,ProposalLine,Composer,ReferenceTray,Sections,proposalChips} from './dock.jsx';
import {Conversation,Glance} from './conversation.jsx';
import {WorldEditor} from './world-editor.jsx';
import {BibleEditor,AgentSettings,ObservePanel} from './panels.jsx';
import {Ghosts,ghostPlacements} from './ghosts.jsx';
import {agentPresence,readLastAgent,writeLastAgent} from './presence.mjs';
import {createTouchInput} from './touch-input.mjs';
import {TouchControls,useTouchMode} from './touch.jsx';

class Boundary extends React.Component{
  state={error:null};static getDerivedStateFromError(error){return {error};}
  render(){return this.state.error?<div className="render-error"><h2>Unable to render this world.</h2><p>{this.state.error.message}</p><a href="?backend=webgl">Try WebGL2</a></div>:this.props.children;}
}
const choiceKey=provider=>`holodeck.agent-choice.${provider||'codex'}`;
function readAgentChoice(provider){try{return JSON.parse(localStorage.getItem(choiceKey(provider)))||{};}catch{return {};}}
function writeAgentChoice(provider,choice){try{localStorage.setItem(choiceKey(provider),JSON.stringify(choice));}catch{/* Storage may be unavailable; the session still saves after a turn. */}}
const storage=()=>{try{return localStorage;}catch{return null;}};
const clock=ms=>{const s=Math.max(0,Math.floor(ms/1000));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;};

const SHEETS={conversation:'Conversation',bible:'World bible',references:'Mood board',scene:'World composition',activity:'Runtime observations',history:'World history',agent:'Agent connection',review:'Review proposal'};
const TALL=new Set(['references','scene','review']);

export function WorldApp(){
  const host=useWorld();return <WorldClientContext.Provider value={host.payload?.context}><WorldSession key={worldContextKey(host.payload?.context)} host={host}/></WorldClientContext.Provider>;
}
// Both camera controllers run before this marker; CoveEffects renders at priority 1.
function SessionFrame({contextKey,revision}){useFrame(()=>completeWorldFrame(probe,contextKey,revision),.5);return null;}
function WorldSession({host}){
  const {api}=useWorldClient(),loaded=useAssetBundle(host.payload),{agent,proposal}=host,drafts=useWorldDrafts(),contextKey=worldContextKey(host.payload?.context);
  useLayoutEffect(()=>resetWorldProbe(probe,contextKey),[contextKey]);
  const runtimeRef=useRef(null),worldRef=useRef(null),inhabitRef=useRef(false),composingRef=useRef(false),input=useRef();
  const [person,setPerson]=useState('first'),[draftFocus,setDraftFocus]=useState(null);
  const [cameraMode,setCameraMode]=useState('walk'),[paused,setPaused]=useState(false),[runtimeNotice,setRuntimeNotice]=useState(''),[runtimeObservation,setRuntimeObservation]=useState(null),[coherence,setCoherence]=useState(null);
  const [panel,setPanel]=useState(null),[tall,setTall]=useState(false),[cove,setCove]=useState(true),[homeTick,setHomeTick]=useState(0),[locked,setLocked]=useState(false),[moving,setMoving]=useState(false),[selected,setSelected]=useState(null),[aim,setAim]=useState(null),[text,setText]=useState(''),[model,setModel]=useState(''),[effort,setEffort]=useState(''),[busy,setBusy]=useState(false);
  const [inhabiting,setInhabiting]=useState(false),[composing,setComposing]=useState(false),[pointerHint,setPointerHint]=useState(''),[selectedRefs,setSelectedRefs]=useState([]),[selectionOpen,setSelectionOpen]=useState(false),[glanceOpen,setGlanceOpen]=useState(false);
  const [hudHidden,setHudHidden]=useState(false),toggleHud=useCallback(()=>setHudHidden(v=>!v),[]);
  const [preview,setPreview]=useState(true),[hotNotice,setHotNotice]=useState(''),[pageHidden,setPageHidden]=useState(()=>typeof document!=='undefined'&&document.hidden),[now,setNow]=useState(()=>Date.now());
  const toggleFree=useCallback(()=>{setCameraMode(m=>m==='free'?'walk':'free');document.activeElement?.blur();},[]);
  // Touch: a shared stick and pad for the controller, a View menu on phones, and
  // "Add more" standing in for Shift when tapping references.
  const touch=useMemo(createTouchInput,[]),touchMode=useTouchMode(),[viewMenu,setViewMenu]=useState(false),[addMore,setAddMore]=useState(false),addMoreRef=useRef(false);addMoreRef.current=addMore;
  useEffect(()=>{if(!viewMenu)return;const outside=e=>{if(!e.target.closest?.('.hd-view'))setViewMenu(false);};window.addEventListener('pointerdown',outside,true);return()=>window.removeEventListener('pointerdown',outside,true);},[viewMenu]);
  const world=loaded.bundle?.payload.world,accepted=host.payload?.world,worldId=host.payload?.context?.worldId;worldRef.current=world;inhabitRef.current=inhabiting;
  const runtime=useMemo(()=>{if(world?.schemaVersion!==2)return null;if(runtimeRef.current)runtimeRef.current.reconcile(world.scene);else runtimeRef.current=new WorldRuntime(world.scene);return runtimeRef.current;},[world]);
  if(runtime){runtime.originVisible=cove;runtime.paused=paused;}
  const endCompose=useCallback(()=>{composingRef.current=false;setComposing(false);},[]);
  const leaveWorld=useCallback(()=>{endCompose();setInhabiting(false);setLocked(false);setMoving(false);setSelectionOpen(false);document.exitPointerLock?.();document.activeElement?.blur();},[endCompose]);
  // While composing inside the world, losing the mouse lock is expected; only an
  // unexplained loss (Esc while walking) returns to making. Esc while making
  // folds the sheet instead.
  const lockLost=useCallback(()=>{if(composingRef.current)return;if(!inhabitRef.current){setPanel(null);setGlanceOpen(false);}leaveWorld();},[leaveWorld]);
  const focusInput=useCallback(()=>{
    if(inhabitRef.current){composingRef.current=true;setComposing(true);setHudHidden(false);}
    document.exitPointerLock?.();requestAnimationFrame(()=>input.current?.focus());
  },[]);
  const select=useCallback((id,{additive=false}={})=>{
    if(inhabitRef.current)return;additive||=addMoreRef.current;
    if(id==='moodboard'){setPanel('references');setTall(true);return;}
    if(!selectableItem(worldRef.current?.scene,id))return;
    setSelected(id);setSelectedRefs(old=>additive&&old.length>=16&&!old.some(r=>r.id===id)?old:toggleSelectedRef(old,{id,part:null},{additive}));setSelectionOpen(true);
  },[]);
  const interact=useCallback(id=>{
    const r=runtimeRef.current;if(!r)return;
    const query=r.interaction(id,probe.actorEye??probe.position);
    setRuntimeNotice(r.act(id,probe.actorEye??probe.position)?`${query.label.replace(/^(Open|Close|Start|Stop) /,'')} · ${query.action==='open'?'opening':query.action==='close'?'closing':query.action==='start'?'running':'stopped'}`:query.reason==='out-of-reach'?'Move closer to interact.':'This object has no available action.');
    setRuntimeObservation({backend:probe.backend,position:probe.position,activity:r.snapshot(),drawCalls:probe.drawCalls});
  },[]);
  const requestLook=useCallback(()=>{
    setPointerHint('');
    try{const canvas=document.querySelector('canvas');if(!canvas?.requestPointerLock){setPointerHint('Mouse lock unavailable here. Arrow keys or right-drag to look.');return;}canvas.requestPointerLock()?.catch(()=>setPointerHint('Mouse lock unavailable here. Arrow keys or right-drag to look.'));}
    catch{setPointerHint('Mouse lock unavailable here. Arrow keys or right-drag to look.');}
  },[]);
  // Enter counts as a gesture for the mouse lock; Esc does not, so after Esc the
  // lock hint asks for a click instead of reporting a failure.
  const resumeWalk=useCallback((look=false)=>{endCompose();input.current?.blur();if(look)requestLook();},[endCompose,requestLook]);
  useEffect(()=>{const failure=()=>setPointerHint('Mouse lock unavailable here. Arrow keys or right-drag to look.');document.addEventListener('pointerlockerror',failure);return()=>document.removeEventListener('pointerlockerror',failure);},[]);
  useEffect(()=>{const change=()=>setPageHidden(document.hidden);document.addEventListener('visibilitychange',change);return()=>document.removeEventListener('visibilitychange',change);},[]);
  useEffect(()=>{setRuntimeObservation(null);const timer=setInterval(()=>{if(!world||!canObserveWorld(probe,contextKey,world.revision))return;const recent=probe.frames.slice(-120).sort((a,b)=>a-b);setRuntimeObservation({backend:probe.backend,position:probe.position,activity:probe.runtime,actor:probe.actor,drawCalls:probe.drawCalls,triangles:probe.triangles,frameP95Ms:recent[Math.min(recent.length-1,Math.floor(recent.length*.95))]??null});},500);return()=>clearInterval(timer);},[contextKey,world?.revision]);
  useEffect(()=>{if(!runtimeNotice)return;const timer=setTimeout(()=>setRuntimeNotice(''),3500);return()=>clearTimeout(timer);},[runtimeNotice]);
  useEffect(()=>{if(world){setSelectedRefs(old=>pruneSelectedRefs(world.scene,old));if(selected&&!selectableItem(world.scene,selected))setSelected(null);}},[world,selected]);
  useEffect(()=>{if(!selectedRefs.length)setAddMore(false);},[selectedRefs.length]);
  // A new revision loads where you stand; say what arrived instead of moving you.
  const lastWorld=useRef(null);
  useEffect(()=>{
    const before=lastWorld.current;lastWorld.current=world;
    if(!world||!before||before.revision===world.revision)return;
    let chips=[];try{chips=proposalChips(diffProposal(before,world)).filter(c=>c!=='no differences');}catch{/* The notice is a courtesy; the world has already loaded. */}
    setHotNotice(`Revision ${world.revision} loaded where you are${chips.length?` · ${chips.slice(0,3).join(' · ')}`:''}`);
    const timer=setTimeout(()=>setHotNotice(''),4500);return()=>clearTimeout(timer);
  },[world]);
  // Host notices, such as a Kiln workspace upgraded on connect, use the same line.
  useEffect(()=>{if(!host.notice)return;setHotNotice(host.notice.text);const timer=setTimeout(()=>setHotNotice(''),6000);return()=>clearTimeout(timer);},[host.notice]);
  // The chosen model and effort survive reloads: this browser's last choice
  // first, then the session's saved values.
  const choiceProvider=useRef(null);
  useEffect(()=>{
    // A choice made for one provider never carries over to another.
    const changed=choiceProvider.current!==agent.provider;choiceProvider.current=agent.provider;
    const saved=readAgentChoice(agent.provider),listed=m=>agent.models?.some(x=>x.model===m);
    if(agent.provider==='cursor'||agent.provider==='claude')setModel(current=>!changed&&listed(current)?current:[saved.model,agent.model].find(listed)||agent.model||'agent');
    else if(changed||!model)setModel(saved.model||agent.model||'');
    if(changed)setEffort(saved.effort??agent.effort??'');
  },[agent.provider,agent.model,agent.models,model]);
  useEffect(()=>{if(agent.effort)setEffort(current=>current||agent.effort);},[agent.effort]);
  useEffect(()=>{if(agent.provider&&model)writeAgentChoice(agent.provider,{model,effort});},[agent.provider,model,effort]);
  // The last connected agent per world, so a restart offers one-click reconnect.
  const [remembered,setRemembered]=useState(()=>readLastAgent(storage(),worldId));
  useEffect(()=>{if(agent.connected&&agent.provider&&worldId){const value={provider:agent.provider,model,effort};writeLastAgent(storage(),worldId,value);setRemembered(value);}},[agent.connected,agent.provider,model,effort,worldId]);
  const voice=useVoice(t=>{setText(t);focusInput();});
  const aimObject=selectableItem(world?.scene,aim),interaction=cameraMode==='walk'?runtime?.interaction(aim,probe.actorEye??probe.position):null;
  const session=useMemo(()=>({world:world?.scene.environment.type==='woodland',clear:world?.scene.environment.clearPath,bridge:world?.scene.bridge,preview:null}),[world]);
  useEffect(()=>{probe.world=world;probe.loadedRevision=world?.revision;probe.assets=loaded.bundle?.payload.assets;probe.selected=selected;probe.cove=cove;probe.locked=locked;probe.session=session;},[world,loaded.bundle,selected,cove,locked,session]);
  useEffect(()=>{
    if(!world)return;const report=()=>{if(!canObserveWorld(probe,contextKey,world.revision))return;const sorted=[...probe.frames].sort((a,b)=>a-b);api('observation',{revision:world.revision,position:probe.position,selected,backend:probe.backend||'initializing',frameP95Ms:sorted[Math.floor(sorted.length*.95)]||null,firstFrameMs:probe.firstFrameMs??null,pageHidden:document.hidden,drawCalls:probe.drawCalls||0,triangles:probe.triangles||0,loadError:loaded.error||null,cameraMode:probe.cameraMode||'walk',activity:probe.runtime||null,actor:probe.actor||null,originVisible:cove}).catch(()=>{});};report();const timer=setInterval(report,2500);return()=>clearInterval(timer);
  },[world,selected,loaded.error,cove,contextKey,api]);
  // Proposed placements appear as ghosts in the world before Apply.
  const ghostPayload=useMemo(()=>proposal?.assets?{assets:proposal.assets}:null,[proposal]);
  const ghostBundle=useAssetBundle(ghostPayload);
  const ghost=useMemo(()=>proposal&&runtime?ghostPlacements(accepted,proposal.world):{items:[],total:0},[proposal,accepted,runtime]);
  useEffect(()=>{setPreview(true);},[proposal?.id]);
  const writeDisabled=!host.online||!!host.pendingSession;
  const run=async task=>{if(host.pendingSession){host.setError('Another tab changed worlds. Your local drafts remain here; copy or discard them before reconnecting.');return;}if(!host.online){host.setError('Reconnect to the local host before saving changes. Your drafts are preserved.');return;}setBusy(true);host.setError(null);try{return await task();}catch(e){host.setError(e.message);}finally{setBusy(false);}};
  function openPanel(name){const next=panel===name?null:name;setPanel(next);if(next)setTall(TALL.has(next));setSelectionOpen(false);if(next)setGlanceOpen(false);}
  function enterWorld(){setPanel(null);setCameraMode('walk');setInhabiting(true);setHudHidden(false);setGlanceOpen(false);setSelectionOpen(false);document.activeElement?.blur();if(!touchMode)requestLook();}
  const send=()=>{const message=text;if(inhabitRef.current)resumeWalk(true);return run(async()=>{await api('agent/turn',{text:message,model,effort:effort||null,selectedRefs});setText(current=>current===message?'':current);if(!inhabitRef.current&&panel!=='conversation')setGlanceOpen(true);});};
  useDraftUnloadGuard(drafts.dirty.length>0||!!text.trim());
  const hasDrafts=drafts.dirty.length>0||!!text.trim();
  host.draftGuard.current=()=>hasDrafts;
  const active=!!agent.turnId||['starting','connecting'].includes(agent.status)||!!agent.requests?.length,error=host.error||loaded.error||agent.error;
  // A fresh reply opens the glance once; folding it keeps it folded until the next one.
  const replies=(agent.messages||[]).filter(m=>m.role!=='user').length,seenReplies=useRef(replies);
  useEffect(()=>{if(replies>seenReplies.current&&!inhabitRef.current&&panel!=='conversation')setGlanceOpen(true);seenReplies.current=replies;},[replies]);
  const startedAt=useRef(null);
  useEffect(()=>{if(!active){startedAt.current=null;return;}startedAt.current??=Date.now();const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[active]);
  const presence=agentPresence(agent,{remembered});
  const forcedGL=new URLSearchParams(location.search).get('backend')==='webgl';
  const aimText=interaction?.action?(interaction.available?`${touchMode?'Tap':'E'} · ${interaction.label}`:`${aimObject?.label||aim} · move closer`):!inhabiting&&aimObject?`${aimObject.label||aim} · ${touchMode?'tap it to reference':'F to reference'}`:'';
  const resolveBlocker=blocker=>{if(blocker.location==='conversation')openPanel('conversation');else if(blocker.location==='message')focusInput();else{setDraftFocus({...blocker,serial:performance.now()});if(blocker.item)setSelected(blocker.item);setPanel(blocker.location);setTall(TALL.has(blocker.location));}};
  const canSend=!writeDisabled&&!!text.trim()&&!!model&&!active&&!busy;
  const placeholder=inhabiting?'Say something to your agent · Esc returns to walking':agent.connected?'Describe, ask, or change something…':'A thought for your world…';
  const walkHint=touchMode?(cameraMode==='free'?'Left thumb flies · drag to look · Up and Down rise and sink':'Left thumb moves, push to the edge to run · drag to look · Talk opens the composer'):cameraMode==='free'?'WASD fly · Q down / E up · Shift faster · G return · Enter to talk · H hide':runtime?.scene.runtime.possession?'WASD move · Space jump · Shift run · V view · G free camera · E interact · Enter to talk · H hide':'WASD move · E interact · G free camera · Enter to talk · H hide';
  const sheetOpen=!inhabiting&&panel&&accepted;
  // On phones each camera cluster folds into one View button; on wider screens the toggle is hidden.
  const closeViewMenu=e=>{if(e.target.closest('button'))setViewMenu(false);};
  const viewGroup=(group,hud=false)=><div className={`hd-view ${viewMenu?'open':''}`}><button className={`b sm hd-view-toggle ${hud?'hud':''}`} aria-expanded={viewMenu} aria-controls="hd-view-menu" onClick={()=>setViewMenu(v=>!v)}>View<Icon name={viewMenu?'up':'down'} size={14}/></button>{group}</div>;

  const dock=<section className={`hd-dock ${inhabiting?'is-compact':''}`} aria-label="Agent dock">
    {!inhabiting&&glanceOpen&&!panel&&<Glance agent={agent} onOpen={()=>openPanel('conversation')} onClose={()=>setGlanceOpen(false)}/>}
    {agent.requests?.length>0&&<DecisionSlot requests={agent.requests} run={run} writeDisabled={writeDisabled}/>}
    {proposal&&accepted&&<ProposalLine proposal={proposal} accepted={accepted} preview={preview} setPreview={setPreview} ghosted={ghost.items.length} onReview={()=>{if(inhabiting)leaveWorld();setPanel('review');setTall(true);}} onApply={()=>run(()=>api('proposal/apply',{id:proposal.id}))} onDiscard={()=>run(()=>api('proposal/discard',{id:proposal.id}))} disabled={writeDisabled} busy={busy}/>}
    {proposal&&preview&&ghost.total>ghost.items.length&&<span className="hd-meta hd-dock-note">Previewing {ghost.items.length} of {ghost.total} proposed placements.</span>}
    {!inhabiting&&selectionOpen&&selectedRefs.length>0&&world&&<SelectionPanel world={world} refs={selectedRefs} setRefs={setSelectedRefs} focusInput={focusInput} onArrange={id=>{setSelected(id);setPanel('scene');setTall(true);setSelectionOpen(false);}} onClose={()=>setSelectionOpen(false)}/>}
    {!inhabiting&&<ReferenceTray refs={selectedRefs} world={world} setRefs={setSelectedRefs} onOpen={()=>setSelectionOpen(v=>!v)} addMore={touchMode?addMore:undefined} setAddMore={setAddMore}/>}
    {(!inhabiting||composing||text.trim())&&<Composer inputRef={input} text={text} setText={setText} onSend={send} placeholder={placeholder} voice={voice} agent={agent} active={active} canSend={canSend} writeDisabled={writeDisabled}
      onEscape={inhabiting?()=>resumeWalk(false):()=>input.current?.blur()} onFocus={()=>{if(inhabitRef.current){composingRef.current=true;setComposing(true);}document.exitPointerLock?.();}} onBlur={()=>{if(inhabitRef.current)endCompose();}}
      onConnect={()=>openPanel('agent')} onStop={()=>run(()=>api('agent/stop',{}))}/>}
    <Presence presence={presence} elapsed={active&&startedAt.current?clock(now-startedAt.current):null} notice={hotNotice||(inhabiting&&runtimeNotice)} onReconnect={()=>run(()=>api('agent/connect',{provider:remembered.provider}))} writeDisabled={writeDisabled}>
      {inhabiting?<span className="hd-meta hd-hide-narrow">{composing?'Enter sends · Esc returns to walking':walkHint}</span>
        :<span className="hd-meta hd-hide-narrow">{voice.status||(touchMode?(cameraMode==='overview'?'Drag to orbit · pinch to zoom · tap to select':'Left thumb moves · drag to look · tap to select'):cameraMode==='free'?'WASD fly · Q/E down, up · G return':'Click to select · Shift adds · Enter to talk')}</span>}
    </Presence>
    {!inhabiting&&<Sections panel={panel} openPanel={openPanel} runtime={!!runtime}/>}
  </section>;

  return <main className={`live-world hd ${inhabiting?'is-inhabiting':''} ${inhabiting&&hudHidden?'hud-hidden':''} ${sheetOpen?'has-sheet':''}`}>
    <div className="scene"><Boundary><Canvas shadows dpr={[1,1.5]} camera={{position:[1.25,1.72,2.35],fov:63,near:.05,far:160}} gl={async props=>{const r=new WebGPURenderer({...props,forceWebGL:forcedGL,antialias:true});r.toneMapping=ACESFilmicToneMapping;r.toneMappingExposure=DEFAULT_EXPOSURE;r.info.autoReset=false;await r.init();enableParallelCompile(r);return r;}}><Suspense fallback={null}>{world&&(runtime?<RuntimeScene {...{runtime,cameraMode,cove,homeTick,setLocked,setMoving,setAim,select,focusInput,selected,inhabiting,interact,requestLook,toggleHud,toggleFree,person,setPerson,touch}} leaveWorld={lockLost} bundle={loaded.bundle}/>:<Scene {...{session,cove,homeTick,setLocked,setMoving,setAim,select,focusInput,selected}} bundle={loaded.bundle}/>)}{preview&&ghost.items.length>0&&ghostBundle.bundle&&<Ghosts items={ghost.items} models={ghostBundle.bundle.models}/>}{world&&<SessionFrame contextKey={contextKey} revision={world.revision}/>}<CoveEffects/></Suspense></Canvas></Boundary></div>
    <div className={`reticle ${aimText?'has-target':''}`}/><div className="aim-label">{aimText}</div>
    {inhabiting?<header className="hd-top is-inhabiting">
      <button className="b hud" onClick={leaveWorld}><Icon name="close" size={15}/>Return to making <kbd>Esc</kbd></button>
      {viewGroup(<div id="hd-view-menu" className="hd-cluster hud" role="group" aria-label="Camera mode" onClick={closeViewMenu}>
        {runtime?.scene.runtime.possession&&['first','third'].map(view=><button key={view} className="b sm" aria-pressed={cameraMode==='walk'&&person===view} onClick={()=>{setCameraMode('walk');setPerson(view);document.activeElement?.blur();}}>{view==='first'?'First person':'Third person'}</button>)}
        <button className="b sm" aria-pressed={cameraMode==='free'} onClick={toggleFree}>{cameraMode==='free'?'Return to inhabitant':'Free camera'} <kbd>G</kbd></button>
      </div>,true)}
    </header>:<header className="hd-top">
      <WorldPicker world={accepted} context={host.payload?.context} library={host.payload?.library} active={active} pendingProposal={!!proposal} busy={busy} loading={loaded.loading} online={host.online} drafts={drafts.dirty} message={text} onOpen={()=>setSelectionOpen(false)} onBusyChange={setBusy} request={api} onChanged={host.adoptSession} onResolve={resolveBlocker}/>
      {viewGroup(<div id="hd-view-menu" className="hd-cluster" role="group" aria-label="View" onClick={closeViewMenu}>
        <button className="b sm" aria-pressed={cameraMode==='overview'} onClick={()=>setCameraMode(m=>m==='overview'?'walk':'overview')}>{cameraMode==='overview'?'Ground view':'Overlook'}</button>
        {runtime&&<button className="b sm" aria-pressed={cameraMode==='free'} onClick={toggleFree}>Free camera <kbd>G</kbd></button>}
        <button className="b sm" onClick={()=>{setCameraMode('walk');setCove(true);setHomeTick(n=>n+1);}}>Arrival</button>
        <button className="b sm" aria-pressed={!cove} onClick={()=>setCove(v=>!v)}>{cove?'Hide cove':'Show cove'}</button>
      </div>)}
      {runtime&&<button className="b pri hd-enter" onClick={enterWorld}>Enter world <Icon name="enter" size={15}/></button>}
    </header>}
    {inhabiting&&!locked&&!composing&&(touchMode?<p className="hd-lock-hint is-touch">Left thumb moves · drag to look</p>:<p className="hd-lock-hint">{pointerHint||'Click the world to lock your mouse · arrow keys or right-drag to look'}</p>)}
    <TouchControls touch={touch} active={touchMode&&!!runtime&&!sheetOpen} mode={cameraMode} possessed={!!runtime?.scene.runtime.possession} interaction={interaction} onInteract={()=>interact(aim)} bottom={inhabiting?(hudHidden?24:composing?150:96):240}>
      {inhabiting&&!composing&&<button type="button" className="touch-button quiet" onClick={focusInput}>Talk</button>}
      {inhabiting&&<button type="button" className="touch-button quiet" aria-pressed={hudHidden} onClick={toggleHud}>{hudHidden?'Show controls':'Clear view'}</button>}
    </TouchControls>
    {host.pendingSession&&<section className="hd-card hd-session-notice" role="alert"><strong>Another tab changed worlds.</strong><p>Your unsaved drafts are preserved here. Copy anything you want to keep; this session can no longer save changes.</p><button className="b" onClick={()=>host.reconnect({discardDrafts:true})}>Discard local drafts &amp; open {host.pendingSession.world.bible.title}</button></section>}
    <div className="hd-stack">
      {sheetOpen&&<section className={`hd-sheet ${tall?'is-tall':''} ${panel==='references'?'is-board':''}`} aria-label={SHEETS[panel]}>
        <header className="hd-sheet-head">
          <strong className="hd-sheet-title">{SHEETS[panel]}</strong>
          {panel==='review'&&proposal&&<span className="hd-meta">{proposal.summary}</span>}
          <span className="hd-end"/>
          <button className="b sm q" aria-label={tall?'Shorter sheet':'Taller sheet'} onClick={()=>setTall(v=>!v)}><Icon name={tall?'down':'up'} size={15}/>{tall?'Half':'Tall'}</button>
          <button className="b sm q i" aria-label="Close panel" onClick={()=>setPanel(null)}><Icon name="close" size={16}/></button>
        </header>
        <div className="hd-sheet-body">
          {writeDisabled&&!host.pendingSession&&<p className="hd-notice" role="status">Reconnecting to the local host. Saving is unavailable; your drafts are preserved.</p>}
          {panel==='conversation'?<Conversation agent={agent} active={active} error={error} onDismissError={()=>host.setError(null)}/>
          :panel==='bible'?<BibleEditor world={accepted} run={run} drafts={drafts.registry} writeDisabled={writeDisabled}/>
          :panel==='scene'?<WorldEditor world={accepted} run={run} selected={selected} setSelected={setSelected} runtime={runtime} drafts={drafts.registry} draftFocus={draftFocus} writeDisabled={writeDisabled} assets={loaded.bundle?.payload.assets} busy={busy} onReference={id=>select(id,{additive:true})}/>
          :panel==='references'?<MoodBoardEditor world={accepted} run={run} agent={agent} model={model} effort={effort} drafts={drafts.registry} draftFocus={draftFocus} writeDisabled={writeDisabled}/>
          :panel==='activity'&&runtime&&world?<ObservePanel {...{runtime,world,cameraMode,locked,paused,setPaused,selected,setSelected,cove,interact,coherence,setCoherence,run,writeDisabled,pageHidden}} observation={runtimeObservation} notice={runtimeNotice} setNotice={setRuntimeNotice}/>
          :panel==='history'?<HistoryPanel world={accepted} run={run} busy={busy} active={active} writeDisabled={writeDisabled} initiallyOpen/>
          :panel==='review'?(proposal?<><ProposalReview accepted={accepted} proposal={proposal}/><div className="hd-row hd-sheet-actions"><button className="b pri" aria-label="Apply proposal" disabled={writeDisabled||busy||proposal.baseRevision!==accepted.revision} onClick={()=>run(async()=>{await api('proposal/apply',{id:proposal.id});setPanel(null);})}>Apply</button><button className="b q" disabled={writeDisabled} onClick={()=>run(async()=>{await api('proposal/discard',{id:proposal.id});setPanel(null);})}>Discard</button>{proposal.baseRevision!==accepted.revision&&<span className="hd-meta">This proposal was made against revision {proposal.baseRevision}; the world is now at {accepted.revision}. Ask for a fresh proposal.</span>}</div></>:<p className="hd-empty">No proposal is waiting. New proposals appear in the dock.</p>)
          :<AgentSettings {...{agent,run,model,setModel,effort,setEffort,writeDisabled,remembered}} workspace={host.payload.workspace}/>}
        </div>
      </section>}
      {error&&!(sheetOpen&&panel==='conversation')&&!inhabiting&&<div className="hd-card hd-alert" role="alert"><p>{error}</p><button className="b sm q" onClick={()=>host.setError(null)}>Dismiss</button></div>}
      {dock}
    </div>
  </main>;
}
