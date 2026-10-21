import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:[
 '--use-fake-device-for-media-stream',
 '--use-fake-ui-for-media-stream',
 `--use-file-for-fake-audio-capture=${resolve('public/fixtures/voice.wav')}`,
]});
const page=await browser.newPage();
const result={input:'Synthetic test WAV through Chromium fake microphone; no physical microphone used.'};
try {
 await page.goto('http://127.0.0.1:4187/');
 await page.getByRole('button',{name:'04 listen'}).click();
 await page.getByRole('button',{name:'Start recording',exact:true}).click();
 await page.getByRole('button',{name:'Stop recording',exact:true}).waitFor();
 await page.waitForTimeout(3200);
 await page.getByRole('button',{name:'Stop recording',exact:true}).click();
 await page.waitForFunction(()=>window.holodeckLab?.speech.type,undefined,{timeout:120000});
 result.speech=await page.evaluate(()=>window.holodeckLab.speech);
 result.editable=await page.getByLabel('Editable transcript').isEditable();
 result.returnedToIdle=await page.getByRole('button',{name:'Start recording',exact:true}).isEnabled();
}catch(error){result.error=String(error);}
finally{await writeFile('evidence/microphone-probe.json',JSON.stringify(result,null,2));await browser.close();}
console.log(JSON.stringify(result,null,2));
