import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {openProvenanceDocument} from './local-material-provenance.mjs';
const p=await openProvenanceDocument({port:0});assert(p.owned);
try{
 assert.equal(await(await fetch(p.url)).text(),await readFile(new URL('../materials/procedural-wood/README.md',import.meta.url),'utf8'));
 assert.equal((await fetch(new URL('/README.md',p.url))).status,404);
 assert.equal((await fetch(p.url,{method:'POST'})).status,404);
 const reused=await openProvenanceDocument({port:Number(new URL(p.url).port)});assert.equal(reused.owned,false);await reused.close();assert((await fetch(p.url)).ok);
}finally{await p.close();}
await assert.rejects(fetch(p.url));
console.log('PASS: exact notice, bounded route, GET only, matching-port reuse, owned-server shutdown');
