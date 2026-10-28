#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "RangeExpansionActor.generated.h"
class UStaticMesh; class UStaticMeshComponent; class UBoxComponent;
// Destination adapter for saved rigid asset hierarchies. Game scoring owns no state here.
UCLASS()
class TOOLCHAINVALIDATION_API ARangeExpansionActor : public AActor {
 GENERATED_BODY()
public:
 ARangeExpansionActor();
 virtual void BeginPlay() override; virtual void Tick(float DeltaSeconds) override;
 UFUNCTION(BlueprintCallable) void AddFrame(FName Id,FName Parent,FVector Location);
 UFUNCTION(BlueprintCallable) void AddPiece(FName Id,UStaticMesh* Mesh,FName Parent,FVector Compensation);
 UFUNCTION(BlueprintCallable) void AddBlocker(FName Id,FVector Center,FVector Size);
 UPROPERTY() TMap<FName,TObjectPtr<USceneComponent>> Frames;
 UPROPERTY() TArray<TObjectPtr<UStaticMeshComponent>> Parts;
 UPROPERTY() TArray<TObjectPtr<UBoxComponent>> Blockers;
private:
 bool Testing=false,Failed=false;float Elapsed=0;int32 Phase=0;
 void Check(bool Condition,const TCHAR* Name);void Capture(const TCHAR* Name,FVector Eye,FVector Target);
};
