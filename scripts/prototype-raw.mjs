import {chromium} from '@playwright/test';
const b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage({viewport:{width:1600,height:1000}});const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await p.goto('http://127.0.0.1:4186/prototype.html?raw');await p.waitForFunction(()=>window.holodeckPrototype?.ready);await p.waitForTimeout(2500);await p.screenshot({path:'evidence/prototype-raw.png'});console.log(JSON.stringify({errors,probe:await p.evaluate(()=>({...holodeckPrototype,frames:undefined}))}));await b.close();


