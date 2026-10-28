// One-time source migration for the owner-approved sight plan on the integrated rifle and pistol (docs/sight-research-v1.md section 8,
// and the 27 Oct decisions: notch-shoulder reference, cocked Ready hammer). Backups: evidence/sight-v12/native-source-before/.
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'../native/ToolchainValidation/Source/ToolchainValidation');
function edit(f,pairs){const file=path.join(dir,f);const raw=fs.readFileSync(file,'utf8'),eol=raw.includes('\r\n')?'\r\n':'\n';let s=raw.replace(/\r\n/g,'\n');for(const [a,b] of pairs){if(s.split(a).length!==2)throw Error(f+' needs exactly one '+a.slice(0,80));s=s.replace(a,b);}fs.writeFileSync(file,s.replace(/\n/g,eol));}
edit('WeaponProfileData.h',[
 [' UPROPERTY(EditAnywhere) float FrontSightReferenceHeight=1080;\n',' UPROPERTY(EditAnywhere) float FrontSightReferenceHeight=1080;\n // A sloped sight line (open notch referenced at the shoulder top) is levelled by turning the gun about the eye while aiming.\n UPROPERTY(EditAnywhere) float AimPitchDeg=0;\n']]);
edit('WeaponLoop.h',[
 [' UFUNCTION(BlueprintCallable) void AddPart(UStaticMesh* Mesh,FName Kind);\n',' UFUNCTION(BlueprintCallable) void AddPart(UStaticMesh* Mesh,FName Kind);\n UFUNCTION(BlueprintCallable) bool RemovePart(FName Name);\n']]);
edit('WeaponLoop.cpp',[
 ['#include "WeaponArmRigData.h"\n','#include "WeaponArmRigData.h"\n#include "WeaponPistolViewData.h"\n#include "Engine/GameViewportClient.h"\n'],
 ['/Game/Qualification/RifleV10/DA_Rifle1866.DA_Rifle1866','/Game/Qualification/RifleV12/DA_Rifle1866.DA_Rifle1866'],
 ['void AWeaponLoop::AddPart(UStaticMesh* Mesh,FName Kind){','bool AWeaponLoop::RemovePart(FName Name){for(int32 I=0;I<Parts.Num();I++)if(Parts[I]&&Parts[I]->GetFName()==Name){UStaticMeshComponent* C=Parts[I].Get();Parts.RemoveAt(I);RemoveInstanceComponent(C);C->DestroyComponent();return true;}return false;}\nvoid AWeaponLoop::AddPart(UStaticMesh* Mesh,FName Kind){'],
 ['SetActorRelativeLocation(FVector(42-3.5*K+100*Pose.forward,10*(1-A)+100*Pose.side,-17+9.3*A+100*Pose.lift));',
  '// Hip and aim come from game/pistol-view-v2.json (eye 0.55 m behind the notch, 52 degree vertical aim FOV).\n SetActorRelativeLocation(FMath::Lerp(WeaponPistolView::HipLocation,WeaponPistolView::AimLocation,A)+FVector(-3.5*K+100*Pose.forward,100*Pose.side,100*Pose.lift));\n if(auto* P=Cast<ARangeSlicePawn>(UGameplayStatics::GetPlayerPawn(this,0))){FVector2D Size(16,9);if(GEngine&&GEngine->GameViewport)GEngine->GameViewport->GetViewportSize(Size);const float Aspect=Size.Y>0?float(Size.X/Size.Y):16.f/9;const float AimH=FMath::RadiansToDegrees(2*FMath::Atan(FMath::Tan(FMath::DegreesToRadians(WeaponPistolView::AimFovVerticalDeg)/2)*Aspect));P->Camera->SetFieldOfView(FMath::Lerp(BaseFov,AimH,A));LastFovDeg=FMath::RadiansToDegrees(2*FMath::Atan(FMath::Tan(FMath::DegreesToRadians(P->Camera->FieldOfView)/2)/Aspect));}\n'],
 ['Check(Parts.Num()==72,TEXT("weapon_parts_loaded"))','Check(Parts.Num()==71,TEXT("weapon_parts_loaded"))']]);
edit('WeaponProfileRuntime.cpp',[
 ['FRotator Rotation=CurrentProfilePose.RootRotation;Rotation.Pitch+=FMath::RadiansToDegrees(ActiveProfile->RecoilPitchRadians*K);SetActorRelativeLocation(Position);SetActorRelativeRotation(Rotation);',
  'FRotator Rotation=CurrentProfilePose.RootRotation;Rotation.Pitch+=FMath::RadiansToDegrees(ActiveProfile->RecoilPitchRadians*K);\n const FQuat Level(FRotator(ActiveProfile->AimPitchDeg*AimBlend,0,0));SetActorRelativeLocation(Level.RotateVector(Position));SetActorRelativeRotation((Level*Rotation.Quaternion()).Rotator());'],
 ['Hammer->GetRelativeRotation().IsNearlyZero(.1),TEXT("moving_parts_return_to_rest")','Hammer->GetRelativeRotation().Equals(FQuat(FVector::RightVector,-ActiveProfile->Sample(TEXT("Ready"),0).Hammer).Rotator(),.1),TEXT("moving_parts_return_to_rest")'],
 ['RifleCheck(Aligned,TEXT("delivered_sight_anchors_align_camera_ray"));}RifleCapture(TEXT("aim"));Go(3,.6);','RifleCheck(Aligned,TEXT("delivered_sight_anchors_align_camera_ray"));}RifleCheck(ActiveProfile->AimFovVerticalDeg<=0||FMath::Abs(LastFovDeg-ActiveProfile->AimFovVerticalDeg)<.5f,TEXT("aim_fov_reaches_profile"));RifleCapture(TEXT("aim"));Go(3,.6);']]);
console.log('edited');
