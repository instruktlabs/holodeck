import {writeFile} from 'node:fs/promises';
const base='http://127.0.0.1:4202',r=await fetch(base+'/api/session'),cookie=r.headers.get('set-cookie').split(';')[0],s=await r.json();
const scene=structuredClone(s.world.scene);scene.runtime.spawn=[20,1.72,0];scene.runtime.look=[-Math.PI/2,0];scene.runtime.possession.camera='first';
const change={baseRevision:s.world.revision,scene,summary:'Start the weapon test at the booth facing the turning target. Preserve all collection modules, references and interactions.'};
await writeFile(new URL('../evidence/weapon-view-before.json',import.meta.url),JSON.stringify(s,null,2));
const out=await fetch(base+'/api/propose',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json','X-Holodeck-World':s.context.worldId,'X-Holodeck-Epoch':s.context.epoch},body:JSON.stringify(change)});const result=await out.json();console.log(JSON.stringify(result));if(!out.ok)process.exitCode=1;
