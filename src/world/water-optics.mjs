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

// Lowest world Y of a local bounding box under a placement's position,
// rotation (three.js Euler XYZ, radians) and scale.
export function placedBottom(box,{position,rotation=[0,0,0],scale=[1,1,1]}){
  const [x,y,z]=rotation,[cx,sx]=[Math.cos(x),Math.sin(x)],[cy,sy]=[Math.cos(y),Math.sin(y)],[cz,sz]=[Math.cos(z),Math.sin(z)];
  // Row 2 of Rx·Ry·Rz, the world Y of a rotated local point.
  const row=[cx*sz+sx*sy*cz,cx*cz-sx*sy*sz,-sx*cy];
  let bottom=Infinity;
  for(const px of [box.min[0],box.max[0]])for(const py of [box.min[1],box.max[1]])for(const pz of [box.min[2],box.max[2]])
    bottom=Math.min(bottom,position[1]+row[0]*px*scale[0]+row[1]*py*scale[1]+row[2]*pz*scale[2]);
  return bottom;
}

// Asset IDs with at least one placement (scatter instances included) that can
// reach below the highest wave crest. `bounds` maps asset ID to {min,max}.
export function underwaterAssets(placements,bounds,water){
  const ceiling=waterCeiling(water),out=new Set();
  for(const item of placements){
    if(!item.asset||out.has(item.asset)||!bounds[item.asset])continue;
    if(placedBottom(bounds[item.asset],item)<ceiling)out.add(item.asset);
  }
  return out;
}
