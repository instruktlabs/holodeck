import {readFile,writeFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),call=args=>{const p=spawnSync(process.execPath,[fileURLToPath(new URL('authoring/kiln.mjs',root)),...args],{cwd:fileURLToPath(root),encoding:'utf8',maxBuffer:30e6,env:{...process.env,KILN_RENDER_PORT_URL:'http://127.0.0.1:8010',KILN_RENDER_SERVICE_PORT:'8010'}});assert.equal(p.status,0,p.stdout+p.stderr);return JSON.parse(p.stdout);};
const fixes={
'collection-bay':[['const selection=createPivot',"await box('paint',[.035,1.78,2.20],[-.21,1.40,0],.005);await box('steel',[.07,.055,.08],[.23,.96,0],.005);const selection=createPivot"],['screw([-.074,y,z])','screw([-.078,y,z])'],['[.39,.055,.74],[.10,.92,-.77+i*.77]','[.39,.055,.768],[.10,.92,-.77+i*.77]']],
'booth-console':[['[.6,.06,.77],[.36,.94,-.4+i*.8]','[.6,.06,.798],[.36,.94,-.4+i*.8]'],["await box('paint',[.08,.07,1.65]","for(const z of [-.7,.7])await box('rubber',[.14,.05,.14],[.52,.025,z],.005);await box('paint',[.08,.07,1.65]"]],
'target-module':[["createPivot('Target',[0,1.45,0]","createPivot('Target',[0,1.70,0]"],['[-.142,.21,0]','[-.017,.21,0]'],['screw([x,.137,z]','screw([x,.132,z]']]
};
for(const [id,changes] of Object.entries(fixes)){
 const old=JSON.parse((await readFile(new URL('evidence/'+id+'-render.json',root),'utf8')).replace(/^\uFEFF/,''));
 // Retain a bounded exact source read before forming edits.
 const source=call(['source',old.programRef,'--json']);await writeFile(new URL('evidence/'+id+'-reviewed-source.json',root),JSON.stringify(source,null,2));
 const edits=changes.map(([oldString,newString])=>({oldString,newString}));const file='evidence/'+id+'-refinements.json';await writeFile(new URL(file,root),JSON.stringify(edits,null,2));
 const e=call(['edit',old.programRef,'--edits',file,'--json']);await writeFile(new URL('evidence/'+id+'-refinement.json',root),JSON.stringify(e,null,2));
 const r=call(['render',e.programRef,'--materials','materials/procedural-wood/natural-v1/pins.json','--out','authoring/'+id+'.glb','--views','evidence/'+id+'-final.png','--render','gpu','--json']);await writeFile(new URL('evidence/'+id+'-final-render.json',root),JSON.stringify(r,null,2));console.log(id,e.programRef,r.tris);
}
