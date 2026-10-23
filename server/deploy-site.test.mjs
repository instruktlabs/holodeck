import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {renderSite,SITE_URL} from '../scripts/render-site.mjs';
import {deploy,preflight,parseArgs,WRANGLER_VERSION} from '../scripts/deploy-site.mjs';

const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a63sAAAAASUVORK5CYII=','base64');
const HEAD='a'.repeat(40);

// A one-scene site, rendered current, with git and Wrangler replaced by a recorder.
async function fixture(t){
 const root=await mkdtemp(path.join(os.tmpdir(),'holodeck-deploy-')),site=path.join(root,'site');t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(path.join(site,'worlds/cove'),{recursive:true});await mkdir(path.join(site,'images'));
 await writeFile(path.join(site,'scenes.json'),JSON.stringify([{id:'cove',title:'The Cove',summary:'A small cove.',preview:'images/cove.png',previewAlt:'The cove',path:'worlds/cove/'}]));
 await writeFile(path.join(site,'worlds/cove/index.html'),`<link rel="canonical" href="${SITE_URL}worlds/cove/">`);
 await writeFile(path.join(site,'worlds/cove/preview.jpg'),PNG);await writeFile(path.join(site,'images/cove.png'),PNG);
 await writeFile(path.join(site,'index.html'),'<!-- scenes:start --><!-- scenes:end --><!-- jsonld:start --><!-- jsonld:end -->');
 for(const [name,text] of Object.entries(await renderSite(site)))await writeFile(path.join(site,name),text);
 const listed=async()=>(await readdir(site,{recursive:true,withFileTypes:true})).filter(e=>e.isFile()).map(e=>path.relative(root,path.join(e.parentPath??e.path,e.name)).replaceAll('\\','/'));
 const state={status:'',tracked:await listed(),version:WRANGLER_VERSION,calls:[],onVersion:null};
 const run=async(file,args)=>{
  state.calls.push([file,...args]);
  if(file==='git'){const op=args[2];if(op==='rev-parse')return HEAD;if(op==='status')return state.status;if(op==='ls-files')return state.tracked.join('\0');}
  if(args.includes('--version')){await state.onVersion?.();return `wrangler ${state.version}\n`;}
  if(args.includes('pages'))return '';
  throw new Error(`unexpected ${file} ${args.join(' ')}`);
 };
 return {root,site,state,run};
}

test('a dry run checks the committed site and never prepares Wrangler',async t=>{
 const {root,state,run}=await fixture(t),lines=[];
 const result=await deploy({root,projectName:'holodeck-site',dryRun:true,run,log:line=>lines.push(line)});
 assert.equal(result.deployed,false);assert.equal(result.preflight.head,HEAD);assert.equal(result.preflight.files,state.tracked.length);
 assert.match(lines[0],/holodeck-site\/production/);assert.match(lines[1],/Dry run/);
 assert.equal(state.calls.some(c=>c.includes('--version')||c.includes('pages')),false);
});

test('a deploy pins Wrangler, rechecks the site and uploads only site/ at HEAD',async t=>{
 const {root,site,state,run}=await fixture(t);
 await deploy({root,projectName:'holodeck-site',wrangler:'wrangler',run,log:()=>{}});
 const upload=state.calls.find(c=>c.includes('pages'));
 assert.deepEqual(upload,['wrangler','pages','deploy',site,'--project-name','holodeck-site','--branch','production','--commit-hash',HEAD,'--commit-dirty=false']);
 assert.equal(state.calls.filter(c=>c[0]==='git'&&c[3]==='status').length,2,'preflight runs again after Wrangler is ready');
 state.version='4.146.0';
 await assert.rejects(deploy({root,projectName:'holodeck-site',wrangler:'wrangler',run,log:()=>{}}),/requires Wrangler 4\.147\.0/);
});

test('a site that changes while Wrangler is prepared is not uploaded',async t=>{
 const {root,site,state,run}=await fixture(t);
 state.onVersion=()=>writeFile(path.join(site,'images/cove.png'),Buffer.concat([PNG,Buffer.from('x')]));
 await assert.rejects(deploy({root,projectName:'holodeck-site',wrangler:'wrangler',run,log:()=>{}}),/changed while preparing/);
 assert.equal(state.calls.some(c=>c.includes('pages')),false);
});

test('the preflight refuses dirty, uncommitted, stale, unfinished and Worker inputs',async t=>{
 const {root,site,state,run}=await fixture(t);
 state.status=' M site/index.html';await assert.rejects(preflight({root,run}),/uncommitted or untracked/);state.status='';
 await writeFile(path.join(site,'notes.txt'),'ignored local file');await assert.rejects(preflight({root,run}),/site\/notes\.txt is not committed/);await rm(path.join(site,'notes.txt'));
 state.tracked.push('site/gone.txt');await assert.rejects(preflight({root,run}),/committed but missing/);state.tracked.pop();
 await writeFile(path.join(site,'scenes.json'),JSON.stringify([{id:'cove',title:'Renamed',summary:'A small cove.',preview:'images/cove.png',previewAlt:'The cove',path:'worlds/cove/'}]));
 await assert.rejects(preflight({root,run}),/stale/);
 const fresh=await fixture(t);
 await writeFile(path.join(fresh.site,'worlds/cove/EXPORT-INCOMPLETE.txt'),'x');fresh.state.tracked.push('site/worlds/cove/EXPORT-INCOMPLETE.txt');
 await assert.rejects(preflight({root:fresh.root,run:fresh.run}),/unfinished export/);
 const worker=await fixture(t);await writeFile(path.join(worker.site,'_worker.js'),'export default {}');
 await assert.rejects(preflight({root:worker.root,run:worker.run}),/refuses site\/_worker\.js/);
 const linked=await fixture(t);
 try{await symlink(path.join(linked.site,'images/cove.png'),path.join(linked.site,'images/link.png'));}catch{return;}// Windows without symlink rights.
 await assert.rejects(preflight({root:linked.root,run:linked.run}),/Symlink/);
});

test('the project name is required and options are strict',async()=>{
 await assert.rejects(deploy({dryRun:true}),/--project-name/);
 await assert.rejects(deploy({projectName:'Holodeck Site',dryRun:true}),/--project-name/);
 await assert.rejects(deploy({projectName:'holodeck',wrangler:'wrangler.cmd'}),/\.cmd/);
 assert.deepEqual(parseArgs(['--project-name','holodeck','--dry-run']),{projectName:'holodeck',dryRun:true});
 assert.throws(()=>parseArgs(['--project-name']),/Missing value/);assert.throws(()=>parseArgs(['--force']),/Unknown/);
});
