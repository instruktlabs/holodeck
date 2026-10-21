import React,{useEffect,useMemo} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import {SkyMesh} from 'three/addons/objects/SkyMesh.js';
import {Fn,cameraPosition,color,cos,float,ivec2,mix,normalMap,normalWorldGeometry,positionLocal,positionWorld,select,sin,smoothstep,texture,textureLoad,uniform,vec2,vec3,vec4} from 'three/tsl';
import {createTerrain} from './terrain.mjs';

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

function makeTerrainMaterial(terrain,water,clock,textures){
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
 material.colorNode=mix(mix(mix(sand,wetSand,wet.mul(.88)),grassColor,grass),rockColor,rock);
 const ripplePhase=p.x.mul(20*scale).add(p.z.mul(7*scale)).add(sin(p.z.mul(1.7*scale)).mul(1.2));
 const rippleFade=ripplePhase.fwidth().mul(.7).clamp(0,1).oneMinus();
 const ripple=cos(ripplePhase).mul(.065).mul(rippleFade).mul(grass.oneMinus()).mul(wet.mul(.6).oneMinus());
 const detailNormal=texture(textures.normal,coords.mul(.85)).xyz;
 material.normalNode=normalMap(detailNormal.add(vec3(ripple,0,0)),vec2(.48));
 material.roughnessNode=mix(float(.96),float(.44),wet).add(rock.mul(.025)).clamp(.4,1);
 return material;
}

function makeOceanMaterial(water,lattice,heightTexture,baseHeight,clock,textures,environment){
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
  const reflected=view.negate().reflect(normal),sky=mix(color(environment.fogColor??'#c5d9dd'),color('#4b88b7'),reflected.y.clamp(0,1).pow(.5));
  const deep=smoothstep(.1,5.5,depth),body=mix(color(water.shallowColor??'#68bcb2'),color(water.color??'#145a70'),deep);
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
  const foam=shoreBand.mul(foamPatches.mul(.55).add(.18)).add(breaking.mul(foamPatches.mul(.5).add(.24))).clamp(0,.9).toVar();
  const waterColor=mix(body.mul(.83).add(body.mul(normal.y.max(0).mul(.17))),reflectedLight,fresnel);
  const foamColor=color('#edf3df').mul(detail.foam.mul(.1).add(.9));
  const result=mix(waterColor,foamColor,foam);
  const alpha=mix(float(.38).add(smoothstep(0,2.8,depth).mul(.6)).add(fresnel.mul(.25)).clamp(0,1),float(.97),foam);
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

export function Landscape({terrain,water,runtime,environment={}}){
 const clock=useMemo(()=>uniform(0),[]);
 const landscape=useMemo(()=>{
  const lattice=terrain?(runtime?.terrain??createTerrain(terrain)):null,textures=makeDetailTextures();
  if(water)textures.ocean=makeOceanDetailTexture();
  const heightTexture=lattice?makeHeightTexture(lattice):null,baseHeight=terrain?.baseHeight??(water?.level??0)-12;
  let terrainGeometry=null,terrainMaterial=null,oceanGeometry=null,oceanMaterial=null;
  if(lattice){
   terrainGeometry=new THREE.BufferGeometry();terrainGeometry.setAttribute('position',new THREE.BufferAttribute(lattice.positions,3));terrainGeometry.setAttribute('normal',new THREE.BufferAttribute(lattice.normals,3));terrainGeometry.setIndex(new THREE.BufferAttribute(lattice.indices,1));
   const uv=new Float32Array(lattice.heights.length*2);for(let i=0;i<lattice.heights.length;i++){uv[i*2]=lattice.positions[i*3];uv[i*2+1]=lattice.positions[i*3+2];}terrainGeometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));terrainGeometry.computeBoundingSphere();
   terrainMaterial=makeTerrainMaterial(terrain,water,clock,textures);
  }
  if(water){oceanGeometry=makeOceanGeometry(water);oceanMaterial=makeOceanMaterial(water,lattice,heightTexture,baseHeight,clock,textures,environment);}
  return {terrainGeometry,terrainMaterial,oceanGeometry,oceanMaterial,dispose(){for(const item of [terrainGeometry,terrainMaterial,oceanGeometry,oceanMaterial,heightTexture,textures.detail,textures.normal,textures.ocean])item?.dispose();}};
 },[terrain,water,runtime?.terrain,environment,clock]);
 useEffect(()=>()=>landscape.dispose(),[landscape]);
 useFrame(()=>{clock.value=runtime?.time??0;},-1);
 return <group name="landscape" dispose={null}>
  {landscape.terrainGeometry&&<mesh name="terrain" geometry={landscape.terrainGeometry} material={landscape.terrainMaterial} receiveShadow/>}
  {landscape.oceanGeometry&&<mesh name="ocean" geometry={landscape.oceanGeometry} material={landscape.oceanMaterial} renderOrder={1}/>}
 </group>;
}

export function LandscapeSky({environment={}}){
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
