#pragma once
#include "CoreMinimal.h"
#include "Engine/StaticMeshActor.h"
#include "ExhibitActor.generated.h"

UCLASS()
class TOOLCHAINVALIDATION_API AExhibitActor : public AStaticMeshActor
{
    GENERATED_BODY()
public:
    AExhibitActor();
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaSeconds) override;
    UFUNCTION(BlueprintCallable)
    void SetMeshParts(const TArray<UStaticMesh*>& Meshes);
private:
    UPROPERTY()
    TArray<TObjectPtr<UStaticMeshComponent>> ExtraParts;
    void ToggleMotion();
    void ResetMotion();
    void Verify(bool Condition, const TCHAR* Check);
    bool Running = true;
    bool Testing = false;
    bool Calibrating = false;
    bool Failed = false;
    float Angle = 0;
    float Elapsed = 0;
    float HeldAngle = 0;
    int32 Phase = 0;
};
