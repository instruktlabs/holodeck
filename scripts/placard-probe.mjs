// Walks a built shelf in a real GPU browser, a bright world and a dark one on each backend: the placard shows on the
// overview and takes no keys, it leaves for the world and comes back closed, and walking still moves.
// Usage: npm run probe:placard -- --site <folder from build-site>
// Needs a display. On a hybrid-GPU laptop, set the PRIME variables too, so that Chrome keeps to the one GPU.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createReadStream,existsSync,statSync} from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const flag=process.argv.indexOf('--site'),site=flag>0?path.resolve(process.argv[flag+1]??''):null;
if(!site||!existsSync(path.join(site,'worlds'))){console.error('Usage: npm run probe:placard -- --site <folder from build-site>');process.exit(1);}
const WORLDS=['courtyard','winter-mountainside-cabin'],sleep=ms=>new Promise(done=>setTimeout(done,ms));
const LINUX=process.platform==='linux'?['--ozone-platform=x11']:[];
// Without Vulkan, Chrome on Linux can hand WebGPU only its software adapter, or none, however the GPU is listed in chrome://gpu.
const BACKENDS=[
 {name:'WebGPU',query:'',args:[...LINUX,'--enable-unsafe-webgpu','--enable-features=Vulkan','--ignore-gpu-blocklist']},
 {name:'WebGL2',query:'?backend=webgl',args:[...LINUX,'--ignore-gpu-blocklist']},
];
const TYPES={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm'};
const server=http.createServer((request,response)=>{
 const file=path.join(site,decodeURIComponent(new URL(request.url,'http://localhost').pathname)),target=existsSync(file)&&statSync(file).isDirectory()?path.join(file,'index.html'):file;
 if(!target.startsWith(site)||!existsSync(target)){response.writeHead(404).end();return;}
 response.writeHead(200,{'content-type':TYPES[path.extname(target)]??'application/octet-stream'});createReadStream(target).pipe(response);
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const origin=`http://127.0.0.1:${server.address().port}`;

const plate=page=>page.evaluate(()=>{const p=document.querySelector('.scene-placard');return {shown:getComputedStyle(p).display!=='none',open:p.querySelector('details').open};});
const status=page=>page.evaluate(()=>{const lines=[...document.querySelectorAll('.viewer-footer details p')].map(p=>p.textContent),camera=lines.find(line=>line.startsWith('Camera'))??'';return {feet:(camera.match(/Feet: ([-\d.]+), ([-\d.]+), ([-\d.]+)/)||[]).slice(1).map(Number),state:(camera.match(/State: (.+)$/)||[])[1],walking:document.querySelector('.static-viewer').classList.contains('inhabiting'),active:document.activeElement?.tagName};});
// Held keys walk; a spawn can face a post, so a key that is blocked hands over to the opposite one.
async function walks(page,keys){
 for(const key of keys){
  const from=(await status(page)).feet;await page.keyboard.down(key);await sleep(1000);await page.keyboard.up(key);await sleep(400);
  const to=(await status(page)).feet;if(Math.hypot(from[0]-to[0],from[2]-to[2])>.3)return;
 }
 assert.fail(`none of ${keys} moved the walker`);
}
async function walkWorld(browser,world,backend){
 const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(/Device Lost/.test(message.text()))errors.push(message.text());});
 await page.goto(`${origin}/worlds/${world}/${backend.query}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>{const b=document.querySelector('.viewer-toolbar button.primary');return b&&!b.disabled&&!document.querySelector('.viewer-load');},null,{timeout:240000});await sleep(800);
 assert.equal(await page.evaluate(()=>document.querySelector('.viewer-footer details summary').textContent.split('·')[0].trim()),backend.name,'the backend this pass is for');
 if(backend.name==='WebGPU'){const adapter=await page.evaluate(async()=>{const a=await navigator.gpu.requestAdapter({featureLevel:'compatibility'});return {name:`${a?.info?.vendor}/${a?.info?.architecture}`,software:a?.info?.isFallbackAdapter};});assert.ok(!adapter.software,`WebGPU fell back to ${adapter.name}, which is not this GPU`);}
 assert.deepEqual(await plate(page),{shown:true,open:false},'on the overview');
 // More, then in with the mouse: the keys go to the world and the placard is gone.
 await page.click('.scene-placard summary');assert.equal((await plate(page)).open,true,'More opens');
 await page.click('.viewer-toolbar button.primary');await sleep(1000);
 let now=await status(page);assert.ok(now.walking,'in the world');assert.equal(now.active,'BODY','focus left More');assert.equal((await plate(page)).shown,false,'gone while walking');
 await walks(page,['KeyW','KeyS']);
 await page.keyboard.press('Space',{delay:60});let airborne=false;for(let i=0;i<14&&!airborne;i++){await sleep(100);airborne=(await status(page)).state==='airborne';}assert.ok(airborne,'Space jumps');await sleep(1200);
 await page.keyboard.press('Escape');await sleep(800);assert.deepEqual(await plate(page),{shown:true,open:false},'back, and closed');
 // Keyboard only: Enter and Space work More and stay with it; walking keys do nothing here; Enter on the button goes in.
 await page.focus('.scene-placard summary');await page.keyboard.press('Enter');await sleep(150);assert.equal((await plate(page)).open,true,'Enter opens More');assert.equal((await status(page)).walking,false,'Enter stays with More');
 await page.keyboard.press('Space');await sleep(150);assert.equal((await plate(page)).open,false,'Space closes More');
 await page.focus('.viewer-toolbar button.primary');await page.keyboard.press('Enter');await sleep(1000);assert.ok((await status(page)).walking,'in by keyboard');
 await walks(page,['KeyD','KeyA']);
 await page.keyboard.press('Escape');await sleep(800);assert.deepEqual(await plate(page),{shown:true,open:false},'back again');
 assert.deepEqual(errors,[],'no page errors, and the device stayed');
 await context.close();
}
let failed=false;
try{for(const backend of BACKENDS){
 const browser=await chromium.launch({channel:'chrome',headless:false,args:['--no-first-run',...backend.args]});
 try{for(const world of WORLDS)try{await walkWorld(browser,world,backend);console.log(`ok ${world} on ${backend.name}`);}catch(error){failed=true;console.log(`not ok ${world} on ${backend.name}: ${error.message}`);}}
 finally{await browser.close();}
}}finally{server.close();}
if(failed)process.exitCode=1;
