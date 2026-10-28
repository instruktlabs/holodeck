import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const env={...process.env,KILN_RENDER_SERVICE_PORT:'8010',KILN_RENDER_PORT_URL:'http://127.0.0.1:8010',KILN_GLTF_EXPORTER:'three'};
function call(args){const p=spawnSync(process.execPath,['authoring/kiln.mjs',...args],{env,encoding:'utf8',windowsHide:true,maxBuffer:30e6});const r=JSON.parse(p.stdout);assert(r.ok,JSON.stringify(r));return r;}
const source=await readFile('authoring/first-hands-v5-contact-exact.kiln.js','utf8');
const edits=[{oldString:'[[-.073,-.032,-.050],[-.055,-.015,-.039],[-.036,-.008,-.027],[-.018,-.009,-.0253]]',newString:'[[-.073,-.032,-.050],[-.055,-.015,-.040],[-.036,-.008,-.029],[-.018,-.009,-.027]]'},{oldString:'edgeLength:.0027',newString:'edgeLength:.00265'}];
await writeFile('evidence/hands-v5-thumb-clearance-edits.json',JSON.stringify(edits));
const e=call(['edit','p_72a6c7ccafed','--edits','evidence/hands-v5-thumb-clearance-edits.json','--json']);await writeFile('evidence/hands-v5-edit-08.json',JSON.stringify(e));console.log(e.programRef);
let r=call(['render',e.programRef,'--materials','materials/gloves-v5/pins.json','--out','authoring/first-hands-v5.glb','--json']);
let fit=await readFile('pipeline/fit-hand-grasp-v5.mjs','utf8');fit=fit.replace('[-.018,-.009,-.0253]','[-.018,-.009,-.027]');await writeFile('pipeline/fit-hand-grasp-v5.mjs',fit);
const run=spawnSync(process.execPath,['pipeline/fit-hand-grasp-v5.mjs'],{encoding:'utf8',windowsHide:true});assert.equal(run.status,0,run.stderr);
const angles=JSON.parse(await readFile('evidence/hands-v5-grasp-fit.json','utf8')).result.map(r=>r.angles.map(v=>+v.toFixed(2)));
const old=source.match(/angles=(\[.*?\])\[finger\]/)[1];await writeFile('evidence/hands-v5-thumb-fit-edits.json',JSON.stringify([{oldString:old,newString:JSON.stringify(angles)}]));
const f=call(['edit',e.programRef,'--edits','evidence/hands-v5-thumb-fit-edits.json','--json']);await writeFile('evidence/hands-v5-edit-09.json',JSON.stringify(f));console.log(f.programRef);
r=call(['render',f.programRef,'--materials','materials/gloves-v5/pins.json','--out','authoring/first-hands-v5.glb','--views','evidence/hands-v5-final.png','--render','gpu','--json']);await writeFile('evidence/hands-v5-render.json',JSON.stringify(r));
const s=call(['source',f.programRef,'--out','authoring/first-hands-v5-final2-exact.kiln.js','--json']);await writeFile('evidence/hands-v5-source.json',JSON.stringify(s));console.log({ref:f.programRef,triangles:r.tris,source:s.ok});

