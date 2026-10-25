// Flowing surfaces (asset.flow): named mesh nodes whose material maps scroll
// along their UVs at a fixed rate, for waterfalls, overflowing pool lips and
// streams. Visual only: geometry, colliders and the authored texture stay put.
const fail=message=>{throw new Error(message);};
const record=x=>x&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys,label)=>{if(!record(x)||Object.keys(x).some(k=>!keys.includes(k)))fail(`Invalid flow ${label} fields`);};
export const FLOW_SPEED_LIMIT=4;
export function validateFlow(value){
 exact(value,['nodes','speed'],'binding');
 if(!Array.isArray(value.nodes)||!value.nodes.length||value.nodes.length>16||new Set(value.nodes).size!==value.nodes.length||value.nodes.some(n=>typeof n!=='string'||!/^[-a-zA-Z0-9_]{1,128}$/.test(n)))fail('Flow requires 1–16 unique exact mesh node names');
 if(!Array.isArray(value.speed)||value.speed.length!==2||value.speed.some(v=>!Number.isFinite(v)||Math.abs(v)>FLOW_SPEED_LIMIT)||value.speed.every(v=>v===0))fail(`Flow speed must be [u,v] UV units per second within ±${FLOW_SPEED_LIMIT}, not both 0`);
 return value;
}
// The GLB side: each node names exactly one mesh, and every primitive carries
// TEXCOORD_0 for the maps to scroll along.
export function validateFlowBinding(document,flow,foliage){
 if(!flow)return;validateFlow(flow);
 for(const name of flow.nodes){
  if(foliage?.nodes?.includes(name))fail(`Flow node ${name} is also a foliage node; give the water its own mesh`);
  const matches=(document.nodes||[]).filter(node=>node.name===name);
  if(matches.length!==1||!Number.isInteger(matches[0].mesh))fail(`Flow node ${name} must identify exactly one mesh node`);
  for(const p of document.meshes?.[matches[0].mesh]?.primitives??[]){
   const position=document.accessors?.[p.attributes?.POSITION],uv=document.accessors?.[p.attributes?.TEXCOORD_0];
   if(!uv||uv.type!=='VEC2'||uv.count!==position?.count)fail(`Flow node ${name} needs TEXCOORD_0 UVs to scroll its maps along`);
  }
 }
}
// UV offset at a time: the texture moves `speed` per second, so it is sampled
// that far back. Wrapped to [0,1) so long sessions keep full precision; maps
// repeat, so the wrap is seamless.
export function flowOffset(speed,time){
 const wrap=v=>v-Math.floor(v);
 return [wrap(-speed[0]*time),wrap(-speed[1]*time)];
}
