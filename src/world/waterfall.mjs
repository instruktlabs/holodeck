// Native Holodeck waterfalls (scene.water.falls): pure data records validated
// without Three, plus pure geometry builders for multi-ribbon parabolic
// curtains, plunge-pool splash rings and billowing mist clouds. Visual only:
// terrain support, swimming and world_sample remain governed by scene.water.

const assert=(condition,message)=>{if(!condition)throw new Error(message);};
const record=(value,keys,label)=>assert(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>keys.includes(k)),`Invalid ${label} fields`);
const finite=(value,min,max,label)=>assert(Number.isFinite(value)&&value>=min&&value<=max,`Invalid ${label}`);
const vector=(value,length,label)=>assert(Array.isArray(value)&&value.length===length&&value.every(n=>Number.isFinite(n)&&Math.abs(n)<=1000),`Invalid ${label}`);
const tint=(value,label)=>assert(typeof value==='string'&&/^#[a-f0-9]{6}$/i.test(value),`Invalid ${label}`);

export const MAX_WATERFALLS=8;
export const WATERFALL_DEFAULTS=Object.freeze({
 width:2.5,spread:1.25,arch:.8,speed:4.5,opacity:.88,color:'#eefbff',tint:'#5ec8cc',
 mist:{height:4,opacity:.65},
});

export function validateWaterfalls(falls){
 assert(Array.isArray(falls)&&falls.length<=MAX_WATERFALLS,`Water allows at most ${MAX_WATERFALLS} falls`);
 const ids=new Set();
 for(const fall of falls){
  record(fall,['id','top','bottom','facing','width','spread','arch','speed','opacity','color','tint','mist'],'waterfall');
  assert(typeof fall.id==='string'&&/^[-\w]{1,64}$/.test(fall.id)&&!ids.has(fall.id),'Invalid or duplicate waterfall ID');
  ids.add(fall.id);
  vector(fall.top,3,'waterfall top');
  vector(fall.bottom,3,'waterfall bottom');
  assert(fall.top[1]-fall.bottom[1]>=.25,'Waterfall top must be at least 0.25 m above bottom');
  if(fall.facing!==undefined){
   vector(fall.facing,2,'waterfall facing');
   assert(Math.abs(Math.hypot(...fall.facing)-1)<=1e-6,'Waterfall facing must be a unit vector');
  }
  if(fall.width!==undefined)finite(fall.width,.2,40,'waterfall width');
  if(fall.spread!==undefined)finite(fall.spread,.5,3,'waterfall spread');
  if(fall.arch!==undefined)finite(fall.arch,0,10,'waterfall arch');
  if(fall.speed!==undefined)finite(fall.speed,.2,20,'waterfall speed');
  if(fall.opacity!==undefined)finite(fall.opacity,.05,1,'waterfall opacity');
  if(fall.color!==undefined)tint(fall.color,'waterfall color');
  if(fall.tint!==undefined)tint(fall.tint,'waterfall tint');
  if(fall.mist!==undefined&&fall.mist!==null){
   record(fall.mist,['radius','height','opacity'],'waterfall mist');
   if(fall.mist.radius!==undefined)finite(fall.mist.radius,.5,30,'waterfall mist radius');
   if(fall.mist.height!==undefined)finite(fall.mist.height,.5,20,'waterfall mist height');
   if(fall.mist.opacity!==undefined)finite(fall.mist.opacity,0,1,'waterfall mist opacity');
  }
 }
 return falls;
}

export function resolveWaterfall(fall){
 const dx=fall.bottom[0]-fall.top[0],dz=fall.bottom[2]-fall.top[2],horiz=Math.hypot(dx,dz);
 const facing=fall.facing?[...fall.facing]:(horiz>1e-5?[dx/horiz,dz/horiz]:[0,1]);
 const right=[-facing[1],facing[0]];
 const width=fall.width??WATERFALL_DEFAULTS.width;
 const mist=fall.mist===null?null:{
  radius:fall.mist?.radius??Math.max(1.5,width*1.75),
  height:fall.mist?.height??WATERFALL_DEFAULTS.mist.height,
  opacity:fall.mist?.opacity??WATERFALL_DEFAULTS.mist.opacity,
 };
 return {
  id:fall.id,
  top:[...fall.top],
  bottom:[...fall.bottom],
  facing,
  right,
  drop:fall.top[1]-fall.bottom[1],
  width,
  spread:fall.spread??WATERFALL_DEFAULTS.spread,
  arch:fall.arch??WATERFALL_DEFAULTS.arch,
  speed:fall.speed??WATERFALL_DEFAULTS.speed,
  opacity:fall.opacity??WATERFALL_DEFAULTS.opacity,
  color:fall.color??WATERFALL_DEFAULTS.color,
  tint:fall.tint??WATERFALL_DEFAULTS.tint,
  mist,
 };
}

// Deterministic multi-ribbon parabolic cascade mesh data: three depth-staggered
// fluted ribbons merged into one indexed triangle buffer. Vertex colors encode
// (r: layer weight 0.55..1.0, g: scroll phase offset, b: channel crest).
export function buildWaterfallCurtainData(fall){
 const f=resolveWaterfall(fall);
 const layers=[
  {depthOffset:0,widthScale:1,archScale:1,layerWeight:1,phase:0,fluteFreq:3,fluteAmp:.18},
  {depthOffset:.24,widthScale:.92,archScale:1.12,layerWeight:.72,phase:.37,fluteFreq:5,fluteAmp:.14},
  {depthOffset:-.22,widthScale:.88,archScale:.88,layerWeight:.62,phase:.71,fluteFreq:4,fluteAmp:.12},
 ];
 const cols=20,rows=28,vertsPerLayer=(cols+1)*(rows+1),trisPerLayer=cols*rows*2;
 const positions=new Float32Array(layers.length*vertsPerLayer*3);
 const normals=new Float32Array(layers.length*vertsPerLayer*3);
 const uvs=new Float32Array(layers.length*vertsPerLayer*2);
 const colors=new Float32Array(layers.length*vertsPerLayer*3);
 const indices=new Uint32Array(layers.length*trisPerLayer*3);
 const [fx,fz]=f.facing,[rx,rz]=f.right;
 let vBase=0,iBase=0;
 for(const layer of layers){
  for(let r=0;r<=rows;r++){
   const v=r/rows;
   // Gravity curve: slow roll over the top lip, steep accelerating plunge.
   const lipOut=Math.sin(Math.min(1,v*4)*Math.PI*.5);
   const bulge=f.arch*layer.archScale*Math.sin(v*Math.PI*.85)*(1-v*.25)+layer.depthOffset*lipOut;
   const y=f.top[1]-(f.drop*(v*v*.78+v*.22));
   const cx=f.top[0]+(f.bottom[0]-f.top[0])*v+fx*bulge;
   const cz=f.top[2]+(f.bottom[2]-f.top[2])*v+fz*bulge;
   const halfW=f.width*layer.widthScale*(1+(f.spread-1)*Math.pow(v,.85))*.5;
   for(let c=0;c<=cols;c++){
    const u=c/cols,s=(u-.5)*2;
    // Gentle curvature + vertical water-channel flutes so light catches ribbons.
    const cup=(1-s*s)*.28*layer.widthScale;
    const flute=Math.sin(u*Math.PI*layer.fluteFreq+layer.phase*6.283)*layer.fluteAmp*Math.sin(v*Math.PI);
    const out=cup+flute;
    const px=cx+rx*(s*halfW)+fx*out;
    const pz=cz+rz*(s*halfW)+fz*out;
    const vi=vBase+r*(cols+1)+c;
    positions[vi*3]=px;positions[vi*3+1]=y;positions[vi*3+2]=pz;
    // Approximate outward facing normal with slight channel tilt.
    const nx=fx+rx*s*.35,ny=.15*(1-v),nz=fz+rz*s*.35,nl=Math.hypot(nx,ny,nz)||1;
    normals[vi*3]=nx/nl;normals[vi*3+1]=ny/nl;normals[vi*3+2]=nz/nl;
    uvs[vi*2]=u;uvs[vi*2+1]=v;
    colors[vi*3]=layer.layerWeight;
    colors[vi*3+1]=layer.phase;
    colors[vi*3+2]=.5+.5*Math.cos(u*Math.PI*layer.fluteFreq+layer.phase*6.283);
   }
  }
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
   const a=vBase+r*(cols+1)+c,b=a+1,d=a+cols+1,e=d+1;
   indices[iBase++]=a;indices[iBase++]=d;indices[iBase++]=b;
   indices[iBase++]=b;indices[iBase++]=d;indices[iBase++]=e;
  }
  vBase+=vertsPerLayer;
 }
 return {positions,normals,uvs,colors,indices};
}

// Horizontal plunge-pool splash foam disc just above water level.
export function buildWaterfallSplashData(fall,waterLevel){
 const f=resolveWaterfall(fall);
 if(!f.mist)return null;
 const rad=f.mist.radius*.95,rings=28,y=Math.max(f.bottom[1],waterLevel)+.035;
 const cx=f.bottom[0]+f.facing[0]*(f.arch*.35),cz=f.bottom[2]+f.facing[1]*(f.arch*.35);
 const positions=new Float32Array((rings+2)*3),normals=new Float32Array((rings+2)*3),uvs=new Float32Array((rings+2)*2);
 const indices=new Uint32Array(rings*3);
 positions[0]=cx;positions[1]=y;positions[2]=cz;normals[1]=1;uvs[0]=.5;uvs[1]=.5;
 for(let i=0;i<=rings;i++){
  const a=i/rings*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a),vi=i+1;
  positions[vi*3]=cx+ca*rad;positions[vi*3+1]=y;positions[vi*3+2]=cz+sa*rad;
  normals[vi*3+1]=1;
  uvs[vi*2]=.5+ca*.5;uvs[vi*2+1]=.5+sa*.5;
  if(i<rings){indices[i*3]=0;indices[i*3+1]=vi+1;indices[i*3+2]=vi;}
 }
 return {positions,normals,uvs,indices};
}

// Soft multi-angle volumetric mist plume cluster around the plunge base.
// Uses curved star-crossed billowing arcs + an angled halo skirt so the mist
// reads full and luminous from shoreline, island and return viewpoints.
export function buildWaterfallMistData(fall,waterLevel){
 const f=resolveWaterfall(fall);
 if(!f.mist)return null;
 const {radius,height}=f.mist,baseY=Math.max(f.bottom[1],waterLevel)-.25;
 const cx=f.bottom[0]+f.facing[0]*(f.arch*.35),cz=f.bottom[2]+f.facing[1]*(f.arch*.35);
 const baseAngle=Math.atan2(f.facing[0],f.facing[1]);
 const plumes=[
  {angle:baseAngle,offset:[0,0,0],w:radius*2.2,h:height*1.05,tilt:.12,phase:.05},
  {angle:baseAngle+Math.PI*.33,offset:[f.right[0]*radius*.25,0,f.right[1]*radius*.25],w:radius*1.9,h:height*.92,tilt:.16,phase:.29},
  {angle:baseAngle-Math.PI*.33,offset:[-f.right[0]*radius*.25,0,-f.right[1]*radius*.25],w:radius*1.9,h:height*.95,tilt:.16,phase:.53},
  {angle:baseAngle+Math.PI*.16,offset:[f.facing[0]*radius*.32,0,f.facing[1]*radius*.32],w:radius*1.75,h:height*.78,tilt:.22,phase:.71},
  {angle:baseAngle-Math.PI*.16,offset:[-f.facing[0]*radius*.18,height*.22,-f.facing[1]*radius*.18],w:radius*1.6,h:height*1.12,tilt:.08,phase:.88},
  {angle:baseAngle+Math.PI*.5,offset:[0,height*.08,0],w:radius*1.85,h:height*.85,tilt:.18,phase:.42},
 ];
 const segX=6,segY=4,vPer=(segX+1)*(segY+1),tPer=segX*segY*2;
 const positions=new Float32Array(plumes.length*vPer*3);
 const normals=new Float32Array(plumes.length*vPer*3);
 const uvs=new Float32Array(plumes.length*vPer*2);
 const colors=new Float32Array(plumes.length*vPer*3);
 const indices=new Uint32Array(plumes.length*tPer*3);
 let vBase=0,iBase=0;
 for(const p of plumes){
  const tx=Math.cos(p.angle),tz=-Math.sin(p.angle),nx=Math.sin(p.angle),nz=Math.cos(p.angle);
  for(let r=0;r<=segY;r++){
   const v=r/segY;
   for(let c=0;c<=segX;c++){
    const u=c/segX,s=(u-.5)*2;
    const bow=(1-s*s)*p.w*.14,lean=v*p.h*p.tilt;
    const px=cx+p.offset[0]+tx*(s*p.w*.5)+nx*(bow+lean);
    const py=baseY+p.offset[1]+v*p.h;
    const pz=cz+p.offset[2]+tz*(s*p.w*.5)+nz*(bow+lean);
    const vi=vBase+r*(segX+1)+c;
    positions[vi*3]=px;positions[vi*3+1]=py;positions[vi*3+2]=pz;
    normals[vi*3]=nx;normals[vi*3+1]=.25;normals[vi*3+2]=nz;
    uvs[vi*2]=u;uvs[vi*2+1]=v;
    colors[vi*3]=p.phase;colors[vi*3+1]=v;colors[vi*3+2]=1;
   }
  }
  for(let r=0;r<segY;r++)for(let c=0;c<segX;c++){
   const a=vBase+r*(segX+1)+c,b=a+1,d=a+segX+1,e=d+1;
   indices[iBase++]=a;indices[iBase++]=b;indices[iBase++]=d;
   indices[iBase++]=b;indices[iBase++]=e;indices[iBase++]=d;
  }
  vBase+=vPer;
 }
 return {positions,normals,uvs,colors,indices};
}
