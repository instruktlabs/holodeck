import React from 'react';
import {selectionParts,selectableItem} from './selection.mjs';
import {Icon} from './icons.jsx';

export function SelectionPanel({world,refs,setRefs,focusInput,onArrange,onClose}){
 return <section className="hd-card hd-selection" aria-label="Selected world references">
  <div className="hd-row"><span className="hd-caps">In your next message · {refs.length}</span><span className="hd-meta">Whole assets first; narrow a part when it matters.</span><button className="b sm q i hd-end" aria-label="Fold selection" onClick={onClose}><Icon name="down" size={15}/></button></div>
  <div className="hd-selection-list">{refs.map(ref=>{const item=selectableItem(world.scene,ref.id);if(!item)return null;const parts=selectionParts(item);
   // A scatter record: its instances are derived, so it has no single placement to arrange.
   if(item.variants)return <article key={ref.id}><div className="hd-row"><strong>{item.label||item.id}</strong><span className="hd-meta">Scatter · {item.variants.map(v=>v.asset).join(', ')} · seed {item.seed}</span><button className="b sm q i hd-end" aria-label={`Remove reference ${ref.id}`} onClick={()=>setRefs(old=>old.filter(r=>r.id!==ref.id))}><Icon name="close" size={14}/></button></div></article>;
   return <article key={ref.id}>
   <div className="hd-row"><strong>{item.label||item.id}</strong><span className="hd-meta">{item.asset?'Kiln asset':item.shape?.type} · {item.behavior?.type||'static'}{item.collider?' · collision':''}</span><button className="b sm q i hd-end" aria-label={`Remove reference ${ref.id}`} onClick={()=>setRefs(old=>old.filter(r=>r.id!==ref.id))}><Icon name="close" size={14}/></button></div>
   {parts.length>0&&<label className="hd-field">Scope<select aria-label={`Scope for ${ref.id}`} value={ref.part||''} onChange={e=>setRefs(old=>old.map(r=>r.id===ref.id?{...r,part:e.target.value||null}:r))}><option value="">Whole asset</option>{parts.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>}
   <details className="hd-details"><summary>What the agent receives</summary><dl className="hd-facts"><dt>ID</dt><dd className="hd-mono">{item.id}</dd><dt>Position</dt><dd className="hd-mono">{item.position.join(', ')}</dd><dt>Rotation</dt><dd className="hd-mono">{item.rotation.join(', ')}</dd><dt>Collider</dt><dd>{item.collider?.type||'none'}</dd><dt>Behavior</dt><dd>{item.behavior?.type||'none'}</dd>{item.asset&&<><dt>Asset</dt><dd className="hd-mono">{item.asset} · {world.scene.assets.find(a=>a.id===item.asset)?.file}</dd></>}</dl>{item.asset&&<p className="hd-meta">Accepted content hash and provenance are resolved when sent.</p>}</details>
   <button className="b sm q" onClick={()=>onArrange(item.id)}>Arrange in World</button>
  </article>;})}</div>
  <div className="hd-row"><button className="b pri" onClick={focusInput}>Talk about {refs.length===1?'this':'these'}</button><span className="hd-meta">Attached to your next message · revision {world.revision}. No files are copied or newly mounted.</span></div>
 </section>;
}
