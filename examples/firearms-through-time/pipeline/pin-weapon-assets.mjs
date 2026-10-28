import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),read=async p=>JSON.parse((await readFile(new URL(p,root),'utf8')).replace(/^\uFEFF/,'')),assets={};
for(const [id,file] of [['pistol','first-pistol-saved'],['hands','first-hands-final-saved']]){
 const s=(await read('evidence/'+file+'.json')).asset,b=await readFile(new URL('authoring/first-'+(id==='pistol'?'pistol':'hands')+'.glb',root)),sha256=createHash('sha256').update(b).digest('hex');assert.equal('sha256:'+sha256,s.files['asset.glb'].sha256);const j=JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString());
 assets[id]={assetId:s.assetId,revisionId:s.revisionId,sha256,bytes:b.length,nodes:j.nodes.length,skins:j.skins?.length??0,bones:j.skins?.[0]?.joints.length??0,triangles:j.nodes.filter(n=>n.mesh!==undefined).reduce((n,node)=>n+j.meshes[node.mesh].primitives.reduce((n,p)=>n+(j.accessors[p.indices]?.count??j.accessors[p.attributes.POSITION].count)/3,0),0)};
 if(id==='hands')assert.equal(assets[id].bones,33);
}
await writeFile(new URL('game/asset-pins.json',root),JSON.stringify({schemaVersion:1,assets},null,2));console.log(JSON.stringify(assets,null,2));
