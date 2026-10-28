#include "WeaponLoop.h"
#include "WeaponRecoilFixture.h"
#include "WeaponTriggerFixture.h"
#include "WeaponHandAnimInstance.h"
#include "RangeSliceActor.h"
#include "Components/StaticMeshComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "Camera/CameraComponent.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/FloatingPawnMovement.h"
#include "Kismet/GameplayStatics.h"
#include "Animation/AnimSequence.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "HAL/PlatformMisc.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonSerializer.h"
#include "Engine/Engine.h"
#include "Engine/GameViewportClient.h"
#include "Engine/Texture.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInstanceDynamic.h"

bool AWeaponLoop::InitializeProfile(){
 FString Selected;FParse::Value(FCommandLine::Get(),TEXT("WeaponProfile="),Selected);
 if(Selected.IsEmpty()||Selected==TEXT("pistol1911"))return true;
 UWeaponProfileData* Candidate=Selected==TEXT("rifle1866")?RifleProfile.Get():Selected==TEXT("boltNo4")?BoltProfile.Get():Selected==TEXT("carbineM4")?CarbineProfile.Get():Selected==TEXT("flintlock1742")?FlintlockProfile.Get():nullptr;
 FString Reason;if(!Candidate||Candidate->ProfileId!=FName(*Selected)||!Candidate->Validate(Reason)){
  Message=TEXT("Weapon profile unavailable: ")+Selected+TEXT(" ")+Reason;UE_LOG(LogTemp,Error,TEXT("WEAPON_PROFILE_UNAVAILABLE %s"),*Message);for(auto C:Parts)C->SetHiddenInGame(true);Hands->SetHiddenInGame(true);return false;
 }
 ActiveProfile=Candidate;
 for(auto C:Parts){RemoveInstanceComponent(C);C->DestroyComponent();}Parts.Empty();Grips.Empty();
 Lever->SetRelativeLocation(ActiveProfile->LeverPivot);Hammer->SetRelativeLocation(ActiveProfile->HammerPivot);BoltSlide->SetRelativeLocation(ActiveProfile->BoltPivot);BoltLift->SetRelativeLocation(FVector::ZeroVector);FrontSight->SetRelativeLocation(ActiveProfile->FrontSightPivot);
 Magazine->SetRelativeLocation(ActiveProfile->MagazinePivot);Magazine->SetHiddenInGame(false,true);ChargingHandle->SetRelativeLocation(ActiveProfile->ChargingHandlePivot);
 Hands->EmptyOverrideMaterials();SetHands(ActiveProfile->Hands);Hands->SetHiddenInGame(false);
 SetClips(ActiveProfile->Clip(TEXT("Ready"))->Sequence,ActiveProfile->Clip(TEXT("Reload"))->Sequence,ActiveProfile->Clip(TEXT("Inspect"))->Sequence,ActiveProfile->Clip(TEXT("Fire"))->Sequence);
 LoadingCue->AttachToComponent(Hands,FAttachmentTransformRules::KeepRelativeTransform,ActiveProfile->LoadingCueBone);LoadingCue->SetRelativeLocation(ActiveProfile->LoadingCueOffset);LoadingCue->SetRelativeRotation(ActiveProfile->LoadingCueRotation);LoadingCue->SetHiddenInGame(true,true);
 for(const auto& Binding:ActiveProfile->Parts){AddPart(Binding.Mesh,Binding.Joint);Parts.Last()->SetRelativeTransform(Binding.RelativeTransform);if(Binding.Joint==TEXT("loading"))Parts.Last()->SetHiddenInGame(true);}
 // Ghost-ring parts keep their imported base colour and texture; the shared material fades them by view angle while aiming.
 GhostRings.Empty();FrontSightWidthCm=0;
 for(int32 I=0;I<ActiveProfile->Parts.Num()&&I<Parts.Num();I++){const auto& B=ActiveProfile->Parts[I];UStaticMeshComponent* C=Parts[I].Get();
  if(ActiveProfile->GhostRingMaterial&&!ActiveProfile->GhostRingSourceNode.IsEmpty()&&B.SourceNode.Contains(ActiveProfile->GhostRingSourceNode)){UMaterialInterface* Source=C->GetMaterial(0);auto* M=UMaterialInstanceDynamic::Create(ActiveProfile->GhostRingMaterial,this);UTexture* Tex=nullptr;FLinearColor Color=FLinearColor::White;if(Source){Source->GetTextureParameterValue(FHashedMaterialParameterInfo(TEXT("BaseColorTexture")),Tex);Source->GetVectorParameterValue(FHashedMaterialParameterInfo(TEXT("BaseColorFactor")),Color);}if(Tex)M->SetTextureParameterValue(TEXT("BaseColorTexture"),Tex);M->SetVectorParameterValue(TEXT("BaseColorFactor"),Color);C->SetMaterial(0,M);GhostRings.Add(M);}
  if(B.Joint==TEXT("front_sight"))FrontSightWidthCm=FMath::Max(FrontSightWidthCm,float(C->GetStaticMesh()->GetBoundingBox().GetSize().Y));
 }
 if(ActiveProfile->AimNearCm>0)if(auto* PC=UGameplayStatics::GetPlayerController(this,0))PC->ConsoleCommand(FString::Printf(TEXT("r.SetNearClipPlane %f"),ActiveProfile->AimNearCm),true);
 for(const auto& Binding:ActiveProfile->Anchors){auto* C=NewObject<USceneComponent>(this,Binding.Name);AddInstanceComponent(C);C->SetupAttachment(Binding.Joint==TEXT("lever")?Lever.Get():Binding.Joint==TEXT("hammer")?Hammer.Get():Binding.Joint==TEXT("bolt_slide")?BoltSlide.Get():Binding.Joint==TEXT("bolt_lift")?BoltLift.Get():Binding.Joint==TEXT("front_sight")?FrontSight.Get():Binding.Joint==TEXT("magazine")?Magazine.Get():Binding.Joint==TEXT("charging_handle")?ChargingHandle.Get():RootComponent.Get());C->SetRelativeTransform(Binding.RelativeTransform);C->RegisterComponent();ProfileAnchors.Add(Binding.Name,C);}
 Ammo=ActiveProfile->Capacity;Reserve=ActiveProfile->InitialReserve;Grip=ActiveProfile->Finish;Mode=TEXT("idle");Aim=false;Message=TEXT("Ready");
 // Held-trigger profiles take their rules from the generated game contracts; the data asset must agree on the magazine.
 TriggerGun.Reset(WeaponTriggerData::Find(ActiveProfile->ProfileId));
 if(UsesTrigger()){if(TriggerGun.Rules->Capacity!=ActiveProfile->Capacity||TriggerGun.Rules->Reserve!=ActiveProfile->InitialReserve){Message=TEXT("Weapon profile disagrees with its game contract: ")+Selected;UE_LOG(LogTemp,Error,TEXT("WEAPON_PROFILE_UNAVAILABLE %s"),*Message);TriggerGun.Reset(nullptr);ActiveProfile=nullptr;for(auto C:Parts)C->SetHiddenInGame(true);Hands->SetHiddenInGame(true);return false;}SyncTriggerGun();}
 UE_LOG(LogTemp,Display,TEXT("WEAPON_PROFILE_BOUND %s parts=%d provenance=%s"),*WeaponId(),Parts.Num(),*ActiveProfile->RulesSha256);return true;
}

// Held-trigger guns: rounds fall at their own times inside the frame (WeaponTrigger.h, the same code the fixtures replay). Each round leaves
// along the camera's aim turned by the kick already turned in this frame; the frame's whole turn then goes to the look like any recoil.
void AWeaponLoop::TickTriggerGun(float Dt){
 const FName Id=ActiveProfile->ProfileId;if(!Recoil.Profile||Id!=FName(Recoil.Profile->Id))Recoil.Reset(WeaponRecoilData::Find(Id));
 RecoilOwed+=WeaponTrigger::RunFireFrame(TriggerGun,Recoil,Dt,[this](WeaponTrigger::EEvent Type,const FVector2D& Turn){return TriggerRound(Type,Turn);});
 ApplyRecoilTurn();SyncTriggerGun();
}
// A shot or a lock asks the gun, then the range, like the other guns; an ignition sends the ball its lock committed.
bool AWeaponLoop::TriggerRound(WeaponTrigger::EEvent Type,const FVector2D& Turn){
 using namespace WeaponTrigger;FWeapon& W=TriggerGun;
 if(Type==EEvent::Ignite){W.Ignite();RecordTriggerRound(PendingCommandId,Turn);return true;}
 if(W.Mode!=EWeaponMode::Idle||!W.Ammo||W.Cycling())return W.Shoot();
 const FString CommandId=FString::Printf(TEXT("native-command-%d"),W.Shots+1);
 if(Range.Phase==TEXT("ready")||Range.Phase==TEXT("review"))Range.Action(TEXT("start"));
 if(!Range.CanRecord(CommandId)){W.Message=Range.Message;return false;}
 if(!W.Shoot())return false;
 if(Type==EEvent::Shot)RecordTriggerRound(CommandId,Turn);else{PendingCommandId=CommandId;PanFlashUntil=W.Trigger.Time+W.Rules->Fire.PanFlashSeconds;}
 return true;
}
// The gun has fired by now, so it kicks even if the range no longer records (a string that ended between lock and ignition).
void AWeaponLoop::RecordTriggerRound(const FString& CommandId,const FVector2D& Turn){
 bool Recorded=false;
 if(auto* P=Cast<ARangeSlicePawn>(UGameplayStatics::GetPlayerPawn(this,0))){FRotator Ray=P->Camera->GetComponentRotation();Ray.Pitch=FMath::Clamp(Ray.Pitch+Turn.X,-75.,75.);Ray.Yaw+=Turn.Y;Recorded=Range.RecordShot(CommandId,P->Camera->GetComponentLocation(),Ray.Vector());}
 Recoil.Fire(Range.Id,Recorded?Range.LastShot()->Id:CommandId);
 if(Recorded&&Range.LastShot()->Outcome==TEXT("hit"))Hits++;TriggerGun.Message=Recorded?Range.Message:FString(TEXT("Shot"));
}
// The HUD, the presentation and the fixtures read the actor's counters.
void AWeaponLoop::SyncTriggerGun(){
 using namespace WeaponTrigger;const FWeapon& W=TriggerGun;
 Ammo=W.Ammo;Reserve=W.Reserve;Shots=W.Shots;Aim=W.Aim;Timer=float(W.Timer);Cooldown=float(W.Cooldown);Flash=float(W.Flash);ReloadCommits=W.ReloadCommits;ReloadCommitted=W.ReloadCommitted;Message=W.Message;
 Mode=W.Mode==EWeaponMode::Reload?FName(TEXT("reload")):W.Mode==EWeaponMode::Inspect?FName(TEXT("inspect")):W.Cycling()?FName(TEXT("cycling")):FName(TEXT("idle"));
}

void AWeaponLoop::AdvanceProfileAction(float Dt){
 float Remaining=Dt;
 while(Timer>0&&Remaining>0){const float Step=FMath::Min(Timer,Remaining);Timer=FMath::Max(0.f,Timer-Step);Remaining-=Step;
  if(Mode==TEXT("reload")&&!ReloadCommitted&&Timer<=ActiveProfile->ReloadDuration*(1-ActiveProfile->ReloadCommitPhase)+1e-6f){
   const int32 N=FMath::Min3(ActiveProfile->RoundsPerCommit,Capacity()-Ammo,Reserve);if(N>0){Ammo+=N;Reserve-=N;ReloadCommits++;}ReloadCommitted=true;
  }
  if(Timer<=1e-6f){Timer=0;if(Mode==TEXT("reload")&&ActiveProfile->PerRoundReload&&Ammo<Capacity()&&Reserve>0){Timer=ActiveProfile->ReloadDuration;ReloadCommitted=false;}else{Mode=TEXT("idle");Message=TEXT("Ready");}}
 }
}

void AWeaponLoop::UpdateProfilePresentation(float Dt){
 // Held-trigger guns choose the clip as game/profile-presentation.mjs does: the M4 holds the trigger-pressed pose while the trigger is down,
 // the musket's Fire clip runs its lock over the cooldown, and an empty musket shows Fired.
 const WeaponTrigger::FWeapon& TG=TriggerGun;const bool Musket=ActiveProfile->ProfileId==TEXT("flintlock1742");
 const FName Name=UsesTrigger()?(TG.Mode==WeaponTrigger::EWeaponMode::Reload?(TG.EmptyReload&&ActiveProfile->Clip(TEXT("ReloadEmpty"))?FName(TEXT("ReloadEmpty")):FName(TEXT("Reload"))):TG.Mode==WeaponTrigger::EWeaponMode::Inspect?FName(TEXT("Inspect")):TG.Cooldown>0||(ActiveProfile->ProfileId==TEXT("carbineM4")&&TG.Trigger.Down)?FName(TEXT("Fire")):!TG.Ammo&&ActiveProfile->Clip(TEXT("Fired"))?FName(TEXT("Fired")):FName(TEXT("Ready")))
  :Mode==TEXT("reload")?FName(TEXT("Reload")):Mode==TEXT("inspect")?FName(TEXT("Inspect")):Mode==TEXT("cycling")?FName(TEXT("Fire")):FName(TEXT("Ready"));
 const auto* Clip=ActiveProfile->Clip(Name);
 const float Time=UsesTrigger()?FMath::Clamp(Clip->Duration-(TG.Mode!=WeaponTrigger::EWeaponMode::Idle?float(TG.Timer):Name==TEXT("Fire")&&Musket?float(TG.Cooldown):Clip->Duration),0.f,Clip->Duration):Mode==TEXT("idle")?0:Clip->Duration-Timer;
 CurrentProfilePose=ActiveProfile->Sample(Name,Time);PlayingClip=Name;AimBlend+=((Aim?1.f:0.f)-AimBlend)*(1-FMath::Exp(-18*Dt));
 const float K=Flash/.09f;const FVector Position=FMath::Lerp(ActiveProfile->ReadyLocation,ActiveProfile->AimLocation,AimBlend)+CurrentProfilePose.RootTranslation-FVector(ActiveProfile->RecoilBackCm*K,0,0);
 FRotator Rotation=CurrentProfilePose.RootRotation;Rotation.Pitch+=FMath::RadiansToDegrees(ActiveProfile->RecoilPitchRadians*K);
 const FQuat Level(FRotator(ActiveProfile->AimPitchDeg*AimBlend,0,0));SetActorRelativeLocation(Level.RotateVector(Position));SetActorRelativeRotation((Level*Rotation.Quaternion()).Rotator());
 // Source +Z rotations are native -Y after the handedness-changing axis swap.
 Lever->SetRelativeRotation(FQuat(FVector::RightVector,-CurrentProfilePose.Lever));Hammer->SetRelativeRotation(FQuat(FVector::RightVector,-CurrentProfilePose.Hammer));
 // The bolt lifts about source +X, which stays native +X; the axis swap reverses its sense. Slide is centimetres along +X.
 BoltSlide->SetRelativeLocation(ActiveProfile->BoltPivot+FVector(CurrentProfilePose.BoltSlide,0,0));BoltLift->SetRelativeRotation(FQuat(FVector::ForwardVector,-CurrentProfilePose.BoltLift));
 // M4: the magazine drops along its well axis and hides once clear (its copy on the left wrist is the loading cue); the handle slides back.
 Magazine->SetRelativeLocation(ActiveProfile->MagazinePivot+ActiveProfile->MagazineDropAxis*(CurrentProfilePose.MagOut*ActiveProfile->MagazineDropCm));Magazine->SetHiddenInGame(CurrentProfilePose.MagOut>=.999f,true);
 ChargingHandle->SetRelativeLocation(ActiveProfile->ChargingHandlePivot+ActiveProfile->ChargingHandleAxis*(CurrentProfilePose.ChargingHandle*ActiveProfile->ChargingHandleTravelCm));
 const FVector Left=ActiveProfile->LeftWrist+CurrentProfilePose.LeftOffset,Right=ActiveProfile->RightWrist+CurrentProfilePose.RightOffset;
 auto* Anim=CastChecked<UWeaponHandAnimInstance>(Hands->GetAnimInstance());Anim->SetFrame(Clip->Sequence,Time,Left,Right);Hands->TickAnimation(0,false);Hands->RefreshBoneTransforms();LoadingCue->SetHiddenInGame(CurrentProfilePose.Cartridge<.5f,true);
 // Aim lens and sight picture. Unreal FieldOfView is horizontal, so the profile's vertical aim FOV converts through the viewport aspect.
 if(auto* P=Cast<ARangeSlicePawn>(UGameplayStatics::GetPlayerPawn(this,0))){
  FVector2D Size(16,9);if(GEngine&&GEngine->GameViewport)GEngine->GameViewport->GetViewportSize(Size);const float Aspect=Size.Y>0?float(Size.X/Size.Y):16.f/9;
  if(ActiveProfile->AimFovVerticalDeg>0){const float AimH=FMath::RadiansToDegrees(2*FMath::Atan(FMath::Tan(FMath::DegreesToRadians(ActiveProfile->AimFovVerticalDeg)/2)*Aspect));P->Camera->SetFieldOfView(FMath::Lerp(BaseFov,AimH,AimBlend));}
  const float VFov=2*FMath::Atan(FMath::Tan(FMath::DegreesToRadians(P->Camera->FieldOfView)/2)/Aspect);LastFovDeg=FMath::RadiansToDegrees(VFov);
  const float W=AimBlend<.5f?0.f:FMath::SmoothStep(.5f,1.f,AimBlend);LastGhostAim=W;const FVector Eye=P->Camera->GetComponentLocation();
  if(GhostRings.Num())if(const auto* Rear=ProfileAnchors.Find(TEXT("anchor_sight_rear"))){const FVector To=(*Rear)->GetComponentLocation()-Eye;const float D=FMath::Max(float(To.Size()),.01f),Core=FMath::Max(0.f,(ActiveProfile->GhostApertureCm-ActiveProfile->GhostPupilCm)/(2*D)),Outer=(ActiveProfile->GhostApertureCm+ActiveProfile->GhostPupilCm)/(2*D);
   for(UMaterialInstanceDynamic* M:GhostRings){M->SetScalarParameterValue(TEXT("Aim"),W);M->SetVectorParameterValue(TEXT("AxisWS"),FLinearColor(To.GetSafeNormal()));M->SetScalarParameterValue(TEXT("Core"),Core);M->SetScalarParameterValue(TEXT("Outer"),Outer);M->SetScalarParameterValue(TEXT("Darken"),ActiveProfile->GhostDarken);}}
  // Readability floor: widen only the front blade, only below the floor, scaled about its base on the sight line.
  if(FrontSightWidthCm>0&&ActiveProfile->FrontSightMinPixels>0)if(const auto* Front=ProfileAnchors.Find(TEXT("anchor_sight_front"))){const float D=FMath::Max(float(FVector::Dist((*Front)->GetComponentLocation(),Eye)),.01f),Px=FrontSightWidthCm/D/(2*FMath::Tan(VFov/2))*ActiveProfile->FrontSightReferenceHeight,S=Px<ActiveProfile->FrontSightMinPixels?ActiveProfile->FrontSightMinPixels/Px:1.f;FrontSight->SetRelativeScale3D(FVector(1,1+(S-1)*W,1));}
 }
 if(RifleTesting){RifleMaxLever=FMath::Max(RifleMaxLever,FMath::Abs(CurrentProfilePose.Lever));RifleMaxBoltSlide=FMath::Max(RifleMaxBoltSlide,FMath::Abs(CurrentProfilePose.BoltSlide));RifleMaxBoltLift=FMath::Max(RifleMaxBoltLift,FMath::Abs(CurrentProfilePose.BoltLift));RifleMaxChargingHandle=FMath::Max(RifleMaxChargingHandle,CurrentProfilePose.ChargingHandle);const TCHAR* Sides[]={TEXT("left"),TEXT("right")};
  for(int32 I=0;I<2;I++){const FString S=Sides[I];const auto Bone=[&](const FString& N){return Hands->GetSocketTransform(FName(*N),RTS_Component);};const auto Shoulder=Bone(TEXT("Joint_")+S+TEXT("Arm_")+S+TEXT("_shoulder")),Elbow=Bone(TEXT("Joint_")+S+TEXT("Arm_")+S+TEXT("_elbow")),Wrist=Bone(TEXT("Joint_")+S+TEXT("_")+S+TEXT("_wrist"));const FVector Goal=I?Right:Left;const FVector2D Lengths=I?ActiveProfile->RightLengths:ActiveProfile->LeftLengths;
   RifleMaxIKError=FMath::Max(RifleMaxIKError,float(FVector::Dist(Wrist.GetLocation(),Goal)));RifleMaxLengthError=FMath::Max(RifleMaxLengthError,float(FMath::Max(FMath::Abs(FVector::Dist(Shoulder.GetLocation(),Elbow.GetLocation())-Lengths.X),FMath::Abs(FVector::Dist(Elbow.GetLocation(),Wrist.GetLocation())-Lengths.Y))));
   const FVector Axis=I?ActiveProfile->RightLowerAxis:ActiveProfile->LeftLowerAxis;const FQuat Q=Elbow.GetRotation().Inverse()*Wrist.GetRotation();const double P=Q.X*Axis.X+Q.Y*Axis.Y+Q.Z*Axis.Z,Angle=FMath::Abs(P)+FMath::Abs(Q.W)<1e-8?0:FMath::UnwindRadians(2*FMath::Atan2(P,Q.W));
   for(int32 T=0;T<2;T++){const auto Actual=Bone(FString::Printf(TEXT("Joint_%sTwist%d_%s_forearm_twist%d"),Sides[I],T,Sides[I],T)).GetRotation();const auto Expected=Elbow.GetRotation()*FQuat(Axis,Angle*ActiveProfile->TwistFractions[T]);RifleMaxTwistError=FMath::Max(RifleMaxTwistError,float(Actual.AngularDistance(Expected)));}
  }
 }
}

void AWeaponLoop::RifleCheck(bool Condition,const TCHAR* Name){RifleFailed|=!Condition;auto R=MakeShared<FJsonObject>();R->SetStringField(TEXT("name"),Name);R->SetBoolField(TEXT("ok"),Condition);RifleChecks.Add(R);UE_LOG(LogTemp,Display,TEXT("RIFLE_CHECK %s %s"),Name,Condition?TEXT("PASS"):TEXT("FAIL"));}
void AWeaponLoop::RifleCapture(const TCHAR* Name){FString Base;if(auto* PC=UGameplayStatics::GetPlayerController(this,0);PC&&FParse::Value(FCommandLine::Get(),TEXT("RifleCapture="),Base)){RifleHold=.5;PC->ConsoleCommand(FString::Printf(TEXT("HighResShot 1 filename=\"%s-%s.png\""),*Base,Name),true);}}
void AWeaponLoop::FinishRifleTest(){
 if(RiflePhase==1000)return;RiflePhase=1000;FString Report;FParse::Value(FCommandLine::Get(),TEXT("RifleReport="),Report);if(Report.IsEmpty())Report=FPaths::Combine(FPaths::ProjectSavedDir(),TEXT("rifle-report.json"));
 auto R=MakeShared<FJsonObject>();R->SetBoolField(TEXT("ok"),!RifleFailed);R->SetStringField(TEXT("weaponId"),WeaponId());R->SetStringField(TEXT("profile"),ActiveProfile?ActiveProfile->GetPathName():TEXT("missing"));R->SetStringField(TEXT("performance"),TEXT("DIRTY"));R->SetStringField(TEXT("recoil"),RecoilSummary);if(UsesTrigger()){R->SetStringField(TEXT("trigger"),TriggerSummary);R->SetNumberField(TEXT("maxChargingHandle"),RifleMaxChargingHandle);}R->SetStringField(TEXT("capturePolicy"),TEXT("Fixture-only half-second pose hold for deferred screenshots; production timing unchanged."));R->SetNumberField(TEXT("maxIKErrorCm"),RifleMaxIKError);R->SetNumberField(TEXT("maxLengthErrorCm"),RifleMaxLengthError);R->SetNumberField(TEXT("maxTwistErrorRadians"),RifleMaxTwistError);R->SetNumberField(TEXT("maxLeverRadians"),RifleMaxLever);R->SetNumberField(TEXT("maxBoltSlideCm"),RifleMaxBoltSlide);R->SetNumberField(TEXT("maxBoltLiftRadians"),RifleMaxBoltLift);R->SetNumberField(TEXT("reloadCommits"),ReloadCommits);R->SetStringField(TEXT("rulesSha256"),ActiveProfile?ActiveProfile->RulesSha256:TEXT(""));if(ActiveProfile)R->SetStringField(TEXT("provenanceJson"),ActiveProfile->ProvenanceJson);
 TArray<TSharedPtr<FJsonValue>> Rows;for(const auto& C:RifleChecks)Rows.Add(MakeShared<FJsonValueObject>(C));R->SetArrayField(TEXT("checks"),Rows);const FString SessionPath=FPaths::ChangeExtension(Report,TEXT("session.json"));R->SetStringField(TEXT("sessionPath"),SessionPath);const bool SessionSaved=Range.Export(SessionPath);R->SetBoolField(TEXT("sessionSaved"),SessionSaved);RifleFailed|=!SessionSaved;R->SetBoolField(TEXT("ok"),!RifleFailed);FString Text;FJsonSerializer::Serialize(R,TJsonWriterFactory<>::Create(&Text));const bool Saved=FFileHelper::SaveStringToFile(Text,*Report,FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM);RifleFailed|=!Saved;UE_LOG(LogTemp,Display,TEXT("RIFLE_RESULT %s"),RifleFailed?TEXT("FAIL"):TEXT("PASS"));FPlatformMisc::RequestExitWithStatus(false,RifleFailed?1:0);
}

void AWeaponLoop::RifleTestTick(float Dt){
 RifleClock+=Dt;if(RifleClock<RifleNext||RiflePhase==1000)return;
 auto Go=[&](int32 PhaseValue,double Delay=.05){RiflePhase=PhaseValue;RifleNext=RifleClock+Delay;};
 auto ClipPhase=[&](float Duration){return Duration>0?1-Timer/Duration:0;};
 auto Conservation=[&](){return Ammo+Reserve+Shots==30;};
 if(RiflePhase==0){
  RifleCheck(ProfileReady&&ActiveProfile&&Parts.Num()==ActiveProfile->Parts.Num(),TEXT("profile_assets_bound"));RifleCheck(Hands->GetNumBones()==41,TEXT("dedicated_41_bone_hands"));RifleCheck(Ammo==6&&Reserve==24&&Capacity()==6,TEXT("shared_prototype_capacity_reserve"));{const int32 Loaded=Ammo,Strings=Range.StringId;Ammo=0;RifleCheck(!Action(TEXT("fire"))&&Ammo==0&&Shots==0&&Range.StringId==Strings&&Range.Shots.IsEmpty(),TEXT("empty_trigger_starts_no_string"));Ammo=Loaded;}
  RifleCheck(!AttachItem(TEXT("optic"),TEXT("red-dot"))&&!AttachItem(TEXT("grip"),TEXT("charcoal"))&&AttachItem(TEXT("finish"),TEXT("satin-brass")),TEXT("exact_profile_compatibility"));
  for(const FName N:{FName(TEXT("Ready")),FName(TEXT("Fire")),FName(TEXT("Inspect")),FName(TEXT("Reload"))})RifleCheck(ActiveProfile->Clip(N)&&ActiveProfile->Clip(N)->Sequence,TEXT("authored_clip_bound"));
  if(auto* P=Cast<ARangeSlicePawn>(UGameplayStatics::GetPlayerPawn(this,0))){P->Movement->StopMovementImmediately();P->SetActorTickEnabled(false);for(const auto& F:Range.Surfaces())if(F.Id==TEXT("original.face"))P->Camera->SetWorldRotation((F.Origin-P->Camera->GetComponentLocation()).Rotation());}
  RifleCapture(TEXT("ready"));Go(1,.6);
 }else if(RiflePhase==1){RifleCheck(Range.Action(TEXT("select"),TEXT("original"))&&Range.Action(TEXT("start")),TEXT("range_string_starts_normally"));RifleCheck(Action(TEXT("aim"))&&Aim,TEXT("rifle_aim"));Go(2,.4);
 }else if(RiflePhase==2){RifleCheck(FMath::Abs(AimBlend-1)<.01,TEXT("aim_reaches_profile_frame"));if(auto* P=Cast<ARangeSlicePawn>(UGameplayStatics::GetPlayerPawn(this,0))){bool Aligned=true;for(const FName N:{FName(TEXT("anchor_sight_rear")),FName(TEXT("anchor_sight_front"))}){const auto* C=ProfileAnchors.Find(N);if(!C||!C->Get()){Aligned=false;continue;}const FVector Q=P->Camera->GetComponentTransform().InverseTransformPosition((*C)->GetComponentLocation());Aligned&=Q.X>0&&FMath::Abs(Q.Y)<.15&&FMath::Abs(Q.Z)<.15;}RifleCheck(Aligned,TEXT("delivered_sight_anchors_align_camera_ray"));}RifleCheck(ActiveProfile->AimFovVerticalDeg<=0||FMath::Abs(LastFovDeg-ActiveProfile->AimFovVerticalDeg)<.5f,TEXT("aim_fov_reaches_profile"));RifleCapture(TEXT("aim"));Go(3,.6);
 }else if(RiflePhase==3){{FString Replay;const bool Replayed=WeaponRecoil::ReplayFixture(ActiveProfile->ProfileId,Replay);UE_LOG(LogTemp,Display,TEXT("RECOIL_FIXTURE %s"),*Replay);RifleCheck(Replayed,TEXT("recoil_fixture_matches"));}BeginRecoilProbe();RifleCheck(Action(TEXT("fire"))&&Ammo==5&&Shots==1&&Range.Shots.Num()==1,TEXT("real_fire_one_shot_one_round"));RifleCheck(RecoilProbeShot(),TEXT("recoil_shot_uses_pre_kick_aim"));RifleCheck(!Action(TEXT("fire"))&&!Action(TEXT("aim"))&&!Action(TEXT("inspect"))&&!Action(TEXT("reload")),TEXT("cycle_gates_all_actions"));RifleCheck(Recoil.Shots==1,TEXT("rejected_fire_no_kick"));Go(4);
 }else if(RiflePhase==4&&Mode==TEXT("cycling")&&ClipPhase(ActiveProfile->FireDuration)>=.45){RifleCheck(CurrentProfilePose.Lever>.2f&&CurrentProfilePose.Hammer>.1f,TEXT("separate_lever_hammer_motion"));RifleCapture(TEXT("fire-cycle"));Go(5,.6);
 }else if(RiflePhase==5&&Mode==TEXT("idle")){RifleCheck(Ammo==5&&Reserve==24&&Conservation(),TEXT("cycle_has_no_extra_ammo_event"));RifleCheck(Lever->GetRelativeRotation().IsNearlyZero(.1)&&Hammer->GetRelativeRotation().Equals(FQuat(FVector::RightVector,-ActiveProfile->Sample(TEXT("Ready"),0).Hammer).Rotator(),.1),TEXT("moving_parts_return_to_rest"));RifleCheck(Action(TEXT("inspect"))&&!Aim,TEXT("rifle_inspect_starts"));RifleCheck(!Action(TEXT("fire")),TEXT("inspect_gates_fire"));Go(6);
 }else if(RiflePhase==6&&ClipPhase(ActiveProfile->InspectDuration)>=.3){RifleCheck(CurrentProfilePose.RootRotation.Yaw<-15,TEXT("inspect_left_pose"));RifleCapture(TEXT("inspect-left"));Go(7,.6);
 }else if(RiflePhase==7&&ClipPhase(ActiveProfile->InspectDuration)>=.68){RifleCheck(CurrentProfilePose.RootRotation.Yaw>15,TEXT("inspect_right_pose"));RifleCapture(TEXT("inspect-right"));Go(8,.6);
 }else if(RiflePhase==8&&Mode==TEXT("idle")){RifleCheck(RecoilProbeSettled(),TEXT("recoil_rises_then_settles"));RifleCheck(Action(TEXT("reload")),TEXT("one_round_reload_starts"));RifleCommitBaseline=ReloadCommits;RifleCheck(!Action(TEXT("fire"))&&!Action(TEXT("aim"))&&!Action(TEXT("inspect"))&&!Action(TEXT("reload")),TEXT("reload_gates_all_actions"));Go(9);
 }else if(RiflePhase==9&&ClipPhase(ActiveProfile->ReloadDuration)>=.24){RifleCheck(Ammo==5&&Reserve==24&&!ReloadCommitted,TEXT("no_early_reload_commit"));RifleCheck(CurrentProfilePose.RightOffset.Size()>8,TEXT("right_hand_leaves_stock"));RifleCapture(TEXT("reload-departure"));Go(10,.6);
 }else if(RiflePhase==10&&ClipPhase(ActiveProfile->ReloadDuration)>=.56){RifleCheck(Ammo==5&&CurrentProfilePose.Cartridge>.5f,TEXT("visible_token_before_commit"));RifleCapture(TEXT("reload-gate"));Go(11,.6);
 }else if(RiflePhase==11&&ClipPhase(ActiveProfile->ReloadDuration)>=.7){RifleCheck(Ammo==6&&Reserve==23&&ReloadCommits==RifleCommitBaseline+1&&Conservation(),TEXT("one_round_commits_once_at_contact"));Go(12);
 }else if(RiflePhase==12&&ClipPhase(ActiveProfile->ReloadDuration)>=.9){RifleCheck(CurrentProfilePose.Cartridge<.5f,TEXT("loading_token_clears_after_commit"));RifleCapture(TEXT("reload-return"));Go(13,.6);
 }else if(RiflePhase==13&&Mode==TEXT("idle")){RifleCheck(Ammo==6&&Reserve==23&&ReloadCommits==RifleCommitBaseline+1,TEXT("full_stops_reload_loop"));RifleCheck(Hands->GetSocketTransform(TEXT("Joint_right_right_wrist"),RTS_Component).GetLocation().Equals(ActiveProfile->RightWrist,.2),TEXT("reload_returns_right_wrist"));RifleShotsRemaining=3;Go(14);
 }else if(RiflePhase==14&&Mode==TEXT("idle")&&Cooldown<=0){if(RifleShotsRemaining){RifleCheck(Action(TEXT("fire")),TEXT("multi_round_setup_real_fire"));RifleShotsRemaining--;}else{RifleCheck(Recoil.Shots==Shots&&Recoil.Index==2,TEXT("recoil_string_walks_pattern"));RifleCheck(Ammo==3&&Action(TEXT("reload")),TEXT("multi_round_reload_starts"));RifleCommitBaseline=ReloadCommits;Go(15);}
 }else if(RiflePhase==15&&Mode==TEXT("idle")){RifleCheck(Ammo==6&&Reserve==20&&ReloadCommits==RifleCommitBaseline+3&&Conservation(),TEXT("three_cycles_conserve_ammunition"));RifleCheck(RifleMaxIKError<.2&&RifleMaxLengthError<.15,TEXT("rifle_two_bone_ik_without_stretch"));RifleCheck(RifleMaxTwistError<.015,TEXT("profile_forearm_twist_distribution"));RifleCheck(Grip==TEXT("satin-brass"),TEXT("profile_finish_persists"));RifleCapture(TEXT("ready-return"));Go(16,.6);
 }else if(RiflePhase==16){/* Explicit fixture-only reserve boundary, independent of the normal30-round conservation case. */Ammo=4;Reserve=1;RifleCommitBaseline=ReloadCommits;RifleCheck(Action(TEXT("reload")),TEXT("reserve_boundary_fixture_starts"));Go(17);
 }else if(RiflePhase==17&&Mode==TEXT("idle")){RifleCheck(Ammo==5&&Reserve==0&&ReloadCommits==RifleCommitBaseline+1&&!Action(TEXT("reload")),TEXT("reserve_exhaustion_stops_without_fabricating_round"));FinishRifleTest();}
 if(RifleClock>100){RifleCheck(false,TEXT("fixture_progress_deadline"));FinishRifleTest();}
}

// Bolt fixture: ten-round magazine, thirty in reserve, five-round charger commits. Same report, captures and range session as the lever fixture.
void AWeaponLoop::BoltTestTick(float Dt){
 RifleClock+=Dt;if(RifleClock<RifleNext||RiflePhase==1000)return;
 auto Go=[&](int32 PhaseValue,double Delay=.05){RiflePhase=PhaseValue;RifleNext=RifleClock+Delay;};
 auto ClipPhase=[&](float Duration){return Duration>0?1-Timer/Duration:0;};
 auto Conservation=[&](){return Ammo+Reserve+Shots==40;};
 auto BoltAtRest=[&](){return BoltSlide->GetRelativeLocation().Equals(ActiveProfile->BoltPivot,.05)&&BoltLift->GetRelativeRotation().IsNearlyZero(.1);};
 if(RiflePhase==0){
  RifleCheck(ProfileReady&&ActiveProfile&&Parts.Num()==ActiveProfile->Parts.Num(),TEXT("profile_assets_bound"));RifleCheck(Hands->GetNumBones()==41,TEXT("dedicated_41_bone_hands"));RifleCheck(Ammo==10&&Reserve==30&&Capacity()==10&&ActiveProfile->RoundsPerCommit==5,TEXT("bolt_prototype_capacity_reserve_charger"));{const int32 Loaded=Ammo,Strings=Range.StringId;Ammo=0;RifleCheck(!Action(TEXT("fire"))&&Ammo==0&&Shots==0&&Range.StringId==Strings&&Range.Shots.IsEmpty(),TEXT("empty_trigger_starts_no_string"));Ammo=Loaded;}
  RifleCheck(!AttachItem(TEXT("optic"),TEXT("red-dot"))&&!AttachItem(TEXT("grip"),TEXT("charcoal"))&&!AttachItem(TEXT("sling"),TEXT("web-sling"))&&AttachItem(TEXT("finish"),TEXT("restored-furniture")),TEXT("exact_profile_compatibility"));
  for(const FName N:{FName(TEXT("Ready")),FName(TEXT("Fire")),FName(TEXT("Inspect")),FName(TEXT("Reload"))})RifleCheck(ActiveProfile->Clip(N)&&ActiveProfile->Clip(N)->Sequence,TEXT("authored_clip_bound"));
  RifleCheck(BoltLift->GetNumChildrenComponents()>0&&BoltLift->GetAttachParent()==BoltSlide&&BoltAtRest(),TEXT("bolt_parts_bound_at_rest"));
  if(auto* P=Cast<ARangeSlicePawn>(UGameplayStatics::GetPlayerPawn(this,0))){P->Movement->StopMovementImmediately();P->SetActorTickEnabled(false);for(const auto& F:Range.Surfaces())if(F.Id==TEXT("original.face"))P->Camera->SetWorldRotation((F.Origin-P->Camera->GetComponentLocation()).Rotation());}
  RifleCapture(TEXT("ready"));Go(1,.6);
 }else if(RiflePhase==1){RifleCheck(Range.Action(TEXT("select"),TEXT("original"))&&Range.Action(TEXT("start")),TEXT("range_string_starts_normally"));RifleCheck(Action(TEXT("aim"))&&Aim,TEXT("bolt_aim"));Go(2,.4);
 }else if(RiflePhase==2){RifleCheck(FMath::Abs(AimBlend-1)<.01,TEXT("aim_reaches_profile_frame"));if(auto* P=Cast<ARangeSlicePawn>(UGameplayStatics::GetPlayerPawn(this,0))){bool Aligned=true;for(const FName N:{FName(TEXT("anchor_sight_rear")),FName(TEXT("anchor_sight_front"))}){const auto* C=ProfileAnchors.Find(N);if(!C||!C->Get()){Aligned=false;continue;}const FVector Q=P->Camera->GetComponentTransform().InverseTransformPosition((*C)->GetComponentLocation());Aligned&=Q.X>0&&FMath::Abs(Q.Y)<.15&&FMath::Abs(Q.Z)<.15;}RifleCheck(Aligned,TEXT("delivered_sight_anchors_align_camera_ray"));}RifleCheck(ActiveProfile->AimFovVerticalDeg<=0||FMath::Abs(LastFovDeg-ActiveProfile->AimFovVerticalDeg)<.5f,TEXT("aim_fov_reaches_profile"));RifleCheck(!ActiveProfile->GhostRingMaterial||(GhostRings.Num()>0&&LastGhostAim>.99f),TEXT("ghost_ring_active_in_aim"));RifleCapture(TEXT("aim"));Go(3,.6);
 }else if(RiflePhase==3){{FString Replay;const bool Replayed=WeaponRecoil::ReplayFixture(ActiveProfile->ProfileId,Replay);UE_LOG(LogTemp,Display,TEXT("RECOIL_FIXTURE %s"),*Replay);RifleCheck(Replayed,TEXT("recoil_fixture_matches"));}BeginRecoilProbe();RifleCheck(Action(TEXT("fire"))&&Ammo==9&&Shots==1&&Range.Shots.Num()==1,TEXT("real_fire_one_shot_one_round"));RifleCheck(RecoilProbeShot(),TEXT("recoil_shot_uses_pre_kick_aim"));RifleCheck(!Action(TEXT("fire"))&&!Action(TEXT("aim"))&&!Action(TEXT("inspect"))&&!Action(TEXT("reload")),TEXT("bolt_cycle_gates_all_actions"));RifleCheck(Recoil.Shots==1,TEXT("rejected_fire_no_kick"));Go(4);
 }else if(RiflePhase==4&&Mode==TEXT("cycling")&&ClipPhase(ActiveProfile->FireDuration)>=.5){RifleCheck(CurrentProfilePose.BoltLift<-.5f&&CurrentProfilePose.BoltSlide<-5,TEXT("bolt_lifts_and_draws"));RifleCheck(!BoltSlide->GetRelativeLocation().Equals(ActiveProfile->BoltPivot,1),TEXT("bolt_component_travels"));RifleCapture(TEXT("fire-cycle"));Go(5,.6);
 }else if(RiflePhase==5&&Mode==TEXT("idle")){RifleCheck(Ammo==9&&Reserve==30&&Conservation(),TEXT("cycle_has_no_extra_ammo_event"));RifleCheck(BoltAtRest(),TEXT("moving_parts_return_to_rest"));RifleCheck(Action(TEXT("inspect"))&&!Aim,TEXT("bolt_inspect_starts"));RifleCheck(!Action(TEXT("fire")),TEXT("inspect_gates_fire"));Go(6);
 }else if(RiflePhase==6&&ClipPhase(ActiveProfile->InspectDuration)>=.3){RifleCheck(CurrentProfilePose.RootRotation.Yaw<-15,TEXT("inspect_left_pose"));RifleCapture(TEXT("inspect-left"));Go(7,.6);
 }else if(RiflePhase==7&&ClipPhase(ActiveProfile->InspectDuration)>=.68){RifleCheck(CurrentProfilePose.RootRotation.Yaw>15,TEXT("inspect_right_pose"));RifleCapture(TEXT("inspect-right"));RifleCheck(RecoilProbeSettled(),TEXT("recoil_rises_then_settles"));RifleShotsRemaining=5;Go(8,.6);
 }else if(RiflePhase==8&&Mode==TEXT("idle")&&Cooldown<=0){if(RifleShotsRemaining){RifleCheck(Action(TEXT("fire")),TEXT("string_real_fire"));RifleShotsRemaining--;}else{RifleCheck(Recoil.Shots==Shots&&Recoil.Index==4,TEXT("recoil_string_walks_pattern"));RifleCheck(Ammo==4&&Action(TEXT("reload")),TEXT("charger_reload_starts"));RifleCommitBaseline=ReloadCommits;RifleCheck(!Action(TEXT("fire"))&&!Action(TEXT("aim"))&&!Action(TEXT("inspect"))&&!Action(TEXT("reload")),TEXT("reload_gates_all_actions"));Go(9);}
 }else if(RiflePhase==9&&ClipPhase(ActiveProfile->ReloadDuration)>=.25){RifleCheck(Ammo==4&&!ReloadCommitted,TEXT("no_early_reload_commit"));RifleCheck(CurrentProfilePose.BoltSlide<-5&&CurrentProfilePose.RightOffset.Size()>5,TEXT("bolt_open_hand_off_stock"));RifleCapture(TEXT("reload-bolt-open"));Go(10,.6);
 }else if(RiflePhase==10&&ClipPhase(ActiveProfile->ReloadDuration)>=.55){RifleCheck(Ammo==4&&CurrentProfilePose.Cartridge>.5f,TEXT("visible_charger_before_commit"));RifleCapture(TEXT("reload-charger"));Go(11,.6);
 }else if(RiflePhase==11&&ClipPhase(ActiveProfile->ReloadDuration)>=.64){RifleCheck(Ammo==9&&Reserve==25&&ReloadCommits==RifleCommitBaseline+1&&Conservation(),TEXT("charger_commits_five_once"));Go(12);
 }else if(RiflePhase==12&&ClipPhase(ActiveProfile->ReloadDuration)>=.9){RifleCheck(CurrentProfilePose.Cartridge<.5f,TEXT("charger_clears_after_commit"));RifleCapture(TEXT("reload-return"));Go(13,.6);
 }else if(RiflePhase==13&&Mode==TEXT("idle")){RifleCheck(Ammo==10&&Reserve==24&&ReloadCommits==RifleCommitBaseline+2&&Conservation(),TEXT("second_cycle_tops_up_and_stops"));RifleCheck(BoltAtRest(),TEXT("bolt_closed_after_reload"));RifleCheck(Hands->GetSocketTransform(TEXT("Joint_right_right_wrist"),RTS_Component).GetLocation().Equals(ActiveProfile->RightWrist,.2),TEXT("reload_returns_right_wrist"));
  RifleCheck(RifleMaxIKError<.2&&RifleMaxLengthError<.15,TEXT("bolt_two_bone_ik_without_stretch"));RifleCheck(RifleMaxTwistError<.015,TEXT("profile_forearm_twist_distribution"));RifleCheck(Grip==TEXT("restored-furniture"),TEXT("profile_finish_persists"));RifleCapture(TEXT("ready-return"));Go(14,.6);
 }else if(RiflePhase==14){/* Explicit fixture-only reserve boundary, independent of the normal 40-round conservation case. */Ammo=7;Reserve=2;RifleCommitBaseline=ReloadCommits;RifleCheck(Action(TEXT("reload")),TEXT("reserve_boundary_fixture_starts"));Go(15);
 }else if(RiflePhase==15&&Mode==TEXT("idle")){RifleCheck(Ammo==9&&Reserve==0&&ReloadCommits==RifleCommitBaseline+1&&!Action(TEXT("reload")),TEXT("short_charger_stops_without_fabricating_rounds"));FinishRifleTest();}
 if(RifleClock>120){RifleCheck(false,TEXT("fixture_progress_deadline"));FinishRifleTest();}
}

// M4 fixture: thirty-round magazine, ninety in reserve, semi and a three-round burst on a non-resetting cam, a magazine swap and the longer
// empty reload with the charging handle. Inputs go to the trigger as a player's do (a pull is latched; rounds fall on the trigger clock in
// the next frames), so each check reads the gun a phase after its input. Same report, captures and range session as the other fixtures.
void AWeaponLoop::CarbineTestTick(float Dt){
 RifleClock+=Dt;if(RifleClock<RifleNext||RiflePhase==1000)return;
 using namespace WeaponTrigger;FTrigger& T=TriggerGun.Trigger;const FRules& Rules=*TriggerGun.Rules;
 auto Go=[&](int32 PhaseValue,double Delay=.05){RiflePhase=PhaseValue;RifleNext=RifleClock+Delay;};
 auto ClipPhase=[&](double Duration){return Duration>0?1-Timer/Duration:0;};
 auto Conservation=[&](){return Ammo+Reserve+Shots==120;};
 auto PartsAtRest=[&](){return Magazine->GetRelativeLocation().Equals(ActiveProfile->MagazinePivot,.01)&&!Magazine->bHiddenInGame&&ChargingHandle->GetRelativeLocation().Equals(ActiveProfile->ChargingHandlePivot,.01)&&LoadingCue->bHiddenInGame;};
 if(RiflePhase==0){
  RifleCheck(ProfileReady&&ActiveProfile&&Parts.Num()==ActiveProfile->Parts.Num(),TEXT("profile_assets_bound"));RifleCheck(Hands->GetNumBones()==41,TEXT("dedicated_41_bone_hands"));
  RifleCheck(UsesTrigger()&&FireModes()==2&&T.Mode==EFireMode::Semi&&Ammo==30&&Reserve==90&&Capacity()==30,TEXT("carbine_trigger_rules_bound"));
  for(const FName N:{FName(TEXT("Ready")),FName(TEXT("Fire")),FName(TEXT("Inspect")),FName(TEXT("Reload")),FName(TEXT("ReloadEmpty"))})RifleCheck(ActiveProfile->Clip(N)&&ActiveProfile->Clip(N)->Sequence,TEXT("authored_clip_bound"));
  RifleCheck(Magazine->GetNumChildrenComponents()>0&&ChargingHandle->GetNumChildrenComponents()>0&&LoadingCue->GetNumChildrenComponents()>0&&LoadingCue->GetAttachParent()==Hands&&LoadingCue->GetAttachSocketName()==ActiveProfile->LoadingCueBone&&PartsAtRest(),TEXT("carbine_parts_bound_at_rest"));
  RifleCheck(!AttachItem(TEXT("optic"),TEXT("red-dot"))&&!AttachItem(TEXT("grip"),TEXT("charcoal"))&&!AttachItem(TEXT("sling"),TEXT("web-sling")),TEXT("exact_profile_compatibility"));
  {const bool Replayed=ReplayFixtures(TriggerSummary);UE_LOG(LogTemp,Display,TEXT("TRIGGER_FIXTURE %s"),*TriggerSummary);RifleCheck(Replayed,TEXT("trigger_fixture_matches"));}
  if(auto* P=Cast<ARangeSlicePawn>(UGameplayStatics::GetPlayerPawn(this,0))){P->Movement->StopMovementImmediately();P->SetActorTickEnabled(false);for(const auto& F:Range.Surfaces())if(F.Id==TEXT("original.face"))P->Camera->SetWorldRotation((F.Origin-P->Camera->GetComponentLocation()).Rotation());}
  RifleCapture(TEXT("ready"));Go(1,.6);
 }else if(RiflePhase==1){/* An empty pull is refused on the trigger clock before the range is asked, so no string starts. */TriggerGun.Ammo=0;SyncTriggerGun();RifleStringBaseline=Range.StringId;RifleCheck(Action(TEXT("fire"))&&T.Latched,TEXT("empty_pull_latches"));Go(2);
 }else if(RiflePhase==2){RifleCheck(!T.Latched&&Shots==0&&Recoil.Shots==0&&Range.StringId==RifleStringBaseline&&Range.Shots.IsEmpty()&&Message.StartsWith(TEXT("Empty")),TEXT("empty_trigger_starts_no_string"));TriggerGun.Ammo=Rules.Capacity;SyncTriggerGun();
  RifleCheck(Range.Action(TEXT("select"),TEXT("original"))&&Range.Action(TEXT("start")),TEXT("range_string_starts_normally"));RifleCheck(Action(TEXT("aim"))&&Aim,TEXT("carbine_aim"));Go(3,.4);
 }else if(RiflePhase==3){RifleCheck(FMath::Abs(AimBlend-1)<.01,TEXT("aim_reaches_profile_frame"));if(auto* P=Cast<ARangeSlicePawn>(UGameplayStatics::GetPlayerPawn(this,0))){bool Aligned=true;for(const FName N:{FName(TEXT("anchor_sight_rear")),FName(TEXT("anchor_sight_front"))}){const auto* C=ProfileAnchors.Find(N);if(!C||!C->Get()){Aligned=false;continue;}const FVector Q=P->Camera->GetComponentTransform().InverseTransformPosition((*C)->GetComponentLocation());Aligned&=Q.X>0&&FMath::Abs(Q.Y)<.15&&FMath::Abs(Q.Z)<.15;}RifleCheck(Aligned,TEXT("delivered_sight_anchors_align_camera_ray"));}RifleCheck(ActiveProfile->AimFovVerticalDeg<=0||FMath::Abs(LastFovDeg-ActiveProfile->AimFovVerticalDeg)<.5f,TEXT("aim_fov_reaches_profile"));RifleCheck(!ActiveProfile->GhostRingMaterial||(GhostRings.Num()>0&&LastGhostAim>.99f),TEXT("ghost_ring_active_in_aim"));RifleCapture(TEXT("aim"));Go(4,.6);
 }else if(RiflePhase==4){{FString Replay;const bool Replayed=WeaponRecoil::ReplayFixture(ActiveProfile->ProfileId,Replay);UE_LOG(LogTemp,Display,TEXT("RECOIL_FIXTURE %s"),*Replay);RifleCheck(Replayed,TEXT("recoil_fixture_matches"));}
  BeginRecoilProbe();RifleCheck(Action(TEXT("fire"))&&T.Latched&&Shots==0,TEXT("semi_pull_latches"));Go(5);
 }else if(RiflePhase==5){RifleCheck(Ammo==29&&Shots==1&&Range.Shots.Num()==1&&!T.Latched&&!T.Engaged&&!T.Down,TEXT("semi_fires_one_round_per_pull"));RifleCheck(RecoilProbeShot(),TEXT("recoil_shot_uses_pre_kick_aim"));RifleCheck(Recoil.Shots==1,TEXT("one_kick_per_round"));Go(6,1.2);
 }else if(RiflePhase==6){RifleCheck(RecoilProbeSettled(),TEXT("recoil_rises_then_settles"));RifleCheck(Action(TEXT("mode"))&&T.Mode==EFireMode::Burst&&T.BurstLeft(Rules.Fire)==3,TEXT("b_switches_to_burst"));
  /* F held: after the capture hold the burst runs on the trigger clock, three rounds a cycle apart, then stops with the trigger still down. */T.Pull();RifleCapture(TEXT("fire-held"));Go(7,1.1);
 }else if(RiflePhase==7){RifleCheck(Ammo==26&&Shots==4&&Range.Shots.Num()==4&&T.Down&&!T.Engaged&&T.Cam==0,TEXT("held_burst_fires_three_then_stops"));RifleCheck(Recoil.Shots==Shots&&Recoil.Index==2,TEXT("recoil_burst_walks_pattern"));
  /* Release mid-burst: pull again and release as soon as this burst has fired (one round, or two after a long frame). */T.Release();T.Pull();RifleAmmoBaseline=Ammo;Go(8,0);
 }else if(RiflePhase==8&&Ammo<RifleAmmoBaseline){T.Release();RifleAmmoBaseline=Ammo;Go(9,.4);
 }else if(RiflePhase==9){const int32 Fired=26-Ammo;RifleCheck(Ammo==RifleAmmoBaseline&&Fired>0&&Fired<3&&T.Cam==Fired&&T.BurstLeft(Rules.Fire)==3-Fired&&!T.Engaged,TEXT("release_mid_burst_keeps_cam"));T.Pull();Go(10,.4);
 }else if(RiflePhase==10){RifleCheck(Ammo==23&&Shots==7&&T.Cam==0&&T.Down&&!T.Engaged,TEXT("next_pull_finishes_burst"));T.Release();
  RifleCheck(Action(TEXT("inspect"))&&!Aim&&Mode==TEXT("inspect"),TEXT("carbine_inspect_starts"));RifleCheck(Action(TEXT("fire"))&&T.Latched,TEXT("inspect_pull_latches"));Go(11);
 }else if(RiflePhase==11&&ClipPhase(Rules.Inspect)>=.3){RifleCheck(Ammo==23&&Shots==7&&!T.Latched,TEXT("inspect_refuses_rounds"));RifleCheck(CurrentProfilePose.RootRotation.Yaw<-15,TEXT("inspect_left_pose"));RifleCapture(TEXT("inspect-left"));Go(12,.6);
 }else if(RiflePhase==12&&ClipPhase(Rules.Inspect)>=.68){RifleCheck(CurrentProfilePose.RootRotation.Yaw>15,TEXT("inspect_right_pose"));RifleCapture(TEXT("inspect-right"));Go(13,.6);
 }else if(RiflePhase==13&&Mode==TEXT("idle")){RifleCheck(Action(TEXT("reload"))&&Mode==TEXT("reload")&&!TriggerGun.EmptyReload&&FMath::IsNearlyEqual(double(Timer),Rules.Reload,1e-3),TEXT("magazine_reload_starts"));RifleCommitBaseline=ReloadCommits;RifleMaxChargingHandle=0;
  RifleCheck(Action(TEXT("fire"))&&!Action(TEXT("aim"))&&!Action(TEXT("inspect"))&&!Action(TEXT("reload")),TEXT("reload_gates_actions"));Go(14);
 }else if(RiflePhase==14&&ClipPhase(Rules.Reload)>=.12){RifleCheck(Ammo==23&&Shots==7&&!ReloadCommitted&&!T.Latched,TEXT("reload_refuses_rounds_no_early_commit"));RifleCheck(CurrentProfilePose.MagOut>.2f&&CurrentProfilePose.MagOut<.999f&&!Magazine->bHiddenInGame&&Magazine->GetRelativeLocation().Z<ActiveProfile->MagazinePivot.Z-3,TEXT("magazine_drops_on_release"));Go(15);
 }else if(RiflePhase==15&&ClipPhase(Rules.Reload)>=.2){RifleCheck(CurrentProfilePose.MagOut>=.999f&&Magazine->bHiddenInGame&&CurrentProfilePose.Cartridge<.5f&&LoadingCue->bHiddenInGame,TEXT("magazine_hidden_once_clear"));RifleCapture(TEXT("reload-mag-out"));Go(16,.6);
 }else if(RiflePhase==16&&ClipPhase(Rules.Reload)>=.45){RifleCheck(Ammo==23&&CurrentProfilePose.Cartridge>.5f&&!LoadingCue->bHiddenInGame&&Magazine->bHiddenInGame,TEXT("magazine_cue_in_left_hand_before_commit"));RifleCapture(TEXT("reload-cue"));Go(17,.6);
 }else if(RiflePhase==17&&ClipPhase(Rules.Reload)>=.66){RifleCheck(Ammo==30&&Reserve==83&&ReloadCommits==RifleCommitBaseline+1&&Conservation(),TEXT("magazine_commits_full_once"));RifleCheck(CurrentProfilePose.Cartridge<.5f&&LoadingCue->bHiddenInGame&&!Magazine->bHiddenInGame&&Magazine->GetRelativeLocation().Equals(ActiveProfile->MagazinePivot,.01),TEXT("cue_clears_magazine_seated_after_commit"));Go(18);
 }else if(RiflePhase==18&&Mode==TEXT("idle")){RifleCheck(RifleMaxChargingHandle<.001f&&PartsAtRest(),TEXT("standard_reload_skips_charging_handle"));Go(19);
 }else if(RiflePhase==19){/* F held burst after burst until the magazine runs dry: release once each burst stops, then pull again. */if(Ammo>0){if(!T.Down)T.Pull();else if(!T.Latched&&!T.Engaged)T.Release();}else{T.Release();Go(20,.3);}
 }else if(RiflePhase==20){RifleCheck(Ammo==0&&Shots==37&&Range.Shots.Num()==37&&Conservation()&&T.Cam==0,TEXT("magazine_runs_dry_in_bursts"));RifleCheck(Recoil.Shots==Shots,TEXT("every_round_kicks"));
  RifleCheck(Action(TEXT("reload"))&&TriggerGun.EmptyReload&&FMath::IsNearlyEqual(double(Timer),Rules.ReloadEmpty,1e-3),TEXT("empty_reload_selects_long_clip"));RifleCommitBaseline=ReloadCommits;Go(21);
 }else if(RiflePhase==21&&ClipPhase(Rules.ReloadEmpty)>=.3){RifleCheck(PlayingClip==TEXT("ReloadEmpty")&&Ammo==0&&!ReloadCommitted,TEXT("empty_reload_plays_its_clip"));Go(22);
 }else if(RiflePhase==22&&ClipPhase(Rules.ReloadEmpty)>=.765){RifleCheck(Ammo==30&&Reserve==53&&ReloadCommits==RifleCommitBaseline+1&&Conservation(),TEXT("empty_reload_seats_before_the_handle"));const FVector Travel=ChargingHandle->GetRelativeLocation()-ActiveProfile->ChargingHandlePivot;
  RifleCheck(CurrentProfilePose.ChargingHandle>.5f&&FVector::DotProduct(Travel,ActiveProfile->ChargingHandleAxis)>.5f*ActiveProfile->ChargingHandleTravelCm&&FVector::CrossProduct(Travel,ActiveProfile->ChargingHandleAxis).Size()<.01,TEXT("charging_handle_travels_along_its_axis"));RifleCapture(TEXT("charging-handle"));Go(23,.6);
 }else if(RiflePhase==23&&Mode==TEXT("idle")){RifleCheck(RifleMaxChargingHandle>.999f&&Ammo==30&&Reserve==53&&ReloadCommits==RifleCommitBaseline+1&&Conservation(),TEXT("empty_reload_commits_once_and_charges"));RifleCheck(PartsAtRest(),TEXT("carbine_parts_return_to_rest"));RifleCheck(Hands->GetSocketTransform(TEXT("Joint_right_right_wrist"),RTS_Component).GetLocation().Equals(ActiveProfile->RightWrist,.2),TEXT("reload_returns_right_wrist"));
  RifleCheck(RifleMaxIKError<.2&&RifleMaxLengthError<.15,TEXT("carbine_two_bone_ik_without_stretch"));RifleCheck(RifleMaxTwistError<.015,TEXT("profile_forearm_twist_distribution"));RifleCapture(TEXT("ready-return"));Go(24,.6);
 }else if(RiflePhase==24){/* Explicit fixture-only reserve boundary, independent of the normal 120-round conservation case. */TriggerGun.Ammo=12;TriggerGun.Reserve=5;SyncTriggerGun();RifleCommitBaseline=ReloadCommits;RifleCheck(Action(TEXT("reload"))&&!TriggerGun.EmptyReload,TEXT("reserve_boundary_fixture_starts"));Go(25);
 }else if(RiflePhase==25&&Mode==TEXT("idle")){RifleCheck(Ammo==17&&Reserve==0&&ReloadCommits==RifleCommitBaseline+1&&!Action(TEXT("reload")),TEXT("short_reserve_seats_without_fabricating_rounds"));FinishRifleTest();}
 if(RifleClock>150){RifleCheck(false,TEXT("fixture_progress_deadline"));FinishRifleTest();}
}
