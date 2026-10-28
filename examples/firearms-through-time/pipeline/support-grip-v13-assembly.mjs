// Fitting-evidence assemblies for the v13 support grip: a hands program plus the pinned gun, rendered with
// explicit cameras on the forend. Evidence only; never saved as an asset.
// Usage: node pipeline/support-grip-v13-assembly.mjs   (writes authoring/support-grip-v13-*.kiln.js and the capture)
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const read=async p=>(await readFile(p,'utf8')).replace(/^﻿/,'');
const guns={rifle1866:'assets/next-firearm-v1/a_a8c8a92ae979442dbcf5836c8e72ee2e/revisions/r_efaced2294e24e9890f47971a737d375/source.kiln.js',
 boltNo4:'authoring/assets/kiln/a_84c94455cca54d4baba72eef11958017/revisions/r_7a36158e3c3b4db99eacb702f1785f64/source.kiln.js'};
const hands={
 'rifle1866-before':'assets/next-firearm-v1/a_e22b20538f204e1ca7a86886cf630a89/revisions/r_3fcbc30917df47179ebe0efa04281019/source.kiln.js',
 'boltNo4-before':'authoring/assets/kiln/a_50e7dd03d75544139214de00422ee64e/revisions/r_ab70dc958c86494cbc5364fcd7bf5ff9/source.kiln.js',
 'rifle1866-after':process.env.RIFLE_HANDS??'assets/next-firearm-v1/a_e22b20538f204e1ca7a86886cf630a89/revisions/r_7269e881c7664cb68deb34bbd441f7f8/source.kiln.js',
 'boltNo4-after':process.env.BOLT_HANDS??'authoring/assets/kiln/a_50e7dd03d75544139214de00422ee64e/revisions/r_77de43bccb58428b8307432b15af8ebb/source.kiln.js'};
// Cameras on the support hand (gun frame: +X muzzle, +Y up, +Z far side). Eye views use the delivered view files.
const grip={rifle1866:{x:.235,y:.12},boltNo4:{x:.255,y:.075}},eyes={rifle1866:{hip:[-.58,.25,-.09],aim:[-.19,.2003,0]},boltNo4:{hip:[-.4,.2,-.1],aim:[-.2195,.139,0]}};
const shot=(name,position,target,up,fovDeg)=>({name,camera:{type:'explicit',projection:'perspective',position,target,up,fovDeg}});
export const captures=Object.fromEntries(Object.entries(grip).map(([k,{x,y}])=>[k,{version:'kiln.capture.v1',output:'grid',cols:3,size:768,shots:[
 shot('From below',[x,y-.30,.0],[x,y,0],[0,0,1],40),
 shot('Far side',[x,y+.02,.30],[x,y,0],[0,1,0],40),
 shot('Near side',[x,y+.02,-.30],[x,y,0],[0,1,0],40),
 shot('Far side, from front',[x+.24,y+.08,.20],[x,y,.005],[0,1,0],40),
 shot('Hip eye',eyes[k].hip,[x,y-.01,0],[0,1,0],50),
 shot('Aim eye',eyes[k].aim,[eyes[k].aim[0]+1,eyes[k].aim[1],0],[0,1,0],45)]}]));
for(const [key,path]of Object.entries(hands)){const [profile,stage]=key.split('-'),src=await read(path),gun=await read(guns[profile]);
 assert(src.includes('async function build(){'));let code=src.replace('async function build(){','async function buildHands(){');
 code=code.replace(/const meta=\{name:'([^']*)'/,(m,n)=>`const meta={name:'${n} - support grip fitting evidence only'`);
 code+=`\nasync function buildGun(){${gun}\nreturn build();}\nasync function build(){const root=createRoot('SupportGripFitting'),hands=await buildHands(),gun=await buildGun();root.add(hands,gun);return root;}\n`;
 await writeFile(`authoring/support-grip-v13-${key}.kiln.js`,code);}
for(const [k,c]of Object.entries(captures))await writeFile(`authoring/support-grip-v13-${k}-capture.json`,JSON.stringify(c,null,1)+'\n');
console.log('assemblies and captures written');
