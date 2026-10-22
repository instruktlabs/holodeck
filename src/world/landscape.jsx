import React,{useEffect,useMemo} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import {SkyMesh} from 'three/addons/objects/SkyMesh.js';
import {Fn,abs,acos,cameraPosition,color,cos,dot,exp,float,floor,int,ivec2,materialColor,max,mix,modelViewProjection,normalMap,normalWorldGeometry,positionLocal,positionWorld,select,sin,smoothstep,step,texture,textureLoad,uniform,vec2,vec3,vec4} from 'three/tsl';
import {createTerrain} from './terrain.mjs';
import {rasterizeLayerMasks} from './terrain-layers.mjs';
import {SEABED_SHALLOW_COLOR,WATER_DEEP_COLOR,WATER_TRANSMISSION} from './water-optics.mjs';
import {buildSurfMap,resolveSurf} from './surf.mjs';
import {resolveSky} from './sky.mjs';

// Two bounded surface draws. Geometry, walking and shoreline shading all read
// the same terrain lattice; only material detail is evaluated per fragment.
const OCEAN_SEGMENTS=256;
const TAU=Math.PI*2;
const fract=n=>n-Math.floor(n);
const hash=(x,z)=>fract(Math.sin(x*127.1+z*311.7)*43758.5453);
const lerp=(a,b,t)=>a+(b-a)*t;
function periodicNoise(x,z,period){
 const ix=Math.floor(x),iz=Math.floor(z),u=fract(x),v=fract(z),a=u*u*(3-2*u),b=v*v*(3-2*v);
 const at=(i,j)=>hash((i%period+period)%period,(j%period+period)%period);
 return lerp(lerp(at(ix,iz),at(ix+1,iz),a),lerp(at(ix,iz+1),at(ix+1,iz+1),a),b);
}

// Original seamless, deterministic detail. Packed channels carry broad
// variation, grain and grass mottling, with mipmaps preventing distant shimmer.
function makeDetailTextures(){
 const size=256,data=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),height=new Float32Array(size*size);
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  const u=x/size,v=z/size,broad=periodicNoise(u*8,v*8,8),medium=periodicNoise(u*32,v*32,32),fine=hash(x,z),i=(z*size+x)*4;
  data[i]=Math.round(broad*255);data[i+1]=Math.round((medium*.65+fine*.35)*255);data[i+2]=Math.round(periodicNoise(u*16,v*16,16)*255);data[i+3]=255;
  height[z*size+x]=medium*.65+fine*.35;
 }
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  const dx=(height[z*size+(x+size-1)%size]-height[z*size+(x+1)%size])*.6,dz=(height[((z+size-1)%size)*size+x]-height[((z+1)%size)*size+x])*.6,n=new THREE.Vector3(dx,dz,1).normalize(),i=(z*size+x)*4;
  normal[i]=(n.x*.5+.5)*255;normal[i+1]=(n.y*.5+.5)*255;normal[i+2]=(n.z*.5+.5)*255;normal[i+3]=255;
 }
 const make=bytes=>{
  const t=new THREE.DataTexture(bytes,size,size,THREE.RGBAFormat,THREE.UnsignedByteType);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;return t;
 };
 return {detail:make(data),normal:make(normal)};
}

// Ocean detail is a smooth, warped height field rather than crossed sine
// stripes. Its signed slopes average toward flat in the mip chain; the other
// channels provide matching broad patches and foam breakup without extra maps.
function makeOceanDetailTexture(){
 const size=256,height=new Float32Array(size*size),data=new Uint8Array(size*size*4);
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  const u=x/size,v=z/size,warpX=(periodicNoise(u*4,v*4,4)-.5)*1.5,warpZ=(periodicNoise(u*4+9,v*4+5,4)-.5)*1.5;
  const broad=periodicNoise(u*8+warpX,v*8+warpZ,8),medium=periodicNoise(u*16+warpX*1.7,v*16+warpZ*1.7,16),fine=periodicNoise(u*32+warpX*2.3,v*32+warpZ*2.3,32);
  const i=z*size+x; height[i]=broad*.64+medium*.25+fine*.11;
  data[i*4+2]=Math.round(broad*255);data[i*4+3]=Math.round(height[i]*255);
 }
 for(let z=0;z<size;z++)for(let x=0;x<size;x++){
  const dx=(height[z*size+(x+1)%size]-height[z*size+(x+size-1)%size])*6,dz=(height[((z+1)%size)*size+x]-height[((z+size-1)%size)*size+x])*6,i=(z*size+x)*4;
  data[i]=Math.round((Math.max(-1,Math.min(1,dx))*.5+.5)*255);data[i+1]=Math.round((Math.max(-1,Math.min(1,dz))*.5+.5)*255);
 }
 const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat,THREE.UnsignedByteType);
 t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;t.needsUpdate=true;return t;
}

function makeHeightTexture(lattice){
 const [nx,nz]=lattice.segments;
 const t=new THREE.DataTexture(lattice.heights,nx+1,nz+1,THREE.RedFormat,THREE.FloatType);
 // Float textures deliberately use nearest texel loads on both backends.
 // Hardware bilinear sampling would disagree with the rendered triangles.
 t.minFilter=t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;t.needsUpdate=true;return t;
}

function groundNodes(p,lattice,heightTexture,baseHeight){
 if(!lattice)return {height:float(baseHeight),slope:float(.05)};
 const [xmin,xmax,zmin,zmax]=lattice.bounds,[nx,nz]=lattice.segments;
 const grid=p.sub(vec2(xmin,zmin)).div(vec2(xmax-xmin,zmax-zmin)).mul(vec2(nx,nz));
 const cell=grid.floor().clamp(vec2(0),vec2(nx-1,nz-1)),f=grid.sub(cell).clamp(0,1),i=ivec2(cell);
 const a=textureLoad(heightTexture,i).r,b=textureLoad(heightTexture,i.add(ivec2(1,0))).r,c=textureLoad(heightTexture,i.add(ivec2(0,1))).r,d=textureLoad(heightTexture,i.add(ivec2(1,1))).r;
 const first=f.x.add(f.y).lessThanEqual(1);
 const h=select(first,a.add(b.sub(a).mul(f.x)).add(c.sub(a).mul(f.y)),d.add(c.sub(d).mul(f.x.oneMinus())).add(b.sub(d).mul(f.y.oneMinus())));
 const dx=select(first,b.sub(a),d.sub(c)).mul(nx/(xmax-xmin)),dz=select(first,c.sub(a),d.sub(b)).mul(nz/(zmax-zmin));
 const inside=grid.x.greaterThanEqual(0).and(grid.x.lessThanEqual(nx)).and(grid.y.greaterThanEqual(0)).and(grid.y.lessThanEqual(nz));
 return {height:select(inside,h,float(baseHeight)),slope:select(inside,vec2(dx,dz).length(),float(.05))};
}

// Exactly sampleWater's vertical wave equation and analytical derivatives.
// The speed is metres/second, phase radians, direction a unit XZ vector.
function waveNodes(p,water,clock,filterNormals=false){
 let height=float(water?.level??0),dx=float(0),dz=float(0);
 for(const w of water?.waves??[]){
  const k=TAU/w.wavelength,phase=p.dot(vec2(...w.direction)).sub(clock.mul(w.speed)).mul(k).add(w.phase??0);
  height=height.add(sin(phase).mul(w.amplitude));
  // Only the fragment's shading normal is filtered. Vertex displacement and
  // every height query retain the exact shared analytical wave equation.
  let derivative=cos(phase).mul(w.amplitude*k);
  if(filterNormals)derivative=derivative.mul(smoothstep(.65,2.8,phase.fwidth()).oneMinus());
  dx=dx.add(derivative.mul(w.direction[0]));dz=dz.add(derivative.mul(w.direction[1]));
 }
 return {height,dx,dz};
}

function oceanDetailNodes(p,water,clock,oceanTexture){
 const [windX,windZ]=water.waves[0]?.direction??[1,0],q=vec2(p.x.mul(windX).add(p.y.mul(windZ)),p.y.mul(windX).sub(p.x.mul(windZ)));
 const warp=texture(oceanTexture,q.mul(.024).add(vec2(clock.mul(-.002),clock.mul(.001)))).ba.sub(.5);
 const a=texture(oceanTexture,q.mul(vec2(.1,.065)).add(warp.mul(.16)).sub(vec2(clock.mul(.009),clock.mul(.003))));
 const rotated=vec2(q.x.mul(.8).sub(q.y.mul(.6)),q.x.mul(.6).add(q.y.mul(.8)));
 const b=texture(oceanTexture,rotated.mul(vec2(.22,.16)).add(warp.mul(.23)).sub(vec2(clock.mul(.015),clock.mul(-.005))));
 const footprint=p.fwidth().length().toVar(),coarseFade=smoothstep(.13,.8,footprint).oneMinus(),fineFade=smoothstep(.035,.24,footprint).oneMinus();
 const slopeA=a.rg.mul(2).sub(1).mul(vec2(.5,.3)).mul(coarseFade),slopeB=b.rg.mul(2).sub(1).mul(vec2(.16,.1)).mul(fineFade);
 const slope=slopeA.add(vec2(slopeB.x.mul(.8).add(slopeB.y.mul(.6)),slopeB.y.mul(.8).sub(slopeB.x.mul(.6))));
 return {dx:slope.x.mul(windX).sub(slope.y.mul(windZ)),dz:slope.x.mul(windZ).add(slope.y.mul(windX)),patch:warp.x.add(.5),foam:a.a.mul(.65).add(b.b.mul(.35)),footprint};
}

// Authored layer maps pack into two texture arrays: albedo (sRGB) with
// roughness in alpha, and tangent-space normals. A single layer is padded to
// two so both backends bind a true array texture.
const DEFAULT_LAYER_ROUGHNESS=230;
function makeLayerTextures(layers,images){
 if(!layers?.length||!layers.every(l=>['albedo','normal','roughness'].every(k=>!l.maps[k]||images?.[l.maps[k]])))return null;
 const size=images[layers[0].maps.albedo].width,count=Math.max(2,layers.length),texel=size*size*4;
 const albedo=new Uint8Array(texel*count),normal=new Uint8Array(texel*count);
 for(let i=0;i<count;i++){
  const layer=layers[Math.min(i,layers.length-1)],roughness=layer.maps.roughness?images[layer.maps.roughness].data:null;
  albedo.set(images[layer.maps.albedo].data,i*texel);normal.set(images[layer.maps.normal].data,i*texel);
  for(let k=0;k<size*size;k++)albedo[i*texel+k*4+3]=roughness?roughness[k*4]:DEFAULT_LAYER_ROUGHNESS;
 }
 const make=(data,srgb)=>{
  const t=new THREE.DataArrayTexture(data,size,size,count);t.format=THREE.RGBAFormat;t.type=THREE.UnsignedByteType;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=4;
  if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;
 };
 return {albedo:make(albedo,true),normal:make(normal,false),dispose(){this.albedo.dispose();this.normal.dispose();}};
}
// Near and paint masks for up to four layers, one per channel, over the terrain bounds.
const MASK_SIZE=512;
function makeMaskTexture(){
 const t=new THREE.DataTexture(new Uint8Array(MASK_SIZE*MASK_SIZE*4).fill(255),MASK_SIZE,MASK_SIZE,THREE.RGBAFormat,THREE.UnsignedByteType);
 t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;t.magFilter=t.minFilter=THREE.LinearFilter;t.generateMipmaps=false;t.needsUpdate=true;return t;
}
// terrain-layers.mjs bandWeight: 1 inside [min,max], fading over `fade` outside.
const band=(value,[min,max,fade])=>{const f=Math.max(fade,1e-4);return smoothstep(min-f,min,value).mul(smoothstep(max,max+f,value).oneMinus());};
function layerSample(arrays,index,layer,p,n){
 const k=1/(layer.scale??4),at=(map,uv)=>texture(map,uv).depth(int(index));
 // Image rows run +v in a DataArrayTexture, so green is flipped into the
 // terrain's tangent frame (u along +x, v along +z).
 const tangent=sample=>vec3(sample.r,sample.g.oneMinus(),sample.b);
 if(layer.projection!=='triplanar'){const uv=p.xz.mul(k),a=at(arrays.albedo,uv);return {albedo:a.rgb,roughness:a.a,normal:tangent(at(arrays.normal,uv))};}
 // Triplanar albedo and roughness; normal detail comes from the top projection
 // only and fades out on steep faces.
 const b=abs(n).pow(vec3(4)),w=b.div(b.x.add(b.y).add(b.z));
 const a=at(arrays.albedo,p.zy.mul(k)).mul(w.x).add(at(arrays.albedo,p.xz.mul(k)).mul(w.y)).add(at(arrays.albedo,p.xy.mul(k)).mul(w.z));
 return {albedo:a.rgb,roughness:a.a,normal:mix(vec3(.5,.5,1),tangent(at(arrays.normal,p.xz.mul(k))),w.y)};
}

// Light through the water column, shared by the terrain and placed objects
// (H34) so coral and the seabed beside it take the same tint at the same
// depth. Submerged surfaces carry the water's colour: light crosses the column
// twice and red is absorbed first (Beer-Lambert), so pale sand reads turquoise
// in the shallows and blue with depth, as clear reef water does. The CPU mirror
// is underwaterColor in water-optics.mjs.
function waterColumn({dry,bed,p,surface,water,clock,detail,environment}){
 const submerged=surface.sub(p.y).max(0);
 const transmit=exp(vec3(...WATER_TRANSMISSION).mul(submerged.mul(-2)));
 const scatter=mix(color(water.shallowColor??SEABED_SHALLOW_COLOR),color(water.color??WATER_DEEP_COLOR),smoothstep(1.5,9,submerged));
 // Cheap caustics: two drifting samples of the detail map form a bright net
 // where they cross. They fade in below the foam line and out with depth.
 const drift=clock.mul(.02),c1=texture(detail,p.xz.mul(.33).add(vec2(drift,drift.mul(.6)))).r,c2=texture(detail,p.xz.mul(.29).add(vec2(drift.mul(-.8),drift.mul(.9)))).r;
 const near=smoothstep(55,12,cameraPosition.sub(p).length());
 const caustic=smoothstep(.07,0,abs(c1.sub(c2))).mul(smoothstep(.06,.45,submerged)).mul(smoothstep(7,1.2,submerged)).mul(near).mul(.6);
 const lit=bed.add(color(environment?.sunColor??'#fff1d0').mul(caustic));
 return mix(dry,lit.mul(transmit).add(scatter.mul(transmit.oneMinus())),smoothstep(0,.12,submerged));
}

// Surf (H22): one map over the terrain bounds (see surf.mjs) read by the ocean
// for reef-break foam and by the terrain for swash. Each set arrives once per
// period and travels with the swell; detail noise bends the set line.
function makeSurf(water,terrain,lattice){
 if(!water?.surf||!lattice)return null;
 const settings=resolveSurf(water),data=buildSurfMap({bounds:terrain.bounds,heightAt:(x,z)=>lattice.sample(x,z).height,level:water.level,surf:settings});
 const map=new THREE.DataTexture(data,SURF_SIZE,SURF_SIZE,THREE.RGBAFormat,THREE.UnsignedByteType);
 map.magFilter=map.minFilter=THREE.LinearFilter;map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;map.needsUpdate=true;
 return {map,settings,bounds:terrain.bounds};
}
const SURF_SIZE=512;
function surfNodes(surf,p,clock,bend){
 const [xmin,xmax,zmin,zmax]=surf.bounds,{direction:[ux,uz],period,celerity}=surf.settings;
 const sample=texture(surf.map,p.xz.sub(vec2(xmin,zmin)).div(vec2(xmax-xmin,zmax-zmin)));
 const phase=clock.div(period).sub(p.x.mul(ux).add(p.z.mul(uz)).div(celerity*period)).add(bend).fract();
 return {strength:sample.r,whitewater:sample.g.oneMinus(),swell:sample.b,phase};
}

function makeTerrainMaterial(terrain,water,clock,textures,environment,layerTextures,mask,surf){
 const a=terrain.appearance??{},scale=a.textureScale??1,material=new THREE.MeshStandardNodeMaterial({roughness:.95});
 const p=positionWorld,coords=p.xz.mul(scale),grain=texture(textures.detail,coords.mul(.85)),broad=texture(textures.detail,coords.mul(.037)).r;
 const wetHeight=water?waveNodes(p.xz,water,clock).height.add(.13):float(-1000);
 const wet=smoothstep(wetHeight.sub(.05),wetHeight.add(.62),p.y).oneMinus();
 const slope=normalWorldGeometry.y.clamp(0,1),rockStart=Math.cos(a.rockSlope??.72);
 const rock=smoothstep(rockStart-.12,rockStart+.04,slope).oneMinus();
 const grass=smoothstep(a.grassStart??1.8,a.grassEnd??3.6,p.y.add(broad.sub(.5).mul(.7))).mul(rock.oneMinus()).mul(wet.oneMinus());
 // Broad patches break up a height contour, while grain remains subtle enough
 // that sunlight and actual terrain shape carry the surface at a distance.
 const sand=color(a.sandColor??'#d8c49a').mul(grain.g.mul(.13).add(.88)).mul(broad.mul(.1).add(.94));
 const wetSand=color(a.wetSandColor??'#9f9173').mul(grain.g.mul(.08).add(.94));
 const grassColor=color(a.grassColor??'#738150').mul(grain.b.mul(.38).add(.72));
 const rockColor=color(a.rockColor??'#929087').mul(grain.r.mul(.32).add(.76));
 let land=mix(mix(mix(sand,wetSand,wet.mul(.88)),grassColor,grass),rockColor,rock),bedBase=mix(sand,rockColor,rock);
 let detailNormal=texture(textures.normal,coords.mul(.85)).xyz,normalScale=vec2(.48),roughness=mix(float(.96),float(.44),wet).add(rock.mul(.025));
 // Authored layers draw over the base in order. The wet band stays on top, and
 // the seabed takes the layers too, so the shoreline reads the same.
 if(layerTextures){
  const [xmin,xmax,zmin,zmax]=terrain.bounds,n=normalWorldGeometry,slope=acos(n.y.clamp(-1,1)).mul(180/Math.PI),masks=texture(mask,p.xz.sub(vec2(xmin,zmin)).div(vec2(xmax-xmin,zmax-zmin)));
  terrain.appearance.layers.forEach((layer,index)=>{
   const m=layer.mask||{};let weight=float(layer.strength??1);
   if(m.height)weight=weight.mul(band(p.y,m.height));
   if(m.slope)weight=weight.mul(band(slope,m.slope));
   if(m.water)weight=weight.mul(band(p.y.sub(water?.level??0),m.water));
   if(m.near||m.paint)weight=weight.mul(masks[['r','g','b','a'][index]]);
   const s=layerSample(layerTextures,index,layer,p,n),surface=layer.tint?s.albedo.mul(color(layer.tint)):s.albedo,dry=weight.mul(wet.oneMinus());
   land=mix(land,surface,dry);bedBase=mix(bedBase,surface,weight);
   detailNormal=mix(detailNormal,s.normal,weight);normalScale=mix(normalScale,vec2(1),weight);roughness=mix(roughness,s.roughness,dry);
  });
 }
 // Swash: a film runs up the beach to level + runUp × swell and drains back
 // each period (uprush a third of it), with lace foam at its edge and sand
 // left damp below the highest reach.
 if(surf){
  const s=surfNodes(surf,p,clock,broad.mul(.6)),level=water.level,reach=s.swell.mul(surf.settings.runUp);
  const cycle=smoothstep(0,1/3,s.phase).mul(smoothstep(1,1/3,s.phase)),front=reach.mul(cycle).add(level);
  const above=smoothstep(level-.2,level+.02,p.y),film=smoothstep(front.add(.02),front.sub(.03),p.y).mul(above).mul(step(.005,reach));
  const damp=smoothstep(reach.add(level),float(level),p.y).mul(above).mul(.45);
  const lace=smoothstep(.045,0,abs(p.y.sub(front))).mul(step(.04,cycle)).mul(above).mul(step(.005,reach)).mul(grain.g.mul(.6).add(.4)).mul(surf.settings.intensity);
  land=mix(land,land.mul(.66),film.max(damp));land=mix(land,color('#edf3df'),lace.mul(.85));
  roughness=mix(roughness,float(.22),film);
 }
 if(!water)material.colorNode=land;
 else material.colorNode=waterColumn({dry:land,bed:bedBase,p,surface:wetHeight.sub(.13),water,clock,detail:textures.detail,environment});
 const ripplePhase=p.x.mul(20*scale).add(p.z.mul(7*scale)).add(sin(p.z.mul(1.7*scale)).mul(1.2));
 const rippleFade=ripplePhase.fwidth().mul(.7).clamp(0,1).oneMinus();
 const ripple=cos(ripplePhase).mul(.065).mul(rippleFade).mul(grass.oneMinus()).mul(wet.mul(.6).oneMinus());
 material.normalNode=normalMap(detailNormal.add(vec3(ripple,0,0)),normalScale);
 material.roughnessNode=roughness.clamp(.4,1);
 return material;
}

function makeOceanMaterial(water,lattice,heightTexture,baseHeight,clock,textures,environment,surf){
 const material=new THREE.MeshBasicNodeMaterial({transparent:true,depthWrite:false});
 const sun=new THREE.Vector3(...(environment.sunPosition??[-8,14,9])).normalize();
 material.positionNode=Fn(()=>{
  const p=positionLocal;
  return vec3(p.x,waveNodes(p.xz,water,clock).height,p.z);
 })();
 const surface=Fn(()=>{
  const p=positionWorld,w=waveNodes(p.xz,water,clock,true),ground=groundNodes(p.xz,lattice,heightTexture,baseHeight),detail=oceanDetailNodes(p.xz,water,clock,textures.ocean);
  const depth=p.y.sub(ground.height).max(0).toVar(),detailFade=smoothstep(.015,.3,depth);
  const dx=w.dx.add(detail.dx.mul(detailFade)),dz=w.dz.add(detail.dz.mul(detailFade));
  const normal=vec3(dx.negate(),1,dz.negate()).normalize().toVar(),view=cameraPosition.sub(p).normalize();
  const facing=normal.dot(view).clamp(0,1),fresnel=facing.oneMinus().pow(5).mul(.98).add(.02);
  // Reflect a blue sky gradient rather than the fog colour, which washed the
  // shallows to grey at grazing angles.
  const authored=resolveSky(environment),reflected=view.negate().reflect(normal);
  const sky=authored?skyGradientNode(authored,reflected.y):mix(mix(color(environment.fogColor??'#c5d9dd'),color('#9cc9e6'),.6),color('#3f7fbf'),reflected.y.clamp(0,1).pow(.5));
  const deep=smoothstep(.1,5.5,depth),body=mix(color(water.shallowColor??'#68bcb2'),color(water.color??'#145a70'),deep);
  // The seabed already carries absorption, so shallow water stays clear and
  // its reflection softer until the bottom is out of sight.
  const reflectance=fresnel.mul(mix(float(.55),float(1),deep));
  const sunFacing=reflected.dot(vec3(sun.x,sun.y,sun.z)).max(0);
  // A broad lobe surrounds the tight solar glint. Analytical reflection costs
  // no reflection camera or screen/depth target and stays stable on WebGL2.
  const normalVariance=normal.fwidth().length().mul(6).clamp(0,1);
  const light=sunFacing.pow(mix(float(220),float(55),normalVariance)).mul(mix(float(1.65),float(.65),normalVariance)).add(sunFacing.pow(34).mul(.12)).mul(environment.sunIntensity??2);
  const reflectedLight=sky.mul(.78).add(color(environment.sunColor??'#fff1d0').mul(light));
  const shoreDistance=depth.div(ground.slope.max(.09)),width=water.foamWidth??1.2;
  const shoreBand=smoothstep(0,width,shoreDistance).oneMinus();
  const shorePhase=shoreDistance.mul(2.3).add(clock.mul(1.45)).add(detail.patch.mul(3.2));
  const resolved=smoothstep(.7,2.8,shorePhase.fwidth()).oneMinus(),foamPatches=smoothstep(.3,.67,detail.foam);
  const ripple=sin(shorePhase),breaking=smoothstep(.55,.93,ripple).mul(resolved).mul(smoothstep(width*.6,width*4,shoreDistance).oneMinus()).mul(smoothstep(.015,.12,depth));
  let foam=shoreBand.mul(foamPatches.mul(.55).add(.18)).add(breaking.mul(foamPatches.mul(.5).add(.24))).clamp(0,.9);
  // Reef-break surf: a bright set line where the swell breaks, then whitewater
  // carried shoreward with the same phase, fading over the whitewater distance.
  if(surf){
   const s=surfNodes(surf,p,clock,detail.patch.mul(.15)),crest=smoothstep(.3,0,s.phase),intensity=surf.settings.intensity;
   const surfFoam=s.strength.mul(crest.mul(1.2).add(.3)).add(s.whitewater.mul(crest.mul(.9).add(.2))).mul(foamPatches.mul(.6).add(.4)).mul(intensity).mul(smoothstep(.015,.12,depth));
   foam=foam.max(surfFoam.clamp(0,.95));
  }
  foam=foam.toVar();
  const waterColor=mix(body.mul(.83).add(body.mul(normal.y.max(0).mul(.17))),reflectedLight,reflectance);
  const foamColor=color('#edf3df').mul(detail.foam.mul(.1).add(.9));
  const result=mix(waterColor,foamColor,foam);
  // Deep water is opaque, so the edge of the terrain lattice never shows through.
  const alpha=mix(float(.16).add(smoothstep(0,6,depth).mul(.84)).add(reflectance.mul(.3)).clamp(0,1),float(.97),foam);
  return vec4(result,alpha);
 })();
 material.colorNode=surface.rgb;material.opacityNode=surface.a;return material;
}

function makeOceanGeometry(water){
 const [xmin,xmax,zmin,zmax]=water.bounds,width=xmax-xmin,depth=zmax-zmin;
 const shortest=Math.min(...water.waves.map(w=>w.wavelength),12),spacing=Math.min(.75,shortest/12);
 const nx=Math.min(OCEAN_SEGMENTS,Math.max(16,Math.ceil(width/spacing))),nz=Math.min(OCEAN_SEGMENTS,Math.max(16,Math.ceil(depth/spacing)));
 const g=new THREE.PlaneGeometry(width,depth,nx,nz);g.rotateX(-Math.PI/2);g.translate((xmin+xmax)/2,0,(zmin+zmax)/2);
 // Displacement lives on the GPU; include every possible wave height in CPU
 // bounds so frustum culling never clips a rising crest.
 const amplitude=water.waves.reduce((sum,w)=>sum+w.amplitude,0);
 g.boundingBox=new THREE.Box3(new THREE.Vector3(xmin,water.level-amplitude,zmin),new THREE.Vector3(xmax,water.level+amplitude,zmax));
 g.boundingSphere=g.boundingBox.getBoundingSphere(new THREE.Sphere());return g;
}

export function Landscape({terrain,water,runtime,environment={},textures:images,placements}){
 const clock=useMemo(()=>uniform(0),[]),layers=terrain?.appearance?.layers;
 const layerTextures=useMemo(()=>makeLayerTextures(layers,images),[layers,images]),mask=useMemo(()=>layerTextures?makeMaskTexture():null,[layerTextures]);
 useEffect(()=>()=>{layerTextures?.dispose();mask?.dispose();},[layerTextures,mask]);
 // Masks follow placements without rebuilding the material.
 useEffect(()=>{if(!mask)return;mask.image.data.set(rasterizeLayerMasks({terrain,placements,paints:images,size:MASK_SIZE}));mask.needsUpdate=true;},[mask,terrain,placements,images]);
 const landscape=useMemo(()=>{
  const lattice=terrain?(runtime?.terrain??createTerrain(terrain)):null,textures=makeDetailTextures();
  if(water)textures.ocean=makeOceanDetailTexture();
  const heightTexture=lattice?makeHeightTexture(lattice):null,baseHeight=terrain?.baseHeight??(water?.level??0)-12,surf=makeSurf(water,terrain,lattice);
  let terrainGeometry=null,terrainMaterial=null,oceanGeometry=null,oceanMaterial=null;
  if(lattice){
   terrainGeometry=new THREE.BufferGeometry();terrainGeometry.setAttribute('position',new THREE.BufferAttribute(lattice.positions,3));terrainGeometry.setAttribute('normal',new THREE.BufferAttribute(lattice.normals,3));terrainGeometry.setIndex(new THREE.BufferAttribute(lattice.indices,1));
   const uv=new Float32Array(lattice.heights.length*2);for(let i=0;i<lattice.heights.length;i++){uv[i*2]=lattice.positions[i*3];uv[i*2+1]=lattice.positions[i*3+2];}terrainGeometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));terrainGeometry.computeBoundingSphere();
   terrainMaterial=makeTerrainMaterial(terrain,water,clock,textures,environment,layerTextures,mask,surf);
  }
  if(water){oceanGeometry=makeOceanGeometry(water);oceanMaterial=makeOceanMaterial(water,lattice,heightTexture,baseHeight,clock,textures,environment,surf);}
  return {terrainGeometry,terrainMaterial,oceanGeometry,oceanMaterial,dispose(){for(const item of [terrainGeometry,terrainMaterial,oceanGeometry,oceanMaterial,heightTexture,textures.detail,textures.normal,textures.ocean,surf?.map])item?.dispose();}};
 },[terrain,water,runtime?.terrain,environment,clock,layerTextures,mask]);
 useEffect(()=>()=>landscape.dispose(),[landscape]);
 useFrame(()=>{clock.value=runtime?.time??0;},-1);
 return <group name="landscape" dispose={null}>
  {landscape.terrainGeometry&&<mesh name="terrain" geometry={landscape.terrainGeometry} material={landscape.terrainMaterial} receiveShadow/>}
  {landscape.oceanGeometry&&<mesh name="ocean" geometry={landscape.oceanGeometry} material={landscape.oceanMaterial} renderOrder={1}/>}
 </group>;
}

// Placed GLB materials that can reach below the water get the same water
// column as the terrain. Each source material is converted once to its node
// equivalent (as the renderer would) with its diffuse colour carried through
// the water at the fragment's own depth. Vertex and instance colours still
// multiply afterwards, as in any node material.
const NODE_MATERIALS={MeshStandardMaterial:THREE.MeshStandardNodeMaterial,MeshPhysicalMaterial:THREE.MeshPhysicalNodeMaterial,MeshBasicMaterial:THREE.MeshBasicNodeMaterial,MeshLambertMaterial:THREE.MeshLambertNodeMaterial,MeshPhongMaterial:THREE.MeshPhongNodeMaterial};
export function createUnderwaterTint(water,environment={}){
 const clock=uniform(0),textures=makeDetailTextures();textures.normal.dispose();
 function material(source){
  let target;
  if(source.isNodeMaterial)target=source.clone();
  else{
   const Class=NODE_MATERIALS[source.type];if(!Class)return null;
   target=new Class();for(const key in source)if(key!=='uuid'&&key!=='_listeners')target[key]=source[key];
  }
  const base=target.colorNode?vec4(target.colorNode):materialColor,p=positionWorld;
  const surface=waveNodes(p.xz,water,clock).height;
  target.colorNode=vec4(waterColumn({dry:base.rgb,bed:base.rgb,p,surface,water,clock,detail:textures.detail,environment}),base.a);
  target.name=source.name;target.needsUpdate=true;return target;
 }
 return {clock,material,dispose(){textures.detail.dispose();}};
}

// Authored sky (H23, see sky.mjs): a gradient from horizonColor (fogColor by
// default) to zenithColor, the sun disc and glow in sunColor, and optional
// cumulus. The water reflects the same gradient, so fog, horizon and water
// agree. Cloud noise follows three.js SkyMesh (MIT): a sine-free lattice
// hash, quintic gradient noise, drifting fbm and Beer-Lambert opacity, lit
// here from the authored colours and the runtime clock.
const skyGradientNode=(sky,elevation)=>mix(color(sky.horizonColor),color(sky.zenithColor),elevation.clamp(0,1).pow(sky.curve));
const cloudGradient=Fn(([i])=>{const p=i.xyx.mul(vec3(.1031,.1030,.0973)).fract().toVar();p.addAssign(dot(p,p.yzx.add(33.33)));return p.xx.add(p.yz).mul(p.zy).fract().mul(2).sub(1);});
const cloudNoise=Fn(([p])=>{
 const i=floor(p),f=p.fract(),u=f.mul(f).mul(f).mul(f.mul(f.mul(6).sub(15)).add(10));
 const a=dot(cloudGradient(i),f),b=dot(cloudGradient(i.add(vec2(1,0))),f.sub(vec2(1,0))),c=dot(cloudGradient(i.add(vec2(0,1))),f.sub(vec2(0,1))),d=dot(cloudGradient(i.add(vec2(1,1))),f.sub(vec2(1,1)));
 return mix(mix(a,b,u.x),mix(c,d,u.x),u.y).mul(1.6);
});
// Four octaves unrolled here rather than a shader loop.
function cloudFbm(position,drift){
 let p=position,result=float(0);
 for(let octave=0;octave<4;octave++){result=result.add(cloudNoise(p).mul(.5**octave));p=p.mul(2).add(drift);}
 return result;
}
function makeSkyMaterial(sky,environment,clock){
 const material=new THREE.MeshBasicNodeMaterial({side:THREE.BackSide,depthWrite:false});material.fog=false;
 // Pin the dome to the far plane, as SkyMesh does, so the camera's far
 // distance never clips it.
 material.vertexNode=Fn(()=>{const position=modelViewProjection;position.z.assign(position.w);return position;})();
 const sun=new THREE.Vector3(...(environment.sunPosition??[-8,14,9])).normalize(),sunColor=color(environment.sunColor??'#fff1d0');
 material.colorNode=Fn(()=>{
  const direction=positionWorld.sub(cameraPosition).normalize(),cosine=dot(direction,vec3(sun.x,sun.y,sun.z)).toVar();
  const base=skyGradientNode(sky,direction.y);
  const disc=smoothstep(.99975,.9999,cosine).mul(8),glow=cosine.max(0).pow(400).mul(.6).add(cosine.max(0).pow(24).mul(.12));
  const result=base.add(sunColor.mul(disc.add(glow).mul(sky.sunDisc))).toVar();
  if(sky.clouds){
   const c=sky.clouds,plane=direction.xz.div(direction.y.mul(1-.9*c.height).max(.02)).mul(1000);
   const q=plane.add(vec2(clock.mul(c.drift[0]),clock.mul(c.drift[1])));
   const field=cloudFbm(q.div(1500*c.scale),clock.mul(.004)).mul(.7).add(.5).clamp(0,1);
   const region=cloudNoise(q.div(5000*c.scale)).mul(.37).add(.5),cover=region.sub(.5).mul(.6).add(c.coverage).clamp(0,1),threshold=cover.oneMinus();
   const horizonFade=smoothstep(0,.03+.06*c.height,direction.y),mask=smoothstep(threshold,threshold.add(.3),field).mul(horizonFade);
   const depth=field.sub(threshold).max(0),beer=exp(depth.mul(-4)),shade=mix(float(.45),float(1),beer.mul(beer.mul(beer).oneMinus()).mul(2.6).clamp(0,1));
   const silver=float(.51).div(float(1.49).sub(cosine.mul(1.4)).pow(1.5)).clamp(0,3),edge=mask.mul(mask.oneMinus()).mul(4);
   const lit=base.mul(.45).add(sunColor.mul(shade.mul(.78))).add(sunColor.mul(silver.mul(edge).mul(.12)));
   // Distant clouds dissolve into the horizon haze.
   const cloud=mix(color(sky.horizonColor),lit,smoothstep(0,.25,direction.y));
   const alpha=exp(depth.mul(-12*c.density)).oneMinus().mul(horizonFade);
   result.assign(mix(result,cloud,alpha));
  }
  return result;
 })();
 return material;
}

export function LandscapeSky({environment={},runtime}){
 const sky=resolveSky(environment);
 return sky?<AuthoredSky sky={sky} environment={environment} runtime={runtime}/>:<AnalyticSky environment={environment}/>;
}
function AuthoredSky({sky,environment,runtime}){
 const clock=useMemo(()=>uniform(0),[]);
 const mesh=useMemo(()=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.5,48,24),makeSkyMaterial(sky,environment,clock));m.scale.setScalar(10000);m.frustumCulled=false;m.renderOrder=-100;m.name='landscape-sky';return m;},[environment,clock]);
 useEffect(()=>()=>{mesh.geometry.dispose();mesh.material.dispose();},[mesh]);
 useFrame(()=>{clock.value=runtime?.time??0;},-1);
 return <primitive object={mesh} dispose={null}/>;
}
function AnalyticSky({environment}){
 const sky=useMemo(()=>{
  const s=new SkyMesh();s.scale.setScalar(10000);s.sunPosition.value.set(...(environment.sunPosition??[-8,14,9]));
  s.turbidity.value=2.2;s.rayleigh.value=1.35;s.mieCoefficient.value=.0035;s.mieDirectionalG.value=.82;
  // The addon models a much brighter sky than this renderer's unit-scale
  // lights (its example uses exposure .05). Calibrate sky radiance locally
  // instead of changing the exposure of terrain, assets and every other world.
  s.material.colorNode=s.material.colorNode.rgb.mul(.045);
  // SkyMesh's optional cloud shader is unnecessary for the clear daylight rig.
  s.cloudCoverage.value=0;s.frustumCulled=false;s.renderOrder=-100;s.name='landscape-sky';
  return s;
 },[environment]);
 useEffect(()=>()=>{sky.geometry.dispose();sky.material.dispose();},[sky]);
 return <primitive object={sky} dispose={null}/>;
}
