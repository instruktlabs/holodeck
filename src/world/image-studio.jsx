import React,{useState} from 'react';
import {useWorldClient} from './client.js';
import {useEditorDraft} from './world-drafts.jsx';
export function ImageStudio({agent,model,effort,world,dirty,run,onAdd,drafts,writeDisabled}){
  const {api,url:scopedUrl}=useWorldClient();
  const {draft:prompt,change:editPrompt,reset:clearPrompt}=useEditorDraft(drafts,'image-prompt','',0,{label:'image prompt',panel:'references'});
  const setPrompt=value=>value?editPrompt(value):clearPrompt();
  const [useBible,setUseBible]=useState(true),[ids,setIds]=useState([]);
  const active=!!agent.turnId||agent.status==='starting',cursor=agent.provider==='cursor',available=!cursor&&agent.capabilities?.imageGeneration;
  return <section className="image-studio"><div className="image-studio-prompt"><span className="eyebrow">IMAGINE THIS WORLD</span>
    <label>What would you like to see?<textarea aria-label="Image generation prompt" rows={3} maxLength={4000} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="A sheltered clay cove at dusk, with soft amber light and linen overhead…"/></label>
    <label className="image-checkbox"><input type="checkbox" checked={useBible} onChange={e=>setUseBible(e.target.checked)}/>Include the world bible</label>
    <div className="image-ref-picks">{(world.references||[]).filter(r=>!r.kind||r.kind==='image').map(r=><label key={r.id} className="image-checkbox"><input type="checkbox" checked={ids.includes(r.id)} disabled={!ids.includes(r.id)&&ids.length>=5} onChange={e=>setIds(old=>e.target.checked?[...old,r.id]:old.filter(id=>id!==r.id))}/><span>{r.title}</span></label>)}</div>
    <div className="button-row">{cursor?<button type="button" disabled={writeDisabled} onClick={()=>run(()=>api('agent/connect',{provider:'codex'}))}>Use Codex for images</button>:!agent.connected?<button disabled={writeDisabled} onClick={()=>run(()=>api('agent/connect',{provider:'codex'}))}>Connect local Codex</button>:<button className="primary" disabled={writeDisabled||!available||!model||!prompt.trim()||active||dirty} onClick={()=>run(()=>api('agent/image',{prompt,referenceIds:ids,model,effort:effort||null,useBible}))}>{active?'Codex is working…':'Generate one image'}</button>}{prompt&&<button onClick={clearPrompt}>Discard image prompt</button>}{active&&!cursor&&<button disabled={writeDisabled} onClick={()=>run(()=>api('agent/stop',{}))}>Stop</button>}</div>
    <small>{cursor?'Image generation stays on the Codex connection.':dirty?'Save your board edits before generating.':!agent.connected?'Connect your subscription-backed local Codex session.':available?'Uses your Codex allowance. Select up to five saved images as references.':'This provider has not advertised image generation.'} Results stay here until you add them.</small>
    {!!agent.requests?.length&&<p className="notice">Codex needs your input. Close the board to respond to its conversation card.</p>}
  </div><div className="image-results" aria-label="Generated image results">
    {!agent.images?.length&&<p>Your generated concepts will appear here. You can also ask for an image in conversation.</p>}
    {agent.images?.slice(-6).map(result=><article key={result.id}>{result.reference?<><img loading="lazy" src={scopedUrl(`/api/references/${result.reference.file.split('/').at(-1)}`)} alt="Generated world concept"/><button onClick={()=>onAdd([{...result.reference,notes:'Generated concept for discussion. Review before using as world direction.'}])}>Add to board draft</button><details><summary>Generation context</summary><p>{result.reference.generation?.prompt}</p></details></>:<p className="notice">{result.error||result.status}</p>}</article>)}
  </div></section>;
}
