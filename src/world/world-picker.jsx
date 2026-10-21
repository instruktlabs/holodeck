import React,{useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {api} from './client.js';
import {worldChangeBlockers} from './world-drafts.mjs';
import './world-picker.css';

export function WorldPicker({world,context,library:initialLibrary,active,pendingProposal,busy,loading,online,drafts=[],message='',onResolve,onChanged,onBusyChange,onOpen,request=api}){
 const [open,setOpen]=useState(false),[library,setLibrary]=useState(initialLibrary),[fetching,setFetching]=useState(false),[error,setError]=useState('');
 const [dialog,setDialog]=useState(null),[name,setName]=useState(''),[working,setWorking]=useState(false);
 const root=useRef(),trigger=useRef(),menu=useRef(),modal=useRef(),input=useRef(),pending=useRef(false),id=useId();
 const blockers=worldChangeBlockers({active,pendingProposal,busy:busy&&!working,loading,online,drafts,message});
 const blocked=blockers.length>0;
 useEffect(()=>setLibrary(initialLibrary),[initialLibrary]);
 useEffect(()=>{
  if(!open)return;let cancelled=false;setFetching(true);setError('');
  request('library').then(value=>{if(!cancelled)setLibrary(value);}).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setFetching(false);});
  const outside=event=>{if(!root.current?.contains(event.target))setOpen(false);};document.addEventListener('pointerdown',outside);
  menu.current?.querySelector('[role="menuitem"]:not(:disabled)')?.focus();
  return()=>{cancelled=true;document.removeEventListener('pointerdown',outside);};
 },[open,context?.worldId,context?.epoch,request]);
 useEffect(()=>{
  if(dialog){modal.current?.showModal();input.current?.focus();input.current?.select();}
  else if(modal.current?.open){modal.current.close();trigger.current?.focus();}
 },[dialog]);
 function close(){if(working)return;setDialog(null);setOpen(false);setError('');trigger.current?.focus();}
 function showDialog(kind,template){setOpen(false);setError('');setName(kind==='rename'?world.bible.title:template?.id==='construct'?'':template?.title??'');setDialog({kind,template});}
 async function perform(kind,data){
  if(pending.current||blocked)return;
  pending.current=true;setWorking(true);onBusyChange?.(true);setError('');
  try{const result=await request(`library/${kind}`,data);await onChanged(result,{kind});setLibrary(result.library);setDialog(null);setOpen(false);trigger.current?.focus();}
  catch(e){setError(e.message);}
  finally{pending.current=false;setWorking(false);onBusyChange?.(false);}
 }
 function menuKeys(event){
  if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
  if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
  event.preventDefault();event.stopPropagation();const items=[...menu.current.querySelectorAll('[role="menuitem"]:not(:disabled)')],current=items.indexOf(document.activeElement);
  items[event.key==='Home'?0:event.key==='End'?items.length-1:(current+(event.key==='ArrowUp'?-1:1)+items.length)%items.length]?.focus();
 }
 const status=loading?'Loading revision…':!online?'Reconnecting':`Saved locally · revision ${world?.revision??'—'}`;
 const blockerContent=blocked&&<div className="world-picker-blockers" role="status"><strong>Before changing worlds</strong>{blockers.map(blocker=><p key={blocker.id}>{blocker.label}{blocker.location&&onResolve&&<button type="button" onClick={()=>{close();onResolve(blocker);}}>Review {blocker.location==='message'?'message':blocker.location==='conversation'?'conversation':'draft'} ↗</button>}</p>)}</div>;
 return <div className="world-picker" ref={root} onKeyDown={event=>{if(open&&event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}}}>
  <button type="button" ref={trigger} className="world-picker-trigger" aria-haspopup="menu" aria-expanded={open} aria-controls={`${id}-menu`} disabled={!world||working} onClick={()=>{onOpen?.();setOpen(value=>!value);}}>
   <span><strong>{world?.bible.title||'Opening your world'}</strong><small>{status}</small></span><span className="world-picker-chevron" aria-hidden="true">⌄</span>
  </button>
  {open&&<div className="world-picker-menu glass" id={`${id}-menu`} ref={menu} role="menu" aria-label="Worlds" onKeyDown={menuKeys}>
   <div className="world-picker-caption">YOUR WORLDS <span>{fetching?'Refreshing…':`${library?.worlds?.length??0} saved`}</span></div>
   <div className="world-picker-list">{library?.worlds?.map(entry=><button type="button" role="menuitem" className="world-picker-row" key={entry.id} disabled={blocked||working||entry.id===context?.worldId||entry.status!=='ready'} onClick={()=>perform('open',{id:entry.id})} aria-current={entry.id===context?.worldId?'page':undefined}>
    <span><strong>{entry.name}</strong><small>{entry.status==='ready'?`Revision ${entry.revision}${entry.id===context?.worldId?' · current':''}`:'Unavailable'}</small></span><span aria-hidden="true">{entry.id===context?.worldId?'✓':'↗'}</span>
   </button>)}</div>
   <div className="world-picker-actions"><button role="menuitem" type="button" disabled={blocked||working} onClick={()=>showDialog('create',library?.templates?.find(entry=>entry.id==='construct')??{id:'construct',title:'Cove'})}>＋ New world</button><button role="menuitem" type="button" disabled={blocked||working} onClick={()=>showDialog('rename')}>Rename current world</button></div>
   {library?.templates?.some(entry=>entry.id!=='construct')&&<><div className="world-picker-caption">START FROM AN EXAMPLE</div>{library.templates.filter(entry=>entry.id!=='construct').map(template=><button type="button" role="menuitem" className="world-picker-row world-picker-template" key={template.id} disabled={blocked||working} onClick={()=>showDialog('create',template)}><span><strong>{template.title}</strong><small>{template.description}</small></span><span aria-hidden="true">＋</span></button>)}</>}
   {blockerContent}{error&&<p className="world-picker-error" role="alert">{error}</p>}
  </div>}
  {createPortal(<dialog className="world-name-dialog" ref={modal} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={event=>{event.preventDefault();close();}} onKeyDown={event=>event.stopPropagation()}>
   <form onSubmit={event=>{event.preventDefault();if(!name.trim())return;perform(dialog?.kind,dialog?.kind==='rename'?{name:name.trim(),baseRevision:world.revision}:{name:name.trim(),templateId:dialog?.template?.id??'construct'});}}>
    <div className="world-picker-caption">{dialog?.kind==='rename'?'THIS WORLD':'A NEW PLACE'}<button type="button" className="world-picker-close" aria-label="Close world dialog" disabled={working} onClick={close}>×</button></div>
    <h2 id={`${id}-title`}>{dialog?.kind==='rename'?'A name for this world.':'Where will you begin?'}</h2>
    <p id={`${id}-description`}>{dialog?.kind==='rename'?'Updates the world name and saves a new revision.':dialog?.template?.id==='construct'?'Start in a fresh cove, ready for your ideas.':`Create your own editable copy of ${dialog?.template?.title??'this example'}.`}</p>
    <label htmlFor={`${id}-name`}>World name</label><input id={`${id}-name`} ref={input} value={name} onChange={event=>setName(event.target.value)} maxLength={120} required autoComplete="off" disabled={working}/>
    {blockerContent}{error&&<p className="world-picker-error" role="alert">{error}</p>}
    <div className="world-name-actions"><button type="button" disabled={working} onClick={close}>Cancel</button><button type="submit" className="primary" disabled={blocked||working||!name.trim()||dialog?.kind==='rename'&&name.trim()===world?.bible.title}>{working?'Saving…':dialog?.kind==='rename'?'Save name':'Create & open'}</button></div>
   </form>
  </dialog>,document.body)}
 </div>;
}
