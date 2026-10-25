// CPU mirror of the water column the terrain and placed objects share (H34),
// in linear colour, plus the test for which placements need it. The TSL
// version is waterColumn in landscape.jsx; keep the two in step.
export const WATER_TRANSMISSION=[.9,.16,.11];
export const SEABED_SHALLOW_COLOR='#4fd2cf',WATER_DEEP_COLOR='#145a70';

const smoothstep=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const toLinear=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4;
export const linearHex=hex=>[1,3,5].map(i=>toLinear(parseInt(hex.slice(i,i+2),16)/255));

// Colour of a surface `depth` metres below the water surface: two-way
// Beer–Lambert transmission (red absorbed first) toward a scatter colour that
// deepens from shallowColor to color between 1.5 and 9 m. Caustics are left
// out; they are a moving highlight, not part of the tint.
export function underwaterColor(albedo,depth,water={}){
  const d=Math.max(0,depth),shallow=linearHex(water.shallowColor??SEABED_SHALLOW_COLOR),deep=linearHex(water.color??WATER_DEEP_COLOR);
  const along=smoothstep(1.5,9,d),under=smoothstep(0,.12,d);
  return albedo.map((c,i)=>{const t=Math.exp(-WATER_TRANSMISSION[i]*2*d),scatter=mix(shallow[i],deep[i],along);return mix(c,c*t+scatter*(1-t),under);});
}

// The highest the water surface reaches, plus a margin for the waterline band.
export const waterCeiling=water=>water.level+water.waves.reduce((sum,w)=>sum+w.amplitude,0)+.15;

// World axis-aligned extent of a local bounding box under a placement's
// position, rotation (three.js Euler XYZ, radians) and scale.
export function placedExtent(box,{position,rotation=[0,0,0],scale=[1,1,1]}){
  const [x,y,z]=rotation,[cx,sx]=[Math.cos(x),Math.sin(x)],[cy,sy]=[Math.cos(y),Math.sin(y)],[cz,sz]=[Math.cos(z),Math.sin(z)];
  // The rows of Rx·Ry·Rz.
  const rows=[[cy*cz,-cy*sz,sy],[cx*sz+sx*sy*cz,cx*cz-sx*sy*sz,-sx*cy],[sx*sz-cx*sy*cz,sx*cz+cx*sy*sz,cx*cy]];
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const px of [box.min[0],box.max[0]])for(const py of [box.min[1],box.max[1]])for(const pz of [box.min[2],box.max[2]])
    rows.forEach((row,i)=>{const v=position[i]+row[0]*px*scale[0]+row[1]*py*scale[1]+row[2]*pz*scale[2];min[i]=Math.min(min[i],v);max[i]=Math.max(max[i],v);});
  return {min,max};
}
// Lowest world Y of a local bounding box under a placement.
export const placedBottom=(box,placement)=>placedExtent(box,placement).min[1];

// Asset IDs with at least one placement (scatter instances included) that can
// reach below the highest wave crest inside the ocean's bounds. Only that
// rectangle holds water: a foundation or cliff below the level elsewhere stays
// dry. `bounds` maps asset ID to {min,max}.
export function underwaterAssets(placements,bounds,water){
  const ceiling=waterCeiling(water),[xmin,xmax,zmin,zmax]=water.bounds??[-Infinity,Infinity,-Infinity,Infinity],out=new Set();
  for(const item of placements){
    if(!item.asset||out.has(item.asset)||!bounds[item.asset])continue;
    const {min,max}=placedExtent(bounds[item.asset],item);
    if(min[1]<ceiling&&max[0]>=xmin&&min[0]<=xmax&&max[2]>=zmin&&min[2]<=zmax)out.add(item.asset);
  }
  return out;
}
