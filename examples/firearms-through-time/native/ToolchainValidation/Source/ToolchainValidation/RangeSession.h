#pragma once
#include "CoreMinimal.h"
#include "UObject/WeakObjectPtr.h"
#include "UObject/WeakObjectPtrTemplates.h"

class AWeaponLoop;
class AWeaponHUD;
class USceneComponent;
class UBoxComponent;
class UInstancedStaticMeshComponent;
class UMaterialInterface;
class UStaticMeshComponent;
class ACameraActor;
class FJsonObject;

// Runtime authority. Geometry supplies frames; this adapter owns strings, travel,
// collision proxies, immutable shot records and cosmetic reactions. Internal units
// are UE centimetres; portable JSON uses source metres (+X,+Y up,+Z right).
struct FRangeSurface {
 FString Id,Lane;
 int32 Plate=INDEX_NONE;
 FVector Origin=FVector::ZeroVector,Normal=FVector(-1,0,0),Right=FVector(0,1,0),Up=FVector(0,0,1);
 double Width=0,Height=0;
};
struct FRangeImpact {
 FRangeSurface Frame;
 FVector World=FVector::ZeroVector;
 FVector2D Local=FVector2D::ZeroVector,UV=FVector2D::ZeroVector;
 double Distance=0;
};
struct FRangeShot {
 FString Id,CommandId,Outcome,Zone,BlockerId;
 int32 Sequence=0,StringId=0,SheetId=0,Activation=0,Points=0;
 int64 Tick=0;
 FVector RayOrigin=FVector::ZeroVector,RayDirection=FVector::ForwardVector;
 bool HasImpact=false;
 FRangeImpact Impact;
};
struct FRangeStats {
 int32 Shots=0,Hits=0,ScoringHits=0,Misses=0,Blocked=0,NonScoring=0,Points=0,GroupCount=0;
 FVector2D Centroid=FVector2D::ZeroVector;
 double Spread=0,RMS=0;
};
struct FRangeArchive {
 int32 StringId=0,SheetId=0,Activation=0;
 FString Lane,Reason;
 TArray<FRangeShot> Shots;
};
struct FRangeCosmeticBurst {
 FVector Position,Normal,Right,Up;
 int32 Sequence=0;
 double Age=0;
};
class FRangeSession {
public:
 void Initialize(AWeaponLoop* InOwner,bool LegacyFixture);
 void Shutdown();
 void Tick(double Dt);
 bool Action(const FString& Name,const FString& Arg=TEXT(""));
 bool CanRecord(const FString& CommandId)const;
 bool BindingsReady()const;
 bool RecordShot(const FString& CommandId,FVector Origin,FVector Direction);
 void DrawHUD(AWeaponHUD& HUD,float Width,float Height);
 bool Export(const FString& Path=TEXT(""))const;
 TArray<FRangeSurface> Surfaces()const;
 static FRangeStats Stats(const TArray<FRangeShot>& Rows);
 TArray<FRangeShot> CurrentShots()const;
 TArray<FRangeShot> ReviewRows()const;
 FString ReviewLane()const;
 int32 ReviewString()const;
 const FRangeShot* LastShot()const{return Shots.IsEmpty()?nullptr:&Shots.Last();}
 bool IsTesting()const{return Testing;}
 FString Lane=TEXT("paper"),Phase=TEXT("ready"),Message=TEXT("Fire to start a string - L changes lane");
 FString Id;
 int32 StringId=0,SheetId=1,Activation=1,ReviewIndex=INDEX_NONE;
 int64 TickNumber=0;
 double Travel=0;
 TArray<FRangeShot> Shots;
 TArray<FRangeArchive> Archives;
private:
 AWeaponLoop* Owner=nullptr;
 TWeakObjectPtr<USceneComponent> Original,Carrier,Sheet;
 TWeakObjectPtr<USceneComponent> PlatePivots[5],PlateFaces[5];
 TWeakObjectPtr<UBoxComponent> MovingBox;
 TWeakObjectPtr<UMaterialInterface> MarkMaterial;
 TMap<FString,TWeakObjectPtr<UInstancedStaticMeshComponent>> MarkBatches;
 TMap<FString,TWeakObjectPtr<UInstancedStaticMeshComponent>> FiberBatches;
 TWeakObjectPtr<UInstancedStaticMeshComponent> SparkBatch;
 TArray<FRangeCosmeticBurst> CosmeticBursts;
 TArray<TWeakObjectPtr<UStaticMeshComponent>> ScreenOverlays,ScreenSources;
 TArray<TWeakObjectPtr<UMaterialInterface>> ScreenOriginalMaterials;
 FString ScreenSignature;
 int32 ScreenUpdates=0,ScreenString=0,CosmeticEmissions=0;
 FRangeStats ScreenStats;
 TWeakObjectPtr<ACameraActor> VisualCamera;
 bool HoldCosmeticCapture=false;
 double EffectCaptureAge=0;
 int32 MarkShotCount=-1,MarkSheet=-1,MarkActivation=-1;
 FTransform CarrierRest,PlateRest[5];
 bool Plates[5]={false,false,false,false,false};
 double Angles[5]={0,0,0,0,0},Accumulator=0;
 int32 MoveTo=0;
 bool PendingStart=false,Testing=false,Failed=false;
 TSet<FString> Seen;
 TArray<TSharedPtr<FJsonObject>> Events,Checks;
 int32 TestPhase=0,TestShots=0;
 double TestElapsed=0,NextTest=2;
 FVector TestWorld=FVector::ZeroVector,TestMark=FVector::ZeroVector;
 FVector2D TestLocal=FVector2D::ZeroVector;
 int32 TestAmmo=0,TestArchiveCount=0;
 void Begin();
 void Finish(const FString& Reason);
 void Event(const FString& Type);
 void ApplyPose();
 bool TravelBlocked(double Next)const;
 void DrawMarks();
 void InitializeConsoles();
 void UpdateConsoles();
 void EmitImpact(const FRangeShot& Shot);
 void UpdateEffects(double Dt);
 void ConsoleCamera();
 void CloseCaptureCamera(const FString& SurfaceId,double Distance);
 void RestoreCaptureCamera();
 void TestTick(double Dt);
 void Check(bool Condition,const TCHAR* Name);
 void Capture(const TCHAR* Name)const;
 bool AimAt(const FString& SurfaceId,FVector2D Offset=FVector2D::ZeroVector);
 TSharedPtr<FJsonObject> Json()const;
};
