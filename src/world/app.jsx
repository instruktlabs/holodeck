import React, { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas,useFrame } from '@react-three/fiber';
import { ACESFilmicToneMapping, WebGPURenderer } from 'three/webgpu';
import { Scene, probe } from '../prototype/scene.jsx';
import { useVoice } from '../prototype/voice.js';
import {useAssetBundle,useWorld,useWorldClient,WorldClientContext} from './client.js';
import {worldContextKey} from './world-client.mjs';
import {resetWorldProbe,completeWorldFrame,canObserveWorld} from './world-probe.mjs';
import {useWorldDrafts,useEditorDraft,useDraftUnloadGuard} from './world-drafts.jsx';
import {WorldPicker} from './world-picker.jsx';
import './style.css';
import {inlineSpans,messageBlocks} from './message-format.mjs';
import { MoodBoardEditor,referenceUrl } from './moodboard.jsx';
import {CoveEffects} from './effects.jsx';
import {WorldRuntime} from './runtime.mjs';
import {RuntimeScene} from './runtime-scene.jsx';
import {toggleSelectedRef,pruneSelectedRefs} from './selection.mjs';
import {SelectionPanel} from './selection-panel.jsx';
import {HistoryPanel} from './history-panel.jsx';

class Boundary extends React.Component{
  state={error:null};static getDerivedStateFromError(error){return {error};}
  render(){return this.state.error?<div className="render-error"><h2>Unable to render this world.</h2><p>{this.state.error.message}</p><a href="?backend=webgl">Try WebGL2</a></div>:this.props.children;}
}
function BibleEditor({world,run,drafts,writeDisabled}){
  const {api,url:scopedUrl}=useWorldClient();
  const {draft,base,dirty,change:edit,saved:markSaved,reset}=useEditorDraft(drafts,'bible',world.bible,world.revision,{label:'bible',panel:'bible'}),[saved,setSaved]=useState(false);
  const change=(key,value)=>{setSaved(false);edit(d=>({...d,[key]:value}));};
  return <form onSubmit={e=>{e.preventDefault();run(async()=>{await api('world',{baseRevision:base,bible:draft});markSaved();setSaved(true);});}}>
    <p>Shared intentions for the world. You and your agent edit the same document.</p>
    <label>World name<input value={draft.title} maxLength={120} onChange={e=>change('title',e.target.value)}/></label>
    <label>Visual direction<textarea rows={5} value={draft.intent} maxLength={8000} onChange={e=>change('intent',e.target.value)}/></label>
    <label>Rules of this place<textarea rows={7} value={draft.rules} maxLength={8000} onChange={e=>change('rules',e.target.value)}/></label>
    {dirty&&base!==world.revision&&<p className="notice">The world changed while you were editing. Your draft is preserved; reload before saving.</p>}
    <div className="button-row"><button className="primary" disabled={writeDisabled||!dirty||base!==world.revision}>Save bible</button><button type="button" onClick={reset}>Discard bible draft</button></div>
    <small role="status">{dirty?'Unsaved draft':saved?'Bible saved to disk.':`Saved · revision ${world.revision}`}</small>
    <h3>Pinned visual direction</h3>{(world.references||[]).filter(r=>world.bible.referenceIds?.includes(r.id)).map(r=><figure key={r.id}>{(!r.kind||r.kind==="image")?<img src={referenceUrl(r,scopedUrl)} alt={r.title}/>:<p>{r.kind==="file"?"Linked file":"Note"}</p>}<figcaption>{r.title} · {r.notes}</figcaption></figure>)}
  </form>;
}
function PlacementEditor({world,item,run,drafts,removed=false,writeDisabled}){
  const {api}=useWorldClient();
  const {draft,base,dirty,change:edit,saved:markSaved,reset}=useEditorDraft(drafts,`placement/${item.id}`,item,world.revision,{label:`${item.id} placement`,panel:'scene',item:item.id});
  const change=(field,i,value)=>edit(d=>({...d,[field]:d[field].map((n,j)=>j===i?Number(value):n)}));
  return <details open><summary>Place {item.id}</summary>{removed&&<p className="notice">This object was removed in a newer revision. Copy your placement values if needed, then discard this draft.</p>}{['position','rotation','scale'].map(field=><div key={field}><small>{field}{field==='rotation'?' (radians)':''}</small><div className="vector-fields">{['X','Y','Z'].map((axis,i)=><label key={axis}>{axis}<input aria-label={`${field} ${axis}`} type="number" step="0.1" value={draft[field][i]} onChange={e=>change(field,i,e.target.value)}/></label>)}</div></div>)}<button disabled={writeDisabled||removed||!dirty||base!==world.revision} onClick={()=>run(async()=>{await api('world',{baseRevision:base,scene:{...world.scene,objects:world.scene.objects.map(o=>o.id===item.id?draft:o)}});markSaved();})}>Save placement</button><button disabled={!dirty} onClick={reset}>Discard placement draft</button>{dirty&&base!==world.revision&&<p className="notice">World changed. Reselect the module before saving.</p>}<small>Asset geometry stays separate. Its collider and local light follow this placement.</small></details>;
}
function SceneEditor({world,run,selected,runtime,drafts,draftFocus,writeDisabled}){
  const {api,fetch:worldFetch}=useWorldClient();
  const [editing,setEditing]=useState(selected||'');
  useEffect(()=>{if(selected)setEditing(selected);},[selected]);
  useEffect(()=>{if(draftFocus?.item)setEditing(draftFocus.item);},[draftFocus]);
  const placed=world.scene.objects.find(o=>o.id===editing),orphan=drafts.getSnapshot()[`placement/${editing}`],placement=placed??(orphan?.dirty?orphan.value:null);
  const savedSource=useMemo(()=>JSON.stringify(world.scene,null,2),[world.scene]);
  const {draft:source,base,dirty,change:setSource,saved:markSaved,reset}=useEditorDraft(drafts,'scene',savedSource,world.revision,{label:'scene document',panel:'scene'});
  async function preset(type){await api('world',{baseRevision:world.revision,scene:{...world.scene,environment:{...world.scene.environment,type},bridge:type==='woodland'?world.scene.bridge:null}});}
  async function upload(file){
    if(!file)return;const r=await worldFetch(`/api/import?name=${encodeURIComponent(file.name)}`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});const asset=await r.json();if(!r.ok)throw new Error(asset.error);
    const yaw=probe.look?.yaw||0,p=(probe.cameraMode==='walk'?probe.actorEye:null)??probe.position??[0,1.72,0],id=`placed-${crypto.randomUUID().slice(0,8)}`,x=p[0]-Math.sin(yaw)*4,z=p[2]-Math.cos(yaw)*4;
    const y=runtime?.terrain?.sample(x,z).height??0;
    await api('world',{baseRevision:world.revision,scene:{...world.scene,assets:[...world.scene.assets.filter(a=>a.id!==asset.id),asset],objects:[...world.scene.objects,{id,asset:asset.id,position:[x,y,z],rotation:[0,0,0],scale:[1,1,1],collider:null}]}});
  }
  return <>
    <p>Load an environment around the cove, then place your Kiln exports. Changes are saved to this world.</p>
    <label>Environment<select disabled={writeDisabled} aria-label="Environment" value={world.scene.environment.type} onChange={e=>run(()=>preset(e.target.value))}><option value="construct">Empty construct</option><option value="meadow">Open meadow</option>{world.schemaVersion===1&&<option value="woodland">Woodland & stream</option>}</select></label>
    <label className="upload">Add a Kiln GLB<input disabled={writeDisabled} type="file" accept=".glb" onChange={e=>{const file=e.target.files[0];e.target.value='';run(()=>upload(file));}}/></label>
    <small>Places a self-contained GLB four metres ahead. Use the scene document below to adjust its transform and add a box collider.</small>
    <p>{world.scene.objects.length} placed objects{selected?` · selected: ${selected}`:''}</p>
    <label>Arrange a module<select aria-label="Arrange a module" value={editing} onChange={e=>setEditing(e.target.value)}><option value="">Choose a module</option>{world.scene.objects.map(o=><option key={o.id}>{o.id}</option>)}</select></label>
    {placement&&<PlacementEditor key={editing} world={world} item={placement} run={run} drafts={drafts} removed={!placed} writeDisabled={writeDisabled}/>}
    {world.scene.objects.map(o=><div className="asset-row" key={o.id}><span>{o.id}<small>{o.asset}</small></span><button disabled={writeDisabled} aria-label={`Remove ${o.id}`} onClick={()=>run(()=>api('world',{baseRevision:world.revision,scene:{...world.scene,objects:world.scene.objects.filter(x=>x.id!==o.id)}}))}>Remove</button></div>)}
    <details open={draftFocus?.id==='scene'?true:undefined}><summary>Edit scene document</summary><p>Transforms use metres and radians. Optional collider: {`{"type":"box","size":[1,1,1],"offset":[0,0.5,0]}`}</p><textarea className="code-editor" aria-label="Scene document" rows={18} value={source} onChange={e=>{setSource(e.target.value);}}/>
      {dirty&&base!==world.revision&&<p className="notice">A newer revision exists. Reload before saving; your draft is still here.</p>}
      <div className="button-row"><button disabled={writeDisabled||!dirty||base!==world.revision} onClick={()=>run(async()=>{await api('world',{baseRevision:base,scene:JSON.parse(source)});markSaved();})}>Save scene</button><button onClick={reset}>Discard scene draft</button></div>
    </details>
  </>;
}
const Inline=({text})=>inlineSpans(text).map((s,i)=>s.strong?<strong key={i}>{s.text}</strong>:s.code?<code key={i}>{s.text}</code>:<React.Fragment key={i}>{s.text}</React.Fragment>);
function AgentText({text}){
  return <div className="message-text agent-text">{messageBlocks(text).map((b,i)=>b.type==='heading'?<h4 key={i}><Inline text={b.text}/></h4>:b.type==='list'?React.createElement(b.ordered?'ol':'ul',{key:i},b.items.map((item,j)=><li key={j}><Inline text={item}/></li>)):b.type==='table'?<div key={i} className="message-table"><table><thead><tr>{b.head.map((h,j)=><th key={j}><Inline text={h}/></th>)}</tr></thead><tbody>{b.rows.map((r,j)=><tr key={j}>{r.map((c,k)=><td key={k}><Inline text={c}/></td>)}</tr>)}</tbody></table></div>:<p key={i}><Inline text={b.text}/></p>)}</div>;
}
const choiceKey=provider=>`holodeck.agent-choice.${provider||'codex'}`;
function readAgentChoice(provider){try{return JSON.parse(localStorage.getItem(choiceKey(provider)))||{};}catch{return {};}}
function writeAgentChoice(provider,choice){try{localStorage.setItem(choiceKey(provider),JSON.stringify(choice));}catch{/* Storage may be unavailable; the session still saves after a turn. */}}
function AgentSettings({agent,run,model,setModel,effort,setEffort,workspace,writeDisabled}){
  const {api}=useWorldClient();
  const provider=agent.provider||'codex',cursor=provider==='cursor';
  const [login,setLogin]=useState(null),[choice,setChoice]=useState(provider),chosen=agent.models?.find(m=>m.model===model);
  useEffect(()=>{if(agent.connected)setChoice(provider);},[agent.connected,provider]);
  const selected=choice==='cursor',claude=choice==='claude';
  const modeChoices=selected&&cursor?agent.models:selected?[{id:'agent',model:'agent',displayName:'Agent'},{id:'plan',model:'plan',displayName:'Plan'},{id:'ask',model:'ask',displayName:'Ask'}]:claude&&provider!=='claude'?[]:agent.models;
  return <>
    <p>{selected?'Connect the Cursor CLI in this world. Sign-in, billing and credentials stay inside Cursor. Holodeck does not read them. Image generation stays on Codex.':claude?'Runs your installed Claude Code CLI in this world with your own Claude subscription sign-in. Sign-in, billing and credentials stay inside Claude Code; Holodeck only checks its sign-in status. To sign in, run claude in a terminal. Image generation stays on Codex.':'Connect your local Codex CLI. Each message uses your signed-in ChatGPT plan. Holodeck does not read or copy its credentials.'}</p>
    <div className="button-row provider-choice" role="group" aria-label="Agent provider"><button type="button" aria-pressed={choice==='codex'} disabled={writeDisabled} onClick={()=>setChoice('codex')}>Codex</button><button type="button" aria-pressed={selected} disabled={writeDisabled} onClick={()=>setChoice('cursor')}>Cursor</button><button type="button" aria-pressed={claude} disabled={writeDisabled} onClick={()=>setChoice('claude')}>Claude Code</button></div>
    <button className="primary" disabled={writeDisabled} onClick={()=>run(()=>api('agent/connect',{provider:choice}))}>{agent.connected&&provider===choice?'Refresh connection':`Connect ${selected?'Cursor':claude?'Claude Code':'Codex'}`}</button>
    {cursor&&agent.connected?<p>Cursor session. Login and billing stay in Cursor.</p>:provider==='claude'&&agent.connected?<p>Claude Code · {agent.account?.authMethod} · {agent.account?.subscriptionType||'subscription'}. Sign-in and billing stay in Claude Code.</p>:<p>{agent.connected?agent.account?.type==='chatgpt'?`ChatGPT · ${agent.account.planType||'plan connected'}`:'Codex is running; ChatGPT sign-in is needed.':'No agent process connected.'}</p>}
    {provider==='codex'&&agent.connected&&agent.account?.type!=='chatgpt'&&<button disabled={writeDisabled} onClick={()=>run(async()=>setLogin(await api('agent/login',{})))}>Sign in with ChatGPT</button>}
    {login?.authUrl&&<p><a href={login.authUrl} target="_blank" rel="noreferrer">Continue sign-in in your browser ↗</a></p>}
    <label>{selected?'Mode':'Model'}<select aria-label={selected?'Cursor mode':claude?'Claude model':'Codex model'} value={model||''} onChange={e=>{setModel(e.target.value);setEffort('');}}><option value="">{selected?'Choose a mode':'Choose a model'}</option>{modeChoices?.map(m=><option key={m.id||m.model} value={m.model}>{m.displayName||m.model}</option>)}</select></label>
    {!selected&&<label>Reasoning<select aria-label="Reasoning effort" value={effort} onChange={e=>setEffort(e.target.value)}><option value="">Model default</option>{chosen?.supportedReasoningEfforts?.map(e=><option key={e.reasoningEffort}>{e.reasoningEffort}</option>)}</select></label>}
    <small>{selected?'Cursor permissions, questions and plans appear in the conversation. Scene changes still wait for your review.':claude?'Claude Code permission requests appear in the conversation. Holodeck world tools run without prompts; scene changes still wait for your review.':'Model availability is confirmed when a turn succeeds. Native commands use workspace-write sandboxing and approval requests; scene tools stage changes for review.'}</small>
    {provider==='claude'&&agent.resolvedModel&&<small>Last turn ran on <b>{agent.resolvedModel}</b>{agent.effort?` · ${agent.effort} effort`:' · default effort'}.</small>}
    {provider==='claude'&&agent.sessionTools?.length>0&&<small>Allowed for this session: {agent.sessionTools.map(t=>t==='edit:assets/source'?'edits in assets/source':t.replace(/^mcp__kiln_workspace__/,'')).join(', ')}.</small>}
    <p className="workspace-path">{workspace}</p><small>{selected||claude?'Session':'Thread'}: {agent.threadId||'created on your first message'}</small>
  </>;
}
function PendingRequest({request,run,writeDisabled}){
  const {api}=useWorldClient();
  const [answers,setAnswers]=useState({});const questions=request.params.questions,options=request.params.options;
  const choose=(id,value,multiple)=>{setAnswers(a=>{if(!multiple)return {...a,[id]:value};const current=Array.isArray(a[id])?a[id]:[];return {...a,[id]:current.includes(value)?current.filter(item=>item!==value):[...current,value]};});};
  // A new request can arrive below a long message; bring its buttons into view.
  const card=useRef();useEffect(()=>{card.current?.scrollIntoView({block:'nearest',behavior:'smooth'});},[request.id]);
  if(request.kind==='plan')return <article ref={card} className="agent-card glass request-card"><span className="eyebrow">CURSOR PLAN</span><p>{request.params.reason}</p>{request.params.overview&&<p>{request.params.overview}</p>}<pre>{request.params.command}</pre>{!!request.params.todos?.length&&<ul>{request.params.todos.map(todo=><li key={todo.id}>{todo.status}: {todo.content}</li>)}</ul>}<div className="button-row"><button className="primary" disabled={writeDisabled} onClick={()=>run(()=>api('agent/answer',{id:request.id,decision:'accept'}))}>Accept plan</button><button disabled={writeDisabled} onClick={()=>run(()=>api('agent/answer',{id:request.id,decision:'decline'}))}>Decline</button></div></article>;
  return <article ref={card} className="agent-card glass request-card"><span className="eyebrow">{questions?'YOUR INPUT':{cursor:'CURSOR PERMISSION',claude:'CLAUDE CODE PERMISSION'}[request.provider]||'CODEX PERMISSION'}</span>
    {questions?<>{request.params.title&&<p>{request.params.title}</p>}{questions.map(q=><fieldset key={q.id}><legend>{q.question}</legend>{q.options?.length?q.options.map(option=><label key={option.id} className="image-checkbox"><input type={q.allowMultiple?'checkbox':'radio'} name={q.id} checked={q.allowMultiple?Array.isArray(answers[q.id])&&answers[q.id].includes(option.id):answers[q.id]===option.id} onChange={()=>choose(q.id,option.id,q.allowMultiple)}/>{option.label}</label>):<input aria-label={q.question} value={answers[q.id]||''} onChange={e=>setAnswers(a=>({...a,[q.id]:e.target.value}))}/>}</fieldset>)}</>:<><p>{request.params.reason||'The agent requests permission for this operation.'}</p><pre>{request.params.command||JSON.stringify(request.params.changes||{},null,2)}</pre><small>{request.params.cwd}</small></>}
    <div className="button-row">{questions?<button disabled={writeDisabled} onClick={()=>run(()=>api('agent/answer',{id:request.id,answers}))}>Reply</button>:options?.length?options.map(option=><button key={option.optionId} disabled={writeDisabled} onClick={()=>run(()=>api('agent/answer',{id:request.id,decision:option.optionId}))}>{option.label||option.optionId}</button>):<><button disabled={writeDisabled} onClick={()=>run(()=>api('agent/answer',{id:request.id,decision:'accept'}))}>Allow once</button><button disabled={writeDisabled} onClick={()=>run(()=>api('agent/answer',{id:request.id,decision:'decline'}))}>Decline</button></>}</div>
  </article>;
}
export function WorldApp(){
  const host=useWorld();return <WorldClientContext.Provider value={host.payload?.context}><WorldSession key={worldContextKey(host.payload?.context)} host={host}/></WorldClientContext.Provider>;
}
// Both camera controllers run before this marker; CoveEffects renders at priority 1.
function SessionFrame({contextKey,revision}){useFrame(()=>completeWorldFrame(probe,contextKey,revision),.5);return null;}
function WorldSession({host}){
  const {api}=useWorldClient(),loaded=useAssetBundle(host.payload),{agent,proposal}=host,drafts=useWorldDrafts(),contextKey=worldContextKey(host.payload?.context);
  useLayoutEffect(()=>resetWorldProbe(probe,contextKey),[contextKey]);
  const runtimeRef=useRef(null),worldRef=useRef(null),inhabitRef=useRef(false),input=useRef();
  const [person,setPerson]=useState('first'),[draftFocus,setDraftFocus]=useState(null);
  const [cameraMode,setCameraMode]=useState('walk'),[paused,setPaused]=useState(false),[runtimeNotice,setRuntimeNotice]=useState(''),[runtimeObservation,setRuntimeObservation]=useState(null),[coherence,setCoherence]=useState(null);
  const [panel,setPanel]=useState(null),[cove,setCove]=useState(true),[homeTick,setHomeTick]=useState(0),[locked,setLocked]=useState(false),[moving,setMoving]=useState(false),[selected,setSelected]=useState(null),[aim,setAim]=useState(null),[text,setText]=useState(''),[model,setModel]=useState(''),[effort,setEffort]=useState(''),[busy,setBusy]=useState(false);
  const [inhabiting,setInhabiting]=useState(false),[pointerHint,setPointerHint]=useState(''),[selectedRefs,setSelectedRefs]=useState([]),[selectionOpen,setSelectionOpen]=useState(false),[chatOpen,setChatOpen]=useState(false);
  const [hudHidden,setHudHidden]=useState(false),toggleHud=useCallback(()=>setHudHidden(v=>!v),[]);
  const toggleFree=useCallback(()=>{setCameraMode(m=>m==='free'?'walk':'free');document.activeElement?.blur();},[]);
  const world=loaded.bundle?.payload.world,accepted=host.payload?.world;worldRef.current=world;inhabitRef.current=inhabiting;
  const runtime=useMemo(()=>{if(world?.schemaVersion!==2)return null;if(runtimeRef.current)runtimeRef.current.reconcile(world.scene);else runtimeRef.current=new WorldRuntime(world.scene);return runtimeRef.current;},[world]);
  if(runtime){runtime.originVisible=cove;runtime.paused=paused;}
  const leaveWorld=useCallback(()=>{setInhabiting(false);setLocked(false);setMoving(false);setPanel(null);setSelectionOpen(false);document.exitPointerLock?.();document.activeElement?.blur();},[]);
  const focusInput=useCallback(()=>{leaveWorld();requestAnimationFrame(()=>input.current?.focus());},[leaveWorld]);
  const select=useCallback((id,{additive=false}={})=>{
    if(inhabitRef.current)return;
    if(id==='moodboard'){leaveWorld();setPanel('references');return;}
    if(!worldRef.current?.scene.objects.some(o=>o.id===id))return;
    setSelected(id);setSelectedRefs(old=>additive&&old.length>=16&&!old.some(r=>r.id===id)?old:toggleSelectedRef(old,{id,part:null},{additive}));setSelectionOpen(true);setPanel(null);
  },[leaveWorld]);
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
  useEffect(()=>{const failure=()=>setPointerHint('Mouse lock unavailable here. Arrow keys or right-drag to look.');document.addEventListener('pointerlockerror',failure);return()=>document.removeEventListener('pointerlockerror',failure);},[]);
  useEffect(()=>{setRuntimeObservation(null);const timer=setInterval(()=>{if(!world||!canObserveWorld(probe,contextKey,world.revision))return;const recent=probe.frames.slice(-120).sort((a,b)=>a-b);setRuntimeObservation({backend:probe.backend,position:probe.position,activity:probe.runtime,actor:probe.actor,drawCalls:probe.drawCalls,triangles:probe.triangles,frameP95Ms:recent[Math.min(recent.length-1,Math.floor(recent.length*.95))]??null});},500);return()=>clearInterval(timer);},[contextKey,world?.revision]);
  useEffect(()=>{if(!runtimeNotice)return;const timer=setTimeout(()=>setRuntimeNotice(''),3500);return()=>clearTimeout(timer);},[runtimeNotice]);
  useEffect(()=>{if(world){setSelectedRefs(old=>pruneSelectedRefs(world.scene,old));if(selected&&!world.scene.objects.some(o=>o.id===selected))setSelected(null);}},[world,selected]);
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
  const voice=useVoice(t=>{setText(t);focusInput();});
  const selectedObject=world?.scene.objects.find(o=>o.id===selected),aimObject=world?.scene.objects.find(o=>o.id===aim),interaction=cameraMode==='walk'?runtime?.interaction(aim,probe.actorEye??probe.position):null;
  const session=useMemo(()=>({world:world?.scene.environment.type==='woodland',clear:world?.scene.environment.clearPath,bridge:world?.scene.bridge,preview:null}),[world]);
  useEffect(()=>{probe.world=world;probe.loadedRevision=world?.revision;probe.assets=loaded.bundle?.payload.assets;probe.selected=selected;probe.cove=cove;probe.locked=locked;probe.session=session;},[world,loaded.bundle,selected,cove,locked,session]);
  useEffect(()=>{
    if(!world)return;const report=()=>{if(!canObserveWorld(probe,contextKey,world.revision))return;const sorted=[...probe.frames].sort((a,b)=>a-b);api('observation',{revision:world.revision,position:probe.position,selected,backend:probe.backend||'initializing',frameP95Ms:sorted[Math.floor(sorted.length*.95)]||null,drawCalls:probe.drawCalls||0,triangles:probe.triangles||0,loadError:loaded.error||null,cameraMode:probe.cameraMode||'walk',activity:probe.runtime||null,actor:probe.actor||null,originVisible:cove}).catch(()=>{});};report();const timer=setInterval(report,2500);return()=>clearInterval(timer);
  },[world,selected,loaded.error,cove,contextKey,api]);
  const writeDisabled=!host.online||!!host.pendingSession;
  const run=async task=>{if(host.pendingSession){host.setError('Another tab changed worlds. Your local drafts remain here; copy or discard them before reconnecting.');return;}if(!host.online){host.setError('Reconnect to the local host before saving changes. Your drafts are preserved.');return;}setBusy(true);host.setError(null);try{return await task();}catch(e){host.setError(e.message);}finally{setBusy(false);}};
  function openPanel(name){const next=panel===name?null:name;leaveWorld();setPanel(next);setSelectionOpen(false);}
  function enterWorld(){setPanel(null);setCameraMode('walk');setInhabiting(true);setHudHidden(false);setChatOpen(false);document.activeElement?.blur();requestLook();}
  const send=()=>run(async()=>{await api('agent/turn',{text,model,effort:effort||null,selectedRefs});setText(current=>current===text?'':current);setChatOpen(true);});
  useDraftUnloadGuard(drafts.dirty.length>0||!!text.trim());
  const hasDrafts=drafts.dirty.length>0||!!text.trim();
  host.draftGuard.current=()=>hasDrafts;
  const active=!!agent.turnId||['starting','connecting'].includes(agent.status)||!!agent.requests?.length,error=host.error||loaded.error||agent.error;
  const showConversation=chatOpen||active||proposal||agent.requests?.length||error;
  const forcedGL=new URLSearchParams(location.search).get('backend')==='webgl';
  const aimText=interaction?.action?(interaction.available?`E · ${interaction.label}`:`${aimObject?.label||aim} · move closer`):!inhabiting&&aimObject?`${aimObject.label||aim} · F to reference`:'';
  return <main className={`live-world zen-workspace ${inhabiting?'is-inhabiting':''} ${inhabiting&&hudHidden?'hud-hidden':''}`}>
    <div className="scene"><Boundary><Canvas shadows dpr={[1,1.5]} camera={{position:[1.25,1.72,2.35],fov:63,near:.05,far:160}} gl={async props=>{const r=new WebGPURenderer({...props,forceWebGL:forcedGL,antialias:true});r.toneMapping=ACESFilmicToneMapping;r.toneMappingExposure=1.12;r.info.autoReset=false;await r.init();return r;}}><Suspense fallback={null}>{world&&(runtime?<RuntimeScene {...{runtime,cameraMode,cove,homeTick,setLocked,setMoving,setAim,select,focusInput,selected,inhabiting,leaveWorld,interact,requestLook,toggleHud,toggleFree,person,setPerson}} bundle={loaded.bundle}/>:<Scene {...{session,cove,homeTick,setLocked,setMoving,setAim,select,focusInput,selected}} bundle={loaded.bundle}/>)}{world&&<SessionFrame contextKey={contextKey} revision={world.revision}/>}<CoveEffects/></Suspense></Canvas></Boundary></div>
    <div className={`reticle ${aimText?'has-target':''}`}/><div className="aim-label">{aimText}</div>
    {inhabiting?<>
      <button className="exit-world" onClick={leaveWorld}>Return to making <kbd>Esc</kbd></button><div className="person-camera camera-controls glass" role="group" aria-label="Camera mode">
       {runtime?.scene.runtime.possession&&<>{['first','third'].map(view=><button key={view} aria-pressed={cameraMode==='walk'&&person===view} onClick={()=>{setCameraMode('walk');setPerson(view);document.activeElement?.blur();}}>{view==='first'?'First person':'Third person'}</button>)}</>}
       <button aria-pressed={cameraMode==='free'} onClick={toggleFree}>{cameraMode==='free'?'Return to inhabitant':'Free camera'} <kbd>G</kbd></button>
      </div>
      <div className="inhabit-hint"><span>{runtimeNotice||(cameraMode==='free'?'WASD fly · Q down / E up · Shift faster · G return · Enter to talk · H hide hints':runtime?.scene.runtime.possession?'WASD move · Space jump · Shift run · V view · G free camera · E interact · Enter to talk':'WASD move · E interact · G free camera · Enter to talk · H hide hints')}</span>{!locked&&<small>{pointerHint||'Click to lock your mouse · arrow keys or right-drag to look'}</small>}</div>
    </>:<>
      <header className="topbar"><div className="identity glass"><span className="kiln-mark">◒</span><span className="brand">holodeck</span><i/><span className="mode">making</span></div><WorldPicker world={accepted} context={host.payload?.context} library={host.payload?.library} active={active} pendingProposal={!!proposal} busy={busy} loading={loaded.loading} online={host.online} drafts={drafts.dirty} message={text} onOpen={leaveWorld} onBusyChange={setBusy} request={api} onChanged={host.adoptSession} onResolve={blocker=>{if(blocker.location==='conversation'){setChatOpen(true);setPanel(null);}else if(blocker.location==='message')focusInput();else{setDraftFocus({...blocker,serial:performance.now()});if(blocker.item)setSelected(blocker.item);setPanel(blocker.location);}}}/><div className="top-actions"><button className="glass" onClick={()=>setCove(v=>!v)}>{cove?'Hide cove':'Show cove'}</button>{runtime&&<button className="primary enter-world" onClick={enterWorld}>Enter world <span>↗</span></button>}</div></header>
      {host.pendingSession&&<section className="world-session-notice glass" role="alert"><strong>Another tab changed worlds.</strong><p>Your unsaved drafts are preserved here. Copy anything you want to keep; this session can no longer save changes.</p><button onClick={()=>host.reconnect({discardDrafts:true})}>Discard local drafts &amp; open {host.pendingSession.world.bible.title}</button></section>}
      <nav className="world-tools glass" aria-label="World workspace"><button className={panel==='scene'?'active':''} onClick={()=>openPanel('scene')}>World</button><button className={panel==='bible'?'active':''} onClick={()=>openPanel('bible')}>Bible</button><button className={panel==='references'?'active':''} onClick={()=>openPanel('references')}>Mood board</button>{runtime&&<button className={panel==='activity'?'active':''} onClick={()=>openPanel('activity')}>Activity</button>}<button className={panel==='agent'?'active':''} onClick={()=>openPanel('agent')}>Agent</button></nav>
      {!panel&&<div className="view-tools"><button className="glass" onClick={()=>{leaveWorld();setCameraMode(m=>m==='overview'?'walk':'overview');}}>{cameraMode==='overview'?'Ground view ↘':'Overlook ↗'}</button>{runtime&&<button className="glass" onClick={toggleFree}>{cameraMode==='free'?'Return to inhabitant':'Free camera'} <kbd>G</kbd></button>}<button className="glass" onClick={()=>{leaveWorld();setCameraMode('walk');setCove(true);setHomeTick(n=>n+1);}}>Return to arrival</button></div>}
      {showConversation&&<section className="conversation" aria-label="Conversation with your agent"><div className="conversation-heading"><span className="eyebrow">WITH YOUR AGENT</span><button className="icon-button" aria-label="Fold conversation" onClick={()=>setChatOpen(false)}>−</button></div><div className="expanded-cards">
        {agent.messages?.slice(-3).map(m=><article key={m.id} className={`${m.role==='user'?'you-card':'agent-card'} glass`}><span className="eyebrow">{m.role==='user'?'YOU':{cursor:'CURSOR',claude:'CLAUDE'}[agent.provider]||'CODEX'}</span>{m.selectionContext?.entities?.length>0&&<small className="message-references">Referred to: {m.selectionContext.entities.map(e=>e.label||e.id).join(', ')} · revision {m.selectionContext.acceptedRevision}</small>}{m.role==='user'?<p className="message-text">{m.text}</p>:<AgentText text={m.text}/>}</article>)}
        {active&&<article className="agent-card glass"><span className="eyebrow">{agent.requests?.length?'WAITING FOR YOU':`WORKING · ${agent.activity||'THINKING'}`}</span><p>{agent.requests?.length?'Answer the request below to continue.':'Following the world bible and your references.'}</p></article>}
        {!active&&agent.status==='interrupted'&&<article className="agent-card glass"><span className="eyebrow">STOPPED</span><p>The last turn stopped before it finished. Send a message to continue; the session keeps its context.</p></article>}
        {agent.requests?.map(r=><PendingRequest key={r.id} request={r} run={run} writeDisabled={writeDisabled}/>)}
        {proposal&&<article className="agent-card glass proposal-card"><span className="eyebrow">READY TO REVIEW</span><h2>A change to your world.</h2><p>{proposal.summary}</p><details><summary>Review scene and bible changes</summary><pre>{JSON.stringify({scene:proposal.world.scene,bible:proposal.world.bible,references:proposal.world.references},null,2)}</pre></details><div className="button-row"><button className="primary" disabled={writeDisabled||busy||proposal.baseRevision!==accepted?.revision} onClick={()=>run(()=>api('proposal/apply',{id:proposal.id}))}>Apply proposal</button><button disabled={writeDisabled} onClick={()=>run(()=>api('proposal/discard',{id:proposal.id}))}>Discard</button></div></article>}
        {error&&<article className="agent-card glass notice" role="alert">{error}<button className="text-button" onClick={()=>host.setError(null)}>Dismiss</button></article>}
      </div></section>}
      {selectionOpen&&selectedRefs.length>0&&!panel&&world&&<SelectionPanel world={world} refs={selectedRefs} setRefs={setSelectedRefs} focusInput={focusInput} onArrange={id=>{setSelected(id);openPanel('scene');}} onClose={()=>setSelectionOpen(false)}/>}
      {panel&&accepted&&<aside className={`drawer glass ${panel==='references'?'board-drawer':''}`}><div className="card-meta"><span className="eyebrow">{panel==='bible'?'SHARED INTENTIONS':panel==='scene'?'WORLD COMPOSITION':panel==='references'?'PINNED DIRECTION':panel==='activity'?'RUNTIME OBSERVATIONS':'LOCAL CONNECTION'}</span><button aria-label="Close panel" className="icon-button" onClick={()=>setPanel(null)}>×</button></div><h2>{panel==='bible'?'The rules of this place.':panel==='scene'?'A world around you.':panel==='references'?'A feeling to build toward.':panel==='activity'?'A living world.':'Your coding agent.'}</h2>
        {writeDisabled&&!host.pendingSession&&<p className="notice" role="status">Reconnecting to the local host. Saving is unavailable; your drafts are preserved.</p>}
        {panel==='bible'?<BibleEditor world={accepted} run={run} drafts={drafts.registry} writeDisabled={writeDisabled}/>:panel==='scene'?<><div className="button-row"><button disabled={writeDisabled||!accepted.revision||busy} onClick={()=>run(()=>api('undo',{baseRevision:accepted.revision}))}>Undo world edit</button></div><HistoryPanel world={accepted} run={run} busy={busy} active={active} writeDisabled={writeDisabled}/><SceneEditor world={accepted} run={run} selected={selected} runtime={runtime} drafts={drafts.registry} draftFocus={draftFocus} writeDisabled={writeDisabled}/></>:panel==='references'?<MoodBoardEditor world={accepted} run={run} agent={agent} model={model} effort={effort} drafts={drafts.registry} draftFocus={draftFocus} writeDisabled={writeDisabled}/>:panel==='activity'&&runtime?<>
          <p>Activity runs independently of authoring. Enter the world and use E on a nearby object.</p><div className="button-row"><button onClick={()=>setPaused(v=>!v)}>{paused?'Resume activity':'Pause activity'}</button><button onClick={()=>{runtime.reset();setRuntimeNotice('Activity reset.');}}>Reset activity</button></div>
          <label>Inspect activity<select aria-label="Inspect activity" value={selectedObject?.behavior?selected:''} onChange={e=>setSelected(e.target.value||null)}><option value="">Choose an object</option>{world.scene.objects.filter(o=>o.behavior&&(o.layer!=='origin'||cove)).map(o=><option value={o.id} key={o.id}>{o.label||o.id}</option>)}</select></label>
          {selectedObject?.behavior&&<button disabled={cameraMode!=='walk'} onClick={()=>interact(selected)}>{runtime.interaction(selected,probe.actorEye??probe.position).label}</button>}<small role="status">{runtimeNotice}</small>
          <details open><summary>Runtime observations</summary><small>{runtimeObservation?.backend||'Preparing renderer'} / {runtimeObservation?.drawCalls||0} draws<br/>Rendered triangles: {runtimeObservation?.triangles?.toLocaleString()??'—'}<br/>Recent frame interval p95: {runtimeObservation?.frameP95Ms?.toFixed(1)??'—'} ms<br/>Position: {runtimeObservation?.position?.map(n=>n.toFixed(2)).join(', ')}<br/>Camera: {cameraMode} · {runtimeObservation?.actor?`${runtimeObservation.actor.camera} person / ${runtimeObservation.actor.mode}`:'flat-ground walker'}{runtimeObservation?.actor&&<><br/>Feet: {runtimeObservation.actor.position.map(n=>n.toFixed(2)).join(', ')}<br/>Water depth: {runtimeObservation.actor.waterDepth.toFixed(2)} m</>}<br/>Mouse: {locked?'locked':'free'}<br/>Activity: {runtimeObservation?.activity?.time?.toFixed(2)||'0'} s</small><small>Rendered counts include render passes. Frame intervals include CPU work and refresh pacing; these are not GPU timings or the placed-source budget.</small>{Object.entries(runtimeObservation?.activity?.states||{}).map(([id,s])=><small key={id}>{id}: {s.open!==undefined?(s.open?'open':'closed'):(s.running?'running':'stopped')} / {(s.angle??0).toFixed(2)} rad</small>)}</details>
          <button disabled={writeDisabled} onClick={()=>run(async()=>setCoherence(await api('check',{})))}>Check world</button>{coherence&&<div className="coherence-report" role="status"><b>Advisory / revision {coherence.worldRevision}</b>{coherence.checks.map(c=><p key={c.id}><strong>{c.id}: {c.status}</strong><br/>{c.message}</p>)}<small>Read-only observations; no quality verdict.</small></div>}
        </>:<AgentSettings {...{agent,run,model,setModel,effort,setEffort,writeDisabled}} workspace={host.payload.workspace}/>}
      </aside>}
      <footer className="composer-area">
        {panel&&(agent.requests?.length>0||proposal)&&<button className="needs-you glass" onClick={()=>{setPanel(null);setChatOpen(true);setTimeout(()=>document.querySelector('.conversation .request-card, .conversation .proposal-card')?.scrollIntoView({block:'nearest'}),50);}}>{agent.requests?.length?`${{cursor:'Cursor',claude:'Claude'}[agent.provider]||'Codex'} is waiting for your answer`:'A proposal is ready to review'} <span>Review ↗</span></button>}
        {selectedRefs.length>0&&<div className="reference-tray glass"><button onClick={()=>{setSelectionOpen(v=>!v);setPanel(null);}}>{selectedRefs.length} {selectedRefs.length===1?'reference':'references'} <span>↗</span></button><div>{selectedRefs.map(ref=><span key={ref.id}>{world?.scene.objects.find(o=>o.id===ref.id)?.label||ref.id}{ref.part?` / ${ref.part}`:''}<button aria-label={`Remove selected ${ref.id}`} onClick={()=>setSelectedRefs(old=>old.filter(r=>r.id!==ref.id))}>×</button></span>)}</div><button aria-label="Clear all references" onClick={()=>setSelectedRefs([])}>Clear</button></div>}
        <form className="composer glass" onSubmit={e=>{e.preventDefault();send();}}><button type="button" className={`mic ${voice.recording?'recording':''}`} disabled={voice.busy} aria-label={voice.recording?'Stop recording':'Start voice input'} onClick={voice.toggle}>◉</button><textarea ref={input} rows={1} aria-label={{cursor:'Message Cursor',claude:'Message Claude'}[agent.provider]||'Message Codex'} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form.requestSubmit();}}} onFocus={()=>document.exitPointerLock?.()} placeholder={voice.recording?'Listening…':agent.connected?'Describe, ask, or change something…':'A thought for your world…'} maxLength={12000}/>{!agent.connected?<button type="button" onClick={()=>openPanel('agent')}>Connect ↗</button>:<button className="send" aria-label="Send message" disabled={writeDisabled||!text.trim()||!model||active||busy}>↑</button>}<button type="button" aria-label="Show conversation" onClick={()=>setChatOpen(v=>!v)}>···</button>{active&&<button type="button" disabled={writeDisabled} onClick={()=>run(()=>api('agent/stop',{}))}>Stop</button>}</form>
        <div className="controls-hint">{voice.status||(cameraMode==='free'?'WASD fly · Q down / E up · Shift faster · Arrows look · G return':'Click / F reference · Shift adds · Arrows look · E interacts · Enter to talk')}</div>
      </footer>
    </>}
  </main>;
}
