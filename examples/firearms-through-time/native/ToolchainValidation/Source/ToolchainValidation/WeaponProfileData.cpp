#include "WeaponProfileData.h"
#include "Animation/AnimSequence.h"
#include "Engine/SkeletalMesh.h"
const FWeaponClipBinding* UWeaponProfileData::Clip(FName Name)const{return Clips.FindByPredicate([Name](const auto& C){return C.Name==Name;});}
FWeaponMotionKey UWeaponProfileData::Sample(FName Name,float Seconds)const{
 FWeaponMotionKey R;const auto* C=Clip(Name);if(!C||C->Keys.IsEmpty())return R;
 const float T=FMath::Clamp(Seconds/C->Duration,0.f,1.f);if(C->Keys.Num()==1)return C->Keys[0];
 int32 I=0;while(I<C->Keys.Num()-2&&T>C->Keys[I+1].T)I++;const auto&A=C->Keys[I];const auto&B=C->Keys[I+1];
 const float X=FMath::Clamp((T-A.T)/FMath::Max(1e-6f,B.T-A.T),0.f,1.f),U=X*X*X*(X*(X*6-15)+10);
 R.T=T;R.RootTranslation=FMath::Lerp(A.RootTranslation,B.RootTranslation,U);R.RootRotation=FRotator(FMath::Lerp(A.RootRotation.Pitch,B.RootRotation.Pitch,U),FMath::Lerp(A.RootRotation.Yaw,B.RootRotation.Yaw,U),FMath::Lerp(A.RootRotation.Roll,B.RootRotation.Roll,U));R.LeftOffset=FMath::Lerp(A.LeftOffset,B.LeftOffset,U);R.RightOffset=FMath::Lerp(A.RightOffset,B.RightOffset,U);R.Lever=FMath::Lerp(A.Lever,B.Lever,U);R.Hammer=FMath::Lerp(A.Hammer,B.Hammer,U);R.Cartridge=FMath::Lerp(A.Cartridge,B.Cartridge,U);R.BoltLift=FMath::Lerp(A.BoltLift,B.BoltLift,U);R.BoltSlide=FMath::Lerp(A.BoltSlide,B.BoltSlide,U);R.MagOut=FMath::Lerp(A.MagOut,B.MagOut,U);R.ChargingHandle=FMath::Lerp(A.ChargingHandle,B.ChargingHandle,U);return R;
}
bool UWeaponProfileData::Validate(FString& Reason)const{
 if(ProfileId.IsNone()||!Hands||Parts.IsEmpty()||Capacity<=0||InitialReserve<0||FireDuration<=0||ReloadDuration<=0||ReloadCommitPhase<=0||ReloadCommitPhase>=1){Reason=TEXT("Missing profile assets or invalid game tuning");return false;}
 const bool Bolt=ActionKind==TEXT("bolt"),Carbine=ActionKind==TEXT("carbine");if(!Bolt&&!Carbine&&ActionKind!=TEXT("lever")){Reason=TEXT("Unknown action kind");return false;}
 // The M4 reloads from empty with its own clip (the charging handle after the seat).
 TArray<FName> Required={FName(TEXT("Ready")),FName(TEXT("Fire")),FName(TEXT("Reload")),FName(TEXT("Inspect"))};if(Carbine)Required.Add(FName(TEXT("ReloadEmpty")));
 for(const FName Name:Required){const auto*C=Clip(Name);if(!C||!C->Sequence||C->Sequence->GetSkeleton()!=Hands->GetSkeleton()||C->Keys.Num()<2||C->Duration<=0||FMath::Abs(C->Sequence->GetPlayLength()-C->Duration)>.035f){Reason=TEXT("Missing or mismatched authored clip: ")+Name.ToString();return false;}}
 if(RoundsPerCommit<1||RoundsPerCommit>Capacity){Reason=TEXT("Invalid rounds per reload commit");return false;}
 if(Carbine&&(MagazineDropCm<=0||ChargingHandleTravelCm<=0||!MagazineDropAxis.IsNormalized()||!ChargingHandleAxis.IsNormalized()||LoadingCueBone.IsNone())){Reason=TEXT("Invalid magazine or charging-handle travel");return false;}
 const FName MovingA=Bolt?FName(TEXT("bolt_slide")):Carbine?FName(TEXT("magazine")):FName(TEXT("lever")),MovingB=Bolt?FName(TEXT("bolt_lift")):Carbine?FName(TEXT("charging_handle")):FName(TEXT("hammer"));
 for(const auto&P:Parts)if(!P.Mesh||(P.Joint!=TEXT("body")&&P.Joint!=MovingA&&P.Joint!=MovingB&&P.Joint!=TEXT("loading")&&P.Joint!=TEXT("front_sight"))){Reason=TEXT("Invalid rigid-part binding");return false;}
 // The bolt's shell and handle all sit under the lift pivot, so only the lever profile requires parts on both pivots.
 if(!Parts.ContainsByPredicate([MovingB](const auto&P){return P.Joint==MovingB;})||(!Bolt&&!Parts.ContainsByPredicate([MovingA](const auto&P){return P.Joint==MovingA;}))){Reason=TEXT("Missing separately owned moving parts");return false;}
 for(const FName N:{FName(TEXT("anchor_sight_rear")),FName(TEXT("anchor_sight_front")),FName(TEXT("anchor_vfx_muzzle")),FName(Bolt?TEXT("anchor_interaction_bolt"):Carbine?TEXT("anchor_interaction_magazine"):TEXT("anchor_interaction_loading_gate"))})if(!Anchors.ContainsByPredicate([N](const auto&A){return A.Name==N;})){Reason=TEXT("Missing required source anchor: ")+N.ToString();return false;}
 if(!Parts.ContainsByPredicate([](const auto&P){return P.Joint==TEXT("loading");})){Reason=TEXT("Missing cosmetic loading cue");return false;}
 return true;
}
