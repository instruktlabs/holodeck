import {cp,lstat,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {OPTIONAL_SKILLS,enabledOptionalSkills,isOptionalSkill} from '../src/world/optional-skills.mjs';
const packageSkills=fileURLToPath(new URL('../skills',import.meta.url));
async function skillsDirectory(root){
  for(const name of ['.agents','.agents/skills']){
    let info;try{info=await lstat(path.join(root,name));}catch(e){if(e.code==='ENOENT')continue;throw e;}
    if(!info.isDirectory()||info.isSymbolicLink())throw new Error('World skill directories must not be symbolic links');
  }
  return path.join(root,'.agents/skills');
}
// A new, remixed or example world gets the package's core skills and the
// optional skills its scene declares.
export async function installWorldSkills(root,world,{source=packageSkills}={}){
  const target=await skillsDirectory(root);
  await cp(source,target,{recursive:true,filter:file=>!isOptionalSkill(path.relative(source,file).split(path.sep)[0])});
  return syncOptionalSkills(root,world,{source});
}
// Installs each optional skill the world declares and removes every other one,
// so dropping a destination leaves no stale copy. Optional skills are package
// owned: a sync replaces local edits. Core skills are not touched.
export async function syncOptionalSkills(root,world,{source=packageSkills}={}){
  const target=await skillsDirectory(root),enabled=enabledOptionalSkills(world);
  for(const name of Object.keys(OPTIONAL_SKILLS)){
    const directory=path.join(target,name);await rm(directory,{recursive:true,force:true});
    if(enabled.includes(name))await cp(path.join(source,name),directory,{recursive:true});
  }
  return enabled;
}
