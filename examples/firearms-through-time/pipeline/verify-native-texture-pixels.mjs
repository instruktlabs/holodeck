import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),require=createRequire(new URL('tools/kiln-1.5.0/package.json',root)),sharp=require('sharp');
const receipt=JSON.parse(await readFile(new URL('evidence/megascans-native-texture-repair.json',root),'utf8'));
const checks=[];
for(const row of receipt.textures){
 const a=await sharp(row.source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const b=await sharp(row.exported).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.deepEqual(a.info,b.info,row.name+' dimensions');
 assert.deepEqual(a.data,b.data,row.name+' exported source pixels');
 checks.push({name:row.name,width:a.info.width,height:a.info.height,rgbaSha256:createHash('sha256').update(a.data).digest('hex'),pixelIdentical:true});
}
await writeFile(new URL('evidence/megascans-native-pixel-check.json',root),JSON.stringify({ok:true,checks,scope:'Unreal exported source-art PNG pixels equal the GLB embedded images. GPU block compression and lighting are assessed separately in runtime captures.'},null,2));
console.log(JSON.stringify({ok:true,checked:checks.length}));
