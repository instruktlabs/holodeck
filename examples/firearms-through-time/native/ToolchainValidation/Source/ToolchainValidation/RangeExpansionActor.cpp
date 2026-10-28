#include "RangeExpansionActor.h"
#include "RangeSliceActor.h"
#include "Components/StaticMeshComponent.h"
#include "Components/BoxComponent.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Engine/World.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "HAL/PlatformMisc.h"
ARangeExpansionActor::ARangeExpansionActor(){PrimaryActorTick.bCanEverTick=true;SetRootComponent(CreateDefaultSubobject<USceneComponent>(TEXT("ExpansionRoot")));}
void ARangeExpansionActor::AddFrame(FName Id,FName Parent,FVector Location){
 check(!Frames.Contains(Id));auto* C=NewObject<USceneComponent>(this,Id);AddInstanceComponent(C);C->SetupAttachment(Parent.IsNone()?RootComponent:Frames.FindChecked(Parent));C->SetMobility(EComponentMobility::Movable);C->SetRelativeLocation(Location);C->RegisterComponent();Frames.Add(Id,C);
}
void ARangeExpansionActor::AddPiece(FName Id,UStaticMesh* Mesh,FName Parent,FVector Compensation){
 auto* C=NewObject<UStaticMeshComponent>(this,Id);AddInstanceComponent(C);C->SetupAttachment(Frames.FindChecked(Parent));C->SetMobility(EComponentMobility::Movable);C->SetStaticMesh(Mesh);C->SetRelativeLocation(Compensation);C->SetCollisionEnabled(ECollisionEnabled::NoCollision);C->bDisallowNanite=true;C->RegisterComponent();Parts.Add(C);
}
void ARangeExpansionActor::AddBlocker(FName Id,FVector Center,FVector Size){auto* C=NewObject<UBoxComponent>(this,Id);AddInstanceComponent(C);C->SetupAttachment(RootComponent);C->SetRelativeLocation(Center);C->SetBoxExtent(Size*.5);C->SetCollisionProfileName(TEXT("BlockAll"));C->SetHiddenInGame(true);C->RegisterComponent();Blockers.Add(C);}
void ARangeExpansionActor::BeginPlay(){Super::BeginPlay();Testing=ActorHasTag(TEXT("RangeExpansionV7"))&&FParse::Param(FCommandLine::Get(),TEXT("RangeExpansionTest"));SetActorTickEnabled(Testing);}
void ARangeExpansionActor::Check(bool C,const TCHAR* Name){Failed|=!C;UE_LOG(LogTemp,Display,TEXT("EXPANSION_CHECK %s %s"),Name,C?TEXT("PASS"):TEXT("FAIL"));}
void ARangeExpansionActor::Capture(const TCHAR* Name,FVector Eye,FVector Target){
 auto* PC=UGameplayStatics::GetPlayerController(this,0);if(!PC)return;
 auto* Cam=GetWorld()->SpawnActor<ACameraActor>(Eye,(Target-Eye).Rotation());Cam->GetCameraComponent()->FieldOfView=70;PC->SetViewTarget(Cam);
 FString Base;if(FParse::Value(FCommandLine::Get(),TEXT("RangeExpansionCapture="),Base))PC->ConsoleCommand(FString::Printf(TEXT("HighResShot 1 filename=\"%s-%s.png\""),*Base,Name),true);
}
void ARangeExpansionActor::Tick(float Dt){Super::Tick(Dt);if(!Testing)return;Elapsed+=Dt;const bool Dressing=FParse::Param(FCommandLine::Get(),TEXT("RangeDressingTest"));
 if(Phase==0&&Elapsed>3){
  UE_LOG(LogTemp,Display,TEXT("EXPANSION_LIGHTING unbuilt_objects=%u"),GetWorld()->NumLightingUnbuiltObjects);
  Check(GetWorld()->NumLightingUnbuiltObjects==0,TEXT("no_unbuilt_lighting_objects"));
  Check(Parts.Num()==80,TEXT("all_eleven_placements_and_80_mesh_components"));Check(Blockers.Num()==37,TEXT("37_expansion_collision_boxes"));
  int32 PlatePivots=0,Carrier=0,SurfaceAnchors=0;for(const auto& Pair:Frames){const FString N=Pair.Key.ToString();PlatePivots+=N.Contains(TEXT("pivot_plate_"))?1:0;Carrier+=N.Contains(TEXT("pivot_carrier"))?1:0;SurfaceAnchors+=N.Contains(TEXT("anchor_sheet_front"))||N.Contains(TEXT("_face"))?1:0;}
  Check(PlatePivots==5,TEXT("five_independent_plate_pivots"));Check(Carrier==1,TEXT("paper_carrier_pivot_preserved"));Check(SurfaceAnchors==6,TEXT("six_target_surface_anchors"));
  auto* Pawn=Cast<ARangeSlicePawn>(UGameplayStatics::GetPlayerPawn(this,0));if(Pawn){
   auto Sweep=[&](const TCHAR* Label,FVector Start){FHitResult Hit;Pawn->SetActorLocation(Start,false,nullptr,ETeleportType::TeleportPhysics);Pawn->AddActorWorldOffset(FVector(200,0,0),true,&Hit);UE_LOG(LogTemp,Display,TEXT("EXPANSION_SWEEP %s start=%s end=%s hit=%s actor=%s time=%f penetrating=%d depth=%f"),Label,*Start.ToString(),*Pawn->GetActorLocation().ToString(),*GetNameSafe(Hit.GetComponent()),*GetNameSafe(Hit.GetActor()),Hit.Time,Hit.bStartPenetrating,Hit.PenetrationDepth);return Hit;};
   // Two centimetres above the floor avoids tangent floor contacts contaminating a horizontal obstacle probe.
   const FHitResult Post=Sweep(TEXT("canopy"),FVector(1600,117,92));Check(Post.bBlockingHit&&Post.GetComponent()&&Post.GetComponent()->GetName().StartsWith(TEXT("roof_original_block_")),TEXT("canopy_post_blocks_capsule"));
   const FHitResult Route=Sweep(TEXT("concourse"),FVector(1400,450,92));Check(!Route.bBlockingHit,TEXT("concourse_route_clear"));
   // Range dressing v1: the lane at Y=420 clears the canopy post and end infill and meets the service bench's west end.
   // Swept before the paper probe so the pawn (and its first-person rig) ends where the v7 captures expect it.
   if(Dressing){const FHitResult Bench=Sweep(TEXT("bench"),FVector(1600,420,92));Check(Bench.bBlockingHit&&Bench.GetComponent()&&Bench.GetComponent()->GetName().StartsWith(TEXT("service_bench_block_")),TEXT("service_bench_blocks_capsule"));}
   const FHitResult Support=Sweep(TEXT("paper"),FVector(2250,-315,92));Check(Support.bBlockingHit&&Support.GetComponent()&&Support.GetComponent()->GetName().StartsWith(TEXT("paper_support_block_")),TEXT("paper_support_blocks_capsule"));
  }
  else Check(false,TEXT("walkthrough_pawn_present"));
  if(Dressing){
   TArray<AActor*> Props;UGameplayStatics::GetAllActorsWithTag(this,TEXT("RangeDressingV1"),Props);int32 PropParts=0,PropBlockers=0;
   for(AActor* A:Props)if(auto* E=Cast<ARangeExpansionActor>(A)){PropParts+=E->Parts.Num();PropBlockers+=E->Blockers.Num();}
   Check(Props.Num()==4,TEXT("dressing_four_props_present"));Check(PropParts==19,TEXT("dressing_19_mesh_components"));Check(PropBlockers==6,TEXT("dressing_6_collision_boxes"));
  }
  Capture(TEXT("overview"),FVector(2100,1150,680),FVector(1850,50,90));Phase++;
 }else if(Phase==1&&Elapsed>5){Capture(TEXT("targets"),FVector(2130,380,185),FVector(2400,20,135));Phase++;}
 else if(Phase==2&&Elapsed>7){Capture(TEXT("gallery"),FVector(1470,120,168),FVector(1200,165,130));Phase++;}
 else if(Phase==3&&Elapsed>9){Capture(TEXT("paper"),FVector(2180,-260,180),FVector(2400,-260,165));Phase++;}
 else if(Phase==4&&Elapsed>11){if(Dressing)Capture(TEXT("service"),FVector(1600,660,160),FVector(1830,410,100));Phase++;}
 else if(Phase==5&&Elapsed>13){UE_LOG(LogTemp,Display,TEXT("EXPANSION_RESULT %s"),Failed?TEXT("FAIL"):TEXT("PASS"));FPlatformMisc::RequestExitWithStatus(false,Failed?1:0);Phase++;}
}
