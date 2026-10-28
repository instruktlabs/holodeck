// Upload a site built by scripts/build-site.mjs from a clean, committed checkout
// to Cloudflare Pages. The site workflow runs it: the build job checks and hashes
// the folder, and the deploy jobs upload exactly that folder, production only
// after approval in GitHub. Run by hand without --site-dir, it builds into a
// fresh temporary folder first. It mirrors Kiln's site/scripts/deploy.mjs:
// offline checks, an exact Wrangler pin, and a recheck right before upload. It
// never logs in, uploads assets elsewhere or changes DNS. Holodeck's Pages
// project is `holodeck`, whose production branch is `main`.
// Usage: node scripts/deploy-site.mjs --project-name NAME [--site-dir DIR] [--branch main | --preview --branch NAME]
//        [--expect-sha256 HASH] [--github-output FILE] [--wrangler EXECUTABLE] [--dry-run]
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {appendFile,lstat,mkdtemp,readFile,readdir,realpath,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {SITE_URL,renderSite} from './render-site.mjs';
import {buildSite,verifySite} from './build-site.mjs';

export const WRANGLER_VERSION='4.147.0';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const MAX_FILES=20_000,MAX_FILE_BYTES=25*1024*1024,SITE_HOST=new URL(SITE_URL).host;
const fail=message=>{throw new Error(message);};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

export function execute(file,args,{cwd,inherit=false}={},exec=execFileSync){
 return exec(file,args,{cwd,shell:false,encoding:'utf8',maxBuffer:64*1024*1024,stdio:inherit?['ignore','inherit','inherit']:['ignore','pipe','pipe']})??'';
}

// Every file in a site folder, with symlinks and special files refused.
async function siteFiles(site){
 const files=new Map();
 async function walk(target,name){
  const info=await lstat(target);
  if(info.isSymbolicLink())fail(`Symlink in the site: ${name||'site'}`);
  if(info.isDirectory()){for(const child of await readdir(target))await walk(path.join(target,child),name?`${name}/${child}`:child);}
  else if(info.isFile()&&name){
   if(info.size>MAX_FILE_BYTES)fail(`${name} exceeds the Pages 25 MiB file limit.`);
   files.set(name,{path:target,bytes:info.size});if(files.size>MAX_FILES)fail('The site exceeds the Pages 20,000-file limit.');
  }else fail(`Unsupported site entry: ${name||'site'}`);
 }
 await walk(site,'');return files;
}

// The deployed bytes are a site built from a clean HEAD: the committed shelf in
// site/ (current, without its cards) plus complete scene exports under worlds/
// and the Lab's lab/<id>/play/, with no Worker or Functions inputs.
export async function preflight({root=ROOT,siteDir,run=execute}={}){
 root=path.resolve(root);const site=path.join(root,'site');
 if(typeof siteDir!=='string'||!siteDir)fail('Choose the built site folder.');const built=path.resolve(siteDir);
 for(const [directory,name] of [[root,'functions'],[site,'functions'],[site,'_worker.js'],[site,'_routes.json'],[built,'functions'],[built,'_worker.js'],[built,'_routes.json']]){
  try{await lstat(path.join(directory,name));}catch(error){if(error.code==='ENOENT')continue;throw error;}
  fail(`Static deployment refuses ${directory===built?`${name} in the built site`:path.relative(root,path.join(directory,name)).replaceAll('\\','/')}. Worker and Functions inputs need a separately reviewed workflow.`);
 }
 const sources=await siteFiles(site),files=await siteFiles(built);
 if(!files.has('index.html'))fail('The built site has no index.html.');
 for(const name of files.keys())if(/(^|\/)(EXPORT|EXAMPLE|INSTALL|REMIX)-INCOMPLETE\.txt$/.test(name))fail(`An unfinished export is in the site: ${name}`);
 const rendered=await renderSite(site);
 for(const [name,text] of Object.entries(rendered))if((await readFile(path.join(site,name),'utf8').catch(()=>null))!==text)fail(`site/${name} is stale. Run npm run render:site, review and commit.`);
 for(const name of sources.keys()){
  if(name.startsWith('cards/'))continue;
  const file=files.get(name);if(!file)fail(`The built site lacks site/${name}.`);
  if(digest(await readFile(file.path))!==digest(await readFile(sources.get(name).path)))fail(`The built site's ${name} differs from site/${name}.`);
 }
 const scenes=await verifySite(built,site);
 for(const name of files.keys()){
  if(scenes.some(scene=>name.startsWith(scene.path)))continue;
  if(name.startsWith('worlds/')||!sources.has(name)||name.startsWith('cards/'))fail(`The built site has ${name}, which is neither in site/ nor in a catalog scene.`);
 }
 // No pathspec on status: a change anywhere in the checkout invalidates the reviewed commit.
 const git=async(...args)=>String(await run('git',['-C',root,...args],{cwd:root})).trim();
 const head=await git('rev-parse','--verify','HEAD');if(!/^[0-9a-f]{40,64}$/.test(head))fail('Cannot resolve the checkout HEAD.');
 if(await git('status','--porcelain','--untracked-files=all'))fail('The checkout has uncommitted or untracked changes. Commit and review before deployment.');
 // Ignored files never show in status, so the tracked list must match site/ exactly.
 const tracked=new Set((await git('ls-files','-z','--','site')).split('\0').filter(Boolean).map(name=>name.replace(/^site\//,'')));
 for(const name of sources.keys())if(!tracked.has(name))fail(`site/${name} is not committed.`);
 for(const name of tracked)if(!sources.has(name))fail(`site/${name} is committed but missing.`);
 const listing=[...files].sort(([a],[b])=>a<b?-1:1);let bytes=0;const hash=createHash('sha256');
 for(const [name,file] of listing){const content=await readFile(file.path);if(content.length!==file.bytes)fail(`${name} changed during preflight.`);bytes+=content.length;hash.update(`${name}\0${digest(content)}\n`);}
 return {root,site:built,head,files:files.size,bytes,sha256:hash.digest('hex')};
}

// Node runs npm's JavaScript directly, including on Windows: no .cmd shell or interpolation.
export async function resolveNpmCli({execPath=process.execPath,env=process.env,platform=process.platform}={}){
 const nodePaths=[execPath];try{nodePaths.push(await realpath(execPath));}catch{/* The executable directory still helps. */}
 const directories=[...nodePaths.map(path.dirname),...(env.PATH??env.Path??'').split(platform==='win32'?';':':').filter(Boolean)];
 for(const candidate of [env.npm_execpath,...directories.flatMap(directory=>[path.join(directory,'node_modules/npm/bin/npm-cli.js'),path.join(directory,'npm')])]){
  if(!candidate)continue;
  try{const file=await realpath(candidate);if(path.basename(file)==='npm-cli.js'&&(await lstat(file)).isFile())return file;}catch{/* Try the next standard npm location. */}
 }
 fail('Cannot find npm-cli.js. Install Node and npm, or pass --wrangler with the exact pinned executable.');
}

// The locked deploy/ package (npm ci --prefix deploy) is preferred: its lockfile
// pins Wrangler's dependencies too. Without it, npm fetches the exact version.
async function wranglerCommand({root,wrangler,npmCli}){
 if(wrangler)return {file:wrangler,prefix:[]};
 const bin=path.join(root,'deploy/node_modules/wrangler/bin/wrangler.js');
 try{if((await lstat(bin)).isFile())return {file:process.execPath,prefix:[bin]};}catch(error){if(error.code!=='ENOENT')throw error;}
 return {file:process.execPath,prefix:[npmCli??await resolveNpmCli(),'exec','--yes',`--package=wrangler@${WRANGLER_VERSION}`,'--','wrangler']};
}

// A branch that is not the project's production branch only makes a preview. The
// project's production_branch is read (read-only) from the Pages API with the deploy
// token: the same record Wrangler compares to decide production or preview, so it
// holds before the first deployment too. A production upload must name it; a
// preview upload must name any other branch.
export async function projectSettings({projectName,env,fetch:get=fetch}){
 const token=env.CLOUDFLARE_API_TOKEN,account=env.CLOUDFLARE_ACCOUNT_ID;
 if(!token)fail('CLOUDFLARE_API_TOKEN is not set. In CI, add it as a secret of the deploy environment; by hand, set it for this run.');
 if(!/^[0-9a-f]{32}$/.test(account??''))fail('CLOUDFLARE_ACCOUNT_ID must be the 32-character Cloudflare account ID.');
 const response=await get(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/${projectName}`,{headers:{Authorization:`Bearer ${token}`}});
 if(response.status===404)fail(`The Pages project ${projectName} does not exist. Create it in Cloudflare (direct upload, production branch main) first.`);
 let body;try{body=await response.json();}catch{fail('Cloudflare did not return the project as JSON.');}
 if(!response.ok||body?.success!==true)fail(`Cloudflare refused the project lookup (HTTP ${response.status}). Check the token's Pages permission and the account ID.`);
 const branch=body.result?.production_branch;if(typeof branch!=='string'||!branch)fail(`The Pages project ${projectName} has no production branch.`);
 return {branch,domains:Array.isArray(body.result.domains)?body.result.domains.filter(domain=>typeof domain==='string'):[]};
}

// The full preflight runs in a dry run too. Only a non-dry run prepares Wrangler and uploads.
export async function deploy({root=ROOT,projectName,branch='main',preview=false,siteDir,expectSha256,githubOutput,wrangler,dryRun=false,npmCli,env=process.env,fetch:get=fetch,run=execute,build=buildSite,log=console.log}={}){
 if(typeof projectName!=='string'||!/^[a-z0-9][a-z0-9-]{0,57}$/.test(projectName))fail('Choose the Cloudflare Pages project with --project-name.');
 if(typeof branch!=='string'||!/^[a-z0-9][a-z0-9._/-]{0,99}$/i.test(branch))fail('Invalid Pages branch.');
 if(expectSha256!==undefined&&!/^[0-9a-f]{64}$/.test(expectSha256))fail('--expect-sha256 must be a SHA-256 hex digest.');
 if(wrangler&&/\.(?:cmd|bat)$/i.test(wrangler))fail('Use the default pinned npm invocation instead of a Wrangler .cmd or .bat wrapper.');
 root=path.resolve(root);let work;
 try{
  if(!siteDir){work=await mkdtemp(path.join(os.tmpdir(),'holodeck-deploy-'));siteDir=path.join(work,'site');await build({root,out:siteDir,log});}
  const initial=await preflight({root,siteDir,run});
  log(`Verified ${initial.files} site files (${initial.bytes} bytes, sha256 ${initial.sha256}) at commit ${initial.head}; ${projectName}/${branch}${preview?' (preview)':''}.`);
  // A deploy job uploads only the folder its build job checked.
  if(expectSha256&&initial.sha256!==expectSha256)fail(`The site folder's sha256 is ${initial.sha256}, not the built ${expectSha256}.`);
  if(githubOutput)await appendFile(githubOutput,`sha256=${initial.sha256}\nfiles=${initial.files}\nbytes=${initial.bytes}\nhead=${initial.head}\n`);
  if(dryRun){log(`Dry run: no upload, package preparation or login. Deployment uses Wrangler ${WRANGLER_VERSION}.`);return {deployed:false,preflight:initial};}
  // Wrangler and the project lookup both use this token; there is no interactive login.
  const project=await projectSettings({projectName,env,fetch:get});
  if(preview&&project.branch===branch)fail(`${branch} is ${projectName}'s production branch; a preview must use another branch.`);
  if(!preview&&project.branch!==branch)fail(`${projectName}'s production branch is ${project.branch}, not ${branch}; this upload would only make a preview. Pass --branch ${project.branch}.`);
  if(!preview&&!project.domains.includes(SITE_HOST))log(`Note: ${SITE_HOST} is not attached to ${projectName} yet (${project.domains.join(', ')||'no domains'}); the deploy is live only on its pages.dev address until it is.`);
  const command=await wranglerCommand({root,wrangler,npmCli});
  const version=String(await run(command.file,[...command.prefix,'--version'],{cwd:initial.root})).match(/^\s*(?:wrangler\s+)?(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)\s*$/m)?.[1];
  if(version!==WRANGLER_VERSION)fail(`Deployment requires Wrangler ${WRANGLER_VERSION}; the executable did not report that exact version.`);
  // Preparing Wrangler can take a while; recheck every byte and the Git state right before upload.
  const checked=await preflight({root:initial.root,siteDir,run});
  if(checked.head!==initial.head||checked.sha256!==initial.sha256)fail('The site or HEAD changed while preparing Wrangler. Review it again.');
  await run(command.file,[...command.prefix,'pages','deploy',checked.site,'--project-name',projectName,'--branch',branch,'--commit-hash',checked.head,'--commit-dirty=false'],{cwd:checked.root,inherit:true});
  return {deployed:true,preflight:checked};
 }finally{if(work)await rm(work,{recursive:true,force:true});}
}

export function parseArgs(args){
 const options={},values={'--project-name':'projectName','--branch':'branch','--site-dir':'siteDir','--expect-sha256':'expectSha256','--github-output':'githubOutput','--wrangler':'wrangler','--root':'root'};
 for(let i=0;i<args.length;i++){
  const arg=args[i];
  if(arg==='--dry-run')options.dryRun=true;
  else if(arg==='--preview')options.preview=true;
  else if(arg==='--help')options.help=true;
  else if(Object.hasOwn(values,arg)){const value=args[++i];if(!value||value.startsWith('--'))fail(`Missing value for ${arg}.`);options[values[arg]]=value;}
  else fail(`Unknown deployment option: ${arg}`);
 }
 if(options.preview&&!options.branch)fail('A preview needs its own --branch.');
 return options;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const options=parseArgs(process.argv.slice(2));
  if(options.help)console.log(`Usage: node scripts/deploy-site.mjs --project-name NAME [--site-dir DIR] [--branch main | --preview --branch NAME] [--expect-sha256 HASH] [--github-output FILE] [--wrangler EXECUTABLE] [--dry-run]\nThe site workflow runs this; by hand, only after release authorization. A dry run performs the offline checks; deployment uses Wrangler ${WRANGLER_VERSION}.`);
  else await deploy(options);
 }catch(error){console.error(`Deployment refused: ${error.message}`);process.exitCode=1;}
}
