import React,{useEffect,useMemo,useRef,useState} from 'react';
import * as THREE from 'three/webgpu';
import {useWorldClient} from './client.js';
import {useEditorDraft} from './world-drafts.jsx';
import {BOARD_WIDTH,BOARD_HEIGHT,BOARD_THEMES,referenceKind,cardLayout,boardPage,boardStyle} from './board.mjs';
import {ImageStudio} from './image-studio.jsx';
export const referenceUrl=(r,scopedUrl=value=>value)=>scopedUrl(`/api/references/${r.file.split('/').at(-1)}`);
async function upload(route,body,name,worldFetch){const response=await worldFetch(`${route}?name=${encodeURIComponent(name)}`,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body});const value=await response.json();if(!response.ok)throw new Error(value.error);return value;}
export async function uploadReference(file,worldFetch){
  if(file.size>24*1024*1024)throw new Error('Choose an image smaller than 24 MiB');
  const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>64*1024*1024){bitmap.close();throw new Error('Reference image is too large');}
  const ratio=Math.min(1,2048/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  return upload('/api/reference/import',await new Promise(resolve=>canvas.toBlob(resolve,'image/png')),file.name.replace(/\.[^.]+$/,''),worldFetch);
}
const hydrate=world=>({scene:structuredClone(world.scene),bible:structuredClone(world.bible),references:(world.references||[]).map((r,i)=>({...r,layout:cardLayout(r,i),page:boardPage(r,i)}))});
export function MoodBoardEditor({world,run,agent,model,effort,drafts,draftFocus,writeDisabled}){
  const {api,fetch:worldFetch,url:scopedUrl}=useWorldClient();
  const [studio,setStudio]=useState(false);
  const hydrated=useMemo(()=>hydrate(world),[world]);
  const {draft,base,dirty,change:edit,saved:markSaved,reset}=useEditorDraft(drafts,'board',hydrated,world.revision,{label:'mood board',panel:'references'});
  const [selected,setSelected]=useState(null),[group,setGroup]=useState('All');
  const {draft:pointer,change:editPointer,reset:clearPointer,saved:pointerSaved}=useEditorDraft(drafts,'reference-path','',0,{label:'reference file path',panel:'references'});
  const setPointer=value=>value?editPointer(value):clearPointer();
  useEffect(()=>{if(draftFocus?.id==='image-prompt')setStudio(true);if(draftFocus?.id==='reference-path')setSelected(null);},[draftFocus]);
  const surface=useRef(),drag=useRef(),[scale,setScale]=useState(.5);
  useEffect(()=>{const el=surface.current;if(!el)return;const observer=new ResizeObserver(()=>setScale(el.clientWidth/BOARD_WIDTH));observer.observe(el);return()=>observer.disconnect();},[]);
  const refs=draft.references,board=draft.scene.moodboard,style=boardStyle(board),colors=BOARD_THEMES[style.theme],page=board?.page||0,ref=refs.find(r=>r.id===selected),pins=draft.bible.referenceIds||[];
  const update=(id,patch)=>edit(d=>({...d,references:d.references.map(r=>r.id===id?{...r,...patch}:r)}));
  const updateBoard=patch=>edit(d=>({...d,scene:{...d.scene,moodboard:{...d.scene.moodboard,...patch}}}));
  function add(items){edit(d=>({...d,references:[...d.references,...items.filter(r=>!d.references.some(x=>x.id===r.id)).map((r,i)=>({...r,group:group==='All'?'Inspiration':group,status:'exploring',page,layout:{x:40+(i%3)*30,y:125+(i%3)*30,w:350,h:310}}))]}));if(items.length)setSelected(items.at(-1).id);}
  function remove(){edit(d=>({...d,references:d.references.filter(r=>r.id!==selected),bible:{...d.bible,referenceIds:(d.bible.referenceIds||[]).filter(id=>id!==selected)}}));setSelected(null);}
  function pin(){edit(d=>({...d,bible:{...d.bible,referenceIds:pins.includes(selected)?pins.filter(id=>id!==selected):[...pins,selected]}}));}
  function startDrag(e,r){if(e.button!==0)return;e.preventDefault();setSelected(r.id);e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:r.id,x:e.clientX,y:e.clientY,layout:r.layout};}
  function moveDrag(e){const d=drag.current;if(!d)return;const l=d.layout;update(d.id,{layout:{...l,x:Math.max(0,Math.min(BOARD_WIDTH-l.w,l.x+(e.clientX-d.x)/scale)),y:Math.max(100,Math.min(BOARD_HEIGHT-l.h,l.y+(e.clientY-d.y)/scale))}});}
  const visible=refs.filter(r=>r.page===page&&(group==='All'||(r.group||'Inspiration')===group));
  return <div className="board-workspace">
    <div className="board-toolbar"><button onClick={()=>add([{id:`note-${crypto.randomUUID().slice(0,8)}`,kind:'note',title:'An idea to explore',notes:'What should this world feel like?'}])}>+ Note</button>
      <button onClick={()=>setStudio(v=>!v)} aria-pressed={studio}>Generate image</button>
      <label className="board-upload">+ Images<input disabled={writeDisabled} multiple type="file" aria-label="Add board images" accept="image/png,image/jpeg,image/webp" onChange={e=>{const files=[...e.target.files];e.target.value='';run(async()=>{const items=[];for(const file of files)items.push(await uploadReference(file,worldFetch));add(items);});}}/></label>
      <label className="board-upload">+ Files<input disabled={writeDisabled} multiple type="file" aria-label="Attach reference files" accept=".md,.txt,.json,.pdf,.glb" onChange={e=>{const files=[...e.target.files];e.target.value='';run(async()=>{const items=[];for(const f of files)items.push(await upload('/api/reference/file',f,f.name,worldFetch));add(items);});}}/></label>
      <select aria-label="Filter board category" value={group} onChange={e=>setGroup(e.target.value)}>{['All',...new Set(refs.map(r=>r.group||'Inspiration'))].map(g=><option key={g}>{g}</option>)}</select>
      <button className="primary" disabled={writeDisabled||!dirty||base!==world.revision} onClick={()=>run(async()=>{await api('world',{baseRevision:base,...draft} );markSaved();})}>Save board</button>
    </div>
    {studio&&<ImageStudio {...{agent,model,effort,world,dirty,run,drafts,writeDisabled}} onAdd={add}/>}
    {dirty&&base!==world.revision&&<p className="notice">A newer world revision exists. Your draft is kept here; reload the saved board before applying edits.</p>}
    <div className="board-edit-layout"><div>
      <div className="board-viewport" ref={surface} style={{height:BOARD_HEIGHT*scale}}><div className="board-surface" style={{width:BOARD_WIDTH,height:BOARD_HEIGHT,transform:`scale(${scale})`,background:colors.background,color:colors.ink}}>
        <div className="board-heading"><h3>{style.title}</h3><span>{page+1} / 34 · {visible.length} ideas · drag cards to arrange</span></div>
        {visible.map(r=><article key={r.id} tabIndex={0} aria-label={`Board card: ${r.title}`} onFocus={()=>setSelected(r.id)} onPointerDown={e=>startDrag(e,r)} onPointerMove={moveDrag} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} className={`board-tile ${selected===r.id?'selected':''}`} style={{left:r.layout.x,top:r.layout.y,width:r.layout.w,height:r.layout.h,background:colors.card,color:colors.ink}}>
          <span className="board-category">{r.group||'Inspiration'} · {pins.includes(r.id)?'● Bible':r.status||'exploring'}</span>
          {referenceKind(r)==='image'?<img draggable="false" src={referenceUrl(r,scopedUrl)} alt={r.title}/>:referenceKind(r)==='file'?<div className="board-file-symbol">↗ <span>{r.file.split('.').at(-1).toUpperCase()} REFERENCE</span></div>:null}
          <h4>{r.title}</h4><p>{r.notes||'Add a note about why this belongs.'}</p>
        </article>)}
        {!visible.length&&<div className="board-empty">A little space for your next idea.<small>Add an image, a note, or a reference file.</small></div>}
      </div></div>
      <div className="board-footer"><button disabled={page===0} onClick={()=>updateBoard({page:page-1})}>←</button><span>Sheet {page+1}</span><button disabled={page===33} onClick={()=>updateBoard({page:page+1})}>→</button><small>{dirty?'Unsaved board draft':`Saved · revision ${base}`} · {refs.length} cards</small><button onClick={reset}>Discard board draft</button></div>
      <p className="board-help">Arrange ideas here, then save to the screen in your cove. The agent reads this same board and opens the original reference when needed.</p>
    </div><section className="board-inspector" aria-label="Board inspector">
      {ref?<><span className="eyebrow">{referenceKind(ref)} · {ref.id}</span><label>Title<input aria-label="Card title" value={ref.title} maxLength={160} onChange={e=>update(ref.id,{title:e.target.value})}/></label><label>Why this matters<textarea aria-label="Card notes" rows={5} value={ref.notes} maxLength={2000} onChange={e=>update(ref.id,{notes:e.target.value})}/></label>
        <label>Category<input aria-label="Card category" list="board-categories" value={ref.group||''} maxLength={64} onChange={e=>update(ref.id,{group:e.target.value})}/><datalist id="board-categories">{['Atmosphere','Materials','Architecture','Experience','Rules',...new Set(refs.map(r=>r.group).filter(Boolean))].map((g,i)=><option key={`${g}-${i}`}>{g}</option>)}</datalist></label>
        <label>Direction<select aria-label="Card direction" value={ref.status||'exploring'} onChange={e=>update(ref.id,{status:e.target.value})}><option value="exploring">Exploring</option><option value="approved">Approved direction</option><option value="rejected">Avoid this</option></select></label>
        <button aria-pressed={pins.includes(ref.id)} onClick={pin}>{pins.includes(ref.id)?'Unpin from bible':'Pin to bible'}</button>
        <details><summary>Size and placement</summary><div className="vector-fields">{['x','y','w','h'].map(k=><label key={k}>{k}<input aria-label={`Card ${k}`} type="number" value={Math.round(ref.layout[k])} onChange={e=>update(ref.id,{layout:{...ref.layout,[k]:Number(e.target.value)}})}/></label>)}</div><label>Sheet<input type="number" min="1" max="34" value={ref.page+1} onChange={e=>update(ref.id,{page:Number(e.target.value)-1})}/></label><button onClick={()=>edit(d=>({...d,references:[...d.references.filter(r=>r.id!==ref.id),ref]}))}>Bring to front</button></details>
        {ref.file&&<><a className="reference-file-link" href={referenceUrl(ref,scopedUrl)} download={ref.title}>Open reference file ↗</a><small className="workspace-path">{ref.file}</small></>}
        {ref.generation&&<details><summary>Generated with Codex</summary><p>{ref.generation.prompt}</p><small>{ref.generation.referenceIds.length} input references · {ref.generation.turnId}</small></details>}
        {ref.source&&<><small>Linked workspace source: {ref.source}</small><button disabled={writeDisabled} onClick={()=>run(async()=>{const next=await api('reference/link',{file:ref.source});update(ref.id,{...next,id:ref.id,status:'exploring'});if(pins.includes(ref.id))pin();})}>Refresh from source</button></>}
        {referenceKind(ref)==='image'&&<label className="board-upload">Replace image<input disabled={writeDisabled} type="file" aria-label="Replace board image" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files[0];e.target.value='';if(f)run(async()=>{const next=await uploadReference(f,worldFetch);edit(d=>({...d,references:d.references.map(r=>r.id===ref.id?{...r,file:next.file,source:undefined,generation:undefined,status:'exploring'}:r),bible:{...d.bible,referenceIds:(d.bible.referenceIds||[]).filter(id=>id!==ref.id)}}));});}}/></label>}
        <div className="button-row"><button onClick={remove}>Remove card</button><button onClick={()=>setSelected(null)}>Board settings</button></div>
      </>:<><span className="eyebrow">YOUR REFERENCE SPACE</span><label>Board title<input value={style.title} maxLength={120} onChange={e=>updateBoard({title:e.target.value})}/></label><label>Surface<select value={style.theme} onChange={e=>updateBoard({theme:e.target.value})}>{Object.keys(BOARD_THEMES).map(t=><option key={t}>{t}</option>)}</select></label>
        <label>Link a workspace file<input aria-label="Workspace reference path" value={pointer} onChange={e=>setPointer(e.target.value)} placeholder="assets/source/design-notes.md"/></label><button disabled={writeDisabled||!pointer} onClick={()=>run(async()=>{add([await api('reference/link',{file:pointer})]);pointerSaved();})}>Add file pointer</button>{pointer&&<button onClick={clearPointer}>Discard file path</button>}<small>Imports a versioned copy. Refresh it from its source when needed. MD, TXT, JSON, PNG, PDF and GLB.</small>
        {board&&<details><summary>Place the physical board</summary><div className="vector-fields">{['X','Y','Z'].map((axis,i)=><label key={axis}>{axis}<input type="number" step="0.1" value={board.position[i]} onChange={e=>updateBoard({position:board.position.map((n,j)=>j===i?Number(e.target.value):n)})}/></label>)}</div><label>Turn (degrees)<input type="number" value={Math.round(board.rotation[1]*180/Math.PI)} onChange={e=>updateBoard({rotation:[0,Number(e.target.value)*Math.PI/180,0]})}/></label></details>}
        <p>Select a card to edit its meaning, category, size or bible pin. “Avoid this” is useful direction for your agent too.</p></>}
    </section></div>
  </div>;
}
function lines(ctx,text,x,y,width,lineHeight,maxLines){if(maxLines<=0)return;let count=0;for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(/\s+/)){const candidate=line?`${line} ${word}`:word;if(line&&ctx.measureText(candidate).width>width){ctx.fillText(line,x,y+count++*lineHeight);line=word;if(count>=maxLines)return;}else line=candidate;}ctx.fillText(line,x,y+count++*lineHeight);if(count>=maxLines)return;}}
export function MoodBoard({model,board,references,pins,select}){
  const {url:scopedUrl}=useWorldClient();
  const object=useMemo(()=>{const clone=model.scene.clone(true);clone.traverse(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true;m.userData={...m.userData,target:'moodboard'};}});return clone;},[model]);
  const texture=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=1440;const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;},[]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  useEffect(()=>{
    let canceled=false;const style=boardStyle(board),c=BOARD_THEMES[style.theme],visible=references.map((r,i)=>({...r,layout:cardLayout(r,i),page:boardPage(r,i)})).filter(r=>r.page===board.page);
    const draw=images=>{if(canceled)return;const ctx=texture.image.getContext('2d');ctx.setTransform(2,0,0,2,0,0);ctx.fillStyle=c.background;ctx.fillRect(0,0,1200,720);ctx.fillStyle=c.ink;ctx.font='30px Georgia';ctx.fillText(style.title.slice(0,65),30,47);ctx.font='13px sans-serif';ctx.fillStyle=c.muted;ctx.fillText(`SHEET ${board.page+1}   /   ${visible.length} IDEAS   /   SELECT TO EDIT`,32,75);
      for(const r of visible){const {x,y,w,h}=r.layout;ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.fillStyle=c.card;ctx.fillRect(x,y,w,h);ctx.fillStyle=c.muted;ctx.font='11px sans-serif';ctx.fillText(`${r.group||'Inspiration'}  ·  ${pins.includes(r.id)?'● BIBLE':r.status||'exploring'}`.toUpperCase().slice(0,55),x+16,y+24);let ty=y+56;
        if(referenceKind(r)==='image'){const image=images.get(r.id),ih=Math.max(40,h*.54),iw=w-32;if(image){const s=Math.min(iw/image.width,ih/image.height);ctx.drawImage(image,x+16+(iw-image.width*s)/2,y+37,image.width*s,image.height*s);}ty=y+ih+62;}
        if(referenceKind(r)==='file'){ctx.font='18px sans-serif';ctx.fillStyle=c.accent;ctx.fillText(`↗ ${r.file.split('.').at(-1).toUpperCase()} REFERENCE`,x+16,ty);ty+=35;}
        ctx.fillStyle=c.ink;ctx.font='22px Georgia';lines(ctx,r.title,x+16,ty,w-32,26,2);ty+=r.title.length>w/11?55:32;ctx.font='15px sans-serif';lines(ctx,r.notes,x+16,ty,w-32,22,Math.max(0,Math.floor((y+h-ty-8)/22)));ctx.restore();
      }texture.needsUpdate=true;
    };
    draw(new Map());Promise.all(visible.filter(r=>referenceKind(r)==='image').map(r=>new Promise(resolve=>{const image=new Image();image.onload=()=>resolve([r.id,image]);image.onerror=()=>resolve([r.id,null]);image.src=referenceUrl(r,scopedUrl);}))).then(entries=>draw(new Map(entries)));return()=>{canceled=true;};
  },[texture,references,pins,board]);
  return <group position={board.position} rotation={board.rotation} onClick={e=>{e.stopPropagation();select('moodboard');}}><primitive object={object} dispose={null}/><mesh position={[.081,1.72,0]} rotation={[0,Math.PI/2,0]} userData={{target:'moodboard'}} receiveShadow><planeGeometry args={[2.48,1.45]}/><meshStandardMaterial map={texture} roughness={.9} emissive="#ffffff" emissiveMap={texture} emissiveIntensity={.28}/></mesh></group>;
}
