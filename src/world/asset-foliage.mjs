import * as THREE from 'three/webgpu';
import {Fn,uniform,uv,sin,vec3,vec4,materialColor,materialEmissive,normalWorld,positionLocal,modelPosition,modelWorldMatrix,vertexColor,instanceColor,instancedBufferAttribute} from 'three/tsl';
import {validateFoliage} from './foliage-contract.mjs';

const materialCache=new WeakMap();
export function sampleFoliageWind(wind,uvY,time,position=[0,0,0]){
 if(!wind||uvY<=0||wind.amplitude===0)return [0,0,0];
 const weight=Math.max(0,Math.min(1,uvY))**2,phase=time*Math.PI*2*wind.frequency+position[0]*.37+position[2]*.23;
 const sway=(Math.sin(phase)*.8+Math.sin(phase*2.3)*.2)*wind.amplitude*weight,lift=Math.sin(phase*1.7)*wind.amplitude*.12*weight;
 return [wind.direction[0]*sway,lift,wind.direction[1]*sway];
}
function acquire(source,config,environment){
 let cache=materialCache.get(source);if(!cache){cache=new Map();materialCache.set(source,cache);}
 const direction=environment.sunPosition??[-7,9,5],sunColor=environment.sunColor??'#ffd6a0',sunIntensity=environment.sunIntensity??3.3;
 const key=JSON.stringify([config.translucency??.15,config.wind??null,direction,sunColor,sunIntensity]);
 let entry=cache.get(key);
 if(!entry){
  const material=new (source.isMeshPhysicalMaterial?THREE.MeshPhysicalNodeMaterial:THREE.MeshStandardNodeMaterial)().copy(source),clock=uniform(0);
  // NodeMaterial.copy omits the inherited alphaTest accessor used by cutout maps.
  material.alphaTest=source.alphaTest;
  material.name=`${source.name||'authored'} / explicit foliage`;material.side=THREE.DoubleSide;material.shadowSide=THREE.DoubleSide;
  const light=uniform(new THREE.Vector3(...direction).normalize()),tint=uniform(new THREE.Color(sunColor)),backlight=normalWorld.negate().dot(light).clamp(0,1).pow(1.4).mul((config.translucency??.15)*Math.min(2,sunIntensity/3));
  material.emissiveNode=Fn(builder=>{
   let authored=source.vertexColors?materialColor.rgb.mul(vertexColor().rgb):materialColor.rgb;
   if(builder.object.instanceColor)authored=authored.mul(instanceColor);
   return materialEmissive.add(authored.mul(tint).mul(backlight));
  })();
  if(config.wind){
   material.positionNode=Fn(builder=>{
    const frame=builder.object.isInstancedMesh?instancedBufferAttribute(builder.object.instanceMatrix,'mat4'):null;
    const origin=frame?modelWorldMatrix.mul(frame.mul(vec4(0,0,0,1))).xyz:modelPosition;
    const w=config.wind,weight=uv().y.clamp(0,1).pow(2),phase=clock.mul(Math.PI*2*w.frequency).add(origin.x.mul(.37)).add(origin.z.mul(.23));
    const sway=sin(phase).mul(.8).add(sin(phase.mul(2.3)).mul(.2)).mul(w.amplitude).mul(weight),lift=sin(phase.mul(1.7)).mul(w.amplitude*.12).mul(weight),offset=vec3(sway.mul(w.direction[0]),lift,sway.mul(w.direction[1]));
    // Three applies instance matrices before positionNode. Transform only the
    // displacement here so local metre amplitude/rotation matches plain meshes.
    return positionLocal.add(frame?frame.mul(vec4(offset,0)).xyz:offset);
   })();
  }
  entry={material,clock,references:0};cache.set(key,entry);
 }
 entry.references++;
 return {entry,release(){if(--entry.references===0){entry.material.dispose();cache.delete(key);}}};
}
// Applies only to the caller-owned placement clone. Shared source geometry,
// materials and textures remain owned by the asset loader.
export function bindAssetFoliage(object,config,environment={}){
 if(!config)return {update(){},dispose(){}};validateFoliage(config);
 const selected=[];
 for(const name of config.nodes){
  const matches=[];object.traverse(node=>{if(node.name===name)matches.push(node);});
  if(matches.length!==1||!matches[0].isMesh)throw new Error(`Foliage node ${name} must identify exactly one mesh node`);
  const mesh=matches[0];if(Array.isArray(mesh.material)||!mesh.material?.isMeshStandardMaterial)throw new Error(`Foliage node ${name} requires one lit authored material`);
  if(config.wind&&!mesh.geometry.getAttribute('uv'))throw new Error(`Foliage node ${name} is missing UVs for uv-y wind`);
  selected.push(mesh);
 }
 const bindings=selected.map(mesh=>{
  const original=mesh.material,sphere=mesh.boundingSphere,lease=acquire(original,config,environment);mesh.material=lease.entry.material;
  if(config.wind){
   let scale=1;
   if(mesh.isInstancedMesh){mesh.boundingSphere=null;mesh.computeBoundingSphere();const matrix=new THREE.Matrix4();for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);scale=Math.max(scale,matrix.getMaxScaleOnAxis());}}
   else {mesh.geometry.computeBoundingSphere();mesh.boundingSphere=mesh.geometry.boundingSphere.clone();}
   mesh.boundingSphere.radius+=config.wind.amplitude*scale*1.01;
  }
  return {mesh,original,sphere,...lease};
 });
 let disposed=false;
 return {update(time){if(disposed)return;const value=Number.isFinite(time)?time:0;for(const binding of bindings)binding.entry.clock.value=value;},dispose(){if(disposed)return;disposed=true;for(const binding of bindings){binding.mesh.material=binding.original;if(binding.sphere===undefined)delete binding.mesh.boundingSphere;else binding.mesh.boundingSphere=binding.sphere;binding.release();}}};
}
