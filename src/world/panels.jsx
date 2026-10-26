import React,{useEffect,useState} from 'react';
import {useWorldClient} from './client.js';
import {useEditorDraft} from './world-drafts.jsx';
import {referenceUrl} from './moodboard.jsx';
import {connectName,modelGroups} from './presence.mjs';
import {probe} from '../prototype/scene.jsx';
import {selectableItem} from './selection.mjs';
import {withMaker} from './inhabitant.mjs';

export function BibleEditor({world,run,drafts,writeDisabled}){
  const {api,url:scopedUrl}=useWorldClient();
  const {draft,base,dirty,change:edit,saved:markSaved,reset}=useEditorDraft(drafts,'bible',world.bible,world.revision,{label:'bible',panel:'bible'}),[saved,setSaved]=useState(false);
  const change=(key,value)=>{setSaved(false);edit(d=>({...d,[key]:value}));};
  const pinned=(world.references||[]).filter(r=>world.bible.referenceIds?.includes(r.id));
  return <form className="hd-bible" onSubmit={e=>{e.preventDefault();run(async()=>{await api('world',{baseRevision:base,bible:draft});markSaved();setSaved(true);});}}>
    <p className="hd-lede">Shared intentions for the world. You and your agent edit the same document.</p>
    <label className="hd-field">World name<input className="hd-doc-title" value={draft.title} maxLength={120} onChange={e=>change('title',e.target.value)}/></label>
    <label className="hd-field">Visual direction<textarea rows={5} value={draft.intent} maxLength={8000} onChange={e=>change('intent',e.target.value)}/></label>
    <label className="hd-field">Rules of this place<textarea rows={7} value={draft.rules} maxLength={8000} onChange={e=>change('rules',e.target.value)}/></label>
    {dirty&&base!==world.revision&&<p className="hd-notice">The world changed while you were editing. Your draft is preserved; reload before saving.</p>}
    <div className="hd-row"><button className="b pri" disabled={writeDisabled||!dirty||base!==world.revision}>Save bible</button><button type="button" className="b q" disabled={!dirty} onClick={reset}>Discard bible draft</button>
      <span className="hd-meta hd-end" role="status">{dirty?'Unsaved draft':saved?'Bible saved to disk.':`Saved · revision ${world.revision}`}</span></div>
    {pinned.length>0&&<><span className="hd-caps">Pinned visual direction</span><div className="hd-pins">{pinned.map(r=><figure key={r.id}>{(!r.kind||r.kind==='image')?<img src={referenceUrl(r,scopedUrl)} alt={r.title}/>:<div className="hd-pin-file">{r.kind==='file'?'Linked file':'Note'}</div>}<figcaption><strong>{r.title}</strong>{r.notes&&<span> · {r.notes}</span>}</figcaption></figure>)}</div></>}
  </form>;
}

// Model and mode choices for the connected provider. Aliases come first; exact
// model IDs are listed separately so a pinned model is never a guess.
export function AgentSettings({agent,run,model,setModel,effort,setEffort,workspace,writeDisabled,remembered}){
  const {api}=useWorldClient();
  const provider=agent.provider||'codex',cursor=provider==='cursor';
  const [login,setLogin]=useState(null),[choice,setChoice]=useState(agent.connected?provider:remembered?.provider||provider),chosen=agent.models?.find(m=>m.model===model);
  useEffect(()=>{if(agent.connected)setChoice(provider);},[agent.connected,provider]);
  const selected=choice==='cursor',claude=choice==='claude';
  const modeChoices=selected&&cursor?agent.models:selected?[{id:'agent',model:'agent',displayName:'Agent'},{id:'plan',model:'plan',displayName:'Plan'},{id:'ask',model:'ask',displayName:'Ask'}]:claude&&provider!=='claude'?[]:agent.models;
  const groups=selected?[{label:'Modes',models:modeChoices||[]}]:modelGroups(modeChoices||[]);
  const option=m=><option key={m.id||m.model} value={m.model}>{m.displayName&&m.displayName!==m.model?`${m.displayName} · ${m.model}`:m.model}</option>;
  return <div className="hd-agent">
    <div className="hd-seg" role="group" aria-label="Agent provider">{[['codex','Codex'],['cursor','Cursor'],['claude','Claude Code']].map(([id,label])=><button key={id} type="button" aria-pressed={choice===id} disabled={writeDisabled} onClick={()=>setChoice(id)}>{label}</button>)}</div>
    <p className="hd-lede">{selected?'Connect the Cursor CLI in this world. Sign-in, billing and credentials stay inside Cursor. Holodeck does not read them. Image generation stays on Codex.':claude?'Runs your installed Claude Code CLI in this world with your own Claude subscription sign-in. Sign-in, billing and credentials stay inside Claude Code; Holodeck only checks its sign-in status. To sign in, run claude in a terminal. Image generation stays on Codex.':'Connect your local Codex CLI. Each message uses your signed-in ChatGPT plan. Holodeck does not read or copy its credentials.'}</p>
    <div className="hd-row"><button className="b pri" disabled={writeDisabled} onClick={()=>run(()=>api('agent/connect',{provider:choice}))}>{agent.connected&&provider===choice?'Refresh connection':`Connect ${connectName(choice)}`}</button>
      <span className="hd-meta">{cursor&&agent.connected?'Cursor session. Login and billing stay in Cursor.':provider==='claude'&&agent.connected?`Claude Code · ${agent.account?.authMethod||'signed in'} · ${agent.account?.subscriptionType||'subscription'}`:agent.connected?agent.account?.type==='chatgpt'?`ChatGPT · ${agent.account.planType||'plan connected'}`:'Codex is running; ChatGPT sign-in is needed.':remembered?.provider?`Last used here: ${connectName(remembered.provider)}${remembered.model?` · ${remembered.model}`:''}`:'No agent process connected.'}</span></div>
    {provider==='codex'&&agent.connected&&agent.account?.type!=='chatgpt'&&<button className="b" disabled={writeDisabled} onClick={()=>run(async()=>setLogin(await api('agent/login',{})))}>Sign in with ChatGPT</button>}
    {login?.authUrl&&<p><a href={login.authUrl} target="_blank" rel="noreferrer">Continue sign-in in your browser ↗</a></p>}
    <div className="hd-grid2">
      <label className="hd-field">{selected?'Mode':'Model'}<select aria-label={selected?'Cursor mode':claude?'Claude model':'Codex model'} value={model||''} onChange={e=>{setModel(e.target.value);setEffort('');}}><option value="">{selected?'Choose a mode':'Choose a model'}</option>{groups.length>1?groups.map(g=><optgroup key={g.label} label={g.label}>{g.models.map(option)}</optgroup>):groups[0]?.models.map(option)}</select></label>
      {!selected&&<label className="hd-field">Reasoning<select aria-label="Reasoning effort" value={effort} onChange={e=>setEffort(e.target.value)}><option value="">Model default</option>{chosen?.supportedReasoningEfforts?.map(e=><option key={e.reasoningEffort}>{e.reasoningEffort}</option>)}</select></label>}
    </div>
    <p className="hd-meta">{selected?'Cursor permissions, questions and plans wait in the dock. Scene changes still wait for your review.':claude?'Claude Code permission requests wait in the dock. Holodeck world tools run without prompts; scene changes still wait for your review.':'Model availability is confirmed when a turn succeeds. Native commands use workspace-write sandboxing and approval requests; scene tools stage changes for review.'}</p>
    {provider==='claude'&&agent.resolvedModel&&<p className="hd-meta">Last turn ran on <b>{agent.resolvedModel}</b>{agent.effort?` · ${agent.effort} effort`:' · default effort'}.</p>}
    {provider==='claude'&&agent.sessionTools?.length>0&&<p className="hd-meta">Allowed for this session: {agent.sessionTools.map(t=>t==='edit:assets/source'?'edits in assets/source':t.replace(/^mcp__kiln_workspace__/,'')).join(', ')}.</p>}
    <dl className="hd-facts"><dt>Workspace</dt><dd className="hd-mono">{workspace}</dd><dt>{selected||claude?'Session':'Thread'}</dt><dd className="hd-mono">{agent.threadId||'created on your first message'}</dd></dl>
  </div>;
}

const ms=n=>Number.isFinite(n)?`${n.toFixed(1)} ms`:'—';
// Runtime observations are measurements from this browser; they are labelled as
// such and pause while the page is hidden instead of reporting throttled frames.
export function ObservePanel({runtime,world,observation,cameraMode,locked,paused,setPaused,notice,setNotice,selected,setSelected,cove,interact,coherence,setCoherence,run,writeDisabled,pageHidden}){
  const {api}=useWorldClient();
  const selectedObject=selectableItem(world.scene,selected);
  const o=observation;
  return <div className="hd-observe">
    <div className="hd-stats" aria-label="Runtime observations">
      <div><span className="hd-caps">Backend</span><strong>{o?.backend||'Preparing'}</strong></div>
      <div><span className="hd-caps">Draws</span><strong>{o?.drawCalls?.toLocaleString()??'—'}</strong></div>
      <div><span className="hd-caps">Triangles</span><strong>{o?.triangles?.toLocaleString()??'—'}</strong></div>
      <div><span className="hd-caps">Frame p95</span><strong>{pageHidden?'paused':ms(o?.frameP95Ms)}</strong></div>
      <div><span className="hd-caps">First frame</span><strong>{Number.isFinite(probe.firstFrameMs)?`${(probe.firstFrameMs/1000).toFixed(1)} s`:'—'}</strong></div>
    </div>
    {pageHidden&&<p className="hd-notice" role="status">Page hidden · timing paused. Frames resume counting on the first frame after you return.</p>}
    <p className="hd-meta">Rendered counts include render passes. Frame intervals include CPU work and refresh pacing; they are not GPU timings or the placed-source budget. First frame is measured from when this world opened.</p>
    <dl className="hd-facts">
      <dt>Position</dt><dd className="hd-mono">{o?.position?.map(n=>n.toFixed(2)).join(', ')??'—'}</dd>
      <dt>Camera</dt><dd>{cameraMode} · {o?.actor?`${o.actor.camera} person / ${o.actor.mode}`:'flat-ground walker'} · mouse {locked?'locked':'free'}</dd>
      {o?.actor&&<><dt>Feet</dt><dd className="hd-mono">{o.actor.position.map(n=>n.toFixed(2)).join(', ')} · water {o.actor.waterDepth.toFixed(2)} m</dd></>}
      <dt>Activity</dt><dd>{o?.activity?.time?.toFixed(2)||'0'} s{paused?' · paused':''}</dd>
    </dl>
    <details className="hd-details"><summary>Activity</summary>
      <p className="hd-meta">Activity runs independently of authoring. Enter the world and use E on a nearby object.</p>
      <div className="hd-row"><button className="b" onClick={()=>setPaused(v=>!v)}>{paused?'Resume activity':'Pause activity'}</button><button className="b q" onClick={()=>{runtime.reset();setNotice('Activity reset.');}}>Reset activity</button></div>
      <label className="hd-field">Inspect activity<select aria-label="Inspect activity" value={selectedObject?.behavior?selected:''} onChange={e=>setSelected(e.target.value||null)}><option value="">Choose an object</option>{world.scene.objects.filter(x=>x.behavior&&(x.layer!=='origin'||cove)).map(x=><option value={x.id} key={x.id}>{x.label||x.id}</option>)}</select></label>
      {selectedObject?.behavior&&<button className="b" disabled={cameraMode!=='walk'} onClick={()=>interact(selected)}>{runtime.interaction(selected,probe.actorEye??probe.position).label}</button>}
      {notice&&<p className="hd-meta" role="status">{notice}</p>}
      {Object.entries(o?.activity?.states||{}).map(([id,s])=><p className="hd-meta" key={id}>{id}: {s.open!==undefined?(s.open?'open':'closed'):(s.running?'running':'stopped')} / {(s.angle??0).toFixed(2)} rad</p>)}
    </details>
    <div className="hd-row"><button className="b" disabled={writeDisabled} onClick={()=>run(async()=>setCoherence(await api('check',{})))}>Check world</button><span className="hd-meta">Read-only observations; no quality verdict.</span></div>
    {coherence&&<div className="hd-card hd-coherence" role="status"><span className="hd-caps">Advisory · revision {coherence.worldRevision}</span>{coherence.checks.map(c=><p key={c.id}><strong>{c.id}: {c.status}</strong><br/>{c.message}</p>)}{coherence.checks.some(c=>c.id==='inhabitant-upgrade')&&!world.scene.runtime?.possession&&<div className="hd-row"><button className="b" disabled={writeDisabled||coherence.worldRevision!==world.revision} onClick={()=>run(async()=>{await api('world',{baseRevision:world.revision,scene:withMaker(world.scene)});setCoherence(await api('check',{}));})}>Add the maker</button><span className="hd-meta">Saves a new revision; undo restores the bodyless walk.</span></div>}</div>}
  </div>;
}
