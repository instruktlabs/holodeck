import {useEffect,useRef,useState} from 'react';
import {useWorldClient} from './client.js';

function savedAt(value){
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'Save time unavailable':date.toLocaleString();
}

export function HistoryPanel({world,run,busy,active,writeDisabled,initiallyOpen=false}){
  const {api}=useWorldClient();
  const [open,setOpen]=useState(initiallyOpen),[revisions,setRevisions]=useState([]),[selected,setSelected]=useState('');
  const [loading,setLoading]=useState(false),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);
  const [name,setName]=useState(''),[working,setWorking]=useState(''),[result,setResult]=useState(null),pending=useRef(false);
  useEffect(()=>{
    if(!open||writeDisabled)return;
    let cancelled=false;setLoading(true);setError('');
    api('history').then(value=>{
      if(cancelled)return;
      setRevisions(value.revisions);
      setSelected(current=>value.revisions.some(row=>String(row.revision)===current)?current:String(value.revisions.find(row=>row.revision===world.revision)?.revision??value.revisions[0]?.revision??''));
    }).catch(e=>{if(!cancelled)setError(e.message);}).finally(()=>{if(!cancelled)setLoading(false);});
    return()=>{cancelled=true;};
  },[open,world.revision,refresh,writeDisabled]);
  const entry=revisions.find(row=>String(row.revision)===selected);
  const disabled=writeDisabled||busy||active||!!working||loading||!entry||entry.unavailable;
  function act(kind){
    if(pending.current||disabled||(kind==='restore'&&entry.revision===world.revision)||(kind==='remix'&&!name.trim()))return;
    pending.current=true;setWorking(kind);setError('');setResult(null);
    run(async()=>{
      try{
        const value=await api(`history/${kind}`,{baseRevision:world.revision,revision:entry.revision,...(kind==='remix'?{name:name.trim()}:{})});
        setResult(kind==='remix'?{kind,path:value.path}:{kind,source:entry.revision,revision:value.world?.revision});
        setRefresh(value=>value+1);
      }catch(e){setError(e.message);throw e;}
      finally{pending.current=false;setWorking('');}
    });
  }
  return <details className="world-history" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
    <summary>World history</summary>
    <p>Browse saved revisions. Restoring creates a new revision and keeps later history available.</p>
    <div className="button-row"><button type="button" disabled={writeDisabled||loading||!!working} onClick={()=>setRefresh(value=>value+1)}>{loading?'Loading history…':'Refresh history'}</button></div>
    {revisions.length>0&&<>
      <label>Saved revision<select value={selected} disabled={!!working} onChange={event=>{setSelected(event.target.value);setResult(null);}}>
        {revisions.map(row=><option key={row.revision} value={row.revision}>Revision {row.revision}{row.revision===world.revision?' · current':''} · {row.title}{row.unavailable?' · unavailable':''}</option>)}
      </select></label>
      {entry&&<p>{entry.unavailable?'This snapshot cannot be read. Choose another revision.':<>{entry.objects} objects · {entry.assets} assets<small>{savedAt(entry.savedAt)}</small></>}</p>}
      <button type="button" disabled={disabled||entry?.revision===world.revision} onClick={()=>act('restore')}>{working==='restore'?'Restoring…':`Restore revision ${entry?.revision??''} as new revision`}</button>
      <label>New workspace folder<input value={name} disabled={!!working} onChange={event=>setName(event.target.value)} placeholder="island-remix" pattern="[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}"/></label>
      <button type="button" disabled={disabled||!name.trim()} onClick={()=>act('remix')}>{working==='remix'?'Creating remix…':'Create separate remix'}</button>
      <small>Use letters, numbers, hyphens or underscores. Creates a workspace beside this one; it does not open it or start an agent.</small>
    </>}
    {!loading&&!error&&revisions.length===0&&<p>No saved revisions are available yet.</p>}
    {active?<p className="notice">Finish or stop the current agent turn before restoring or remixing.</p>:busy&&!working?<p className="notice">Another operation is in progress.</p>:null}
    {error&&<p className="notice" role="alert">History request failed: {error}</p>}
    {result?.kind==='restore'&&<p role="status">Restored revision {result.source}{Number.isInteger(result.revision)?` as new revision ${result.revision}`:''}. Later history is still available.</p>}
    {result?.kind==='remix'&&<div role="status"><p>Remix created:</p><p className="workspace-path">{result.path}</p></div>}
  </details>;
}
