// Host-side original recipe. No image inputs, network access, or engine-specific shader code.
export const VERSION='0.1.0';
export const DEFAULTS=Object.freeze({version:1,seed:62,size:1024,tileMeters:.6,grainCycles:19,grainBend:.85,poreStrength:.65,roughness:.72,reliefMeters:.00016,wear:.18,color:[111,82,55]});
const TAU=Math.PI*2,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mod=(x,n)=>((x%n)+n)%n,smooth=t=>t*t*t*(t*(t*6-15)+10);
const mix=(a,b,t)=>a+(b-a)*t;
function hash(x,y,s){let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(s,1442695041);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;}
function noise(u,v,nx,ny,s){const x=u*nx,y=v*ny,ix=Math.floor(x),iy=Math.floor(y),a=smooth(x-ix),b=smooth(y-iy);const at=(x,y)=>hash(mod(x,nx),mod(y,ny),s);return mix(mix(at(ix,iy),at(ix+1,iy),a),mix(at(ix,iy+1),at(ix+1,iy+1),a),b);}
export function normalize(config={}){
 for(const k of Object.keys(config))if(!(k in DEFAULTS))throw Error('Unknown wood parameter '+k);
 const p={...DEFAULTS,...config};
 for(const [k,lo,hi] of [['seed',1,2147483647],['size',64,2048],['tileMeters',.1,4],['grainCycles',4,80],['grainBend',0,2],['poreStrength',0,1],['roughness',.15,.95],['reliefMeters',0,.001],['wear',0,1]])if(!Number.isFinite(p[k])||p[k]<lo||p[k]>hi)throw Error('Out of range: '+k);
 if(p.version!==1||!Number.isInteger(p.seed)||!Number.isInteger(p.grainCycles)||!Number.isInteger(p.size)||Math.log2(p.size)%1)throw Error('Version 1 requires integer seed/cycles and power-of-two size');
 if(!Array.isArray(p.color)||p.color.length!==3||p.color.some(c=>!Number.isInteger(c)||c<0||c>255))throw Error('color requires three sRGB bytes');return p;
}
export function makeField(config){
 const p=normalize(config),s=p.seed;
 return (u,v)=>{
  const broad=noise(u,v,5,3,s),flow=noise(u,v,9,2,s+1),fine=noise(u,v,96,9,s+2),micro=noise(u,v,256,128,s+3);
  const warp=p.grainBend*(1.8*(flow-.5)+.5*Math.sin(TAU*v)+.23*Math.sin(TAU*(2*v+u)));
  const phase=TAU*(u*p.grainCycles+warp),ring=Math.pow(.5+.5*Math.sin(phase),7);
  const fiber=.5+.5*Math.sin(TAU*(u*117+warp*3.1)+1.8*(fine-.5));
  const pores=Math.pow(clamp((fine-.48)*3.2),3)*p.poreStrength;
  // Sparse short scratches vary color/roughness more than geometric relief.
  const scratch=Math.pow(clamp((noise(u,v,4,64,s+5)-.68)*4),3)*p.wear;
  const light=1+.24*(broad-.5)+.10*(micro-.5)-.23*ring-.12*pores-.035*fiber+.28*scratch;
  const color=p.color.map((c,i)=>clamp(c*light+(i===0?1:i===1?0:-1)*(broad-.5)*4,0,255));
  const height=p.reliefMeters*(-.42*ring-.7*pores+.10*(micro-.5)-.08*scratch);
  const roughness=clamp(p.roughness+.10*(broad-.5)+.10*pores+.04*ring-.10*scratch,.12,.98);
  return {color,height,roughness};
 };
}
export function bake(config){
 const p=normalize(config),field=makeField(p),n=p.size,base=Buffer.alloc(n*n*3),normal=Buffer.alloc(n*n*3),orm=Buffer.alloc(n*n*3),height=new Float32Array(n*n);
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const i=y*n+x,o=i*3,f=field((x+.5)/n,1-(y+.5)/n);height[i]=f.height;
  for(let c=0;c<3;c++)base[o+c]=Math.round(f.color[c]);orm[o]=255;orm[o+1]=Math.round(f.roughness*255);orm[o+2]=0;
 }
 let maxSlope=0;const step=p.tileMeters/n;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const i=(y*n+x)*3,dx=(height[y*n+mod(x+1,n)]-height[y*n+mod(x-1,n)])/(2*step),down=(height[mod(y+1,n)*n+x]-height[mod(y-1,n)*n+x])/(2*step),len=Math.sqrt(dx*dx+down*down+1);
  // Image rows descend; OpenGL tangent V ascends. Normal is -dH/dU,-dH/dV,+1.
  normal[i]=Math.round(127.5*(-dx/len+1));normal[i+1]=Math.round(127.5*(down/len+1));normal[i+2]=Math.round(127.5*(1/len+1));maxSlope=Math.max(maxSlope,Math.hypot(dx,down));
 }
 return {parameters:p,baseColor:base,normal,metallicRoughness:orm,height,maxSlope};
}
