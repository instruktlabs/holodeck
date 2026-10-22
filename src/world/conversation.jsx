import React,{useEffect,useRef,useState} from 'react';
import {inlineSpans,messageBlocks,foldMessage} from './message-format.mjs';
import {providerName} from './presence.mjs';

const Inline=({text})=>inlineSpans(text).map((s,i)=>s.strong?<strong key={i}>{s.text}</strong>:s.code?<code key={i}>{s.text}</code>:<React.Fragment key={i}>{s.text}</React.Fragment>);
export function AgentText({text}){
  return <div className="hd-agent-text">{messageBlocks(text).map((b,i)=>b.type==='heading'?<h4 key={i}><Inline text={b.text}/></h4>:b.type==='list'?React.createElement(b.ordered?'ol':'ul',{key:i},b.items.map((item,j)=><li key={j}><Inline text={item}/></li>)):b.type==='table'?<div key={i} className="hd-table"><table><thead><tr>{b.head.map((h,j)=><th key={j}><Inline text={h}/></th>)}</tr></thead><tbody>{b.rows.map((r,j)=><tr key={j}>{r.map((c,k)=><td key={k}><Inline text={c}/></td>)}</tr>)}</tbody></table></div>:<p key={i}><Inline text={b.text}/></p>)}</div>;
}

// A long user message folds to its first lines; the agent's reply stays in view.
function YouText({text}){
  const [open,setOpen]=useState(false),fold=foldMessage(text);
  return <><p className="hd-you-text">{open?text:fold.text}</p>{fold.folded&&<button className="b sm q hd-more" onClick={()=>setOpen(v=>!v)}>{open?'Show less':'Show more'}</button>}</>;
}

export function Message({message,provider}){
  const you=message.role==='user';
  return <article className={`hd-msg ${you?'you':'agent'}`}>
    <span className="hd-cap">{you?'You':providerName(provider)}</span>
    {message.selectionContext?.entities?.length>0&&<span className="hd-meta">Referred to {message.selectionContext.entities.map(e=>e.label||e.id).join(', ')} · revision {message.selectionContext.acceptedRevision}</span>}
    {you?<YouText text={message.text}/>:<AgentText text={message.text}/>}
  </article>;
}

// The whole conversation, newest at the bottom. Requests are never listed here:
// they wait in the dock's decision slot, which stays visible with this open.
export function Conversation({agent,active,error,onDismissError}){
  const end=useRef(),messages=agent.messages||[];
  useEffect(()=>{end.current?.scrollIntoView({block:'end'});},[messages.length,active]);
  return <div className="hd-conversation">
    {!messages.length&&<p className="hd-empty">Nothing said yet. Describe what to build in the box below; replies, questions and proposals appear here and in the dock.</p>}
    {messages.map(m=><Message key={m.id} message={m} provider={agent.provider}/>)}
    {active&&<article className="hd-msg agent hd-working"><span className="hd-cap">{agent.requests?.length?'Waiting for you':`Working · ${agent.activity||'thinking'}`}</span><p>{agent.requests?.length?'Answer the request in the dock to continue.':'Following the world bible and your references.'}</p></article>}
    {!active&&agent.status==='interrupted'&&<article className="hd-msg agent"><span className="hd-cap">Stopped</span><p>The last turn stopped before it finished. Send a message to continue; the session keeps its context.</p></article>}
    {error&&<article className="hd-msg hd-alert" role="alert"><p>{error}</p><button className="b sm q" onClick={onDismissError}>Dismiss</button></article>}
    <span ref={end}/>
  </div>;
}

// The dock's glance: the latest reply in a few lines, without opening anything.
export function Glance({agent,onOpen,onClose}){
  const last=[...(agent.messages||[])].reverse().find(m=>m.role!=='user');
  if(!last)return null;
  return <article className="hd-glance"><div className="hd-glance-head"><span className="hd-cap">{providerName(agent.provider)}</span><button className="b sm q hd-end" onClick={onOpen}>Open conversation</button><button className="b sm q" aria-label="Fold" onClick={onClose}>Fold</button></div><div className="hd-glance-body"><AgentText text={last.text}/></div></article>;
}
