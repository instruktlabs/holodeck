import * as THREE from 'three/webgpu';
import {Fn,context,float,normalView,output,positionViewDirection,uniform,vec4} from 'three/tsl';
import {flowOffset,validateFlow} from './flow-contract.mjs';
import {markReactive} from './reactive.mjs';
import {reflectionsOnlyEnvironment} from './reflections-only.mjs';
import {windowedMirror} from './water-mirror.mjs';

// Each source material gets one scrolling copy per speed, shared by every
// placement of the asset. A material-wide context moves the default UV of every
// map (colour, normal, emissive, alpha, roughness) by one offset; lookups with
// their own coordinates, such as shadow maps and the environment, are untouched.
const NODE_MATERIALS={MeshStandardMaterial:THREE.MeshStandardNodeMaterial,MeshPhysicalMaterial:THREE.MeshPhysicalNodeMaterial,MeshBasicMaterial:THREE.MeshBasicNodeMaterial,MeshLambertMaterial:THREE.MeshLambertNodeMaterial,MeshPhongMaterial:THREE.MeshPhongNodeMaterial};
// A falling sheet is translucent and bright, so the full sun shadow of a tower or
// cornice across it reads as streaked plaster (H89): flowing water takes the sun
// shadow at this strength.
export const FLOW_SHADOW=.5;
const materialCache=new WeakMap();
// flow.mirror (H129): still basins mirror the world in place, as planar pools do (H82),
// where the sky light's capture, seen from one point, showed them sky. Basins on one level
// share one windowed mirror (water-mirror.mjs) that renders only the pixels they cover, so
// both terrace basins cost one view between them. The mirror is the surface's environment,
// reflections only: three's BRDF gives it the water's Fresnel and roughness, and it lights
// nothing. Sky light captures draw the plain flowing copy (userData.skyCaptureMaterial), as
// they draw planar pools reflecting the sky (H102).
const mirrors=new Map();
export const MIRROR_FLATNESS=.02;
function acquireMirror(level){
 const key=level.toFixed(2);let entry=mirrors.get(key);
 if(!entry){
  const rects=new Set(),node=windowedMirror({bounds:()=>rects,level});
  entry={key,level,rects,node,environment:reflectionsOnlyEnvironment(node.rgb),references:0};mirrors.set(key,entry);
 }
 entry.references++;
 return {entry,release(){if(--entry.references===0){entry.node.reflector?.dispose?.();mirrors.delete(key);}}};
}
export function nodeCopy(source){
 if(source.isNodeMaterial)return source.clone();
 const Class=NODE_MATERIALS[source.type];if(!Class)throw new Error(`Flow cannot scroll a ${source.type}`);
 const target=new Class();for(const key in source)if(key!=='uuid'&&key!=='_listeners')target[key]=source[key];
 return target;
}
function acquire(source,speed,mirror=null){
 let cache=materialCache.get(source);if(!cache){cache=new Map();materialCache.set(source,cache);}
 const key=mirror?`${speed.join(',')} @ ${mirror.key}`:speed.join(',');let entry=cache.get(key);
 if(!entry){
  const material=nodeCopy(source),offset=uniform(new THREE.Vector2());
  material.name=`${source.name||'authored'} / flow${mirror?' / mirror':''}`;
  material.contextNode=context({getUV:texture=>texture.getDefaultUV().add(offset)});
  if(mirror){
   material.envNode=mirror.environment;
   // The surface blends by its opacity, which dimmed its reflection at every angle
   // (measured: a faint image at 20° above the water). As the planar pools composite
   // (H82), its alpha takes the water's Fresnel reflectance, a + F(1 - a) with Schlick's
   // F at F0 0.02, so it is see-through looking down and a mirror at grazing angles.
   const fresnel=float(.02).add(normalView.dot(positionViewDirection).clamp().oneMinus().pow(5).mul(.98));
   material.outputNode=vec4(output.rgb,output.a.add(fresnel.mul(output.a.oneMinus())));
  }
  // A double-sided transparent sheet draws once rather than back faces then
  // front faces. A thin water sheet shows no difference, and each placement
  // costs one draw instead of two (H72).
  material.forceSinglePass=true;
  material.receivedShadowNode=Fn(([shadow])=>shadow.mul(FLOW_SHADOW).add(1-FLOW_SHADOW));
  // Its streaks move by texture, with no motion vectors (see reactive.mjs).
  markReactive(material);
  material.needsUpdate=true;
  entry={material,offset,references:0};cache.set(key,entry);
 }
 entry.references++;
 return {entry,release(){if(--entry.references===0){entry.material.dispose();cache.delete(key);}}};
}
// A mirrored surface's level and rectangle [xmin, xmax, zmin, zmax] where it is placed.
const box=new THREE.Box3();
export function mirrorSurface(mesh,name){
 mesh.updateWorldMatrix(true,false);box.setFromObject(mesh,true);
 if(box.isEmpty()||box.max.y-box.min.y>MIRROR_FLATNESS)throw new Error(`Flow mirror node ${name} must be a level surface where it is placed`);
 return {level:(box.min.y+box.max.y)/2,rect:[box.min.x,box.max.x,box.min.z,box.max.z]};
}
// Applies only to the caller-owned placement clone. Shared source geometry,
// materials and textures remain owned by the asset loader.
export function bindAssetFlow(object,config){
 if(!config)return {update(){},dispose(){}};validateFlow(config);
 const selected=[];
 for(const name of config.nodes){
  const matches=[];object.traverse(node=>{if(node.name===name)matches.push(node);});
  if(matches.length!==1||!matches[0].isMesh)throw new Error(`Flow node ${name} must identify exactly one mesh node`);
  if(!matches[0].geometry.getAttribute('uv'))throw new Error(`Flow node ${name} is missing the UVs its maps scroll along`);
  selected.push({mesh:matches[0],surface:config.mirror?mirrorSurface(matches[0],name):null});
 }
 const bindings=selected.map(({mesh,surface})=>{
  const original=mesh.material,casts=mesh.castShadow,mirror=surface?acquireMirror(surface.level):null;
  const leases=[].concat(original).map(m=>acquire(m,config.speed,mirror?.entry)),plain=mirror&&!Array.isArray(original)?acquire(original,config.speed):null;
  mesh.material=Array.isArray(original)?leases.map(l=>l.entry.material):leases[0].entry.material;
  if(plain)mesh.userData.skyCaptureMaterial=plain.entry.material;
  if(mirror)mirror.entry.rects.add(surface.rect);
  // Water casts no sun shadow: the shadow pass draws a translucent sheet or basin
  // surface as solid, so the wall behind a fall or the floor under a basin went
  // fully dark, and each placement cost a shadow draw (H97).
  mesh.castShadow=false;mesh.userData.flowing=true;
  return {mesh,original,leases,casts,mirror,plain,rect:surface?.rect};
 });
 let disposed=false;
 return {
  update(time){if(disposed)return;const [u,v]=flowOffset(config.speed,Number.isFinite(time)?time:0);for(const b of bindings){for(const l of b.leases)l.entry.offset.value.set(u,v);b.plain?.entry.offset.value.set(u,v);}},
  dispose(){
   if(disposed)return;disposed=true;
   for(const b of bindings){
    b.mesh.material=b.original;b.mesh.castShadow=b.casts;delete b.mesh.userData.flowing;b.leases.forEach(l=>l.release());
    if(b.plain){if(b.mesh.userData.skyCaptureMaterial===b.plain.entry.material)delete b.mesh.userData.skyCaptureMaterial;b.plain.release();}
    if(b.mirror){b.mirror.entry.rects.delete(b.rect);b.mirror.release();}
   }
  },
 };
}
