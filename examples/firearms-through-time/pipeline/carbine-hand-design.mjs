// Design both M4 hands in the gun frame (metres, +X muzzle, +Y up, +Z right).
//  - Right hand on the pistol grip: palm on the right side, web high on the back strap, middle, ring and little
//    fingers string-wrapped round the front strap in their own flexion planes, the thumb over the back strap and along
//    the left side of the receiver, the index a three-phalanx chain whose distal pad rests on the trigger face.
//  - Left hand round the handguard: the support-grip v13 wrap (pipeline/support-grip-v13-design.mjs) run against the
//    M4 handguard, with the parameters chosen in pipeline/carbine-hand-author.mjs.
// Hand coordinates are (a, t, n): a = hand axis (wrist to knuckles), t = thumb side, n = palmar normal. For the right
// hand t = a x n; for the left t = n x a. Both hands share the v13 anatomy, so the glove pair matches.
import {anatomy,atnToGun,vec,tubeRadius,catmull,fingerClearance,handFrame} from './support-grip-v13-design.mjs';
import {insideTester,fastSigned,nearestFace,nearest,section,planeSection} from './carbine-hand-geometry.mjs';
const {add,sub,mul,dot,cross,len,unit}=vec,deg=Math.PI/180;
export {anatomy,catmull,tubeRadius,vec};

// ---- left (support) hand ------------------------------------------------------------------------------------------
// The support-grip v13 wrap (support-grip-v13-design.mjs design()), run on the M4 handguard. Two changes, because the
// handguard is short (157 mm) and the gun's shoulder is free here: the wrist x is chosen (params.wristX) and the
// shoulder x is solved so the elbow sits one upper-arm length from it, and the thumb's tip search stays on the
// handguard. Palm, finger and thumb construction are the v13 code.
export function designLeft(gun,params,{shoulderYZ}){const forend=gun.handguard,F=handFrame(params.yaw,params.pitch,params.roll),A=anatomy,upper=.33,lower=.31,forearm=F.a,all=gun.surfaces.filter(s=>!s.owner||s.owner==='Joint_Magazine');
 const palmSamples=[];for(let i=0;i<=24;i++)for(let j=0;j<48;j++){const th=Math.PI*i/24,ph=2*Math.PI*j/48,d=[Math.sin(th)*Math.cos(ph),Math.sin(th)*Math.sin(ph),Math.cos(th)];palmSamples.push({part:'palm',p:d.map((v,k)=>A.palm[k]+v*A.palmR[k])},{part:'thenar',p:d.map((v,k)=>A.thenar[k]+v*A.thenarR[k])});}
 const palmGap=W=>{let best={gap:Infinity};for(const s of palmSamples){if(s.part==='palm'&&s.p[2]<A.palm[2])continue;const p=atnToGun(W,F,s.p);if(p[0]<forend.min[0]||p[0]>forend.max[0])continue;const d=fastSigned(p,forend);if(d.gap<best.gap)best={gap:d.gap,p,part:s.part};}return best;};
 let W=params.fixedWrist?[...params.fixedWrist]:[params.wristX,.03,-.04];
 for(let it=0;it<(params.fixedWrist?0:8);it++){const P=atnToGun(W,F,A.palm),sec=section(forend,P[0]);W=add(W,[0,0,(sec.centreZ+params.palmZ)-P[2]]);
  let lo=forend.min[1]-.12-W[1],hi=lo;while(palmGap(add(W,[0,hi,0])).gap>params.palmGap&&hi<.3)hi+=.002;lo=hi-.002;
  for(let k=0;k<30;k++){const m=(lo+hi)/2,g=palmGap(add(W,[0,m,0])).gap;if(g>params.palmGap)lo=m;else hi=m;}W=add(W,[0,(lo+hi)/2,0]);}
 // Shoulder x so that the elbow (wrist - forearm * a) is exactly one upper-arm length away.
 const E=sub(W,mul(forearm,lower)),dy=E[1]-shoulderYZ[0],dz=E[2]-shoulderYZ[1],S=[E[0]-Math.sqrt(Math.max(0,upper*upper-dy*dy-dz*dz)),shoulderYZ[0],shoulderYZ[1]];
 const dir=unit(sub(W,S)),foot=add(S,mul(dir,dot(sub(E,S),dir))),pole=add(E,mul(unit(sub(E,foot)),.2));
 const rig={shoulder:S,wrist:W,pole,upperLength:upper,forearmLength:lower,elbow:E,reach:len(sub(W,S))/(upper+lower),elbowInteriorDeg:180-Math.acos(dot(unit(sub(E,S)),forearm))/deg,forearmYawDeg:Math.atan2(forearm[2],forearm[0])/deg,forearmPitchDeg:Math.asin(forearm[1])/deg};
 const splay=f=>(Array.isArray(params.fingerSplay)?params.fingerSplay[f]:params.fingerSplay??0)*deg,radii=params.fingerRadii??A.fingerR;
 const fingers=(params.mcp??A.mcp).map((m,f)=>{const M=atnToGun(W,F,m),u=unit(sub(mul(F.a,Math.cos(splay(f))),mul(F.t,Math.sin(splay(f))))),v=F.n,w=cross(u,v),segs=planeSection(forend,M,u,v,w),poly=hull(segs.flat()),L=A.fingerL[f],R=radii[f],g=params.fingerGap[f]??params.fingerGap;
  if(poly.length<3)throw Error('support finger '+f+' plane misses the handguard');
  const delta=s=>tubeRadius(R,Math.min(1,s/L))+g,wr=wrap3(M,u,v,poly,[forend],L,delta),path3=wr.pts.map(p=>add(M,add(mul(u,p[0]),mul(v,p[1])))),rs=resample(path3,params.curvePoints??8),curve=catmull(rs.points);
  const distal=tubeClearance(curve,R,[forend],48,.78),whole=tubeClearance(curve,R,[forend],96,0),tip=curve(1),sec=section(forend,tip[0]),pad=distal.p;
  return {finger:f,radius:R,splayDeg:splay(f)/deg,mcp:M,axis:w,u,points:rs.points,length:rs.length,mcpFlexDeg:wr.flexDeg,tangentLength:wr.tangentLength,padGapMM:distal.gap*1000,padSide:pad&&sec?(pad[2]-sec.centreZ>=0?'far':'near'):null,padZmm:pad&&sec?(pad[2]-sec.centreZ)*1000:null,minGapMM:whole.gap*1000,tip};});
 const thumb=(()=>{const B=atnToGun(W,F,A.thumbBase),R=A.thumbR,g=params.thumbGap,L=A.thumbL;
  const sideAt=(x,y)=>{const segs=planeSection(forend,[x,0,0],[0,1,0],[0,0,1],[1,0,0]);let best=null;for(const [p,q]of segs){if((p[0]-y)*(q[0]-y)>0)continue;const f=(y-p[0])/((q[0]-p[0])||1e-9),z=p[1]+(q[1]-p[1])*f;if(best===null||z<best)best=z;}return best;};
  const build=(xTip)=>{const sec=section(forend,xTip),yT=sec.centreY+params.thumbHeight*(sec.y[1]-sec.y[0])/2,line=x=>{const y=yT+(x-xTip)*Math.tan(params.thumbRiseDeg*deg),z=sideAt(x,y);return [x,y,z];};
   const off=(x,t)=>{const p=line(x),y2=p[1]+.0005,z2=sideAt(x,y2),dz=z2-p[2],dy=.0005,nrm=unit([0,-dz,dy]),o=nrm[2]>0?mul(nrm,-1):nrm;return add(p,mul(o,tubeRadius(R,t)+g));};
   const J=off(xTip-params.thumbContact,.55),T=off(xTip,1),M1=off(xTip-params.thumbContact/2,.78),mid=add(mul(add(B,J),.5),[0,-.002,-params.thumbBulge]);
   return [B,mid,J,M1,T];};
  const xMax=forend.max[0]-.004;let lo=Math.max(B[0],forend.min[0]+params.thumbContact+.002),hi=xMax,pts=null;
  for(let k=0;k<40;k++){const x=(lo+hi)/2,p=build(x),l=resample(p,2).length;if(l<L)lo=x;else hi=x;pts=p;}
  const rs=resample(pts,params.curvePoints??8),curve=catmull(rs.points),distal=tubeClearance(curve,R,[forend],48,.78),whole=tubeClearance(curve,R,[forend],96,0),sec=section(forend,distal.p[0]);
  return {base:B,points:rs.points,length:rs.length,padGapMM:distal.gap*1000,padSide:distal.p[2]-sec.centreZ>=0?'far':'near',padZmm:(distal.p[2]-sec.centreZ)*1000,minGapMM:whole.gap*1000,tip:curve(1)};})();
 const pen={};const note=(mesh,mm,part)=>{if(!pen[mesh]||mm>pen[mesh].mm)pen[mesh]={mm:+mm.toFixed(2),part};};
 for(const s of all){for(const f of [...fingers.map((x,i)=>({...x,R:x.radius,name:'finger'+i})),{...thumb,R:A.thumbR,name:'thumb'}]){const c=catmull(f.points);for(let i=0;i<=96;i++){const t=i/96,p=c(t);if(p[0]<s.min[0]-.02||p[0]>s.max[0]+.02)continue;const d=fastSigned(p,s),depth=tubeRadius(f.R,t)-d.gap;if(depth>0)note(s.name,depth*1000,f.name);}}
  for(const q of palmSamples){const p=atnToGun(W,F,q.p);if(insideTester(s)(p))note(s.name,nearest(p,s).d*1000,q.part);}}
 const palm=palmGap(W),psec=section(forend,palm.p[0]);
 return {params,frame:F,rig,fingerClearance:fingerClearance(fingers,thumb),palm:{gapMM:palm.gap*1000,part:palm.part,point:palm.p,angleDeg:Math.atan2(palm.p[1]-psec.centreY,palm.p[2]-psec.centreZ)/deg},fingers,thumb,penetration:pen};}

// ---- right-hand frame --------------------------------------------------------------------------------------------
// yaw turns the hand axis inward (toward -Z, the gun's left), pitch raises it, roll turns the palm about the axis.
export function rightFrame(yawDeg,pitchDeg,rollDeg){const y=yawDeg*deg,p=pitchDeg*deg,r=rollDeg*deg,a=[Math.cos(p)*Math.cos(y),Math.sin(p),-Math.cos(p)*Math.sin(y)];
 const n0=unit(add([0,0,-1],mul(a,a[2]))),n=unit(add(mul(n0,Math.cos(r)),mul(cross(a,n0),Math.sin(r)))),t=cross(a,n);return {a,t,n};}
// Program-local axes: the right glove is authored with x = a, y = t, z = -n (the original pistol glove's layout);
// the left with x = a, y = t, z = n (support grip v13). Returns the basis columns for restHandRotations.
export const localBasis=(F,side)=>side==='right'?[F.a,F.t,mul(F.n,-1)]:[F.a,F.t,F.n];

// ---- 2-D wrap helpers (support-grip-v13-design.mjs; not exported there) -------------------------------------------
function hull(points){const p=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),c=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lo=[],up=[];
 for(const q of p){while(lo.length>=2&&c(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q);}for(const q of p.reverse()){while(up.length>=2&&c(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q);}
 up.pop();lo.pop();return lo.concat(up);}
function rayHull(c,d,poly){let best=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],e=[b[0]-a[0],b[1]-a[1]],den=d[0]*e[1]-d[1]*e[0];if(Math.abs(den)<1e-12)continue;
 const w=[a[0]-c[0],a[1]-c[1]],r=(w[0]*e[1]-w[1]*e[0])/den,f=(w[0]*d[1]-w[1]*d[0])/den;if(r>0&&f>=-1e-9&&f<=1+1e-9)best=Math.min(best,r);}return best;}
const minDist=(p,surfs)=>{let best={d:Infinity,q:null};for(const s of surfs){const n=nearest(p,s);if(n.d<best.d)best=n;}return best;};
function offsetSection(M,u,v,poly,surfs,deltaAt,step=1){const c=poly.reduce((a,p)=>[a[0]+p[0]/poly.length,a[1]+p[1]/poly.length],[0,0]),out=[];
 for(let k=0;k<360/step;k++){const al=k*step*deg,d2=[Math.cos(al),Math.sin(al)],D3=add(mul(u,d2[0]),mul(v,d2[1])),rB=rayHull(c,d2,poly),delta=deltaAt(k),at=r=>add(M,add(mul(u,c[0]+d2[0]*r),mul(v,c[1]+d2[1]*r)));
  let r=rB+delta;for(let it=0;it<8;it++){const p=at(r),n=minDist(p,surfs),g=n.d>1e-9?unit(sub(p,n.q)):D3,slope=Math.max(.25,dot(D3,g)),e=delta-n.d;r+=e/slope;if(Math.abs(e)<2e-6)break;}
  out.push([c[0]+d2[0]*r,c[1]+d2[1]*r]);}return out;}
function wrap3(M,u,v,poly,surfs,L,delta){let path=null;
 for(let iter=0;iter<3;iter++){const sOf=k=>path?path.sOf[k]??path.tangentS:L*.45,C=offsetSection(M,u,v,poly,surfs,k=>delta(sOf(k)));
  let best=-1,bestA=Infinity;for(let k=0;k<C.length;k++){const p=C[k];if(!(p[0]>1e-4)||!Number.isFinite(p[1]))continue;const ang=Math.atan2(p[1],p[0]);if(ang<bestA){bestA=ang;best=k;}}
  if(best<0)throw Error('No tangent from the MCP to the offset section');
  const pts=[[0,0],C[best]],sOf2={};let s=Math.hypot(...C[best]);sOf2[best]=s;let k=best;
  while(s<L){const k2=(k+1)%C.length,d=Math.hypot(C[k2][0]-C[k][0],C[k2][1]-C[k][1]);if(s+d>=L){const f=(L-s)/d;pts.push([C[k][0]+(C[k2][0]-C[k][0])*f,C[k][1]+(C[k2][1]-C[k][1])*f]);s=L;break;}s+=d;pts.push(C[k2]);sOf2[k2]=s;k=k2;if(k===best)break;}
  path={pts,sOf:sOf2,tangentS:Math.hypot(...C[best]),flex:bestA};}
 return {pts:path.pts,flexDeg:path.flex/deg,tangentLength:path.tangentS};}
export function resample(pts,count){const cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+len(sub(pts[i],pts[i-1])));const total=cum[cum.length-1],out=[];
 for(let k=0;k<count;k++){const s=total*k/(count-1);let i=1;while(i<cum.length-1&&cum[i]<s)i++;const f=(s-cum[i-1])/(cum[i]-cum[i-1]||1);out.push(add(pts[i-1],mul(sub(pts[i],pts[i-1]),f)));}return {points:out,length:total};}
function tubeClearance(curve,radius,surfs,samples=96,from=0){let worst={gap:Infinity};for(let i=0;i<=samples;i++){const t=from+(1-from)*i/samples,p=curve(t);for(const s of surfs){const d=fastSigned(p,s),g=d.gap-tubeRadius(radius,t);if(g<worst.gap)worst={gap:g,t,p,mesh:s.name};}}return worst;}
// Rotate p about the axis through o with unit direction w by angle (radians).
export function rotateAbout(p,o,w,angle){const v=sub(p,o),c=Math.cos(angle),s=Math.sin(angle);return add(o,add(add(mul(v,c),mul(cross(w,v),s)),mul(w,dot(w,v)*(1-c))));}

// ---- right hand ---------------------------------------------------------------------------------------------------
// gun: loadCarbine(); params: frame and placement choices (pipeline/carbine-hand-author.mjs).
export function designRight(gun,params){const A=anatomy,F=rightFrame(params.yaw,params.pitch,params.roll),W=params.wrist;
 const grip=gun.grip,trig=gun.trigger,all=gun.surfaces.filter(s=>!s.owner),gripSide=[grip,gun.lower,gun.steel];
 const radii=params.fingerRadii,mcp=params.mcp,splay=f=>(Array.isArray(params.fingerSplay)?params.fingerSplay[f]:params.fingerSplay)*deg;
 // Palm and thenar samples (palmar half of the palm ellipsoid, all of the thenar), as v13 measures the support palm.
 const palmSamples=[];for(let i=0;i<=24;i++)for(let j=0;j<48;j++){const th=Math.PI*i/24,ph=2*Math.PI*j/48,d=[Math.sin(th)*Math.cos(ph),Math.sin(th)*Math.sin(ph),Math.cos(th)];palmSamples.push({part:'palm',h:d.map((v,k)=>A.palm[k]+v*A.palmR[k])},{part:'thenar',h:d.map((v,k)=>A.thenar[k]+v*A.thenarR[k])});}
 const palmGap=()=>{let best={gap:Infinity};for(const s of palmSamples){if(s.part==='palm'&&s.h[2]<A.palm[2])continue;const p=atnToGun(W,F,s.h);for(const m of [grip,gun.lower]){const d=fastSigned(p,m);if(d.gap<best.gap)best={gap:d.gap,p,part:s.part,mesh:m.name};}}return best;};
 // Middle, ring and little: v13 string wrap round the grip section in each finger's flexion plane.
 const fingers=[1,2,3].map(f=>{const M=atnToGun(W,F,mcp[f]),u=unit(sub(mul(F.a,Math.cos(splay(f))),mul(F.t,Math.sin(splay(f))))),v=F.n,w=cross(u,v),segs=planeSection(grip,M,u,v,w),poly=hull(segs.flat()),L=params.fingerL[f],R=radii[f],g=params.fingerGap;
  if(poly.length<3)throw Error('finger '+f+' plane misses the grip');
  const delta=s=>tubeRadius(R,Math.min(1,s/L))+g,wr=wrap3(M,u,v,poly,[grip],L,delta),path3=wr.pts.map(p=>add(M,add(mul(u,p[0]),mul(v,p[1])))),rs=resample(path3,params.curvePoints??8),curve=catmull(rs.points);
  const distal=tubeClearance(curve,R,[grip],48,.78),whole=tubeClearance(curve,R,gripSide,96,0),tip=curve(1);
  return {finger:f,radius:R,splayDeg:splay(f)/deg,mcp:M,axis:w,u,points:rs.points,length:rs.length,mcpFlexDeg:wr.flexDeg,padGapMM:distal.gap*1000,padZmm:distal.p[2]*1000,padSide:distal.p[2]<0?'left':'right',minGapMM:whole.gap*1000,minMesh:whole.mesh,tip};});
 // Index: MCP, PIP, DIP and tip in one plane. The distal pad (45% along the distal phalanx, on its palmar side) rests
 // on the trigger's front face at the chosen height, the distal phalanx crossing the blade toward the gun's left.
 const index=(()=>{const M=atnToGun(W,F,mcp[0]),L=params.fingerL[0],R=radii[0],L1=.43*L,L2=.31*L,L3=.26*L,yC=params.triggerY;
  // trigger front face at height yC (z = 0): the most forward blade point and the face normal there
  const front=y=>{const segs=planeSection(trig,[0,y,0],[1,0,0],[0,0,1],[0,1,0]);let best=-Infinity;for(const [a,b]of segs)for(const q of [a,b])best=Math.max(best,q[0]);return best;};
  const xC=front(yC),probe=[xC+.004,yC,0],face=nearestFace(probe,trig),nFace=unit(sub(probe,face.q));
  const rPad=tubeRadius(R,.74+.26*.45),padC=add(face.q,mul(nFace,rPad+params.triggerGap));
  // distal direction: perpendicular to the face normal, toward -Z (crossing the blade to the left), tilted by params.distalTiltDeg about the normal
  const d0=unit(sub([0,0,-1],mul(nFace,-nFace[2]))),d3=unit(rotateAbout(d0,[0,0,0],nFace,(params.distalTiltDeg??0)*deg));
  const DIP=sub(padC,add(mul(d3,.45*L3),mul(nFaceToPalm(d3,nFace),0))),TIP=add(DIP,mul(d3,L3));
  // PIP on the circle |M-PIP| = L1, |PIP-DIP| = L2, bulging dorsally (away from the pad side) in the plane (M, DIP, DIP+d3)
  const e=sub(DIP,M),dd=len(e),ex=unit(e),pn=unit(cross(ex,d3)),ey=cross(pn,ex),x=(L1*L1-L2*L2+dd*dd)/(2*dd),h=Math.sqrt(Math.max(0,L1*L1-x*x));
  const cand=[1,-1].map(sg=>add(M,add(mul(ex,x),mul(ey,sg*h)))),dorsal=mul(nFace,1),PIP=dot(sub(cand[0],M),dorsal)>dot(sub(cand[1],M),dorsal)?cand[0]:cand[1];
  const reach=dd<L1+L2&&dd>Math.abs(L1-L2);
  const ang=(p,q)=>Math.acos(Math.max(-1,Math.min(1,dot(unit(p),unit(q)))))/deg,flex={mcpToPip:null,pipDeg:ang(sub(PIP,M),sub(DIP,PIP)),dipDeg:ang(sub(DIP,PIP),d3)};
  const poly=[M,PIP,DIP,TIP],rs=resample(denseChain(poly,4),params.curvePoints??8),curve=catmull(rs.points),w=unit(cross(sub(PIP,M),sub(DIP,PIP)));
  // pad on the final smoothed curve: the distal sample nearest the trigger
  let pad={gap:Infinity};for(let i=0;i<=48;i++){const t=.74+.26*i/48,p=curve(t),fq=nearestFace(p,trig),g=fq.d-tubeRadius(R,t);if(g<pad.gap)pad={gap:g,t,p,q:fq.q,normal:fq.normal};}
  const whole=tubeClearance(curve,R,all,96,0);
  return {finger:0,radius:R,mcp:M,axis:w,points:rs.points,length:rs.length,reach,flexDeg:flex,target:{faceY:yC,faceX:xC,faceNormal:nFace,padCentre:padC},padGapMM:pad.gap*1000,padFaceNormal:pad.normal,padPoint:pad.p,minGapMM:whole.gap*1000,minMesh:whole.mesh,joints:{M,PIP,DIP,TIP}};})();
 // Thumb: from the thenar base over the back strap, then forward along the gun's left side at params.thumbY,
 // offset from the receiver/grip by tube radius + gap, until its length is used.
 const thumb=(()=>{const B=atnToGun(W,F,A.thumbBase),R=A.thumbR,g=params.thumbGap,L=A.thumbL,side=[grip,gun.lower,gun.steel];
  const leftAt=(x,y)=>{let zMin=Infinity;for(const s of side){const segs=planeSection(s,[x,0,0],[0,1,0],[0,0,1],[1,0,0]);for(const [p,q]of segs){if((p[0]-y)*(q[0]-y)>0)continue;const f=(y-p[0])/((q[0]-p[0])||1e-9),z=p[1]+(q[1]-p[1])*f;zMin=Math.min(zMin,z);}}return zMin;};
  // Push p to signed distance r outside the receiver and grip (points that start inside are pushed out first).
  const sd=q=>{let best={gap:Infinity};for(const s of side){const d=fastSigned(q,s);if(d.gap<best.gap)best=d;}return best;};
  const off=(p,r)=>{let q=[...p];for(let it=0;it<12;it++){const n=sd(q),out=n.gap>1e-9?unit(sub(q,n.q)):n.gap<-1e-9?unit(sub(n.q,q)):[0,0,-1],e=r-n.gap;q=add(q,mul(out,e));if(Math.abs(e)<2e-6)break;}return q;};
  // B -> behind the back strap (under the tang) -> the rear-left corner -> forward along the left side, rising from
  // thumbOverY to thumbY, each point pushed to tube radius + gap off the receiver and grip.
  const build=xTip=>{const x0=params.thumbOverX,y0=params.thumbOverY,yT=params.thumbY,zL=x=>leftAt(x,y0),pts=[B];
   pts.push(off([x0,y0,params.thumbOverZ??0],tubeRadius(R,.2)+g+(params.thumbOverLift??0)));
   pts.push(off([x0+.006,y0+.002,-.02],tubeRadius(R,.35)+g));
   for(const f of [.55,.75,1]){const x=x0+.012+(xTip-x0-.012)*((f-.4)/.6),y=y0+(yT-y0)*Math.min(1,(f-.4)/.4);pts.push(off([x,y,-.025],tubeRadius(R,f)+g));}return pts;};
  let lo=params.thumbOverX+.02,hi=params.thumbOverX+.14,pts=null;for(let k=0;k<40;k++){const x=(lo+hi)/2;pts=build(x);if(resample(pts,2).length<L)lo=x;else hi=x;}
  const rs=resample(pts,params.curvePoints??8),curve=catmull(rs.points),distal=tubeClearance(curve,R,side,48,.78),whole=tubeClearance(curve,R,all,96,0);
  return {base:B,points:rs.points,length:rs.length,padGapMM:distal.gap*1000,padSide:distal.p[2]<0?'left':'right',padPoint:distal.p,minGapMM:whole.gap*1000,minMesh:whole.mesh,tip:curve(1)};})();
 // Penetration of every primitive against every gun mesh (tubes exact on the centreline; palm and thenar sampled).
 const pen={};const note=(mesh,mm,part)=>{if(!pen[mesh]||mm>pen[mesh].mm)pen[mesh]={mm:+mm.toFixed(2),part};};
 for(const s of all){for(const f of [index,...fingers,{...thumb,radius:A.thumbR,finger:4}]){const c=catmull(f.points);for(let i=0;i<=96;i++){const t=i/96,p=c(t);if(p[0]<s.min[0]-.02||p[0]>s.max[0]+.02||p[1]<s.min[1]-.02||p[1]>s.max[1]+.02)continue;const d=fastSigned(p,s),depth=tubeRadius(f.radius,t)-d.gap;if(depth>0)note(s.name,depth*1000,'finger'+f.finger);}}
  for(const q of palmSamples){const p=atnToGun(W,F,q.h);if(insideTester(s)(p))note(s.name,nearest(p,s).d*1000,q.part);}}
 const palm=palmGap();
 return {frame:F,wrist:W,palm:{gapMM:palm.gap*1000,part:palm.part,point:palm.p,mesh:palm.mesh},index,fingers,thumb,penetration:pen,
  fingerClearance:fingerClearance([index,...fingers].map(f=>({points:f.points,radius:f.radius})),{points:thumb.points},A.thumbR)};}
// The pad sits on the distal phalanx's palmar side, which faces the trigger; the centreline is offset from the pad by the
// tube radius along the face normal (handled in padC), so no extra lateral offset is applied here.
function nFaceToPalm(){return [0,0,0];}
function denseChain(poly,per){const out=[poly[0]];for(let i=1;i<poly.length;i++)for(let k=1;k<=per;k++)out.push(add(poly[i-1],mul(sub(poly[i],poly[i-1]),k/per)));return out;}
