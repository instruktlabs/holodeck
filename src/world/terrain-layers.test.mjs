import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {validateTerrainLayers,validateTerrainLayerReferences,bandWeight,slopeDegrees,surfaceMask,pngInfo,checkTerrainTextures,terrainTextureFiles,rasterizeLayerMasks,renameTerrainTextures,TERRAIN_LAYER_LIMITS} from './terrain-layers.mjs';
import {validateTerrain} from './terrain.mjs';

// A minimal RGBA PNG encoder for fixtures.
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=bytes=>{let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const chunk=(type,data)=>{const out=Buffer.alloc(12+data.length);out.writeUInt32BE(data.length,0);out.write(type,4,'latin1');data.copy(out,8);out.writeUInt32BE(crc(out.subarray(4,8+data.length)),8+data.length);return out;};
export function png(width,height,pixel=()=>[128,128,128,255]){
 const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 const raw=Buffer.alloc((width*4+1)*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)Buffer.from(pixel(x,y)).copy(raw,y*(width*4+1)+1+x*4);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const layer=extra=>({id:'sand',maps:{albedo:'assets/imports/terrain/sand-albedo.png',normal:'assets/imports/terrain/sand-normal.png'},...extra});
const terrain=layers=>({type:'heightfield',bounds:[-10,10,-10,10],segments:[8,8],baseHeight:0,stamps:[],appearance:{layers}});

test('layer records are strict, bounded and name PNG files inside assets/imports',()=>{
 validateTerrain(terrain([layer({scale:2,projection:'triplanar',strength:.5,tint:'#ffeedd',mask:{height:[0,3,.5],slope:[0,30,5],water:[.2,9,.4],near:{assets:['palm'],scatters:['grove'],radius:4,fade:2},paint:'assets/imports/terrain/grove.png'}})]));
 const bad=(value,pattern)=>assert.throws(()=>validateTerrainLayers(value),pattern);
 bad(Array.from({length:5},(_,i)=>layer({id:`l${i}`})),/at most 4 layers/);
 bad([layer(),layer()],/duplicate terrain layer ID/);
 bad([layer({maps:{albedo:'assets/imports/terrain/sand.jpg',normal:'assets/imports/n.png'}})],/albedo PNG/);
 bad([layer({maps:{albedo:'assets/imports/../secret.png',normal:'assets/imports/n.png'}})],/albedo PNG/);
 bad([layer({maps:{albedo:'assets/imports/a.png'}})],/normal PNG/);
 bad([layer({scale:0})],/scale/);
 bad([layer({projection:'cubic'})],/planar or triplanar/);
 bad([layer({mask:{height:[3,1,0]}})],/minimum exceeds maximum/);
 bad([layer({mask:{slope:[0,95,0]}})],/slope mask/);
 bad([layer({mask:{near:{radius:3}}})],/assets or scatters/);
 bad([layer({mask:{near:{assets:[],radius:3}}})],/near assets/);
 bad([layer({mask:{paint:'references/files/a.png'}})],/paint mask/);
 bad([layer({extra:1})],/Invalid terrain layer fields/);
 assert.throws(()=>validateTerrain({...terrain([]),appearance:{layers:[layer({mask:{height:[0,1]}})]}}),/\[min,max,fade\]/);
});

test('layer references need their assets, scatters and water',()=>{
 const scene=mask=>({assets:[{id:'palm'}],scatters:[{id:'grove'}],terrain:terrain([layer({mask})])});
 validateTerrainLayerReferences(scene({near:{assets:['palm'],scatters:['grove'],radius:2}}));
 assert.throws(()=>validateTerrainLayerReferences(scene({near:{assets:['fern'],radius:2}})),/missing asset fern/);
 assert.throws(()=>validateTerrainLayerReferences(scene({near:{scatters:['rocks'],radius:2}})),/missing scatter rocks/);
 assert.throws(()=>validateTerrainLayerReferences(scene({water:[0,1,0]})),/requires scene.water/);
 validateTerrainLayerReferences({...scene({water:[0,1,0]}),water:{level:0}});
});

test('mask bands are 1 inside the range and fade smoothly outside it',()=>{
 const b=[1,3,.5];
 assert.equal(bandWeight(2,b),1);assert.equal(bandWeight(1,b),1);assert.equal(bandWeight(3,b),1);
 assert.equal(bandWeight(.5,b),0);assert.equal(bandWeight(3.5,b),0);assert.equal(bandWeight(.75,b),.5);assert.equal(bandWeight(3.25,b),.5);
 assert.equal(bandWeight(.99,[1,3,0]),0);assert.equal(bandWeight(1,[1,3,0]),1);
 assert.ok(Math.abs(slopeDegrees(Math.cos(Math.PI/6))-30)<1e-9);
 const l=layer({strength:.8,mask:{height:[0,4,1],slope:[0,20,10],water:[.5,99,.5]}});
 assert.equal(surfaceMask(l,{height:2,normalY:1,waterLevel:0}),.8);
 assert.ok(Math.abs(surfaceMask(l,{height:2,normalY:Math.cos(25*Math.PI/180),waterLevel:0})-.4)<1e-9);
 assert.equal(surfaceMask(l,{height:.25,normalY:1,waterLevel:0}),.4);
});

test('PNG admission reads the header and layer maps share one power-of-two size',()=>{
 assert.deepEqual(pngInfo(png(4,4)),{width:4,height:4});
 assert.throws(()=>pngInfo(Buffer.from('not a png at all, definitely not a png')),/not a PNG/);
 const big=png(1,1);big.writeUInt32BE(TERRAIN_LAYER_LIMITS.mapSize+1,16);assert.throws(()=>pngInfo(big),/limited to 2048/);
 const t=terrain([layer({maps:{albedo:'assets/imports/a.png',normal:'assets/imports/n.png',roughness:'assets/imports/a.png'},mask:{paint:'assets/imports/paint.png'}})]);
 assert.deepEqual([...terrainTextureFiles(t)],[['assets/imports/a.png','map'],['assets/imports/n.png','map'],['assets/imports/paint.png','paint']]);
 const info=(width,bytes=100)=>({width,height:width,bytes});
 assert.deepEqual(checkTerrainTextures(t,{'assets/imports/a.png':info(256),'assets/imports/n.png':info(256),'assets/imports/paint.png':info(300)}),{size:256,bytes:300});
 assert.throws(()=>checkTerrainTextures(t,{'assets/imports/a.png':info(256),'assets/imports/n.png':info(128),'assets/imports/paint.png':info(64)}),/share one size/);
 assert.throws(()=>checkTerrainTextures(t,{'assets/imports/a.png':info(300),'assets/imports/n.png':info(300),'assets/imports/paint.png':info(64)}),/power-of-two/);
 assert.throws(()=>checkTerrainTextures(t,{'assets/imports/a.png':info(256,20e6),'assets/imports/n.png':info(256,20e6),'assets/imports/paint.png':info(64)}),/32 MiB/);
 assert.throws(()=>checkTerrainTextures(t,{'assets/imports/a.png':info(256)}),/missing/);
});

test('near masks follow placements and scatter instances; paint masks multiply in, row 0 at zmin',()=>{
 const layers=[
  layer({id:'litter',mask:{near:{scatters:['grove'],radius:2,fade:2}}}),
  layer({id:'rock'}),
  layer({id:'paint',mask:{paint:'assets/imports/p.png'}}),
  layer({id:'both',mask:{near:{assets:['hut'],radius:3},paint:'assets/imports/p.png'}}),
 ];
 const t=terrain(layers),size=20,placements=[{id:'grove#0',asset:'palm',scatter:'grove',position:[0,1,0]},{id:'hut',asset:'hut',position:[-5,0,-5]},{id:'other',asset:'palm',position:[5,0,5]}];
 // Paint: white on the half of the image nearest zmin (rows 0..1 of 4), black elsewhere.
 const paint={width:4,height:4,data:new Uint8Array(64).map((_,i)=>i%4===3?255:Math.floor(i/16)<2?255:0)};
 const data=rasterizeLayerMasks({terrain:t,placements,paints:{'assets/imports/p.png':paint},size});
 const at=(x,z,channel)=>data[(Math.floor((z+10)/20*size)*size+Math.floor((x+10)/20*size))*4+channel];
 assert.equal(at(.5,.5,0),255);assert.equal(at(1.5,.5,0),255);assert.ok(at(3.5,.5,0)>0&&at(3.5,.5,0)<255);assert.equal(at(4.6,.5,0),0);
 assert.equal(at(5.5,5.5,0),0,'an unlisted placement leaves no litter');
 for(const [x,z] of [[0,0],[9,9],[-9,-9]])assert.equal(at(x,z,1),255,'a layer without near or paint is unmasked');
 assert.equal(at(-9.5,-9.5,2),255);assert.equal(at(-9.5,9.5,2),0);
 assert.equal(at(-5.5,-5.5,3),255);assert.equal(at(5.5,5.5,3),0);assert.equal(at(-5.5,5.5,3),0);
});

test('renaming terrain textures copies the record and rewrites every map and paint path',()=>{
 const t=terrain([layer({maps:{albedo:'assets/imports/a.png',normal:'assets/imports/n.png'},mask:{paint:'assets/imports/p.png'}})]),before=structuredClone(t);
 const renamed=renameTerrainTextures(t,file=>file.replace('assets/imports/','assets/imports/terrain/x-'));
 assert.deepEqual(t,before);
 assert.deepEqual(renamed.appearance.layers[0].maps,{albedo:'assets/imports/terrain/x-a.png',normal:'assets/imports/terrain/x-n.png'});
 assert.equal(renamed.appearance.layers[0].mask.paint,'assets/imports/terrain/x-p.png');
 assert.equal(renameTerrainTextures({type:'heightfield'},()=>'x').type,'heightfield');
});
