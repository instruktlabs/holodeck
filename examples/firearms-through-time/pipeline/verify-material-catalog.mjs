import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const root=new URL('../',import.meta.url),before=await readFile(new URL('materials/catalog.json',root)),c=JSON.parse(before),checks=[];
const require=createRequire(new URL('../../../package.json',import.meta.url)),Ajv=require('ajv'),validator=new Ajv({allErrors:true}).compile(JSON.parse(await readFile(new URL('materials/catalog.schema.json',root),'utf8')));
assert(validator(c),JSON.stringify(validator.errors));checks.push('catalog_matches_json_schema');
const html=await readFile(new URL('materials/catalog.html',root),'utf8'),scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
for(const [i,s] of scripts.entries())if(!s[1].includes('application/json'))new Script(s[2],{filename:'catalog-inline-'+i});checks.push('editor_javascript_syntax_only');
const cli=args=>spawnSync(process.execPath,['pipeline/material-catalog.mjs',...args],{cwd:fileURLToPath(root),encoding:'utf8'});
const fixture='evidence/catalog-validation-fixture.json';
for(const [name,edit] of [['duplicate_id',d=>d.entries.push(d.entries[0])],['non_https_source',d=>d.entries[0].url='file:///private'],['zero_physical_scale',d=>d.entries[0].physicalSizeMeters={width:0,height:1}]]){
 const d=structuredClone(c);edit(d);await writeFile(new URL(fixture,root),JSON.stringify(d));assert.notEqual(cli(['validate',fixture]).status,0,name);checks.push('reject_'+name);
}
await writeFile(new URL(fixture,root),JSON.stringify(c));assert.equal(cli(['validate',fixture]).status,0);checks.push('valid_draft_accepted');
assert.notEqual(cli(['apply',fixture,'--expect','outdated-hash']).status,0);checks.push('stale_hash_rejected_before_write');
const d=structuredClone(c);d.entries[0].qualification.unreal.status='passed';await writeFile(new URL(fixture,root),JSON.stringify(d));
assert.notEqual(cli(['apply',fixture,'--expect',createHash('sha256').update(before).digest('hex')]).status,0);checks.push('editor_cannot_promote_qualification');
assert.deepEqual(await readFile(new URL('materials/catalog.json',root)),before);checks.push('source_catalog_unchanged_by_negative_tests');
await writeFile(new URL('evidence/catalog-validation.json',root),JSON.stringify({ok:true,checks,limits:['No interactive browser test: local-file navigation was rejected by browser URL policy.','Export/import button behavior and layout remain unverified.']},null,2));console.log(JSON.stringify({ok:true,checks}));
