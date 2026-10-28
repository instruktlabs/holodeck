import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse(await readFile(new URL(p,root),'utf8')),require=createRequire(new URL('tools/kiln-1.5.0/package.json',root)),sharp=require('sharp');
const metrics=[],composites=[];
for(const [lightIndex,light] of ['frontal','raking'].entries()){
 const stats={};
 for(const [engineIndex,engine] of ['unreal','holodeck'].entries()){
  const path=fileURLToPath(new URL('evidence/'+(engine==='unreal'?'calibration-native-procedural-wood-':'procedural-wood-holodeck-')+light+'.png',root));
  stats[engine]=[];
  for(let i=0;i<3;i++){
   const rect={left:380+200*i,top:360,width:120,height:150};
   const crop=await sharp(path).extract(rect).toBuffer();
   stats[engine].push({rect,meanRgb:(await sharp(crop).stats()).channels.slice(0,3).map(c=>Number(c.mean.toFixed(2)))});
  }
  const title=(engine==='unreal'?'Unreal 5.8.4':'Holodeck WebGPU')+' / '+light+' light';
  const label=Buffer.from('<svg width="640" height="50"><rect width="640" height="50" fill="#17201a"/><text x="20" y="23" fill="#eff5ea" font-size="19" font-family="Segoe UI">'+title+'</text><text x="20" y="43" fill="#c9d0c5" font-size="14" font-family="Segoe UI">Left: scanned reference | Middle: generated dry | Right: lower roughness</text></svg>');
  composites.push({input:label,left:engineIndex*640,top:lightIndex*300},{input:await sharp(path).extract({left:320,top:310,width:640,height:250}).toBuffer(),left:engineIndex*640,top:lightIndex*300+50});
 }
 for(const [i,material] of ['reference-scan','procedural-dry','procedural-low-roughness'].entries())metrics.push({light,material,rect:stats.unreal[i].rect,unreal:stats.unreal[i].meanRgb,holodeck:stats.holodeck[i].meanRgb,unrealMinusHolodeck:stats.unreal[i].meanRgb.map((n,j)=>Number((n-stats.holodeck[i].meanRgb[j]).toFixed(2)))});
}
await sharp({create:{width:1280,height:600,channels:3,background:'#17201a'}}).composite(composites).png().toFile(fileURLToPath(new URL('evidence/procedural-wood-engine-comparison.png',root)));
await writeFile(new URL('evidence/procedural-wood-capture-comparison.json',root),JSON.stringify({scope:'Fixed camera and light directions. Interior patch mean RGB in screenshot code values; not a perceptual error, BRDF equivalence, or performance score. Source pixels and runtime state are verified separately.',metrics},null,2));
const caseSave=await read('evidence/procedural-wood-case-saved.json'),labSave=await read('evidence/procedural-wood-comparison-saved.json'),delivery=await read('evidence/procedural-wood-delivery-check.json'),native=await read('evidence/procedural-wood-editor-game.json');
assert(delivery.ok&&native.status==='passed');
const variants=[];
for(const name of ['dry-v3','oiled-v3']){const receipt=await read('materials/procedural-wood/'+name+'/receipt.json');variants.push({id:name,label:name==='dry-v3'?'Dry wood':'Lower roughness wood (not a coating model)',config:name==='dry-v3'?'dry.json':'oiled.json',delivery:name+'/receipt.json',pin:receipt.pins[0],parameters:receipt.parameters});}
await writeFile(new URL('materials/procedural-wood/recipes.json',root),JSON.stringify({schemaVersion:1,status:'local prototype; not a published extension',recipes:[{id:'original-long-grain-wood',version:'0.1.0',source:'../../pipeline/wood-recipe.mjs',baker:'../../pipeline/bake-wood-material.mjs',inspiredByCatalogIds:['polyhaven-fine_grained_wood'],inputImages:[],license:'LicenseRef-Local-Unpublished',parameters:'See dry.json and oiled.json; normalize() validates bounds and rejects unknown fields.',variants,qualification:{report:'../../docs/procedural-wood-results.md',case:{assetId:caseSave.asset.assetId,revisionId:caseSave.asset.revisionId},swatch:{assetId:labSave.asset.assetId,revisionId:labSave.asset.revisionId}},limits:['Long grain only; no dedicated end grain or knots','Broad regular growth lines remain visible','No native anisotropic or clearcoat shader','Mip distance sweep and packaged revision test pending']} ]},null,2)+'\n');
const catalog=await read('materials/catalog.json');
await mkdir(new URL('materials/catalog-backups/',root),{recursive:true});await copyFile(new URL('materials/catalog.json',root),new URL('materials/catalog-backups/'+Date.now()+'-before-procedural-wood.json',root));
const reference=catalog.entries.find(e=>e.id==='polyhaven-fine_grained_wood');
reference.proceduralInspiration.status='implemented';
reference.proceduralInspiration.notes='Original bounded long-grain prototype implemented and compared in both engines. Uses no scan pixels. See the separate recipe index for actual controls, limits and evidence; the source scan retains its existing pins and qualification.';
reference.extensions={...reference.extensions,proceduralRecipe:{index:'procedural-wood/recipes.json',recipeId:'original-long-grain-wood',report:'../docs/procedural-wood-results.md'}};
await writeFile(new URL('materials/catalog.json',root),JSON.stringify(catalog,null,2)+'\n');
const ledger=await read('evidence/integration-learning-ledger.json');
const entry={id:'PROCEDURAL-WOOD-001',topic:'original recipes and cross-engine material qualification',status:'observed-pass-limited',question:'Can one deterministic wood recipe update the interactive case in both engines while preserving native overrides?',context:{kiln:'1.5.0',unreal:'5.8.4-58902052',recipeVersion:'0.1.0',caseRevision:caseSave.asset.revisionId},observed:'1K original color/normal/ORM bakes; same-seed checks pass. Geometry and UVs unchanged. 14 native source-image checks and both Holodeck deliveries pass. Nine native editor-game interaction checks pass. Holodeck paused state survived and resumed. Frontal and grazing captures reviewed; low-roughness highlight mismatch remains.',decision:'Keep generator and portable material record engine-agnostic; opt-in destination adapters own binding repair, compression profiles, runtime checks and native overrides. Retain recipe separately from scanned references.',evidence:['docs/procedural-wood-results.md','evidence/procedural-wood-delivery-check.json','evidence/procedural-wood-recipe-tests.json','evidence/procedural-wood-engine-comparison.png','evidence/procedural-wood-editor-game.json'],failureMechanism:'Custom bakes are external map resources in the current Kiln schema. Local source URLs need a bounded provenance server. Cold Unreal startup/shutdown exceeded prior harness timeout. None required changing the asset interaction.',limits:['Regular grain remains an aesthetic limitation','Source PNG parity does not prove GPU compressed parity','No fresh packaged test for this revision','No dedicated end grain, knots or distance mip sweep'],nextTest:'Reduce regular growth bands, add a dedicated end-grain recipe and compare a bevelled board at near/far distances before publishing an extension.'};
assert(!ledger.entries.some(e=>e.id===entry.id),'Result already recorded; do not overwrite history');ledger.entries.push(entry);await writeFile(new URL('evidence/integration-learning-ledger.json',root),JSON.stringify(ledger,null,2)+'\n');
console.log(JSON.stringify({ok:true,metrics},null,2));
