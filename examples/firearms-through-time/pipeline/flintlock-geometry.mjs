// Pattern 1742 musket geometry for analysis (round v14): exported-GLB triangles in the gun frame
// (metres, +X muzzle, +Y up, +Z right), grouped by owner joint, mesh, material and authored part.
// Analysis only; nothing here is shipped to a browser or engine.
import {readGLB,poseGLB,rotate} from './glb-analysis.mjs';
import {surface,nearest,closestOnTriangle,isInside,signed,section,insideBox} from './support-grip-v13-geometry.mjs';
export {surface,nearest,closestOnTriangle,isInside,signed,section,insideBox};

export const sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
 cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a),unit=a=>mul(a,1/len(a)),deg=Math.PI/180;

// Rotation of point p about an axis (unit) through o by angle a (radians).
export function rotAbout(p,o,axis,a){const v=sub(p,o),c=Math.cos(a),s=Math.sin(a),k=axis,kv=cross(k,v),kd=dot(k,v);return add(o,[v[0]*c+kv[0]*s+k[0]*kd*(1-c),v[1]*c+kv[1]*s+k[1]*kd*(1-c),v[2]*c+kv[2]*s+k[2]*kd*(1-c)]);}

// Authored material of each part role (authoring/firearm-flintlock-v2-anchors.kiln.js); the export merges parts by owner and material.
export const partMaterial={WalnutFurniture:'Flintlock_Walnut',BarrelBlindCavity:'Flintlock_Steel',Tang:'Flintlock_Steel',FrontStud:'Flintlock_Steel',LockPlate:'Flintlock_Steel',PanExterior:'Flintlock_Steel',StoredRamrod:'Flintlock_Steel',RamrodTip:'Flintlock_Steel',PlateScrew:'Flintlock_Steel',CockAxleExterior:'Flintlock_Steel',
 SidePlate:'Flintlock_Brass',TriggerGuard:'Flintlock_Brass',GuardRearFinial:'Flintlock_Brass',GuardFrontFinial:'Flintlock_Brass',ButtPlate:'Flintlock_Brass',ButtTang:'Flintlock_Brass',WristEscutcheon:'Flintlock_Brass',RamrodPipe:'Flintlock_Brass',PipeRim:'Flintlock_Brass',EntryPipeApron:'Flintlock_Brass',
 ExteriorSpring:'Flintlock_DarkSteel',ScrewSlot:'Flintlock_DarkSteel',CockNeck:'Flintlock_Steel',CockPivotBoss:'Flintlock_Steel',LowerJaw:'Flintlock_Steel',UpperJaw:'Flintlock_Steel',Stone:'Flintlock_Stone',JawScrew:'Flintlock_Steel',JawScrewHead:'Flintlock_Steel',FrizzenShell:'Flintlock_Steel',FrizzenBoss:'Flintlock_Steel',TriggerBlade:'Flintlock_Steel'};
export async function loadMusket(path){const g=await readGLB(path),pose=poseGLB(g,null,0),j=g.j;
 const parentOf=new Map();j.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>parentOf.set(c,i)));
 const ownerOf=i=>{let k=i;while(k!==undefined){const nm=j.nodes[k].name??'';if(/^Joint_/.test(nm))return nm;k=parentOf.get(k);}return 'root';};
 const meshes=[],parts=[];
 for(const [i,n]of j.nodes.entries()){
  if(n.name?.startsWith('part_')&&n.extras?.sourceBounds){const owner=ownerOf(i),w=pose.get(j.nodes[parentOf.get(i)].name);const b=n.extras.sourceBounds,corners=[];for(const x of [b.min[0],b.max[0]])for(const y of [b.min[1],b.max[1]])for(const z of [b.min[2],b.max[2]])corners.push(add(rotate(w.q,[x,y,z]),w.p));
   const min=[0,1,2].map(k=>Math.min(...corners.map(c=>c[k]))),max=[0,1,2].map(k=>Math.max(...corners.map(c=>c[k])));parts.push({name:n.name,role:n.extras.role,owner,min,max});}
  if(n.mesh===undefined)continue;const w=pose.get(n.name);
  for(const p of j.meshes[n.mesh].primitives){const P=g.data(p.attributes.POSITION).map(v=>add(rotate(w.q,v),w.p)),ix=p.indices===undefined?P.map((_,k)=>k):g.data(p.indices).flat(),tris=[];
   for(let k=0;k<ix.length;k+=3)tris.push([P[ix[k]],P[ix[k+1]],P[ix[k+2]]]);meshes.push({name:n.name,owner:ownerOf(i),material:j.materials[p.material]?.name??'',tris});}}
 const node=name=>{const k=j.nodes.findIndex(n=>n.name===name);return k<0?null:{index:k,name,local:{t:j.nodes[k].translation??[0,0,0],r:j.nodes[k].rotation??[0,0,0,1]},world:pose.get(name),extras:j.nodes[k].extras??null};};
 // Assign each triangle to the smallest authored part box of the same owner and material that contains its centroid.
 const partOf=(owner,material,t)=>{const c=[0,1,2].map(k=>(t[0][k]+t[1][k]+t[2][k])/3);let best=null,vol=Infinity;for(const p of parts){if(p.owner!==owner||(partMaterial[p.role]&&partMaterial[p.role]!==material))continue;if(!insideBox(c,{min:p.min,max:p.max},2e-4))continue;const v=(p.max[0]-p.min[0])*(p.max[1]-p.min[1])*(p.max[2]-p.min[2]);if(v<vol){vol=v;best=p.role;}}return best;};
 const byPart=new Map();for(const m of meshes)for(const t of m.tris){const role=partOf(m.owner,m.material,t)??'unassigned';const key=m.owner+'|'+role;if(!byPart.has(key))byPart.set(key,{owner:m.owner,role,material:m.material,tris:[]});byPart.get(key).tris.push(t);}
 return {glb:g,json:j,pose,meshes,parts,node,byPart:[...byPart.values()]};}

// Triangle-set clearance: minimum vertex-to-surface distance both ways, and whether any edge of one set crosses
// a triangle of the other (intersection). Sampled vertices plus exact edge crossings; not a swept-volume proof.
function edgeHits(A,B){for(const a of A)for(let e=0;e<3;e++){const p=a[e],q=a[(e+1)%3],d=sub(q,p),L=len(d);if(L<1e-12)continue;const u=mul(d,1/L);
  for(const b of B){const e1=sub(b[1],b[0]),e2=sub(b[2],b[0]),h=cross(u,e2),det=dot(e1,h);if(Math.abs(det)<1e-14)continue;const f=1/det,s=sub(p,b[0]),uu=f*dot(s,h);if(uu<0||uu>1)continue;const qq=cross(s,e1),vv=f*dot(u,qq);if(vv<0||uu+vv>1)continue;const t=f*dot(e2,qq);if(t>=0&&t<=L)return true;}}return false;}
export function clearance(A,B,{exclude}={}){const keep=T=>exclude?T.filter(t=>!exclude(t)):T,a=keep(A),b=keep(B);if(!a.length||!b.length)return {distance:null,intersects:false,triangles:[a.length,b.length]};
 const sa=surface('a',a),sb=surface('b',b);let best={d:Infinity};
 const boxGap=(p,s)=>Math.hypot(Math.max(s.min[0]-p[0],0,p[0]-s.max[0]),Math.max(s.min[1]-p[1],0,p[1]-s.max[1]),Math.max(s.min[2]-p[2],0,p[2]-s.max[2]));
 for(const [X,S,from]of [[a,sb,'a'],[b,sa,'b']]){const seen=new Set();for(const t of X)for(const p of t){const k=p.join(',');if(seen.has(k))continue;seen.add(k);if(boxGap(p,S)>=best.d)continue;const n=nearest(p,S);if(n.d<best.d)best={d:n.d,p,q:n.q,from};}}
 // Intersection test only when the sets are close; restrict to triangles near each other's boxes.
 let intersects=false;if(best.d<.003){const near=(T,S)=>T.filter(t=>t.some(p=>boxGap(p,S)<.003));intersects=edgeHits(near(a,sb),near(b,sa))||edgeHits(near(b,sa),near(a,sb));}
 return {distance:intersects?0:best.d,minVertexDistance:best.d,intersects,at:best.p,on:best.q,from:best.from,triangles:[a.length,b.length]};}
export const transformTris=(T,f)=>T.map(t=>t.map(f));
