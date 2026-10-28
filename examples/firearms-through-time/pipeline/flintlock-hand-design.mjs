// Pattern 1742 musket hands, Ready grip design in the gun frame (round v14).
// Gun frame: metres, +X muzzle, +Y up, +Z right. Both hands are designed against the exported v3 musket triangles.
//  - Right hand: palm on the right side of the stock wrist, middle/ring/little fingers string-wrapped under the wrist
//    to the left side, thumb wrapped over the top to the left side, index finger into the guard with its pad just in
//    front of the trigger blade (rightIndex 1 closes the gap).
//  - Left hand: the v13 support method on the fore-end at anchor_hand_left: palm under, fingers round the far (+Z)
//    side, thumb along the near (-Z) side.
// The hand frame follows the forearm (wrist bend 0 by construction): a = hand axis (wrist to knuckles), n = palmar
// normal, t = thumb side. Finger wraps are the v13 string-wrap (pipeline/support-grip-v13-design.mjs), re-implemented
// here for a multi-mesh surface. Analysis only; nothing here ships.
import {loadMusket,surface,nearest,isInside,insideBox,rotAbout,deg} from './flintlock-geometry.mjs';
import {solveArmIK} from '../game/arm-ik.mjs';

export const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
 cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a),unit=a=>mul(a,1/len(a));
export const GUN='authoring/flintlock-1742-v3.glb';
// Lock angles from the v3 root `lock` block (degrees about gun +Z through each pivot).
export const LOCK={cockPivot:[-.072,-.026,.034],frizzenPivot:[.04,-.009,.035],down:-59.5,half:-14,full:18,closed:0,open:-45};
export const cockDeg=c=>c<=.5?LOCK.down+(LOCK.half-LOCK.down)*c/.5:LOCK.half+(LOCK.full-LOCK.half)*(c-.5)/.5;
export const frizzenDeg=f=>LOCK.closed+(LOCK.open-LOCK.closed)*f;

// ---- surfaces -------------------------------------------------------------------------------------------
// Multi-mesh surface: nearest over all triangles, inside = inside any closed component.
export function multi(name,parts){const all=surface(name,parts.flatMap(p=>p.tris));all.parts=parts;return all;}
export const insideAny=(p,s)=>(s.parts??[s]).some(c=>insideBox(p,c,1e-4)&&isInside(p,c));
export const signedM=(p,s)=>{const n=nearest(p,s);return {gap:insideAny(p,s)?-n.d:n.d,q:n.q};};
let cache=null;
export async function musket(state={cock:1,frizzen:0}){
 if(!cache){const m=await loadMusket(GUN);const by=(owner,...roles)=>m.byPart.filter(p=>p.owner===owner&&roles.includes(p.role)).flatMap(p=>p.tris);
  cache={m,by,parts:m.byPart.map(p=>({owner:p.owner,role:p.role,tris:p.tris}))};}
 const {by}=cache,cz=[0,0,1],c=cockDeg(state.cock??1)*deg,f=frizzenDeg(state.frizzen??0)*deg;
 const rot=(T,o,a)=>T.map(t=>t.map(p=>rotAbout(p,o,cz,a)));
 const wood=by('Joint_Body','WalnutFurniture'),region=(T,x0,x1)=>T.filter(t=>{const x=(t[0][0]+t[1][0]+t[2][0])/3;return x>=x0&&x<=x1;});
 const S={
  wristWood:surface('wristWood',region(wood,-.34,-.06)),finial:surface('GuardRearFinial',by('Joint_Body','GuardRearFinial')),escutcheon:surface('WristEscutcheon',by('Joint_Body','WristEscutcheon')),
  lockPlate:surface('LockPlate',by('Joint_Body','LockPlate')),sidePlate:surface('SidePlate',by('Joint_Body','SidePlate')),tang:surface('Tang',by('Joint_Body','Tang')),
  guard:surface('TriggerGuard',by('Joint_Body','TriggerGuard')),frontFinial:surface('GuardFrontFinial',by('Joint_Body','GuardFrontFinial')),trigger:surface('TriggerBlade',by('Joint_Trigger','TriggerBlade')),
  forendWood:surface('forendWood',region(wood,.12,.62)),barrel:surface('Barrel',by('Joint_Body','BarrelBlindCavity')),apron:surface('EntryPipeApron',by('Joint_Body','EntryPipeApron')),
  pipes:surface('RamrodPipes',by('Joint_Body','RamrodPipe','PipeRim')),ramrod:surface('Ramrod',by('Joint_Ramrod','StoredRamrod','RamrodTip')),
  cock:surface('Cock',rot(by('Joint_Cock','CockPivotBoss','CockNeck','LowerJaw','UpperJaw','JawScrew','JawScrewHead','Stone'),LOCK.cockPivot,c)),
  frizzen:surface('Frizzen',rot(by('Joint_Frizzen','FrizzenShell','FrizzenBoss'),LOCK.frizzenPivot,f)),
  screws:surface('Screws',by('Joint_Body','PlateScrew','ScrewSlot')),spring:surface('Spring',by('Joint_Body','ExteriorSpring')),pan:surface('Pan',by('Joint_Body','PanExterior')),butt:surface('Butt',by('Joint_Body','ButtPlate','ButtTang'))};
 S.wristGrip=multi('wristGrip',[S.wristWood,S.finial,S.escutcheon,S.sidePlate]);
 // Right-hand obstacles (palm seat and clearance): the wrap surface plus the lock plate, screws, guard and trigger.
 S.wristAll=multi('wristAll',[S.wristWood,S.finial,S.escutcheon,S.sidePlate,S.lockPlate,S.screws,S.guard,S.trigger,S.tang,S.cock]);
 S.forendGrip=multi('forendGrip',[S.forendWood,S.barrel,S.apron,S.ramrod]);
 // Everything for penetration: each closed part separately (inside tests need closed components).
 S.penetration=[...cache.parts.filter(p=>p.owner==='Joint_Body').map(p=>surface(p.role,p.tris)),S.trigger,S.cock,S.frizzen,S.ramrod];
 return S;}

// ---- anatomy and frames -----------------------------------------------------------------------------------
// Hand coordinates from the wrist joint: A along the hand axis, T toward the thumb, N palmar (v13 anatomy).
export const anatomy={palm:[.052,.003,.005],palmR:[.034,.038,.014],thenar:[.038,.018,.007],thenarR:[.020,.024,.014],wristBack:.030,wristEnd:[.043,-.008,.005],wristR:[.0175,.022],wristDepth:.70,
 mcp:[[.0905,.0295,0],[.0885,.0100,0],[.0835,-.0080,0],[.0745,-.0250,0]],fingerR:[.0070,.0078,.0071,.0061],fingerL:[.078,.084,.080,.066],thumbBase:[.040,.034,.008],thumbR:.0083,thumbL:.080};
export const tubeRadius=(radius,t)=>radius*(1-.25*t+.07*Math.sin(Math.PI*t));
// Frame from the forearm direction (yaw from +X toward +Z, pitch up) and roll of the palmar normal about it.
// handed: 'left' t = n x a; 'right' t = a x n. Hand-local axes for the program: x = a, y = side*t, z = n (proper rotation).
export function handFrame(yawDeg,pitchDeg,rollDeg,handed){const psi=yawDeg*deg,phi=pitchDeg*deg,rho=rollDeg*deg,a=[Math.cos(phi)*Math.cos(psi),Math.sin(phi),Math.cos(phi)*Math.sin(psi)];
 const n0=unit(sub([0,1,0],mul(a,a[1]))),n=unit(add(mul(n0,Math.cos(rho)),mul(cross(a,n0),Math.sin(rho)))),t=handed==='right'?cross(a,n):cross(n,a);return {a,t,n,handed};}
export const atn=(W,F,p)=>add(W,add(add(mul(F.a,p[0]),mul(F.t,p[1])),mul(F.n,p[2])));
export const toAtn=(W,F,p)=>{const q=sub(p,W);return [dot(q,F.a),dot(q,F.t),dot(q,F.n)];};

// ---- 2-D wrap helpers (v13) ------------------------------------------------------------------------------
function planeSection(s,o,u,v,w){const segs=[];for(const t of s.tris){const d=t.map(p=>(p[0]-o[0])*w[0]+(p[1]-o[1])*w[1]+(p[2]-o[2])*w[2]),pts=[];
  for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3],da=d[k],db=d[(k+1)%3];if((da<0&&db>=0)||(da>=0&&db<0)){const f=da/(da-db),p=[0,1,2].map(c=>a[c]+(b[c]-a[c])*f),r=sub(p,o);pts.push([dot(r,u),dot(r,v)]);}}
  if(pts.length===2)segs.push(pts);}return segs;}
function hull(points){const p=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),c=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lo=[],up=[];
 for(const q of p){while(lo.length>=2&&c(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q);}for(const q of p.reverse()){while(up.length>=2&&c(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q);}up.pop();lo.pop();return lo.concat(up);}
function rayHull(c,d,poly){let best=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],e=[b[0]-a[0],b[1]-a[1]],den=d[0]*e[1]-d[1]*e[0];if(Math.abs(den)<1e-12)continue;
 const w=[a[0]-c[0],a[1]-c[1]],r=(w[0]*e[1]-w[1]*e[0])/den,f=(w[0]*d[1]-w[1]*d[0])/den;if(r>0&&f>=-1e-9&&f<=1+1e-9)best=Math.min(best,r);}return best;}
function offsetSection(M,u,v,poly,surf,deltaAt,step=1){const c=poly.reduce((a,p)=>[a[0]+p[0]/poly.length,a[1]+p[1]/poly.length],[0,0]),out=[];
 for(let k=0;k<360/step;k++){const al=k*step*deg,d2=[Math.cos(al),Math.sin(al)],D3=add(mul(u,d2[0]),mul(v,d2[1])),rB=rayHull(c,d2,poly),delta=deltaAt(k),at=r=>add(M,add(mul(u,c[0]+d2[0]*r),mul(v,c[1]+d2[1]*r)));
  let r=rB+delta;for(let it=0;it<8;it++){const p=at(r),n=nearest(p,surf),g=n.d>1e-9?unit(sub(p,n.q)):D3,slope=Math.max(.25,dot(D3,g)),e=delta-n.d;r+=e/slope;if(Math.abs(e)<2e-6)break;}
  out.push([c[0]+d2[0]*r,c[1]+d2[1]*r]);}return out;}
// String-wrap: straight from the knuckle (origin) to the tangent on the offset section, then along it to length L.
function wrap3(M,u,v,poly,surf,L,delta){let path=null;
 for(let iter=0;iter<3;iter++){const sOf=k=>path?path.sOf[k]??path.tangentS:L*.45,C=offsetSection(M,u,v,poly,surf,k=>delta(sOf(k)));
  let best=-1,bestA=Infinity;for(let k=0;k<C.length;k++){const p=C[k];if(!(p[0]>1e-4)||!Number.isFinite(p[1]))continue;const ang=Math.atan2(p[1],p[0]);if(ang<bestA){bestA=ang;best=k;}}
  if(best<0)throw Error('No tangent from the knuckle to the offset section');
  const pts=[[0,0],C[best]],sOf2={};let s=Math.hypot(...C[best]);sOf2[best]=s;let k=best;
  while(s<L){const k2=(k+1)%C.length,d=Math.hypot(C[k2][0]-C[k][0],C[k2][1]-C[k][1]);if(s+d>=L){const f=(L-s)/d;pts.push([C[k][0]+(C[k2][0]-C[k][0])*f,C[k][1]+(C[k2][1]-C[k][1])*f]);s=L;break;}s+=d;pts.push(C[k2]);sOf2[k2]=s;k=k2;if(k===best)break;}
  path={pts,sOf:sOf2,tangentS:Math.hypot(...C[best]),flex:bestA};}
 return {pts:path.pts,flexDeg:path.flex/deg,tangentLength:path.tangentS};}
export function resample(pts,count){const cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+len(sub(pts[i],pts[i-1])));const total=cum[cum.length-1],out=[];
 for(let k=0;k<count;k++){const s=total*k/(count-1);let i=1;while(i<cum.length-1&&cum[i]<s)i++;const f=(s-cum[i-1])/(cum[i]-cum[i-1]||1);out.push(add(pts[i-1],mul(sub(pts[i],pts[i-1]),f)));}return {points:out,length:total};}
// Centripetal Catmull-Rom as THREE.CatmullRomCurve3(points).getPoint(t) (the hands program's finger curve).
export function catmull(points){const n=points.length;return t=>{const p=(n-1)*t;let i=Math.floor(p),w=p-i;if(i>=n-1){i=n-2;w=1;}
 const p0=i>0?points[i-1]:sub(mul(points[0],2),points[1]),p1=points[i],p2=points[i+1],p3=i+2<n?points[i+2]:sub(mul(points[n-1],2),points[n-2]);
 let dt0=Math.pow(len(sub(p1,p0))**2,.25),dt1=Math.pow(len(sub(p2,p1))**2,.25),dt2=Math.pow(len(sub(p3,p2))**2,.25);if(dt1<1e-4)dt1=1;if(dt0<1e-4)dt0=dt1;if(dt2<1e-4)dt2=dt1;
 const out=[];for(let c=0;c<3;c++){let t1=(p1[c]-p0[c])/dt0-(p2[c]-p0[c])/(dt0+dt1)+(p2[c]-p1[c])/dt1,t2=(p2[c]-p1[c])/dt1-(p3[c]-p1[c])/(dt1+dt2)+(p3[c]-p2[c])/dt2;t1*=dt1;t2*=dt1;
  const c0=p1[c],c1=t1,c2=-3*p1[c]+3*p2[c]-2*t1-t2,c3=2*p1[c]-2*p2[c]+t1+t2,w2=w*w;out.push(c0+c1*w+c2*w2+c3*w2*w);}return out;};}
export function tubeClearance(points,radius,s,{samples=96,from=0}={}){const curve=catmull(points);let worst={gap:Infinity};for(let i=0;i<=samples;i++){const t=from+(1-from)*i/samples,p=curve(t),d=signedM(p,s),g=d.gap-tubeRadius(radius,t);if(g<worst.gap)worst={gap:g,t,p,q:d.q};}return worst;}
export function fingerClearance(tubes){const chain=({points,radius})=>{const c=catmull(points),out=[];for(let i=0;i<=96;i++){const t=i/96;out.push({p:c(t),r:tubeRadius(radius,t),t});}return out;};
 const ch=tubes.map(chain),out={};for(const [i,j,name]of [[0,1,'index-middle'],[1,2,'middle-ring'],[2,3,'ring-little'],[4,0,'thumb-index'],[4,1,'thumb-middle']]){let best={gap:Infinity};
  for(const a of ch[i])for(const b of ch[j]){const g=len(sub(a.p,b.p))-a.r-b.r;if(g<best.gap)best={gap:g,ta:a.t,tb:b.t};}out[name]={minGapMM:+(best.gap*1000).toFixed(2),at:[+best.ta.toFixed(3),+best.tb.toFixed(3)]};}return out;}
// Wrap one digit round a surface in the plane through M spanned by u (straight direction) and v (flexion side).
export function wrapDigit(M,u,v,surf,L,R,gap,curvePoints=8){const w=cross(u,v),segs=planeSection(surf,M,u,v,w);const pts2=segs.flat();
 // Multi-mesh surfaces: section every component.
 if(surf.parts){pts2.length=0;for(const c of surf.parts)for(const s of planeSection(c,M,u,v,w))pts2.push(...s);}
 if(pts2.length<3)throw Error('Digit plane misses the surface');const poly=hull(pts2),delta=s=>tubeRadius(R,Math.min(1,s/L))+gap,wr=wrap3(M,u,v,poly,surf,L,delta);
 const path3=wr.pts.map(p=>add(M,add(mul(u,p[0]),mul(v,p[1])))),rs=resample(path3,curvePoints);return {points:rs.points,length:rs.length,flexDeg:wr.flexDeg,tangentLength:wr.tangentLength,plane:{u,v,w}};}

// Palm sampling (ellipsoids), in hand coordinates.
export const palmSamples=(()=>{const A=anatomy,out=[];for(let i=0;i<=24;i++)for(let j=0;j<48;j++){const th=Math.PI*i/24,ph=2*Math.PI*j/48,d=[Math.sin(th)*Math.cos(ph),Math.sin(th)*Math.sin(ph),Math.cos(th)];
 out.push({part:'palm',p:d.map((v,k)=>A.palm[k]+v*A.palmR[k])},{part:'thenar',p:d.map((v,k)=>A.thenar[k]+v*A.thenarR[k])});}return out;})();
export function palmGap(W,F,s,{palmarOnly=true}={}){let best={gap:Infinity};for(const q of palmSamples){if(palmarOnly&&q.part==='palm'&&q.p[2]<anatomy.palm[2])continue;const p=atn(W,F,q.p);if(!insideBox(p,s,.03))continue;const d=signedM(p,s);if(d.gap<best.gap)best={gap:d.gap,p,part:q.part};}return best;}
// Move the wrist along the palmar normal until the palm gap equals the target.
export function seatPalm(W,F,s,target){let lo=-.06,hi=.06;const g=o=>palmGap(add(W,mul(F.n,o)),F,s).gap;if(g(hi)>target)return {W:add(W,mul(F.n,hi)),gap:g(hi),seated:false};
 for(let k=0;k<40;k++){const m=(lo+hi)/2;if(g(m)>target)lo=m;else hi=m;}const o=(lo+hi)/2;return {W:add(W,mul(F.n,o)),gap:g(o),offset:o,seated:true};}
export {solveArmIK};

// Section extents of a surface at x (y, z ranges and centre).
export function sectionAt(s,x){let y0=1e9,y1=-1e9,z0=1e9,z1=-1e9;for(const c of s.parts??[s])for(const t of c.tris)for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3];if((a[0]-x)*(b[0]-x)<0){const u=(x-a[0])/(b[0]-a[0]),y=a[1]+(b[1]-a[1])*u,z=a[2]+(b[2]-a[2])*u;y0=Math.min(y0,y);y1=Math.max(y1,y);z0=Math.min(z0,z);z1=Math.max(z1,z);}}
 return y1<y0?null:{y:[y0,y1],z:[z0,z1],centreY:(y0+y1)/2,centreZ:(z0+z1)/2};}

// ---- right hand: stock wrist and trigger -------------------------------------------------------------------
// params: yaw/pitch/roll (forearm = hand axis), xp (palm-centre x), below/right (initial palm offset from the wrist
// section, then seated along the palmar normal to palmGap), splay per finger (ulnar deviation, degrees), gap (finger
// pads), thumb (abduction of the thumb plane toward the thumb side), index {aim:[x,y,z] point beside the trigger,
// tilt (degrees, plane normal from +Y toward +X), gap}.
export function designRight(S,params){const A=anatomy,F=handFrame(params.yaw,params.pitch,params.roll,'right'),sec=sectionAt(S.wristWood,params.xp);
 const palmTarget=[params.xp,sec.y[0]-params.below,sec.centreZ+params.right];
 let W=sub(palmTarget,add(add(mul(F.a,A.palm[0]),mul(F.t,A.palm[1])),mul(F.n,A.palm[2])));const seat=params.fixedWrist?{W:params.fixedWrist,seated:'fixed'}:seatPalm(W,F,S.wristAll,params.palmGap);W=seat.W;
 const fingers=[];
 for(let f=1;f<4;f++){const M=atn(W,F,(params.mcp??A.mcp)[f]),sp=params.splay[f]*deg,u=unit(sub(mul(F.a,Math.cos(sp)),mul(F.t,Math.sin(sp))));
  const d=wrapDigit(M,u,F.n,S.wristGrip,A.fingerL[f],A.fingerR[f],params.gap);fingers[f]={finger:f,radius:A.fingerR[f],mcp:M,...d};}
 // Index: wrapped round the trigger blade in its own plane through the knuckle (forward, curling to the left in front
 // of the blade). The plane normal is +Y tilted toward +X by index.tilt; u points from the knuckle to index.aim.
 {const M=atn(W,F,(params.mcp??A.mcp)[0]),ix=params.index,tilt=ix.tilt*deg,w0=[Math.sin(tilt),Math.cos(tilt),0],dir=sub(ix.aim,M),u=unit(sub(dir,mul(w0,dot(dir,w0)))),v=cross(w0,u);
  const d=wrapDigit(M,u,v,S.trigger,A.fingerL[0],A.fingerR[0],ix.gap);fingers[0]={finger:0,radius:A.fingerR[0],mcp:M,...d};}
 // Thumb: from the thenar up the right side and over the top (plane spanned by the palmar normal tilted toward the
 // thumb side, and the direction to the wrist-section centre).
 const B=atn(W,F,A.thumbBase),b=params.thumb.abd*deg,ut=unit(add(mul(F.n,Math.cos(b)),mul(F.t,Math.sin(b)))),c=[params.xp+(params.thumb.dx??0),sec.centreY,sec.centreZ],tw=sub(c,B),vt=unit(sub(tw,mul(ut,dot(tw,ut))));
 const thumb={base:B,radius:A.thumbR,...wrapDigit(B,ut,vt,S.wristGrip,A.thumbL,A.thumbR,params.thumb.gap)};
 return {side:'right',params,frame:F,wrist:W,seat,section:sec,fingers,thumb};}

// ---- left hand: fore-end support (v13 method) ----------------------------------------------------------------
export function designLeft(S,params){const A=anatomy,F=handFrame(params.yaw,params.pitch,params.roll,'left'),sec=sectionAt(S.forendGrip,params.xp);
 const palmTarget=[params.xp,sec.y[0]-params.below,sec.centreZ+params.palmZ];
 let W=sub(palmTarget,add(add(mul(F.a,A.palm[0]),mul(F.t,A.palm[1])),mul(F.n,A.palm[2])));const seat=params.fixedWrist?{W:params.fixedWrist,seated:'fixed'}:seatPalm(W,F,S.forendGrip,params.palmGap);W=seat.W;
 const fingers=[];for(let f=0;f<4;f++){const M=atn(W,F,(params.mcp??A.mcp)[f]),sp=params.splay[f]*deg,u=unit(sub(mul(F.a,Math.cos(sp)),mul(F.t,Math.sin(sp))));
  const d=wrapDigit(M,u,F.n,S.forendGrip,A.fingerL[f],A.fingerR[f],params.gap);fingers[f]={finger:f,radius:A.fingerR[f],mcp:M,...d};}
 // Thumb (v13): from the thenar forward along the near side at a chosen height, pad on the wood.
 const thumb=(()=>{const B=atn(W,F,A.thumbBase),R=A.thumbR,T=params.thumb,L=A.thumbL,surf=S.forendGrip;
  const sideAt=(x,y)=>{let best=null;for(const c of surf.parts)for(const [p,q]of planeSection(c,[x,0,0],[0,1,0],[0,0,1],[1,0,0])){if((p[0]-y)*(q[0]-y)>0)continue;const f=(y-p[0])/((q[0]-p[0])||1e-9),z=p[1]+(q[1]-p[1])*f;if(best===null||z<best)best=z;}return best;};
  const build=xTip=>{const s=sectionAt(surf,xTip),yT=s.centreY+T.height*(s.y[1]-s.y[0])/2,line=x=>{const y=yT+(x-xTip)*Math.tan(T.riseDeg*deg),z=sideAt(x,y);return [x,y,z];};
   const off=(x,t)=>{const p=line(x),y2=p[1]+.0005,z2=sideAt(x,y2),dz=z2-p[2],nrm=unit([0,-dz,.0005]),o=nrm[2]>0?mul(nrm,-1):nrm;return add(p,mul(o,tubeRadius(R,t)+T.gap));};
   const J=off(xTip-T.contact,.55),Tp=off(xTip,1),M1=off(xTip-T.contact/2,.78),mid=add(mul(add(B,J),.5),[0,-.002,-T.bulge]);return [B,mid,J,M1,Tp];};
  let lo=0,hi=.2,pts=null;for(let k=0;k<40;k++){const x=(lo+hi)/2+B[0],p=build(x),l=resample(p,2).length;if(l<L)lo=(lo+hi)/2;else hi=(lo+hi)/2;pts=p;}
  const rs=resample(pts,8);return {base:B,radius:R,points:rs.points,length:rs.length,flexDeg:0,plane:null};})();
 return {side:'left',params,frame:F,wrist:W,seat,section:sec,fingers,thumb};}

// Design evaluation: pad gaps (distal 22% of each digit) against the grip surface, the minimum tube clearance against
// every gun part, and the palm gap. Sides: right fingers and thumb pads on the left (-Z) of the wrist centre, index
// pad in front of the trigger blade; left fingers far (+Z), thumb near (-Z).
export function evaluate(S,d){const grip=d.side==='right'?S.wristGrip:S.forendGrip,all=multi('all',S.penetration),out={digits:[]};
 const digits=[...d.fingers.map((f,i)=>({name:['index','middle','ring','little'][i],...f})),{name:'thumb',...d.thumb}];
 for(const g of digits){const target=d.side==='right'&&g.name==='index'?S.trigger:grip,pad=tubeClearance(g.points,g.radius,target,{from:.78,samples:48}),min=tubeClearance(g.points,g.radius,all,{samples:96}),sec=sectionAt(grip,pad.p[0]);
  out.digits.push({name:g.name,padGapMM:+(pad.gap*1000).toFixed(2),padPoint:pad.p.map(v=>+v.toFixed(4)),padZFromCentreMM:sec?+((pad.p[2]-sec.centreZ)*1000).toFixed(1):null,padYFromCentreMM:sec?+((pad.p[1]-sec.centreY)*1000).toFixed(1):null,minClearanceMM:+(min.gap*1000).toFixed(2),minAt:min.p.map(v=>+v.toFixed(4)),flexDeg:+g.flexDeg.toFixed(1)});}
 out.palmGapMM=+(palmGap(d.wrist,d.frame,grip).gap*1000).toFixed(2);out.palmAllGapMM=+(palmGap(d.wrist,d.frame,all,{palmarOnly:false}).gap*1000).toFixed(2);
 out.tubes=fingerClearance([...d.fingers.map(f=>({points:f.points,radius:f.radius})),{points:d.thumb.points,radius:d.thumb.radius}]);return out;}
