import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {readZip,planPack,packTitle,categorySuggestions,DEFAULT_CATEGORIES} from './reference-pack.mjs';

// A minimal archive writer for the test: one stored or deflated entry per file.
function zip(files){
 const locals=[],central=[];let offset=0;
 for(const [name,text,deflate] of files){
  const raw=Buffer.from(text),data=deflate?deflateRawSync(raw):raw,n=Buffer.from(name);
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(deflate?8:0,8);local.writeUInt32LE(data.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(n.length,26);
  const dir=Buffer.alloc(46);dir.writeUInt32LE(0x02014b50,0);dir.writeUInt16LE(deflate?8:0,10);dir.writeUInt32LE(data.length,20);dir.writeUInt32LE(raw.length,24);dir.writeUInt16LE(n.length,28);dir.writeUInt32LE(offset,42);
  locals.push(local,n,data);central.push(dir,n);offset+=30+n.length+data.length;
 }
 const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
 return new Uint8Array(Buffer.concat([...locals,cd,end]));
}

test('a zipped pack reads stored and deflated entries and applies its manifest',async()=>{
 const manifest=JSON.stringify({references:[{file:'01-hero.png',title:'Hero view',category:'Scene',notes:'The island from the reef.',status:'approved'},{file:'notes/brief.md',category:'Rules',status:'avoid'}]});
 const bytes=zip([['tropical/manifest.json',manifest,true],['tropical/01-hero.png','PNGDATA',false],['tropical/notes/brief.md','# Brief '.repeat(20),true],['tropical/.DS_Store','x',false],['tropical/cover.psd','x',false]]);
 const entries=await readZip(bytes);
 assert.equal(new TextDecoder().decode(await entries.find(e=>e.path.endsWith('brief.md')).read()),'# Brief '.repeat(20));
 const plan=await planPack(entries,{packName:'tropical.zip'});
 assert.equal(plan.manifest,true);
 assert.deepEqual(plan.items.map(i=>[i.path,i.kind,i.title,i.group,i.status]),[['01-hero.png','image','Hero view','Scene','approved'],['notes/brief.md','file','Brief','Rules','rejected']]);
 assert.equal(plan.items[0].notes,'The island from the reef.\n\nFrom tropical.zip: 01-hero.png');
 assert.deepEqual(plan.skipped,[{path:'cover.psd',reason:'unsupported type'}]);
});

test('a pack without a manifest still gets readable titles and the default categories',async()=>{
 const plan=await planPack([{path:'02-eye-level.png',read:async()=>new Uint8Array()},{path:'kit_overview.jpg',read:async()=>new Uint8Array()}]);
 assert.deepEqual(plan.items.map(i=>[i.title,i.group]),[['Eye level',null],['Kit overview',null]]);
 assert.equal(packTitle('assets/03_materials-board.webp'),'Materials board');
 assert.deepEqual(categorySuggestions([{group:'kit'},{group:'Scene'}]),[...DEFAULT_CATEGORIES,'kit']);
 await assert.rejects(readZip(new Uint8Array([1,2,3])),/not a readable .zip/);
});
