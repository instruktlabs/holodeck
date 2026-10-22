#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,realpath} from 'node:fs/promises';
import {scaffold} from '../server/scaffold.mjs';
import {defaultLaunchDirectory,openPrototype,parseLaunchArgs,prepareLaunchDirectory} from '../server/launch.mjs';
import {validateWorld,validateGlb} from '../src/world/contract.mjs';
const packageRoot=fileURLToPath(new URL('../',import.meta.url));
const [command,folder,...args]=process.argv.slice(2);
const usage='Usage: holodeck launch [directory] [--port 4186]; holodeck init <new-folder> [--example <id> | --bundle <local-directory>]; holodeck dev <folder> [--port 4186]; holodeck check <folder>; holodeck export <folder> --out <new-directory> [--revision N] [--title T --description D [--url https://…/] [--image preview.jpg] [--image-alt A] [--license https://…]]';
async function serve(root,port){
 await readFile(path.join(root,'world/world.json'));process.env.HOLODECK_WORKSPACE=root;
 await import('../scripts/prepare-runtime.mjs');
 const {createServer}=await import('vite'),server=await createServer({root:packageRoot,configFile:path.join(packageRoot,'vite.config.js'),server:{host:'127.0.0.1',port,strictPort:true}});
 await server.listen();const url=`http://127.0.0.1:${port}/prototype.html`;console.log(`Holodeck: ${url}`);
 return {server,url};
}
try{
 if(command==='launch'){
  const {directory,port}=parseLaunchArgs([folder,...args].filter(Boolean));
  const prepared=await prepareLaunchDirectory(directory?path.resolve(directory):defaultLaunchDirectory());
  if(prepared.created)console.log(`Created construct world at ${prepared.root}`);
  else console.log(`Opening ${prepared.title} at ${prepared.root}`);
  const {server,url}=await serve(prepared.root,port);openPrototype(url);
  const close=async()=>{await server.close();process.exit(0);};process.once('SIGINT',close);process.once('SIGTERM',close);
 }else{
 if(!folder||!['init','dev','check','export'].includes(command))throw new Error(usage);
 const root=path.resolve(folder);
 if(command==='init'){
  if(args.length&&!(args.length===2&&['--example','--bundle'].includes(args[0])&&args[1]&&!args[1].startsWith('--')))throw new Error('Use --example <id> or --bundle <local-directory>');
  if(args[0]==='--bundle'){const {installExampleBundle}=await import('../server/example-bundle.mjs');const world=await installExampleBundle(path.resolve(args[1]),root);console.log(`Created ${world.bible.title} world at ${root}`);}
  else {const example=args[1]??'construct';await scaffold(root,example);console.log(`Created ${example} world at ${root}`);}
 }else if(command==='export'){
  const pageFlags={'--title':'title','--description':'description','--url':'url','--image':'image','--image-alt':'imageAlt','--license':'license'};
  const options={};for(let i=0;i<args.length;i+=2){const name=args[i],value=args[i+1];if(!['--out','--revision',...Object.keys(pageFlags)].includes(name)||!value||value.startsWith('--')||Object.hasOwn(options,name))throw new Error('Use --out <new-directory>, optional --revision <non-negative integer> and optional page metadata (--title, --description, --url, --image, --image-alt, --license)');options[name]=value;}
  const page=Object.fromEntries(Object.entries(pageFlags).filter(([flag])=>options[flag]!==undefined).map(([flag,key])=>[key,key==='image'?path.resolve(options[flag]):options[flag]]));
  const revision=options['--revision']===undefined?undefined:Number(options['--revision']);if(revision!==undefined&&(!/^\d+$/.test(options['--revision'])||!Number.isSafeInteger(revision)))throw new Error('Choose a non-negative integer revision');
  const {exportStaticWorld}=await import('../server/static-export.mjs');const result=await exportStaticWorld(root,{out:options['--out'],revision,...(Object.keys(page).length?{page}:{})});
  console.log(`Exported revision ${result.revision}: ${result.files} files, ${result.assets} pinned assets at ${result.path}. Upload the entire directory to a static host.`);
 }else if(command==='check'){
  const world=JSON.parse(await readFile(path.join(root,'world/world.json'),'utf8'));validateWorld(world);
  const resolvedRoot=await realpath(root);
  for(const asset of world.scene.assets){const file=await realpath(path.resolve(root,asset.file)),relative=path.relative(resolvedRoot,file);if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Asset escapes workspace');validateGlb(await readFile(file),{foliage:asset.foliage});}
  console.log(`Valid schema v${world.schemaVersion} world: ${world.bible.title}. Browser behavior and performance are separate checks.`);
 }else{
  const i=args.indexOf('--port'),port=i<0?4186:Number(args[i+1]);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid port');
  const {server}=await serve(root,port);
  const close=async()=>{await server.close();process.exit(0);};process.once('SIGINT',close);process.once('SIGTERM',close);
 }
 }
}catch(error){console.error(error.message);process.exitCode=1;}
