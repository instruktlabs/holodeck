#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "OpeningCaseActor.generated.h"
class UStaticMesh;
class UStaticMeshComponent;
UCLASS()
class TOOLCHAINVALIDATION_API AOpeningCaseActor : public AActor
{
 GENERATED_BODY()
public:
 AOpeningCaseActor();
 virtual void BeginPlay() override;
 virtual void Tick(float DeltaSeconds) override;
 UFUNCTION(BlueprintCallable) void SetParts(const TArray<UStaticMesh*>& BodyMeshes,const TArray<UStaticMesh*>& LidMeshes);
 UFUNCTION(BlueprintCallable) void ToggleOpen();
 UFUNCTION(BlueprintCallable) void ResetCase();
private:
 UPROPERTY() TObjectPtr<USceneComponent> Pivot;
 UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Body;
 UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Lid;
 bool Open=false,Testing=false,Failed=false;
 float Angle=0,Elapsed=0;
 int32 Phase=0;
 FTransform InitialBody;
 void Verify(bool Condition,const TCHAR* Name);
 void Capture(const TCHAR* Pose);
};
