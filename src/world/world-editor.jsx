import React,{useEffect,useMemo,useState} from 'react';
import {useWorldClient} from './client.js';
import {useEditorDraft} from './world-drafts.jsx';
import {probe} from '../prototype/scene.jsx';
import {Icon} from './icons.jsx';
import {groupPlacements,locatePlacement} from './placement-groups.mjs';
import {MAX_ASSETS,LEGACY_MAX_ASSETS,MAX_PLACEMENTS,MAX_PLACED_TRIANGLES,placedSourceTriangles} from './asset-budget.mjs';
import {expandScatters} from './scatter.mjs';

function PlacementEditor({world,item,run,drafts,removed=false,writeDisabled,onFocusItem}){
  const {api}=useWorldClient();
  const {draft,base,dirty,change:edit,saved:markSaved,reset}=useEditorDraft(drafts,`placement/${item.id}`,item,world.revision,{label:`${item.id} placement`,panel:'scene',item:item.id});
  const change=(field,i,value)=>edit(d=>({...d,[field]:d[field].map((n,j)=>j===i?Number(value):n)}));
  const stale=dirty&&base!==world.revision;
  return <div className="hd-card hd-placement" aria-label={`Edit ${item.id}`}>
    <div className="hd-row"><strong>{item.label||item.id}</strong><span className="hd-meta">{removed?'removed in a newer revision':dirty?'unsaved change':item.asset||item.shape?.type}</span>{onFocusItem&&<button className="b sm q hd-end" onClick={()=>onFocusItem(item.id)}>Reference</button>}</div>
    {removed&&<p className="hd-notice">This object was removed in a newer revision. Copy your values if needed, then discard this draft.</p>}
    <div className="hd-vectors">{['position','rotation','scale'].map(field=><React.Fragment key={field}><span className="hd-meta">{field==='rotation'?'Rotation':field==='position'?'Position':'Scale'}</span>{['X','Y','Z'].map((axis,i)=><label key={axis} className="hd-field">{axis}<input aria-label={`${field} ${axis}`} type="number" step="0.1" value={draft[field][i]} onChange={e=>change(field,i,e.target.value)}/></label>)}</React.Fragment>)}</div>
    <span className="hd-meta">Metres and radians, XYZ order. Saving makes revision {world.revision+1}; it loads where you stand.</span>
    {stale&&<p className="hd-notice">The world changed. Reselect the placement before saving.</p>}
    <div className="hd-row"><button className="b pri" disabled={writeDisabled||removed||!dirty||stale} onClick={()=>run(async()=>{await api('world',{baseRevision:base,scene:{...world.scene,objects:world.scene.objects.map(o=>o.id===item.id?draft:o)}});markSaved();})}>Save placement</button><button className="b" disabled={!dirty} onClick={reset}>Discard</button>
      <button className="b q hd-end" disabled={writeDisabled||removed} onClick={()=>run(()=>api('world',{baseRevision:world.revision,scene:{...world.scene,objects:world.scene.objects.filter(x=>x.id!==item.id)}}))}>Remove</button></div>
  </div>;
}

function Meter({label,used,max,format=n=>n.toLocaleString()}){
  const share=Math.min(1,used/max);
  return <div className="hd-meter-wrap"><span className="hd-meta">{label} {format(used)} / {format(max)}</span><div className={`hd-meter ${share>.9?'warn':''}`}><i style={{width:`${share*100}%`}}/></div></div>;
}
const millions=n=>n>=1e6?`${(n/1e6).toFixed(2)}M`:n.toLocaleString();

// The World tab: budgets, a grouped and filterable outline, and in-place editing of
// whatever is selected in the viewport or the outline.
export function WorldEditor({world,run,selected,setSelected,runtime,drafts,draftFocus,writeDisabled,assets,busy,onReference}){
  const {api,fetch:worldFetch}=useWorldClient();
  const [filter,setFilter]=useState(''),[open,setOpen]=useState({}),[docOpen,setDocOpen]=useState(false);
  const outline=useMemo(()=>groupPlacements(world.scene.objects,filter),[world.scene.objects,filter]);
  const editing=draftFocus?.item||selected;
  // A viewport selection opens its family and asset so the editor is in view.
  useEffect(()=>{const at=editing&&locatePlacement(groupPlacements(world.scene.objects).groups,editing);if(at)setOpen(o=>({...o,[at.family]:true,[`${at.family}/${at.asset}`]:true}));},[editing,world.scene.objects]);
  useEffect(()=>{if(draftFocus?.id==='scene')setDocOpen(true);},[draftFocus]);
  const placed=world.scene.objects.find(o=>o.id===editing),orphan=drafts.getSnapshot()[`placement/${editing}`],placement=placed??(orphan?.dirty?orphan.value:null);
  const triangles=useMemo(()=>{try{return placedSourceTriangles(world.scene,assets||{});}catch{return null;}},[world.scene,assets]);
  // Scatter instances count toward the placement limit, as in the contract.
  const placedCount=useMemo(()=>{try{return world.scene.objects.length+(world.scene.scatters?.length?expandScatters(world.scene).stats.reduce((n,x)=>n+x.placed,0):0);}catch{return world.scene.objects.length;}},[world.scene]);
  const savedSource=useMemo(()=>JSON.stringify(world.scene,null,2),[world.scene]);
  const {draft:source,base,dirty,change:setSource,saved:markSaved,reset}=useEditorDraft(drafts,'scene',savedSource,world.revision,{label:'scene document',panel:'scene'});
  async function preset(type){await api('world',{baseRevision:world.revision,scene:{...world.scene,environment:{...world.scene.environment,type},bridge:type==='woodland'?world.scene.bridge:null}});}
  async function upload(file){
    if(!file)return;const r=await worldFetch(`/api/import?name=${encodeURIComponent(file.name)}`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:file});const asset=await r.json();if(!r.ok)throw new Error(asset.error);
    const yaw=probe.look?.yaw||0,p=(probe.cameraMode==='walk'?probe.actorEye:null)??probe.position??[0,1.72,0],id=`placed-${crypto.randomUUID().slice(0,8)}`,x=p[0]-Math.sin(yaw)*4,z=p[2]-Math.cos(yaw)*4;
    const y=runtime?.terrain?.sample(x,z).height??0;
    await api('world',{baseRevision:world.revision,scene:{...world.scene,assets:[...world.scene.assets.filter(a=>a.id!==asset.id),asset],objects:[...world.scene.objects,{id,asset:asset.id,position:[x,y,z],rotation:[0,0,0],scale:[1,1,1],collider:null}]}});
    setSelected(id);
  }
  const toggle=key=>setOpen(o=>({...o,[key]:!o[key]}));
  return <div className="hd-world-editor">
    <div className="hd-meters"><Meter label="Assets" used={world.scene.assets.length} max={world.schemaVersion===2?MAX_ASSETS:LEGACY_MAX_ASSETS}/><Meter label="Placed" used={placedCount} max={MAX_PLACEMENTS}/>{triangles!==null&&<Meter label="Triangles" used={triangles} max={MAX_PLACED_TRIANGLES} format={millions}/>}</div>
    <div className="hd-row hd-filter">
      <label className="hd-search"><Icon name="search" size={16}/><input aria-label="Filter placements" value={filter} onChange={e=>setFilter(e.target.value)} placeholder={`Filter ${world.scene.objects.length} placements`}/></label>
      {filter&&<span className="hd-meta">{outline.matched} match</span>}
    </div>
    <div className="hd-outline" role="tree" aria-label="Placements by family and asset">
      {outline.groups.map(g=>{const gOpen=!!(open[g.key]||filter);return <div key={g.key} role="treeitem" aria-expanded={gOpen}>
        <button className="hd-grp" onClick={()=>toggle(g.key)}><Icon name={gOpen?'down':'right'} size={15}/><strong>{g.label}</strong><span className="hd-meta">{g.assets.length} {g.assets.length===1?'asset':'assets'}</span><span className="hd-count">{g.count}</span></button>
        {gOpen&&g.assets.map(a=>{const key=`${g.key}/${a.asset}`,aOpen=!!(open[key]||(filter&&a.count<=12));return <div key={a.asset}>
          <button className={`hd-sub ${a.ids.includes(editing)?'on':''}`} onClick={()=>toggle(key)}><Icon name={aOpen?'down':'right'} size={13}/><span>{a.asset}</span><span className="hd-count">{a.count}</span></button>
          {aOpen&&<div className="hd-items">{a.ids.slice(0,60).map(id=><React.Fragment key={id}>
            <button className={`hd-item ${id===editing?'on':''}`} aria-current={id===editing} onClick={()=>setSelected(id===editing?null:id)}>{world.scene.objects.find(o=>o.id===id)?.label||id}</button>
            {id===editing&&placement&&<PlacementEditor key={id} world={world} item={placement} run={run} drafts={drafts} removed={!placed} writeDisabled={writeDisabled} onFocusItem={onReference}/>}
          </React.Fragment>)}{a.ids.length>60&&<span className="hd-meta">{a.ids.length-60} more; narrow the filter to reach them.</span>}</div>}
        </div>;})}
      </div>;})}
      {!outline.groups.length&&<p className="hd-empty">No placements match “{filter}”.</p>}
      {editing&&!placed&&placement&&<PlacementEditor key={editing} world={world} item={placement} run={run} drafts={drafts} removed writeDisabled={writeDisabled}/>}
    </div>
    <p className="hd-meta">Click anything in the world to select it here. Shift-click adds it to your next message.</p>
    <details className="hd-details"><summary>Environment and imports</summary>
      <label>Environment<select disabled={writeDisabled} aria-label="Environment" value={world.scene.environment.type} onChange={e=>run(()=>preset(e.target.value))}><option value="construct">Empty construct</option><option value="meadow">Open meadow</option>{world.schemaVersion===1&&<option value="woodland">Woodland & stream</option>}</select></label>
      <label className="hd-upload">Add a Kiln GLB<input disabled={writeDisabled} type="file" accept=".glb" onChange={e=>{const file=e.target.files[0];e.target.value='';run(()=>upload(file));}}/></label>
      <span className="hd-meta">Places a self-contained GLB four metres ahead of the camera, then selects it.</span>
    </details>
    <details className="hd-details" open={docOpen} onToggle={e=>setDocOpen(e.currentTarget.open)}><summary>Scene document</summary><p className="hd-meta">Transforms use metres and radians. Optional collider: {`{"type":"box","size":[1,1,1],"offset":[0,0.5,0]}`}</p>
      {docOpen&&<textarea className="hd-code-editor" aria-label="Scene document" rows={18} value={source} onChange={e=>setSource(e.target.value)}/>}
      {dirty&&base!==world.revision&&<p className="hd-notice">A newer revision exists. Reload before saving; your draft is still here.</p>}
      <div className="hd-row"><button className="b" disabled={writeDisabled||!dirty||base!==world.revision} onClick={()=>run(async()=>{await api('world',{baseRevision:base,scene:JSON.parse(source)});markSaved();})}>Save scene</button><button className="b q" onClick={reset}>Discard scene draft</button></div>
    </details>
    <div className="hd-row"><button className="b q" disabled={writeDisabled||!world.revision||busy} onClick={()=>run(()=>api('undo',{baseRevision:world.revision}))}>Undo last world edit</button></div>
  </div>;
}
