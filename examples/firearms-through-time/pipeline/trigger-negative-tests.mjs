// Prove game/trigger.test.mjs catches broken trigger timing: run it against copies of the workspace with one deliberate fault
// each in game/trigger.mjs or game/fire-frame.mjs, and expect failures. Writes evidence/m4-1742-v14/trigger-negative-tests.txt.
// The real modules are never modified.
import {cpSync,mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const FAULTS=[
 ['burst cam resets on release','game/trigger.mjs','if(!t.latched)t.engaged=false;','if(!t.latched){t.engaged=false;t.cam=0;}'],
 ['burst runs on past three rounds','game/trigger.mjs','t.engaged=t.down&&t.cam!==0;','t.engaged=t.down;'],
 ['cycle ignored: rounds leave together','game/trigger.mjs','t.readyAt=e.at+(fire.cycleSeconds??0);','t.readyAt=e.at;'],
 ['flintlock fires on the pull (no ignition delay)','game/trigger.mjs','t.pending.push(e.at+fire.ignitionDelaySeconds)','t.pending.push(e.at)'],
 ['events handled at the frame start','game/fire-frame.mjs','advance(e.in);left=Math.max(0,left-e.in);','left=Math.max(0,left-e.in);'],
 ['a round ignores the kick turned earlier in its frame','game/fire-frame.mjs','act(e.type,turn.slice())','act(e.type,[0,0])'],
 ['an empty reload takes the standard clip','game/weapon.mjs',"s.reloadKind=spec.reloadEmpty&&!s.ammo?'empty':'standard';","s.reloadKind='standard';"],
];
const lines=[];let caught=0;
for(const [name,file,from,to] of FAULTS){
 const source=readFileSync(path.join(root,file),'utf8');if(source.split(from).length!==2)throw Error('Fault anchor not found: '+name);
 const work=mkdtempSync(path.join(tmpdir(),'trigger-negative-'));
 try{
  cpSync(path.join(root,'game'),path.join(work,'game'),{recursive:true});mkdirSync(path.join(work,'pipeline'));
  cpSync(path.join(root,'pipeline/generate-trigger-fixtures-v1.mjs'),path.join(work,'pipeline/generate-trigger-fixtures-v1.mjs'));
  writeFileSync(path.join(work,file),source.replace(from,()=>to));
  const r=spawnSync(process.execPath,['--test','--test-timeout=60000','game/trigger.test.mjs'],{cwd:work,encoding:'utf8',timeout:120000}),failed=[...(r.stdout??'').matchAll(/^✖ (.+?) \(/gm)].map(m=>m[1]).filter(n=>!n.startsWith('failing tests'));
  const unique=[...new Set(failed)];if(r.status!==0&&unique.length)caught++;
  lines.push(`${r.status!==0&&unique.length?'CAUGHT':'MISSED'}  ${name} (${file}): ${unique.length} failing test(s)`,...unique.map(n=>'          - '+n));
 }finally{rmSync(work,{recursive:true,force:true});}
}
const report=`Trigger negative tests (${new Date().toISOString().slice(0,10)}): game/trigger.test.mjs against one deliberate fault each in a copy of the workspace\n\n${lines.join('\n')}\n\n${caught}/${FAULTS.length} faults caught\n`;
mkdirSync(path.join(root,'evidence/m4-1742-v14'),{recursive:true});writeFileSync(path.join(root,'evidence/m4-1742-v14/trigger-negative-tests.txt'),report);process.stdout.write(report);
if(caught!==FAULTS.length)process.exit(1);
