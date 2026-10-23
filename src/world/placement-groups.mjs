// World panel outline: placements grouped by family and asset, with counts and a filter.
// Hundreds of placements collapse to a few rows; the list never renders every ID at once.
const familyOf=o=>{
  if(o.layer==='origin')return 'cove';
  const id=o.asset??(o.shape?`shape-${o.shape.type}`:'other');
  return id.includes('-')?id.split('-')[0]:id;
};
const label=key=>key.charAt(0).toUpperCase()+key.slice(1);

export function groupPlacements(objects=[],filter=''){
  const query=filter.trim().toLowerCase(),families=new Map();
  let matched=0;
  for(const o of objects){
    const asset=o.asset??(o.shape?`shape:${o.shape.type}`:'other');
    if(query&&![o.id,o.label,asset].some(v=>String(v||'').toLowerCase().includes(query)))continue;
    matched++;
    const key=familyOf(o);
    if(!families.has(key))families.set(key,{key,label:key==='cove'?'Cove':label(key),count:0,assets:new Map()});
    const family=families.get(key);family.count++;
    if(!family.assets.has(asset))family.assets.set(asset,{asset,count:0,ids:[]});
    const entry=family.assets.get(asset);entry.count++;entry.ids.push(o.id);
  }
  const groups=[...families.values()].map(f=>({...f,assets:[...f.assets.values()].sort((a,b)=>b.count-a.count||a.asset.localeCompare(b.asset))}))
    .sort((a,b)=>(a.key==='cove')-(b.key==='cove')||b.count-a.count||a.key.localeCompare(b.key));
  return {groups,total:objects.length,matched};
}

// Where an ID sits in the outline, so a viewport selection can open its group.
export function locatePlacement(groups,id){
  for(const g of groups)for(const a of g.assets)if(a.ids.includes(id))return {family:g.key,asset:a.asset};
  return null;
}
