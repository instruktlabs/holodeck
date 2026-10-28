import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),require=createRequire(new URL('tools/kiln-1.5.0/package.json',root)),sharp=require('sharp');
const p=JSON.parse(await readFile(new URL('evidence/megascans-packaged.json',root),'utf8'));
const e=JSON.parse(await readFile(new URL('evidence/megascans-editor-game.json',root),'utf8'));
const sources={unrealPackaged:p.captures[2],unrealEditor:e.captures[2],holodeckWebGPU:new URL('evidence/megascans-holodeck-webgpu-open.png',root),holodeckWebGL:new URL('evidence/megascans-holodeck-webgl-open.png',root)};
const regions={lid:{left:685,top:125,width:24,height:24},front:{left:515,top:390,width:20,height:20},interior:{left:705,top:310,width:20,height:20}},results={};
for(const [name,path] of Object.entries(sources)){
 results[name]={};const input=await readFile(path);
 for(const [key,r] of Object.entries(regions)){
  // stats() reads its input; materialize the crop in memory before measuring.
  const pixels=await sharp(input).extract(r).raw().toBuffer({resolveWithObject:true});
  const s=await sharp(pixels.data,{raw:pixels.info}).stats();
  results[name][key]=s.channels.slice(0,3).map(c=>Number(c.mean.toFixed(2)));
 }
}
const receipt={regions,results,limits:['Display-encoded RGB patch means, not BRDF or perceptual error metrics.','Camera framing is visually aligned; environments and reflection/tonemapping pipelines differ.','Do not alter albedo to compensate for unresolved lighting differences.']};
await writeFile(new URL('evidence/megascans-render-patch-comparison.json',root),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
