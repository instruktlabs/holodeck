import React from 'react';
import {selectionParts} from './selection.mjs';

export function SelectionPanel({world,refs,setRefs,focusInput,onArrange,onClose}){
 return <section className="selection-panel glass" aria-label="Selected world references">
  <div className="card-meta"><span className="eyebrow">IN THIS CONVERSATION · {refs.length}</span><button className="icon-button" aria-label="Fold selection" onClick={onClose}>−</button></div>
  <p>Whole assets first. Narrow a part when it matters.</p>
  <div className="selection-list">{refs.map(ref=>{const item=world.scene.objects.find(o=>o.id===ref.id);if(!item)return null;const parts=selectionParts(item);return <article key={ref.id}>
   <div className="card-meta"><strong>{item.label||item.id}</strong><button className="icon-button" aria-label={`Remove reference ${ref.id}`} onClick={()=>setRefs(old=>old.filter(r=>r.id!==ref.id))}>×</button></div>
   <small>{item.asset?'Kiln asset':item.shape?.type} · {item.behavior?.type||'static'}{item.collider?' · collision':''}</small>
   {parts.length>0&&<label>Scope<select aria-label={`Scope for ${ref.id}`} value={ref.part||''} onChange={e=>setRefs(old=>old.map(r=>r.id===ref.id?{...r,part:e.target.value||null}:r))}><option value="">Whole asset</option>{parts.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>}
   <details><summary>What the agent receives</summary><small>ID: {item.id}<br/>Position: {item.position.join(', ')}<br/>Rotation: {item.rotation.join(', ')}<br/>Collider: {item.collider?.type||'none'}<br/>Behavior: {item.behavior?.type||'none'}</small>{item.asset&&<small>Asset: {item.asset}<br/>{world.scene.assets.find(a=>a.id===item.asset)?.file}<br/>Accepted content hash and provenance are resolved when sent.</small>}</details>
   <button className="text-button" onClick={()=>onArrange(item.id)}>Arrange this asset ↗</button>
  </article>;})}</div>
  <button className="primary wide" onClick={focusInput}>Talk about these <span>↗</span></button>
  <small>Attached to your next message · revision {world.revision}. No files are copied or newly mounted.</small>
 </section>;
}
