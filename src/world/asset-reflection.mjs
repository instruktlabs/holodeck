import {texture} from 'three/tsl';
import {nodeCopy} from './asset-flow.mjs';

// asset.reflection 'sky' (H73). The sky light reflects one probe captured over the
// world, so a mirror far from the probe shows the probe's view: a cube high over
// the clouds reflects the court's planting and shaded undersides, or a flat patch
// of zenith. A 'sky' asset reflects the dome alone instead (the sky gradient, the
// clouds and the cloud deck, captured without the sun disc), which reads the same
// from anywhere in the sky. SkyLight publishes that capture here.
let current=null;const listeners=new Set();
export const skyReflection={
 get:()=>current,
 set(value){if(current===value)return;current=value;for(const listener of listeners)listener();},
 subscribe(listener){listeners.add(listener);return()=>{listeners.delete(listener);};},
};
// asset.reflection {probe:[x,y,z]} (H85): the world captured once from that point,
// for mirrors among the architecture, which the dome alone leaves as flat fills of
// sky. SkyLight publishes one capture per point, keyed by probeKey.
export const probeKey=point=>point.map(value=>Math.round(value*100)/100).join(',');
const probes=new Map(),probeListeners=new Set();
export const probeReflections={
 get:key=>probes.get(key)??null,
 set(key,value){if((probes.get(key)??null)===value)return;if(value)probes.set(key,value);else probes.delete(key);for(const listener of probeListeners)listener();},
 subscribe(listener){probeListeners.add(listener);return()=>{probeListeners.delete(listener);};},
};
// The distinct probe points the world's assets ask for.
export function reflectionProbePoints(assets=[]){
 const points=new Map();for(const asset of assets)if(asset.reflection?.probe)points.set(probeKey(asset.reflection.probe),asset.reflection.probe);
 return [...points.values()];
}
// The published capture an asset's reflection names, or null until it exists.
export function reflectionCapture(reflection){
 if(reflection==='sky')return skyReflection.get();
 if(reflection?.probe)return probeReflections.get(probeKey(reflection.probe));
 return null;
}

// One copy per source material and capture, shared by every placement.
const materialCache=new WeakMap();
function acquire(source,capture){
 let cache=materialCache.get(source);if(!cache){cache=new Map();materialCache.set(source,cache);}
 let entry=cache.get(capture);
 if(!entry){
  const material=nodeCopy(source);material.name=`${source.name||'authored'} / ${capture.name||'sky'} reflection`;
  material.envNode=texture(capture);material.needsUpdate=true;
  entry={material,references:0};cache.set(capture,entry);
 }
 entry.references++;
 return {entry,release(){if(--entry.references===0){entry.material.dispose();cache.delete(capture);}}};
}
// Applies only to the caller-owned placement clone; the loader keeps its materials.
// Lit PBR meshes take the capture; anything else keeps its material.
// A probe mirror seen by a world capture would sample a probe while captures are
// still being made, and drew black in them (H104); captures draw it reflecting the
// sky capture, which is made first and never rewritten by world captures.
export function bindAssetReflection(object,reflection,capture,sky=skyReflection.get()){
 if(!reflection||!capture)return {dispose(){}};
 const bindings=[];
 object.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const original=mesh.material,list=[].concat(original);
  if(!list.length||!list.every(m=>m?.isMeshStandardMaterial))return;
  const leases=list.map(m=>acquire(m,capture)),still=sky&&sky!==capture&&!Array.isArray(original)?acquire(original,sky):null;
  mesh.material=Array.isArray(original)?leases.map(l=>l.entry.material):leases[0].entry.material;
  if(still)mesh.userData.skyCaptureMaterial=still.entry.material;
  bindings.push({mesh,original,leases,still});
 });
 let disposed=false;
 return {dispose(){if(disposed)return;disposed=true;for(const b of bindings){b.mesh.material=b.original;b.leases.forEach(l=>l.release());if(b.still){if(b.mesh.userData.skyCaptureMaterial===b.still.entry.material)delete b.mesh.userData.skyCaptureMaterial;b.still.release();}}}};
}
