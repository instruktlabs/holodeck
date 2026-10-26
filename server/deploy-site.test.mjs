import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink,readdir,readFile,cp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {renderSite,SITE_URL} from '../scripts/render-site.mjs';
import {deploy,preflight,parseArgs,WRANGLER_VERSION} from '../scripts/deploy-site.mjs';

const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a63sAAAAASUVORK5CYII=','base64');
// The same PNG with a 1200×630 header: the site checks card sizes, not pixels.
const CARD=Buffer.from(PNG);CARD.writeUInt32BE(1200,16);CARD.writeUInt32BE(630,20);
const HEAD='a'.repeat(40);
const ACCOUNT='0123456789abcdef0123456789abcdef';
// Tests set the environment themselves, so a runner's own variables never leak in;
// the Pages API is the fixture's stub.
const go=options=>deploy({env:{CLOUDFLARE_API_TOKEN:'test-value',CLOUDFLARE_ACCOUNT_ID:ACCOUNT},fetch:options.run?.fetch,...options});
const SHOTS=Array.from({length:4},(_,i)=>({src:'images/cove.png',alt:`Cove shot ${i+1}`}));
const scenes=title=>JSON.stringify([{id:'cove',example:'construct',title,summary:'A small cove.',shots:SHOTS,path:'worlds/cove/',updated:'2026-10-26'}]);

// A one-scene shelf, rendered current, and a site built from it, with git and
// Wrangler and the Pages API replaced by recorders.
async function fixture(t){
 const root=await mkdtemp(path.join(os.tmpdir(),'holodeck-deploy-')),site=path.join(root,'site'),built=path.join(root,'built');t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(path.join(site,'images'),{recursive:true});await mkdir(path.join(site,'cards'));await mkdir(path.join(site,'about'));
 await writeFile(path.join(site,'about/index.html'),'<title>About</title>');
 await writeFile(path.join(site,'scenes.json'),scenes('The Cove'));
 await writeFile(path.join(site,'images/cove.png'),PNG);await writeFile(path.join(site,'cards/cove.jpg'),CARD);
 await writeFile(path.join(site,'index.html'),'<!-- scenes:start --><!-- scenes:end --><!-- jsonld:start --><!-- jsonld:end -->');
 for(const [name,text] of Object.entries(await renderSite(site)))await writeFile(path.join(site,name),text);
 await cp(site,built,{recursive:true,filter:source=>path.relative(site,source).split(path.sep)[0]!=='cards'});
 await mkdir(path.join(built,'worlds/cove'),{recursive:true});
 await writeFile(path.join(built,'worlds/cove/index.html'),`<link rel="canonical" href="${SITE_URL}worlds/cove/">`);
 await writeFile(path.join(built,'worlds/cove/preview.jpg'),CARD);
 await writeFile(path.join(built,'worlds/cove/scene.json'),'{}');
 await writeFile(path.join(built,'worlds/cove/manifest.json'),JSON.stringify({files:[{file:'scene.json',sha256:'44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'}]}));
 const listed=async()=>(await readdir(site,{recursive:true,withFileTypes:true})).filter(e=>e.isFile()).map(e=>path.relative(root,path.join(e.parentPath??e.path,e.name)).replaceAll('\\','/'));
 const state={status:'',tracked:await listed(),version:WRANGLER_VERSION,calls:[],onVersion:null,requests:[],http:200,project:{production_branch:'main',domains:['holodeck-site.pages.dev','holodeck.kilnstudio.tools']}};
 const run=async(file,args)=>{
  state.calls.push([file,...args]);
  if(file==='git'){const op=args[2];if(op==='rev-parse')return HEAD;if(op==='status')return state.status;if(op==='ls-files')return state.tracked.join('\0');}
  if(args.includes('--version')){await state.onVersion?.();return `wrangler ${state.version}\n`;}
  if(args.includes('pages'))return '';
  throw new Error(`unexpected ${file} ${args.join(' ')}`);
 };
 run.fetch=async(url,init)=>{state.requests.push([url,init]);return {status:state.http,ok:state.http<300,json:async()=>state.http<300?{success:true,result:state.project}:{success:false,errors:[{message:'refused'}]}};};
 return {root,site,built,state,run};
}

test('a dry run checks the built site, records its digest for CI, and never prepares Wrangler',async t=>{
 const {root,built,state,run}=await fixture(t),lines=[],output=path.join(root,'github-output');
 const result=await go({root,siteDir:built,projectName:'holodeck-site',dryRun:true,githubOutput:output,run,log:line=>lines.push(line)});
 assert.equal(result.deployed,false);assert.equal(result.preflight.head,HEAD);assert.equal(result.preflight.files,10);
 assert.match(lines[0],/holodeck-site\/main/);assert.match(lines[1],/Dry run/);
 assert.equal(state.calls.some(c=>c.includes('--version')||c.includes('pages')),false);
 assert.equal(await readFile(output,'utf8'),`sha256=${result.preflight.sha256}\nfiles=10\nbytes=${result.preflight.bytes}\nhead=${HEAD}\n`);
});

test('without a site folder, a deploy builds one into a temporary folder and removes it',async t=>{
 const {root,built,run}=await fixture(t);let out;
 const build=async options=>{out=options.out;await cp(built,out,{recursive:true});};
 const result=await go({root,projectName:'holodeck-site',dryRun:true,build,run,log:()=>{}});
 assert.equal(result.preflight.site,out);await assert.rejects(readdir(out),{code:'ENOENT'});
});

test('a deploy pins Wrangler, rechecks the site and uploads only the built folder at HEAD',async t=>{
 const {root,built,state,run}=await fixture(t);
 await go({root,siteDir:built,projectName:'holodeck-site',wrangler:'wrangler',run,log:()=>{}});
 assert.deepEqual(state.requests,[[`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects/holodeck-site`,{headers:{Authorization:'Bearer test-value'}}]],'the production branch is read, never changed');
 const upload=state.calls.find(c=>c.includes('deploy'));
 assert.deepEqual(upload,['wrangler','pages','deploy',built,'--project-name','holodeck-site','--branch','main','--commit-hash',HEAD,'--commit-dirty=false']);
 assert.equal(state.calls.filter(c=>c[0]==='git'&&c[3]==='status').length,2,'preflight runs again after Wrangler is ready');
 await assert.rejects(go({root,siteDir:built,projectName:'holodeck-site',wrangler:'wrangler',env:{CLOUDFLARE_ACCOUNT_ID:ACCOUNT},run,log:()=>{}}),/CLOUDFLARE_API_TOKEN is not set/);
 await assert.rejects(go({root,siteDir:built,projectName:'holodeck-site',wrangler:'wrangler',env:{CLOUDFLARE_API_TOKEN:'test-value',CLOUDFLARE_ACCOUNT_ID:'kiln'},run,log:()=>{}}),/32-character/);
 state.version='4.146.0';
 await assert.rejects(go({root,siteDir:built,projectName:'holodeck-site',wrangler:'wrangler',run,log:()=>{}}),/requires Wrangler 4\.147\.0/);
});

test('the locked deploy package supplies Wrangler when it is installed',async t=>{
 const {root,built,state,run}=await fixture(t),bin=path.join(root,'deploy/node_modules/wrangler/bin/wrangler.js');
 await mkdir(path.dirname(bin),{recursive:true});await writeFile(bin,'');
 await go({root,siteDir:built,projectName:'holodeck-site',run,log:()=>{}});
 assert.deepEqual(state.calls.find(c=>c.includes('--version')),[process.execPath,bin,'--version']);
 assert.deepEqual(state.calls.find(c=>c.includes('deploy')).slice(0,3),[process.execPath,bin,'pages']);
});

test('a deploy job uploads only the folder its build job hashed',async t=>{
 const {root,built,state,run}=await fixture(t),{preflight:{sha256}}=await go({root,siteDir:built,projectName:'holodeck-site',dryRun:true,run,log:()=>{}});
 await go({root,siteDir:built,projectName:'holodeck-site',expectSha256:sha256,wrangler:'wrangler',run,log:()=>{}});
 await writeFile(path.join(built,'images/cove.png'),Buffer.concat([PNG,Buffer.from('x')]));
 await assert.rejects(go({root,siteDir:built,projectName:'holodeck-site',expectSha256:sha256,wrangler:'wrangler',run,log:()=>{}}),/differs from site\/images\/cove\.png/);
 await assert.rejects(go({root,siteDir:built,projectName:'holodeck-site',expectSha256:'b'.repeat(64),dryRun:true,run,log:()=>{}}),/differs from site/);
 assert.equal(state.calls.filter(c=>c.includes('pages')&&c.includes('deploy')).length,1);
});

test('a preview never uses the production branch, and a production upload never makes a preview',async t=>{
 const {root,built,state,run}=await fixture(t);
 await go({root,siteDir:built,projectName:'holodeck-site',preview:true,branch:'pr-12',wrangler:'wrangler',run,log:()=>{}});
 assert.deepEqual(state.calls.find(c=>c.includes('deploy')).slice(6,8),['--branch','pr-12']);
 await assert.rejects(go({root,siteDir:built,projectName:'holodeck-site',preview:true,branch:'main',wrangler:'wrangler',run,log:()=>{}}),/production branch; a preview must use another branch/);
 await assert.rejects(go({root,siteDir:built,projectName:'holodeck-site',branch:'production',wrangler:'wrangler',run,log:()=>{}}),/production branch is main, not production; this upload would only make a preview/);
 assert.equal(state.calls.filter(c=>c.includes('deploy')).length,1,'only the preview was uploaded');
});

test('the production branch comes from the project settings, so the first deploy works too',async t=>{
 const {root,built,state,run}=await fixture(t),lines=[];
 // A new project has no deployments; its settings still name the production branch.
 state.project={production_branch:'main',domains:['holodeck-site.pages.dev']};
 await go({root,siteDir:built,projectName:'holodeck-site',wrangler:'wrangler',run,log:line=>lines.push(line)});
 assert.ok(lines.some(line=>/holodeck\.kilnstudio\.tools is not attached/.test(line)),'a missing custom domain is reported');
 state.http=404;await assert.rejects(go({root,siteDir:built,projectName:'holodeck-site',wrangler:'wrangler',run,log:()=>{}}),/does not exist/);
 state.http=403;await assert.rejects(go({root,siteDir:built,projectName:'holodeck-site',wrangler:'wrangler',run,log:()=>{}}),/refused the project lookup \(HTTP 403\)/);
 state.http=200;state.project={domains:[]};await assert.rejects(go({root,siteDir:built,projectName:'holodeck-site',wrangler:'wrangler',run,log:()=>{}}),/no production branch/);
 assert.equal(state.calls.filter(c=>c.includes('deploy')).length,1,'only the first deploy uploaded');
});

test('a site that changes while Wrangler is prepared is not uploaded',async t=>{
 const {root,built,state,run}=await fixture(t);
 state.onVersion=()=>writeFile(path.join(built,'worlds/cove/extra.txt'),'x');
 await assert.rejects(go({root,siteDir:built,projectName:'holodeck-site',wrangler:'wrangler',run,log:()=>{}}),/changed while preparing/);
 assert.equal(state.calls.some(c=>c.includes('pages')&&c.includes('deploy')),false);
});

test('the preflight refuses dirty, uncommitted, stale, unfinished, foreign and Worker inputs',async t=>{
 const {root,site,built,state,run}=await fixture(t);
 state.status=' M site/index.html';await assert.rejects(preflight({root,siteDir:built,run}),/uncommitted or untracked/);state.status='';
 await writeFile(path.join(site,'notes.txt'),'ignored local file');await cp(path.join(site,'notes.txt'),path.join(built,'notes.txt'));
 await assert.rejects(preflight({root,siteDir:built,run}),/site\/notes\.txt is not committed/);await rm(path.join(site,'notes.txt'));
 await assert.rejects(preflight({root,siteDir:built,run}),/notes\.txt, which is neither in site\/ nor in a catalog scene/);await rm(path.join(built,'notes.txt'));
 state.tracked.push('site/gone.txt');await assert.rejects(preflight({root,siteDir:built,run}),/committed but missing/);state.tracked.pop();
 await writeFile(path.join(built,'worlds/cove/scene.json'),'{"changed":true}');await assert.rejects(preflight({root,siteDir:built,run}),/does not match its manifest/);await writeFile(path.join(built,'worlds/cove/scene.json'),'{}');
 await rm(path.join(built,'index.html'));await assert.rejects(preflight({root,siteDir:built,run}),/no index\.html/);await cp(path.join(site,'index.html'),path.join(built,'index.html'));
 await writeFile(path.join(site,'scenes.json'),scenes('Renamed'));
 await assert.rejects(preflight({root,siteDir:built,run}),/stale/);
 const fresh=await fixture(t);
 await writeFile(path.join(fresh.built,'worlds/cove/EXPORT-INCOMPLETE.txt'),'x');
 await assert.rejects(preflight({root:fresh.root,siteDir:fresh.built,run:fresh.run}),/unfinished export/);
 const worker=await fixture(t);await writeFile(path.join(worker.built,'_worker.js'),'export default {}');
 await assert.rejects(preflight({root:worker.root,siteDir:worker.built,run:worker.run}),/refuses _worker\.js in the built site/);
 const linked=await fixture(t);
 try{await symlink(path.join(linked.built,'images/cove.png'),path.join(linked.built,'images/link.png'));}catch{return;}// Windows without symlink rights.
 await assert.rejects(preflight({root:linked.root,siteDir:linked.built,run:linked.run}),/Symlink/);
});

test('the project name is required and options are strict',async()=>{
 await assert.rejects(go({dryRun:true}),/--project-name/);
 await assert.rejects(go({projectName:'Holodeck Site',dryRun:true}),/--project-name/);
 await assert.rejects(go({projectName:'holodeck',wrangler:'wrangler.cmd'}),/\.cmd/);
 await assert.rejects(go({projectName:'holodeck',expectSha256:'abc'}),/SHA-256/);
 assert.deepEqual(parseArgs(['--project-name','holodeck','--dry-run']),{projectName:'holodeck',dryRun:true});
 assert.deepEqual(parseArgs(['--project-name','holodeck','--preview','--branch','pr-3','--site-dir','out']),{projectName:'holodeck',preview:true,branch:'pr-3',siteDir:'out'});
 assert.throws(()=>parseArgs(['--project-name','holodeck','--preview']),/own --branch/);
 assert.throws(()=>parseArgs(['--project-name']),/Missing value/);assert.throws(()=>parseArgs(['--force']),/Unknown/);
});
