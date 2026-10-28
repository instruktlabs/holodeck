// Recoil v1 (docs/recoil-v1.md): each accepted native shot kicks the pawn's look through WeaponRecoil::FState, and the pistol, 1866 and
// No.4 fixtures check the shared recoil fixtures, the pre-kick shot, rejected input, the settle and the pattern walk.
// Backups: evidence/recoil-v1/native-source-before/*.before-recoil.*
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),src='native/ToolchainValidation/Source/ToolchainValidation/',backup=path.join(root,'evidence/recoil-v1/native-source-before');
const replay=(id,check)=>`{FString Replay;const bool Replayed=WeaponRecoil::ReplayFixture(${id},Replay);UE_LOG(LogTemp,Display,TEXT("RECOIL_FIXTURE %s"),*Replay);${check}(Replayed,TEXT("recoil_fixture_matches"));}BeginRecoilProbe();`;
const jobs=[
 [src+'WeaponLoop.h',[
  ['#include "WeaponProfileData.h"\n','#include "WeaponProfileData.h"\n#include "WeaponRecoil.h"\n'],
  [' FRangeSession Range;\n',' FRangeSession Range;\n // Recoil v1 (docs/recoil-v1.md): each accepted shot\'s kick turns the pawn\'s look after the shot.\n WeaponRecoil::FState Recoil;\n'],
  [' int32 HoldAimState=0;\n',' int32 HoldAimState=0;\n // Fixture probe of one shot\'s recoil: the aim before it, its kick, the highest pitch reached and the settled turn.\n struct FRecoilProbe{bool Active=false;FRotator Before=FRotator::ZeroRotator;FVector Forward=FVector::ZeroVector;FVector2D Kick=FVector2D::ZeroVector;double Peak=0;int32 Shots=0;}RecoilProbe;\n FString RecoilSummary;\n FVector2D RecoilOwed=FVector2D::ZeroVector;\n void TickRecoil(float Dt);void BeginRecoilProbe();bool RecoilProbeShot();bool RecoilProbeSettled();\n']]],
 [src+'WeaponLoop.cpp',[
  ['#include "WeaponPistolViewData.h"\n','#include "WeaponPistolViewData.h"\n#include "WeaponRecoilFixture.h"\n'],
  ['Flash=FMath::Max(0.f,Flash-ActionDt);','Flash=FMath::Max(0.f,Flash-ActionDt);TickRecoil(ActionDt);'],
  ['if(!P||!Range.RecordShot(CommandId,P->Camera->GetComponentLocation(),P->Camera->GetForwardVector()))return false;','if(!P||!Range.RecordShot(CommandId,P->Camera->GetComponentLocation(),P->Camera->GetForwardVector()))return false;Recoil.Fire(Range.Id,Range.LastShot()->Id);'],
  ['void AWeaponLoop::Check(bool C,const TCHAR*N){Failed|=!C;UE_LOG(LogTemp,Display,TEXT("WEAPON_CHECK %s %s"),N,C?TEXT("PASS"):TEXT("FAIL"));}\n',
   'void AWeaponLoop::Check(bool C,const TCHAR*N){Failed|=!C;UE_LOG(LogTemp,Display,TEXT("WEAPON_CHECK %s %s"),N,C?TEXT("PASS"):TEXT("FAIL"));}\n'+
   '// Recoil v1: step the kick and turn the pawn\'s look by the change: camera pitch inside the mouse-look clamp, actor yaw.\n'+
   'void AWeaponLoop::TickRecoil(float Dt){\n'+
   ' const FName Id=ActiveProfile?ActiveProfile->ProfileId:FName(TEXT("pistol"));if(!Recoil.Profile||Id!=FName(Recoil.Profile->Id))Recoil.Reset(WeaponRecoilData::Find(Id));\n'+
   ' RecoilOwed+=Recoil.Step(Dt);auto* P=Cast<ARangeSlicePawn>(UGameplayStatics::GetPlayerPawn(this,0));if(!P)return;\n'+
   ' // Scene components ignore rotation changes under 1e-4 deg, which would drop the tail of every recovery, so the turn is carried until it is\n'+
   ' // at least 2e-4 deg and the owed amount is reduced by what was actually applied. A clamped pitch discards the rest, as mouse look does.\n'+
   ' if(FMath::Abs(RecoilOwed.X)>=2e-4){FRotator Look=P->Camera->GetRelativeRotation();const double From=Look.Pitch,To=From+RecoilOwed.X;Look.Pitch=FMath::Clamp(To,-75.,75.);P->Camera->SetRelativeRotation(Look);RecoilOwed.X=Look.Pitch!=To?0:RecoilOwed.X-(P->Camera->GetRelativeRotation().Pitch-From);}\n'+
   ' if(FMath::Abs(RecoilOwed.Y)>=2e-4){const double From=P->GetActorRotation().Yaw;P->AddActorWorldRotation(FRotator(0,RecoilOwed.Y,0));RecoilOwed.Y-=FRotator::NormalizeAxis(P->GetActorRotation().Yaw-From);}\n'+
   ' if(RecoilProbe.Active)RecoilProbe.Peak=FMath::Max(RecoilProbe.Peak,P->Camera->GetComponentRotation().Pitch-RecoilProbe.Before.Pitch);\n'+
   '}\n'+
   'void AWeaponLoop::BeginRecoilProbe(){RecoilProbe=FRecoilProbe();if(auto* P=Cast<ARangeSlicePawn>(UGameplayStatics::GetPlayerPawn(this,0))){RecoilProbe.Active=true;RecoilProbe.Before=P->Camera->GetComponentRotation();RecoilProbe.Forward=P->Camera->GetForwardVector();RecoilProbe.Shots=Recoil.Shots;}}\n'+
   '// The accepted shot left along the aim from before its kick, and kicked exactly once.\n'+
   'bool AWeaponLoop::RecoilProbeShot(){RecoilProbe.Kick=Recoil.LastKick;return RecoilProbe.Active&&Recoil.Shots==RecoilProbe.Shots+1&&Range.LastShot()&&Range.LastShot()->RayDirection.Equals(RecoilProbe.Forward,1e-6);}\n'+
   '// Once settled, the look has turned by the residual share of the kick, after rising past half the kick.\n'+
   'bool AWeaponLoop::RecoilProbeSettled(){\n'+
   ' auto* P=Cast<ARangeSlicePawn>(UGameplayStatics::GetPlayerPawn(this,0));if(!P||!RecoilProbe.Active||!Recoil.Profile)return false;RecoilProbe.Active=false;\n'+
   ' const FRotator Now=P->Camera->GetComponentRotation();const double Keep=Recoil.Profile->Residual,DP=Now.Pitch-RecoilProbe.Before.Pitch,DY=FRotator::NormalizeAxis(Now.Yaw-RecoilProbe.Before.Yaw);\n'+
   ' RecoilSummary=FString::Printf(TEXT("%s kick (%.6f, %.6f) deg; settled turn (%.6f, %.6f) deg against residual x kick (%.6f, %.6f); peak pitch %.6f deg"),Recoil.Profile->Id,RecoilProbe.Kick.X,RecoilProbe.Kick.Y,DP,DY,Keep*RecoilProbe.Kick.X,Keep*RecoilProbe.Kick.Y,RecoilProbe.Peak);\n'+
   ' UE_LOG(LogTemp,Display,TEXT("RECOIL_PROBE %s"),*RecoilSummary);\n'+
   ' return RecoilProbe.Kick.X>0&&FMath::Abs(DP-Keep*RecoilProbe.Kick.X)<1e-3&&FMath::Abs(DY-Keep*RecoilProbe.Kick.Y)<1e-3&&RecoilProbe.Peak>.5*RecoilProbe.Kick.X;\n'+
   '}\n'],
  ['Check(Action(TEXT("aim"))&&Aim,TEXT("aim"));Check(Action(TEXT("fire"))&&Ammo==6&&Hits==1,TEXT("fire_consumes_and_hits"));Check(!Action(TEXT("fire")),TEXT("cooldown_rejects_repeat"));',
   'Check(Action(TEXT("aim"))&&Aim,TEXT("aim"));'+replay('TEXT("pistol")','Check')+'Check(Action(TEXT("fire"))&&Ammo==6&&Hits==1,TEXT("fire_consumes_and_hits"));Check(RecoilProbeShot(),TEXT("recoil_shot_uses_pre_kick_aim"));Check(!Action(TEXT("fire")),TEXT("cooldown_rejects_repeat"));Check(Recoil.Shots==1,TEXT("rejected_fire_no_kick"));'],
  /* The pistol fixture's phase 1 runs only 0.5 s after the shot; phase 4 (7.3 s) is about 4.3 s after it, past any recovery. */['else if(Phase==4&&Elapsed>7.3){','else if(Phase==4&&Elapsed>7.3){Check(RecoilProbeSettled(),TEXT("recoil_rises_then_settles"));'],
  ['Check(Ammo==0&&!Action(TEXT("fire"))&&Shots==8,TEXT("empty_rejects_fire"));','Check(Ammo==0&&!Action(TEXT("fire"))&&Shots==8,TEXT("empty_rejects_fire"));Check(Recoil.Shots==Shots&&Recoil.Index==Shots-2,TEXT("recoil_string_walks_pattern"));']]],
 [src+'WeaponProfileRuntime.cpp',[
  ['#include "WeaponLoop.h"\n#include "WeaponHandAnimInstance.h"\n','#include "WeaponLoop.h"\n#include "WeaponRecoilFixture.h"\n#include "WeaponHandAnimInstance.h"\n'],
  ['RifleCheck(Action(TEXT("fire"))&&Ammo==5&&Shots==1&&Range.Shots.Num()==1,TEXT("real_fire_one_shot_one_round"));RifleCheck(!Action(TEXT("fire"))&&!Action(TEXT("aim"))&&!Action(TEXT("inspect"))&&!Action(TEXT("reload")),TEXT("cycle_gates_all_actions"));',
   replay('ActiveProfile->ProfileId','RifleCheck')+'RifleCheck(Action(TEXT("fire"))&&Ammo==5&&Shots==1&&Range.Shots.Num()==1,TEXT("real_fire_one_shot_one_round"));RifleCheck(RecoilProbeShot(),TEXT("recoil_shot_uses_pre_kick_aim"));RifleCheck(!Action(TEXT("fire"))&&!Action(TEXT("aim"))&&!Action(TEXT("inspect"))&&!Action(TEXT("reload")),TEXT("cycle_gates_all_actions"));RifleCheck(Recoil.Shots==1,TEXT("rejected_fire_no_kick"));'],
  ['RifleCheck(Action(TEXT("reload")),TEXT("one_round_reload_starts"));','RifleCheck(RecoilProbeSettled(),TEXT("recoil_rises_then_settles"));RifleCheck(Action(TEXT("reload")),TEXT("one_round_reload_starts"));'],
  ['RifleCheck(Ammo==3&&Action(TEXT("reload")),TEXT("multi_round_reload_starts"));','RifleCheck(Recoil.Shots==Shots&&Recoil.Index==2,TEXT("recoil_string_walks_pattern"));RifleCheck(Ammo==3&&Action(TEXT("reload")),TEXT("multi_round_reload_starts"));'],
  ['RifleCheck(Action(TEXT("fire"))&&Ammo==9&&Shots==1&&Range.Shots.Num()==1,TEXT("real_fire_one_shot_one_round"));RifleCheck(!Action(TEXT("fire"))&&!Action(TEXT("aim"))&&!Action(TEXT("inspect"))&&!Action(TEXT("reload")),TEXT("bolt_cycle_gates_all_actions"));',
   replay('ActiveProfile->ProfileId','RifleCheck')+'RifleCheck(Action(TEXT("fire"))&&Ammo==9&&Shots==1&&Range.Shots.Num()==1,TEXT("real_fire_one_shot_one_round"));RifleCheck(RecoilProbeShot(),TEXT("recoil_shot_uses_pre_kick_aim"));RifleCheck(!Action(TEXT("fire"))&&!Action(TEXT("aim"))&&!Action(TEXT("inspect"))&&!Action(TEXT("reload")),TEXT("bolt_cycle_gates_all_actions"));RifleCheck(Recoil.Shots==1,TEXT("rejected_fire_no_kick"));'],
  ['RifleCapture(TEXT("inspect-right"));RifleShotsRemaining=5;','RifleCapture(TEXT("inspect-right"));RifleCheck(RecoilProbeSettled(),TEXT("recoil_rises_then_settles"));RifleShotsRemaining=5;'],
  ['RifleCheck(Ammo==4&&Action(TEXT("reload")),TEXT("charger_reload_starts"));','RifleCheck(Recoil.Shots==Shots&&Recoil.Index==4,TEXT("recoil_string_walks_pattern"));RifleCheck(Ammo==4&&Action(TEXT("reload")),TEXT("charger_reload_starts"));'],
  ['R->SetStringField(TEXT("performance"),TEXT("DIRTY"));','R->SetStringField(TEXT("performance"),TEXT("DIRTY"));R->SetStringField(TEXT("recoil"),RecoilSummary);']]]];
// Validate every edit and backup slot before writing anything.
const out=jobs.map(([f,pairs])=>{const file=path.join(root,f),raw=fs.readFileSync(file,'utf8'),eol=raw.includes('\r\n')?'\r\n':'\n';let s=raw.replace(/\r\n/g,'\n');
 for(const [a,b] of pairs){if(s.split(a).length!==2)throw Error(f+' needs exactly one '+a.slice(0,100));s=s.replace(a,()=>b);}
 const ext=path.extname(f),saved=path.join(backup,path.basename(f,ext)+'.before-recoil'+ext);if(fs.existsSync(saved))throw Error('Backup already exists: '+saved);
 return {file,saved,raw,text:s.replace(/\n/g,eol)};});
for(const h of ['WeaponRecoil.h','WeaponRecoilData.h','WeaponRecoilFixture.h'])if(!fs.existsSync(path.join(root,src,h)))throw Error('Missing '+h);
fs.mkdirSync(backup,{recursive:true});
for(const o of out){fs.writeFileSync(o.saved,o.raw);fs.writeFileSync(o.file,o.text);}
console.log('recoil v1 wired:',out.map(o=>path.relative(root,o.file)).join(', '));
