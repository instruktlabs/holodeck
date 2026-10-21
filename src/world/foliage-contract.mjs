const fail=message=>{throw new Error(message);};
const record=x=>x&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys,label)=>{if(!record(x)||Object.keys(x).some(k=>!keys.includes(k)))fail(`Invalid foliage ${label} fields`);};
export function validateFoliage(value){
 exact(value,['nodes','translucency','wind'],'binding');
 if(!Array.isArray(value.nodes)||!value.nodes.length||value.nodes.length>16||new Set(value.nodes).size!==value.nodes.length||value.nodes.some(n=>typeof n!=='string'||!/^[-a-zA-Z0-9_]{1,128}$/.test(n)))fail('Foliage requires 1–16 unique exact mesh node names');
 if(value.translucency!==undefined&&(!Number.isFinite(value.translucency)||value.translucency<0||value.translucency>.5))fail('Foliage translucency must be 0–0.5');
 if(value.wind!==undefined){
  const w=value.wind;exact(w,['amplitude','frequency','direction','weight'],'wind');
  if(!Number.isFinite(w.amplitude)||w.amplitude<0||w.amplitude>.25||!Number.isFinite(w.frequency)||w.frequency<.1||w.frequency>3)fail('Foliage wind amplitude must be 0–0.25 and frequency 0.1–3');
  if(!Array.isArray(w.direction)||w.direction.length!==2||w.direction.some(n=>!Number.isFinite(n))||Math.abs(Math.hypot(...w.direction)-1)>.0001)fail('Foliage wind direction must be a unit XZ vector');
  if(w.weight!=='uv-y')fail('Foliage wind weight must explicitly be uv-y');
 }
 return value;
}
export function validateFoliageBinding(document,foliage){
 if(!foliage)return;validateFoliage(foliage);
 for(const name of foliage.nodes){
  const matches=(document.nodes||[]).filter(node=>node.name===name);
  if(matches.length!==1||!Number.isInteger(matches[0].mesh))fail(`Foliage node ${name} must identify exactly one mesh node`);
  const primitives=document.meshes?.[matches[0].mesh]?.primitives;
  if(primitives?.length!==1)fail(`Foliage node ${name} requires a single primitive mesh`);
  const p=primitives[0],material=document.materials?.[p.material];
  if(material?.extensions?.KHR_materials_unlit)fail(`Foliage node ${name} must use a lit authored material`);
  if(foliage.wind){
   const position=document.accessors?.[p.attributes?.POSITION],uv=document.accessors?.[p.attributes?.TEXCOORD_0];
   if(!uv||uv.type!=='VEC2'||uv.count!==position?.count||![5121,5123,5126].includes(uv.componentType)||uv.componentType!==5126&&!uv.normalized)fail(`Foliage node ${name} needs matching TEXCOORD_0 UVs for uv-y wind`);
  }
 }
}
