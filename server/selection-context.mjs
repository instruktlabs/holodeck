import {validateSelectedRefs,selectionParts,selectableItem} from '../src/world/selection.mjs';
import {expandScatters} from '../src/world/scatter.mjs';

// Resolve references against accepted scene records. The browser supplies IDs and
// semantic scopes only; it cannot attach arbitrary filesystem paths or metadata.
export function resolveSelectionContext(world,{selectedRefs,selection,assets={}}={}){
  const refs=selectedRefs===undefined?(selection?[{id:selection,part:null}]:[]):selectedRefs;
  const selected=validateSelectedRefs(world.scene,refs);
  const entities=selected.map(ref=>{
    const item=selectableItem(world.scene,ref.id);
    if(world.scene.scatters?.includes(item)){
      const placed=expandScatters(world.scene).stats.find(s=>s.id===item.id)?.placed??0;
      return {id:item.id,label:item.label||item.id,scope:'whole',availableParts:[],scatter:{...item,placed}};
    }
    const asset=item.asset?world.scene.assets.find(a=>a.id===item.asset):null;
    const revision=asset?assets[asset.id]:null;
    return {
      id:item.id,label:item.label||item.id,scope:ref.part||'whole',availableParts:selectionParts(item),
      placement:{position:item.position,rotation:item.rotation,scale:item.scale,layer:item.layer||'world'},
      collider:item.collider??null,behavior:item.behavior??null,
      ...(item.shape?{shape:item.shape}:{}),
      ...(item.materialStyle?{materialStyle:item.materialStyle}:{}),
      ...(item.light?{light:item.light}:{}),
      ...(asset?{asset:{id:asset.id,file:asset.file,hash:revision?.hash||null,provenance:asset.provenance||null}}:{}),
    };
  });
  return structuredClone({acceptedRevision:world.revision,selectedRefs:selected,entities});
}
