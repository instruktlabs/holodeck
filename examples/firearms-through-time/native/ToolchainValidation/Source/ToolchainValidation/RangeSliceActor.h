#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "GameFramework/Pawn.h"
#include "RangeSliceActor.generated.h"
class UStaticMesh; class UStaticMeshComponent; class UBoxComponent; class UCapsuleComponent; class UCameraComponent; class UFloatingPawnMovement;
UCLASS()
class TOOLCHAINVALIDATION_API ARangeSlicePawn : public APawn {
 GENERATED_BODY()
public:
 ARangeSlicePawn(); virtual void Tick(float DeltaSeconds) override;
 UPROPERTY(VisibleAnywhere) TObjectPtr<UCapsuleComponent> Capsule;
 UPROPERTY(VisibleAnywhere) TObjectPtr<UCameraComponent> Camera;
 UPROPERTY(VisibleAnywhere) TObjectPtr<UFloatingPawnMovement> Movement;
};
UCLASS()
class TOOLCHAINVALIDATION_API ARangeSliceActor : public AActor {
 GENERATED_BODY()
public:
 ARangeSliceActor(); virtual void BeginPlay() override; virtual void Tick(float DeltaSeconds) override;
 UFUNCTION(BlueprintCallable) void AddModule(FName Id,const TArray<UStaticMesh*>& Body,const TArray<UStaticMesh*>& Moving,FVector Location,FVector Pivot);
 UFUNCTION(BlueprintCallable) void AddBlocker(FName Id,FVector Center,FVector Size);
 UFUNCTION(BlueprintCallable) bool SelectBay(FVector Eye);
 UFUNCTION(BlueprintCallable) bool ToggleTarget(FVector Eye);
 UFUNCTION(BlueprintCallable) bool ResetTarget(FVector Eye);
 UFUNCTION(BlueprintCallable) void ResetSlice();
 UPROPERTY() TObjectPtr<USceneComponent> BayPivot;
 UPROPERTY() TObjectPtr<USceneComponent> TargetPivot;
 UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Parts;
 UPROPERTY() TArray<TObjectPtr<UBoxComponent>> Blockers;
private:
 bool Selected=false,TargetOpen=false,Testing=false,Failed=false;
 float BayAngle=0,TargetAngle=0,Elapsed=0; int32 Phase=0;
 void Check(bool C,const TCHAR* Name); void Capture(const TCHAR* Name);
};
