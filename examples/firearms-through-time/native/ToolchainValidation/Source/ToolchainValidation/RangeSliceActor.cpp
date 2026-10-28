#include "RangeSliceActor.h"
#include "WeaponLoop.h"
#include "Components/SceneComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Components/BoxComponent.h"
#include "Components/CapsuleComponent.h"
#include "Camera/CameraComponent.h"
#include "Camera/CameraActor.h"
#include "EngineUtils.h"
#include "GameFramework/FloatingPawnMovement.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/Engine.h"
#include "Engine/StaticMesh.h"
#include "InputCoreTypes.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "HAL/PlatformMisc.h"
ARangeSlicePawn::ARangeSlicePawn(){PrimaryActorTick.bCanEverTick=true;Capsule=CreateDefaultSubobject<UCapsuleComponent>(TEXT("Body"));SetRootComponent(Capsule);Capsule->InitCapsuleSize(22,90);Capsule->SetCollisionProfileName(TEXT("Pawn"));Camera=CreateDefaultSubobject<UCameraComponent>(TEXT("Eye"));Camera->SetupAttachment(RootComponent);Camera->SetRelativeLocation(FVector(0,0,82));Camera->FieldOfView=95;Movement=CreateDefaultSubobject<UFloatingPawnMovement>(TEXT("Walk"));Movement->MaxSpeed=250;Movement->Acceleration=1600;Movement->Deceleration=2000;AutoPossessPlayer=EAutoReceiveInput::Player0;}
void ARangeSlicePawn::Tick(float Dt){Super::Tick(Dt);if(FParse::Param(FCommandLine::Get(),TEXT("RangeSliceTest"))||FParse::Param(FCommandLine::Get(),TEXT("WeaponLoopTest")))return;auto* PC=Cast<APlayerController>(GetController());if(!PC)return;float MX=0,MY=0;PC->GetInputMouseDelta(MX,MY);FRotator Look=Camera->GetRelativeRotation();Look.Pitch=FMath::Clamp(Look.Pitch-MY*.15f+(PC->IsInputKeyDown(EKeys::Up)?1:0)*Dt*60-(PC->IsInputKeyDown(EKeys::Down)?1:0)*Dt*60,-75.f,75.f);Camera->SetRelativeRotation(Look);AddActorWorldRotation(FRotator(0,MX*.15f+(PC->IsInputKeyDown(EKeys::Right)?1:0)*Dt*90-(PC->IsInputKeyDown(EKeys::Left)?1:0)*Dt*90,0));float F=(PC->IsInputKeyDown(EKeys::W)?1:0)-(PC->IsInputKeyDown(EKeys::S)?1:0),R=(PC->IsInputKeyDown(EKeys::D)?1:0)-(PC->IsInputKeyDown(EKeys::A)?1:0);AddMovementInput(GetActorForwardVector(),F);AddMovementInput(GetActorRightVector(),R);}
ARangeSliceActor::ARangeSliceActor(){PrimaryActorTick.bCanEverTick=true;SetRootComponent(CreateDefaultSubobject<USceneComponent>(TEXT("RangeRoot")));}
void ARangeSliceActor::AddModule(FName Id,const TArray<UStaticMesh*>& Body,const TArray<UStaticMesh*>& Moving,FVector Location,FVector Pivot){
 auto* Group=NewObject<USceneComponent>(this,Id);AddInstanceComponent(Group);Group->SetupAttachment(RootComponent);Group->SetRelativeLocation(Location);Group->RegisterComponent();
 USceneComponent* Joint=nullptr;if(Moving.Num()){Joint=NewObject<USceneComponent>(this,*FString::Printf(TEXT("%s_Joint"),*Id.ToString()));AddInstanceComponent(Joint);Joint->SetupAttachment(Group);Joint->SetRelativeLocation(Pivot);Joint->RegisterComponent();if(Id==TEXT("bay"))BayPivot=Joint;else if(Id==TEXT("target"))TargetPivot=Joint;}
 for(int32 Side=0;Side<2;Side++){const auto& Meshes=Side?Moving:Body;for(auto* Mesh:Meshes){auto* C=NewObject<UStaticMeshComponent>(this,*FString::Printf(TEXT("%s_%s"),*Id.ToString(),*Mesh->GetName()));AddInstanceComponent(C);C->SetupAttachment(Side?Joint:Group);C->SetMobility(EComponentMobility::Movable);C->SetStaticMesh(Mesh);C->SetCollisionEnabled(ECollisionEnabled::NoCollision);C->bDisallowNanite=true;if(Side)C->SetRelativeLocation(-Pivot);C->RegisterComponent();Parts.Add(C);}}
}
void ARangeSliceActor::AddBlocker(FName Id,FVector Center,FVector Size){auto* C=NewObject<UBoxComponent>(this,Id);AddInstanceComponent(C);C->SetupAttachment(RootComponent);C->SetRelativeLocation(Center);C->SetBoxExtent(Size*.5);C->SetCollisionProfileName(TEXT("BlockAll"));C->SetHiddenInGame(true);C->RegisterComponent();Blockers.Add(C);}
bool ARangeSliceActor::SelectBay(FVector Eye){if(FVector::Dist(Eye,FVector(1223,0,104))>350)return false;Selected=!Selected;return true;}
bool ARangeSliceActor::ToggleTarget(FVector Eye){if(FVector::Dist(Eye,FVector(1803,38,99))>350||(!Selected&&!TargetOpen))return false;TargetOpen=!TargetOpen;return true;}
bool ARangeSliceActor::ResetTarget(FVector Eye){if(FVector::Dist(Eye,FVector(1803,58,99))>350)return false;TargetOpen=false;TargetAngle=0;if(TargetPivot)TargetPivot->SetRelativeRotation(FQuat::Identity);return true;}
void ARangeSliceActor::ResetSlice(){Selected=false;TargetOpen=false;BayAngle=TargetAngle=0;if(BayPivot)BayPivot->SetRelativeRotation(FQuat::Identity);if(TargetPivot)TargetPivot->SetRelativeRotation(FQuat::Identity);}
void ARangeSliceActor::BeginPlay(){Super::BeginPlay();Testing=FParse::Param(FCommandLine::Get(),TEXT("RangeSliceTest"));}
void ARangeSliceActor::Check(bool C,const TCHAR* N){Failed|=!C;UE_LOG(LogTemp,Display,TEXT("SLICE_CHECK %s %s"),N,C?TEXT("PASS"):TEXT("FAIL"));}
void ARangeSliceActor::Capture(const TCHAR* Name){FString Base;if(auto* PC=UGameplayStatics::GetPlayerController(this,0);PC&&FParse::Value(FCommandLine::Get(),TEXT("RangeSliceCapture="),Base))PC->ConsoleCommand(FString::Printf(TEXT("HighResShot 1 filename=\"%s-%s.png\""),*Base,Name),true);}
void ARangeSliceActor::Tick(float Dt){Super::Tick(Dt);Elapsed+=Dt;auto* PC=UGameplayStatics::GetPlayerController(this,0);auto* Pawn=Cast<ARangeSlicePawn>(UGameplayStatics::GetPlayerPawn(this,0));
 if(PC&&Pawn&&!Testing){const FVector Eye=Pawn->Camera->GetComponentLocation();const bool NearBay=FVector::Dist(Eye,FVector(1223,0,104))<FVector::Dist(Eye,FVector(1803,38,99));if(PC->WasInputKeyJustPressed(EKeys::E)){if(NearBay)SelectBay(Eye);else ToggleTarget(Eye);}/* In the WeaponLab B resets the target, unless the bound gun uses B for its fire mode (the M4 selector). */if(PC->WasInputKeyJustPressed(ActorHasTag(TEXT("WeaponLab"))?EKeys::B:EKeys::R)&&!(ActorHasTag(TEXT("WeaponLab"))&&[this]{for(TActorIterator<AWeaponLoop> It(GetWorld());It;++It)if(It->FireModes()>1)return true;return false;}()))ResetTarget(Eye);}
 BayAngle=FMath::FInterpConstantTo(BayAngle,Selected?PI/2:0,Dt,2);TargetAngle=FMath::FInterpConstantTo(TargetAngle,TargetOpen?PI/2:0,Dt,1.4f);if(BayPivot)BayPivot->SetRelativeRotation(FQuat(FVector::UpVector,-BayAngle));if(TargetPivot)TargetPivot->SetRelativeRotation(FQuat(FVector::UpVector,-TargetAngle));
 if(GEngine&&!Testing&&!ActorHasTag(TEXT("WeaponLab")))GEngine->AddOnScreenDebugMessage(734,0,FColor::White,FString::Printf(TEXT("RANGE 01 | WASD move, mouse/arrows look | E select bay / start-stop at console | R reset at console | Collection: %s | Target: %s"),Selected?TEXT("SELECTED"):TEXT("choose at bay"),TargetOpen?TEXT("TURNED"):TEXT("REST")));
 if(!Testing)return;
 if(PC)for(TActorIterator<ACameraActor> It(GetWorld());It;++It)if(It->ActorHasTag(TEXT("RangeReviewCamera"))){PC->SetViewTarget(*It);break;}
 if(Phase==0&&Elapsed>3){Check(Parts.Num()>=20&&BayPivot&&TargetPivot,TEXT("three_modules_and_pivots_loaded"));Check(!ToggleTarget(FVector(1800,0,172)),TEXT("start_requires_selection"));Check(!SelectBay(FVector(0,0,172)),TEXT("selection_requires_reach"));Check(SelectBay(FVector(1400,0,172)),TEXT("select_collection"));Capture(TEXT("overview"));Phase++;}
 else if(Phase==1&&Elapsed>4.5){Check(FMath::IsNearlyEqual(BayAngle,PI/2),TEXT("selection_reaches_limit"));Check(ToggleTarget(FVector(1800,0,172)),TEXT("console_starts_remote_target"));Phase++;}
 else if(Phase==2&&Elapsed>5){Check(TargetAngle>.1&&TargetAngle<PI/2,TEXT("target_intermediate_pose"));Capture(TEXT("moving"));Phase++;}
 else if(Phase==3&&Elapsed>6.5){Check(FMath::IsNearlyEqual(TargetAngle,PI/2),TEXT("target_reaches_limit"));Check(SelectBay(FVector(1400,0,172))&&ToggleTarget(FVector(1800,0,172)),TEXT("stop_allowed_after_deselect"));Check(!ResetTarget(FVector(0,0,172)),TEXT("reset_requires_reach"));Check(ResetTarget(FVector(1800,0,172))&&TargetAngle==0&&!TargetOpen,TEXT("console_reset_returns_rest"));Check(Blockers.Num()>=5,TEXT("collision_contract_loaded"));if(Pawn){Pawn->SetActorLocation(FVector(1650,0,90));FHitResult Hit;Pawn->AddActorWorldOffset(FVector(300,0,0),true,&Hit);Check(Hit.bBlockingHit,TEXT("walker_blocked_by_console"));}else Check(false,TEXT("walker_blocked_by_console"));ResetSlice();Check(!Selected&&!TargetOpen&&BayAngle==0&&TargetAngle==0,TEXT("global_reset_clears_activity"));Capture(TEXT("reset"));Phase++;}
 else if(Phase==4&&Elapsed>9){UE_LOG(LogTemp,Display,TEXT("SLICE_RESULT %s"),Failed?TEXT("FAIL"):TEXT("PASS"));FPlatformMisc::RequestExitWithStatus(false,Failed?1:0);Phase++;}
}
