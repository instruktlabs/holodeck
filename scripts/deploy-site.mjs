// Upload the reviewed, committed site/ folder to Cloudflare Pages after release
// authorization. It mirrors Kiln's site/scripts/deploy.mjs: offline checks, an
// exact Wrangler pin, and a recheck right before upload. It builds nothing and
// never logs in, uploads assets elsewhere or changes DNS. Holodeck's Pages project
// is `holodeck`, whose production branch is `main`.
// Usage: node scripts/deploy-site.mjs --project-name NAME [--branch main] [--wrangler EXECUTABLE] [--dry-run]
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstat,readFile,readdir,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderSite} from './render-site.mjs';

export const WRANGLER_VERSION='4.147.0';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const MAX_FILES=20_000,MAX_FILE_BYTES=25*1024*1024;
const fail=message=>{throw new Error(message);};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

export function execute(file,args,{cwd,inherit=false}={},exec=execFileSync){
 return exec(file,args,{cwd,shell:false,encoding:'utf8',maxBuffer:64*1024*1024,stdio:inherit?['ignore','inherit','inherit']:['ignore','pipe','pipe']})??'';
}

// Every entry under site/, with symlinks and special files refused.
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

// The deployed bytes are exactly the committed site/ folder at a clean HEAD, with
// a current shelf, complete scene exports and no Worker or Functions inputs.
export async function preflight({root=ROOT,run=execute}={}){
 root=path.resolve(root);const site=path.join(root,'site');
 for(const [directory,name] of [[root,'functions'],[site,'functions'],[site,'_worker.js'],[site,'_routes.json']]){
  try{await lstat(path.join(directory,name));}catch(error){if(error.code==='ENOENT')continue;throw error;}
  fail(`Static deployment refuses ${path.relative(root,path.join(directory,name)).replaceAll('\\','/')}. Worker and Functions inputs need a separately reviewed workflow.`);
 }
 const files=await siteFiles(site);
 if(!files.has('index.html'))fail('Missing site/index.html.');
 for(const name of files.keys())if(/(^|\/)(EXPORT|EXAMPLE|INSTALL|REMIX)-INCOMPLETE\.txt$/.test(name))fail(`An unfinished export is in the site: ${name}`);
 const rendered=await renderSite(site);
 for(const [name,text] of Object.entries(rendered))if((await readFile(path.join(site,name),'utf8').catch(()=>null))!==text)fail(`site/${name} is stale. Run npm run render:site, review and commit.`);
 // No pathspec on status: a change anywhere in the checkout invalidates the reviewed commit.
 const git=async(...args)=>String(await run('git',['-C',root,...args],{cwd:root})).trim();
 const head=await git('rev-parse','--verify','HEAD');if(!/^[0-9a-f]{40,64}$/.test(head))fail('Cannot resolve the checkout HEAD.');
 if(await git('status','--porcelain','--untracked-files=all'))fail('The checkout has uncommitted or untracked changes. Commit and review before deployment.');
 // Ignored files never show in status, so the tracked list must match the folder exactly.
 const tracked=new Set((await git('ls-files','-z','--','site')).split('\0').filter(Boolean).map(name=>name.replace(/^site\//,'')));
 for(const name of files.keys())if(!tracked.has(name))fail(`site/${name} is not committed.`);
 for(const name of tracked)if(!files.has(name))fail(`site/${name} is committed but missing.`);
 const listing=[...files].sort(([a],[b])=>a<b?-1:1);let bytes=0;const hash=createHash('sha256');
 for(const [name,file] of listing){const content=await readFile(file.path);if(content.length!==file.bytes)fail(`site/${name} changed during preflight.`);bytes+=content.length;hash.update(`${name}\0${digest(content)}\n`);}
 return {root,site,head,files:files.size,bytes,sha256:hash.digest('hex')};
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

// A branch that is not the project's production branch only makes a preview, so the
// upload names the branch of the project's current production deployment (read-only).
export function productionBranch(listing){
 let rows;try{rows=JSON.parse(listing);}catch{fail('Wrangler did not return the production deployments as JSON.');}
 if(!Array.isArray(rows))fail('Wrangler did not return a deployment list.');
 const branches=[...new Set(rows.filter(row=>row?.Environment==='Production').map(row=>row.Branch))];
 if(!branches.length)fail('The project has no production deployment to confirm its production branch. Make the first one deliberately in Cloudflare.');
 if(branches.length>1||typeof branches[0]!=='string')fail(`Production deployments name more than one branch: ${branches.join(', ')}.`);
 return branches[0];
}

// The full preflight runs in a dry run too. Only an authorized non-dry run prepares Wrangler and uploads.
export async function deploy({root=ROOT,projectName,branch='main',wrangler,dryRun=false,npmCli,run=execute,log=console.log}={}){
 if(typeof projectName!=='string'||!/^[a-z0-9][a-z0-9-]{0,57}$/.test(projectName))fail('Choose the Cloudflare Pages project with --project-name.');
 if(typeof branch!=='string'||!/^[a-z0-9][a-z0-9._/-]{0,99}$/i.test(branch))fail('Invalid Pages branch.');
 if(wrangler&&/\.(?:cmd|bat)$/i.test(wrangler))fail('Use the default pinned npm invocation instead of a Wrangler .cmd or .bat wrapper.');
 const initial=await preflight({root,run});
 log(`Verified ${initial.files} site files (${initial.bytes} bytes, sha256 ${initial.sha256}) at commit ${initial.head}; ${projectName}/${branch}.`);
 if(dryRun){log(`Dry run: no upload, package preparation or login. Deployment uses Wrangler ${WRANGLER_VERSION}.`);return {deployed:false,preflight:initial};}
 const command=wrangler?{file:wrangler,prefix:[]}:{file:process.execPath,prefix:[npmCli??await resolveNpmCli(),'exec','--yes',`--package=wrangler@${WRANGLER_VERSION}`,'--','wrangler']};
 const version=String(await run(command.file,[...command.prefix,'--version'],{cwd:initial.root})).match(/^\s*(?:wrangler\s+)?(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)\s*$/m)?.[1];
 if(version!==WRANGLER_VERSION)fail(`Deployment requires Wrangler ${WRANGLER_VERSION}; the executable did not report that exact version.`);
 const live=productionBranch(String(await run(command.file,[...command.prefix,'pages','deployment','list','--project-name',projectName,'--environment','production','--json'],{cwd:initial.root})));
 if(live!==branch)fail(`${projectName}'s production branch is ${live}, not ${branch}; this upload would only make a preview. Pass --branch ${live}.`);
 // Preparing Wrangler can take a while; recheck every byte and the Git state right before upload.
 const checked=await preflight({root:initial.root,run});
 if(checked.head!==initial.head||checked.sha256!==initial.sha256)fail('The site or HEAD changed while preparing Wrangler. Review it again.');
 await run(command.file,[...command.prefix,'pages','deploy',checked.site,'--project-name',projectName,'--branch',branch,'--commit-hash',checked.head,'--commit-dirty=false'],{cwd:checked.root,inherit:true});
 return {deployed:true,preflight:checked};
}

export function parseArgs(args){
 const options={},values={'--project-name':'projectName','--branch':'branch','--wrangler':'wrangler','--root':'root'};
 for(let i=0;i<args.length;i++){
  const arg=args[i];
  if(arg==='--dry-run')options.dryRun=true;
  else if(arg==='--help')options.help=true;
  else if(Object.hasOwn(values,arg)){const value=args[++i];if(!value||value.startsWith('--'))fail(`Missing value for ${arg}.`);options[values[arg]]=value;}
  else fail(`Unknown deployment option: ${arg}`);
 }
 return options;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const options=parseArgs(process.argv.slice(2));
  if(options.help)console.log(`Usage: node scripts/deploy-site.mjs --project-name NAME [--branch production] [--wrangler EXECUTABLE] [--dry-run]\nRun only after release authorization. A dry run performs the offline checks; deployment uses Wrangler ${WRANGLER_VERSION}.`);
  else await deploy(options);
 }catch(error){console.error(`Deployment refused: ${error.message}`);process.exitCode=1;}
}
