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
export async function kilnOverrides(root){
  let manifest;try{manifest=JSON.parse(await readFile(path.join(root,'.kiln/workspace.json'),'utf8'));}catch{return [];}
  const runtime=manifest.runtime,node=manifest.node||process.execPath;
  if(typeof runtime!=='string'||typeof node!=='string')throw new Error('Repair the Kiln workspace manifest before connecting');
  const server=path.join(runtime,'dist/mcp-server.mjs');await access(server);await access(node);
  return [
    ['mcp_servers.kiln_workspace.command',node],['mcp_servers.kiln_workspace.args',[server]],
    ['mcp_servers.kiln_workspace.env.KILN_WORKSPACE',root],['mcp_servers.kiln_workspace.env.KILN_PROGRAM_STORE',path.join(root,'.kiln/programs')],
    ['mcp_servers.kiln_workspace.env.KILN_RENDER','auto'],
  ].flatMap(([key,value])=>['-c',`${key}=${JSON.stringify(value)}`]);
}
