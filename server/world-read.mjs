import {expandScatters} from '../src/world/scatter.mjs';

// world_read answers in sections so no single tool result reaches an agent's
// output limit (H35). Measured on Claude Code 2.1.300 with world-like JSON: a
// 48.5 KB result arrived inline and a 56 KB one was saved to a file under
// ~/.claude, which the agent then had to ask to read. Every section response
// stays under half of that.
export const WORLD_READ_LIMIT=24000;
export const WORLD_READ_SECTIONS=['overview','scene','bible','objects','scatters','assets','files','references','capabilities'];
const PAGED=new Set(['scene','objects','scatters','assets','files','references','capabilities']);
const size=value=>JSON.stringify(value).length;
const LISTS='objects, scatters and assets';

function cursorStart(cursor,revision){
  if(cursor===undefined||cursor===null||cursor==='')return 0;
  const match=typeof cursor==='string'&&/^r(-?\d+):(\d+)$/.exec(cursor);
  if(!match)throw new Error('Invalid world_read cursor');
  if(Number(match[1])!==revision)throw new Error(`The world changed to revision ${revision} since this cursor; read the section again from the start`);
  return Number(match[2]);
}
// Fills one page with whole items up to the byte budget. An item larger than
// the budget is returned alone, so paging always advances.
function page(items,cursor,revision,budget){
  const start=cursorStart(cursor,revision);if(start>items.length)throw new Error('Invalid world_read cursor');
  const out=[];let used=2,i=start;
  for(;i<items.length;i++){const bytes=size(items[i])+1;if(out.length&&used+bytes>budget)break;out.push(items[i]);used+=bytes;}
  return {items:out,start,total:items.length,next:i<items.length?`r${revision}:${i}`:null};
}

const round=v=>Math.round(v*10)/10;
function objectsByAsset(objects){
  const groups=new Map();
  for(const o of objects){
    const key=o.asset??`shape:${o.shape?.type??'none'}`;
    let g=groups.get(key);if(!g){g={asset:key,count:0,layers:new Set(),min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity],behaviors:0,colliders:0,lights:0};groups.set(key,g);}
    g.count++;if(o.layer)g.layers.add(o.layer);if(o.behavior)g.behaviors++;if(o.collider)g.colliders++;if(o.light)g.lights++;
    o.position?.forEach((v,i)=>{g.min[i]=Math.min(g.min[i],v);g.max[i]=Math.max(g.max[i],v);});
  }
  return [...groups.values()].map(g=>({...g,layers:[...g.layers],min:g.min.map(round),max:g.max.map(round)}));
}
function scatterSummary(scene){
  if(!scene.scatters?.length)return [];
  let stats=[];try{stats=expandScatters(scene).stats;}catch{}
  return scene.scatters.map(s=>({id:s.id,variants:s.variants.map(v=>v.asset),placed:stats.find(t=>t.id===s.id)?.placed??null}));
}
// Capabilities page as flat entries; spatial entries keep their dotted key.
function capabilityEntries(capabilities){
  const entries=[];
  for(const [key,value] of Object.entries(capabilities)){
    if(key==='spatial'&&value&&typeof value==='object')for(const [k,v] of Object.entries(value))entries.push([`spatial.${k}`,v]);
    else entries.push([key,value]);
  }
  return entries;
}

export function worldReadSection(source,{section='overview',asset,cursor}={}){
  const {world,hashes={},textures={},height=null,workspace,diagnostic,files=[],capabilities}=source;
  if(!WORLD_READ_SECTIONS.includes(section))throw new Error(`Unknown world_read section ${section}; use one of ${WORLD_READ_SECTIONS.join(', ')}`);
  if(asset!==undefined&&section!=='objects')throw new Error('asset filters only the objects section');
  if(cursor!==undefined&&!PAGED.has(section))throw new Error(`The ${section} section has no pages`);
  const scene=world.scene??{},revision=world.revision,objects=scene.objects??[];
  const {objects:_o,assets:_a,scatters:_s,...settings}=scene;
  const head={section,revision,schemaVersion:world.schemaVersion};
  const budget=WORLD_READ_LIMIT-1000;
  const counts={objects:objects.length,scatters:scene.scatters?.length??0,assets:scene.assets?.length??0,files:files.length,references:world.references?.length??0};
  const paged=(items,map=x=>x)=>{const p=page(items,cursor,revision,budget);return {...head,...(section==='objects'&&asset?{asset}:{}),items:p.items.map(map),start:p.start,total:p.total,next:p.next};};
  if(section==='overview'){
    const overview={...head,workspace,diagnostic,counts,sections:`Pass {section, cursor} for more: scene (settings), bible, ${LISTS} (asset IDs with files and hashes), files (importable GLBs), references (mood board), capabilities (what the runtime supports). Pages end with next; pass it as cursor until next is null. objects takes an optional asset filter. The whole accepted scene is also world/world.json in this folder.`,
      scene:settings,objectsByAsset:objectsByAsset(objects),scatters:scatterSummary(scene),bible:world.bible};
    // Keep the overview under the limit by moving the bible, then the scene
    // settings, to their own sections.
    if(size(overview)>budget)overview.bible='Too large for the overview; read section bible.';
    if(size(overview)>budget)overview.scene=`Too large for the overview; read section scene. Keys: ${Object.keys(settings).join(', ')}`;
    // A world with hundreds of unique assets (a modular kit) has one group per
    // asset, more than the overview holds. Keep the most-placed groups, in their
    // original order, and say where the rest are.
    if(size(overview)>budget){
      const groups=overview.objectsByAsset,rank=groups.map((g,i)=>i).sort((a,b)=>groups[b].count-groups[a].count||a-b);
      const keep=n=>{const kept=new Set(rank.slice(0,n));const shown=groups.filter((_,i)=>kept.has(i));const omitted=groups.filter((_,i)=>!kept.has(i));
        return {...overview,objectsByAsset:shown,objectsByAssetOmitted:{groups:omitted.length,objects:omitted.reduce((n,g)=>n+g.count,0),note:'The least-placed asset groups are left out to keep the overview small; read section assets for every asset, or section objects with an asset filter.'}};};
      let lo=0,hi=groups.length;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(size(keep(mid))<=budget)lo=mid;else hi=mid-1;}
      return keep(lo);
    }
    return overview;
  }
  if(section==='bible')return {...head,bible:world.bible};
  if(section==='scene'){const {items,...p}=paged(Object.entries(settings));return {...p,settings:Object.fromEntries(items)};}
  if(section==='objects'){
    if(asset!==undefined&&(typeof asset!=='string'||!objects.some(o=>(o.asset??`shape:${o.shape?.type??'none'}`)===asset)))throw new Error(`No objects use asset ${asset}`);
    return paged(asset?objects.filter(o=>(o.asset??`shape:${o.shape?.type??'none'}`)===asset):objects);
  }
  if(section==='scatters')return paged(scene.scatters??[]);
  // A heightmap's samples are listed by file, hash, byte count and size; never the samples.
  if(section==='assets')return paged([...(scene.assets??[]).map(a=>({...a,hash:hashes[a.file]??null})),...Object.entries(textures).map(([file,hash])=>({texture:file,hash})),...(height?[{height:height.file,hash:height.hash,bytes:height.bytes,size:height.size}]:[])]);
  if(section==='files')return paged(files);
  if(section==='references')return paged(world.references??[]);
  const {items,...p}=paged(capabilityEntries(capabilities));return {...p,capabilities:Object.fromEntries(items)};
}
