// Extract only axial rotation; swing and the wrist goal remain untouched.
// q is elbow-relative wrist rotation and axis is the rest forearm direction.
export function twistAngle(q,axis){
 const projection=q[0]*axis[0]+q[1]*axis[1]+q[2]*axis[2],length=Math.hypot(projection,q[3]);
 if(length<1e-8)return 0;
 let angle=2*Math.atan2(projection/length,q[3]/length);
 if(angle>Math.PI)angle-=2*Math.PI;if(angle< -Math.PI)angle+=2*Math.PI;
 return angle;
}
