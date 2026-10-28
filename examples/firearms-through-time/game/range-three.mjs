import * as THREE from 'three/webgpu';
import collision from './range-collision-v1.json';
import {rules} from './range-session.mjs';

const axes=[[1,0,0],[0,1,0],[0,0,1]];
export function bindRange(scene,runtime,state){
 const find=(id,name)=>{let result=null;scene.traverse(n=>{if(!result&&n.userData?.target===id)result=n.getObjectByName(name)??null;});return result;};
 const carrier=find('paper-carrier','pivot_carrier'),sheet=find('paper-carrier','anchor_sheet_front'),original=find('range-target','Joint_Target');
 const pivots=[],faces=[];for(let i=1;i<=5;i++){const id=String(i).padStart(2,'0');pivots.push(find('plate-rack','pivot_plate_'+id));faces.push(find('plate-rack','anchor_plate_'+id+'_face'));}
 if(!carrier||!sheet||!original||pivots.some(x=>!x)||faces.some(x=>!x))return null;
 const rest=carrier.position.clone(),rotations=pivots.map(p=>p.rotation.clone()),originalAnchor=new THREE.Object3D();originalAnchor.position.x=-.0475;original.add(originalAnchor);
 const entries=[{id:'paper.sheet.front',lane:'paper',node:sheet,width:rules.paper.width,height:rules.paper.height},{id:'original.face',lane:'original',node:originalAnchor,width:rules.original.width,height:rules.original.height},...faces.map((node,i)=>({id:'plate.'+String(i+1).padStart(2,'0')+'.front',lane:'plates',plate:i,node,width:rules.plates.radius*2,height:rules.plates.radius*2}))];
 const marks=new Map(),geometry=new THREE.CircleGeometry(1,14),material=new THREE.MeshBasicMaterial({color:0x15191a,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2});
 const rimMaterial=new THREE.MeshBasicMaterial({color:0xc2b8a0,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});
 // Shared irregular silhouette, varied by shot sequence. Geometry is presentation only.
 const points=geometry.attributes.position;for(let i=1;i<points.count;i++){const f=[1,.79,.96,.86,1.04,.82,.93][(i-1)%7];points.setXY(i,points.getX(i)*f,points.getY(i)*f);}points.needsUpdate=true;
 const sparkGeometry=new THREE.BoxGeometry(1,1,1),sparkMaterial=new THREE.MeshBasicMaterial({color:0xffb65d,toneMapped:false});
 const sparks=new THREE.InstancedMesh(sparkGeometry,sparkMaterial,80);sparks.name='RangeSteelSparks';sparks.frustumCulled=false;sparks.count=0;scene.add(sparks);
 const bursts=[],seenEffects=new Set(state.shots.map(s=>s.id)),dummy=new THREE.Object3D(),sparkColor=new THREE.Color();let disposed=false;
 const impact=shot=>{if(disposed||!shot?.impact||seenEffects.has(shot.id))return;seenEffects.add(shot.id);if(shot.impact.lane!=='plates')return;
  const f=shot.impact.frame;bursts.push({age:0,sequence:shot.sequence,origin:new THREE.Vector3(...shot.impact.world),normal:new THREE.Vector3(...f.normal),right:new THREE.Vector3(...f.right),up:new THREE.Vector3(...f.up)});if(bursts.length>16)bursts.shift();};
 const tickEffects=(dt,paused=false)=>{if(disposed)return;if(paused){bursts.length=0;sparks.count=0;return;}if(!Number.isFinite(dt)||dt<0)return;for(const b of bursts)b.age+=Math.min(dt,.1);for(let i=bursts.length-1;i>=0;i--)if(bursts[i].age>=.22)bursts.splice(i,1);
  let index=0;for(const b of bursts)for(let k=0;k<5;k++){const a=k*Math.PI*2/5+b.sequence*2.39996323,v=b.normal.clone().multiplyScalar(.16+.025*k).addScaledVector(b.right,Math.cos(a)*.24).addScaledVector(b.up,Math.sin(a)*.24+.08),life=1-b.age/.22;
   dummy.position.copy(b.origin).addScaledVector(b.normal,.002).addScaledVector(v,b.age);dummy.position.y-=1.5*b.age*b.age;dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());dummy.scale.set(.0015*life,(.009+.003*k)*life,.0015*life);dummy.updateMatrix();sparks.setMatrixAt(index,dummy.matrix);sparkColor.setRGB(1,.25+.35*life,.035+.10*life);sparks.setColorAt(index++,sparkColor);}
  sparks.count=index;sparks.instanceMatrix.needsUpdate=true;if(sparks.instanceColor)sparks.instanceColor.needsUpdate=true;};
 const bodyBox=t=>({center:[24-rules.travelDistance*t,1.672,-2.6],half:[.103,.689,.34]});
 const bodyHits=(b,x,z,r,y,h)=>y+h>b.center[1]-b.half[1]&&y<b.center[1]+b.half[1]&&Math.hypot(Math.max(0,Math.abs(x-b.center[0])-b.half[0]),Math.max(0,Math.abs(z-b.center[2])-b.half[2]))<r;
 const previous=runtime.collisionAt;
 const wrapped=function(x,z,r=.22,y=0,h=1.72,ignore=null,step=0){const hit=previous.call(this,x,z,r,y,h,ignore,step);if(hit)return hit;return ignore!=='paper-carrier'&&bodyHits(bodyBox(state.travel),x,z,r,y,h)?'paper-moving':null;};runtime.collisionAt=wrapped;
 const apply=()=>{carrier.position.copy(rest);carrier.position.x-=rules.travelDistance*state.travel;pivots.forEach((p,i)=>{p.rotation.copy(rotations[i]);p.rotation.z-=state.angles[i];});scene.updateMatrixWorld(true);
  const visible=new Set(),counts=new Map();for(let i=state.shots.length-1;i>=0;i--){const shot=state.shots[i],hit=shot.impact;if(!hit||(hit.lane==='paper'&&shot.sheetId!==state.sheetId)||(hit.lane==='plates'&&shot.activation!==state.activation))continue;const count=counts.get(hit.surfaceId)??0;if(count>=256)continue;counts.set(hit.surfaceId,count+1);visible.add(shot.id);
   let mark=marks.get(shot.id);if(!mark){const entry=entries.find(e=>e.id===hit.surfaceId);if(!entry)continue;mark=new THREE.Mesh(geometry,material);mark.userData.rangeMark=true;mark.userData.shotId=shot.id;mark.name='RangeImpact_'+shot.sequence;mark.rotation.set(0,-Math.PI/2,shot.sequence*2.39996323);mark.position.set(hit.lane==='original'&&Math.hypot(...hit.local)<=.029?-.0085:-.0012,hit.local[1],hit.local[0]);const steel=hit.lane==='plates';mark.scale.set(steel?.009:.004,steel?.006:.004,1);mark.renderOrder=4;
    if(!steel){const rim=new THREE.Mesh(geometry,rimMaterial);rim.scale.set(1.75,1.75,1);rim.position.z=-.00015;rim.renderOrder=3;mark.add(rim);}
    entry.node.add(mark);marks.set(shot.id,mark);}
  }for(const[id,mark]of marks)if(!visible.has(id)){mark.visible=false;mark.removeFromParent();marks.delete(id);}
 };
 const surfaces=()=>{apply();return entries.map(e=>{const m=e.node.matrixWorld,q=new THREE.Quaternion(),scale=new THREE.Vector3(),origin=new THREE.Vector3();m.decompose(origin,q,scale);const dir=v=>new THREE.Vector3(...v).applyQuaternion(q).normalize().toArray();return {id:e.id,lane:e.lane,plate:e.plate,origin:origin.toArray(),normal:dir([-1,0,0]),right:dir([0,0,1]),up:dir([0,1,0]),width:e.width*Math.abs(scale.z),height:e.height*Math.abs(scale.y)};});};
 const blocked=next=>{const from=bodyBox(state.travel),to=bodyBox(next),b={center:[(from.center[0]+to.center[0])/2,from.center[1],from.center[2]],half:[from.half[0]+Math.abs(from.center[0]-to.center[0])/2,...from.half.slice(1)]},p=runtime.playerBody;if(p&&bodyHits(b,p.position[0],p.position[2],p.radius??.22,p.position[1],p.height??1.72))return true;
  return collision.boxes.some(c=>{if(c.id.startsWith('paper-carrier:'))return false;const half=[0,1,2].map(i=>c.axes.reduce((v,a,j)=>v+Math.abs(a[i])*c.half[j],0));return [0,1,2].every(i=>Math.abs(b.center[i]-c.center[i])<b.half[i]+half[i]-.001);});
 };
 return {apply,surfaces,blocked,impact,tickEffects,get effects(){return {bursts:bursts.length,streaks:sparks.count,marks:marks.size};},boxes:()=>[...collision.boxes,{id:'paper.dynamic-backing',center:sheet.localToWorld(new THREE.Vector3(.016,0,0)).toArray(),half:[.015,.43,.34],axes}],dispose(){if(disposed)return;disposed=true;if(runtime.collisionAt===wrapped)runtime.collisionAt=previous;carrier.position.copy(rest);pivots.forEach((p,i)=>p.rotation.copy(rotations[i]));for(const m of marks.values())m.removeFromParent();marks.clear();bursts.length=0;sparks.count=0;sparks.removeFromParent();originalAnchor.removeFromParent();geometry.dispose();material.dispose();rimMaterial.dispose();sparkGeometry.dispose();sparkMaterial.dispose();sparks.dispose();}};
}
