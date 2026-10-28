import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),rows=JSON.parse(await readFile(new URL('evidence/shortlist-swatches.json',root),'utf8'));
const dir=new URL('holodeck-material-library/assets/imports/',root);await mkdir(dir,{recursive:true});
for(const row of rows){
 const result=spawnSync(process.execPath,[fileURLToPath(new URL('authoring/kiln.mjs',root)),'save',row.programRef,'--name',row.name+' qualification swatch','--collection','project','--materials','materials/polyhaven/'+row.id+'/pins.json','--description','One metre material qualification panel. Flat geometry; displacement intentionally unqualified.','--harness','Codex','--render','gpu','--json'],{cwd:fileURLToPath(root),encoding:'utf8',maxBuffer:12*1024*1024,env:{...process.env,KILN_RENDER_SERVICE_PORT:'8010',KILN_RENDER_PORT_URL:'http://127.0.0.1:8010'}});
 assert.equal(result.status,0,result.stderr||result.stdout);const saved=JSON.parse(result.stdout);assert(saved.ok);
 row.saved={assetId:saved.asset.assetId,revisionId:saved.asset.revisionId,collection:saved.collection,sha256:saved.asset.files['asset.glb'].sha256};
 await writeFile(new URL('evidence/shortlist-'+row.id+'-saved.json',root),JSON.stringify(saved,null,2));
 await copyFile(new URL(row.path+'.glb',root),new URL(row.id+'-'+row.saved.revisionId+'.glb',dir));
 await writeFile(new URL('evidence/shortlist-swatches-saved.json',root),JSON.stringify(rows,null,2));console.log(row.id+' saved');
}
const base='http://127.0.0.1:4197',r=await fetch(base+'/api/session'),cookie=r.headers.get('set-cookie')?.split(';')[0],s=await r.json();
assert.equal(s.world.revision,0,'Expected newly initialized lab');
const scene=structuredClone(s.world.scene);
scene.assets.push(...rows.map(row=>({id:row.id,file:'assets/imports/'+row.id+'-'+row.saved.revisionId+'.glb',provenance:{assetId:row.saved.assetId,revisionId:row.saved.revisionId,collection:row.saved.collection}})));
scene.objects.push(...rows.map(row=>({id:row.id,asset:row.id,label:row.name,position:[10+row.position[0],row.position[1],row.position[2]],rotation:[0,0,0],scale:[1,1,1],layer:'world',collider:null,castShadow:false})));
scene.runtime={version:1,modules:['collision.boxes@1','camera.walk-orbit@1'],spawn:[10,1.72,3.4],look:[0,0],overview:[10,3,5],target:[10,1.2,0],bounds:[-20,20,-20,20],blockers:[]};
scene.environment={type:'construct',clearPath:true,groundColor:'#808080',fogColor:'#aaaaaa',sunColor:'#ffffff',sunIntensity:1,sunPosition:[0,0,5],fogNear:100,fogFar:200,exposure:1,grade:{toneMapping:'aces'},effects:{bloom:{strength:0}},sky:{zenithColor:'#aaaaaa',horizonColor:'#aaaaaa',sunDisc:0,light:{intensity:0}}};
const bible={...s.world.bible,title:'Material shortlist lab',intent:'First pass on seven one-metre CC0 surface swatches in Holodeck and Unreal.',rules:'Source: Poly Haven. Top: fine wood, weathered planks, plaster, concrete. Bottom: corrugated iron, red brick, stone. No displacement; this is not production qualification.'};
const response=await fetch(base+'/api/propose',{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json','X-Holodeck-World':s.context.worldId,'X-Holodeck-Epoch':s.context.epoch},body:JSON.stringify({baseRevision:s.world.revision,scene,bible,summary:'Seven one-metre reference surfaces, measured scale, neutral frontal light; Powered by Poly Haven'})});
const result=await response.json();assert(response.ok,JSON.stringify(result));await writeFile(new URL('evidence/shortlist-holodeck-proposal.json',root),JSON.stringify(result,null,2));console.log('proposal '+result.proposalId);
