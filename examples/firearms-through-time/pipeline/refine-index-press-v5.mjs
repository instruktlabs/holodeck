import {writeFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';
const env={...process.env,KILN_RENDER_SERVICE_PORT:'8010',KILN_RENDER_PORT_URL:'http://127.0.0.1:8010',KILN_GLTF_EXPORTER:'three'};
const call=args=>{const p=spawnSync(process.execPath,['authoring/kiln.mjs',...args],{env,encoding:'utf8',windowsHide:true,maxBuffer:30e6});const r=JSON.parse(p.stdout);assert(r.ok,JSON.stringify(r));return r;};
await writeFile('evidence/hands-v5-press-edits.json',JSON.stringify([{oldString:'-p.rightIndex*[25,12,3][segment]',newString:'-p.rightIndex*[18,8,2][segment]'}]));
const e=call(['edit','p_f2ccd67f01b8','--edits','evidence/hands-v5-press-edits.json','--json']);await writeFile('evidence/hands-v5-edit-10.json',JSON.stringify(e));console.log(e.programRef);
const r=call(['render',e.programRef,'--materials','materials/gloves-v5/pins.json','--out','authoring/first-hands-v5.glb','--views','evidence/hands-v5-final.png','--render','gpu','--json']);await writeFile('evidence/hands-v5-render.json',JSON.stringify(r));
const s=call(['source',e.programRef,'--out','authoring/first-hands-v5-final3-exact.kiln.js','--json']);await writeFile('evidence/hands-v5-source.json',JSON.stringify(s));console.log({ref:e.programRef,triangles:r.tris});
