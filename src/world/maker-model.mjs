import * as THREE from 'three/webgpu';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
const smooth=t=>t*t*(3-2*t);
function noise(x,y){const a=Math.floor(x),b=Math.floor(y),u=smooth(x-a),v=smooth(y-b);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(a,b),hash(a+1,b),u),THREE.MathUtils.lerp(hash(a,b+1),hash(a+1,b+1),u),v);}
function surfaceTextures(kind){
 const size=256,h=new Float32Array(size*size),color=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x,u=x/size,v=y/size,n=noise(u*5,v*5),grain=hash(x,y),weave=(Math.sin(x*Math.PI/2)+Math.sin(y*Math.PI/2))*.25;
  h[i]=kind==='linen'?.5+weave*.26+(grain-.5)*.05:kind==='metal'?.5+.045*Math.sin(u*210):.5+(grain-.5)*.015+(n-.5)*.008;
  const value=Math.round(kind==='enamel'?252+(n-.5)*2:247+(h[i]-.5)*(kind==='metal'?8:12));color.set([value,value,value,255],i*4);
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const dx=(h[y*size+(x+size-1)%size]-h[y*size+(x+1)%size])*.5,dy=(h[((y+size-1)%size)*size+x]-h[((y+1)%size)*size+x])*.5,length=Math.hypot(dx,dy,1);
  normal.set([(dx/length*.5+.5)*255,(dy/length*.5+.5)*255,(1/length*.5+.5)*255,255],(y*size+x)*4);
 }
 const map=new THREE.DataTexture(color,size,size),normalMap=new THREE.DataTexture(normal,size,size);map.colorSpace=THREE.SRGBColorSpace;
 for(const t of [map,normalMap]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;}
 return {map,normalMap};
}
function profile(points,depth=1,rows=24,segments=28){
 const curve=new THREE.CatmullRomCurve3(points.map(([r,y])=>new THREE.Vector3(r,y,0))),g=new THREE.LatheGeometry(curve.getPoints(rows).map(p=>new THREE.Vector2(Math.max(0,p.x),p.y)),segments);g.scale(1,1,depth);g.computeVertexNormals();return g;
}
function clothSurface(fn,nu=36,nv=8,thickness=0){
 const p=[],uv=[],indices=[];for(let v=0;v<=nv;v++)for(let u=0;u<=nu;u++){p.push(...fn(u/nu,v/nv));uv.push(u/nu*2,v/nv);}
 for(let v=0;v<nv;v++)for(let u=0;u<nu;u++){const a=v*(nu+1)+u,b=a+1,c=a+nu+1,d=c+1;indices.push(a,c,b,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
 if(!thickness)return g;
 const count=p.length/3,normals=g.attributes.normal.array,solidPositions=[],solidIndices=[...indices],solidUV=[...uv,...uv];
 for(const sign of [1,-1])for(let i=0;i<p.length;i++)solidPositions.push(p[i]+normals[i]*thickness*.5*sign);
 for(let i=0;i<indices.length;i+=3)solidIndices.push(indices[i+2]+count,indices[i+1]+count,indices[i]+count);
 const edge=(a,b)=>solidIndices.push(a,b,a+count,b,b+count,a+count);
 for(let u=0;u<nu;u++){edge(u+1,u);edge(nv*(nu+1)+u,nv*(nu+1)+u+1);}
 for(let v=0;v<nv;v++){edge(v*(nu+1),(v+1)*(nu+1));edge((v+1)*(nu+1)+nu,v*(nu+1)+nu);}
 const solid=new THREE.BufferGeometry();solid.setAttribute('position',new THREE.Float32BufferAttribute(solidPositions,3));solid.setAttribute('uv',new THREE.Float32BufferAttribute(solidUV,2));solid.setIndex(solidIndices);solid.computeVertexNormals();solid.userData.thickness=thickness;g.dispose();return solid;
}

// Original procedural Maker, refined into polished enamel and metal. Each rigid anatomical
// module batches its static pieces by material; controllers own no mesh data.
export function createMakerModel(){
 const geometries=[],materials=[],textures=[],root=new THREE.Group(),body=new THREE.Group(),head=new THREE.Group(),joints={};root.name='Maker';root.userData.inhabitant=true;root.add(body);body.position.y=.9;body.add(head);
 const own=g=>(geometries.push(g),g),sphere=own(new THREE.SphereGeometry(.5,24,16)),softBox=own(new RoundedBoxGeometry(1,1,1,3,.2)),capsule=own(new THREE.CapsuleGeometry(.5,1,6,16)),disc=own(new THREE.CylinderGeometry(.5,.5,1,28));
 // The upper chest continues across the shoulder sockets into a raised neck seat.
 // Its anatomical pivots stay fixed; shell height must not shorten the arm rig.
 const torso=own(profile([[0,-.24],[.15,-.24],[.175,-.20],[.17,-.04],[.21,.12],[.225,.19],[.22,.25],[.17,.29],[.105,.32],[.075,.345],[0,.345]],.68));
 const cranialShell=own(profile([[0,.675],[.055,.685],[.088,.71],[.113,.755],[.125,.808],[.122,.853],[.103,.897],[.065,.926],[0,.94]],.90,48,48));
 // A shallow continuous bridge belongs to the shell, not a separate button nose.
 const headVertices=cranialShell.attributes.position;
 for(let i=0;i<headVertices.count;i++)if(headVertices.getZ(i)<0){const x=headVertices.getX(i),y=headVertices.getY(i);headVertices.setZ(i,headVertices.getZ(i)-.004*Math.exp(-((x/.020)**2)-(((y-.798)/.038)**2)));}
 cranialShell.computeVertexNormals();
 const upperArm=own(profile([[0,-.14],[.038,-.135],[.052,-.07],[.064,.075],[.052,.13],[0,.14]],.95));
 const forearm=own(profile([[0,-.13],[.033,-.125],[.04,-.08],[.058,.055],[.05,.12],[0,.13]],.90));
 const thigh=own(profile([[0,-.19],[.055,-.18],[.073,-.08],[.086,.11],[.065,.18],[0,.19]],1.03));
 const shin=own(profile([[0,-.18],[.036,-.17],[.045,-.09],[.068,.07],[.055,.17],[0,.18]],.95));
 const cloth=surfaceTextures('linen'),enamel=surfaceTextures('enamel'),metal=surfaceTextures('metal');textures.push(...Object.values(cloth),...Object.values(enamel),...Object.values(metal));
 const make=(name,color,detail,extra={})=>{const m=new THREE.MeshPhysicalMaterial({name,color,roughness:.32,...detail,...extra});m.normalScale.setScalar(detail===cloth?1.15:detail===metal?.16:.05);materials.push(m);return m;};
 const palette={ceramic:make('Maker enamel','#e9e6d8',enamel,{metalness:.22,roughness:.24,clearcoat:.65,clearcoatRoughness:.2}),alloy:make('Maker silver','#b8c0bd',metal,{metalness:.58,roughness:.3,clearcoat:.2}),trim:make('Maker champagne trim','#b29a68',metal,{metalness:.65,roughness:.28}),linen:make('Maker tailored cape','#899b94',cloth,{roughness:.83,sheen:.45,sheenColor:'#cbd2c0',side:THREE.DoubleSide}),moss:make('Maker green sash','#5c7158',cloth,{roughness:.82,sheen:.3,sheenColor:'#819272',side:THREE.DoubleSide}),eyes:make('Maker optical glass','#10221c',null,{roughness:.12,clearcoat:1}),ember:make('Maker core','#dbdfb1',null,{roughness:.22,emissive:'#b6d79c',emissiveIntensity:.65,clearcoat:.6})};
 function batch(parent){
  const buckets=new Map(),t=new THREE.Object3D();return {
   add(g,m,p=[0,0,0],s=[1,1,1],r=[0,0,0]){t.position.set(...p);t.scale.set(...s);t.rotation.set(...r);t.updateMatrix();const copy=(g.index?g.toNonIndexed():g.clone()).applyMatrix4(t.matrix);if(!buckets.has(m))buckets.set(m,[]);buckets.get(m).push(copy);},
   finish(){for(const [m,parts] of buckets){const mesh=new THREE.Mesh(own(mergeGeometries(parts)),m);parts.forEach(g=>g.dispose());mesh.castShadow=true;mesh.receiveShadow=true;mesh.raycast=()=>{};parent.add(mesh);}return parent;},
  };
 }
 const central=batch(body);
 central.add(sphere,palette.alloy,[0,.035,0],[.30,.21,.235]);central.add(sphere,palette.ceramic,[0,.03,-.045],[.24,.20,.20]);central.add(torso,palette.ceramic,[0,.30,0]);
 const neckSeat=own(new THREE.TorusGeometry(.052,.009,8,32));central.add(neckSeat,palette.alloy,[0,.649,0],[1,1,1],[Math.PI/2,0,0]);
 // The shoulder edge stays above the ball joint. Front and back panels descend
 // outside the shell, leaving the arms free rather than cutting through them.
 const drape=(u,v)=>{const a=u*Math.PI*2,s=Math.sin(a),c=Math.cos(a),front=Math.max(0,-c)**2,back=Math.max(0,c)**2,coverage=(1-s)*.5,spread=Math.sin(v*Math.PI/2),fold=(Math.sin(a*7+v*2)+.3*Math.sin(a*15-v))*.008*spread;
  return [s*(.103+spread*(.075+.147*coverage)+fold),.67-.03*(1-spread)-(.02+.20*front+.32*back+.07*s*(front+back))*(v*.25+v*v*.75)+fold*.7,c*(.09+spread*(c<0?.11:.155)+fold)];};
 const shawl=own(clothSurface(drape,64,16,.006)),cape=new THREE.Mesh(shawl,palette.linen);cape.name='MakerCape';cape.castShadow=cape.receiveShadow=true;cape.raycast=()=>{};body.add(cape);
 const hemPoints=Array.from({length:65},(_,i)=>new THREE.Vector3(...drape(i/64,1))),hem=own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hemPoints),64,.0035,5,false));central.add(hem,palette.trim);
 const collarPoints=Array.from({length:49},(_,i)=>new THREE.Vector3(...drape(i/48,.035))),collar=own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(collarPoints),48,.0045,6,false));central.add(collar,palette.trim);
 const belt=own(new THREE.TorusGeometry(.16,.026,10,48));central.add(belt,palette.moss,[0,.115,0],[1, .80,1],[Math.PI/2,0,.04]);central.add(belt,palette.moss,[0,.075,0],[1,.80,1],[Math.PI/2,0,-.04]);
 central.add(sphere,palette.moss,[.065,.09,-.15],[.09,.065,.055]);
 const tie=own(clothSurface((u,v)=>[(u-.5)*.065+.055-v*.025,.075-v*.34,-.15-.025*Math.sin(v*Math.PI)+.006*Math.sin(u*8)],8,12));central.add(tie,palette.moss);
 const shortTie=own(clothSurface((u,v)=>[(u-.5)*.06+.09+v*.055,.065-v*.20,-.15+.009*Math.sin(v*6+u*3)],8,8));central.add(shortTie,palette.moss);
 central.add(disc,palette.alloy,[0,.385,-.151],[.09,.022,.09],[Math.PI/2,0,0]);central.add(sphere,palette.ember,[0,.385,-.17],[.058,.064,.025]);central.finish();
 const face=batch(head);
 face.add(capsule,palette.alloy,[0,.667,0],[.095,.035,.095]);face.add(cranialShell,palette.ceramic);
 // Project the thin optical rims and inset lenses onto the same curved shell.
 // This avoids floating eye buttons and keeps every facial feature inside the head batch.
 const probeMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),probe=new THREE.Mesh(cranialShell,probeMaterial),ray=new THREE.Raycaster();probe.updateMatrixWorld(true);
 const surface=(x,y,offset=0)=>{ray.set(new THREE.Vector3(x,y,-1),new THREE.Vector3(0,0,1));const hit=ray.intersectObject(probe)[0];if(!hit)throw new Error('Maker facial detail lies outside the cranial shell');return new THREE.Vector3(x,y,hit.point.z-offset);};
 function opticalPatch(side,rim){
  const shape=new THREE.Shape();shape.absellipse(0,0,rim?.025:.021,rim?.012:.0088,0,Math.PI*2,false,0);
  if(rim){const hole=new THREE.Path();hole.absellipse(0,0,.021,.0088,0,Math.PI*2,true,0);shape.holes.push(hole);}
  const geometry=own(new THREE.ShapeGeometry(shape,24));geometry.rotateY(Math.PI);const p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){const point=surface(side*.052+p.getX(i),.822+p.getY(i),rim?.0035:.0015);p.setXYZ(i,point.x,point.y,point.z);}
  geometry.computeVertexNormals();return geometry;
 }
 for(const side of [-1,1]){
  face.add(opticalPatch(side,true),palette.trim);face.add(opticalPatch(side,false),palette.eyes);face.add(disc,palette.alloy,[side*.124,.803,0],[.061,.012,.061],[0,0,Math.PI/2]);
  const seamPoints=[[side*.084,.776],[side*.077,.752],[side*.062,.727]].map(([x,y])=>surface(x,y,.0005));
  const seam=own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seamPoints),16,.00075,4,false));face.add(seam,palette.trim);
 }
 probeMaterial.dispose();face.finish();
 function hand(parent,side){
  const group=new THREE.Group();group.position.set(0,-.275,0);group.rotation.y=side*Math.PI/2;parent.add(group);const p=batch(group);
  p.add(sphere,palette.alloy,[0,0,0],[.05,.045,.05]);p.add(softBox,palette.ceramic,[0,-.05,0],[.076,.085,.039]);
  for(let i=0;i<4;i++){const x=(i-1.5)*.018,length=[.050,.066,.061,.047][i],width=i===3?.012:.014;
   p.add(capsule,palette.ceramic,[x,-.087-length*.23,-.002],[width,length*.22,width],[.18,0,0]);
   p.add(sphere,palette.alloy,[x,-.087-length*.48,-.006],[width*.88,width*.88,width*.88]);
   p.add(capsule,palette.ceramic,[x,-.087-length*.73,-.013],[width*.94,length*.24,width*.94],[.48,0,0]);
  }
  p.add(capsule,palette.ceramic,[side*.043,-.04,.004],[.019,.02,.019],[.15,0,-side*.65]);p.add(sphere,palette.alloy,[side*.052,-.056,-.002],[.016,.016,.016]);p.add(capsule,palette.ceramic,[side*.053,-.075,-.008],[.017,.017,.017],[.5,0,-side*.2]);p.finish();
 }
 for(const side of [-1,1]){
  const name=side<0?'left':'right',shoulder=new THREE.Group(),elbow=new THREE.Group(),hip=new THREE.Group(),knee=new THREE.Group(),foot=new THREE.Group();
  shoulder.position.set(side*.25,.55,0);elbow.position.set(0,-.31,0);hip.position.set(side*.105,0,0);knee.position.set(0,-.405,0);foot.position.set(0,-.405,0);body.add(shoulder,hip);shoulder.add(elbow);hip.add(knee);knee.add(foot);Object.assign(joints,{[`${name}Shoulder`]:shoulder,[`${name}Elbow`]:elbow,[`${name}Hip`]:hip,[`${name}Knee`]:knee,[`${name}Foot`]:foot});
  const upper=batch(shoulder);upper.add(sphere,palette.alloy,[0,0,0],[.14,.14,.14]);upper.add(disc,palette.trim,[side*.064,0,0],[.09,.012,.09],[0,0,Math.PI/2]);upper.add(upperArm,palette.ceramic,[0,-.17,0]);upper.finish();
  const fore=batch(elbow);fore.add(sphere,palette.alloy,[0,0,0],[.088,.088,.088]);fore.add(disc,palette.trim,[side*.039,0,0],[.057,.013,.057],[0,0,Math.PI/2]);fore.add(forearm,palette.ceramic,[0,-.145,0]);fore.finish();hand(elbow,side);
  const up=batch(hip);up.add(sphere,palette.alloy,[0,0,0],[.137,.14,.14]);up.add(thigh,palette.ceramic,[0,-.205,.004]);up.finish();
  const low=batch(knee);low.add(sphere,palette.alloy,[0,0,0],[.105,.108,.108]);low.add(disc,palette.trim,[side*.048,0,0],[.07,.014,.07],[0,0,Math.PI/2]);low.add(shin,palette.ceramic,[0,-.21,.006]);low.finish();
  const toes=batch(foot);toes.add(sphere,palette.alloy,[0,0,0],[.074,.074,.074]);toes.add(sphere,palette.ceramic,[0,-.04,.012],[.12,.09,.12]);toes.add(sphere,palette.ceramic,[0,-.039,-.045],[.128,.082,.174]);
  for(let i=0;i<5;i++){const x=side*(i-2)*.024,length=.075-i*.007,z=-.12-(length-.05)*.3;toes.add(capsule,palette.ceramic,[x,-.063,z],[.021,length*.5,.023],[Math.PI/2,0,0]);toes.add(sphere,palette.alloy,[x,-.060,z+.023],[.019,.019,.019]);}toes.finish();
 }
 const hiddenMaterials=new Map();head.traverse(mesh=>{if(!mesh.isMesh)return;const visible=mesh.material;let hidden=hiddenMaterials.get(visible);if(!hidden){hidden=visible.clone();hidden.colorWrite=false;hidden.depthWrite=false;materials.push(hidden);hiddenMaterials.set(visible,hidden);}mesh.userData.visibleMaterial=visible;mesh.userData.hiddenMaterial=hidden;});
 return {root,body,head,joints,setFirstPerson(value){head.traverse(mesh=>{if(mesh.isMesh)mesh.material=value?mesh.userData.hiddenMaterial:mesh.userData.visibleMaterial;});},dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}

