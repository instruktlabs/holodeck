import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),rows=[];
const call=args=>{const r=spawnSync(process.execPath,[fileURLToPath(new URL('authoring/kiln.mjs',root)),...args],{cwd:fileURLToPath(root),encoding:'utf8',maxBuffer:30e6,env:{...process.env,KILN_RENDER_SERVICE_PORT:'8010',KILN_RENDER_PORT_URL:'http://127.0.0.1:8010'}});assert.equal(r.status,0,r.stdout+r.stderr);return JSON.parse(r.stdout);};
await mkdir(new URL('holodeck-range-slice/assets/imports/',root),{recursive:true});
for(const id of ['collection-bay','booth-console','target-module']){
 const rendered=JSON.parse(await readFile(new URL(`evidence/${id}-final-render.json`,root),'utf8'));
 const saved=call(['save',rendered.programRef,'--name',id+' range slice prototype','--collection','project','--materials','materials/procedural-wood/natural-v1/pins.json','--description','Industrial range prototype. Separate stable rigid joints and material roles. Not final hero art.','--harness','Codex','--render','gpu','--json']);assert(saved.ok);
 await writeFile(new URL(`evidence/${id}-saved.json`,root),JSON.stringify(saved,null,2));
 const bytes=await readFile(new URL(`authoring/${id}.glb`,root)),hash=createHash('sha256').update(bytes).digest('hex');
 assert.equal(hash,saved.asset.files['asset.glb'].sha256.replace(/^sha256:/,''));
 const file=`assets/imports/${id}-${saved.asset.revisionId}.glb`;await copyFile(new URL(`authoring/${id}.glb`,root),new URL(`holodeck-range-slice/${file}`,root));
 const src=call(['source',rendered.programRef,'--json']);await writeFile(new URL(`evidence/${id}-saved-source.json`,root),JSON.stringify(src,null,2));
 rows.push({id,programRef:rendered.programRef,assetId:saved.asset.assetId,revisionId:saved.asset.revisionId,collection:saved.collection,file,sha256:hash,triangles:rendered.tris});
 await writeFile(new URL('evidence/range-slice-assets.json',root),JSON.stringify(rows,null,2));console.log(id,saved.asset.revisionId);
}
