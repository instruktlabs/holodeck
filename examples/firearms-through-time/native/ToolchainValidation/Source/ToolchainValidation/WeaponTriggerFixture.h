#pragma once
#include "WeaponTriggerData.h"
#include "WeaponRecoilData.h"
// Replays the shared trigger fixtures (game/trigger-fixtures-v1.json) through the native trigger, rules and recoil, as
// game/trigger-replay.mjs does: a host that accepts every round the gun allows, frames cut at each input's exact time. Every event
// must match its time within 1e-9 s and its aim within 1e-9 degrees at 30, 90, 144 (uneven splits) and 251 Hz.
namespace WeaponTrigger {
struct FReplayResult{TArray<WeaponTriggerData::FExpected> Events;TArray<FString> ShotIds;FWeapon W;double Look[2]={0,0};};
inline bool Replay(const WeaponTriggerData::FScenario& S,double Rate,bool Split,FReplayResult& Out,FString& Error){
 using namespace WeaponTriggerData;
 const FRules* Spec=Find(FName(S.Profile));const WeaponRecoil::FProfile* Kick=WeaponRecoilData::Find(FName(S.Profile));if(!Spec||!Kick){Error=FString(TEXT("no rules or recoil profile for "))+S.Profile;return false;}
 FWeapon& W=Out.W;W.Reset(Spec);if(S.InitialAmmo>=0)W.Ammo=S.InitialAmmo;WeaponRecoil::FState R;R.Reset(Kick);const FString Session=S.SessionId;int32 Next=0;
 auto Act=[&](EEvent Type,const FVector2D& Turn){
  const double T=W.Trigger.Time;FExpected E{Type,T,-1,nullptr,{Out.Look[0]+Turn.X,Out.Look[1]+Turn.Y}};
  if(Type==EEvent::Ignite){W.Ignite();const FString Id=FString::Printf(TEXT("%s:shot:%d"),*Session,W.Shots);R.Fire(Session,Id);Out.Events.Add(E);Out.ShotIds.Add(Id);return true;}
  E.CamBefore=W.Trigger.Cam;if(!W.Shoot())return false;
  FString Id;if(Type==EEvent::Shot){Id=FString::Printf(TEXT("%s:shot:%d"),*Session,W.Shots);R.Fire(Session,Id);}Out.Events.Add(E);Out.ShotIds.Add(Id);return true;};
 auto Frame=[&](double Span){const double Parts[]={.37,.21,.42};for(int32 I=0;I<(Split?3:1);I++){const FVector2D Turn=RunFireFrame(W,R,Split?Span*Parts[I]:Span,Act);Out.Look[0]+=Turn.X;Out.Look[1]+=Turn.Y;}};
 auto Apply=[&](const FInput& I){if(I.What==EInput::Pull)W.Trigger.Pull();else if(I.What==EInput::Release)W.Trigger.Release();else if(I.What==EInput::Mode)W.Trigger.CycleMode(Spec->Fire);else W.Command(TEXT("reload"));};
 for(int32 F=0,Frames=int32(FMath::CeilToDouble(S.Until*Rate-1e-9));F<Frames;F++){
  const double End=FMath::Min((F+1)/Rate,S.Until);double At=F/Rate;
  while(Next<S.NumInputs&&S.Inputs[Next].At<End-1e-12){const FInput& I=S.Inputs[Next++];if(I.At>At+1e-12){Frame(I.At-At);At=I.At;}Apply(I);}
  Frame(End-At);
 }
 return true;
}
inline bool ReplayFixtures(FString& Summary){
 using namespace WeaponTriggerData;
 struct FRun{double Rate;bool Split;};const FRun Runs[]={{30,false},{90,false},{144,true},{251,false}};
 double WorstTime=0,WorstAim=0;int32 Checked=0;
 for(const FScenario& S:Scenarios)for(const FRun& Run:Runs){
  FReplayResult Out;FString Error;const FString Where=FString::Printf(TEXT("%s at %g Hz%s"),S.Name,Run.Rate,Run.Split?TEXT(" split"):TEXT(""));
  if(!Replay(S,Run.Rate,Run.Split,Out,Error)){Summary=Where+TEXT(": ")+Error;return false;}
  if(Out.Events.Num()!=S.NumEvents){Summary=FString::Printf(TEXT("%s: %d events, expected %d"),*Where,Out.Events.Num(),S.NumEvents);return false;}
  for(int32 I=0;I<S.NumEvents;I++){const FExpected& X=S.Events[I];const FExpected& E=Out.Events[I];
   WorstTime=FMath::Max(WorstTime,FMath::Abs(E.T-X.T));WorstAim=FMath::Max(WorstAim,FMath::Max(FMath::Abs(E.Aim[0]-X.Aim[0]),FMath::Abs(E.Aim[1]-X.Aim[1])));
   if(E.Type!=X.Type||FMath::Abs(E.T-X.T)>1e-9||FMath::Abs(E.Aim[0]-X.Aim[0])>1e-9||FMath::Abs(E.Aim[1]-X.Aim[1])>1e-9||(X.CamBefore>=0&&E.CamBefore!=X.CamBefore)||(X.ShotId&&!Out.ShotIds[I].Equals(X.ShotId,ESearchCase::CaseSensitive))){
    Summary=FString::Printf(TEXT("%s: event %d is %s at %.12f s aim (%.12f, %.12f); expected %s at %.12f s aim (%.12f, %.12f)"),*Where,I,EventName(E.Type),E.T,E.Aim[0],E.Aim[1],EventName(X.Type),X.T,X.Aim[0],X.Aim[1]);return false;}}
  WorstAim=FMath::Max(WorstAim,FMath::Max(FMath::Abs(Out.Look[0]-S.Look[0]),FMath::Abs(Out.Look[1]-S.Look[1])));
  if(FMath::Abs(Out.Look[0]-S.Look[0])>1e-9||FMath::Abs(Out.Look[1]-S.Look[1])>1e-9||Out.W.Ammo!=S.Ammo||Out.W.Reserve!=S.Reserve||Out.W.Shots!=S.Shots||Out.W.Trigger.Cam!=S.Cam||Out.W.Trigger.Mode!=S.FireMode||Out.W.Mode!=EWeaponMode::Idle){
   Summary=FString::Printf(TEXT("%s: final look (%.12f, %.12f) ammo %d reserve %d shots %d cam %d mode %s; expected (%.12f, %.12f) %d %d %d %d %s"),*Where,Out.Look[0],Out.Look[1],Out.W.Ammo,Out.W.Reserve,Out.W.Shots,Out.W.Trigger.Cam,ModeName(Out.W.Trigger.Mode),S.Look[0],S.Look[1],S.Ammo,S.Reserve,S.Shots,S.Cam,ModeName(S.FireMode));return false;}
  Checked+=S.NumEvents;
 }
 Summary=FString::Printf(TEXT("%d scenarios at 30, 90, 144 (split) and 251 Hz: %d events, worst time difference %.3g s, worst aim difference %.3g deg"),int32(UE_ARRAY_COUNT(Scenarios)),Checked,WorstTime,WorstAim);return true;
}
}
