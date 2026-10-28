import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url),wood=JSON.parse(await readFile(new URL('materials/procedural-wood/natural-v1/material.json',root),'utf8'));
const mapper=await readFile(new URL('authoring/timber-atlas-uv.js.txt',root),'utf8');
const common=`${mapper}
async function makeKit(name){
 const root=createRoot(name),oak=await compilePortableMaterialSpecV2(${JSON.stringify(wood.portableSpec)});
 oak.name='NaturalOak';oak.map.name='Range_Oak_Albedo';oak.normalMap.name='Range_Oak_Normal';oak.roughnessMap.name='Range_Oak_ORM';oak.aoMap.name='Range_Oak_ORM';
 const paint=gameMaterial(0x30383c,{roughness:.62,metalness:0,flatShading:false}),steel=gameMaterial(0x858c90,{roughness:.32,metalness:1,flatShading:false}),rubber=gameMaterial(0x1b2021,{roughness:.92,flatShading:false}),cream=gameMaterial(0xd4d0c4,{roughness:.7,flatShading:false}),teal=gameMaterial(0x55b8c5,{roughness:.45,emissive:0x163139,emissiveIntensity:.12,flatShading:false}),screen=gameMaterial(0x152629,{roughness:.3,flatShading:false});
 const mats={paint,steel,rubber,cream,teal,screen,oak},groups=new Map(),cache=new Map();
 function geo(g,key,pos=[0,0,0],rot=[0,0,0],parent=root){g=g.clone();if(!g.attributes.uv)g=projectUV(g,{projection:'box'});g.rotateX(rot[0]*Math.PI/180);g.rotateY(rot[1]*Math.PI/180);g.rotateZ(rot[2]*Math.PI/180);g.translate(...pos);const id=parent.name+'|'+key;if(!groups.has(id))groups.set(id,{key,parent,parts:[]});groups.get(id).parts.push(g);}
 async function box(key,size,pos,r=.004,rot=[0,0,0],parent=root){r=Math.min(r,Math.min(...size)*.24);const id=JSON.stringify([size,r]);if(!cache.has(id))cache.set(id,await roundedBoxGeo(...size,r,{segments:3,style:'chamfer',smooth:false}));geo(cache.get(id),key,pos,rot,parent);}
 function timber(size,pos,along,seed){geo(mapTimber(boxGeo(...size).clone(),along,seed),'oak',pos);}
 function screw(pos,rot=[0,0,90]){geo(cylinderGeo(.008,.008,.006,6),'steel',pos,rot);}
 function finish(){for(const {key,parent,parts} of groups.values()){const p=[],n=[],uv=[];for(let g of parts){if(g.index)g=g.toNonIndexed();for(const v of g.attributes.position.array)p.push(v);for(const v of g.attributes.normal.array)n.push(v);for(const v of g.attributes.uv.array)uv.push(v);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));createPart(parent===root?'Body_'+key:'Moving_'+key,g,mats[key],{parent});}return root;}
 return {root,geo,box,timber,screw,finish};
}
`;
const programs={
'collection-bay':`const meta={name:'Range collection bay 01',role:'prop'};${common}
async function build(){const k=await makeKit('CollectionBay'),{root,box,timber,screw}=k;
 await box('paint',[.42,.12,2.4],[0,.06,0],.015);
 for(const z of [-1.15,1.15]){await box('paint',[.1,2.3,.1],[-.13,1.27,z],.008);await box('steel',[.2,.012,.2],[-.13,.128,z],.004);for(const y of [.3,2.25])screw([-.074,y,z]);}
 await box('paint',[.1,.1,2.4],[-.13,2.39,0],.008);
 for(let i=0;i<6;i++){const z=-.975+i*.39;await box('rubber',[.055,1.65,.375],[-.17,1.42,z],.005);}
 for(const z of [-1.11,1.11])for(let i=0;i<2;i++)timber([.075,1.08,.09],[-.059,.72+i*1.1,z],1,i+6);
 for(let i=0;i<3;i++)timber([.39,.055,.74],[.10,.92,-.77+i*.77],2,i+18);
 for(const z of [-.72,.72]){await box('paint',[.24,.055,.08],[-.005,1.55,z],.009);await box('steel',[.065,.16,.06],[.12,1.6,z],.007);await box('rubber',[.08,.045,.095],[.10,1.69,z],.008);await box('steel',[.014,.16,.13],[-.115,1.57,z],.003);for(const y of [1.52,1.63])screw([-.104,y,z]);}
 await box('paint',[.06,.31,.62],[-.11,2.09,0],.01);await box('cream',[.012,.23,.54],[-.074,2.09,0],.002);
 await box('teal',[.03,.018,2.13],[-.055,2.29,0],.004);
 for(const z of [-.9,.9]){await box('paint',[.025,.25,.30],[-.095,1.14,z],.006);await box('cream',[.01,.18,.25],[-.076,1.14,z],.002);}
 const selection=createPivot('Selection',[.23,1.04,0],root);
 await box('paint',[.045,.13,.26],[0,0,0],.012,[0,0,0],selection);await box('teal',[.01,.07,.18],[.028,0,0],.006,[0,0,0],selection);
 return k.finish();}
`,
'booth-console':`const meta={name:'Range booth and console 01',role:'prop'};${common}
async function build(){const k=await makeKit('BoothConsole'),{root,box,timber,screw,geo}=k;
 for(const z of [-.85,.85]){await box('paint',[1.45,.075,.16],[.25,.0375,z],.012);for(const x of [-.37,.86]){await box('paint',[.085,2.08,.085],[x,1.1,z],.007);await box('steel',[.16,.012,.14],[x,.083,z],.003);screw([x,.097,z],[0,0,0]);}await box('paint',[1.32,.08,.10],[.25,2.17,z],.008);await box('rubber',[1.15,1.22,.055],[.25,.88,z],.007);for(let i=0;i<8;i++)await box('paint',[.025,1.13,.012],[-.24+i*.14,.88,z+(z>0?-.033:.033)],.002);}
 await box('paint',[.15,.10,1.8],[.85,2.17,0],.01);await box('cream',[.025,.10,.48],[.764,2.17,0],.004);
 for(const z of [-.7,.7])await box('paint',[.09,.84,.09],[.52,.47,z],.007);
 for(let i=0;i<2;i++)timber([.6,.06,.77],[.36,.94,-.4+i*.8],2,20+i);
 await box('paint',[.08,.07,1.65],[.59,.875,0],.005);
 await box('paint',[.25,.30,.31],[.38,1.12,-.31],.022);
 await box('paint',[.10,.43,.57],[.22,1.31,-.31],.018,[0,0,-20]);
 await box('screen',[.014,.345,.48],[.162,1.325,-.31],.008,[0,0,-20]);
 await box('teal',[.01,.027,.12],[.093,1.17,-.31],.004,[0,0,-20]);
 geo(cylinderGeo(.038,.038,.025,32),'teal',[.03,.992,.38]);geo(cylinderGeo(.041,.041,.012,32),'steel',[.03,.978,.38]);
 geo(cylinderGeo(.027,.027,.027,32),'cream',[.03,.994,.58]);geo(cylinderGeo(.032,.032,.012,32),'steel',[.03,.978,.58]);
 for(let i=0;i<7;i++)await box('rubber',[.006,.013,.12],[.511,1.07+i*.026,-.31],.002);
 for(const y of [1.1,1.39])for(const z of [-.54,-.08])screw([.156,y,z]);
 return k.finish();}
`,
'target-module':`const meta={name:'Range turning target module 01',role:'prop'};${common}
async function build(){const k=await makeKit('TargetModule'),{root,box,geo,screw}=k;
 await box('paint',[.75,.13,.85],[0,.065,0],.025);
 for(const z of [-.32,.32])for(const x of [-.25,.25]){await box('rubber',[.14,.025,.14],[x,.014,z],.005);screw([x,.137,z],[0,0,0]);}
 await box('paint',[.16,.91,.17],[.07,.585,0],.012);await box('steel',[.09,.62,.11],[.07,1.0,0],.009);
 await box('paint',[.26,.17,.30],[.04,1.22,0],.025);geo(cylinderGeo(.075,.075,.19,32),'steel',[0,1.27,0]);
 const pivot=createPivot('Target',[0,1.45,0],root);
 await box('paint',[.06,.74,.66],[0,0,0],.018,[0,0,0],pivot);await box('cream',[.014,.67,.59],[-.04,0,0],.008,[0,0,0],pivot);
 for(const radius of [.23,.175,.12,.065])geo(new THREE.TorusGeometry(radius,.002,5,64),'paint',[-.049,0,0],[0,90,0],pivot);
 geo(cylinderGeo(.022,.022,.004,32),'teal',[-.053,0,0],[0,0,90],pivot);
 for(const z of [-.26,.26])for(const y of [-.30,.30])geo(cylinderGeo(.006,.006,.008,6),'steel',[-.055,y,z],[0,0,90],pivot);
 await box('teal',[.015,.05,.11],[-.142,.21,0],.004);
 return k.finish();}
`};
const call=args=>{const p=spawnSync(process.execPath,[fileURLToPath(new URL('authoring/kiln.mjs',root)),...args],{cwd:fileURLToPath(root),encoding:'utf8',maxBuffer:30e6,env:{...process.env,KILN_RENDER_SERVICE_PORT:'8010',KILN_RENDER_PORT_URL:'http://127.0.0.1:8010'}});assert.equal(p.status,0,p.stderr||p.stdout);const r=JSON.parse(p.stdout);assert(r.ok!==false,JSON.stringify(r));return r;};
const only=process.argv[2];
for(const [id,source] of Object.entries(programs)){if(only&&only!==id)continue;const file='authoring/'+id+'.kiln.js';await writeFile(new URL(file,root),source,{flag:'wx'});const s=call(['source',file,'--json']);await writeFile(new URL('evidence/'+id+'-source.json',root),JSON.stringify(s,null,2));console.log(id,s.programRef);const r=call(['render',s.programRef,'--materials','materials/procedural-wood/natural-v1/pins.json','--out','authoring/'+id+'.glb','--views','evidence/'+id+'-kiln.png','--render','gpu','--json']);await writeFile(new URL('evidence/'+id+'-render.json',root),JSON.stringify(r,null,2));console.log(id,'rendered',r.metrics);}
