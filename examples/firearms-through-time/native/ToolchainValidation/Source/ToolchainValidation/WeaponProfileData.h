#pragma once
#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "WeaponProfileData.generated.h"
class UStaticMesh; class USkeletalMesh; class UAnimSequence; class UMaterialInterface;

// Destination data, generated from immutable source pins and game-owned JSON.
// Coordinates are UE centimetres. These are presentation/game values, not firearm specifications.
USTRUCT(BlueprintType)
struct FWeaponPartBinding {
 GENERATED_BODY()
 UPROPERTY(EditAnywhere) TObjectPtr<UStaticMesh> Mesh;
 UPROPERTY(EditAnywhere) FName Joint=TEXT("body");
 UPROPERTY(EditAnywhere) FTransform RelativeTransform=FTransform::Identity;
 UPROPERTY(EditAnywhere) FString SourceNode;
};
USTRUCT(BlueprintType)
struct FWeaponAnchorBinding {
 GENERATED_BODY()
 UPROPERTY(EditAnywhere) FName Name;
 UPROPERTY(EditAnywhere) FName Joint=TEXT("body");
 UPROPERTY(EditAnywhere) FTransform RelativeTransform=FTransform::Identity;
};
USTRUCT(BlueprintType)
struct FWeaponMotionKey {
 GENERATED_BODY()
 UPROPERTY(EditAnywhere) float T=0;
 UPROPERTY(EditAnywhere) FVector RootTranslation=FVector::ZeroVector;
 UPROPERTY(EditAnywhere) FRotator RootRotation=FRotator::ZeroRotator;
 UPROPERTY(EditAnywhere) FVector LeftOffset=FVector::ZeroVector;
 UPROPERTY(EditAnywhere) FVector RightOffset=FVector::ZeroVector;
 UPROPERTY(EditAnywhere) float Lever=0;
 UPROPERTY(EditAnywhere) float Hammer=0;
 UPROPERTY(EditAnywhere) float BoltLift=0;
 UPROPERTY(EditAnywhere) float BoltSlide=0;
 UPROPERTY(EditAnywhere) float Cartridge=0;
 // M4 (round v14): magazine drop and charging-handle pull, each 0..1 of the profile's travel.
 UPROPERTY(EditAnywhere) float MagOut=0;
 UPROPERTY(EditAnywhere) float ChargingHandle=0;
};
USTRUCT(BlueprintType)
struct FWeaponClipBinding {
 GENERATED_BODY()
 UPROPERTY(EditAnywhere) FName Name;
 UPROPERTY(EditAnywhere) TObjectPtr<UAnimSequence> Sequence;
 UPROPERTY(EditAnywhere) float Duration=1;
 UPROPERTY(EditAnywhere) TArray<FWeaponMotionKey> Keys;
};
UCLASS(BlueprintType)
class TOOLCHAINVALIDATION_API UWeaponProfileData : public UDataAsset {
 GENERATED_BODY()
public:
 UPROPERTY(EditAnywhere) FName ProfileId;
 UPROPERTY(EditAnywhere) FString CollectionId;
 UPROPERTY(EditAnywhere) FString Title;
 UPROPERTY(EditAnywhere) FString ProvenanceJson;
 UPROPERTY(EditAnywhere) FString RulesSha256;
 UPROPERTY(EditAnywhere) TObjectPtr<USkeletalMesh> Hands;
 UPROPERTY(EditAnywhere) TArray<FWeaponPartBinding> Parts;
 UPROPERTY(EditAnywhere) TArray<FWeaponAnchorBinding> Anchors;
 UPROPERTY(EditAnywhere) TArray<FWeaponClipBinding> Clips;
 UPROPERTY(EditAnywhere) int32 Capacity=6;
 UPROPERTY(EditAnywhere) int32 InitialReserve=24;
 UPROPERTY(EditAnywhere) float FireDuration=.95f;
 UPROPERTY(EditAnywhere) float ReloadDuration=2.4f;
 UPROPERTY(EditAnywhere) float InspectDuration=3.6f;
 UPROPERTY(EditAnywhere) float ReloadCommitPhase=.65f;
 UPROPERTY(EditAnywhere) bool PerRoundReload=true;
 // Rounds transferred at each reload commit: one for the lever gate, up to a full charger for the bolt.
 UPROPERTY(EditAnywhere) int32 RoundsPerCommit=1;
 // "lever" (rifle1866), "bolt" (boltNo4) or "carbine" (carbineM4) selects the required moving parts and anchors.
 UPROPERTY(EditAnywhere) FName ActionKind=TEXT("lever");
 UPROPERTY(EditAnywhere) FName Finish=TEXT("satin-brass");
 UPROPERTY(EditAnywhere) TMap<FName,FString> AllowedSlots;
 UPROPERTY(EditAnywhere) FVector ReadyLocation=FVector(42,10,-17);
 UPROPERTY(EditAnywhere) FVector AimLocation=FVector(42,0,-7.7);
 UPROPERTY(EditAnywhere) FVector LeverPivot=FVector::ZeroVector;
 UPROPERTY(EditAnywhere) FVector HammerPivot=FVector::ZeroVector;
 UPROPERTY(EditAnywhere) FVector BoltPivot=FVector::ZeroVector;
 UPROPERTY(EditAnywhere) FVector LoadingCueOffset=FVector::ZeroVector;
 UPROPERTY(EditAnywhere) FRotator LoadingCueRotation=FRotator::ZeroRotator;
 // The wrist the loading cue rides: the right for cartridges and chargers, the left for the M4's fresh magazine.
 UPROPERTY(EditAnywhere) FName LoadingCueBone=TEXT("Joint_right_right_wrist");
 // M4: the magazine drops MagOut x MagazineDropCm along its well axis and hides once clear; the charging handle slides along its axis.
 UPROPERTY(EditAnywhere) FVector MagazinePivot=FVector::ZeroVector;
 UPROPERTY(EditAnywhere) FVector MagazineDropAxis=FVector::DownVector;
 UPROPERTY(EditAnywhere) float MagazineDropCm=0;
 UPROPERTY(EditAnywhere) FVector ChargingHandlePivot=FVector::ZeroVector;
 UPROPERTY(EditAnywhere) FVector ChargingHandleAxis=FVector::BackwardVector;
 UPROPERTY(EditAnywhere) float ChargingHandleTravelCm=0;
 // Sight presentation (docs/sight-research-v1.md): vertical aim FOV, near plane, analytic ghost ring on the rear sight and a
 // front-blade readability floor. Zero or empty disables each; the rifle profile keeps its original presentation.
 UPROPERTY(EditAnywhere) float AimFovVerticalDeg=0;
 UPROPERTY(EditAnywhere) float AimNearCm=0;
 UPROPERTY(EditAnywhere) TObjectPtr<UMaterialInterface> GhostRingMaterial;
 UPROPERTY(EditAnywhere) FString GhostRingSourceNode;
 UPROPERTY(EditAnywhere) float GhostApertureCm=0;
 UPROPERTY(EditAnywhere) float GhostPupilCm=.4f;
 UPROPERTY(EditAnywhere) float GhostDarken=.35f;
 UPROPERTY(EditAnywhere) FVector FrontSightPivot=FVector::ZeroVector;
 UPROPERTY(EditAnywhere) float FrontSightMinPixels=0;
 UPROPERTY(EditAnywhere) float FrontSightReferenceHeight=1080;
 // A sloped sight line (open notch referenced at the shoulder top) is levelled by turning the gun about the eye while aiming.
 UPROPERTY(EditAnywhere) float AimPitchDeg=0;
 UPROPERTY(EditAnywhere) float RecoilBackCm=3.5f;
 UPROPERTY(EditAnywhere) float RecoilPitchRadians=.07f;
 UPROPERTY(EditAnywhere) FVector LeftShoulder=FVector::ZeroVector;
 UPROPERTY(EditAnywhere) FVector RightShoulder=FVector::ZeroVector;
 UPROPERTY(EditAnywhere) FVector LeftWrist=FVector::ZeroVector;
 UPROPERTY(EditAnywhere) FVector RightWrist=FVector::ZeroVector;
 UPROPERTY(EditAnywhere) FVector LeftPole=FVector::ZeroVector;
 UPROPERTY(EditAnywhere) FVector RightPole=FVector::ZeroVector;
 UPROPERTY(EditAnywhere) FVector LeftLowerAxis=FVector::ForwardVector;
 UPROPERTY(EditAnywhere) FVector RightLowerAxis=FVector::ForwardVector;
 UPROPERTY(EditAnywhere) FVector2D LeftLengths=FVector2D(29,27);
 UPROPERTY(EditAnywhere) FVector2D RightLengths=FVector2D(29,27);
 UPROPERTY(EditAnywhere) FVector2D TwistFractions=FVector2D(.4,.8);
 const FWeaponClipBinding* Clip(FName Name)const;
 FWeaponMotionKey Sample(FName Name,float Seconds)const;
 bool Validate(FString& Reason)const;
};
