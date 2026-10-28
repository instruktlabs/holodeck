import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),call=args=>{const r=spawnSync(process.execPath,[fileURLToPath(new URL('authoring/kiln.mjs',root)),...args],{cwd:fileURLToPath(root),encoding:'utf8',maxBuffer:30e6,env:{...process.env,KILN_RENDER_SERVICE_PORT:'8010',KILN_RENDER_PORT_URL:'http://127.0.0.1:8010'}});assert.equal(r.status,0,r.stdout+r.stderr);return JSON.parse(r.stdout);};
const rows=JSON.parse(await readFile(new URL('evidence/range-slice-assets.json',root),'utf8')),before=rows.find(r=>r.id==='booth-console');
await writeFile(new URL('evidence/range-console-update-source-before.json',root),JSON.stringify(call(['source',before.programRef,'--json']),null,2));
const edits=[{oldString:'roughness:.62,metalness:0',newString:'roughness:.68,metalness:0'},{oldString:'screen=gameMaterial(0x152629,{roughness:.3',newString:'screen=gameMaterial(0x152629,{roughness:.5'}];
await writeFile(new URL('evidence/range-console-update-edits.json',root),JSON.stringify(edits));
const edited=call(['edit',before.programRef,'--edits','evidence/range-console-update-edits.json','--json']);await writeFile(new URL('evidence/range-console-update-program.json',root),JSON.stringify(edited,null,2));
const rendered=call(['render',edited.programRef,'--materials','materials/procedural-wood/natural-v1/pins.json','--out','authoring/booth-console-update.glb','--views','evidence/booth-console-update.png','--render','gpu','--json']);await writeFile(new URL('evidence/range-console-update-render.json',root),JSON.stringify(rendered,null,2));
console.log(edited.programRef,rendered.tris);
