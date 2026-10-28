#pragma once
#include "WeaponRecoilData.h"
// Replays the shared recoil fixtures (game/recoil-fixtures-v1.json) through the native recoil code in 1/90 s frames: the hash and PRNG
// vectors, then one gun's timed string, whose kicks must match exactly and whose aim must match within 1e-9 degrees.
namespace WeaponRecoil {
inline bool ReplayFixture(FName ProfileId,FString& Summary){
 for(const auto& V:WeaponRecoilData::HashVectors)if(Fnv1a32(V.Text)!=V.Hash){Summary=FString::Printf(TEXT("hash mismatch for '%s'"),V.Text);return false;}
 for(const auto& V:WeaponRecoilData::PrngVectors){FMulberry32 R(V.Seed);for(const uint32 X:V.Raw)if(R.NextRaw()!=X){Summary=FString::Printf(TEXT("PRNG mismatch for seed %u"),V.Seed);return false;}}
 const WeaponRecoilData::FScenario* S=nullptr;for(const auto& C:WeaponRecoilData::Scenarios)if(ProfileId==FName(C.Profile))S=&C;
 const FProfile* P=WeaponRecoilData::Find(ProfileId);if(!S||!P){Summary=TEXT("no recoil profile or fixture for ")+ProfileId.ToString();return false;}
 FState State;State.Reset(P);double Aim[2]={0,0},Worst=0;int32 Now=0,NextShot=0,NextSample=0;
 while(NextShot<S->NumShots||NextSample<S->NumSamples){
  const int32 Ms=FMath::Min(NextShot<S->NumShots?S->Shots[NextShot].Ms:MAX_int32,NextSample<S->NumSamples?S->Samples[NextSample].Ms:MAX_int32);
  for(double Left=(Ms-Now)/1000.0;Left>1e-12;){const double Dt=FMath::Min(1/90.0,Left);const FVector2D D=State.Step(Dt);Aim[0]+=D.X;Aim[1]+=D.Y;Left-=Dt;}Now=Ms;
  if(NextSample<S->NumSamples&&S->Samples[NextSample].Ms==Ms){const auto& X=S->Samples[NextSample++];Worst=FMath::Max(Worst,FMath::Max(FMath::Abs(Aim[0]-X.Aim[0]),FMath::Abs(Aim[1]-X.Aim[1])));}
  if(NextShot<S->NumShots&&S->Shots[NextShot].Ms==Ms){const auto& X=S->Shots[NextShot++];
   if(!State.Fire(S->SessionId,X.ShotId)||State.Index!=X.Index||FMath::Abs(State.LastKick.X-X.Kick[0])>1e-12||FMath::Abs(State.LastKick.Y-X.Kick[1])>1e-12){Summary=FString::Printf(TEXT("kick mismatch at %s"),X.ShotId);return false;}}
 }
 Summary=FString::Printf(TEXT("%s: %d kicks, %d aim samples, worst aim difference %.3g deg"),*ProfileId.ToString(),S->NumShots,S->NumSamples,Worst);return Worst<=1e-9;
}
}
