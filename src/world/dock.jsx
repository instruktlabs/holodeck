import React,{useEffect,useMemo,useState} from 'react';
import {useWorldClient} from './client.js';
import {Icon} from './icons.jsx';
import {connectName,providerName} from './presence.mjs';
import {diffProposal} from './proposal-diff.mjs';
import {selectableItem} from './selection.mjs';

// The dock is the whole idle interface: one bottom-anchored object. Everything the
// agent needs from you grows upward out of it, so nothing below the decision slot
// moves when a card resolves.
export function Presence({presence,elapsed,notice,onReconnect,writeDisabled,children}){
  return <div className={`hd-presence is-${presence.state}`} role="status">
    <span className={`hd-dot ${presence.state==='needs'?'need':presence.state==='working'?'live':''}`}/>
    <span className="hd-presence-label">{notice||presence.label}</span>
    {presence.count>1&&<span className="hd-chip sm">{presence.count}</span>}
    {!notice&&elapsed&&<span className="hd-meta">{elapsed}</span>}
    {!notice&&presence.detail&&<span className="hd-meta hd-hide-narrow">{presence.detail}</span>}
    {presence.reconnect&&<button className="b sm" disabled={writeDisabled} onClick={onReconnect}><Icon name="refresh" size={15}/>Reconnect {connectName(presence.reconnect)}</button>}
    {!notice&&<span className="hd-presence-end">{children}</span>}
  </div>;
}

const LABELS={cursor:'Cursor',claude:'Claude Code'};
// One request at a time, in a slot whose buttons keep their places. A newly arrived
// card ignores clicks briefly so a double-click on the last one cannot answer it.
export function DecisionSlot({requests,run,writeDisabled}){
  const {api}=useWorldClient();
  const request=requests[0],[answers,setAnswers]=useState({}),[armed,setArmed]=useState(false);
  useEffect(()=>{setAnswers({});setArmed(false);const timer=setTimeout(()=>setArmed(true),400);return()=>clearTimeout(timer);},[request?.id]);
  if(!request)return null;
  const answer=data=>run(()=>api('agent/answer',{id:request.id,...data})),off=writeDisabled||!armed;
  const questions=request.params.questions,options=request.params.options,count=requests.length>1?`1 of ${requests.length}`:null;
  const choose=(id,value,multiple)=>setAnswers(a=>{if(!multiple)return {...a,[id]:value};const current=Array.isArray(a[id])?a[id]:[];return {...a,[id]:current.includes(value)?current.filter(v=>v!==value):[...current,value]};});
  const head=(title,source)=><div className="hd-decision-head"><span className="hd-dot need"/><strong>{title}</strong><span className="hd-meta">{source}</span>{count&&<span className="hd-meta hd-end">{count}</span>}</div>;
  if(request.kind==='plan')return <article className="hd-card need hd-decision" aria-label="Plan waiting for your decision">
    {head('Accept this plan?','Cursor plan')}
    <div className="hd-decision-body"><p>{request.params.reason}</p>{request.params.overview&&<p>{request.params.overview}</p>}{request.params.command&&<pre className="hd-code">{request.params.command}</pre>}
      {!!request.params.todos?.length&&<ul>{request.params.todos.map(todo=><li key={todo.id}>{todo.status}: {todo.content}</li>)}</ul>}</div>
    <div className="hd-decision-actions"><button className="b pri" disabled={off} onClick={()=>answer({decision:'accept'})}>Accept plan</button><button className="b q" disabled={off} onClick={()=>answer({decision:'decline'})}>Decline</button></div>
  </article>;
  // Adapters that name the tool title the card by it (H38); the others fall back to shell or permission.
  const p=request.params,source=`${LABELS[request.provider]||'Codex'} · ${questions?'question':p.tool||(p.command?'shell':'permission')}`;
  return <article className="hd-card need hd-decision" aria-label="Request waiting for your answer">
    {head(questions?(p.title||'Your input'):p.title||(p.command?'Run a command?':'Allow this?'),source)}
    <div className="hd-decision-body">
      {questions?questions.map(q=><fieldset key={q.id}><legend>{q.question}</legend>{q.options?.length?q.options.map(option=><label key={option.id} className="hd-check"><input type={q.allowMultiple?'checkbox':'radio'} name={q.id} checked={q.allowMultiple?Array.isArray(answers[q.id])&&answers[q.id].includes(option.id):answers[q.id]===option.id} onChange={()=>choose(q.id,option.id,q.allowMultiple)}/>{option.label}</label>):<input aria-label={q.question} value={answers[q.id]||''} onChange={e=>setAnswers(a=>({...a,[q.id]:e.target.value}))}/>}</fieldset>)
      :<>{p.reason&&<p>{p.reason}</p>}{p.outside&&<span className="hd-chip sm warn">Outside this world</span>}<pre className="hd-code">{p.command||JSON.stringify(p.changes||{},null,2)}</pre>{p.cwd&&<span className="hd-meta">{p.cwd}</span>}</>}
    </div>
    <div className="hd-decision-actions">{questions?<button className="b pri" disabled={off} onClick={()=>answer({answers})}>Reply</button>
      :options?.length?options.map((option,i)=><button key={option.optionId} className={`b ${i===0?'pri':/decline|deny|reject/i.test(option.optionId+option.label)?'q':''}`} disabled={off} onClick={()=>answer({decision:option.optionId})}>{option.label||option.optionId}</button>)
      :<><button className="b pri" disabled={off} onClick={()=>answer({decision:'accept'})}>Allow once</button><button className="b q" disabled={off} onClick={()=>answer({decision:'decline'})}>Decline</button></>}</div>
  </article>;
}

// Counts for the dock's proposal line; the full review lives in the sheet.
export function proposalChips(diff){
  const t=diff.scene.placements.totals,chips=[t.added&&`+${t.added} placed`,t.removed&&`−${t.removed} removed`,t.moved&&`${t.moved} moved`,t.changed&&`${t.changed} changed`].filter(Boolean);
  if(diff.scene.assets.added.length)chips.push(`+${diff.scene.assets.added.length} assets`);
  if(diff.scene.assets.changed.length)chips.push(`${diff.scene.assets.changed.length} assets updated`);
  if(diff.scene.assets.removed.length)chips.push(`${diff.scene.assets.removed.length} assets removed`);
  const sc=diff.scene.scatters,scatters=sc?sc.added.length+sc.removed.length+sc.changed.length:0;if(scatters)chips.push(`${scatters} ${scatters===1?'scatter':'scatters'}`);
  if(diff.scene.settings.length)chips.push(diff.scene.settings.map(s=>s.field).join(', '));
  if(diff.bible.length)chips.push('bible');
  const b=diff.board,cards=b.added.length+b.removed.length+b.moved.length+b.changed.length;if(cards)chips.push(`${cards} board ${cards===1?'card':'cards'}`);
  return chips.length?chips:['no differences'];
}
export function ProposalLine({proposal,accepted,preview,setPreview,ghosted,onReview,onApply,onDiscard,disabled,busy}){
  const chips=useMemo(()=>proposalChips(diffProposal(accepted,proposal.world)),[accepted,proposal]);
  const stale=proposal.baseRevision!==accepted?.revision;
  return <div className="hd-proposal" aria-label="Proposal ready to review">
    <Icon name="layers"/>
    <div className="hd-proposal-text"><strong>{proposal.summary}</strong><span className="hd-chips">{chips.map(c=><span key={c} className="hd-chip sm">{c}</span>)}{stale&&<span className="hd-chip sm warn">based on revision {proposal.baseRevision}</span>}</span></div>
    <div className="hd-proposal-actions">
      {ghosted>0&&<button className={`b sm ${preview?'on':''}`} aria-pressed={preview} onClick={()=>setPreview(v=>!v)} title="Show the proposed placements in the world before applying"><Icon name={preview?'eye':'eyeOff'} size={15}/>{preview?'Previewing':'Preview'}</button>}
      <button className="b sm q" onClick={onReview}>Review</button>
      <button className="b sm pri" aria-label="Apply proposal" disabled={disabled||busy||stale} onClick={onApply}>Apply</button>
      <button className="b sm q" disabled={disabled} onClick={onDiscard}>Discard</button>
    </div>
  </div>;
}

export function Composer({inputRef,text,setText,onSend,onEscape,onFocus,onBlur,voice,agent,active,canSend,writeDisabled,onConnect,onStop,placeholder}){
  return <form className="hd-compose" onSubmit={e=>{e.preventDefault();onSend();}}>
    <textarea ref={inputRef} rows={1} aria-label={agent.provider?`Message ${providerName(agent.provider)}`:'Message your agent'} value={text} maxLength={12000}
      onChange={e=>setText(e.target.value)} onFocus={onFocus} onBlur={onBlur}
      onKeyDown={e=>{
        if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.stopPropagation();e.currentTarget.form.requestSubmit();}
        // Escape returns to the world instead of leaving it.
        else if(e.key==='Escape'&&onEscape){e.preventDefault();e.stopPropagation();onEscape();}
      }}
      placeholder={voice.recording?'Listening…':placeholder}/>
    <span className="hd-compose-tools">
      <button type="button" className={`i ${voice.recording?'recording':''}`} disabled={voice.busy} aria-label={voice.recording?'Stop recording':'Start voice input'} onClick={voice.toggle}><Icon name="mic"/></button>
      {!agent.connected?<button type="button" className="b sm" onClick={onConnect}><Icon name="plug" size={15}/>Connect</button>
        :active?<button type="button" className="i round" disabled={writeDisabled} aria-label="Stop the turn" onClick={onStop}><Icon name="stop"/></button>
        :<button className="i round pri" aria-label="Send message" disabled={!canSend}><Icon name="send"/></button>}
    </span>
  </form>;
}

// On touch there is no Shift; "Add more" keeps each tap adding to the references.
export function ReferenceTray({refs,world,setRefs,onOpen,addMore,setAddMore}){
  if(!refs.length)return null;
  return <div className="hd-refs"><button className="b sm q" onClick={onOpen}>{refs.length} {refs.length===1?'reference':'references'}</button>
    <span className="hd-chips">{refs.map(ref=><span key={ref.id} className="hd-chip sm">{selectableItem(world?.scene,ref.id)?.label||ref.id}{ref.part?` / ${ref.part}`:''}<button aria-label={`Remove selected ${ref.id}`} onClick={()=>setRefs(old=>old.filter(r=>r.id!==ref.id))}><Icon name="close" size={12}/></button></span>)}</span>
    {addMore!==undefined&&<button className="b sm" aria-pressed={addMore} onClick={()=>setAddMore(v=>!v)}>Add more</button>}
    <button className="b sm q" aria-label="Clear all references" onClick={()=>setRefs([])}>Clear</button>
  </div>;
}

export const SECTIONS=[['conversation','Conversation'],['bible','Bible'],['references','Mood board'],['scene','World'],['activity','Observe'],['history','History'],['agent','Agent']];
export function Sections({panel,openPanel,runtime,hint}){
  return <nav className="hd-sections" aria-label="World workspace">
    {SECTIONS.filter(([id])=>id!=='activity'||runtime).map(([id,label])=><button key={id} className={`hd-tab ${panel===id?'on':''}`} aria-pressed={panel===id} onClick={()=>openPanel(id)}>{label}</button>)}
    {hint&&<span className="hd-meta hd-sections-hint">{hint}</span>}
  </nav>;
}
