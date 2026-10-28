// Local qualification adapter. Originals remain private; URLs are provenance only.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {createMaterialRecordV1,createMaterialLibraryPayload} from '../tools/kiln-1.5.0/node_modules/@instruktlabs/kiln/lib/material-library-node.js';
const root=new URL('../',import.meta.url),dir=new URL('materials/private/megascans-vlskbcz/',root);
const require=createRequire(new URL('tools/kiln-1.5.0/package.json',root));
const sharp=require('sharp');
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const sourceId='quixel-vlskbcz';
const accessedAt=new Date().toISOString();
const originals=[];
for(const name of ['wood_veneer_wall_panels_vlskbcz_2k.zip','wood_veneer_wall_panels_vlskbcz_2k_ue_mid.zip','gltf/vlskbcz_tier_2.gltf','gltf/Textures/T_vlskbcz_2K_B.png','gltf/Textures/T_vlskbcz_2K_N.png','gltf/Textures/T_vlskbcz_2K_ORM.png']){
 const bytes=await readFile(new URL('original/'+name,dir));originals.push({name,sha256:hash(bytes),bytes:bytes.length});
}
const maps=[],stats=[];
for(const [slot,suffix] of [['baseColor','B'],['normal','N'],['metallicRoughness','ORM'],['occlusion','ORM']]){
 const originalFile=`gltf/Textures/T_vlskbcz_2K_${suffix}.png`;
 const bytes=await readFile(new URL('original/'+originalFile,dir));
 const metadata=await sharp(bytes).metadata();
 if(metadata.width!==1024||metadata.height!==2048)throw Error('Unexpected source map size');
 const s=await sharp(bytes).stats();
 stats.push({slot,width:metadata.width,height:metadata.height,sha256:hash(bytes),bytes:bytes.length,channelStats:s.channels.map(c=>({min:c.min,max:c.max,mean:c.mean,stdev:c.stdev}))});
 maps.push({slot,sourceId,originalFile,bytes,transforms:[],...(slot==='normal'?{normalConvention:'opengl'}:{}),...(['metallicRoughness','occlusion'].includes(slot)?{channelPacking:'r-occlusion-g-roughness-b-metallic'}:{})});
}
const record=await createMaterialRecordV1({materialId:'megascans-wood-veneer-vlskbcz',name:'Quixel Wood Veneer Wall Panels',tags:['wood','veneer','megascans','private-qualified-trial'],tileable:true,physicalSizeMeters:{width:.5,height:1},parameters:{baseColor:0xffffff,roughness:1,metalness:1},sources:[{id:sourceId,kind:'external',provider:'Quixel Megascans via Fab',creator:'Quixel',assetId:'b514d475-4115-4012-88b0-f85c61fedca5',assetUrl:'https://www.fab.com/listings/b514d475-4115-4012-88b0-f85c61fedca5',accessedAt,license:{spdx:'LicenseRef-Fab-Standard',url:'https://www.fab.com/eula',attribution:'Quixel Megascans. Private project use; do not redistribute standalone maps or material packs.'},originalFiles:originals}],maps});
const payload=await createMaterialLibraryPayload([record]);
await mkdir(dir,{recursive:true});
await writeFile(new URL('material-payload.json',dir),JSON.stringify(payload));
await writeFile(new URL('pins.json',dir),JSON.stringify([{resourceId:record.manifest.materialId,revisionId:record.manifest.revisionId,sha256:record.manifest.revisionId}],null,2));
const receipt={selectedListing:'https://www.fab.com/listings/b514d475-4115-4012-88b0-f85c61fedca5',acquiredAt:new Date().toISOString(),cost:0,source:'Vendor glTF medium tier PNGs, copied byte-for-byte',physicalSizeMeters:{width:.5,height:1},normalConvention:{value:'opengl',basis:'Vendor glTF 2.0 normalTexture; standard tangent-space positive Y. Do not infer from PNG metadata space field.'},packing:'R=AO G=roughness B=metallic',sourceFiles:originals,mapStats:stats,manifest:record.manifest,limitations:['License retained with private map payload; generic extension catalog links to Fab instead of embedding these maps.','Vendor material uses default metallic factor 1 multiplied by the zero blue channel; wood remains dielectric.','No displacement or extra specular/gloss workflow in this first portable PBR comparison.']};
await writeFile(new URL('evidence/megascans-material-preparation.json',root),JSON.stringify(receipt,null,2));
console.log(JSON.stringify({materialId:record.manifest.materialId,revisionId:record.manifest.revisionId,maps:stats}));

