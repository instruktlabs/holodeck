#pragma once
#include "CoreMinimal.h"
// Recoil v1 (docs/recoil-v1.md): mirrors game/recoil.mjs. Degrees; X is pitch up and Y is yaw right. Profiles and the shared fixtures
// are generated into WeaponRecoilData.h from game/recoil-profiles-v1.json and game/recoil-fixtures-v1.json.
namespace WeaponRecoil {
struct FProfile{const TCHAR* Id;const TCHAR* Revision;double BaseKick,PitchScale,YawScale,Recovery,Rise,Residual,ResetAfter;const double (*Pattern)[2];int32 Rows;};
inline uint32 Fnv1a32(const FString& Text){FTCHARToUTF8 Utf8(*Text);uint32 H=0x811c9dc5u;for(int32 I=0;I<Utf8.Length();I++)H=(H^uint8(Utf8.Get()[I]))*0x01000193u;return H;}
struct FMulberry32{uint32 A;explicit FMulberry32(uint32 Seed):A(Seed){}uint32 NextRaw(){A+=0x6D2B79F5u;uint32 T=(A^(A>>15))*(A|1u);T^=T+((T^(T>>7))*(T|61u));return T^(T>>14);}double Next(){return double(NextRaw())/4294967296.0;}};
inline FString ShotSeedKey(const FString& SessionId,const FString& ShotId,const TCHAR* Revision){return FString::Printf(TEXT("%u|%s|%s|weapon-response"),Fnv1a32(SessionId),*ShotId,Revision);}
inline FVector2D Kick(const FProfile& P,int32 Index,const FString& SessionId,const FString& ShotId){
 const double* Row=P.Pattern[FMath::Clamp(Index,0,P.Rows-1)];FMulberry32 R(Fnv1a32(ShotSeedKey(SessionId,ShotId,P.Revision)));const double A=2*R.Next()-1,B=2*R.Next()-1;
 return FVector2D(P.BaseKick*Row[0]*(1+P.PitchScale*A),P.BaseKick*(Row[1]+P.YawScale*B));
}
// Pending: the part of the kicks still to recover. View: where the aim is now, relative to where it will settle.
struct FState{
 const FProfile* Profile=nullptr;double Time=0,LastShotTime=0,Pending[2]={0,0},View[2]={0,0};bool HasShot=false;int32 Index=-1,Shots=0;FString LastShotId;FVector2D LastKick=FVector2D::ZeroVector;
 void Reset(const FProfile* InProfile){*this=FState();Profile=InProfile;}
 // Call once for an accepted shot, after its ray was taken from the current aim.
 bool Fire(const FString& SessionId,const FString& ShotId){
  if(!Profile||ShotId.IsEmpty()||ShotId==LastShotId)return false;Index=!HasShot||Time-LastShotTime>=Profile->ResetAfter?0:Index+1;HasShot=true;LastShotTime=Time;LastShotId=ShotId;Shots++;
  LastKick=Kick(*Profile,Index,SessionId,ShotId);const double K[2]={LastKick.X,LastKick.Y};for(int32 I=0;I<2;I++){Pending[I]+=(1-Profile->Residual)*K[I];View[I]-=Profile->Residual*K[I];}return true;
 }
 // Exact over any step, so the aim does not depend on the frame rate. Returns the change to apply to the look.
 FVector2D Step(double Dt){
  if(!Profile||!FMath::IsFinite(Dt)||Dt<=0)return FVector2D::ZeroVector;
  const double A=FMath::Exp(-Dt/Profile->Recovery),B=FMath::Exp(-Dt/Profile->Rise),C=Profile->Recovery/(Profile->Recovery-Profile->Rise);double D[2];Time+=Dt;
  for(int32 I=0;I<2;I++){const double U=Pending[I],V=View[I]*B+U*C*(A-B);D[I]=V-View[I];Pending[I]=U*A;View[I]=V;}return FVector2D(D[0],D[1]);
 }
};
}
