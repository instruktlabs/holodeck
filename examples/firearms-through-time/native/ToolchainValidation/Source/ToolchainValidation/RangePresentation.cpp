#include "RangeSession.h"
#include "RangeRulesData.h"
#include "WeaponLoop.h"
#include "RangeSliceActor.h"
#include "EngineUtils.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "Engine/StaticMesh.h"
#include "Engine/TextureRenderTarget2D.h"
#include "CanvasItem.h"
#include "Components/StaticMeshComponent.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/MaterialInterface.h"
#include "Kismet/KismetRenderingLibrary.h"
#include "Kismet/GameplayStatics.h"
#include "Camera/CameraComponent.h"
#include "Camera/CameraActor.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "GameFramework/PlayerController.h"

TArray<FRangeShot> FRangeSession::ReviewRows()const{return Archives.IsValidIndex(ReviewIndex)?Archives[ReviewIndex].Shots:Phase==TEXT("ready")?TArray<FRangeShot>():CurrentShots();}
FString FRangeSession::ReviewLane()const{return Archives.IsValidIndex(ReviewIndex)?Archives[ReviewIndex].Lane:Lane;}
int32 FRangeSession::ReviewString()const{return Archives.IsValidIndex(ReviewIndex)?Archives[ReviewIndex].StringId:Phase==TEXT("ready")?StringId+1:StringId;}

void FRangeSession::InitializeConsoles(){
 if(!Owner->RangeScreenMaterial||!Owner->RangeScreenPlane)return;
 Owner->RangeScreenTarget=UKismetRenderingLibrary::CreateRenderTarget2D(Owner,1024,728,RTF_RGBA8,FLinearColor::Black,false,false);
 Owner->RangeScreenMID=UMaterialInstanceDynamic::Create(Owner->RangeScreenMaterial,Owner);
 Owner->RangeScreenMID->SetTextureParameterValue(TEXT("ScreenTexture"),Owner->RangeScreenTarget);
 for(TActorIterator<AActor> It(Owner->GetWorld());It;++It){TArray<UStaticMeshComponent*> Parts;It->GetComponents(Parts);for(auto* Source:Parts){if(!Source->GetStaticMesh()||!Source->GetStaticMesh()->GetName().EndsWith(TEXT("Mesh_Body_screen")))continue;
  auto* Overlay=NewObject<UStaticMeshComponent>(*It);It->AddInstanceComponent(Overlay);Overlay->SetupAttachment(Source);Overlay->SetMobility(EComponentMobility::Movable);Overlay->SetStaticMesh(Owner->RangeScreenPlane);Overlay->SetMaterial(0,Owner->RangeScreenMID);Overlay->SetCollisionEnabled(ECollisionEnabled::NoCollision);Overlay->SetGenerateOverlapEvents(false);Overlay->SetCastShadow(false);Overlay->SetCanEverAffectNavigation(false);Overlay->bDisallowNanite=true;
  // Screen vertices are baked into the source mesh: use the verified front frame,
  // never its component origin or axis-aligned bounding-box center.
  Overlay->SetRelativeLocation(FVector(15.46703976,-31,132.76677571));Overlay->SetRelativeRotation(FRotationMatrix::MakeFromXY(FVector(0,1,0),FVector(-.3420201433,0,-.9396926208)).ToQuat());Overlay->SetRelativeScale3D(FVector(.466,.331,1));Overlay->RegisterComponent();ScreenOverlays.Add(Overlay);ScreenSources.Add(Source);ScreenOriginalMaterials.Add(Source->GetMaterial(0));
 }}UpdateConsoles();
}
void FRangeSession::UpdateConsoles(){
 if(!Owner->RangeScreenTarget||!Owner->RangeScreenMID)return;
 const FString Stamp=FString::Printf(TEXT("%d:%d:%d:%d:%d:%s:%s"),Shots.Num(),ReviewIndex,StringId,SheetId,Activation,*Phase,*Lane);if(Stamp==ScreenSignature)return;ScreenSignature=Stamp;ScreenUpdates++;
 const auto Rows=ReviewRows();ScreenStats=Stats(Rows);ScreenString=ReviewString();const auto& S=ScreenStats;const FString L=ReviewLane();
 UCanvas* Canvas=nullptr;FVector2D Size;FDrawToRenderTargetContext Context;UKismetRenderingLibrary::BeginDrawCanvasToRenderTarget(Owner,Owner->RangeScreenTarget,Canvas,Size,Context);if(!Canvas)return;
 auto Color=[](uint8 R,uint8 G,uint8 B){return FLinearColor(FColor(R,G,B));};const FLinearColor Paper=Color(218,217,205),Ink=Color(37,51,52),Accent=Color(8,124,134),Hit=Color(172,70,47),White=Color(237,243,239);
 auto Rect=[&](float X,float Y,float W,float H,FLinearColor C){FCanvasTileItem Item(FVector2D(X,Y),FVector2D(W,H),C);Item.BlendMode=SE_BLEND_Opaque;Canvas->DrawItem(Item);};
 auto Text=[&](const FString& T,float X,float Y,float Scale,FLinearColor C){FCanvasTextItem Item(FVector2D(X,Y),FText::FromString(T),GEngine->GetMediumFont(),C);Item.Scale=FVector2D(Scale,Scale);Canvas->DrawItem(Item);};
 auto Line=[&](float AX,float AY,float BX,float BY,FLinearColor C,float Width=2){FCanvasLineItem Item(FVector2D(AX,AY),FVector2D(BX,BY));Item.SetColor(C);Item.LineThickness=Width;Canvas->DrawItem(Item);};
 Rect(0,0,1024,728,Color(16,27,32));Rect(28,105,968,3,Accent);
 Text(TEXT("RANGE REVIEW"),30,20,2.4f,White);Text(FString::Printf(TEXT("%s / %s / STRING %d"),*L.ToUpper(),Archives.IsValidIndex(ReviewIndex)?TEXT("ARCHIVE"):Phase==TEXT("ready")?TEXT("NEXT"):TEXT("CURRENT"),ScreenString),30,66,1.7f,White);
 Rect(30,132,450,505,Paper);const float CX=255,CY=385,Scale=5;
 if(L!=TEXT("plates")){auto Ring=[&](double R){const double CenterY=L==TEXT("paper")?RangeRules::PaperCenterYCm:0;for(int32 I=0;I<80;I++){const double A=2*PI*I/80,B=2*PI*(I+1)/80;Line(CX+FMath::Cos(A)*R*Scale,CY-CenterY*Scale+FMath::Sin(A)*R*Scale,CX+FMath::Cos(B)*R*Scale,CY-CenterY*Scale+FMath::Sin(B)*R*Scale,Color(104,114,110),1);}};if(L==TEXT("paper")){for(double R:RangeRules::PaperRadiiCm)Ring(R);}else for(double R:RangeRules::OriginalRadiiCm)Ring(R);
  int32 N=0;for(const auto& Shot:Rows){N++;if(Shot.Outcome!=TEXT("hit")||!Shot.HasImpact)continue;const auto P=Shot.Impact.Local;Rect(CX+P.X*Scale-4,CY-P.Y*Scale-4,9,9,Hit);Text(FString::FromInt(N),CX+P.X*Scale+7,CY-P.Y*Scale-23,1.4f,Ink);}if(S.GroupCount){const auto P=S.Centroid;Line(CX+P.X*Scale-10,CY-P.Y*Scale,CX+P.X*Scale+10,CY-P.Y*Scale,Accent,3);Line(CX+P.X*Scale,CY-P.Y*Scale-10,CX+P.X*Scale,CY-P.Y*Scale+10,Accent,3);}
 }else for(int32 I=0;I<5;I++){bool Down=false;int32 Sequence=0,N=0;for(const auto& Shot:Rows){N++;if(Shot.Outcome==TEXT("hit")&&Shot.HasImpact&&Shot.Impact.Frame.Plate==I){Down=true;Sequence=N;}}Rect(55+I*82,300,60,100,Down?Hit:Color(104,114,110));Text(FString::FromInt(I+1),70+I*82,330,2,White);if(Down)Text(FString::Printf(TEXT("#%d"),Sequence),62+I*82,420,1.3f,Ink);}
 Text(FString::Printf(TEXT("%d POINTS"),S.Points),525,139,3.2f,White);Text(FString::Printf(TEXT("%d HITS / %d SHOTS"),S.Hits,S.Shots),525,210,1.9f,White);Text(FString::Printf(TEXT("MISS %d  BLOCK %d"),S.Misses,S.Blocked),525,257,1.65f,White);Text(FString::Printf(TEXT("NON-SCORING %d"),S.NonScoring),525,301,1.65f,White);
 Text(S.GroupCount>=2?FString::Printf(TEXT("SPREAD %.2f cm"),S.Spread):TEXT("SPREAD --"),525,382,1.9f,White);Text(S.GroupCount>=2?FString::Printf(TEXT("RMS %.2f cm"),S.RMS):TEXT("RMS --"),525,426,1.9f,White);Text(S.GroupCount?FString::Printf(TEXT("CENTER %+.2f, %+.2f"),S.Centroid.X,S.Centroid.Y):TEXT("CENTER --"),525,472,1.4f,White);Text(TEXT("TARGET-LOCAL GAME cm"),525,511,1.2f,Color(155,178,180));
 Text(FString::Printf(TEXT("%s / SHEET %d"),Archives.IsValidIndex(ReviewIndex)?TEXT("SAVED GROUP"):*Phase.ToUpper(),Archives.IsValidIndex(ReviewIndex)?Archives[ReviewIndex].SheetId:SheetId),525,578,1.55f,White);Text(TEXT("PageUp / PageDown: archive"),30,665,1.3f,White);Text(TEXT("Mirrors selected range session"),530,665,1.15f,White);
 UKismetRenderingLibrary::EndDrawCanvasToRenderTarget(Owner,Context);
}
void FRangeSession::EmitImpact(const FRangeShot& Shot){if(!Shot.HasImpact||Shot.Impact.Frame.Lane!=TEXT("plates"))return;FRangeCosmeticBurst B;B.Position=Shot.Impact.World;B.Normal=Shot.Impact.Frame.Normal;B.Right=Shot.Impact.Frame.Right;B.Up=Shot.Impact.Frame.Up;B.Sequence=Shot.Sequence;if(CosmeticBursts.Num()>=16)CosmeticBursts.RemoveAt(0);CosmeticBursts.Add(B);CosmeticEmissions++;}
void FRangeSession::UpdateEffects(double Dt){
 if(!Owner->RangeSparkMaterial||!Owner->RangeImpactMesh)return;
 if(!SparkBatch.IsValid()){auto* B=NewObject<UInstancedStaticMeshComponent>(Owner);Owner->AddInstanceComponent(B);B->SetupAttachment(Owner->GetRootComponent());B->SetAbsolute(true,true,true);B->SetWorldTransform(FTransform::Identity);B->SetStaticMesh(Owner->RangeImpactMesh);B->SetMaterial(0,Owner->RangeSparkMaterial);B->SetMobility(EComponentMobility::Movable);B->SetCollisionEnabled(ECollisionEnabled::NoCollision);B->SetCastShadow(false);B->SetCanEverAffectNavigation(false);B->bDisallowNanite=true;B->RegisterComponent();B->PrecachePSOs();SparkBatch=B;}
 for(auto& B:CosmeticBursts)if(!HoldCosmeticCapture)B.Age+=FMath::Min(Dt,.1);CosmeticBursts.RemoveAll([](const auto& B){return B.Age>=.22;});const int32 Desired=CosmeticBursts.Num()*5;while(SparkBatch->GetInstanceCount()>Desired)SparkBatch->RemoveInstance(SparkBatch->GetInstanceCount()-1);while(SparkBatch->GetInstanceCount()<Desired)SparkBatch->AddInstance(FTransform(FQuat::Identity,FVector::ZeroVector,FVector::ZeroVector),true);int32 InstanceIndex=0;const FVector E=Owner->RangeImpactMesh->GetBounds().BoxExtent;
 // Opt-in diagnostic only: top regular, bottom instanced; columns spark/fiber/dark.
 static bool DiagnosticSpawned=false;
 if(Testing&&HoldCosmeticCapture&&!DiagnosticSpawned&&!CosmeticBursts.IsEmpty()&&FParse::Param(FCommandLine::Get(),TEXT("RangeSparkDiagnostic"))){
  DiagnosticSpawned=true;const auto& Hit=CosmeticBursts[0];UMaterialInterface* Materials[]={Owner->RangeSparkMaterial,Owner->RangeFiberMaterial,Owner->RangeImpactMaterial};
  for(int32 Row=0;Row<2;Row++)for(int32 Col=0;Col<3;Col++){
   UStaticMeshComponent* C=Row==0?NewObject<UStaticMeshComponent>(Owner):NewObject<UInstancedStaticMeshComponent>(Owner);Owner->AddInstanceComponent(C);C->SetupAttachment(Owner->GetRootComponent());C->SetAbsolute(true,true,true);C->SetWorldTransform(FTransform::Identity);C->SetStaticMesh(Owner->RangeImpactMesh);C->SetMaterial(0,Materials[Col]);C->SetMobility(EComponentMobility::Movable);C->SetCollisionEnabled(ECollisionEnabled::NoCollision);C->SetCastShadow(false);C->bDisallowNanite=true;C->RegisterComponent();
   const FVector P=Hit.Position+Hit.Normal*10+Hit.Right*((Col-1)*7)+Hit.Up*(Row==0?10:5);const FTransform T(FQuat::Identity,P,FVector(1/E.X,1/E.Y,1.5/E.Z));if(auto* B=Cast<UInstancedStaticMeshComponent>(C))B->AddInstance(T,true);else C->SetWorldTransform(T);UE_LOG(LogTemp,Display,TEXT("SPARK_DIAGNOSTIC row=%d col=%d material=%s"),Row,Col,*C->GetMaterial(0)->GetPathName());
  }
 }
 for(const auto& B:CosmeticBursts)for(int32 I=0;I<5;I++){const double A=B.Sequence*2.3999632297+I*1.2566370614;const FVector V=B.Normal*(24+I*3)+B.Right*FMath::Cos(A)*30+B.Up*(FMath::Sin(A)*30+12);const FVector Position=B.Position+B.Normal*.2+V*B.Age+FVector(0,0,-100*B.Age*B.Age);const double Fade=1-B.Age/.22;const FQuat Q=FQuat::FindBetweenNormals(FVector::UpVector,V.GetSafeNormal());SparkBatch->UpdateInstanceTransform(InstanceIndex,FTransform(Q,Position,FVector(.075/E.X,.075/E.Y,(.7+I*.15)*Fade/E.Z)),true,InstanceIndex==Desired-1,true);InstanceIndex++;}
}
void FRangeSession::ConsoleCamera(){auto* P=Cast<ARangeSlicePawn>(UGameplayStatics::GetPlayerPawn(Owner,0));if(!P)return;P->SetActorLocation(FVector(1710,-291,90));P->Camera->SetWorldRotation((FVector(1815.542215,-291,132.739414)-P->Camera->GetComponentLocation()).Rotation());}

void FRangeSession::CloseCaptureCamera(const FString& IdValue,double Distance){auto* PC=UGameplayStatics::GetPlayerController(Owner,0);if(!PC)return;for(const auto& F:Surfaces())if(F.Id==IdValue){const FVector Eye=F.Origin+F.Normal*Distance+F.Up*10+F.Right*5,Target=F.Origin+F.Right*3+F.Up;const FRotator Q=(Target-Eye).Rotation();if(!VisualCamera.IsValid())VisualCamera=Owner->GetWorld()->SpawnActor<ACameraActor>(Eye,Q);else VisualCamera->SetActorLocationAndRotation(Eye,Q);if(VisualCamera.IsValid()){VisualCamera->GetCameraComponent()->FieldOfView=60;PC->SetViewTarget(VisualCamera.Get());}return;}}
void FRangeSession::RestoreCaptureCamera(){if(auto* PC=UGameplayStatics::GetPlayerController(Owner,0))PC->SetViewTarget(UGameplayStatics::GetPlayerPawn(Owner,0));}
