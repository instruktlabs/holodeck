import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {bake,makeField} from './wood-recipe.mjs';
const config=JSON.parse(await readFile(new URL('../materials/procedural-wood/dry.json',import.meta.url),'utf8')),small={...config,size:128},a=bake(small),b=bake(small),c=bake({...small,seed:63}),oil=bake({...small,roughness:.28}),checks=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
for(const slot of ['baseColor','normal','metallicRoughness'])assert.equal(hash(a[slot]),hash(b[slot]));checks.push('same_seed_and_parameters_reproduce_pixels');
assert.notEqual(hash(a.baseColor),hash(c.baseColor));checks.push('seed_changes_grain');
assert.deepEqual(a.baseColor,oil.baseColor);assert.deepEqual(a.normal,oil.normal);assert.notDeepEqual(a.metallicRoughness,oil.metallicRoughness);checks.push('roughness_variant_changes_only_ORM');
const f=makeField(config);let maxSeamError=0;
for(let i=0;i<=100;i++){const t=i/100;for(const [p,q] of [[f(0,t),f(1,t)],[f(t,0),f(t,1)]])for(const [x,y] of [[p.height,q.height],[p.roughness,q.roughness],...p.color.map((v,j)=>[v,q.color[j]])])maxSeamError=Math.max(maxSeamError,Math.abs(x-y));}
assert(maxSeamError<1e-8);checks.push('analytic_color_height_roughness_wrap_continuously');
for(let i=0;i<a.normal.length;i+=3){const n=[...a.normal.subarray(i,i+3)].map(v=>v/127.5-1);assert(Math.abs(Math.hypot(...n)-1)<.014);assert.equal(a.metallicRoughness[i],255);assert.equal(a.metallicRoughness[i+2],0);}checks.push('encoded_normals_unit_length_and_nonmetal_ORM');
for(const invalid of [{size:120},{roughness:2},{grainCycles:2.5},{typo:1}])assert.throws(()=>bake({...small,...invalid}));checks.push('invalid_parameters_rejected');
const result={ok:true,checks,maxSeamError,testResolution:128,limits:['Analytic periodicity and normals do not prove rendered mip quality.','JavaScript math determinism verified on this runtime; cross-platform bit identity untested.']};await writeFile(new URL('../evidence/procedural-wood-recipe-tests.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
