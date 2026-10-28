// Browser adapter. Solve in the asset root frame, after animation evaluation.
import * as THREE from 'three/webgpu';
import {solveArmIK} from './arm-ik.mjs';
export function bindArmIK(root,rig){return Object.entries(rig.arms).map(([side,spec])=>{const get=name=>{const n=root.getObjectByName(name);if(!n?.isBone)throw Error('Missing IK joint '+name);return n;};const rest=solveArmIK(spec.shoulder,spec.wrist,spec.pole,spec.upperLength,spec.forearmLength);return {side,spec,shoulder:get('Joint_'+side+'Arm_'+side+'_shoulder'),elbow:get('Joint_'+side+'Arm_'+side+'_elbow'),wrist:get('Joint_'+side+'_'+side+'_wrist'),upper:new THREE.Vector3(...rest.elbow).sub(new THREE.Vector3(...spec.shoulder)).normalize(),lower:new THREE.Vector3(...spec.wrist).sub(new THREE.Vector3(...rest.elbow)).normalize()};});}
export function applyArmIK(root,chains,pose,offsets={}){root.updateMatrixWorld(true);const rootQ=root.getWorldQuaternion(new THREE.Quaternion()).invert();let error=0;
 for(const c of chains){const target=c.spec.wrist.map((v,i)=>v+(c.side==='left'?[pose.handX,pose.handY,pose.handZ][i]:0)+(offsets[c.side]?.[i]??0)),solved=solveArmIK(c.spec.shoulder,target,c.spec.pole,c.spec.upperLength,c.spec.forearmLength),desiredQ=rootQ.clone().multiply(c.wrist.getWorldQuaternion(new THREE.Quaternion()));
  const sq=new THREE.Quaternion().setFromUnitVectors(c.upper,new THREE.Vector3(...solved.elbow).sub(new THREE.Vector3(...c.spec.shoulder)).normalize()),eq=new THREE.Quaternion().setFromUnitVectors(c.lower,new THREE.Vector3(...solved.wrist).sub(new THREE.Vector3(...solved.elbow)).normalize());
  c.shoulder.quaternion.copy(sq);c.elbow.quaternion.copy(sq.clone().invert().multiply(eq));c.wrist.quaternion.copy(eq.clone().invert().multiply(desiredQ));error=Math.max(error,solved.error);
 }root.updateMatrixWorld(true);return {reachError:error};
}
