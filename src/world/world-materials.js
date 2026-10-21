import React,{createContext,useContext,useEffect,useMemo} from 'react';
import * as THREE from 'three/webgpu';
import {attribute,cameraPosition,color,dFdx,dFdy,normalMap,normalWorldGeometry,positionLocal,positionWorld,select,sin,texture,time,uv,varying,vec2,vec3} from 'three/tsl';

// Original, deterministic textures. One atlas supplies stone, timber and soil;
// no network fetches or source-game assets participate in this visual fixture.
const fract=n=>n-Math.floor(n);
const hash=(x,y)=>fract(Math.sin(x*127.1+y*311.7)*43758.5453);
function noise(x,y){const a=Math.floor(x),b=Math.floor(y),u=fract(x),v=fract(y),s=u*u*(3-2*u),t=v*v*(3-2*v);return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(a,b),hash(a+1,b),s),THREE.MathUtils.lerp(hash(a,b+1),hash(a+1,b+1),s),t);}
function canvas(size){const c=document.createElement('canvas');c.width=c.height=size;return c;}
function canvasTexture(c,srgb=false){const t=new THREE.CanvasTexture(c);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}

function surfaceAtlas(){
 const tile=256,size=tile*2,albedo=canvas(size),normal=canvas(size),ac=albedo.getContext('2d'),nc=normal.getContext('2d'),ai=ac.createImageData(size,size),ni=nc.createImageData(size,size);
 // Each octave wraps its lattice. Both albedo and height derivatives meet
 // at tile boundaries; grout belongs in authored geometry.
 const periodic=(u,v,period,seed)=>{
  const x=u*period,y=v*period,a=Math.floor(x),b=Math.floor(y),s=fract(x)**2*(3-2*fract(x)),t=fract(y)**2*(3-2*fract(y));
  const sample=(i,j)=>hash(((i%period)+period)%period+seed,((j%period)+period)%period);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(sample(a,b),sample(a+1,b),s),THREE.MathUtils.lerp(sample(a,b+1),sample(a+1,b+1),s),t);
 };
 for(let role=0;role<4;role++){
  const heights=new Float32Array(tile*tile),shades=new Float32Array(tile*tile);
  for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){
   const u=x/tile,v=y/tile,fine=periodic(u,v,64,role*333),n=periodic(u,v,16,role*333),broad=periodic(u,v,4,role*333);
   let h=n*.2+fine*.08,shade=.84+broad*.08+n*.05;
   if(role===0){
    // Limestone grain does not draw a fake square masonry grid onto every
    // wall, path, and rounded stone surface.
    const pores=Math.max(0,fine-.72)*.25;
    shade=.86+broad*.075+n*.045-pores;h=n*.13+fine*.045-pores*.2;
   }else if(role===1){
    const grain=.5+.5*Math.sin(u*Math.PI*2*28+periodic(u,v,4,17)*7),groove=Math.pow(grain,8);
    shade=.66+broad*.2+grain*.12;h=grain*.24+groove*.25+n*.12;
   }else if(role===2){
    // Keep local soil grain fine and low-contrast. Broad colour variation
    // comes from continuous world coordinates, never the repeating tile.
    const pebble=Math.max(0,fine-.76)*.65;shade=.84+n*.055+(fine-.5)*.045+pebble*.2;h=n*.15+fine*.12+pebble*.2;
   }
   heights[y*tile+x]=h;shades[y*tile+x]=shade;
  }
  for(let y=0;y<tile;y++)for(let x=0;x<tile;x++){
   const i=y*tile+x,d=((y+Math.floor(role/2)*tile)*size+x+(role%2)*tile)*4,shade=shades[i];
   ai.data.set([255*shade,252*shade,244*shade,255],d);
   const dx=(heights[y*tile+(x+tile-1)%tile]-heights[y*tile+(x+1)%tile])*1.7,dy=(heights[((y+tile-1)%tile)*tile+x]-heights[((y+1)%tile)*tile+x])*1.7,n=new THREE.Vector3(dx,dy,1).normalize();
   ni.data.set([(n.x*.5+.5)*255,(n.y*.5+.5)*255,(n.z*.5+.5)*255,255],d);
  }
 }
 ac.putImageData(ai,0,0);nc.putImageData(ni,0,0);
 return {albedo:canvasTexture(albedo,true),normal:canvasTexture(normal)};
}

function foliageAtlas(){
 const c=canvas(512),ctx=c.getContext('2d');
 for(let tile=0;tile<4;tile++){
  const ox=(tile%2)*256,oy=Math.floor(tile/2)*256;
  ctx.save();ctx.translate(ox+128,oy+226);ctx.strokeStyle='#68743e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-8,-60,9,-120,-3,-193);ctx.stroke();
  for(let i=0;i<9;i++){
   const side=i%2?1:-1,y=-18-i*19,x=(i<7?37:20)*side,angle=side*(.7+(tile*.13)),length=40+(i%3)*9;
   ctx.save();ctx.translate(x*.45,y);ctx.rotate(angle);const g=ctx.createLinearGradient(-18,0,18,-length);g.addColorStop(0,'#74883d');g.addColorStop(.45,['#b6bd6b','#a8b968','#c2c77a','#9cae5d'][tile]);g.addColorStop(1,'#d2d58a');ctx.fillStyle=g;
   ctx.beginPath();ctx.moveTo(0,8);ctx.bezierCurveTo(-22,-8,-20,-length*.65,0,-length);ctx.bezierCurveTo(18,-length*.65,19,-8,0,8);ctx.fill();
   ctx.strokeStyle='rgba(70,88,39,.48)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,7);ctx.lineTo(0,-length+3);ctx.stroke();ctx.restore();
  }
  ctx.restore();
 }
 return canvasTexture(c,true);
}

function projectedUv(tile,density){
 const p=positionWorld.mul(density),n=normalWorldGeometry.abs();
 const flat=select(n.y.greaterThan(.6),p.xz,select(n.x.greaterThan(n.z),p.zy,p.xy));
 // World coordinates keep neighboring modules continuous; the inset keeps
 // each atlas role isolated at ordinary mip levels.
 // Derivatives must be taken before fract(). At a repeat boundary the
 // wrapped UV jumps a full tile; implicit derivatives choose a coarse mip
 // there and reveal a bright square grid even when the pixels are seamless.
 return {uv:flat.fract().mul(.492).add(vec2((tile%2)*.5+.004,.5-Math.floor(tile/2)*.5+.004)),dx:dFdx(flat).mul(.492),dy:dFdy(flat).mul(.492)};
}

function createResources(){
 const atlas=surfaceAtlas(),leaves=foliageAtlas(),materials=new Map();
 return {
  surface(surface,tint){
   const key=`${surface}:${tint}`;if(materials.has(key))return materials.get(key);
   const material=new THREE.MeshStandardNodeMaterial({color:tint,roughness:.92});
   if(surface==='water'){
    const p=positionWorld,phase=time.mul(.65);
    const wave=sin(p.x.mul(8).add(p.z.mul(4)).add(phase)).mul(.18).add(sin(p.x.mul(17).sub(phase.mul(1.4))).mul(.045));
    const cross=sin(p.z.mul(10).sub(p.x.mul(3)).sub(phase.mul(.8))).mul(.15);
    const facing=cameraPosition.sub(p).normalize().dot(normalWorldGeometry).abs().clamp(0,1),fresnel=facing.oneMinus().pow(3);
    const edge=positionLocal.xz.length().mul(2).clamp(0,1),depth=edge.mul(.22).add(.64);
    const caustic=sin(p.x.mul(17).add(sin(p.z.mul(9).sub(phase)))).mul(sin(p.z.mul(15).sub(phase))).abs().pow(9).mul(.12);
    material.normalNode=normalMap(vec3(wave,cross,1).mul(.5).add(.5),vec2(.7));material.roughness=.12;material.metalness=.22;
    // Bounded sky tint and moving pool light provide water cues without
    // screen-space reflection, refraction, or an additional render pass.
    material.colorNode=color(tint).mul(depth).add(color('#bfd7cf').mul(fresnel.mul(.55))).add(color('#acd8c5').mul(caustic));
    material.emissiveNode=color('#a6cbc4').mul(fresnel.mul(.12).add(caustic.mul(.07)));
   }else{
    const tile={stone:0,wood:1,soil:2}[surface]??3,density=surface==='wood'?1.2:surface==='soil'?.7:.48;
    const coords=projectedUv(tile,density),second=projectedUv(tile,density*1.731);
    const blend=texture(atlas.albedo,coords.uv).grad(coords.dx,coords.dy).rgb.mul(.68).add(texture(atlas.albedo,second.uv).grad(second.dx,second.dy).rgb.mul(.32));
    const p=positionWorld,variation=sin(p.x.mul(.21).add(p.z.mul(.13))).mul(.045).add(sin(p.x.mul(.071).sub(p.z.mul(.19))).mul(.035)).add(.94);
    material.colorNode=blend.mul(color(tint)).mul(variation);material.normalNode=normalMap(texture(atlas.normal,coords.uv).grad(coords.dx,coords.dy).rgb,vec2(surface==='wood'?.35:surface==='soil'?.18:.14));
   }
   materials.set(key,material);return material;
  },
  foliage(tint){
   const key=`foliage:${tint}`;if(materials.has(key))return materials.get(key);
   const material=new THREE.MeshStandardNodeMaterial({side:THREE.DoubleSide,alphaTest:.5,roughness:.85});
   // Tile identity is discrete. Perspective-interpolating 2.0 can produce
   // 1.999999 at fragments: floor/mod then select a different atlas tile,
   // turning an entire card into flickering speckles. Keep the ID flat.
   const tile=varying(attribute('leafTile','float')).setInterpolation(THREE.InterpolationSamplingType.FLAT,THREE.InterpolationSamplingMode.EITHER);
   const coords=uv().mul(.492).add(vec2(tile.mod(2).mul(.5).add(.004),tile.div(2).floor().mul(.5).add(.004))),sample=texture(leaves,coords);
   material.colorNode=sample.rgb.mul(color(tint));material.opacityNode=sample.a;
   // positionLocal already contains the leaf instance transform. Wind is
   // evaluated in both visible and shadow passes by the node material.
   const phase=attribute('leafPhase','float'),height=positionLocal.y.add(.5).clamp(0,1),sway=sin(time.mul(.75).add(phase)).mul(.009),flutter=sin(time.mul(2.8).add(phase.mul(3))).mul(.003);
   material.positionNode=positionLocal.add(vec3(sway,flutter,sway.mul(.6)).mul(height));
   materials.set(key,material);return material;
  },
  dispose(){for(const m of materials.values())m.dispose();materials.clear();atlas.albedo.dispose();atlas.normal.dispose();leaves.dispose();}
 };
}

const Context=createContext(null);
export function WorldMaterialsProvider({children}){const resources=useMemo(createResources,[]);useEffect(()=>()=>resources.dispose(),[resources]);return React.createElement(Context.Provider,{value:resources},children);}
export function useWorldMaterialResources(){const resources=useContext(Context);if(!resources)throw new Error('World visual materials require WorldMaterialsProvider');return resources;}
export function WorldSurfaceMaterial({surface='stone',color: tint='#ffffff'}){const resources=useWorldMaterialResources();return React.createElement('primitive',{object:resources.surface(surface,tint),attach:'material',dispose:null});}
