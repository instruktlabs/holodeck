import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,readdir,rm,stat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {scaffold} from './scaffold.mjs';
import {WorldStore} from './world-store.mjs';
import {exportStaticWorld} from './static-export.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(t){
 const parent=await mkdtemp(path.join(os.tmpdir(),'holodeck-export-')),root=path.join(parent,'world');
 t.after(async()=>{const resolved=path.resolve(parent);assert.ok(resolved.startsWith(path.resolve(os.tmpdir())+path.sep));await rm(resolved,{recursive:true,force:true});});
 await scaffold(root,'construct');const store=await WorldStore.open(root);
 const world=store.snapshot();world.bible.intent='PRIVATE_BIBLE_SENTINEL';world.bible.rules='PRIVATE_RULE_SENTINEL';world.references[0].notes='PRIVATE_REFERENCE_SENTINEL';
 await store.commit({baseRevision:world.revision,bible:world.bible,references:world.references});
 const receipt=JSON.parse(await readFile(path.join(root,'.holodeck/accepted-bundle.json'),'utf8'));await store.close();
 await writeFile(path.join(root,'.env'),'PRIVATE_CREDENTIAL_SENTINEL');await writeFile(path.join(root,'.holodeck/session/secret.json'),'PRIVATE_AGENT_SENTINEL');
 return {root,parent,receipt};
}
test('static export builds relative scene-only files with exact pinned GLBs and a complete hash manifest',async t=>{
 const {root,parent,receipt}=await fixture(t),out=path.join(parent,'site');
 const staged=structuredClone(receipt.world);staged.revision=999;staged.bible.title='PRIVATE_STAGED_SENTINEL';await writeFile(path.join(root,'world/world.json'),JSON.stringify(staged));
 const result=await exportStaticWorld(root,{out});assert.equal(result.revision,receipt.world.revision);
 const scene=JSON.parse(await readFile(path.join(out,'scene.json'),'utf8')),manifest=JSON.parse(await readFile(path.join(out,'manifest.json'),'utf8'));
 assert.equal(scene.world.bible.intent,'');assert.equal(scene.world.bible.rules,'');assert.deepEqual(scene.world.references,[]);assert.equal(scene.world.scene.moodboard,undefined);
 assert.equal(scene.world.revision,receipt.world.revision);assert.equal(manifest.format,'holodeck-static-v1');assert.equal(manifest.revision,receipt.world.revision);
 const needed=new Set([scene.world.scene.origin,...scene.world.scene.objects.map(o=>o.asset).filter(Boolean)]);
 assert.deepEqual(new Set(scene.world.scene.assets.map(a=>a.id)),needed);
 for(const asset of scene.world.scene.assets){
  const entry=scene.assets[asset.id],bytes=await readFile(path.join(out,asset.file));
  assert.equal(digest(bytes),receipt.assets[asset.id].hash);assert.equal(entry.url,`./${asset.file}`);assert.equal(entry.hash,digest(bytes));
 }
 const files=await readdir(out,{recursive:true});assert.ok(files.includes('index.html'));assert.ok(files.includes('README.txt'));
 for(const name of files){
  assert.doesNotMatch(name,/\.holodeck|\.env|session|references|source|\.map$/);
  const file=path.join(out,name);if(!(await stat(file)).isFile())continue;
  if(name.endsWith('.glb'))continue;
  const text=await readFile(file,'utf8');assert.equal(text.match(/PRIVATE_[A-Z_]+_SENTINEL|["'\x60]\/api\/|\/@fs\//)?.[0],undefined,`Private data or a local endpoint in ${name}`);assert.ok(!text.includes(root));
 }
 const html=await readFile(path.join(out,'index.html'),'utf8');assert.match(html,/src="\.\/assets\//);assert.doesNotMatch(html,/(src|href)="\/(?!\/)/);
 const actualFiles=files.filter(name=>!name.endsWith('manifest.json'));
 for(const entry of manifest.files){const bytes=await readFile(path.join(out,entry.file));assert.equal(entry.sha256,digest(bytes));assert.equal(entry.bytes,bytes.length);assert.ok(actualFiles.includes(entry.file.split('/').join(path.sep)));}
 assert.equal(manifest.files.length,(await Promise.all(actualFiles.map(async f=>(await stat(path.join(out,f))).isFile()))).filter(Boolean).length);
 await assert.rejects(exportStaticWorld(root,{out}),/already exists/i);
});
test('explicit revision export uses old accepted asset bytes and strips unsafe provenance paths',async t=>{
 const {root,parent,receipt}=await fixture(t),old=receipt.world.revision,oldHash=receipt.assets.lamp.hash;
 receipt.world.revision=old+1;receipt.assets.lamp=receipt.assets.rug;receipt.world.scene.assets.find(a=>a.id==='lamp').provenance.collection='C:\\PRIVATE\\workspace';
 await writeFile(path.join(root,'.holodeck/accepted-bundle.json'),JSON.stringify(receipt));
 const result=await exportStaticWorld(root,{out:path.join(parent,'old'),revision:old});assert.equal(result.revision,old);
 const scene=JSON.parse(await readFile(path.join(result.path,'scene.json'),'utf8'));assert.equal(scene.assets.lamp.hash,oldHash);
 const latest=await exportStaticWorld(root,{out:path.join(parent,'latest')});
 const changed=JSON.parse(await readFile(path.join(latest.path,'scene.json'),'utf8'));assert.equal(changed.assets.lamp.hash,receipt.assets.rug.hash);assert.equal(changed.world.scene.assets.find(a=>a.id==='lamp').provenance.collection,undefined);
});
test('static export rejects unaccepted worlds and corrupt pinned bytes before creating output',async t=>{
 const {root,parent,receipt}=await fixture(t),out=path.join(parent,'broken');
 await writeFile(path.join(root,`.holodeck/blobs/${receipt.assets.lamp.hash}.glb`),'corrupt');
 await assert.rejects(exportStaticWorld(root,{out}),/hash mismatch|GLB/i);await assert.rejects(stat(out),{code:'ENOENT'});
 await rm(path.join(root,`.holodeck/blobs/${receipt.assets.lamp.hash}.glb`));
 await assert.rejects(exportStaticWorld(root,{out}),/pinned dependency.*unavailable/i);
 const unopened=path.join(parent,'unopened');await mkdir(unopened);
 await assert.rejects(exportStaticWorld(unopened,{out}),/Open.*world.*first/i);await assert.rejects(stat(out),{code:'ENOENT'});
});

test('static export preserves an explicitly validated foliage binding',async t=>{
 const {root,parent,receipt}=await fixture(t),asset=receipt.world.scene.assets.find(a=>a.id==='lamp'),bytes=await readFile(path.join(root,`.holodeck/blobs/${receipt.assets.lamp.hash}.glb`)),doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
 const node=doc.nodes.find(n=>n.name&&Number.isInteger(n.mesh)&&doc.meshes[n.mesh].primitives.length===1&&!doc.materials?.[doc.meshes[n.mesh].primitives[0].material]?.extensions?.KHR_materials_unlit);assert.ok(node);
 asset.foliage={nodes:[node.name],translucency:.18};for(const item of receipt.world.scene.objects)if(item.asset===asset.id)item.materialStyle='kiln';await writeFile(path.join(root,'.holodeck/accepted-bundle.json'),JSON.stringify(receipt));
 const result=await exportStaticWorld(root,{out:path.join(parent,'foliage')}),output=JSON.parse(await readFile(path.join(result.path,'scene.json'),'utf8'));assert.deepEqual(output.world.scene.assets.find(a=>a.id==='lamp').foliage,asset.foliage);
});
test('static export writes explicit page metadata, a social card and JSON-LD into the scene page',async t=>{
 const {root,parent}=await fixture(t),out=path.join(parent,'page'),image=path.join(parent,'card.jpg');
 // A JPEG header is enough for the dimension walk: SOI, then SOF0 with height 630 and width 1200.
 await writeFile(image,Buffer.from([0xff,0xd8,0xff,0xc0,0x00,0x11,0x08,0x02,0x76,0x04,0xb0,0x03,0x01,0x22,0x00,0x02,0x11,0x01,0x03,0x11,0x01,0xff,0xd9]));
 await exportStaticWorld(root,{out,page:{title:'Garden <walk> & "rest"',description:'A walled garden.',url:'https://example.com/worlds/garden/',image,imageAlt:'The garden gate',license:'https://creativecommons.org/publicdomain/zero/1.0/'}});
 const html=await readFile(path.join(out,'index.html'),'utf8'),manifest=JSON.parse(await readFile(path.join(out,'manifest.json'),'utf8'));
 assert.match(html,/<title>Garden &lt;walk&gt; &amp; &quot;rest&quot;<\/title>/);assert.doesNotMatch(html,/Holodeck world/);
 assert.match(html,/<link rel="canonical" href="https:\/\/example\.com\/worlds\/garden\/">/);
 assert.match(html,/<meta property="og:image" content="https:\/\/example\.com\/worlds\/garden\/preview\.jpg">/);
 assert.match(html,/<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">/);
 assert.match(html,/<meta name="twitter:card" content="summary_large_image">/);
 const data=JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
 assert.deepEqual(data,{'@context':'https://schema.org','@type':'CreativeWork',name:'Garden <walk> & "rest"',description:'A walled garden.',url:'https://example.com/worlds/garden/',image:'https://example.com/worlds/garden/preview.jpg',license:'https://creativecommons.org/publicdomain/zero/1.0/'});
 assert.doesNotMatch(html.match(/<script type="application\/ld\+json">.*?<\/script>/)[0].slice(35,-9),/</);
 assert.deepEqual(await readFile(path.join(out,'preview.jpg')),await readFile(image));
 assert.ok(manifest.files.some(entry=>entry.file==='preview.jpg'));assert.ok(manifest.files.some(entry=>entry.file==='index.html'&&entry.sha256===digest(Buffer.from(html))));
});
test('static export page metadata without a URL keeps only the title and description',async t=>{
 const {root,parent}=await fixture(t),out=path.join(parent,'plain');
 await exportStaticWorld(root,{out,page:{title:'Garden',description:'A walled garden.'}});
 const html=await readFile(path.join(out,'index.html'),'utf8');
 assert.match(html,/<title>Garden<\/title><meta name="description" content="A walled garden\.">/);assert.doesNotMatch(html,/canonical|og:|twitter:|ld\+json/);
});
test('static export refuses unsafe page metadata before creating output',async t=>{
 const {root,parent}=await fixture(t),out=path.join(parent,'refused');
 const cases=[
  [{title:'Garden',description:String.raw`Built in C:\Users\me\worlds`},/local path/],
  [{title:'Garden',description:'Built in /home/me/worlds'},/local path/],
  [{title:'Garden',description:'A garden.',url:'http://example.com/garden/'},/https URL/],
  [{title:'Garden',description:'A garden.',url:'https://example.com/garden'},/end with \//],
  [{title:'Garden',description:'A garden.',imageAlt:'gate'},/needs a page image/],
  [{title:'',description:'A garden.'},/page title/],
  [{title:'Garden',description:'A garden.',author:'me'},/fields/],
 ];
 for(const [page,error] of cases)await assert.rejects(exportStaticWorld(root,{out,page}),error);
 const text=path.join(parent,'card.txt');await writeFile(text,'not an image');
 await assert.rejects(exportStaticWorld(root,{out,page:{title:'Garden',description:'A garden.',image:text}}),/PNG or JPEG/);
 await assert.rejects(stat(out),{code:'ENOENT'});
});
