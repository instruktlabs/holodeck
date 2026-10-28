// Build the deployable site into a new folder: the committed shelf from site/
// (without its cards) plus each scene, installed fresh from its bundled example
// and exported with its page metadata, and each playable Lab scene at
// lab/<id>/play/. site/ itself is never written.
// Usage: node scripts/build-site.mjs --out <new-directory>
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cp,lstat,mkdir,mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';
import {SITE_URL,imageSize,labScenes,readLab,renderSite} from './render-site.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const CC0='https://creativecommons.org/publicdomain/zero/1.0/';
const fail=message=>{throw new Error(message);};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const runFile=async(file,args)=>(await promisify(execFile)(file,args,{maxBuffer:16*1024*1024})).stdout;

// The scene page metadata comes from the catalog, so the shelf card and the scene page agree.
export function exportArgs(scene,{world,out,card,root=ROOT}){
 return ['export',world,'--out',out,'--title',`${scene.title} · Holodeck`,'--description',`${scene.summary} Walk it in your browser.`,
  '--url',new URL(scene.path,SITE_URL).href,'--image',card,'--image-alt',scene.shots[0].alt,'--license',CC0,...(scene.extension?['--client-extension',path.join(root,scene.extension)]:[])];
}

// Every exported scene: the shelf's under worlds/, each with its card in cards/, then the
// Lab's playable scenes under lab/<id>/play/, each with its entry's card.
export async function siteScenes(site){
 const shelf=JSON.parse(await readFile(path.join(site,'scenes.json'),'utf8')).map(scene=>({...scene,card:`cards/${scene.id}.jpg`}));
 return [...shelf,...labScenes(await readLab(site))];
}

// Shelf files outside worlds/ are the committed site files, byte for byte; each
// scene export carries its canonical link, its card and an intact hash manifest.
export async function verifySite(dir,site){
 for(const name of ['scenes.json','lab.json']){
  const [committed,built]=await Promise.all([site,dir].map(root=>readFile(path.join(root,name)).catch(error=>{if(error.code==='ENOENT')return null;throw error;})));
  if((committed&&digest(committed))!==(built&&digest(built)))fail(`The built catalog differs from site/${name}.`);
 }
 const scenes=await siteScenes(site);
 for(const scene of scenes){
  const root=path.join(dir,scene.path),url=new URL(scene.path,SITE_URL).href,page=await readFile(path.join(root,'index.html'),'utf8').catch(()=>fail(`Scene ${scene.id} was not exported.`));
  if(!page.includes(`<link rel="canonical" href="${url}">`))fail(`Scene ${scene.id} export lacks its canonical link.`);
  const card=imageSize(await readFile(path.join(root,'preview.jpg')));if(card.width!==1200||card.height!==630)fail(`Scene ${scene.id} card must be 1200×630.`);
  const manifest=JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));
  for(const entry of manifest.files)if(digest(await readFile(path.join(root,entry.file)))!==entry.sha256)fail(`Scene ${scene.id} file ${entry.file} does not match its manifest.`);
 }
 return scenes;
}

export async function buildSite({root=ROOT,out,run=runFile,log=console.log}={}){
 if(typeof out!=='string'||!out.trim())fail('Choose a new output folder with --out.');
 root=path.resolve(root);out=path.resolve(out);const site=path.join(root,'site'),cli=path.join(root,'bin/holodeck.mjs');
 try{await lstat(out);fail(`The output folder already exists: ${out}`);}catch(error){if(error.code!=='ENOENT')throw error;}
 // The build never rewrites site/; a stale shelf is reported for review instead.
 for(const [name,text] of Object.entries(await renderSite(site)))if((await readFile(path.join(site,name),'utf8').catch(()=>null))!==text)fail(`site/${name} is stale. Run npm run render:site, review and commit.`);
 const scenes=await siteScenes(site);
 await mkdir(path.dirname(out),{recursive:true});
 await cp(site,out,{recursive:true,errorOnExist:true,force:false,verbatimSymlinks:true,filter:source=>!['cards','worlds'].includes(path.relative(site,source).split(path.sep)[0])});
 const work=await mkdtemp(path.join(os.tmpdir(),'holodeck-site-'));
 try{
  for(const scene of scenes){
   const world=path.join(work,scene.path.startsWith('lab/')?'lab':'',scene.id);await mkdir(path.dirname(world),{recursive:true});
   await run(process.execPath,[cli,'init',world,'--example',scene.example]);
   await run(process.execPath,[cli,...exportArgs(scene,{world,out:path.join(out,scene.path),card:path.join(site,scene.card),root})]);
   log(`Exported ${scene.path} from the ${scene.example} example.`);
  }
 }finally{await rm(work,{recursive:true,force:true});}
 await verifySite(out,site);
 return {out,scenes:scenes.length};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const args=process.argv.slice(2);if(args.length!==2||args[0]!=='--out')fail('Usage: node scripts/build-site.mjs --out <new-directory>');
  const result=await buildSite({out:args[1]});console.log(`Built ${result.scenes} scenes into ${result.out}.`);
 }catch(error){console.error(`Site build refused: ${error.message}`);process.exitCode=1;}
}
