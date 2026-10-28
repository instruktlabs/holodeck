// Prove game/recoil.test.mjs catches broken recoil: run it against copies of the workspace with one deliberate fault each in
// game/recoil.mjs, and expect failures. Writes evidence/recoil-v1/negative-tests.txt. The real module is never modified.
import {cpSync,mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),source=readFileSync(path.join(root,'game/recoil.mjs'),'utf8');
const FAULTS=[
 ['wrong PRNG increment','a=(a+0x6D2B79F5)>>>0','a=(a+0x6D2B79F4)>>>0'],
 ['aim snaps to the kick (no rise)','v=s.view[i]*b+u*c*(a-b)','v=u*a'],
 ['no residual: the kick fully recovers','keep=r.residual.value','keep=0'],
 ['replayed shot kicks again','if(!shotId||shotId===s.lastShotId)return null;','if(!shotId)return null;'],
 ['pattern never advances','s.index=s.lastShotTime===null||s.time-s.lastShotTime>=r.resetAfter.value?0:s.index+1','s.index=0'],
];
const lines=[];let caught=0;
for(const [name,from,to] of FAULTS){
 if(source.split(from).length!==2)throw Error('Fault anchor not found: '+name);
 const work=mkdtempSync(path.join(tmpdir(),'recoil-negative-'));
 try{
  cpSync(path.join(root,'game'),path.join(work,'game'),{recursive:true});mkdirSync(path.join(work,'pipeline'));
  for(const f of ['build-recoil-profiles-v1.mjs','generate-recoil-fixtures-v1.mjs','generate-recoil-header.mjs'])cpSync(path.join(root,'pipeline',f),path.join(work,'pipeline',f));
  const header='native/ToolchainValidation/Source/ToolchainValidation/WeaponRecoilData.h';mkdirSync(path.dirname(path.join(work,header)),{recursive:true});cpSync(path.join(root,header),path.join(work,header));
  writeFileSync(path.join(work,'game/recoil.mjs'),source.replace(from,()=>to));
  const r=spawnSync(process.execPath,['--test','game/recoil.test.mjs'],{cwd:work,encoding:'utf8'}),failed=[...r.stdout.matchAll(/^✖ (.+?) \(/gm)].map(m=>m[1]).filter(n=>!n.startsWith('failing tests'));
  const unique=[...new Set(failed)];if(r.status!==0&&unique.length)caught++;
  lines.push(`${r.status!==0?'CAUGHT':'MISSED'}  ${name}: ${unique.length} failing test(s)`,...unique.map(n=>'          - '+n));
 }finally{rmSync(work,{recursive:true,force:true});}
}
const report=`Recoil v1 negative tests (${new Date().toISOString().slice(0,10)}): game/recoil.test.mjs against one deliberate fault each in a copy of game/recoil.mjs\n\n${lines.join('\n')}\n\n${caught}/${FAULTS.length} faults caught\n`;
mkdirSync(path.join(root,'evidence/recoil-v1'),{recursive:true});writeFileSync(path.join(root,'evidence/recoil-v1/negative-tests.txt'),report);process.stdout.write(report);
if(caught!==FAULTS.length)process.exit(1);
