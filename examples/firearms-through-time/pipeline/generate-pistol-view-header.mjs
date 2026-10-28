// Generate the native pistol view (hip, aim and aim FOV) from the derived browser view, so both destinations share one placement.
import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
const file='game/pistol-view-v2.json',b=await readFile(file),v=JSON.parse(b),ue=p=>[-p[2]*100,p[0]*100,p[1]*100].map(x=>x.toFixed(6)).join(',');
let h=`// Generated from ${file}; SHA-256 ${createHash('sha256').update(b).digest('hex')}\n#pragma once\nnamespace WeaponPistolView {\n`;
h+=`inline const FVector HipLocation(${ue(v.hipPosition)});\ninline const FVector AimLocation(${ue(v.aimPosition)});\nconstexpr float AimFovVerticalDeg=${v.aimFovDeg};\nconstexpr float AimPitchDeg=${((v.aimPitch??0)*180/Math.PI).toFixed(8)};\n}\n`;
const path='native/ToolchainValidation/Source/ToolchainValidation/WeaponPistolViewData.h',current=await readFile(path,'utf8').catch(()=>null);
if(current!==h){if(process.argv.includes('--check'))throw Error('Generated pistol view header is stale');await writeFile(path,h);}console.log('Pistol view header matches '+file);
