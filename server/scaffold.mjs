import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {installStarter} from './starter.mjs';
import {atomicJson} from './world-store.mjs';
import {validateWorld} from '../src/world/contract.mjs';
import {resolveExample,listExamples} from './example-catalog.mjs';
import {installExampleBundle} from './example-bundle.mjs';
import {SKILLS_GUIDE,KILN_GUIDE} from './world-guide.mjs';
export {listExamples};
const packageRoot=fileURLToPath(new URL('../',import.meta.url));
export async function scaffold(root,example='construct',{examplesDirectory}={}){
 const entry=await resolveExample(example,{directory:examplesDirectory});
 if(entry.kind==='bundle')return installExampleBundle(entry.file,root);
 const template=JSON.parse(await readFile(entry.file,'utf8'));
 validateWorld({schemaVersion:2,revision:0,bible:{title:template.title,intent:template.intent,rules:template.rules},scene:{environment:template.environment,bridge:null,origin:'cove',assets:[{id:'cove',file:'assets/imports/cove.glb'}],objects:template.objects,runtime:template.runtime}});
 // Refuse existing paths rather than merge over user-owned work.
 await mkdir(root);
 for(const dir of ['world','assets/imports','assets/source','references/files'])await mkdir(path.join(root,dir),{recursive:true});
 const world=await installStarter(root);world.schemaVersion=2;
 world.bible={title:template.title,intent:template.intent,rules:template.rules};
 world.scene={...world.scene,environment:template.environment,runtime:template.runtime,objects:[...world.scene.objects,...template.objects]};
 world.scene.moodboard.collider={size:[.85,2.55,2.665],offset:[0,1.275,0]};
 if(example!=='construct')world.scene.moodboard.position=[3.6,0,-2.8];
 world.references=world.references.filter(r=>r.kind==='note');world.references[0].notes=template.intent;
 validateWorld(world);await atomicJson(path.join(root,'world/world.json'),world);
 await cp(path.join(packageRoot,'skills'),path.join(root,'.agents/skills'),{recursive:true});
 await writeFile(path.join(root,'AGENTS.md'),`# Holodeck world workspace\n\nUse the installed holodeck-author-world, holodeck-integrate-asset and holodeck-verify-world skills. ${SKILLS_GUIDE}\nUse world_read and world_propose for edits; observe the displayed revision.\nThis is a schema v2 world. Read scene.runtime for enabled built-in capabilities.\nKeep saved authoring data separate from transient activity. Never edit installed packages.\n${KILN_GUIDE}\n`);
 return world;
}
