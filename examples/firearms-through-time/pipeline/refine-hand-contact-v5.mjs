import {writeFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';
const edits=[
 {oldString:"[[-.073,-.032,-.050],[-.048,-.013,-.038],[-.023,-.006,-.024],[.002,-.005,-.0213]]",newString:"[[-.073,-.032,-.050],[-.055,-.015,-.036],[-.036,-.008,-.023],[-.018,-.009,-.0213]]"},
 {oldString:"[[-.035,yy,.035],[-.013,yy-.002,.028],[.009,yy-.004,.004],[-.031,yy-.006,-.027]]",newString:"[[-.035,yy,.035],[.014,yy-.002,.030],[.017,yy-.004,.004],[.014,yy-.005,-.026],[-.042,yy-.006,-.028]]"}
];await writeFile('evidence/hands-v5-contact-edits-02.json',JSON.stringify(edits));
const env={...process.env,KILN_RENDER_SERVICE_PORT:'8010',KILN_RENDER_PORT_URL:'http://127.0.0.1:8010',KILN_GLTF_EXPORTER:'three'},call=args=>JSON.parse(spawnSync(process.execPath,['authoring/kiln.mjs',...args],{env,encoding:'utf8',windowsHide:true,maxBuffer:30e6}).stdout);
const e=call(['edit','p_1690e7f87161','--edits','evidence/hands-v5-contact-edits-02.json','--json']);await writeFile('evidence/hands-v5-edit-02.json',JSON.stringify(e));assert(e.ok);console.log(e.programRef);
const r=call(['render',e.programRef,'--materials','materials/gloves-v5/pins.json','--out','authoring/first-hands-v5.glb','--views','evidence/hands-v5-contact-02.png','--render','gpu','--json']);await writeFile('evidence/hands-v5-render-02.json',JSON.stringify(r));console.log(JSON.stringify({ok:r.ok,error:r.error,tris:r.tris}));
