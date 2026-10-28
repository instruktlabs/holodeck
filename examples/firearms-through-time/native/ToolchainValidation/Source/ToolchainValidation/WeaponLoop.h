#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "GameFramework/HUD.h"
#include "RangeSession.h"
#include "WeaponProfileData.h"
#include "WeaponRecoil.h"
#include "WeaponTriggerData.h"
#include "WeaponLoop.generated.h"
class UStaticMesh;class USkeletalMesh;class UStaticMeshComponent;class USkeletalMeshComponent;class UAnimSequence;class UMaterialInstanceDynamic;class UMaterialInterface;class UTextureRenderTarget2D;
UCLASS()
class TOOLCHAINVALIDATION_API AWeaponLoop : public AActor {
 GENERATED_BODY()
public:
 AWeaponLoop();virtual void BeginPlay()override;virtual void Tick(float Dt)override;virtual void EndPlay(const EEndPlayReason::Type Reason)override;
 // Hard CDO reference ensures the marker primitive is present in a cooked build.
 UPROPERTY() TObjectPtr<UStaticMesh> RangeImpactMesh;
 UPROPERTY() TObjectPtr<UMaterialInterface> RangeImpactMaterial;
 UPROPERTY() TObjectPtr<UStaticMesh> RangeScreenPlane;
 UPROPERTY() TObjectPtr<UMaterialInterface> RangeScreenMaterial;
 UPROPERTY() TObjectPtr<UMaterialInterface> RangeFiberMaterial;
 UPROPERTY() TObjectPtr<UMaterialInterface> RangeSparkMaterial;
 UPROPERTY() TObjectPtr<UTextureRenderTarget2D> RangeScreenTarget;
 UPROPERTY() TObjectPtr<UMaterialInstanceDynamic> RangeScreenMID;
 UPROPERTY() TObjectPtr<UWeaponProfileData> RifleProfile;
 UPROPERTY() TObjectPtr<UWeaponProfileData> BoltProfile;
 UPROPERTY() TObjectPtr<UWeaponProfileData> CarbineProfile;
 UPROPERTY() TObjectPtr<UWeaponProfileData> FlintlockProfile;
 UPROPERTY(Transient) TObjectPtr<UWeaponProfileData> ActiveProfile;
 UPROPERTY() TObjectPtr<USceneComponent> Lever;
 UPROPERTY() TObjectPtr<USceneComponent> Hammer;
 UPROPERTY() TObjectPtr<USceneComponent> LoadingCue;
 UPROPERTY() TObjectPtr<USceneComponent> BoltSlide;
 UPROPERTY() TObjectPtr<USceneComponent> BoltLift;
 UPROPERTY() TObjectPtr<USceneComponent> FrontSight;
 UPROPERTY() TObjectPtr<USceneComponent> ChargingHandle;
 UPROPERTY(Transient) TArray<TObjectPtr<UMaterialInstanceDynamic>> GhostRings;
 UPROPERTY(Transient) TMap<FName,TObjectPtr<USceneComponent>> ProfileAnchors;
 UFUNCTION(BlueprintCallable) void SetHands(USkeletalMesh* Mesh);
 UFUNCTION(BlueprintCallable) void SetClips(UAnimSequence* Ready,UAnimSequence* Reload,UAnimSequence* Inspect,UAnimSequence* Fire);
 UPROPERTY() TObjectPtr<UAnimSequence> ReadyClip;
 UPROPERTY() TObjectPtr<UAnimSequence> ReloadClip;
 UPROPERTY() TObjectPtr<UAnimSequence> InspectClip;
 UPROPERTY() TObjectPtr<UAnimSequence> FireClip;
 UFUNCTION(BlueprintCallable) void AddPart(UStaticMesh* Mesh,FName Kind);
 UFUNCTION(BlueprintCallable) bool RemovePart(FName Name);
 UFUNCTION(BlueprintCallable) bool Action(FName Name);
 UFUNCTION(BlueprintCallable) bool AttachItem(FName Slot,FName Item);
 UPROPERTY(VisibleAnywhere) TObjectPtr<USkeletalMeshComponent> Hands;
 UPROPERTY() TObjectPtr<USceneComponent> Slide;
 UPROPERTY() TObjectPtr<USceneComponent> Magazine;
 UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Parts;
 UPROPERTY() TArray<TObjectPtr<UMaterialInstanceDynamic>> Grips;
 int32 Ammo=7,Reserve=28,Shots=0,Hits=0;bool Aim=false;FName Mode=TEXT("idle"),Grip=TEXT("walnut");FString Message=TEXT("Ready");
 FRangeSession Range;
 // Recoil v1 (docs/recoil-v1.md): each accepted shot's kick turns the pawn's look after the shot.
 WeaponRecoil::FState Recoil;
 // Held-trigger profiles (M4, Pattern 1742): the shared trigger, rules and recoil in WeaponTrigger.h own the gun, and the counters above mirror it.
 WeaponTrigger::FWeapon TriggerGun;
 bool UsesTrigger()const{return TriggerGun.Rules!=nullptr;}
 int32 FireModes()const{return UsesTrigger()?TriggerGun.Rules->Fire.NumModes:1;}
 int32 Capacity()const{return ActiveProfile?ActiveProfile->Capacity:7;}
 FString WeaponId()const{return ActiveProfile?ActiveProfile->CollectionId:TEXT("collection-pistol-01");}
 FString DisplayTitle()const{return ActiveProfile?ActiveProfile->Title:TEXT("1911-style pistol");}
private:
 float Timer=0,Cooldown=0,Flash=0,Elapsed=0,AimBlend=0;int32 Phase=0;bool Testing=false,Failed=false,ReadyCaptured=false;FVector LeftRest;FQuat FingerRest;FName PlayingClip;bool IKProbeChecked=false;float MaxIKError=0,MaxLengthError=0,MaxTwistMotion=0,MaxTwistError=0;
 void Check(bool C,const TCHAR* Name);void Capture(const TCHAR* Name);
 bool ProfileReady=true,RifleTesting=false,ReloadCommitted=false,RifleFailed=false;
 int32 ReloadCommits=0,RiflePhase=0,RifleShotsRemaining=0,RifleCommitBaseline=0;
 double RifleClock=0,RifleNext=2,RifleHold=0;
 float RifleMaxIKError=0,RifleMaxLengthError=0,RifleMaxTwistError=0,RifleMaxLever=0,RifleMaxBoltSlide=0,RifleMaxBoltLift=0,RifleMaxChargingHandle=0;
 // Trigger-gun fixture state kept across phases: the range string before an empty pull, and the rounds counted at a mid-burst release.
 int32 RifleStringBaseline=0,RifleAmmoBaseline=0;
 FWeaponMotionKey CurrentProfilePose;
 float BaseFov=80,FrontSightWidthCm=0,LastGhostAim=0,LastFovDeg=0;
 // Hold-to-aim on the right mouse button: 1 while held, 2 after release until aim drops, 0 otherwise.
 int32 HoldAimState=0;
 // Fixture probe of one shot's recoil: the aim before it, its kick, the highest pitch reached and the settled turn.
 struct FRecoilProbe{bool Active=false;FRotator Before=FRotator::ZeroRotator;FVector Forward=FVector::ZeroVector;FVector2D Kick=FVector2D::ZeroVector;double Peak=0;int32 Shots=0;}RecoilProbe;
 FString RecoilSummary,TriggerSummary;
 FVector2D RecoilOwed=FVector2D::ZeroVector;
 void TickRecoil(float Dt);void ApplyRecoilTurn();void BeginRecoilProbe();bool RecoilProbeShot();bool RecoilProbeSettled();
 // The command a flintlock's lock committed, recorded when its ignition sends the ball; the pan shows until PanFlashUntil (trigger clock).
 FString PendingCommandId;double PanFlashUntil=-1;
 void TickTriggerGun(float Dt);bool TriggerRound(WeaponTrigger::EEvent Type,const FVector2D& Turn);void RecordTriggerRound(const FString& CommandId,const FVector2D& Turn);void SyncTriggerGun();
 TArray<TSharedPtr<FJsonObject>> RifleChecks;
 bool InitializeProfile();
 void AdvanceProfileAction(float Dt);
 void UpdateProfilePresentation(float Dt);
 void RifleTestTick(float Dt);
 void BoltTestTick(float Dt);
 void CarbineTestTick(float Dt);
 void RifleCheck(bool Condition,const TCHAR* Name);
 void RifleCapture(const TCHAR* Name);
 void FinishRifleTest();
};
UCLASS()
class TOOLCHAINVALIDATION_API AWeaponHUD:public AHUD {
 GENERATED_BODY()
public: virtual void DrawHUD()override;
};

