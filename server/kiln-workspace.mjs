import {spawn} from 'node:child_process';
import {access,cp,lstat,mkdir,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
// Kiln registers skills per harness: Claude Code's layout is .claude/skills,
// Codex and Cursor read .agents/skills. Kiln's optional compose skill is not
// installed: it teaches Kiln's own terrain and scene composition, which
// Holodeck worlds do not use.
export const KILN_HARNESS={codex:'codex',claude:'claude',cursor:'cursor-agent'};
export async function ensureKilnWorkspace(root,{provider='codex'}={}){
  const harness=KILN_HARNESS[provider]??'codex';
  let manifest=null;
  try{manifest=JSON.parse(await readFile(path.join(root,'.kiln/workspace.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')return;}
  if(manifest){
    if(!Array.isArray(manifest.harnesses))return;
    // Add the connecting harness to an existing workspace. Kiln keeps the
    // earlier registrations; a failure leaves the workspace as it was.
    if(!manifest.harnesses.includes(harness))await runInitializer(root,['--adopt','--harness',harness]).catch(()=>{});
    return upgradeIfStale(root);
  }
  await runInitializer(root,['--adopt','--harness',harness]);
}
// A Kiln upgrade on the host leaves the world's skills and launchers stale,
// and Kiln's CLI then refuses every command. Upgrade before the agent starts
// and return Kiln's report so the host can say so; Kiln refuses edited files
// without changing anything, and that reason stops the connection. A check
// that cannot run leaves the workspace as it was.
async function upgradeIfStale(root){
  let report;try{report=JSON.parse(await runInitializer(root,['--check'],{check:true}));}catch{return null;}
  if(report?.status!=='update-required')return null;
  let output;try{output=await runInitializer(root,['--upgrade']);}
  catch(e){throw new Error(`This world's Kiln workspace is out of date for the installed Kiln and could not be upgraded. ${e.message}`);}
  try{return JSON.parse(output);}catch{return {status:'current',changed:[]};}
}
function runInitializer(root,flags,{check=false}={}){
  // Kiln exports lib/index.js for ESM (1.3.1 and 1.4.0); resolve it without evaluating the
  // engine. Normal package lookup supports both nested and hoisted installs.
  const initializer=fileURLToPath(new URL('../scripts/create-workspace.mjs',import.meta.resolve('@instruktlabs/kiln')));
  return new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[initializer,root,...flags],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='',errors='';
    child.stdout.on('data',d=>{output=(output+d).slice(-200000);});child.stderr.on('data',d=>{errors=(errors+d).slice(-4000);});child.on('error',reject);
    // --check exits 1 for a workspace that needs work, with its report on stdout.
    child.on('exit',code=>code===0||check&&code===1&&output?resolve(output):reject(new Error(`Kiln workspace setup failed. Run kiln-init --check for this world. ${(errors||output).trim().slice(-1000)}`)));
  });
}
// Holodeck runs Claude Code with --setting-sources user, which loads no
// project skills, CLAUDE.md or AGENTS.md (measured on Claude Code 2.1.300).
// Copy the world's installed skills into a session-only plugin instead, so
// they load as skills without the world's settings, hooks or MCP files.
export const PLUGIN_NAME='holodeck-world';
const SKILL_REGISTRIES=['.claude/skills','.agents/skills','skills'],EXCLUDED_SKILLS=new Set(['kiln-compose-scene']);
export async function worldSkillsPlugin(root,directory){
  await rm(directory,{recursive:true,force:true});
  const names=[];
  for(const registry of SKILL_REGISTRIES){
    let entries=[];try{entries=await readdir(path.join(root,registry),{withFileTypes:true});}catch{continue;}
    for(const entry of entries){
      if(!entry.isDirectory()||names.includes(entry.name)||EXCLUDED_SKILLS.has(entry.name)||!/^[a-z0-9][-a-z0-9]{0,63}$/.test(entry.name))continue;
      const source=path.join(root,registry,entry.name);
      try{await access(path.join(source,'SKILL.md'));}catch{continue;}
      await cp(source,path.join(directory,'skills',entry.name),{recursive:true,filter:async file=>!(await lstat(file)).isSymbolicLink()});
      names.push(entry.name);
    }
  }
  if(!names.length)return null;
  await mkdir(path.join(directory,'.claude-plugin'),{recursive:true});
  await writeFile(path.join(directory,'.claude-plugin/plugin.json'),JSON.stringify({name:PLUGIN_NAME,version:'0.0.0',description:'Skills installed in this Holodeck world, loaded for this session only.'}));
  return {directory,skills:names.sort()};
}
// The world's kiln_workspace MCP server as a provider-neutral stdio launch.
export async function kilnServer(root){
  let manifest;try{manifest=JSON.parse(await readFile(path.join(root,'.kiln/workspace.json'),'utf8'));}catch{return null;}
  const runtime=manifest.runtime,node=manifest.node||process.execPath;
  if(typeof runtime!=='string'||typeof node!=='string')throw new Error('Repair the Kiln workspace manifest before connecting');
  const server=path.join(runtime,'dist/mcp-server.mjs');await access(server);await access(node);
  return {command:node,args:[server],env:{KILN_WORKSPACE:root,KILN_PROGRAM_STORE:path.join(root,'.kiln/programs'),KILN_RENDER:'auto'}};
}
export async function kilnOverrides(root){
  const server=await kilnServer(root);if(!server)return [];
  return [
    ['mcp_servers.kiln_workspace.command',server.command],['mcp_servers.kiln_workspace.args',server.args],
    ...Object.entries(server.env).map(([key,value])=>[`mcp_servers.kiln_workspace.env.${key}`,value]),
  ].flatMap(([key,value])=>['-c',`${key}=${JSON.stringify(value)}`]);
}
