import {chromium} from '@playwright/test';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 for(const backend of ['webgpu','webgl']){
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto('http://127.0.0.1:4196/prototype.html?backend='+backend);
  await page.waitForFunction(()=>window.holodeckPrototype?.ready);
  await page.getByRole('button',{name:'Observe',exact:true}).click();
  await page.locator('summary').filter({hasText:/^Activity$/}).click();
  await page.getByLabel('Inspect activity',{exact:true}).selectOption('museum-case');
  await page.getByRole('button',{name:'Open museum transport case',exact:true}).click();
  await page.waitForFunction(()=>Math.abs(holodeckPrototype.runtime.states['museum-case'].angle)>1.83);
  await page.getByRole('button',{name:'Close panel',exact:true}).click();
  await page.screenshot({path:fileURLToPath(new URL('../evidence/opening-update-review-'+backend+'.png',import.meta.url))});
  await page.close();
 }
}finally{await browser.close();}
