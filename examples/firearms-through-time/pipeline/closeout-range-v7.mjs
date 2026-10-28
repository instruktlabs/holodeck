import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const read=async p=>JSON.parse((await fs.readFile(p,'utf8')).replace(/^\uFEFF/,''));
const inputs={holodeck:'range-v7-integration-checks.json',hierarchy:'range-v7-native-fresh-proof.json',editor:'range-v7-editor-lighting-result.json',standalone:'range-v7-packaged-result.json',weapon:'weapon-range-v7-packaged-result.json',candidates:'era-candidates-v7-parent-audit.json',links:'asset-review-v7-link-check.json'};
const receipts={};
for(const [key,file] of Object.entries(inputs)){receipts[key]=await read('evidence/'+file);assert.equal(receipts[key].ok,true,file);}
for(const key of ['editor','standalone','weapon'])assert(receipts[key].checks.every(c=>c.status==='PASS'),key);
assert.equal(receipts.editor.checks.length,9);assert.equal(receipts.standalone.checks.length,9);assert.equal(receipts.weapon.checks.length,34);
assert.equal(receipts.holodeck.revision,7);
const packageRoot=(process.env.FTT_PACKAGE_ROOT??'packages')+'/WeaponLab/Windows/ToolchainValidation';
const files=[packageRoot+'/Binaries/Win64/ToolchainValidation.exe',...['pak','utoc','ucas'].map(ext=>packageRoot+'/Content/Paks/ToolchainValidation-Windows.'+ext),...['RangeSliceLab','WeaponLab'].map(n=>'native/ToolchainValidation/Content/Qualification/'+n+'.umap')];
const identities=[];
for(const path of files){const bytes=await fs.readFile(path);identities.push({path,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}
assert.equal(identities[0].sha256,receipts.weapon.sha256.toLowerCase());assert.equal(identities[0].sha256,receipts.standalone.executableSha256.toLowerCase());
const result={ok:true,recordedAt:new Date().toISOString(),receipts:inputs,checks:{editorRange:9,standaloneRange:9,standaloneWeapon:34},identities,performance:'DIRTY; no FPS qualification',limits:['New paper and plate stations are stationary previews; hit history, scoring, reaction and retrieval pending','Three new firearm candidates are saved and audited, not playable or production-art accepted','Lighting review cameras differ; no numeric renderer parity claim','Project-local tools; optional extension not released']};
await fs.writeFile('evidence/range-v7-closeout.json',JSON.stringify(result,null,2));console.log({ok:true,checks:result.checks,identities:identities.length});
