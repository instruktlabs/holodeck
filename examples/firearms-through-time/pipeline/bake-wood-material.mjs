import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {openProvenanceDocument} from './local-material-provenance.mjs';
import {performance} from 'node:perf_hooks';
import {createMaterialRecordV1,createMaterialLibraryPayload} from '../tools/kiln-1.5.0/node_modules/@instruktlabs/kiln/lib/material-library-node.js';
const root=new URL('../',import.meta.url),[config='materials/procedural-wood/dry.json',name='dry']=process.argv.slice(2);
if(!/^[a-z][a-z0-9-]{0,47}$/.test(name))throw Error('Use a bounded lowercase output name');
const require=createRequire(new URL('tools/kiln-1.5.0/package.json',root)),sharp=require('sharp'),sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const input=JSON.parse(await readFile(new URL(config,root),'utf8')),dir=new URL('materials/procedural-wood/'+name+'/',root);
const recipePath=input.version===2?'wood-natural-recipe.mjs':'wood-recipe.mjs', {bake,VERSION}=await import('./'+recipePath);
const provenance=await openProvenanceDocument(),provenanceUrl=provenance.url;
try {
await mkdir(dir);
const start=performance.now(),out=bake(input),bakeMs=performance.now()-start,source=await readFile(new URL('pipeline/'+recipePath,root));
const parameters=Buffer.from(JSON.stringify(out.parameters,null,2)+'\n');await writeFile(new URL('recipe.mjs',dir),source);await writeFile(new URL('parameters.json',dir),parameters);
const maps=[],originalFiles=[{name:'recipe.mjs',sha256:sha(source),bytes:source.length},{name:'parameters.json',sha256:sha(parameters),bytes:parameters.length}];
if(out.atlas){const bytes=Buffer.from(JSON.stringify(out.atlas,null,2));await writeFile(new URL('atlas.json',dir),bytes);originalFiles.push({name:'atlas.json',sha256:sha(bytes),bytes:bytes.length});}
for(const slot of ['baseColor','normal','metallicRoughness']){
 const bytes=await sharp(out[slot],{raw:{width:out.width??out.parameters.size,height:out.height??out.parameters.size,channels:3}}).png().toBuffer(),file=slot+'.png';await writeFile(new URL(file,dir),bytes);
 originalFiles.push({name:file,sha256:sha(bytes),bytes:bytes.length});maps.push({slot,sourceId:'original-wood-recipe',originalFile:file,bytes,transforms:[{operation:'periodic-field-bake',tool:'kiln-optional-wood-prototype',version:VERSION,parameters:{recipeSha256:sha(source),parametersSha256:sha(parameters),seed:out.parameters.seed}}],...(slot==='normal'?{normalConvention:'opengl'}:{}),...(slot==='metallicRoughness'?{channelPacking:'r-occlusion-g-roughness-b-metallic'}:{})});
 if(slot==='metallicRoughness')maps.push({...maps.at(-1),slot:'occlusion'});
}
const record=await createMaterialRecordV1({materialId:'procedural-wood-'+name,name:'Procedural wood '+name,tags:['wood','procedural','original','prototype'],tileable:!out.atlas,...(out.atlas?{}:{physicalSizeMeters:{width:out.parameters.tileMeters,height:out.parameters.tileMeters}}),parameters:{baseColor:0xffffff,roughness:1,metalness:1},sources:[{id:'original-wood-recipe',kind:'external',provider:'Local procedural wood baker (outside the bounded Kiln recipe DSL)',creator:'Local authored recipe',assetUrl:provenanceUrl,license:{spdx:'LicenseRef-Local-Unpublished',url:provenanceUrl,attribution:'Original deterministic recipe; unpublished local prototype'},originalFiles}],maps});
await writeFile(new URL('material-payload.json',dir),JSON.stringify(await createMaterialLibraryPayload([record])));
const pins=[{resourceId:record.manifest.materialId,revisionId:record.manifest.revisionId,sha256:record.manifest.revisionId}];await writeFile(new URL('pins.json',dir),JSON.stringify(pins,null,2));
const run=async args=>{const r=await promisify(execFile)(process.execPath,[fileURLToPath(new URL('authoring/kiln.mjs',root)),...args],{cwd:fileURLToPath(root),windowsHide:true,encoding:'utf8',maxBuffer:20*1024*1024,timeout:120000});return JSON.parse(r.stdout);};
await run(['material','import','--file',fileURLToPath(new URL('material-payload.json',dir)),'--json']);const material=await run(['material','get',record.manifest.materialId,record.manifest.revisionId,'--json']);await writeFile(new URL('material.json',dir),JSON.stringify(material,null,2));
const receipt={ok:true,name,recipeVersion:VERSION,parameters:out.parameters,recipeSha256:sha(source),parametersSha256:sha(parameters),bakeMs,totalMs:performance.now()-start,maxSlope:out.maxSlope,originalFiles,pins,portableSpec:material.portableSpec,backend:'CPU texture synthesis; GPU destination rendering is qualified separately',provenance:{url:provenanceUrl,startedByThisRun:provenance.owned},inputImages:[]};await writeFile(new URL('receipt.json',dir),JSON.stringify(receipt,null,2));console.log(JSON.stringify({name,bakeMs:Math.round(bakeMs),totalMs:Math.round(receipt.totalMs),revision:record.manifest.revisionId}));
} finally { await provenance.close(); }

