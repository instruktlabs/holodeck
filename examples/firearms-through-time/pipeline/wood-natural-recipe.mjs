// Original, deterministic wood study. No scan/image inputs. Versioned separately from v1.
export const VERSION='0.2.0';
export const DEFAULTS=Object.freeze({version:2,seed:62,size:1024,tileMeters:1.2,endTileMeters:.6,grainCycles:45,grainBend:.7,knotCount:4,knotStrength:.75,poreStrength:.65,roughness:.70,reliefMeters:.00012,wear:.12,color:[126,98,69]});
const TAU=Math.PI*2,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),mod=(x,n)=>((x%n)+n)%n,smooth=t=>t*t*t*(t*(t*6-15)+10),mix=(a,b,t)=>a+(b-a)*t;
function hash(x,y,s){let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(s,1442695041);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;}
function noise(u,v,nx,ny,s){const x=u*nx,y=v*ny,ix=Math.floor(x),iy=Math.floor(y),a=smooth(x-ix),b=smooth(y-iy);const at=(x,y)=>hash(mod(x,nx),mod(y,ny),s);return mix(mix(at(ix,iy),at(ix+1,iy),a),mix(at(ix,iy+1),at(ix+1,iy+1),a),b);}
export function normalize(c={}){
 for(const k of Object.keys(c))if(!Object.hasOwn(DEFAULTS,k))throw Error('Unknown wood parameter '+k);
 const p={...DEFAULTS,...c};
 for(const [k,a,b] of [['seed',1,2147483647],['size',64,1024],['tileMeters',.5,2],['endTileMeters',.3,1],['grainCycles',8,100],['grainBend',0,2],['knotCount',0,8],['knotStrength',0,1],['poreStrength',0,1],['roughness',.15,.95],['reliefMeters',0,.001],['wear',0,1]])if(!Number.isFinite(p[k])||p[k]<a||p[k]>b)throw Error('Out of range '+k);
 if(p.version!==2||![p.seed,p.size,p.grainCycles,p.knotCount].every(Number.isInteger)||Math.log2(p.size)%1)throw Error('Invalid integral parameter/version');
 if(!Array.isArray(p.color)||p.color.length!==3||p.color.some(x=>!Number.isInteger(x)||x<0||x>255))throw Error('Invalid sRGB color');return p;
}
export function makeField(config,kind='long'){
 const p=normalize(config),s=p.seed;
 if(!['long','end'].includes(kind))throw Error('Unknown grain orientation');
 const knots=Array.from({length:p.knotCount},(_,i)=>({u:.12+.76*hash(i,9,s),v:.08+.84*hash(i,17,s),rx:.012+.012*hash(i,21,s),ry:.025+.02*hash(i,34,s)}));
 return (u,v)=>{
  const broad=noise(u,v,7,3,s),fine=noise(u,v,180,17,s+2),micro=noise(u,v,280,210,s+3);
  let warped=u+p.grainBend*(.013*Math.sin(TAU*v)+.018*(noise(u,v,8,3,s+7)-.5)),knot=0,knotRing=0;
  if(kind==='long')for(const k of knots){
   const dx=mod(u-k.u+.5,1)-.5,dy=mod(v-k.v+.5,1)-.5;
   const r=Math.hypot(dx/k.rx,dy/k.ry);
   warped+=p.knotStrength*.025*(dx/Math.sqrt(dx*dx+k.rx*k.rx))*Math.exp(-dy*dy/(k.ry*k.ry*9)-dx*dx/(k.rx*k.rx*25));
   knot=Math.max(knot,p.knotStrength*Math.exp(-r*r*1.7));
   knotRing+=p.knotStrength*Math.exp(-r*r*.32)*Math.pow(.5+.5*Math.sin(r*15+2*broad),5);
  }
  // Noise perturbs ring spacing and contrast instead of imposing equal dark stripes.
  const radial=Math.hypot((u-.28)*1.08,v-.44);
  const phase=kind==='long'?warped*p.grainCycles+2.5*(noise(u,v,5,3,s+8)-.5):radial*95+1.5*(noise(u,v,11,11,s+9)-.5);
  const ring=Math.pow(.5+.5*Math.sin(TAU*phase),9);
  const fiber=kind==='long'?Math.pow(.5+.5*Math.sin(TAU*(warped*360)+2*(fine-.5)),7):noise(u,v,350,350,s+11);
  const pores=Math.pow(clamp((fine-.52)*3),3)*p.poreStrength;
  const wear=p.wear*Math.pow(clamp((noise(u,v,4,60,s+12)-.65)*4),3);
  const light=1+.25*(broad-.5)+.07*(micro-.5)-(.08+.05*broad)*ring-.045*fiber-.10*pores-.38*knot-.10*knotRing+.10*wear;
  const color=p.color.map((c,i)=>clamp(c*light+(i===0?3:i===2?-2:0)*(broad-.5),0,255));
  return {color,height:p.reliefMeters*(-.20*ring-.55*pores-.22*knotRing+.10*(micro-.5)),roughness:clamp(p.roughness+.09*(broad-.5)+.07*pores-.09*knot+.03*ring-.04*wear,.12,.98),knot};
 };
}
export function bake(config){
 const p=normalize(config),n=p.size,pad=Math.max(2,n/64),content=n-2*pad,w=2*n,h=n;
 const maps=Object.fromEntries(['baseColor','normal','metallicRoughness'].map(k=>[k,Buffer.alloc(w*h*3)]));let maxSlope=0;
 const regions={};
 for(const [j,kind] of ['long','end'].entries()){
  const field=makeField(p,kind),meters=kind==='long'?p.tileMeters:p.endTileMeters,step=meters/content,eps=.5/content;
  regions[kind]={pixels:{x:j*n+pad,y:pad,width:content,height:content},metersPerTile:meters,uvRect:[(j*n+pad)/w,pad/h,content/w,content/h]};
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   // Extruded edge gutters. Face UVs are bounded inside the content, never repeated across regions.
   const u=(clamp(x-pad,0,content-1)+.5)/content,v=1-(clamp(y-pad,0,content-1)+.5)/content,f=field(u,v),i=(y*w+j*n+x)*3;
   const dx=(field(u+eps,v).height-field(u-eps,v).height)/step,dy=(field(u,v+eps).height-field(u,v-eps).height)/step,len=Math.hypot(dx,dy,1);
   maxSlope=Math.max(maxSlope,Math.hypot(dx,dy));
   for(let c=0;c<3;c++)maps.baseColor[i+c]=Math.round(f.color[c]);
   maps.normal[i]=Math.round(127.5*(1-dx/len));maps.normal[i+1]=Math.round(127.5*(1-dy/len));maps.normal[i+2]=Math.round(127.5*(1+1/len));
   maps.metallicRoughness[i]=255;maps.metallicRoughness[i+1]=Math.round(255*f.roughness);maps.metallicRoughness[i+2]=0;
  }
 }
 return {parameters:p,width:w,height:h,...maps,maxSlope,atlas:{version:1,width:w,height:h,paddingPixels:pad,regions,tileable:false,limits:['End grain uses a separate radial field; not a volumetrically continuous tree cross-section.','Gutters protect finite mip levels only; never repeat UVs across atlas regions.']}};
}
