#include "OpeningCaseActor.h"
#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/Engine.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "InputCoreTypes.h"
#include "Algo/AllOf.h"
#include "HAL/PlatformMisc.h"
AOpeningCaseActor::AOpeningCaseActor(){
 PrimaryActorTick.bCanEverTick=true;
 SetRootComponent(CreateDefaultSubobject<USceneComponent>(TEXT("CaseRoot")));
 Pivot=CreateDefaultSubobject<USceneComponent>(TEXT("LidPivot"));Pivot->SetupAttachment(RootComponent);Pivot->SetRelativeLocation(FVector(0,-34.6,62.5));
 for(int32 i=0;i<9;++i){auto* P=CreateDefaultSubobject<UStaticMeshComponent>(*FString::Printf(TEXT("CasePart%d"),i));P->SetupAttachment(i<6?RootComponent:Pivot);P->SetMobility(EComponentMobility::Movable);P->SetCollisionEnabled(ECollisionEnabled::NoCollision);(i<6?Body:Lid).Add(P);}
}
void AOpeningCaseActor::SetParts(const TArray<UStaticMesh*>& B,const TArray<UStaticMesh*>& L){check(B.Num()==6&&L.Num()==3);for(int32 i=0;i<6;++i)Body[i]->SetStaticMesh(B[i]);for(int32 i=0;i<3;++i)Lid[i]->SetStaticMesh(L[i]);}
void AOpeningCaseActor::BeginPlay(){Super::BeginPlay();Testing=FParse::Param(FCommandLine::Get(),TEXT("OpeningCaseTest"));InitialBody=GetActorTransform();}
void AOpeningCaseActor::ToggleOpen(){Open=!Open;}
void AOpeningCaseActor::ResetCase(){Open=false;Angle=0;Pivot->SetRelativeRotation(FQuat::Identity);}
void AOpeningCaseActor::Verify(bool C,const TCHAR* N){Failed|=!C;UE_LOG(LogTemp,Display,TEXT("CASE_CHECK %s %s"),N,C?TEXT("PASS"):TEXT("FAIL"));}
void AOpeningCaseActor::Capture(const TCHAR* Pose){FString Base;if(auto* PC=UGameplayStatics::GetPlayerController(this,0);PC&&FParse::Value(FCommandLine::Get(),TEXT("OpeningCaseCapture="),Base))PC->ConsoleCommand(FString::Printf(TEXT("HighResShot 1 filename=\"%s-%s.png\""),*Base,Pose),true);}
void AOpeningCaseActor::Tick(float Dt){
 Super::Tick(Dt);Elapsed+=Dt;
 auto* PC=UGameplayStatics::GetPlayerController(this,0);
 if(PC&&!Testing){if(PC->WasInputKeyJustPressed(EKeys::SpaceBar))ToggleOpen();if(PC->WasInputKeyJustPressed(EKeys::R))ResetCase();}
 Angle=FMath::FInterpConstantTo(Angle,Open?1.8325957f:0.f,Dt,1.5f);
 // glTF -X rotation maps to positive rotation about UE X across the Y/Z reflection.
 Pivot->SetRelativeRotation(FQuat(FVector(1,0,0),Angle));
 if(GEngine)GEngine->AddOnScreenDebugMessage(732,0.f,FColor::White,FString::Printf(TEXT("CASE | Space: open/close | R: reset | %s | %.1f deg"),Open?TEXT("OPEN"):TEXT("CLOSED"),FMath::RadiansToDegrees(Angle)));
 if(!Testing)return;
 if(Phase==0&&Elapsed>=2.f){Verify(Algo::AllOf(Body,[](const auto& P){return P&&P->GetStaticMesh();})&&Algo::AllOf(Lid,[](const auto& P){return P&&P->GetStaticMesh();}),TEXT("all_nine_parts_loaded"));Verify(Angle==0&&!Open,TEXT("starts_closed"));Capture(TEXT("closed"));ToggleOpen();Phase++;}
 else if(Phase==1&&Elapsed>=2.6f){Verify(Angle>.3f&&Angle<1.8f,TEXT("intermediate_pose"));Capture(TEXT("mid"));Phase++;}
 else if(Phase==2&&Elapsed>=4.5f){Verify(FMath::IsNearlyEqual(Angle,1.8325957f),TEXT("opens_to_limit"));Verify(GetActorTransform().Equals(InitialBody)&&Pivot->GetRelativeLocation().Equals(FVector(0,-34.6,62.5)),TEXT("body_and_pivot_stable"));Verify(Pivot->GetComponentTransform().TransformPosition(FVector(0,60,0)).Z>110.f,TEXT("lid_front_lifts"));Capture(TEXT("open"));ToggleOpen();Phase++;}
 else if(Phase==3&&Elapsed>=7.f){Verify(Angle==0&&!Open,TEXT("closes_to_rest"));ToggleOpen();Phase++;}
 else if(Phase==4&&Elapsed>=7.5f){Verify(Angle>.1f,TEXT("reopens"));ResetCase();Verify(Angle==0&&!Open&&Pivot->GetRelativeRotation().IsNearlyZero(),TEXT("reset_restores_closed"));Phase++;}
 else if(Phase==5&&Elapsed>=9.f){UE_LOG(LogTemp,Display,TEXT("CASE_RESULT %s"),Failed?TEXT("FAIL"):TEXT("PASS"));FPlatformMisc::RequestExitWithStatus(false,Failed?1:0);Phase++;}
}
