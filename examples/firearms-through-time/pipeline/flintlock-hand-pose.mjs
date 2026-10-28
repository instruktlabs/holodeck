// Pattern 1742 hands: finger articulation and forward kinematics (round v14).
// The same `fingerPoseSource` text is embedded in the hands program (authoring/flintlock-1742-hands-v1.kiln.js), so the
// baked finger rotations and these checks use one function. Bone-local axes equal gun axes at bind (bones carry no bind
// rotation), so every joint rotation is an axis-angle about a bind-frame axis.
export const quatSource=`const qAxis=(a,t)=>{const s=Math.sin(t/2);return [a[0]*s,a[1]*s,a[2]*s,Math.cos(t/2)];},
 qMul=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]],
 qSlerp=(a,b,t)=>{let d=a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3];if(d<0){b=b.map(x=>-x);d=-d;}if(d>.9995){const q=a.map((x,i)=>x+(b[i]-x)*t),l=Math.hypot(...q);return q.map(x=>x/l);}const th=Math.acos(Math.min(1,d)),s=Math.sin(th);return a.map((x,i)=>(x*Math.sin((1-t)*th)+b[i]*Math.sin(t*th))/s);},
 qRot=(q,v)=>{const p=qMul(qMul(q,[...v,0]),[-q[0],-q[1],-q[2],q[3]]);return [p[0],p[1],p[2]];},deg2=Math.PI/180,qId=[0,0,0,1];`;
// T = pose table for one side (see author); p = sampled channels. Returns [[q0,q1,q2] x 5 digits] (index..little, thumb):
// bone-local rotations of the base, mid and tip bones (bind rotations are identity, so local axes are gun axes at bind).
export const fingerPoseSource=`function fingerPose(T,side,p){const out=[];
 if(side==='right'){const sf=Math.max(0,-p.rightOpen),so=Math.max(0,p.rightOpen),ri=Math.max(0,p.rightIndex),rt=p.rightThumb;
  for(let f=0;f<4;f++){const d=T.digits[f],ang=j=>(sf*d.fist[j]-so*d.open[j]+(f===0?ri*d.pull[j]:0))*deg2;
   if(f===0)out.push([qMul(qSlerp(qId,d.fistQ0,sf),qAxis(d.w,ang(0))),qAxis(d.w,ang(1)),qAxis(d.w,ang(2))]);else out.push([0,1,2].map(j=>qAxis(d.w,ang(j))));}
  const t=T.digits[4];if(rt>=0)out.push([qSlerp(qId,t.closeQ0,rt),qAxis(t.w,rt*t.close[1]*deg2),qAxis(t.w,rt*t.close[2]*deg2)]);else out.push([0,1,2].map(j=>qAxis(t.w,rt*t.ext[j]*deg2)));}
 else{const so=Math.max(0,p.open),sg=Math.max(0,-p.open),th=p.thumb;
  for(let f=0;f<5;f++){const d=T.digits[f];out.push([0,1,2].map(j=>qMul(qSlerp(qId,d.graspQ[j],sg),qAxis(d.w,(f<4?-so*d.release[j]:-th*d.lift[j])*deg2))));}}
 return out;}`;
// Left table: per digit w (flexion axis), release (open +1, degrees), lift (thumb only, thumb +1), graspQ (open -1: the
// bone-local rotations of the loading grip, fitted by the author; the Ready grip is open 0).
const lib=new Function(quatSource+fingerPoseSource+';return {qAxis,qMul,qSlerp,qRot,qId,fingerPose};')();
export const {qAxis,qMul,qSlerp,qRot,qId,fingerPose}=lib;
export const qConj=q=>[-q[0],-q[1],-q[2],q[3]];
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,s)=>a.map(v=>v*s);
export const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
// Rotation matrix <-> quaternion and THREE 'XYZ' Euler (radians).
export function matToQuat(m){const [[a,b,c],[d,e,f],[g,h,k]]=m,tr=a+e+k;let x,y,z,w;
 if(tr>0){const s=.5/Math.sqrt(tr+1);w=.25/s;x=(h-f)*s;y=(c-g)*s;z=(d-b)*s;}else if(a>e&&a>k){const s=2*Math.sqrt(1+a-e-k);w=(h-f)/s;x=.25*s;y=(b+d)/s;z=(c+g)/s;}
 else if(e>k){const s=2*Math.sqrt(1+e-a-k);w=(c-g)/s;x=(b+d)/s;y=.25*s;z=(f+h)/s;}else{const s=2*Math.sqrt(1+k-a-e);w=(d-b)/s;x=(c+g)/s;y=(f+h)/s;z=.25*s;}const l=Math.hypot(x,y,z,w);return [x/l,y/l,z/l,w/l];}
export function quatToMat(q){const [x,y,z,w]=q;return [[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]];}
export const eulerToMat=([x,y,z])=>{const cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
 return [[cy*cz,-cy*sz,sy],[cx*sz+sx*sy*cz,cx*cz-sx*sy*sz,-sx*cy],[sx*sz-cx*sy*cz,sx*cz+cx*sy*sz,cx*cy]];};
export const matToEuler=m=>{const y=Math.asin(Math.max(-1,Math.min(1,m[0][2])));let x,z;if(Math.abs(m[0][2])<.9999999){x=Math.atan2(-m[1][2],m[2][2]);z=Math.atan2(-m[0][1],m[0][0]);}else{x=Math.atan2(m[2][1],m[1][1]);z=0;}return [x,y,z];};
export const eulerToQuat=e=>matToQuat(eulerToMat(e)),quatToEuler=q=>matToEuler(quatToMat(q));
export const matMul=(A,B)=>A.map(r=>[0,1,2].map(j=>r[0]*B[0][j]+r[1]*B[1][j]+r[2]*B[2][j])),matT=A=>[0,1,2].map(i=>[0,1,2].map(j=>A[j][i])),matV=(A,v)=>A.map(r=>r[0]*v[0]+r[1]*v[1]+r[2]*v[2]);
export const basis=(x,y,z)=>[[x[0],y[0],z[0]],[x[1],y[1],z[1]],[x[2],y[2],z[2]]];// columns
// Joints of a digit as the program builds them: bones at curve(0), curve(.43), curve(.74).
export function joints(curve){return [curve(0),curve(.43),curve(.74)];}
// Posed point of a digit at curve parameter t (bind gun frame, hand at bind): the program's segment weights
// (base/mid blend at t .35-.51, mid/tip at .66-.82) applied to the three chained bone transforms.
export function posedPoint(J,q,p,t){const T0=x=>add(J[0],qRot(q[0],sub(x,J[0]))),q01=qMul(q[0],q[1]),q012=qMul(q01,q[2]),J1p=T0(J[1]),J2p=add(J1p,qRot(q01,sub(J[2],J[1])));
 const T1=x=>add(J1p,qRot(q01,sub(x,J[1]))),T2=x=>add(J2p,qRot(q012,sub(x,J[2])));
 let a,b,w;if(t<.6){a=T0(p);b=T1(p);w=ease((t-.35)/.16);}else{a=T1(p);b=T2(p);w=ease((t-.66)/.16);}return add(mul(a,1-w),mul(b,w));}
// Whole hand placed: bind point p (gun frame) -> posed world point for wrist position W2 and rotation Q (relative to bind).
export const placeHand=(Wbind,W2,Q)=>p=>add(W2,qRot(Q,sub(p,Wbind)));
