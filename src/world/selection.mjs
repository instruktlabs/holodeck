export const MAX_SELECTED_REFS=16;
const validId=id=>typeof id==='string'&&/^[-a-zA-Z0-9_]{1,64}$/.test(id);
const asRef=ref=>({id:ref.id,part:ref.part??null});

// Semantic scopes belong to the authored entity, not whichever triangle was hit.
// Imported GLBs remain whole assets until their author declares a part contract.
export function selectionParts(item){
  return item?.shape?.type==='tree'?[{id:'trunk',label:'Trunk'},{id:'canopy',label:'Canopy'}]:[];
}
// A placement, or a scatter record (its expanded instances select the record).
export function selectableItem(scene,id){
  return scene?.objects?.find(o=>o.id===id)??scene?.scatters?.find(s=>s.id===id)??null;
}
export function validateSelectedRefs(scene,refs){
  if(!Array.isArray(refs)||refs.length>MAX_SELECTED_REFS)throw new Error(`Choose up to ${MAX_SELECTED_REFS} selected references`);
  const seen=new Set();
  return refs.map(ref=>{
    if(!ref||typeof ref!=='object'||Array.isArray(ref)||Object.keys(ref).some(key=>!['id','part'].includes(key))||!validId(ref.id))throw new Error('Invalid selected reference fields');
    if(seen.has(ref.id))throw new Error('Duplicate selected entity; choose one scope for each asset');
    seen.add(ref.id);
    const item=selectableItem(scene,ref.id);
    if(!item)throw new Error(`Selected object ${ref.id} no longer exists; refresh your references`);
    if(ref.part!=null&&!selectionParts(item).some(p=>p.id===ref.part))throw new Error(`Unsupported selected part for ${ref.id}`);
    return asRef(ref);
  });
}
export function toggleSelectedRef(refs,target,{additive=false}={}){
  if(!target||!validId(target.id))throw new Error('Invalid selected object');
  const next=asRef(target);
  if(!additive)return [next];
  const index=refs.findIndex(ref=>ref.id===next.id);
  if(index>=0){
    if((refs[index].part??null)===next.part)return refs.filter((_,i)=>i!==index);
    return refs.map((ref,i)=>i===index?next:asRef(ref));
  }
  if(refs.length>=MAX_SELECTED_REFS)throw new Error(`Choose up to ${MAX_SELECTED_REFS} selected references`);
  return [...refs.map(asRef),next];
}
export function pruneSelectedRefs(scene,refs){
  const result=[],seen=new Set();
  for(const ref of Array.isArray(refs)?refs:[]){
    const item=selectableItem(scene,ref?.id);
    if(!item||seen.has(ref.id))continue;
    seen.add(ref.id);
    result.push({id:ref.id,part:selectionParts(item).some(p=>p.id===ref.part)?ref.part:null});
    if(result.length===MAX_SELECTED_REFS)break;
  }
  return result;
}
