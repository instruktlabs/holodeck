// Colt M4 v3 (asset a_b50808618ce54c1386d12212e186cc47, revision r_f0ad6458af8b40c48ca99eca88d48abe) surfaces for the
// carbine hands: grip, trigger, handguard, magazine, magazine well and charging handle, posed at rest in the gun frame
// (metres, +X muzzle, +Y up, +Z right). Shared by pipeline/carbine-hand-design.mjs, carbine-hand-author.mjs and
// measure-carbine-grip.mjs. The gun is read only; nothing here writes it.
import {createHash} from 'node:crypto';
import {readGLB,poseGLB,rotate} from './glb-analysis.mjs';
import {surface,nearest,section,planeSection,insideBox,closestOnTriangle} from './support-grip-v13-geometry.mjs';

export const M4={assetId:'a_b50808618ce54c1386d12212e186cc47',revisionId:'r_f0ad6458af8b40c48ca99eca88d48abe',collection:'project',
 glb:'authoring/assets/kiln/a_b50808618ce54c1386d12212e186cc47/revisions/r_f0ad6458af8b40c48ca99eca88d48abe/asset.glb',
 source:'authoring/assets/kiln/a_b50808618ce54c1386d12212e186cc47/revisions/r_f0ad6458af8b40c48ca99eca88d48abe/source.kiln.js',
 sha256:'d91af29c8b87e85ca1bb277eed9991b9c6b46a738919704ab943fc4f6b60162b',pins:'authoring/firearm-carbine-v3-pins.json'};
const workspace=new URL('../',import.meta.url);

// Trigger blade: the part of the receiver steel below the receiver floor (y < 0.036) between the grip and the magazine well.
const isTrigger=t=>t.every(p=>p[1]<.036&&p[0]>-.09&&p[0]<-.02);

export async function loadCarbine(){const g=await readGLB(new URL(M4.glb,workspace)),sha=createHash('sha256').update(g.b).digest('hex');
 if(sha!==M4.sha256)throw Error('M4 GLB hash mismatch: '+sha);
 const pose=poseGLB(g,null,0),meshes={},anchors={},nodes={};
 for(const n of g.j.nodes){const w=pose.get(n.name);nodes[n.name]={translation:n.translation??[0,0,0],rotation:n.rotation??[0,0,0,1],scale:n.scale??[1,1,1],world:w.p,worldQ:w.q};if(n.name.startsWith('anchor_')||n.name.startsWith('Joint_'))anchors[n.name]=w.p;
  if(n.mesh===undefined)continue;const tris=[];for(const p of g.j.meshes[n.mesh].primitives){const P=g.data(p.attributes.POSITION).map(v=>rotate(w.q,v).map((x,k)=>x+w.p[k])),ix=p.indices===undefined?P.map((_,i)=>i):g.data(p.indices).flat();for(let i=0;i<ix.length;i+=3)tris.push([P[ix[i]],P[ix[i+1]],P[ix[i+2]]]);}
  meshes[n.name]=tris;}
 const parentOf=name=>{const i=g.j.nodes.findIndex(n=>n.name===name);const p=g.j.nodes.findIndex(n=>(n.children??[]).includes(i));return p<0?null:g.j.nodes[p].name;};
 const owner=name=>{let n=name;while(n&&!['Joint_Magazine','Joint_ChargingHandle'].includes(n))n=parentOf(n);return n??null;};
 const surfaces=Object.entries(meshes).map(([name,tris])=>({...surface(name,tris),owner:owner(name)}));
 const by=n=>surfaces.find(s=>s.name===n);
 const grip=by('Mesh_Receiver_Carbine_Polymer'),handguard=by('Mesh_Handguard_Carbine_Polymer'),lower=by('Mesh_Receiver_Carbine_Anodized'),steel=by('Mesh_Receiver_Carbine_Steel');
 const trigger=surface('Mesh_Receiver_Carbine_Steel trigger blade (triangles below y 0.036 between x -0.09 and -0.02)',steel.tris.filter(isTrigger));
 const magazine=surface('Joint_Magazine subtree (Mesh_Magazine_Carbine_Magazine + Mesh_Magazine_Carbine_Steel)',[...by('Mesh_Magazine_Carbine_Magazine').tris,...by('Mesh_Magazine_Carbine_Steel').tris]);
 const chargingHandle=by('Mesh_ChargingHandle_Carbine_Steel');
 return {glb:g,sha256:sha,nodes,anchors,surfaces,by,grip,handguard,lower,steel,trigger,magazine,chargingHandle};}

// ---- fast point-inside test ------------------------------------------------------------------------------------
// Majority of three skew-ray parities, as support-grip-v13-geometry.isInside, with each ray's triangles binned in a
// 2-D grid perpendicular to the ray, so a query touches only the triangles its ray can cross.
const RAYS=[[.30,.80,.52],[-.20,-.60,.77],[.25,-.50,-.83]].map(v=>{const l=Math.hypot(...v);return v.map(x=>x/l);});
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],unit=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);};
export function insideTester(s,cell=.003){if(s._inside)return s._inside;
 const grids=RAYS.map(d=>{const e1=unit(Math.abs(d[0])<.9?cross(d,[1,0,0]):cross(d,[0,1,0])),e2=cross(d,e1),uv=p=>[dot(p,e1),dot(p,e2)];
  let u0=Infinity,v0=Infinity,u1=-Infinity,v1=-Infinity;const boxes=[];for(let i=0;i<s.n;i++){const q=s.tris[i].map(uv),a=Math.min(q[0][0],q[1][0],q[2][0]),b=Math.max(q[0][0],q[1][0],q[2][0]),c=Math.min(q[0][1],q[1][1],q[2][1]),e=Math.max(q[0][1],q[1][1],q[2][1]);boxes.push([a,b,c,e]);u0=Math.min(u0,a);u1=Math.max(u1,b);v0=Math.min(v0,c);v1=Math.max(v1,e);}
  const nu=Math.max(1,Math.ceil((u1-u0)/cell)),nv=Math.max(1,Math.ceil((v1-v0)/cell)),bins=new Map();
  boxes.forEach(([a,b,c,e],i)=>{for(let x=Math.floor((a-u0)/cell);x<=Math.floor((b-u0)/cell);x++)for(let y=Math.floor((c-v0)/cell);y<=Math.floor((e-v0)/cell);y++){const k=x*nv+y;let l=bins.get(k);if(!l)bins.set(k,l=[]);l.push(i);}});
  return {d,uv,u0,v0,nv,nu,bins};});
 const T=s.T,parity=(p,G)=>{const [u,v]=G.uv(p),x=Math.floor((u-G.u0)/cell),y=Math.floor((v-G.v0)/cell);if(x<0||y<0||x>=G.nu||y>=G.nv)return false;const list=G.bins.get(x*G.nv+y);if(!list)return false;const d=G.d,hits=[];
  for(const i of list){const o=i*9,e1x=T[o+3]-T[o],e1y=T[o+4]-T[o+1],e1z=T[o+5]-T[o+2],e2x=T[o+6]-T[o],e2y=T[o+7]-T[o+1],e2z=T[o+8]-T[o+2];
   const px=d[1]*e2z-d[2]*e2y,py=d[2]*e2x-d[0]*e2z,pz=d[0]*e2y-d[1]*e2x,det=e1x*px+e1y*py+e1z*pz;if(Math.abs(det)<1e-14)continue;const inv=1/det,tx=p[0]-T[o],ty=p[1]-T[o+1],tz=p[2]-T[o+2],uu=(tx*px+ty*py+tz*pz)*inv;if(uu<0||uu>1)continue;
   const qx=ty*e1z-tz*e1y,qy=tz*e1x-tx*e1z,qz=tx*e1y-ty*e1x,vv=(d[0]*qx+d[1]*qy+d[2]*qz)*inv;if(vv<0||uu+vv>1)continue;const t=(e2x*qx+e2y*qy+e2z*qz)*inv;if(t>1e-9&&!hits.some(h=>Math.abs(h-t)<1e-7))hits.push(t);}
  return hits.length%2===1;};
 return s._inside=p=>insideBox(p,s)&&grids.reduce((a,G)=>a+(parity(p,G)?1:0),0)>=2;}
export const fastSigned=(p,s)=>{const n=nearest(p,s);return {gap:insideTester(s)(p)?-n.d:n.d,q:n.q};};

// Triangle normal at the nearest point (for "which face" classification).
export function nearestFace(p,s){let best=Infinity,bi=-1;const q=[0,0,0],c=[0,0,0];for(let i=0;i<s.n;i++){const b=i*6;const dx=Math.max(s.box[b]-p[0],0,p[0]-s.box[b+3]),dy=Math.max(s.box[b+1]-p[1],0,p[1]-s.box[b+4]),dz=Math.max(s.box[b+2]-p[2],0,p[2]-s.box[b+5]);if(dx*dx+dy*dy+dz*dz>=best)continue;
  const d=closestOnTriangle(p,s.T,i*9,c);if(d<best){best=d;bi=i;q[0]=c[0];q[1]=c[1];q[2]=c[2];}}
 const t=s.tris[bi],nrm=unit(cross(t[1].map((v,k)=>v-t[0][k]),t[2].map((v,k)=>v-t[0][k])));return {d:Math.sqrt(best),q,normal:nrm,triangle:bi};}

// Grip cross-section frame: the grip axis is the bisector of the front- and back-strap lines in the bore plane.
export function gripAxis(grip){const at=(y)=>{const segs=planeSection(grip,[0,y,0],[1,0,0],[0,0,1],[0,1,0]),xs=[];for(const [a,b]of segs)if(a[1]*b[1]<=0&&a[1]!==b[1]){const f=a[1]/(a[1]-b[1]);xs.push(a[0]+(b[0]-a[0])*f);}return xs.length?[Math.min(...xs),Math.max(...xs)]:null;};
 const ys=[];for(let y=.018;y>=-.046;y-=.004)ys.push(y);const rows=ys.map(y=>({y,x:at(y)})).filter(r=>r.x);
 const fit=pts=>{const n=pts.length,my=pts.reduce((a,p)=>a+p[1],0)/n,mx=pts.reduce((a,p)=>a+p[0],0)/n;let sxy=0,syy=0;for(const [x,y]of pts){sxy+=(x-mx)*(y-my);syy+=(y-my)**2;}return {slope:sxy/syy,mx,my};};
 const back=fit(rows.map(r=>[r.x[0],r.y])),front=fit(rows.map(r=>[r.x[1],r.y])),slope=(back.slope+front.slope)/2,dir=unit([slope,1,0]);
 return {up:dir,frontSlopeDeg:Math.atan(front.slope)*180/Math.PI,backSlopeDeg:Math.atan(back.slope)*180/Math.PI,axisSlopeDeg:Math.atan(slope)*180/Math.PI,rows};}

// Magazine well axis: least-squares lines through the front and rear faces of the magazine's straight upper section
// (inside the well, y from -0.028 to 0.012 m) and the well's front wall; the drop axis points out of the well (down).
export function magazineAxis(gun){const faces=(s,y0,y1,xmin,xmax)=>{const out=[];for(let y=y1;y>=y0-1e-9;y-=.002){const segs=planeSection(s,[0,y,0],[1,0,0],[0,0,1],[0,1,0]),xs=[];for(const [a,b]of segs)if(a[1]*b[1]<=0&&a[1]!==b[1]){const f=a[1]/(a[1]-b[1]);const x=a[0]+(b[0]-a[0])*f;if(x>xmin&&x<xmax)xs.push(x);}if(xs.length>=2)out.push({y,rear:Math.min(...xs),front:Math.max(...xs)});}return out;};
 const mag=faces(gun.magazine,-.028,.012,-.05,.06);
 const fit=pts=>{const n=pts.length,my=pts.reduce((a,p)=>a+p[1],0)/n,mx=pts.reduce((a,p)=>a+p[0],0)/n;let sxy=0,syy=0;for(const [x,y]of pts){sxy+=(x-mx)*(y-my);syy+=(y-my)**2;}return sxy/syy;};
 const rear=fit(mag.map(r=>[r.rear,r.y])),front=fit(mag.map(r=>[r.front,r.y])),slope=(rear+front)/2,axis=unit([-slope,-1,0]);
 return {dropAxis:axis,rearFaceSlopeDegFromVertical:Math.atan(rear)*180/Math.PI,frontFaceSlopeDegFromVertical:Math.atan(front)*180/Math.PI,samples:mag.length};}

export {surface,nearest,section,planeSection,insideBox};
