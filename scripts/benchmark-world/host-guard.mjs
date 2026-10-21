import {readFileSync,readdirSync,mkdirSync,writeFileSync,readFileSync as read,unlinkSync,rmdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {assessAdmission} from './benchmark-core.mjs';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function hostSample(){
 if(process.platform!=='linux')throw Error('Host guard requires Linux /proc and NVIDIA telemetry');
 const text=readFileSync('/proc/stat','utf8'),v=text.match(/^cpu\s+(.+)$/m)[1].trim().split(/\s+/).slice(0,8).map(Number),processes=[];
 for(const id of readdirSync('/proc').filter(s=>/^\d+$/.test(s))){try{const line=readFileSync(`/proc/${id}/stat`,'utf8'),end=line.lastIndexOf(')'),f=line.slice(end+2).split(' ');processes.push({pid:+id,name:line.slice(line.indexOf('(')+1,end),ppid:+f[1],ticks:+f[11]+ +f[12],start:+f[19]});}catch{}}
 const gpu=execFileSync('nvidia-smi',['--query-gpu=name,driver_version,utilization.gpu,memory.used,temperature.gpu,power.draw','--format=csv,noheader,nounits'],{encoding:'utf8',timeout:5000}).trim().split(',').map(s=>s.trim());
 const mem=readFileSync('/proc/meminfo','utf8');
 return {at:new Date().toISOString(),monotonicMs:performance.now(),cores:(text.match(/^cpu\d+\s/gm)||[]).length,total:v.reduce((a,b)=>a+b,0),busy:v[0]+v[1]+v[2]+v[5]+v[6]+v[7],load1:+readFileSync('/proc/loadavg','utf8').split(' ')[0],gpu:+gpu[2],gpuName:gpu[0],driver:gpu[1],gpuMemoryMiB:+gpu[3],temp:+gpu[4],powerW:+gpu[5],availableMemory:+mem.match(/^MemAvailable:\s+(\d+)/m)[1]*1024,processes};
}
export function ownedPids(sample){const ids=new Set([process.pid]);for(let n=0;n<20;n++){const size=ids.size;for(const p of sample.processes)if(ids.has(p.ppid))ids.add(p.pid);if(ids.size===size)break;}return ids;}
export function interval(before,after,ignored=new Set()){
 const total=after.total-before.total;if(total<=0||before.cores!==after.cores)throw Error('Invalid host CPU interval');
 const prior=new Map(before.processes.map(p=>[p.pid,p]));const rows=after.processes.filter(p=>!ignored.has(p.pid)&&prior.get(p.pid)?.start===p.start).map(p=>({pid:p.pid,name:p.name,start:p.start,busyCores:Math.max(0,p.ticks-prior.get(p.pid).ticks)/total*after.cores}));
 return {busyCores:(after.busy-before.busy)/total*after.cores,foreignBusyCores:rows.reduce((sum,r)=>sum+r.busyCores,0),processes:rows.filter(r=>r.busyCores>.005).sort((a,b)=>b.busyCores-a.busyCores),newProcesses:after.processes.filter(p=>!prior.has(p.pid)&&!ignored.has(p.pid)).map(({pid,name,start})=>({pid,name,start}))};
}
export async function admission(){const samples=[hostSample()];await wait(5000);samples.push(hostSample());const activity=interval(...samples),owned=ownedPids(samples[1]),competing=samples[1].processes.filter(p=>!owned.has(p.pid)&&/^(vite|tsc|blender|cargo|make|gcc|g\+\+|ffmpeg|chrome|chromium)$/.test(p.name)).map(p=>p.name);return {...assessAdmission(samples,activity.busyCores,competing),samples,activity};}
export function reserve(directory){
 const root=path.resolve(directory);if(path.dirname(root)==root)throw Error('Reservation must be a named directory');
 mkdirSync(root);const identity=JSON.stringify({format:'holodeck-benchmark-reservation-v1',pid:process.pid,token:randomUUID(),at:new Date().toISOString()});
 try{writeFileSync(path.join(root,'owner.json'),identity,{flag:'wx'});}catch(e){try{rmdirSync(root);}catch{}throw e;}
 return ()=>{try{if(read(path.join(root,'owner.json'),'utf8')===identity){unlinkSync(path.join(root,'owner.json'));rmdirSync(root);}}catch{}};
}
