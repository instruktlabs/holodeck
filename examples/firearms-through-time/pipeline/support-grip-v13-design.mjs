// Design the v13 support-hand (left) forend grip in the gun frame.
// The hand frame follows the forearm (wrist bend 0 by construction): a = forearm direction, n = palmar normal,
// t = n x a (thumb side of a left hand). The palm rests under the forend, the four fingers wrap round the far
// side (each a string-wrap in its own flexion plane, offset from the actual forend section by tube radius +
// gap), and the thumb lies forward along the near side. The left shoulder stays where the v1 rig has it: the
// grip is slid along the forend until the elbow (wrist - forearm * a) sits exactly one upper-arm length from
// the shoulder, and the pole is chosen so the analytic IK reproduces that elbow.
import {loadGun,nearest,isInside,signed,section,planeSection} from './support-grip-v13-geometry.mjs';
import {solveArmIK} from '../game/arm-ik.mjs';

const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
 cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],len=a=>Math.hypot(...a),unit=a=>mul(a,1/len(a)),deg=Math.PI/180;
export const vec={add,sub,mul,dot,cross,len,unit};

// Left-hand anatomy in hand coordinates from the wrist joint: A along the hand axis, T toward the thumb, N palmar.
// Palm, thenar and wrist-capsule offsets reproduce the right glove's relations (palm + [-.014,.015,.002] thenar,
// palm + [-.009,-.011,0] capsule end); finger radii are the existing left radii; lengths are the No.4 natural ones.
export const anatomy={palm:[.052,.003,.005],palmR:[.034,.038,.014],thenar:[.038,.018,.007],thenarR:[.020,.024,.014],wristBack:.030,wristEnd:[.043,-.008,.005],wristR:[.0175,.022],wristDepth:.70,
 mcp:[[.088,.0255,0],[.090,.0085,0],[.085,-.0085,0],[.076,-.0255,0]],fingerR:[.0065,.0068,.0064,.0057],fingerL:[.078,.084,.080,.066],thumbBase:[.040,.034,.008],thumbR:.0083,thumbL:.080};
// Tube radius along a finger at curve parameter t, as the hands program builds it.
export const tubeRadius=(radius,t)=>radius*(1-.25*t+.07*Math.sin(Math.PI*t));

export function handFrame(yawDeg,pitchDeg,rollDeg){const psi=yawDeg*deg,phi=pitchDeg*deg,rho=rollDeg*deg,a=[Math.cos(phi)*Math.cos(psi),Math.sin(phi),Math.cos(phi)*Math.sin(psi)];
 const n0=unit(sub([0,1,0],mul(a,a[1]))),n=unit(add(mul(n0,Math.cos(rho)),mul(cross(a,n0),Math.sin(rho)))),t=cross(n,a);return {a,t,n};}
export const atnToGun=(W,F,p)=>add(W,add(add(mul(F.a,p[0]),mul(F.t,p[1])),mul(F.n,p[2])));

// ---- 2-D helpers for the flexion-plane wrap --------------------------------------------------------------
function hull(points){const p=[...points].sort((a,b)=>a[0]-b[0]||a[1]-b[1]),c=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lo=[],up=[];
 for(const q of p){while(lo.length>=2&&c(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q);}for(const q of p.reverse()){while(up.length>=2&&c(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q);}
 up.pop();lo.pop();return lo.concat(up);}
// Offset section in the flexion plane: for each direction from the section centre, the point whose true 3-D
// distance to the wood equals delta (Newton steps on the distance gradient). Ordered CCW in (u,v).
function rayHull(c,d,poly){let best=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],e=[b[0]-a[0],b[1]-a[1]],den=d[0]*e[1]-d[1]*e[0];if(Math.abs(den)<1e-12)continue;
 const w=[a[0]-c[0],a[1]-c[1]],r=(w[0]*e[1]-w[1]*e[0])/den,f=(w[0]*d[1]-w[1]*d[0])/den;if(r>0&&f>=-1e-9&&f<=1+1e-9)best=Math.min(best,r);}return best;}
function offsetSection(M,u,v,poly,surf,deltaAt,step=1){const c=poly.reduce((a,p)=>[a[0]+p[0]/poly.length,a[1]+p[1]/poly.length],[0,0]),out=[];
 for(let k=0;k<360/step;k++){const al=k*step*deg,d2=[Math.cos(al),Math.sin(al)],D3=add(mul(u,d2[0]),mul(v,d2[1])),rB=rayHull(c,d2,poly),delta=deltaAt(k),at=r=>add(M,add(mul(u,c[0]+d2[0]*r),mul(v,c[1]+d2[1]*r)));
  let r=rB+delta;for(let it=0;it<8;it++){const p=at(r),n=nearest(p,surf),g=n.d>1e-9?unit(sub(p,n.q)):D3,slope=Math.max(.25,dot(D3,g)),e=delta-n.d;r+=e/slope;if(Math.abs(e)<2e-6)break;}
  out.push([c[0]+d2[0]*r,c[1]+d2[1]*r]);}return out;}
// String-wrap: straight from the MCP (origin) until tangent to the offset section, then along it, total length L.
// delta(s) is the centreline offset from the wood at arc length s. The finger flexes toward +v.
function wrap3(M,u,v,poly,surf,L,delta){let path=null;
 for(let iter=0;iter<3;iter++){const sOf=k=>path?path.sOf[k]??path.tangentS:L*.45,C=offsetSection(M,u,v,poly,surf,k=>delta(sOf(k)));
  // first contact while rotating the straight finger up from +u: the smallest polar angle among points ahead.
  let best=-1,bestA=Infinity;for(let k=0;k<C.length;k++){const p=C[k];if(!(p[0]>1e-4)||!Number.isFinite(p[1]))continue;const ang=Math.atan2(p[1],p[0]);if(ang<bestA){bestA=ang;best=k;}}
  if(best<0)throw Error('No tangent from the MCP to the offset section (section points: '+poly.length+')');
  const pts=[[0,0],C[best]],sOf2={};let s=Math.hypot(...C[best]);sOf2[best]=s;let k=best;
  while(s<L){const k2=(k+1)%C.length,d=Math.hypot(C[k2][0]-C[k][0],C[k2][1]-C[k][1]);if(s+d>=L){const f=(L-s)/d;pts.push([C[k][0]+(C[k2][0]-C[k][0])*f,C[k][1]+(C[k2][1]-C[k][1])*f]);s=L;break;}s+=d;pts.push(C[k2]);sOf2[k2]=s;k=k2;if(k===best)break;}
  path={pts,sOf:sOf2,tangentS:Math.hypot(...C[best]),flex:bestA};}
 return {pts:path.pts,flexDeg:path.flex/deg,tangentLength:path.tangentS};}
function resample(pts,count){const cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+len(sub(pts[i],pts[i-1])));const total=cum[cum.length-1],out=[];
 for(let k=0;k<count;k++){const s=total*k/(count-1);let i=1;while(i<cum.length-1&&cum[i]<s)i++;const f=(s-cum[i-1])/(cum[i]-cum[i-1]||1);out.push(add(pts[i-1],mul(sub(pts[i],pts[i-1]),f)));}return {points:out,length:total};}

// Centripetal Catmull-Rom (THREE.CatmullRomCurve3 default) evaluated like curve.getPoint(t).
export function catmull(points){const n=points.length;return t=>{const p=(n-1)*t;let i=Math.floor(p),w=p-i;if(i>=n-1){i=n-2;w=1;}
 const p0=i>0?points[i-1]:sub(mul(points[0],2),points[1]),p1=points[i],p2=points[i+1],p3=i+2<n?points[i+2]:sub(mul(points[n-1],2),points[n-2]);
 let dt0=Math.pow(len(sub(p1,p0))**2,.25),dt1=Math.pow(len(sub(p2,p1))**2,.25),dt2=Math.pow(len(sub(p3,p2))**2,.25);if(dt1<1e-4)dt1=1;if(dt0<1e-4)dt0=dt1;if(dt2<1e-4)dt2=dt1;
 const out=[];for(let c=0;c<3;c++){let t1=(p1[c]-p0[c])/dt0-(p2[c]-p0[c])/(dt0+dt1)+(p2[c]-p1[c])/dt1,t2=(p2[c]-p1[c])/dt1-(p3[c]-p1[c])/(dt1+dt2)+(p3[c]-p2[c])/dt2;t1*=dt1;t2*=dt1;
  const c0=p1[c],c1=t1,c2=-3*p1[c]+3*p2[c]-2*t1-t2,c3=2*p1[c]-2*p2[c]+t1+t2,w2=w*w;out.push(c0+c1*w+c2*w2+c3*w2*w);}return out;};}
// Signed clearance of a tube (curve + radius profile) from a surface: min over samples of (signed centreline distance - radius).
// Surface clearance between neighbouring finger tubes (and thumb to index), with each tube built as the hands
// program builds it: 12 capsules between curve.getPoint(i/12), radius tubeRadius(R,t) at the capsule ends. The
// glove is one implicit surface meshed at 2.65 mm edges with a 2.6 mm finger blend, so neighbours closer than
// about 3 mm fuse or pinch into non-manifold edges. Exact on the capsule axes; radii interpolated along each.
export function fingerClearance(fingers,thumb,thumbR=anatomy.thumbR){const chain=(points,R)=>{const c=catmull(points),out=[];
  for(let i=0;i<12;i++){const t0=i/12,t1=(i+1)/12,a=c(t0),b=c(t1),r0=tubeRadius(R,t0),r1=tubeRadius(R,t1);for(let k=0;k<24;k++){const f=k/24;out.push({p:add(a,mul(sub(b,a),f)),r:r0+(r1-r0)*f,t:t0+(t1-t0)*f});}}
  out.push({p:c(1),r:tubeRadius(R,1),t:1});return out;};
 const tubes=[...fingers.map(f=>chain(f.points,f.radius)),chain(thumb.points,thumbR)],names=['index','middle','ring','little','thumb'],out={};
 for(const [i,j]of [[0,1],[1,2],[2,3],[4,0]]){let best={gap:Infinity};for(const a of tubes[i])for(const b of tubes[j]){const g=len(sub(a.p,b.p))-a.r-b.r;if(g<best.gap)best={gap:g,ta:a.t,tb:b.t};}
  out[names[i]+'-'+names[j]]={minGapMM:+(best.gap*1000).toFixed(2),at:[+best.ta.toFixed(3),+best.tb.toFixed(3)]};}
 return out;}
function tubeClearance(curve,radius,s,samples=96,from=0){let worst={gap:Infinity};for(let i=0;i<=samples;i++){const t=from+(1-from)*i/samples,p=curve(t),d=signed(p,s),g=d.gap-tubeRadius(radius,t);if(g<worst.gap)worst={gap:g,t,p};}return worst;}

export async function design(profileName,params,{shoulder}){const gun=await loadGun(profileName),forend=gun.forend,F=handFrame(params.yaw,params.pitch,params.roll),A=anatomy;
 // Optional small wrist offset: the hand axis may differ from the forearm by a few degrees (reported as wrist bend).
 const forearm=F.a,S=shoulder,upper=.33,lower=.31;
 const palmSamples=[];for(let i=0;i<=24;i++)for(let j=0;j<48;j++){const th=Math.PI*i/24,ph=2*Math.PI*j/48,d=[Math.sin(th)*Math.cos(ph),Math.sin(th)*Math.sin(ph),Math.cos(th)];palmSamples.push({part:'palm',p:d.map((v,k)=>A.palm[k]+v*A.palmR[k])},{part:'thenar',p:d.map((v,k)=>A.thenar[k]+v*A.thenarR[k])});}
 const palmGap=W=>{let best={gap:Infinity};for(const s of palmSamples){if(s.part==='palm'&&s.p[2]<A.palm[2])continue;const p=atnToGun(W,F,s.p);if(p[0]<forend.min[0]||p[0]>forend.max[0])continue;const d=signed(p,forend);if(d.gap<best.gap)best={gap:d.gap,p,part:s.part};}return best;};
 // Solve the wrist: lateral palm offset fixes z, palm contact fixes y, and the elbow constraint fixes x.
 let W=params.fixedWrist?[...params.fixedWrist]:[params.x0??.16,.08,0];
 for(let it=0;it<(params.fixedWrist?0:12);it++){
  const P=atnToGun(W,F,A.palm),sec=section(forend,P[0]);W=add(W,[0,0,(sec.centreZ+params.palmZ)-P[2]]);
  // Raise the hand from well below the forend to first contact, then bisect to the requested palm gap.
  let lo=forend.min[1]-.12-W[1],hi=lo;while(palmGap(add(W,[0,hi,0])).gap>params.palmGap&&hi<.3)hi+=.002;lo=hi-.002;
  for(let k=0;k<30;k++){const m=(lo+hi)/2,g=palmGap(add(W,[0,m,0])).gap;if(g>params.palmGap)lo=m;else hi=m;}W=add(W,[0,(lo+hi)/2,0]);
  const E0=sub(W,mul(forearm,lower)),r=sub(E0,S),b=r[0],c=dot(r,r)-upper*upper,xs=-b+Math.sqrt(Math.max(0,b*b-c));W=add(W,[xs,0,0]);}
 const E=sub(W,mul(forearm,lower)),dir=unit(sub(W,S)),foot=add(S,mul(dir,dot(sub(E,S),dir))),pole=add(E,mul(unit(sub(E,foot)),.2)),ik=solveArmIK(S,W,pole,upper,lower);
 const rig={shoulder:S,wrist:W,pole,upperLength:upper,forearmLength:lower,elbow:E,ikElbowError:len(sub(ik.elbow,E)),reach:len(sub(W,S))/(upper+lower),elbowInteriorDeg:180-Math.acos(dot(unit(sub(E,S)),forearm))/deg,
  forearmYawDeg:Math.atan2(forearm[2],forearm[0])/deg,forearmPitchDeg:Math.asin(forearm[1])/deg};
 // Fingers: flexion plane through the MCP spanned by the hand axis and the palmar normal.
 // Each finger may deviate toward the little-finger side at its knuckle (ulnar deviation, params.fingerSplay degrees,
 // scalar or per finger), so it wraps more squarely across the forend; the flexion plane stays normal to the palm.
 const splay=f=>(Array.isArray(params.fingerSplay)?params.fingerSplay[f]:params.fingerSplay??0)*deg,radii=params.fingerRadii??A.fingerR;
 const fingers=(params.mcp??A.mcp).map((m,f)=>{const M=atnToGun(W,F,m),u=unit(sub(mul(F.a,Math.cos(splay(f))),mul(F.t,Math.sin(splay(f))))),v=F.n,w=cross(u,v),segs=planeSection(forend,M,u,v,w),poly=hull(segs.flat()),L=A.fingerL[f],R=radii[f],g=params.fingerGap[f]??params.fingerGap;
  const delta=s=>tubeRadius(R,Math.min(1,s/L))+g,wr=wrap3(M,u,v,poly,forend,L,delta),path3=wr.pts.map(p=>add(M,add(mul(u,p[0]),mul(v,p[1])))),rs=resample(path3,params.curvePoints??8),curve=catmull(rs.points);
  const distal=tubeClearance(curve,R,forend,48,.78),whole=tubeClearance(curve,R,forend,96,0),tip=curve(1),sec=section(forend,tip[0]),pad=distal.p;
  return {finger:f,radius:R,splayDeg:splay(f)/deg,mcp:M,points:rs.points,length:rs.length,mcpFlexDeg:wr.flexDeg,tangentLength:wr.tangentLength,padGapMM:distal.gap*1000,padSide:pad&&sec?(pad[2]-sec.centreZ>=0?'far':'near'):null,padZmm:pad&&sec?(pad[2]-sec.centreZ)*1000:null,minGapMM:whole.gap*1000,tip};});
 // Thumb: from the thenar forward along the near side at a chosen height, pad on the wood.
 const thumb=(()=>{const B=atnToGun(W,F,A.thumbBase),R=A.thumbR,g=params.thumbGap,L=A.thumbL;
  const sideAt=(x,y)=>{const segs=planeSection(forend,[x,0,0],[0,1,0],[0,0,1],[1,0,0]);let best=null;for(const [p,q]of segs){if((p[0]-y)*(q[0]-y)>0)continue;const f=(y-p[0])/((q[0]-p[0])||1e-9),z=p[1]+(q[1]-p[1])*f;if(best===null||z<best)best=z;}return best;};
  const build=(xTip)=>{const sec=section(forend,xTip),yT=sec.centreY+params.thumbHeight*(sec.y[1]-sec.y[0])/2,line=x=>{const y=yT+(x-xTip)*Math.tan(params.thumbRiseDeg*deg),z=sideAt(x,y);return [x,y,z];};
   // Offset from the near side along its outward normal in the section plane.
   const off=(x,t)=>{const p=line(x),q=line(x+.001),y2=p[1]+.0005,z2=sideAt(x,y2),dz=z2-p[2],dy=.0005,nrm=unit([0,-dz,dy]),o=nrm[2]>0?mul(nrm,-1):nrm;return add(p,mul(o,tubeRadius(R,t)+g));};
   const J=off(xTip-params.thumbContact,.55),T=off(xTip,1),M1=off(xTip-params.thumbContact/2,.78),mid=add(mul(add(B,J),.5),[0,-.002,-params.thumbBulge]);
   return [B,mid,J,M1,T];};
  let lo=.0,hi=.2,pts=null;for(let k=0;k<40;k++){const x=(lo+hi)/2+B[0],p=build(x),l=resample(p,2).length;if(l<L)lo=(lo+hi)/2;else hi=(lo+hi)/2;pts=p;}
  const rs=resample(pts,params.curvePoints??8),curve=catmull(rs.points),distal=tubeClearance(curve,R,forend,48,.78),whole=tubeClearance(curve,R,forend,96,0),sec=section(forend,distal.p[0]);
  return {base:B,points:rs.points,length:rs.length,padGapMM:distal.gap*1000,padSide:distal.p[2]-sec.centreZ>=0?'far':'near',padZmm:(distal.p[2]-sec.centreZ)*1000,minGapMM:whole.gap*1000,tip:curve(1)};})();
 // Penetration of every primitive against every gun mesh (tubes exact; palm/thenar sampled; blends not modelled).
 const pen={};const note=(mesh,mm,part)=>{if(!pen[mesh]||mm>pen[mesh].mm)pen[mesh]={mm,part};};
 for(const s of gun.surfaces){for(const f of [...fingers.map((x,i)=>({...x,R:x.radius,name:'finger'+i})),{...thumb,R:A.thumbR,name:'thumb'}]){const c=catmull(f.points);for(let i=0;i<=96;i++){const t=i/96,p=c(t);if(p[0]<s.min[0]-.02||p[0]>s.max[0]+.02)continue;const d=signed(p,s),depth=tubeRadius(f.R,t)-d.gap;if(depth>0)note(s.name,depth*1000,f.name);}}
  for(const q of palmSamples){const p=atnToGun(W,F,q.p);if(!(p[0]>=s.min[0]-.001&&p[0]<=s.max[0]+.001&&p[1]>=s.min[1]-.001&&p[1]<=s.max[1]+.001&&p[2]>=s.min[2]-.001&&p[2]<=s.max[2]+.001))continue;if(isInside(p,s))note(s.name,nearest(p,s).d*1000,q.part);}}
 const palm=palmGap(W),psec=section(forend,palm.p[0]);
 return {profile:profileName,params,frame:F,rig,fingerClearance:fingerClearance(fingers,thumb),palm:{gapMM:palm.gap*1000,part:palm.part,point:palm.p,angleDeg:Math.atan2(palm.p[1]-psec.centreY,palm.p[2]-psec.centreZ)/deg},fingers,thumb,penetration:pen,forend:{min:forend.min,max:forend.max}};}
