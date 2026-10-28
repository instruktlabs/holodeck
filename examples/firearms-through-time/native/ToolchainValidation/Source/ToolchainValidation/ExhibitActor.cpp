#include "ExhibitActor.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/Engine.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "HAL/PlatformMisc.h"
#include "InputCoreTypes.h"
#include "Algo/AllOf.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInstance.h"

AExhibitActor::AExhibitActor()
{
    PrimaryActorTick.bCanEverTick = true;
    GetStaticMeshComponent()->SetMobility(EComponentMobility::Movable);
    GetStaticMeshComponent()->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    for (int32 Index = 1; Index < 5; ++Index)
    {
        auto* Part = CreateDefaultSubobject<UStaticMeshComponent>(*FString::Printf(TEXT("ImportedPart%d"), Index));
        Part->SetupAttachment(GetStaticMeshComponent());
        Part->SetMobility(EComponentMobility::Movable);
        Part->SetCollisionEnabled(ECollisionEnabled::NoCollision);
        ExtraParts.Add(Part);
    }
}
void AExhibitActor::SetMeshParts(const TArray<UStaticMesh*>& Meshes)
{
    check(Meshes.Num() == 5);
    GetStaticMeshComponent()->SetStaticMesh(Meshes[0]);
    for (int32 Index = 1; Index < 5; ++Index) ExtraParts[Index-1]->SetStaticMesh(Meshes[Index]);
}
void AExhibitActor::BeginPlay()
{
    Super::BeginPlay();
    Testing = FParse::Param(FCommandLine::Get(), TEXT("ExhibitTest"));
    Calibrating = FParse::Param(FCommandLine::Get(), TEXT("CalibrationCapture"));
    if (Calibrating)
    {
        Running = false;
        float EV = 0;
        FParse::Value(FCommandLine::Get(), TEXT("CalibrationEV="), EV);
        if (auto* Camera = Cast<ACameraActor>(UGameplayStatics::GetActorOfClass(this, ACameraActor::StaticClass())))
        {
            Camera->GetCameraComponent()->PostProcessSettings.bOverride_AutoExposureBias = true;
            Camera->GetCameraComponent()->PostProcessSettings.AutoExposureBias = EV;
            float Distance=0;
            if(FParse::Value(FCommandLine::Get(),TEXT("ProbeDistance="),Distance)&&Distance>0)
                Camera->SetActorLocation(FVector(0,Distance*100.f,172.f));
        }
    }
    UE_LOG(LogTemp, Display, TEXT("EXHIBIT_BEGIN mesh=%s testing=%d"), *GetNameSafe(GetStaticMeshComponent()->GetStaticMesh()), Testing);
}
void AExhibitActor::ToggleMotion()
{
    Running = !Running;
    UE_LOG(LogTemp, Display, TEXT("EXHIBIT_TOGGLE running=%d angle=%.3f"), Running, Angle);
}
void AExhibitActor::ResetMotion()
{
    Angle = 0; Running = true; SetActorRotation(FRotator::ZeroRotator);
    UE_LOG(LogTemp, Display, TEXT("EXHIBIT_RESET running=1 angle=0"));
}
void AExhibitActor::Verify(bool Condition, const TCHAR* Check)
{
    Failed |= !Condition;
    UE_LOG(LogTemp, Display, TEXT("EXHIBIT_CHECK %s %s"), Check, Condition ? TEXT("PASS") : TEXT("FAIL"));
}
void AExhibitActor::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    Elapsed += DeltaSeconds;
    APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0);
    if (Calibrating)
    {
        if (Phase == 0 && Elapsed >= 4.f)
        {
            FString Capture;
            if (PC && FParse::Value(FCommandLine::Get(), TEXT("ExhibitCapture="), Capture))
                PC->ConsoleCommand(FString::Printf(TEXT("HighResShot 1 filename=\"%s\""), *Capture), true);
            Phase++;
        }
        if (Elapsed >= 6.f) FPlatformMisc::RequestExitWithStatus(false, 0);
        return;
    }
    if (PC && !Testing)
    {
        if (PC->WasInputKeyJustPressed(EKeys::SpaceBar)) ToggleMotion();
        if (PC->WasInputKeyJustPressed(EKeys::R)) ResetMotion();
    }
    if (Running) Angle = FMath::Fmod(Angle + FMath::RadiansToDegrees(0.6f) * DeltaSeconds, 360.f);
    // glTF positive Y rotation becomes negative UE Z rotation across the handedness conversion.
    SetActorRotation(FRotator(0, -Angle, 0));
    if (GEngine) GEngine->AddOnScreenDebugMessage(731, 0.f, FColor::White,
        FString::Printf(TEXT("KILN EXHIBIT | Space: start/stop | R: reset | %s | %.1f deg"), Running ? TEXT("RUNNING") : TEXT("STOPPED"), Angle));
    if (!Testing) return;
    if (Phase == 0 && Elapsed >= 1.f)
    {
        Verify(GetStaticMeshComponent()->GetStaticMesh() != nullptr && Angle > 20.f, TEXT("loaded_and_moving"));
        Verify(ExtraParts.Num() == 4 && Algo::AllOf(ExtraParts, [](const auto& Part) { return Part && Part->GetStaticMesh(); }), TEXT("all_five_parts_loaded"));
        if (FParse::Param(FCommandLine::Get(), TEXT("ExhibitUpdated")))
        {
            TInlineComponentArray<UStaticMeshComponent*> Parts(this);
            bool PanelUpdated=false, OverrideBound=false, ParametersPreserved=false;
            for (auto* Part : Parts)
            {
                if (!Part->GetStaticMesh()) continue;
                if (Part->GetStaticMesh()->GetName()==TEXT("Mesh_CheckerPanel"))
                    PanelUpdated=FMath::IsNearlyEqual(Part->GetStaticMesh()->GetBoundingBox().GetSize().X,150.f,.05f);
                if (Part->GetStaticMesh()->GetName()==TEXT("Mesh_CopperHub"))
                {
                    auto* Material=Cast<UMaterialInstance>(Part->GetMaterial(0));
                    OverrideBound=Material && Material->GetPathName().StartsWith(TEXT("/Game/Qualification/NativeOverrides/MI_ExhibitCopper"));
                    float Roughness=0, ParentRoughness=0;
                    const FMaterialParameterInfo Info(TEXT("RoughnessFactor"));
                    if (Material && Material->Parent)
                    {
                        const bool ChildRead=Material->GetScalarParameterValue(Info,Roughness);
                        const bool ParentRead=Material->Parent->GetScalarParameterValue(Info,ParentRoughness);
                        UE_LOG(LogTemp,Display,TEXT("EXHIBIT_MATERIAL override=%.6f source=%.6f childRead=%d parentRead=%d"),Roughness,ParentRoughness,ChildRead,ParentRead);
                        ParametersPreserved=ChildRead && ParentRead && FMath::IsNearlyEqual(Roughness,.12f) && FMath::IsNearlyEqual(ParentRoughness,.55f);
                    }
                }
            }
            Verify(PanelUpdated,TEXT("updated_geometry_loaded"));
            Verify(OverrideBound,TEXT("native_override_bound"));
            Verify(ParametersPreserved,TEXT("override_and_updated_parent_parameters"));
        }
        ToggleMotion(); HeldAngle = Angle; Phase++;
    }
    else if (Phase == 1 && Elapsed >= 2.f)
    {
        Verify(!Running && FMath::IsNearlyEqual(Angle, HeldAngle), TEXT("stop_holds_pose"));
        ToggleMotion(); Phase++;
    }
    else if (Phase == 2 && Elapsed >= 3.f)
    {
        Verify(Running && Angle > HeldAngle + 20.f, TEXT("start_resumes"));
        ResetMotion(); Verify(Running && Angle == 0.f, TEXT("reset_restores_origin_and_running"));
        Phase++;
    }
    else if (Phase == 3 && Elapsed >= 3.05f)
    {
        ToggleMotion();
        FString Capture;
        if (PC && FParse::Value(FCommandLine::Get(), TEXT("ExhibitCapture="), Capture))
            PC->ConsoleCommand(FString::Printf(TEXT("HighResShot 1 filename=\"%s\""), *Capture), true);
        Phase++;
    }
    else if (Phase == 4 && Elapsed >= 6.f)
    {
        UE_LOG(LogTemp, Display, TEXT("EXHIBIT_RESULT %s"), Failed ? TEXT("FAIL") : TEXT("PASS"));
        FPlatformMisc::RequestExitWithStatus(false, Failed ? 1 : 0);
        Phase++;
    }
}
