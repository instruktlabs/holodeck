// Support grip v13: point the rifle and No.4 profiles at the new RifleV13 and BoltV13 imports (hands v2, arm rig v2). RifleV12 and
// BoltV11 stay on disk as the previously qualified state. Backups: evidence/support-grip-v13/native-source-before/*.before-support-grip.*
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),backup=path.join(root,'evidence/support-grip-v13/native-source-before');
const jobs=[
 ['native/ToolchainValidation/Source/ToolchainValidation/WeaponLoop.cpp',[
  ['/Game/Qualification/RifleV12/DA_Rifle1866.DA_Rifle1866','/Game/Qualification/RifleV13/DA_Rifle1866.DA_Rifle1866'],
  ['/Game/Qualification/BoltV11/DA_BoltNo4.DA_BoltNo4','/Game/Qualification/BoltV13/DA_BoltNo4.DA_BoltNo4']]],
 ['pipeline/run-rifle-lab.ps1',[['Content/Qualification/RifleV12/DA_Rifle1866.uasset','Content/Qualification/RifleV13/DA_Rifle1866.uasset']]],
 ['pipeline/run-bolt-lab.ps1',[['Content/Qualification/BoltV11/DA_BoltNo4.uasset','Content/Qualification/BoltV13/DA_BoltNo4.uasset']]]];
// Validate every edit and backup slot before writing anything.
const out=jobs.map(([f,pairs])=>{const file=path.join(root,f),raw=fs.readFileSync(file,'utf8'),eol=raw.includes('\r\n')?'\r\n':'\n';let s=raw.replace(/\r\n/g,'\n');
 for(const [a,b] of pairs){if(s.split(a).length!==2)throw Error(f+' needs exactly one '+a);s=s.replace(a,()=>b);}
 const ext=path.extname(f),saved=path.join(backup,path.basename(f,ext)+'.before-support-grip'+ext);if(fs.existsSync(saved))throw Error('Backup already exists: '+saved);
 for(const content of ['RifleV13','BoltV13'])if(pairs.some(([,b])=>b.includes(content))&&!fs.existsSync(path.join(root,'native/ToolchainValidation/Content/Qualification',content)))throw Error('Import '+content+' before switching to it');
 return {file,saved,raw,text:s.replace(/\n/g,eol)};});
fs.mkdirSync(backup,{recursive:true});
for(const o of out){fs.writeFileSync(o.saved,o.raw);fs.writeFileSync(o.file,o.text);}
console.log('switched to RifleV13 and BoltV13:',out.map(o=>path.relative(root,o.file)).join(', '));
