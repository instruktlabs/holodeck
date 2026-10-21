import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
const results=[];
try{
 for(const backend of ['webgpu','webgl']){
  const p=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const r={backend,checks:[],errors};results.push(r);
  try{
   await p.goto(`http://127.0.0.1:4187/prototype.html?demo&backend=${backend}`);
   await p.waitForFunction(()=>window.holodeckPrototype?.ready);
   await p.waitForTimeout(700);
   await p.screenshot({path:`evidence/prototype-${backend}-cove.png`});
   const input=p.getByRole('textbox',{name:'Message the mock agent'});
   const pos=()=>p.evaluate(()=>holodeckPrototype.position);
   await input.focus();const before=await pos();await p.keyboard.type('wasd');await p.waitForTimeout(200);const after=await pos();expect(Math.hypot(...after.map((v,i)=>v-before[i]))).toBeLessThan(.0001);await input.fill('A quiet woodland with a stream and a path');await input.press('Enter');
   await expect(p.getByRole('heading',{name:'Keep the path walkable?'})).toBeVisible();r.checks.push('text input freezes movement and submits intent');
   await p.getByRole('button',{name:'Keep it clear',exact:true}).click();await p.getByRole('button',{name:'Stop',exact:true}).click();await p.waitForTimeout(4400);expect(await p.evaluate(()=>holodeckPrototype.session.world)).toBe(false);r.checks.push('stopped job never loads later');
   await p.getByRole('button',{name:/Create a quiet woodland/}).click();await p.getByRole('button',{name:'Keep it clear',exact:true}).click();await p.waitForFunction(()=>holodeckPrototype.session.world);
   await p.screenshot({path:`evidence/prototype-${backend}-woodland.png`});
   await p.getByRole('button',{name:/Select crossing/}).click();await input.fill('Build a timber bridge here');await input.press('Enter');await p.waitForFunction(()=>holodeckPrototype.session.phase==='preview');
   expect(await p.evaluate(()=>holodeckPrototype.session.bridge)).toBe(null);r.checks.push('targeted bridge is a preview before apply');
   await p.getByRole('button',{name:'Lower rails',exact:true}).click();await p.waitForFunction(()=>holodeckPrototype.session.preview==='low');
   await p.getByRole('button',{name:'Apply',exact:true}).click();expect(await p.evaluate(()=>holodeckPrototype.session.bridge)).toBe('low');
   await p.getByRole('button',{name:'Undo',exact:true}).click();expect(await p.evaluate(()=>holodeckPrototype.session.bridge)).toBe(null);r.checks.push('revise, apply, and undo');
   await p.getByRole('button',{name:/Hide cove/}).click();expect(await p.evaluate(()=>holodeckPrototype.cove)).toBe(false);
   await p.getByRole('button',{name:'Return to cove',exact:true}).click();expect(await p.evaluate(()=>holodeckPrototype.cove)).toBe(true);r.checks.push('hide and recall cove');
   // A deliberate right-drag turns the initial heading down the path.
   await p.mouse.move(700,400);await p.mouse.down({button:'right'});await p.mouse.move(930,400,{steps:10});await p.mouse.up({button:'right'});
   expect(Math.abs((await p.evaluate(()=>holodeckPrototype.look)).yaw)).toBeLessThan(.02);
   await p.keyboard.down('KeyW');await p.waitForTimeout(1100);await p.keyboard.up('KeyW');
   const walked=await pos();expect(walked[2]).toBeLessThan(.5);r.checks.push('WASD and right-drag move the first-person camera');
   await p.getByRole('button',{name:/Explore/}).click();await p.waitForFunction(()=>holodeckPrototype.locked);
   await expect(p.locator('.compact-card')).toBeVisible();await p.keyboard.press('Enter');await expect(input).toBeFocused();await p.waitForFunction(()=>!holodeckPrototype.locked);r.checks.push('pointer lock, compact conversation, Enter releases to input');
   await p.getByRole('button',{name:/World bible/}).click();await expect(p.getByRole('heading',{name:'The rules of this place.'})).toBeVisible();await p.getByRole('button',{name:'Close panel'}).click();
   await p.getByRole('button',{name:/References/}).click();await expect(p.locator('.drawer img')).toHaveCount(2);await p.getByRole('button',{name:'Close panel'}).click();r.checks.push('bible and reference panels');
   await p.mouse.click(700,400);await p.keyboard.down('KeyW');await p.waitForTimeout(2800);await p.keyboard.up('KeyW');
   await p.getByRole('button',{name:/Select crossing/}).click();await input.fill('Build a bridge');await input.press('Enter');await p.waitForFunction(()=>holodeckPrototype.session.phase==='preview');
   await p.screenshot({path:`evidence/prototype-${backend}-preview.png`});
   await p.getByRole('button',{name:'Apply',exact:true}).click();
   await p.screenshot({path:`evidence/prototype-${backend}-applied.png`});
   const frames=await p.evaluate(()=>holodeckPrototype.frames.slice(-300));frames.sort((a,b)=>a-b);
   r.render=await p.evaluate(()=>({backend:holodeckPrototype.backend,drawCalls:holodeckPrototype.drawCalls,triangles:holodeckPrototype.triangles,position:holodeckPrototype.position}));r.frameP95=frames[Math.floor(frames.length*.95)];expect(errors).toEqual([]);
  }catch(e){r.failure=String(e);await p.screenshot({path:`evidence/prototype-${backend}-failure.png`});}
  await p.close();
 }
}finally{await browser.close();await writeFile('evidence/prototype-probe.json',JSON.stringify(results,null,2));}
console.log(JSON.stringify(results,null,2));if(results.some(r=>r.failure))process.exitCode=1;
