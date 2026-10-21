import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage();
const baseURL = process.env.HOLODECK_TEST_URL || 'http://127.0.0.1:4187';
const evidence={requests:[],errors:[]};
page.on('request',req=>{ const url=new URL(req.url()); evidence.requests.push({url:url.origin+url.pathname,method:req.method()}); });
page.on('pageerror',e=>evidence.errors.push(e.message));
try {
  await page.goto(`${baseURL}/?test`);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Browser.setPermission',{permission:{name:'microphone'},setting:'denied',origin:baseURL});
  await page.getByRole('button',{name:'04 listen'}).click();
  await page.getByRole('button',{name:'Start recording',exact:true}).click();
  await page.waitForFunction(()=>window.holodeckLab.micError);
  evidence.denied=await page.evaluate(()=>window.holodeckLab.micError);
  await page.getByLabel('Editable transcript').fill('Keep the path open.');
  evidence.editAfterDenial=await page.getByLabel('Editable transcript').inputValue();
  await page.getByRole('button',{name:'Transcribe test phrase',exact:true}).click();
  await page.waitForFunction(()=>window.holodeckLab?.speech.type,undefined,{timeout:240000});
  evidence.cold=await page.evaluate(()=>window.holodeckLab.speech);
  if(evidence.cold.type==='result') {
    await page.getByLabel('Editable transcript').fill('Keep the path open to the cedar trees.');
    evidence.edited=await page.getByLabel('Editable transcript').inputValue();
    // Deny all remote requests on the second run while keeping localhost reachable.
    await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
    await page.evaluate(()=>{window.holodeckLab.speech={};});
    await page.getByRole('button',{name:'Transcribe test phrase',exact:true}).click();
    await page.waitForFunction(()=>window.holodeckLab.speech.type,undefined,{timeout:60000});
    evidence.warm=await page.evaluate(()=>window.holodeckLab.speech);
  }
  await page.screenshot({path:'evidence/speech-lab.png'});
}catch(error){evidence.error=String(error); evidence.status=await page.getByRole('status').textContent().catch(()=>null);}
finally{await writeFile('evidence/speech-probe.json',JSON.stringify(evidence,null,2));await browser.close();}
console.log(JSON.stringify({...evidence,requests:evidence.requests.filter(r=>!r.url.includes('127.0.0.1')).map(r=>({url:r.url,method:r.method}))},null,2));
