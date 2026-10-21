import {Quaternion,Vector3} from 'three';
import {validateGait} from './gait.mjs';
const axes={x:new Vector3(1,0,0),y:new Vector3(0,1,0),z:new Vector3(0,0,1)};
const restQuaternions=new WeakMap();
export function bindGait(root,gait){
 validateGait(gait);const named=new Map(),diagnostics=[],joints=new Map();
 root.traverse(node=>{if(node.name){const entries=named.get(node.name)||[];entries.push(node);named.set(node.name,entries);}});
 for(const name of new Set(gait.channels.map(c=>c.node))){
  const matches=named.get(name)||[];
  if(matches.length!==1){diagnostics.push(`Gait node ${name} is ${matches.length?'ambiguous':'missing'} (${matches.length} matches).`);continue;}
  const node=matches[0];
  if(node===root){diagnostics.push(`Gait node ${name} targets the asset root; only child joints can animate.`);continue;}
  if(!restQuaternions.has(node))restQuaternions.set(node,node.quaternion.clone());
  joints.set(name,{node,rest:restQuaternions.get(node),channels:[]});
 }
 gait.channels.forEach((channel,index)=>joints.get(channel.node)?.channels.push({axis:axes[channel.axis],index}));
 return {enabled:diagnostics.length===0,diagnostics,joints:[...joints.values()],rotation:new Quaternion()};
}
export function applyGait(rig,angles){
 if(!rig.enabled)return;
 for(const joint of rig.joints){
  joint.node.quaternion.copy(joint.rest);
  for(const channel of joint.channels)joint.node.quaternion.multiply(rig.rotation.setFromAxisAngle(channel.axis,angles[channel.index]));
 }
}
export function resetGait(rig){for(const joint of rig.joints)joint.node.quaternion.copy(joint.rest);}
