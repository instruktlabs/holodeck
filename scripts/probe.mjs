import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({channel:'chrome', headless:true});
const report = { at: new Date().toISOString(), browser: browser.version(), results: [] };
try {
  for (const backend of ['webgpu','webgl']) {
    const page = await browser.newPage({viewport:{width:1920,height:1080}});
    const errors=[]; page.on('pageerror', e=>errors.push(e.message));
    page.on('console', m=>{if(m.type()==='error') errors.push(m.text());});
    await page.goto(`http://127.0.0.1:4186/?backend=${backend}&test`);
    try {
      await page.waitForFunction(()=>window.holodeckLab?.font.loaded, {timeout:45000});
      await page.waitForTimeout(1500);
      const initial=await page.evaluate(()=>({...window.holodeckLab,frames:undefined}));
      await page.getByRole('button',{name:'Replace text',exact:true}).click();
      await page.waitForFunction(()=>window.holodeckLab.font.caption.startsWith('A changed'));
      await page.screenshot({path:`evidence/${backend}-lab.png`});
      const memory=[];
      for(let i=0;i<20;i++) {
        await page.getByRole('button',{name:'Unmount resources',exact:true}).click();
        await page.waitForTimeout(70);
        await page.getByRole('button',{name:'Mount resources',exact:true}).click();
        await page.waitForTimeout(100);
        memory.push(await page.evaluate(()=>window.holodeckLab.memory));
      }
      await page.evaluate(()=>{window.holodeckLab.frames=[];});
      await page.waitForTimeout(60000);
      const frames=await page.evaluate(()=>window.holodeckLab.frames);
      const sorted=[...frames].sort((a,b)=>a-b);
      await page.getByRole('button',{name:'Fail font',exact:true}).click();
      await page.waitForFunction(()=>window.holodeckLab.fontFailure,{timeout:15000});
      await page.getByRole('button',{name:'Restore font',exact:true}).click();
      await page.waitForTimeout(1500);
      const final=await page.evaluate(()=>({...window.holodeckLab,frames:undefined}));
      report.results.push({requested:backend,initial,final,memory,frames:{count:frames.length,p95:sorted[Math.floor(sorted.length*.95)],mean:frames.reduce((a,b)=>a+b,0)/frames.length,over50:frames.filter(x=>x>50).length},errors});
    } catch(error) {
      report.results.push({requested:backend,error:String(error),errors,state:await page.evaluate(()=>window.holodeckLab)});
      await page.screenshot({path:`evidence/${backend}-failure.png`});
    }
    await writeFile('evidence/browser-probe.json',JSON.stringify(report,null,2));
    await page.close();
  }
} finally {await browser.close();}
console.log(JSON.stringify(report.results.map(r=>({requested:r.requested,backend:r.final?.backend,frames:r.frames,error:r.error,errors:r.errors.slice(0,8)})),null,2));
