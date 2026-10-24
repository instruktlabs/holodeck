import * as THREE from 'three/webgpu';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
const smooth=t=>t*t*(3-2*t);
const ramp=(a,b,v)=>smooth(Math.max(0,Math.min(1,(v-a)/(b-a))));
function noise(x,y){const a=Math.floor(x),b=Math.floor(y),u=smooth(x-a),v=smooth(y-b);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(a,b),hash(a+1,b),u),THREE.MathUtils.lerp(hash(a,b+1),hash(a+1,b+1),u),v);}
function surfaceTextures(kind){
 const size=256,h=new Float32Array(size*size),color=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const i=y*size+x,u=x/size,v=y/size,n=noise(u*5,v*5),grain=hash(x,y),weave=(Math.sin(x*Math.PI/2)+Math.sin(y*Math.PI/2))*.25;
  h[i]=kind==='linen'?.5+weave*.26+(grain-.5)*.05:kind==='metal'?.5+.045*Math.sin(u*210):kind==='rubber'?.5+.08*Math.sin(v*Math.PI*48)+(grain-.5)*.03:.5+(grain-.5)*.015+(n-.5)*.008;
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

const SIDES=[['left',-1],['right',1]];
const FINGERS=[['Index',.064],['Middle',.072],['Ring',.067],['Little',.054]];
// Joint names the pose solver drives. Every bone rests at identity except the
// wrist (palm turned toward the thigh) and the thumb base; poses compose onto
// userData.rest, so a zero pose is always the authored rest pose.
export const MAKER_LIMBS=Object.freeze({upperArm:.31,forearm:.275,thigh:.405,shin:.405,ankleHeight:.09,pelvisHeight:.9});
function joint(name,parent,position,rest){
 const bone=new THREE.Bone();bone.name=name;bone.position.set(...position);if(rest)bone.quaternion.copy(rest);bone.userData.rest=bone.quaternion.clone();parent.add(bone);return bone;
}
// The skeleton alone: tests and tools pose it without building geometry.
export function createMakerRig(){
 const root=new THREE.Group();root.name='Maker';root.userData.inhabitant=true;
 const body=joint('MakerPelvis',root,[0,MAKER_LIMBS.pelvisHeight,0]),j={};
 j.spine=joint('MakerSpine',body,[0,.10,0]);j.chest=joint('MakerChest',j.spine,[0,.20,0]);j.neck=joint('MakerNeck',j.chest,[0,.33,0]);
 const head=joint('MakerHead',j.neck,[0,.07,0]);j.head=head;j.eyes=joint('MakerEyes',head,[0,.122,-.105]);
 j.capeFront=joint('MakerCapeFront',j.chest,[0,.36,-.115]);j.capeBack=joint('MakerCapeBack',j.chest,[0,.36,.125]);
 j.tie1=joint('MakerTie1',body,[.062,.075,-.165]);j.tie2=joint('MakerTie2',j.tie1,[-.012,-.11,0]);j.tie3=joint('MakerTie3',j.tie2,[-.008,-.11,0]);
 j.sideTie1=joint('MakerSideTie1',body,[.092,.068,-.16]);j.sideTie2=joint('MakerSideTie2',j.sideTie1,[.03,-.10,0]);
 const euler=new THREE.Euler();
 for(const [name,side] of SIDES){
  const Side=name[0].toUpperCase()+name.slice(1),clavicle=joint(`Maker${Side}Clavicle`,j.chest,[side*.07,.25,0]),shoulder=joint(`Maker${Side}Shoulder`,clavicle,[side*.18,0,0]);
  const elbow=joint(`Maker${Side}Elbow`,shoulder,[0,-MAKER_LIMBS.upperArm,0]),wrist=joint(`Maker${Side}Wrist`,elbow,[0,-MAKER_LIMBS.forearm,0],new THREE.Quaternion().setFromEuler(euler.set(0,side*Math.PI/2,0)));
  const hip=joint(`Maker${Side}Hip`,body,[side*.105,0,0]),knee=joint(`Maker${Side}Knee`,hip,[0,-MAKER_LIMBS.thigh,0]),foot=joint(`Maker${Side}Foot`,knee,[0,-MAKER_LIMBS.shin,0]),toe=joint(`Maker${Side}Toe`,foot,[0,-.07,-.085]);
  Object.assign(j,{[`${name}Clavicle`]:clavicle,[`${name}Shoulder`]:shoulder,[`${name}Elbow`]:elbow,[`${name}Wrist`]:wrist,[`${name}Hip`]:hip,[`${name}Knee`]:knee,[`${name}Foot`]:foot,[`${name}Toe`]:toe});
  FINGERS.forEach(([finger,length],i)=>{const base=joint(`Maker${Side}${finger}1`,wrist,[(i-1.5)*.021,-.098,-.004]);j[`${name}${finger}1`]=base;j[`${name}${finger}2`]=joint(`Maker${Side}${finger}2`,base,[0,-length*.52,0]);});
  const thumb=joint(`Maker${Side}Thumb1`,wrist,[side*.036,-.03,-.012],new THREE.Quaternion().setFromEuler(euler.set(.3,0,side*.55)));j[`${name}Thumb1`]=thumb;j[`${name}Thumb2`]=joint(`Maker${Side}Thumb2`,thumb,[0,-.034,0]);
 }
 const bones=[];root.traverse(o=>{if(o.isBone)bones.push(o);});
 return {root,body,head,joints:j,bones};
}

// Original procedural Maker: kiln-white enamel shells over a graphite under-suit,
// gunmetal joints, champagne trim and a sage linen shawl. One skeleton drives a
// skinned mesh per material, so articulation (fingers, toes, spine, cloth)
// costs bones rather than draw calls. Shells stay rigid on their bone; only the
// waist, neck and cloth blend between bones.
export function createMakerModel(){
 const rig=createMakerRig(),{root,body,head,joints:j,bones}=rig,geometries=[],materials=[],textures=[];
 const own=g=>(geometries.push(g),g);
 const sphere=own(new THREE.SphereGeometry(.5,24,16)),bead=own(new THREE.SphereGeometry(.5,12,8)),softBox=own(new RoundedBoxGeometry(1,1,1,3,.2)),capsule=own(new THREE.CapsuleGeometry(.5,1,6,16)),stub=own(new THREE.CapsuleGeometry(.5,1,3,10)),disc=own(new THREE.CylinderGeometry(.5,.5,1,28));
 const cloth=surfaceTextures('linen'),enamel=surfaceTextures('enamel'),metal=surfaceTextures('metal'),rubber=surfaceTextures('rubber');textures.push(...Object.values(cloth),...Object.values(enamel),...Object.values(metal),...Object.values(rubber));
 const make=(name,color,detail,extra={})=>{const m=new THREE.MeshPhysicalMaterial({name,color,roughness:.32,...(detail??{}),...extra});m.normalScale.setScalar(detail===cloth?1.15:detail===metal?.16:detail===rubber?.6:.05);materials.push(m);return m;};
 const palette={
  ceramic:make('Maker enamel','#ece8da',enamel,{metalness:.05,roughness:.3,clearcoat:.8,clearcoatRoughness:.16,sheen:.25,sheenColor:'#fff6e4',sheenRoughness:.5}),
  alloy:make('Maker gunmetal','#5d6467',metal,{metalness:.82,roughness:.32,clearcoat:.25}),
  trim:make('Maker champagne trim','#c2a26a',metal,{metalness:.9,roughness:.24}),
  suit:make('Maker graphite suit','#2d3133',rubber,{roughness:.62,sheen:.5,sheenColor:'#7d8a86',sheenRoughness:.45}),
  linen:make('Maker tailored cape','#8ea198',cloth,{roughness:.85,sheen:.55,sheenColor:'#d6dcc8',side:THREE.DoubleSide}),
  moss:make('Maker green sash','#55704f',cloth,{roughness:.82,sheen:.4,sheenColor:'#8fa47c',side:THREE.DoubleSide}),
  visor:make('Maker visor','#0c1214',null,{metalness:.35,roughness:.06,clearcoat:1,clearcoatRoughness:.03}),
  eyes:make('Maker optical glass','#e9fff1',null,{roughness:.1,clearcoat:1,emissive:'#c4f5d6',emissiveIntensity:2.4}),
  ember:make('Maker core','#e3e8bd',null,{roughness:.22,emissive:'#b9e3a0',emissiveIntensity:1.1,clearcoat:.6}),
 };
 root.updateMatrixWorld(true);
 const index=new Map(bones.map((bone,i)=>[bone,i])),buckets=new Map(),local=new THREE.Object3D(),matrix=new THREE.Matrix4(),parts={};
 // Every piece is baked into rest-pose model space with up to four bone weights.
 function push(group,material,geometry,weights){
  if(!geometry.index){const n=geometry.attributes.position.count;geometry.setIndex([...Array(n).keys()]);}
  for(const name of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(name))geometry.deleteAttribute(name);
  const p=geometry.attributes.position,count=p.count,skinIndex=new Uint16Array(count*4),skinWeight=new Float32Array(count*4);
  for(let i=0;i<count;i++){
   const list=typeof weights==='function'?weights(p.getX(i),p.getY(i),p.getZ(i)):[[weights,1]];let total=0;
   list.slice(0,4).forEach(([bone,w],k)=>{skinIndex[i*4+k]=index.get(bone);skinWeight[i*4+k]=w;total+=w;});
   for(let k=0;k<4;k++)skinWeight[i*4+k]/=total||1;
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndex,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeight,4));
  const key=`${group}:${material.name}`;if(!buckets.has(key))buckets.set(key,{group,material,parts:[]});buckets.get(key).parts.push(geometry);return geometry;
 }
 const place=(frame,g,p=[0,0,0],s=[1,1,1],r=[0,0,0])=>{local.position.set(...p);local.scale.set(...s);local.rotation.set(...r);local.updateMatrix();matrix.multiplyMatrices(frame.matrixWorld,local.matrix);return g.clone().applyMatrix4(matrix);};
 const rigid=(bone,g,material,p,s,r,group='body')=>push(group,material,place(bone,g,p,s,r),bone);
 const blended=(g,material,weights,p,s,r,group='body')=>push(group,material,place(body,g,p,s,r),weights);
 const toBody=y=>y-MAKER_LIMBS.pelvisHeight;

 // Torso: rigid pelvis and chest shells over a ribbed waist that bends between them.
 rigid(body,sphere,palette.alloy,[0,.035,0],[.30,.21,.235]);rigid(body,sphere,palette.ceramic,[0,.03,-.045],[.24,.20,.20]);
 const waist=own(profile(Array.from({length:23},(_,i)=>{const y=.07+i*.011;return [i===0||i===22?0:.142+.009*Math.cos((y-.07)*Math.PI*2/.044),y];}),.8,44,32));
 blended(waist,palette.suit,(x,y)=>{const b=toBody(y),c=ramp(.21,.29,b),s=(1-c)*ramp(.10,.19,b);return [[j.chest,c],[j.spine,s],[body,1-c-s]];});
 // The upper chest continues across the shoulder sockets into a raised neck seat.
 const chestShell=own(profile([[0,-.06],[.168,-.06],[.172,-.035],[.21,.12],[.225,.19],[.22,.25],[.17,.29],[.105,.32],[.075,.345],[0,.345]],.68));
 parts.torso=rigid(j.chest,chestShell,palette.ceramic,[0,0,0]).clone();
 const neckSeat=own(new THREE.TorusGeometry(.052,.009,8,32));rigid(j.chest,neckSeat,palette.alloy,[0,.349,0],[1,1,1],[Math.PI/2,0,0]);
 // Panel seams and the core bezel are projected onto the chest shell itself.
 const probeMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),ray=new THREE.Raycaster();
 const shellProbe=new THREE.Mesh(chestShell,probeMaterial);shellProbe.updateMatrixWorld(true);
 const onShell=(probe,x,y,offset,from=-1)=>{ray.set(new THREE.Vector3(x,y,from),new THREE.Vector3(0,0,-from));const hit=ray.intersectObject(probe)[0];if(!hit)throw new Error('Maker detail lies outside its shell');return new THREE.Vector3(x,y,hit.point.z+from*offset);};
 const seam=(probe,points,radius,from=-1)=>own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(([x,y])=>onShell(probe,x,y,radius*.6,from))),Math.max(12,points.length*8),radius,5,false));
 rigid(j.chest,seam(shellProbe,[[-.17,.215],[-.1,.165],[-.035,.145],[.035,.145],[.1,.165],[.17,.215]],.0022),palette.trim);
 rigid(j.chest,seam(shellProbe,[[0,.03],[0,.07],[0,.12],[0,.145]],.0018),palette.trim);
 rigid(j.chest,seam(shellProbe,[[-.15,.255],[-.07,.235],[0,.23],[.07,.235],[.15,.255]],.002,1),palette.trim);
 for(let i=0;i<4;i++)rigid(j.chest,stub,palette.alloy,[0,.02+i*.06,onShell(shellProbe,0,.02+i*.06,0,1).z+.003],[.034,.014,.02]);
 const core=onShell(shellProbe,0,.085,0);
 rigid(j.chest,disc,palette.alloy,[0,.085,core.z-.004],[.096,.02,.096],[Math.PI/2,0,0]);rigid(j.chest,own(new THREE.TorusGeometry(.046,.0055,8,40)),palette.trim,[0,.085,core.z-.012]);
 rigid(j.chest,sphere,palette.ember,[0,.085,core.z-.016],[.066,.072,.026]);
 // The shoulder edge stays above the ball joint. Front and back panels descend
 // outside the shell, leaving the arms free rather than cutting through them.
 const drape=(u,v)=>{const a=u*Math.PI*2,s=Math.sin(a),c=Math.cos(a),front=Math.max(0,-c)**2,back=Math.max(0,c)**2,coverage=(1-s)*.5,spread=Math.sin(v*Math.PI/2),fold=(Math.sin(a*7+v*2)+.3*Math.sin(a*15-v))*.008*spread;
  return [s*(.103+spread*(.075+.147*coverage)+fold),.67-.03*(1-spread)-(.02+.20*front+.32*back+.07*s*(front+back))*(v*.25+v*v*.75)+fold*.7,c*(.09+spread*(c<0?.11:.155)+fold)];};
 // Cloth follows the chest at the collar and two spring-driven panels toward the hem.
 const capeWeights=(x,y,z)=>{const b=toBody(y),hang=ramp(.62,.38,b),front=ramp(.02,-.10,z),back=ramp(-.02,.10,z);return [[j.chest,1-hang*(front+back)],[j.capeFront,hang*front],[j.capeBack,hang*back]];};
 const shawl=blended(own(clothSurface(drape,64,16,.006)),palette.linen,capeWeights,[0,0,0],[1,1,1],[0,0,0],'cape');
 parts.cape=shawl.clone();
 const hemPoints=Array.from({length:65},(_,i)=>new THREE.Vector3(...drape(i/64,1))),hem=own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hemPoints),64,.0035,5,false));blended(hem,palette.trim,capeWeights);
 const collarPoints=Array.from({length:49},(_,i)=>new THREE.Vector3(...drape(i/48,.035))),collar=own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(collarPoints),48,.0045,6,false));blended(collar,palette.trim,capeWeights);
 const belt=own(new THREE.TorusGeometry(.16,.026,10,48));rigid(body,belt,palette.moss,[0,.115,0],[1,.80,1],[Math.PI/2,0,.04]);rigid(body,belt,palette.moss,[0,.075,0],[1,.80,1],[Math.PI/2,0,-.04]);
 rigid(body,sphere,palette.moss,[.065,.09,-.15],[.09,.065,.055]);rigid(body,own(new THREE.TorusGeometry(.03,.006,6,24)),palette.trim,[.065,.09,-.177]);
 // Sash tails hang from the knot on bone chains, so they swing and settle.
 // Tent weights centred on each link keep the skin continuous across links.
 const chain=(bones,y0,y1)=>(x,y)=>{const t=Math.max(.5,Math.min(bones.length-.5,(y0-toBody(y))/(y0-y1)*bones.length));return bones.map((bone,k)=>[bone,Math.max(0,1-Math.abs(t-k-.5))]).filter(([,w])=>w>0);};
 const tie=own(clothSurface((u,v)=>[(u-.5)*.065+.055-v*.025,.075-v*.34,-.15-.025*Math.sin(v*Math.PI)+.006*Math.sin(u*8)],8,12,.004));blended(tie,palette.moss,chain([j.tie1,j.tie2,j.tie3],.075,-.265));
 const shortTie=own(clothSurface((u,v)=>[(u-.5)*.06+.09+v*.055,.065-v*.20,-.15+.009*Math.sin(v*6+u*3)],8,8,.004));blended(shortTie,palette.moss,chain([j.sideTie1,j.sideTie2],.065,-.135));

 // Head: a ribbed neck, the cranial shell, a smoked visor band with two lit apertures.
 const neck=own(profile(Array.from({length:13},(_,i)=>{const y=.6+i*.0075;return [i===0||i===12?0:.043+.004*Math.cos(i*Math.PI*.95),y];}),1,26,24));
 blended(neck,palette.suit,(x,y)=>{const t=ramp(.62,.69,toBody(y));return [[j.neck,1-t],[head,t]];},[0,0,0],[1,1,1],[0,0,0],'head');
 rigid(j.neck,capsule,palette.alloy,[0,0,0],[.088,.03,.088],[0,0,0],'head');
 const cranialShell=own(profile([[0,.675],[.055,.685],[.088,.71],[.113,.755],[.125,.808],[.122,.853],[.103,.897],[.065,.926],[0,.94]],.90,48,48));
 // A shallow continuous bridge belongs to the shell, not a separate button nose.
 const headVertices=cranialShell.attributes.position;
 for(let i=0;i<headVertices.count;i++)if(headVertices.getZ(i)<0){const x=headVertices.getX(i),y=headVertices.getY(i);headVertices.setZ(i,headVertices.getZ(i)-.004*Math.exp(-((x/.020)**2)-(((y-.798)/.038)**2)));}
 cranialShell.computeVertexNormals();
 parts.head=blended(cranialShell,palette.ceramic,head,[0,0,0],[1,1,1],[0,0,0],'head').clone();
 const headProbe=new THREE.Mesh(cranialShell,probeMaterial);headProbe.updateMatrixWorld(true);
 // Facial features are projected onto the same curved shell so nothing floats.
 function shellPatch(shape,bone,material,offset,cx=0,cy=.822){
  const geometry=new THREE.ShapeGeometry(shape,24);geometry.rotateY(Math.PI);const p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){const point=onShell(headProbe,cx+p.getX(i),cy+p.getY(i),offset);p.setXYZ(i,point.x,point.y,point.z);}
  geometry.computeVertexNormals();return blended(own(geometry),material,bone,[0,0,0],[1,1,1],[0,0,0],'head');
 }
 const visorOutline=(t,rx=.094,ry=.034)=>{const a=t*Math.PI*2,c=Math.cos(a),s=Math.sin(a);return [Math.sign(c)*Math.abs(c)**.55*rx,Math.sign(s)*Math.abs(s)**.75*ry-.002*(1-c*c)];};
 const visor=new THREE.Shape();for(let i=0;i<=64;i++){const [x,y]=visorOutline(i/64);i?visor.lineTo(x,y):visor.moveTo(x,y);}
 shellPatch(visor,head,palette.visor,.0012);
 blended(own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({length:64},(_,i)=>{const [x,y]=visorOutline(i/64);return onShell(headProbe,x,.822+y,.0018);}),true),96,.0024,5,true)),palette.trim,head,[0,0,0],[1,1,1],[0,0,0],'head');
 for(const side of [-1,1]){
  const aperture=new THREE.Shape();aperture.absellipse(0,0,.021,.0088,0,Math.PI*2,false,0);shellPatch(aperture,j.eyes,palette.eyes,.0032,side*.045);
  rigid(head,disc,palette.alloy,[side*.124,.103,0],[.061,.012,.061],[0,0,Math.PI/2],'head');rigid(head,own(new THREE.TorusGeometry(.024,.004,6,24)),palette.trim,[side*.131,.103,0],[1,1,1],[0,Math.PI/2,0],'head');
  const seamPoints=[[side*.084,.776],[side*.077,.752],[side*.062,.727]].map(([x,y])=>onShell(headProbe,x,y,.0005));
  blended(own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seamPoints),16,.00075,4,false)),palette.trim,head,[0,0,0],[1,1,1],[0,0,0],'head');
 }
 blended(seam(headProbe,[[0,.93],[0,.90],[0,.86]],.0016),palette.trim,head,[0,0,0],[1,1,1],[0,0,0],'head');
 const crown=[...Array(9).keys()].map(i=>onShell(headProbe,0,.86+i*.0095,.0009,1));
 blended(own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(crown),24,.0016,5,false)),palette.trim,head,[0,0,0],[1,1,1],[0,0,0],'head');
 probeMaterial.dispose();

 const segment=(bone,length,width,material,depth=width)=>rigid(bone,stub,material,[0,-length/2,0],[width,length/2,depth]);
 const upperArm=own(profile([[0,-.14],[.038,-.135],[.052,-.07],[.064,.075],[.052,.13],[0,.14]],.95));
 const forearm=own(profile([[0,-.13],[.033,-.125],[.04,-.08],[.058,.055],[.05,.12],[0,.13]],.90));
 const thigh=own(profile([[0,-.19],[.055,-.18],[.073,-.08],[.086,.11],[.065,.18],[0,.19]],1.03));
 const shin=own(profile([[0,-.18],[.036,-.17],[.045,-.09],[.068,.07],[.055,.17],[0,.18]],.95));
 const cuff=own(new THREE.TorusGeometry(.036,.0065,8,32)),band=own(new THREE.TorusGeometry(.056,.005,8,32));
 for(const [name,side] of SIDES){
  const J=key=>j[`${name}${key}`];
  rigid(J('Shoulder'),sphere,palette.alloy,[0,0,0],[.14,.14,.14]);rigid(J('Shoulder'),disc,palette.trim,[side*.066,0,0],[.09,.012,.09],[0,0,Math.PI/2]);
  rigid(J('Shoulder'),sphere,palette.ceramic,[side*.02,.03,0],[.15,.11,.158],[0,0,side*.25]);
  rigid(J('Shoulder'),upperArm,palette.ceramic,[0,-.17,0]);rigid(J('Shoulder'),band,palette.trim,[0,-.245,0],[.9,.9,.86],[Math.PI/2,0,0]);
  rigid(J('Elbow'),sphere,palette.alloy,[0,0,0],[.088,.088,.088]);rigid(J('Elbow'),disc,palette.trim,[side*.039,0,0],[.057,.013,.057],[0,0,Math.PI/2]);
  rigid(J('Elbow'),forearm,palette.ceramic,[0,-.145,0]);rigid(J('Elbow'),cuff,palette.trim,[0,-.252,0],[1,1,.92],[Math.PI/2,0,0]);
  // Hand space: fingers along -y, palm toward -z; the wrist's rest turn faces the palm inward.
  const wrist=J('Wrist');rigid(wrist,sphere,palette.alloy,[0,0,0],[.05,.046,.05]);
  rigid(wrist,softBox,palette.ceramic,[0,-.054,0],[.084,.092,.04]);rigid(wrist,softBox,palette.ceramic,[0,-.058,.012],[.062,.058,.02]);rigid(wrist,own(new THREE.TorusGeometry(.03,.0022,5,28)),palette.trim,[0,-.058,.0215],[1.05,1,1]);
  FINGERS.forEach(([finger,length],i)=>{
   const width=i===3?.0155:.0175,first=J(`${finger}1`),second=J(`${finger}2`);
   rigid(first,bead,palette.alloy,[0,0,0],[width*1.02,width*1.02,width*1.02]);segment(first,length*.52,width,palette.ceramic,width*1.05);
   rigid(second,bead,palette.alloy,[0,0,0],[width*.9,width*.9,width*.9]);segment(second,length*.48,width*.94,palette.ceramic,width);
  });
  rigid(J('Thumb1'),bead,palette.alloy,[0,0,0],[.021,.021,.021]);segment(J('Thumb1'),.036,.021,palette.ceramic);rigid(J('Thumb2'),bead,palette.alloy,[0,0,0],[.018,.018,.018]);segment(J('Thumb2'),.032,.019,palette.ceramic);
  rigid(J('Hip'),sphere,palette.alloy,[0,0,0],[.137,.14,.14]);rigid(J('Hip'),thigh,palette.ceramic,[0,-.205,.004]);
  rigid(J('Knee'),sphere,palette.alloy,[0,0,0],[.105,.108,.108]);rigid(J('Knee'),disc,palette.trim,[side*.048,0,0],[.07,.014,.07],[0,0,Math.PI/2]);
  rigid(J('Knee'),sphere,palette.ceramic,[0,.005,-.042],[.07,.085,.04]);rigid(J('Knee'),shin,palette.ceramic,[0,-.21,.006]);rigid(J('Knee'),band,palette.trim,[0,-.36,.004],[.82,.82,.78],[Math.PI/2,0,0]);
  // Foot: rigid heel and arch; the toe cap bends at the ball. Soles meet the ground at ankle height.
  const foot=J('Foot'),toe=J('Toe');
  rigid(foot,sphere,palette.alloy,[0,0,0],[.074,.074,.074]);rigid(foot,sphere,palette.ceramic,[0,-.036,.004],[.112,.088,.15]);rigid(foot,sphere,palette.ceramic,[0,-.05,-.04],[.118,.072,.13]);
  rigid(foot,softBox,palette.suit,[0,-.079,-.012],[.106,.022,.156]);rigid(foot,bead,palette.alloy,[side*.058,-.06,-.085],[.016,.016,.016]);
  rigid(toe,sphere,palette.ceramic,[0,.006,-.036],[.112,.05,.1]);rigid(toe,softBox,palette.suit,[0,-.009,-.042],[.1,.022,.088]);
 }

 const skeleton=new THREE.Skeleton(bones),headMeshes=[],hiddenInFirstPerson=[],identity=new THREE.Matrix4();
 for(const {group,material,parts:pieces} of buckets.values()){
  const geometry=own(mergeGeometries(pieces));pieces.forEach(g=>g.dispose());
  if(group==='cape')geometry.userData.thickness=.006;
  const mesh=new THREE.SkinnedMesh(geometry,material);mesh.name=group==='cape'?'MakerCape':`Maker ${group} ${material.name}`;
  mesh.castShadow=mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.raycast=()=>{};
  (group==='head'?head:root).add(mesh);mesh.bind(skeleton,identity);if(group==='head')headMeshes.push(mesh);if(group!=='body')hiddenInFirstPerson.push(mesh);
 }
 // First person hides the head and the shawl that sits just under the eye, keeping both shadows.
 const hiddenMaterials=new Map();for(const mesh of hiddenInFirstPerson){const visible=mesh.material;let hidden=hiddenMaterials.get(visible);if(!hidden){hidden=visible.clone();hidden.colorWrite=false;hidden.depthWrite=false;materials.push(hidden);hiddenMaterials.set(visible,hidden);}mesh.userData.visibleMaterial=visible;mesh.userData.hiddenMaterial=hidden;}
 return {root,body,head,joints:j,bones,skeleton,headMeshes,parts,palette,
  setFirstPerson(value){for(const mesh of hiddenInFirstPerson)mesh.material=value?mesh.userData.hiddenMaterial:mesh.userData.visibleMaterial;},
  dispose(){geometries.forEach(g=>g.dispose());Object.values(parts).forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());skeleton.dispose();}};
}
