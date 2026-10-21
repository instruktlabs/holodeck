import {chromium,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({channel:'chrome',headless:true}),p=await b.newPage({viewport:{width:1600,height:1000}}),errors=[];
p.on('pageerror',e=>errors.push(e.message));
const report={};
async function hold(key,ms){await p.keyboard.down(key);await p.waitForTimeout(ms);await p.keyboard.up(key);}
try{
 await p.goto('http://127.0.0.1:4187/prototype.html?demo');await p.waitForFunction(()=>holodeckPrototype.ready);
 await p.getByRole('button',{name:/Create a quiet woodland/}).click();await p.getByRole('button',{name:'Keep it clear',exact:true}).click();await p.waitForFunction(()=>holodeckPrototype.session.world);
 await p.mouse.move(700,400);await p.mouse.down({button:'right'});await p.mouse.move(930,550,{steps:10});await p.mouse.up({button:'right'});
 report.heading=await p.evaluate(()=>holodeckPrototype.look);
 await hold('KeyW',4650);report.afterForward=await p.evaluate(()=>({position:holodeckPrototype.position,look:holodeckPrototype.look}));await hold('KeyA',480);await hold('KeyW',1600);
 report.bank=await p.evaluate(()=>holodeckPrototype.position);expect(report.bank[2]).toBeGreaterThan(-11.3);expect(report.bank[2]).toBeLessThan(-10.5);expect(Math.abs(report.bank[0])).toBeLessThan(.5);
 await p.mouse.move(700,400);await p.mouse.down({button:'right'});await p.mouse.move(700,455,{steps:3});await p.mouse.up({button:'right'});await p.waitForTimeout(150);
 await p.keyboard.press('KeyE');await p.waitForFunction(()=>holodeckPrototype.selected==='crossing');
 const input=p.getByRole('textbox',{name:'Message the mock agent'});await input.fill('Build a timber bridge here');await input.press('Enter');await p.waitForFunction(()=>holodeckPrototype.session.phase==='preview');
 await p.screenshot({path:'evidence/prototype-crossing-preview.png'});
 await p.mouse.click(700,400);await hold('KeyW',650);const preview=await p.evaluate(()=>holodeckPrototype.position);expect(preview[2]).toBeGreaterThan(-11.3);report.previewBlocks=true;
 await p.getByRole('button',{name:'Apply',exact:true}).click();await hold('KeyW',2000);report.across=await p.evaluate(()=>holodeckPrototype.position);expect(report.across[2]).toBeLessThan(-15.5);report.appliedCrosses=true;
 await p.screenshot({path:'evidence/prototype-crossing-applied.png'});
 // Permission denial does not damage the composer or pretend to record.
 await p.getByRole('button',{name:'Start voice input'}).click();await expect(p.getByRole('status')).toContainText('Microphone unavailable');report.micDenial=true;
 expect(errors).toEqual([]);report.errors=errors;
}catch(e){report.failure=String(e);await p.screenshot({path:'evidence/prototype-crossing-failure.png'});process.exitCode=1;}
finally{await b.close();await writeFile('evidence/prototype-crossing.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
