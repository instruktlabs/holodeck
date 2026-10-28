import {bake,makeField} from './wood-natural-recipe.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const p=JSON.parse(await readFile(new URL('../materials/procedural-wood/natural.json',import.meta.url),'utf8')),a=bake({...p,size:64}),b=bake({...p,size:64}),c=bake({...p,size:64,seed:63}),r=bake({...p,size:64,roughness:.28}),knots=bake({...p,size:64,knotCount:0});
for(const slot of ['baseColor','normal','metallicRoughness'])assert.deepEqual(a[slot],b[slot]);
assert.notDeepEqual(a.baseColor,c.baseColor);assert.notDeepEqual(a.baseColor,knots.baseColor);assert.deepEqual(a.baseColor,r.baseColor);assert.deepEqual(a.normal,r.normal);assert.notDeepEqual(a.metallicRoughness,r.metallicRoughness);
assert.equal(a.width,128);assert.equal(a.height,64);assert.equal(a.atlas.tileable,false);
for(const slot of ['baseColor','normal','metallicRoughness'])for(let y=0;y<64;y++)for(const j of [0,1]){
 const at=x=>a[slot].subarray((y*128+j*64+x)*3,(y*128+j*64+x+1)*3);
 assert.deepEqual(at(0),at(2));assert.deepEqual(at(63),at(61));
}
for(const invalid of [{knotCount:1.5},{endTileMeters:0},{typo:1}])assert.throws(()=>bake({...p,size:64,...invalid}));
for(let i=0;i<a.normal.length;i+=3){const n=[...a.normal.subarray(i,i+3)].map(v=>v/127.5-1);assert(Math.abs(Math.hypot(...n)-1)<.014);assert.equal(a.metallicRoughness[i],255);assert.equal(a.metallicRoughness[i+2],0);}
assert.notDeepEqual(makeField(p,'long')(.3,.5),makeField(p,'end')(.3,.5));
const result={ok:true,checks:['deterministic_pixels','seed_and_knot_controls_change_grain','roughness_only_changes_ORM','distinct_cut_end_field','edge_gutter_extrusion','valid_unit_normals_and_nonmetal_ORM','invalid_controls_rejected'],limits:['End-grain field is independent, not volumetrically continuous through every board edge','Atlas is not tileable; UVs must stay within the appropriate rectangle','Gutter tests do not prove all distant mip levels']};await writeFile(new URL('../evidence/natural-wood-recipe-tests.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
