// Owner decisions (27 Oct): the first trigger pull starts a range string, and the range keys gain L (next lane) and P (return paper)
// so the browser and Unreal share one scheme. Backups: evidence/sight-v12/native-source-before/*.before-range-trigger.*
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'../native/ToolchainValidation/Source/ToolchainValidation'),backup=path.join(__dirname,'../evidence/sight-v12/native-source-before');
// Every replacement is validated before anything is written, so a failed run leaves sources and backups untouched.
const pending=[];
function edit(f,pairs){const file=path.join(dir,f),dot=f.lastIndexOf('.'),raw=fs.readFileSync(file,'utf8'),eol=raw.includes('\r\n')?'\r\n':'\n';let s=raw.replace(/\r\n/g,'\n');for(const [a,b] of pairs){if(s.split(a).length!==2)throw Error(f+' needs exactly one '+a.slice(0,80));s=s.replace(a,()=>b);}pending.push({file,raw,next:s.replace(/\n/g,eol),saved:path.join(backup,f.slice(0,dot)+'.before-range-trigger'+f.slice(dot))});}
edit('WeaponLoop.cpp',[
 ['if(!Range.CanRecord(CommandId)){Message=TEXT("Start an active string before firing");return false;}',
  '\n  // Owner decision (27 Oct): with no string running, the trigger starts one in the current lane; a docked paper deploys first and the string begins on arrival.\n  if(Ammo&&(Range.Phase==TEXT("ready")||Range.Phase==TEXT("review")))Range.Action(TEXT("start"));if(!Range.CanRecord(CommandId)){Message=Ammo?Range.Message:FString(TEXT("Empty - reload"));return false;}']]);
edit('RangeSession.h',[['Message=TEXT("Choose a lane, then start a string");','Message=TEXT("Fire to start a string - L changes lane");']]);
edit('RangeSession.cpp',[
 ['if(PC->WasInputKeyJustPressed(EKeys::Three))Action(TEXT("select"),TEXT("plates"));',
  'if(PC->WasInputKeyJustPressed(EKeys::Three))Action(TEXT("select"),TEXT("plates"));if(PC->WasInputKeyJustPressed(EKeys::L)){static const TCHAR* Lanes[]={TEXT("paper"),TEXT("plates"),TEXT("original")};const int32 I=Lane==TEXT("paper")?0:Lane==TEXT("plates")?1:2;if(!Action(TEXT("select"),Lanes[(I+1)%3])&&Phase==TEXT("active"))Message=TEXT("Lane is fixed during a string - Backspace ends it");}'],
 ['if(PC->WasInputKeyJustPressed(EKeys::T))Action(TEXT("return"));','if(PC->WasInputKeyJustPressed(EKeys::T)||PC->WasInputKeyJustPressed(EKeys::P))Action(TEXT("return"));'],
 ['TEXT("1 Original  2 Paper  3 Plates | Enter Start | Backspace End")','TEXT("1 Original  2 Paper  3 Plates  L Next lane | Fire or Enter Start | Backspace End")'],
 ['TEXT("T Return / Resume | Y Replace paper / New plate string | F8 Export")','TEXT("T or P Return / Resume | Y Replace paper / New plate string | F8 Export")'],
 ['Message=TEXT("Inactive - start a new string when ready");','Message=TEXT("Inactive - fire to start a new string");'],
 // The old ready gate refused the trigger; now an unbound range is the case that must refuse it without starting a string.
 ['Check(!Owner->Action(TEXT("fire"))&&Owner->Ammo==Ammo,TEXT("ready_gate_preserves_ammo"));const auto BoundSheet=Sheet;Sheet.Reset();',
  'const auto BoundSheet=Sheet;Sheet.Reset();Check(!Owner->Action(TEXT("fire"))&&Owner->Ammo==Ammo&&Phase==TEXT("ready")&&Shots.IsEmpty(),TEXT("unbound_trigger_cannot_start_string"));'],
 // A trigger pull at the docked paper now sends it downrange, so that check moves after the docked captures.
 ['Check(!Owner->Action(TEXT("fire"))&&Owner->Ammo==TestAmmo,TEXT("docked_review_gate_no_ammo_loss"));',''],
 ['Check(Action(TEXT("start"))&&Phase==TEXT("deploying"),TEXT("start_redeploys_before_active"));',
  'const int32 Rounds=Owner->Ammo,Recorded=Shots.Num();Check(!Owner->Action(TEXT("fire"))&&Owner->Ammo==Rounds&&Shots.Num()==Recorded&&Phase==TEXT("deploying")&&PendingStart,TEXT("docked_trigger_redeploys_without_shot"));'],
 ['Check(Action(TEXT("select"),TEXT("plates"))&&Action(TEXT("start")),TEXT("plate_string_starts"));',
  'Check(Action(TEXT("select"),TEXT("plates"))&&Phase==TEXT("ready"),TEXT("plate_lane_selected"));'],
 ['Check(Owner->Action(TEXT("fire"))&&LastShot()&&LastShot()->Points==10&&Plates[0],TEXT("plate_first_award"));',
  'const int32 PrevString=StringId,PrevActivation=Activation;const bool Fired=Owner->Action(TEXT("fire"));Check(Fired&&Phase==TEXT("active")&&StringId==PrevString+1&&Activation==PrevActivation+1&&LastShot()&&LastShot()->StringId==StringId,TEXT("trigger_starts_plate_string"));Check(Fired&&LastShot()&&LastShot()->Points==10&&Plates[0],TEXT("plate_first_award"));']]);
for(const p of pending){if(fs.existsSync(p.saved))throw Error('Backup already exists: '+p.saved);}
for(const p of pending){fs.writeFileSync(p.saved,p.raw);fs.writeFileSync(p.file,p.next);}
console.log('native range trigger edit applied to '+pending.length+' files');
