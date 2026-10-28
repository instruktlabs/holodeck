// Analytic fixed-length two-bone IK. Inputs and returned points share one space.
export function solveArmIK(shoulder,target,pole,upperLength,forearmLength){
 const sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0),len=a=>Math.hypot(...a),unit=a=>mul(a,1/len(a));
 if(![...shoulder,...target,...pole,upperLength,forearmLength].every(Number.isFinite)||upperLength<=0||forearmLength<=0)throw Error('Invalid IK inputs');
 const delta=sub(target,shoulder),requested=len(delta),direction=requested>1e-9?mul(delta,1/requested):[1,0,0],distance=Math.max(Math.abs(upperLength-forearmLength)+1e-5,Math.min(upperLength+forearmLength-1e-5,requested));
 const p=sub(pole,shoulder);let bend=sub(p,mul(direction,dot(p,direction)));
 if(len(bend)<1e-8){const basis=Math.abs(direction[1])<.9?[0,1,0]:[0,0,1];bend=sub(basis,mul(direction,dot(basis,direction)));}bend=unit(bend);
 const along=(upperLength*upperLength-forearmLength*forearmLength+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,upperLength*upperLength-along*along));
 return {elbow:add(shoulder,add(mul(direction,along),mul(bend,height))),wrist:add(shoulder,mul(direction,distance)),clamped:Math.abs(requested-distance)>1e-8,error:Math.abs(requested-distance)};
}
