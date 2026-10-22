// Reviewable differences between the accepted world and a staged proposal.
// Pure data for the review card: no DOM, no rendering, nothing applied.
import {expandScatters} from './scatter.mjs';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const byId=list=>new Map((list||[]).map(item=>[item.id,item]));
const changedKeys=(a={},b={})=>[...new Set([...Object.keys(a||{}),...Object.keys(b||{})])].filter(key=>!same(a?.[key],b?.[key])).sort();
const TRANSFORM=['position','rotation','scale'];
export const placementGroup=o=>o.asset??(o.shape?`shape:${o.shape.type}`:'unknown');

function diffList(before,after,compare){
  const a=byId(before),b=byId(after),added=[],removed=[],changed=[];
  for(const [id,item] of b)if(!a.has(id))added.push(item);else if(!same(a.get(id),item))changed.push(compare(a.get(id),item));
  for(const [id,item] of a)if(!b.has(id))removed.push(item);
  return {added,removed,changed};
}

function diffBible(a={},b={}){
  const fields=[];
  for(const field of ['title','intent'])if(!same(a[field],b[field]))fields.push({field,before:a[field]??'',after:b[field]??''});
  // Rules are one text block; compare it line by line.
  if(!same(a.rules,b.rules)){
    const lines=text=>String(text??'').split('\n').map(line=>line.trim()).filter(Boolean),before=lines(a.rules),after=lines(b.rules);
    fields.push({field:'rules',before:a.rules??'',after:b.rules??'',added:after.filter(r=>!before.includes(r)),removed:before.filter(r=>!after.includes(r))});
  }
  const pins=a.referenceIds||[],next=b.referenceIds||[];
  if(!same(pins,next))fields.push({field:'referenceIds',before:pins,after:next,added:next.filter(id=>!pins.includes(id)),removed:pins.filter(id=>!next.includes(id))});
  return fields;
}

function diffBoard(a,b){
  const {added,removed,changed}=diffList(a,b,(x,y)=>{
    const fields=changedKeys(x,y),placement=fields.filter(f=>f==='page'||f==='layout');
    return {id:y.id,title:y.title,fields,moved:placement.length>0&&placement.length===fields.length};
  });
  const title=r=>({id:r.id,title:r.title});
  return {added:added.map(title),removed:removed.map(title),moved:changed.filter(c=>c.moved),changed:changed.filter(c=>!c.moved)};
}

function diffSettings(a,b){
  const settings=[];
  for(const field of ['environment','origin','moodboard','runtime','water'])if(!same(a[field],b[field]))settings.push({field,keys:typeof (a[field]??b[field])==='object'?changedKeys(a[field],b[field]):[]});
  if(!same(a.terrain,b.terrain)){
    const keys=changedKeys(a.terrain,b.terrain),detail={field:'terrain',keys};
    if(keys.includes('appearance'))detail.appearance=changedKeys(a.terrain?.appearance,b.terrain?.appearance);
    if(keys.includes('stamps')){const s=diffList(a.terrain?.stamps,b.terrain?.stamps,(x,y)=>y);detail.stamps={added:s.added.length,removed:s.removed.length,changed:s.changed.length};}
    settings.push(detail);
  }
  return settings;
}

function diffPlacements(a,b){
  const groups=new Map(),group=key=>{if(!groups.has(key))groups.set(key,{key,added:[],removed:[],moved:[],changed:[]});return groups.get(key);};
  const {added,removed,changed}=diffList(a,b,(x,y)=>({before:x,after:y,fields:changedKeys(x,y)}));
  for(const o of added)group(placementGroup(o)).added.push(o.id);
  for(const o of removed)group(placementGroup(o)).removed.push(o.id);
  for(const c of changed){
    const g=group(placementGroup(c.after));
    if(placementGroup(c.before)!==placementGroup(c.after)||!c.fields.every(f=>TRANSFORM.includes(f)))g.changed.push({id:c.after.id,fields:c.fields});
    else g.moved.push(c.after.id);
  }
  const size=g=>g.added.length+g.removed.length+g.moved.length+g.changed.length;
  const list=[...groups.values()].sort((x,y)=>size(y)-size(x)||x.key.localeCompare(y.key));
  const count=key=>list.reduce((n,g)=>n+g[key].length,0);
  return {groups:list,totals:{added:count('added'),removed:count('removed'),moved:count('moved'),changed:count('changed'),before:(a||[]).length,after:(b||[]).length}};
}

// Scatter records with their expanded instance counts on each side.
function diffScatters(a,b){
  const placed=scene=>{try{return new Map(expandScatters(scene).stats.map(s=>[s.id,s.placed]));}catch{return new Map();}};
  const {added,removed,changed}=diffList(a.scatters,b.scatters,(x,y)=>({id:y.id,fields:changedKeys(x,y)}));
  if(!added.length&&!removed.length&&!changed.length)return {added:[],removed:[],changed:[]};
  const before=placed(a),after=placed(b);
  return {added:added.map(s=>({id:s.id,placed:after.get(s.id)??null})),removed:removed.map(s=>({id:s.id,placed:before.get(s.id)??null})),changed:changed.map(c=>({...c,before:before.get(c.id)??null,after:after.get(c.id)??null}))};
}

export function diffProposal(accepted,proposed){
  const sa=accepted?.scene||{},sb=proposed?.scene||{};
  const assets=diffList(sa.assets,sb.assets,(x,y)=>({id:y.id,fields:changedKeys(x,y)}));
  return {
    bible:diffBible(accepted?.bible,proposed?.bible),
    board:diffBoard(accepted?.references,proposed?.references),
    scene:{
      settings:diffSettings(sa,sb),
      assets:{added:assets.added.map(a=>a.id),removed:assets.removed.map(a=>a.id),changed:assets.changed},
      placements:diffPlacements(sa.objects,sb.objects),
      scatters:diffScatters(sa,sb),
    },
  };
}

const SETTING_LABELS={environment:'Environment',origin:'Origin',moodboard:'Mood board frame',runtime:'Runtime',water:'Water'};
const plural=(n,word)=>`${n} ${word}${n===1?'':'s'}`;
const sample=(ids,max=4)=>ids.length>max?`${ids.slice(0,max).join(', ')} and ${ids.length-max} more`:ids.join(', ');
// A few short lines for the card. Detail stays in the diff object.
export function summarizeProposal(diff){
  const lines=[],{placements,assets,settings}=diff.scene,t=placements.totals;
  const parts=[t.added&&`+${t.added}`,t.removed&&`−${t.removed}`,t.moved&&`${t.moved} moved`,t.changed&&`${t.changed} changed`].filter(Boolean);
  if(parts.length){const touched=placements.groups.length;lines.push(`Placements: ${parts.join(', ')} across ${plural(touched,'asset group')} (${t.before} → ${t.after})`);}
  const assetParts=[assets.added.length&&`+${assets.added.length} (${sample(assets.added)})`,assets.removed.length&&`−${assets.removed.length} (${sample(assets.removed)})`,assets.changed.length&&`${assets.changed.length} changed (${sample(assets.changed.map(a=>a.id))})`].filter(Boolean);
  if(assetParts.length)lines.push(`Assets: ${assetParts.join(', ')}`);
  const sc=diff.scene.scatters,count=n=>n===null?'?':n,scatterParts=[...sc.added.map(s=>`+${s.id} (${count(s.placed)})`),...sc.removed.map(s=>`−${s.id} (${count(s.placed)})`),...sc.changed.map(s=>`${s.id} ${s.fields.join(', ')} (${count(s.before)} → ${count(s.after)})`)];
  if(scatterParts.length)lines.push(`Scatters: ${scatterParts.join('; ')}`);
  for(const s of settings){
    if(s.field==='terrain'){
      const bits=[s.appearance?.length&&`appearance (${s.appearance.join(', ')})`,s.stamps&&`stamps +${s.stamps.added} −${s.stamps.removed} ~${s.stamps.changed}`,...s.keys.filter(k=>k!=='appearance'&&k!=='stamps')].filter(Boolean);
      lines.push(`Terrain: ${bits.join('; ')||'changed'}`);
    }else lines.push(`${SETTING_LABELS[s.field]}: ${s.keys.length?s.keys.join(', '):'changed'}`);
  }
  if(diff.bible.length)lines.push(`Bible: ${diff.bible.map(f=>f.field==='rules'||f.field==='referenceIds'?`${f.field==='rules'?'rules':'pinned references'} +${f.added.length} −${f.removed.length}`:f.field).join(', ')}`);
  const b=diff.board,boardParts=[b.added.length&&`+${b.added.length}`,b.removed.length&&`−${b.removed.length}`,b.moved.length&&`${b.moved.length} moved`,b.changed.length&&`${b.changed.length} edited`].filter(Boolean);
  if(boardParts.length)lines.push(`Mood board cards: ${boardParts.join(', ')}`);
  return lines.length?lines:['No differences from the accepted world.'];
}
