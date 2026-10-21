import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try {
 for(const backend of ['webgpu','webgl']) {
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:4186/?backend=${backend}&test`);
  await page.waitForFunction(()=>window.holodeckLab?.font.loaded);
  await page.waitForTimeout(1000);
  const adapter=await page.evaluate(async()=>{const a=await navigator.gpu?.requestAdapter();return a?{vendor:a.info.vendor,architecture:a.info.architecture,device:a.info.device,description:a.info.description}:null;});
  // Click the actual origin mesh at its projected position, not a DOM surrogate.
  await page.mouse.click(960,610);
  await page.waitForFunction(()=>window.holodeckLab.selected);
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await page.getByRole('button',{name:'Replace text',exact:true}).click();
  await page.waitForFunction(()=>window.holodeckLab.font.caption.startsWith('A changed'));
  const memory=[];
  for(let i=0;i<20;i++) {
   const mounts=await page.evaluate(()=>window.holodeckLab.fontMounts);
   await page.getByRole('button',{name:'Unmount resources',exact:true}).click();
   await page.waitForTimeout(250);
   await page.getByRole('button',{name:'Mount resources',exact:true}).click();
   await page.waitForFunction(m=>window.holodeckLab.font.loaded && window.holodeckLab.fontMounts>m,mounts);
   await page.waitForTimeout(250);
   memory.push(await page.evaluate(()=>window.holodeckLab.memory));
  }
  await page.evaluate(()=>window.holodeckLab.frames=[]);
  await page.waitForTimeout(60000);
  const state=await page.evaluate(()=>window.holodeckLab);
  const sorted=[...state.frames].sort((a,b)=>a-b);
  const frames={count:sorted.length,p95:sorted[Math.floor(sorted.length*.95)],mean:sorted.reduce((a,b)=>a+b,0)/sorted.length,over50:sorted.filter(x=>x>50).length};
  await page.getByRole('button',{name:'Fail font',exact:true}).click();
  await page.waitForFunction(()=>window.holodeckLab.fontFailure);
  const before=await page.evaluate(()=>window.holodeckLab.fontMounts);
  await page.getByRole('button',{name:'Restore font',exact:true}).click();
  await page.waitForFunction(n=>window.holodeckLab.font.loaded&&window.holodeckLab.fontMounts>n,before);
  const recovery=await page.evaluate(()=>({font:window.holodeckLab.font,backend:window.holodeckLab.backend}));
  await page.screenshot({path:`evidence/${backend}-glyph-only.png`});
  results.push({backend,adapter,frames,memory,errors,render:state.render,font:state.font,recovery,selection:true});
  await writeFile('evidence/glyph-isolation.json',JSON.stringify(results,null,2));
  await page.close();
 }
} finally{await browser.close();}
console.log(JSON.stringify(results.map(r=>({backend:r.backend,frames:r.frames,storage:r.memory.map(m=>m.storageAttributes),errors:r.errors.map(e=>e.split('\n')[0]),render:r.render})),null,2));
