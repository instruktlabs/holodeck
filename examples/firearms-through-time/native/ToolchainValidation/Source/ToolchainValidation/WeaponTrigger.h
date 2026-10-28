#pragma once
#include "CoreMinimal.h"
#include "WeaponRecoil.h"
// Trigger v1 (docs/m4-1742-v14.md): mirrors game/trigger.mjs, game/fire-frame.mjs and the held-trigger profiles' rules in game/weapon.mjs.
// Seconds on the weapon's own clock. Rules and the shared fixtures are generated into WeaponTriggerData.h from the game contracts and
// game/trigger-fixtures-v1.json. Inputs apply at frame starts; a pull is latched, so a click shorter than a frame still fires once.
namespace WeaponTrigger {
enum class EFireMode:uint8{Semi,Burst,Auto};
enum class EEvent:uint8{Shot,Lock,Ignite};
enum class EReload:uint8{MagazineSwap,PerCycle,AtEnd};
enum class EWeaponMode:uint8{Idle,Reload,Inspect};
struct FFire{EFireMode Modes[3];int32 NumModes;EFireMode Initial;double CycleSeconds,IgnitionDelaySeconds,PanFlashSeconds;int32 BurstRounds;};
struct FRules{const TCHAR* Profile;const TCHAR* Id;int32 Capacity,Reserve;double Cooldown;bool CycleBlocksActions;EReload Policy;double Reload,ReloadCommitPhase,ReloadEmpty,ReloadEmptyCommitPhase,Inspect;int32 RoundsPerCommit;FFire Fire;};
inline constexpr double Never=TNumericLimits<double>::Max();
inline const TCHAR* ModeName(EFireMode M){return M==EFireMode::Burst?TEXT("burst"):M==EFireMode::Auto?TEXT("auto"):TEXT("semi");}
inline const TCHAR* EventName(EEvent E){return E==EEvent::Lock?TEXT("lock"):E==EEvent::Ignite?TEXT("ignite"):TEXT("shot");}
// Burst runs a non-resetting cam: a release mid-burst leaves it, and the next pull fires the rest. A refused round also leaves it.
struct FTrigger{
 EFireMode Mode=EFireMode::Semi;bool Down=false,Latched=false,Engaged=false;int32 Cam=0,Pulls=0,Fired=0;double ReadyAt=0,Time=0;TArray<double> Pending;
 void Reset(const FFire& F){*this=FTrigger();Mode=F.Initial;}
 bool Pull(){if(Down)return false;Down=true;Latched=true;Pulls++;return true;}
 bool Release(){if(!Down)return false;Down=false;if(!Latched)Engaged=false;return true;}
 bool CycleMode(const FFire& F){if(Down||Latched||Engaged||F.NumModes<2)return false;int32 I=-1;for(int32 K=0;K<F.NumModes;K++)if(F.Modes[K]==Mode){I=K;break;}Mode=F.Modes[(I+1)%F.NumModes];return true;}
 int32 BurstLeft(const FFire& F)const{return Mode==EFireMode::Burst?F.BurstRounds-Cam:-1;}
};
struct FTriggerEvent{EEvent Type=EEvent::Shot;double At=0,In=0;};
inline bool NextEvent(const FTrigger& T,const FFire& F,double Horizon,FTriggerEvent& E){
 const double Ignite=T.Pending.Num()?T.Pending[0]:Never,Sear=T.Latched||(T.Engaged&&T.Down)?FMath::Max(T.Time,T.ReadyAt):Never,At=FMath::Min(Ignite,Sear);
 if(At==Never||!(At-T.Time<=Horizon))return false;
 E.Type=Ignite<=Sear?EEvent::Ignite:F.IgnitionDelaySeconds>0?EEvent::Lock:EEvent::Shot;E.At=At;E.In=FMath::Max(0.,At-T.Time);return true;
}
inline void CompleteEvent(FTrigger& T,const FFire& F,const FTriggerEvent& E,bool Fired){
 T.Time=FMath::Max(T.Time,E.At);
 if(E.Type==EEvent::Ignite){T.Pending.RemoveAt(0);return;}
 T.Latched=false;if(!Fired){T.Engaged=false;return;}
 T.Fired++;T.ReadyAt=E.At+F.CycleSeconds;
 if(E.Type==EEvent::Lock){T.Pending.Add(E.At+F.IgnitionDelaySeconds);T.Engaged=false;return;}
 if(T.Mode==EFireMode::Burst){T.Cam=(T.Cam+1)%F.BurstRounds;T.Engaged=T.Down&&T.Cam!=0;}else T.Engaged=T.Mode==EFireMode::Auto&&T.Down;
}
// The gun's own state. The trigger owns the cadence, so only the gun's mode (and a musket's lock, while cycling) refuses a round.
struct FWeapon{
 const FRules* Rules=nullptr;int32 Ammo=0,Reserve=0,Shots=0,ReloadCommits=0;EWeaponMode Mode=EWeaponMode::Idle;bool Aim=false,EmptyReload=false,ReloadCommitted=false;double Timer=0,Cooldown=0,Flash=0;FString Message;FTrigger Trigger;
 void Reset(const FRules* InRules){*this=FWeapon();Rules=InRules;if(!Rules)return;Ammo=Rules->Capacity;Reserve=Rules->Reserve;Trigger.Reset(Rules->Fire);Message=TEXT("Ready");}
 bool Cycling()const{return Rules->CycleBlocksActions&&Cooldown>0;}
 // The M4 reloads from empty with a longer clip (the charging handle after the seat).
 double ReloadDuration()const{return EmptyReload?Rules->ReloadEmpty:Rules->Reload;}
 double ReloadCommitPhase()const{return EmptyReload?Rules->ReloadEmptyCommitPhase:Rules->ReloadCommitPhase;}
 bool Command(FName Action){
  if(Cycling())return false;
  if(Action==TEXT("aim")){if(Mode!=EWeaponMode::Idle)return false;Aim=!Aim;Message=Aim?TEXT("Aim"):TEXT("Ready");return true;}
  if(Action==TEXT("inspect")){if(Mode!=EWeaponMode::Idle)return false;Mode=EWeaponMode::Inspect;Timer=Rules->Inspect;Aim=false;Message=TEXT("Inspect");return true;}
  if(Action==TEXT("reload")){if(Mode!=EWeaponMode::Idle||Ammo==Rules->Capacity||!Reserve)return false;Mode=EWeaponMode::Reload;EmptyReload=Rules->ReloadEmpty>0&&!Ammo;Timer=ReloadDuration();ReloadCommitted=false;Aim=false;Message=TEXT("Reload");return true;}
  return false;
 }
 // A flintlock commits on the lock; its kick (flash) starts at the ignition.
 bool Shoot(){
  if(Mode!=EWeaponMode::Idle||Cycling()){Message=TEXT("Finish the current action first");return false;}if(!Ammo){Message=TEXT("Empty - reload");return false;}
  Ammo--;Shots++;Cooldown=Rules->Cooldown;Flash=Rules->Fire.IgnitionDelaySeconds>0?0:.09;Message=TEXT("Shot");return true;
 }
 void Ignite(){Flash=.09;}
 void Step(double Dt){
  if(!FMath::IsFinite(Dt)||Dt<=0)return;Dt=FMath::Min(Dt,.1);
  Cooldown=FMath::Max(0.,Cooldown-Dt);Flash=FMath::Max(0.,Flash-Dt);
  if(Timer<=0)return;Timer=FMath::Max(0.,Timer-Dt);if(Timer<1e-9)Timer=0;
  if(Mode==EWeaponMode::Reload&&Rules->Policy!=EReload::AtEnd&&!ReloadCommitted&&Timer<=ReloadDuration()*(1-ReloadCommitPhase())+1e-9){
   const bool Swap=Rules->Policy==EReload::MagazineSwap;const int32 N=FMath::Min3(Swap?Rules->Capacity:Rules->RoundsPerCommit,Rules->Capacity-Ammo,Reserve);if(N>0){Ammo+=N;Reserve-=N;ReloadCommits++;}ReloadCommitted=true;
   Message=Swap?FString(TEXT("Magazine seated")):N>1?FString::Printf(TEXT("%d rounds stripped"),N):FString(TEXT("Rammed"));
  }
  if(Timer>0)return;
  if(Mode==EWeaponMode::Reload){
   if(Rules->Policy==EReload::PerCycle){if(Ammo<Rules->Capacity&&Reserve>0){Timer=Rules->Reload;ReloadCommitted=false;Message=TEXT("Load next round");return;}}
   else if(Rules->Policy==EReload::AtEnd){const int32 N=FMath::Min(Rules->Capacity-Ammo,Reserve);Ammo+=N;Reserve-=N;ReloadCommits++;}
   EmptyReload=false;
  }
  Mode=EWeaponMode::Idle;Message=TEXT("Ready");
 }
};
// One host frame: split at each trigger event, stepping the gun, the trigger clock and the recoil together. Act(Type,Turn) gets the
// recoil turned so far in this frame ([pitch up, yaw right] degrees) and returns whether the round went. Returns the frame's turn.
template<typename FAct> FVector2D RunFireFrame(FWeapon& W,WeaponRecoil::FState& R,double Dt,FAct&& Act){
 if(!W.Rules||!FMath::IsFinite(Dt)||Dt<=0)return FVector2D::ZeroVector;Dt=FMath::Min(Dt,.1);
 FTrigger& T=W.Trigger;const FFire& F=W.Rules->Fire;FVector2D Turn=FVector2D::ZeroVector;const double End=T.Time+Dt;double Left=Dt;
 auto Advance=[&](double S){if(!(S>0))return;W.Step(S);const FVector2D D=R.Step(S);Turn.X+=D.X;Turn.Y+=D.Y;};
 // The trigger clock reaches the event before the host acts, so the host sees the event's own time.
 for(FTriggerEvent E;NextEvent(T,F,Left,E);){Advance(E.In);Left=FMath::Max(0.,Left-E.In);T.Time=FMath::Max(T.Time,E.At);CompleteEvent(T,F,E,Act(E.Type,Turn)==true);}
 Advance(Left);T.Time=FMath::Max(T.Time,End);return Turn;
}
}
