import {spawn} from 'node:child_process';
import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export async function ensureKilnWorkspace(root){
  try{await access(path.join(root,'.kiln/workspace.json'));return;}catch{}
  // Kiln 1.3.1 exports lib/index.js for ESM; resolve it without evaluating the
  // engine. Normal package lookup supports both nested and hoisted installs.
  const initializer=fileURLToPath(new URL('../scripts/create-workspace.mjs',import.meta.resolve('@instruktlabs/kiln')));
  await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[initializer,root,'--adopt','--harness','codex','--skills','compose'],{cwd:root,windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';
    child.stdout.on('data',d=>{output=(output+d).slice(-12000);});child.stderr.on('data',()=>{});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Kiln workspace setup failed. Run kiln-init --check for this world. ${output.slice(-1000)}`)));
  });
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
