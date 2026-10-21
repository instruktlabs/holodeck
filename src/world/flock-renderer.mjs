import {Group,InstancedMesh,Matrix4,Quaternion,Vector3,Euler,Sphere,Box3,DynamicDrawUsage} from 'three';
import {bindGait,applyGait} from './gait-rig.mjs';
import {gaitAngles} from './gait.mjs';
import {renderFlockAgent} from './boids.mjs';
export function createFlockRenderData(model,item){
 const source=model.clone(true),group=new Group(),meshes=[],diagnostics=[];source.updateMatrixWorld(true);
 source.traverse(node=>{if(node.isMesh)meshes.push(node);});
 if(meshes.length>32)diagnostics.push('Flock assets support at most 32 mesh primitives.');
 if(meshes.some(m=>m.isInstancedMesh||m.isSkinnedMesh||Array.isArray(m.material)))diagnostics.push('Flock assets require ordinary single-material mesh primitives.');
 const rig=item.behavior.gait?bindGait(source,item.behavior.gait):null;
 const parts=[];
 if(!diagnostics.length){
  const b=item.behavior.bounds,center=new Vector3((b[0]+b[1])/2,(b[2]+b[3])/2,(b[4]+b[5])/2),size=new Box3().setFromObject(source).getSize(new Vector3());
  const radius=Math.hypot(b[1]-b[0],b[3]-b[2],b[5]-b[4])/2+size.length()*Math.max(...item.scale);
  for(const mesh of meshes){
   const instanced=new InstancedMesh(mesh.geometry,mesh.material,item.behavior.count);instanced.castShadow=true;instanced.receiveShadow=true;instanced.userData={target:item.id};instanced.instanceMatrix.setUsage(DynamicDrawUsage);instanced.boundingSphere=new Sphere(center.clone(),radius);
   group.add(instanced);parts.push({source:mesh,instanced});
  }
 }
 return {source,group,parts,rig,diagnostics:[...diagnostics,...(rig?.diagnostics??[])],position:new Vector3(),scale:new Vector3(...item.scale),rotation:new Quaternion(),offset:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),item.rotation[1]),euler:new Euler(0,0,0,'YXZ'),transform:new Matrix4(),matrix:new Matrix4(),dispose(){for(const part of parts)part.instanced.dispose();}};
}
export function updateFlockRenderData(data,state,item,alpha){
 const g=item.behavior.gait;
 for(const part of data.parts)part.instanced.count=state.agents.length;
 for(let index=0;index<state.agents.length;index++){
  const a=renderFlockAgent(state.agents[index],alpha),v=a.velocity,speed=Math.hypot(...v)||1;
  if(g&&data.rig?.enabled){applyGait(data.rig,gaitAngles(g,a.distance+a.phaseOffset*g.stride*item.scale[0],item.scale[0]));data.source.updateMatrixWorld(true);}
  data.position.set(...a.position);data.euler.set(a.bank,Math.atan2(-v[2],v[0]),Math.asin(Math.max(-1,Math.min(1,v[1]/speed))),'YZX');data.rotation.setFromEuler(data.euler).multiply(data.offset);
  data.transform.compose(data.position,data.rotation,data.scale);
  for(const part of data.parts){data.matrix.multiplyMatrices(data.transform,part.source.matrixWorld);part.instanced.setMatrixAt(index,data.matrix);}
 }
 for(const part of data.parts)part.instanced.instanceMatrix.needsUpdate=true;
}
