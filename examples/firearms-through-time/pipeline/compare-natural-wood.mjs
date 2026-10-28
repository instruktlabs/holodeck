// Diagnostic screenshot crops; no color correction or resampling.
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),require=createRequire(new URL('tools/kiln-1.5.0/package.json',root)),sharp=require('sharp');
const read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const resident=await read('evidence/natural-wood-editor-game-full-residency.json');
const sources={unreal:resident.captures[2],holodeck:new URL('evidence/natural-wood-holodeck-case-open.png',root)};
const metrics=[];
for(const [i,material] of ['scan','dry','lower-roughness'].entries()){
 const rect={left:380+i*200,top:360,width:120,height:150},means={};
 for(const [engine,file] of Object.entries({unreal:'calibration-native-wood-light-flat-normal-compiled.png',holodeck:'wood-light-no-normal-holodeck.png'})){
  const pixels=await sharp(await readFile(new URL('evidence/'+file,root))).extract(rect).raw().toBuffer({resolveWithObject:true});
  const stats=await sharp(pixels.data,{raw:pixels.info}).stats();means[engine]=stats.channels.slice(0,3).map(c=>Number(c.mean.toFixed(2)));
 }
 metrics.push({material,rect,...means,unrealMinusHolodeck:means.unreal.map((n,j)=>Number((n-means.holodeck[j]).toFixed(2)))});
}
const inputs=[],crop={left:430,top:25,width:490,height:550};
for(const [i,[name,path]] of Object.entries(sources).entries()){
 inputs.push({input:await sharp(await readFile(path)).extract(crop).png().toBuffer(),left:i*510,top:42});
 inputs.push({input:Buffer.from(`<svg width="490" height="32"><text x="14" y="24" fill="white" font-family="Segoe UI,Arial" font-size="20">${name==='unreal'?'Unreal · full texture residency':'Holodeck · WebGPU'}</text></svg>`),left:i*510,top:3});
}
await sharp({create:{width:1000,height:600,channels:3,background:'#20262c'}}).composite(inputs).png().toFile(new URL('evidence/natural-wood-engine-comparison.png',root).pathname.replace(/^\/(.:)/,'$1'));
const result={checkedAt:new Date().toISOString(),caseSources:Object.fromEntries(Object.entries(sources).map(([k,v])=>[k,String(v)])),flatNormalMetrics:metrics,controls:{unrealNormalScale:0,holodeckNormalMap:'absent',unrealLightSourceAngle:0,lightIntensity:1,ambient:0},conclusion:'The smoother frontal highlight remains brighter in Unreal with flat normals and zero light angular size; those features do not explain the whole mismatch.',limits:['Display-encoded RGB means, not a perceptual score or BRDF equivalence.','Two controls changed relative to the old baseline; individual contributions are not estimated.','Case full-residency capture proves a streaming-dependent loss of detail, not a production streaming budget fix.','Source maps are unchanged; backgrounds/shadow pipelines differ.']};
await writeFile(new URL('evidence/natural-wood-render-comparison.json',root),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
