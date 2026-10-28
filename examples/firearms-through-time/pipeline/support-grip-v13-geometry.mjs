// Shared gun-surface geometry for the v13 support-grip design and measurement.
// Gun frame: metres, +X muzzle, +Y up, +Z right (far side for a right-handed shooter). Hands and gun share it.
import {readGLB,poseGLB,rotate} from './glb-analysis.mjs';

export const profiles={
 rifle1866:{gun:'authoring/rifle-1866-v3.glb',motion:'game/rifle-motion-v2.json',rig:'game/rifle-arm-rig-v1.json',forendNodes:n=>n.includes('Furniture_Foreend'),forendTriangle:()=>true,forendLabel:'Mesh_Furniture_Foreend_NextFirearm_Walnut'},
 boltNo4:{gun:'authoring/bolt-no4-v2.glb',motion:'game/bolt-no4-motion-v1.json',rig:'game/bolt-no4-arm-rig-v1.json',forendNodes:n=>n.includes('RestoredWood'),forendTriangle:c=>c[0]>.07,forendLabel:'Mesh_Surfaces_FirearmBoltV1_No4MkIStar_BoltV1_RestoredWood triangles forward of x=0.07 m (lower forend and upper handguard are one mesh)'}};

export function surface(name,tris){const n=tris.length,T=new Float64Array(n*9),box=new Float64Array(n*6),min=[1e9,1e9,1e9],max=[-1e9,-1e9,-1e9];
 tris.forEach((t,i)=>{for(let k=0;k<3;k++)for(let c=0;c<3;c++)T[i*9+k*3+c]=t[k][c];for(let c=0;c<3;c++){const lo=Math.min(t[0][c],t[1][c],t[2][c]),hi=Math.max(t[0][c],t[1][c],t[2][c]);box[i*6+c]=lo;box[i*6+3+c]=hi;min[c]=Math.min(min[c],lo);max[c]=Math.max(max[c],hi);}});
 return {name,n,T,box,min,max,tris};}

export async function loadGun(profileName){const profile=profiles[profileName];if(!profile)throw Error('Unknown profile '+profileName);
 const gun=await readGLB(profile.gun),pose=poseGLB(gun,null,0),meshes=[];
 for(const n of gun.j.nodes){if(n.mesh===undefined)continue;const w=pose.get(n.name),tris=[];
  for(const p of gun.j.meshes[n.mesh].primitives){const P=gun.data(p.attributes.POSITION).map(v=>rotate(w.q,v).map((x,k)=>x+w.p[k])),ix=p.indices===undefined?P.map((_,i)=>i):gun.data(p.indices).flat();for(let i=0;i<ix.length;i+=3)tris.push([P[ix[i]],P[ix[i+1]],P[ix[i+2]]]);}
  meshes.push({name:n.name,tris});}
 const forend=surface(profile.forendLabel,meshes.filter(m=>profile.forendNodes(m.name)).flatMap(m=>m.tris).filter(t=>profile.forendTriangle([0,1,2].map(c=>(t[0][c]+t[1][c]+t[2][c])/3))));
 return {profile,glb:gun,forend,surfaces:meshes.map(m=>surface(m.name,m.tris))};}

// Closest point on a triangle (Ericson). Returns the squared distance and writes the point into out.
export function closestOnTriangle(p,T,o,out){const ax=T[o],ay=T[o+1],az=T[o+2],bx=T[o+3],by=T[o+4],bz=T[o+5],cx=T[o+6],cy=T[o+7],cz=T[o+8];
 const abx=bx-ax,aby=by-ay,abz=bz-az,acx=cx-ax,acy=cy-ay,acz=cz-az,apx=p[0]-ax,apy=p[1]-ay,apz=p[2]-az;let qx,qy,qz;
 const d1=abx*apx+aby*apy+abz*apz,d2=acx*apx+acy*apy+acz*apz;
 if(d1<=0&&d2<=0){qx=ax;qy=ay;qz=az;}else{const bpx=p[0]-bx,bpy=p[1]-by,bpz=p[2]-bz,d3=abx*bpx+aby*bpy+abz*bpz,d4=acx*bpx+acy*bpy+acz*bpz;
  if(d3>=0&&d4<=d3){qx=bx;qy=by;qz=bz;}else{const vc=d1*d4-d3*d2;
   if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);qx=ax+abx*v;qy=ay+aby*v;qz=az+abz*v;}else{const cpx=p[0]-cx,cpy=p[1]-cy,cpz=p[2]-cz,d5=abx*cpx+aby*cpy+abz*cpz,d6=acx*cpx+acy*cpy+acz*cpz;
    if(d6>=0&&d5<=d6){qx=cx;qy=cy;qz=cz;}else{const vb=d5*d2-d1*d6;
     if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);qx=ax+acx*w;qy=ay+acy*w;qz=az+acz*w;}else{const va=d3*d6-d5*d4;
      if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));qx=bx+(cx-bx)*w;qy=by+(cy-by)*w;qz=bz+(cz-bz)*w;}else{const den=1/(va+vb+vc),v=vb*den,w=vc*den;qx=ax+abx*v+acx*w;qy=ay+aby*v+acy*w;qz=az+abz*v+acz*w;}}}}}}
 out[0]=qx;out[1]=qy;out[2]=qz;return (p[0]-qx)**2+(p[1]-qy)**2+(p[2]-qz)**2;}
export function nearest(p,s){let best=Infinity;const q=[0,0,0],bestQ=[0,0,0];for(let i=0;i<s.n;i++){const b=i*6;const dx=Math.max(s.box[b]-p[0],0,p[0]-s.box[b+3]),dy=Math.max(s.box[b+1]-p[1],0,p[1]-s.box[b+4]),dz=Math.max(s.box[b+2]-p[2],0,p[2]-s.box[b+5]);if(dx*dx+dy*dy+dz*dz>=best)continue;const d=closestOnTriangle(p,s.T,i*9,q);if(d<best){best=d;bestQ[0]=q[0];bestQ[1]=q[1];bestQ[2]=q[2];}}return {d:Math.sqrt(best),q:bestQ};}
const rays=[[.30,.80,.52],[-.20,-.60,.77],[.25,-.50,-.83]].map(v=>{const l=Math.hypot(...v);return v.map(x=>x/l);});
function parity(p,s,d){const hits=[],T=s.T;for(let i=0;i<s.n;i++){const o=i*9,e1x=T[o+3]-T[o],e1y=T[o+4]-T[o+1],e1z=T[o+5]-T[o+2],e2x=T[o+6]-T[o],e2y=T[o+7]-T[o+1],e2z=T[o+8]-T[o+2];
 const px=d[1]*e2z-d[2]*e2y,py=d[2]*e2x-d[0]*e2z,pz=d[0]*e2y-d[1]*e2x,det=e1x*px+e1y*py+e1z*pz;if(Math.abs(det)<1e-14)continue;const inv=1/det,tx=p[0]-T[o],ty=p[1]-T[o+1],tz=p[2]-T[o+2],u=(tx*px+ty*py+tz*pz)*inv;if(u<0||u>1)continue;
 const qx=ty*e1z-tz*e1y,qy=tz*e1x-tx*e1z,qz=tx*e1y-ty*e1x,v=(d[0]*qx+d[1]*qy+d[2]*qz)*inv;if(v<0||u+v>1)continue;const t=(e2x*qx+e2y*qy+e2z*qz)*inv;if(t>1e-9&&!hits.some(h=>Math.abs(h-t)<1e-7))hits.push(t);}return hits.length%2===1;}
export const insideBox=(p,s,m=0)=>p[0]>=s.min[0]-m&&p[0]<=s.max[0]+m&&p[1]>=s.min[1]-m&&p[1]<=s.max[1]+m&&p[2]>=s.min[2]-m&&p[2]<=s.max[2]+m;
// Majority of three skew-ray parities: robust to rays grazing an edge and to a mesh's open far end.
export const isInside=(p,s)=>insideBox(p,s)&&rays.reduce((a,d)=>a+(parity(p,s,d)?1:0),0)>=2;
export const signed=(p,s)=>{const n=nearest(p,s);return {gap:isInside(p,s)?-n.d:n.d,q:n.q};};
// Cross-section extents of a surface at x, so the vertical centre plane is the middle of the z extent.
export function section(s,x){let y0=1e9,y1=-1e9,z0=1e9,z1=-1e9;for(const t of s.tris)for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3];if((a[0]-x)*(b[0]-x)<0||(a[0]===x&&b[0]!==x)){const u=(x-a[0])/(b[0]-a[0]),y=a[1]+(b[1]-a[1])*u,z=a[2]+(b[2]-a[2])*u;y0=Math.min(y0,y);y1=Math.max(y1,y);z0=Math.min(z0,z);z1=Math.max(z1,z);}}
 return y1<y0?null:{y:[y0,y1],z:[z0,z1],centreY:(y0+y1)/2,centreZ:(z0+z1)/2};}
// Segments where a plane (point o, unit normal w) cuts the surface, expressed in the plane basis (u,v).
export function planeSection(s,o,u,v,w){const segs=[];for(const t of s.tris){const d=t.map(p=>(p[0]-o[0])*w[0]+(p[1]-o[1])*w[1]+(p[2]-o[2])*w[2]),pts=[];
  for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3],da=d[k],db=d[(k+1)%3];if((da<0&&db>=0)||(da>=0&&db<0)){const f=da/(da-db),p=[0,1,2].map(c=>a[c]+(b[c]-a[c])*f),r=[p[0]-o[0],p[1]-o[1],p[2]-o[2]];pts.push([r[0]*u[0]+r[1]*u[1]+r[2]*u[2],r[0]*v[0]+r[1]*v[1]+r[2]*v[2]]);}}
  if(pts.length===2)segs.push(pts);}return segs;}
