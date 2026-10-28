// Read-only rendered walkthrough; no proposal, world write or runtime-state injection.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const output=n=>fileURLToPath(new URL('../evidence/'+n,import.meta.url));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1000}});
 await page.goto('http://127.0.0.1:4202/prototype.html?backend=webgpu');
 await page.waitForFunction(()=>holodeckPrototype?.ready&&holodeckPrototype.loadedRevision===5,{},{timeout:120000});
 await page.getByRole('button',{name:'Enter world',exact:true}).click();
 await page.keyboard.press('h');
 async function move(key,axis,value,direction){await page.keyboard.down(key);try{await page.waitForFunction(({axis,value,direction})=>direction*(holodeckPrototype.actor.eyePosition[axis]-value)>=0,{axis,value,direction},{timeout:30000});}finally{await page.keyboard.up(key);}}
 async function look(key,yaw,direction){await page.keyboard.down(key);try{await page.waitForFunction(({yaw,direction})=>direction*(holodeckPrototype.look.yaw-yaw)>=0,{yaw,direction},{timeout:15000});}finally{await page.keyboard.up(key);}}
 const frames=[];
 async function capture(name){await page.screenshot({path:output('v5-facility-walk-'+name+'.png')});frames.push(await page.evaluate(name=>({name,revision:holodeckPrototype.loadedRevision,backend:holodeckPrototype.backend,position:holodeckPrototype.position,look:holodeckPrototype.look}),name));}
 await move('d',2,2.25,1);await move('s',0,14,-1);await move('a',2,.1,-1);
 await look('ArrowLeft',Math.PI/2,1);await capture('bay-front');
 await look('ArrowRight',-Math.PI/2,-1);
 await move('w',0,16.4,1);await capture('booth-approach');
 await move('d',2,2.25,1);await move('w',0,22.5,1);await move('a',2,.1,-1);await capture('target-near');
 await fs.writeFile(output('v5-facility-walk-review.json'),JSON.stringify({frames,performance:'DIRTY; no timing verdict',method:'Real UI keyboard traversal and read-only render probes'},null,2));
}finally{await browser.close();}
