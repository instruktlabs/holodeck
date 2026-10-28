// Follow-up to native-range-trigger-v12-source-edit.cjs: the 1866 and No.4 fixtures asserted the old rule (a ready session refuses the
// trigger). Under the owner's trigger rule a pull that can fire starts a string, so their first check now proves the guard instead:
// a pull that can't fire (empty gun) starts no string and records nothing. Backup: evidence/sight-v12/native-source-before/*.before-range-trigger-b.*
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'../native/ToolchainValidation/Source/ToolchainValidation'),backup=path.join(__dirname,'../evidence/sight-v12/native-source-before');
const guard=(rounds)=>[`RifleCheck(!Action(TEXT("fire"))&&Ammo==${rounds}&&Shots==0,TEXT("ready_session_blocks_fire_before_ammo"));`,
 '{const int32 Loaded=Ammo,Strings=Range.StringId;Ammo=0;RifleCheck(!Action(TEXT("fire"))&&Ammo==0&&Shots==0&&Range.StringId==Strings&&Range.Shots.IsEmpty(),TEXT("empty_trigger_starts_no_string"));Ammo=Loaded;}'];
const f='WeaponProfileRuntime.cpp',file=path.join(dir,f),saved=path.join(backup,'WeaponProfileRuntime.before-range-trigger-b.cpp');
const raw=fs.readFileSync(file,'utf8'),eol=raw.includes('\r\n')?'\r\n':'\n';let s=raw.replace(/\r\n/g,'\n');
for(const [a,b] of [guard(6),guard(10)]){if(s.split(a).length!==2)throw Error(f+' needs exactly one '+a.slice(0,90));s=s.replace(a,()=>b);}
if(fs.existsSync(saved))throw Error('Backup already exists: '+saved);
fs.writeFileSync(saved,raw);fs.writeFileSync(file,s.replace(/\n/g,eol));
console.log('rifle and bolt trigger guard checks updated');
