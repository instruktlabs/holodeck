import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const entry=`## Continuous wood and editable material shortlist (2026-10-26)

Current case: program \`p_a97616d49725\`, asset \`a_97a44d3c5d574dab9d9c4994cf6d2be3\`,
revision \`r_f86712dfed19484488af97a741eeb6cd\`, parent \`r_e23d7ff0476e4eb98b9920143975224e\`.
Source \`authoring/opening-case-fine-wood.kiln.js\`; GLB hash
\`9c5032f4d316d0d16937091b95cd72d47c0e3b73934d82ae956f19fc62aefacf\`.
Pin file \`materials/polyhaven/fine_grained_wood/pins.json\` required.
Geometry/bounds unchanged, grain/UVs updated. Holodeck case world revision 15
kept paused pose; Unreal preserves bindings and override bytes, 7/7 pixel checks,
9/9 editor-game checks. Fresh packaged test not run for this revision.

Seven CC0 swatches saved and rendered in Unreal and Holodeck WebGPU/WebGL2.
Lab: \`http://127.0.0.1:4197/prototype.html?backend=webgpu\`, world
\`holodeck-material-library\`, revision 1; native map \`MaterialLibraryLab\`.
Catalog: \`materials/catalog.json\`, editor \`materials/catalog.html\`, schema and
CLI in place. Editor UI test blocked by local-file URL policy; data/schema and
negative validation tests are separate. All procedural parameters are proposed,
not implemented recipes. See \`docs/material-shortlist-results.md\` and
\`materials/README.md\`. The extension remains local and opt-in, not published.
Next: iron grazing/environment response, mip/compression tests, then one generated
wood recipe including end grain. Earlier entries below are historical.

`;
for(const path of ['PC-PROGRESS.md','authoring/KILN_PROGRESS.md']){const old=await readFile(new URL(path,root),'utf8');if(!old.includes('## Continuous wood and editable material shortlist'))await writeFile(new URL(path,root),entry+old);}
const p=new URL('evidence/integration-learning-ledger.json',root),ledger=JSON.parse(await readFile(p,'utf8'));
for(const e of [{id:'MATERIAL-SHORTLIST-001',topic:'portable material qualification',status:'observed-pass-limited',question:'Can seven measured CC0 surfaces be rendered and checked in both destinations?',observations:['21/21 source images passed Unreal pixel readback','7/7 Holodeck source and served-image deliveries verified','WebGPU/WebGL mean channel differences <=0.01 in tested patches','Unreal corrugated iron differs by up to 18.78 mean code values'],decision:'Use the same pinned maps, preserve destination overrides, track per-engine gates; investigate metal before promotion.',evidence:['shortlist-native-pixels.json','shortlist-holodeck-delivery.json','shortlist-capture-comparison.json','shortlist-comparison.png'],limits:['One neutral frontal light and camera','No performance, displacement or production qualification'],nextTest:'Grazing light and environment response on iron; near/far mip transition captures.'},{id:'MATERIAL-FIELDBOOK-001',topic:'optional extension',status:'local-prototype',question:'Can users extend the shortlist and use it for procedural research?',decision:'Versioned JSON catalog/schema, local draft editor, hash-guarded metadata apply, immutable evidence and material pins; procedural inspiration remains proposed.',evidence:['catalog-validation.json','../materials/catalog.json','../materials/README.md'],limits:['Editor browser UI unverified because file URL was blocked','No published extension or implemented procedural recipes']}])if(!ledger.entries.some(x=>x.id===e.id))ledger.entries.push(e);
await writeFile(p,JSON.stringify(ledger,null,2)+'\n');
