import {mkdir,readFile,stat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {scaffold} from './scaffold.mjs';
import {validateWorld} from '../src/world/contract.mjs';

const packageRoot=fileURLToPath(new URL('../',import.meta.url));

export function defaultLaunchDirectory(cwd=process.cwd()){
  return path.resolve(cwd,'..','holodeck-worlds','cove');
}

export function parseLaunchArgs(tokens){
  let directory,port=4186;
  for(let i=0;i<tokens.length;i++){
    const token=tokens[i];
    if(token==='--port'){
      const value=tokens[++i];
      if(!value||value.startsWith('--'))throw new Error('Use --port <1024-65535>');
      port=Number(value);
      if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid port');
    }else if(!directory&&token&&!token.startsWith('--'))directory=token;
    else throw new Error('Usage: holodeck launch [directory] [--port 4186]');
  }
  return {directory,port};
}

function outsideCheckout(root){
  const relative=path.relative(packageRoot,root);
  return relative.startsWith('..')||path.isAbsolute(relative);
}

async function readWorld(root){
  try{return JSON.parse(await readFile(path.join(root,'world/world.json'),'utf8'));}
  catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)return null;throw error;}
}

export async function prepareLaunchDirectory(root){
  const resolved=path.resolve(root);
  if(!outsideCheckout(resolved))throw new Error('Choose a world folder outside the Holodeck source checkout.');
  let info;
  try{info=await stat(resolved);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(!info){
    await mkdir(path.dirname(resolved),{recursive:true});
    const world=await scaffold(resolved,'construct');
    return {root:resolved,created:true,title:world.bible.title};
  }
  if(!info.isDirectory())throw new Error(`Refusing to use ${resolved}: it exists and is not a Holodeck world.`);
  const world=await readWorld(resolved);
  try{if(!world)throw new Error('missing');validateWorld(world);}
  catch{throw new Error(`Refusing to use ${resolved}: it exists and is not a Holodeck world.`);}
  return {root:resolved,created:false,title:world.bible.title};
}

export function openPrototype(url){
  const child=process.platform==='win32'
    ?spawn('cmd',['/c','start','',url],{detached:true,stdio:'ignore',windowsHide:true})
    :spawn(process.platform==='darwin'?'open':'xdg-open',[url],{detached:true,stdio:'ignore'});
  child.on('error',()=>{});
  child.unref();
}
