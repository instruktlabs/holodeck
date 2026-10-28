import {readFile,writeFile} from 'node:fs/promises';
const p='native/ToolchainValidation/Source/ToolchainValidation/WeaponLoop.cpp';let s=await readFile(p,'utf8');
s=s.replace('Components/PoseableMeshComponent.h','Components/SkeletalMeshComponent.h').replace('#include "Camera/CameraComponent.h"','#include "Animation/AnimSequence.h"\n#include "Camera/CameraComponent.h"');
s=s.replace('CreateDefaultSubobject<UPoseableMeshComponent>(TEXT("SkinnedGloves"))','CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("AnimatedGloves"))');
s=s.replace('Hands->bComponentUseFixedSkelBounds=false;','Hands->bComponentUseFixedSkelBounds=false;Hands->VisibilityBasedAnimTickOption=EVisibilityBasedAnimTickOption::AlwaysTickPoseAndRefreshBones;');
s=s.replace('void AWeaponLoop::AddPart',`void AWeaponLoop::SetClips(UAnimSequence* Ready,UAnimSequence* Reload,UAnimSequence* Inspect,UAnimSequence* Fire){ReadyClip=Ready;ReloadClip=Reload;InspectClip=Inspect;FireClip=Fire;Hands->OverrideAnimationData(Ready,true,false,0,0);}
void AWeaponLoop::AddPart`);
s=s.replace('LeftRest=Hands->GetBoneLocationByName(LeftBone,EBoneSpaces::ComponentSpace);FingerRest=Hands->GetBoneRotationByName(FingerBone,EBoneSpaces::ComponentSpace);','Hands->SetComponentTickEnabled(false);Hands->PlayAnimation(ReadyClip,false);Hands->SetPlayRate(0);Hands->SetPosition(0,false);Hands->TickAnimation(0,false);Hands->RefreshBoneTransforms();LeftRest=Hands->GetSocketTransform(LeftBone,RTS_Component).GetLocation();FingerRest=Hands->GetSocketTransform(TEXT("Joint_leftFinger2_left_finger2_mid"),RTS_Component).GetRotation();');
s=s.replace('Timer=1.6f','Timer=WeaponPresentation::InspectDuration').replaceAll('WeaponPresentation::Duration','WeaponPresentation::ReloadDuration');
const a=s.indexOf(' const auto Pose='),b=s.indexOf(' if(!ReadyCaptured',a);if(a<0||b<0)throw Error('Pose anchors');
s=s.slice(0,a)+` const bool Reloading=Mode==TEXT("reload"),Inspecting=Mode==TEXT("inspect"),Firing=!Reloading&&!Inspecting&&Cooldown>0;
 const FName ClipName=Reloading?TEXT("Reload"):Inspecting?TEXT("Inspect"):Firing?TEXT("Fire"):TEXT("Ready");
 UAnimSequence* Clip=Reloading?ReloadClip.Get():Inspecting?InspectClip.Get():Firing?FireClip.Get():ReadyClip.Get();
 const float ClipTime=Reloading?WeaponPresentation::ReloadDuration-Timer:Inspecting?WeaponPresentation::InspectDuration-Timer:Firing?WeaponPresentation::FireDuration-Cooldown:0;
 const auto Pose=Reloading?WeaponPresentation::Sample(WeaponPresentation::ReloadKeys,ClipTime/WeaponPresentation::ReloadDuration):Inspecting?WeaponPresentation::Sample(WeaponPresentation::InspectKeys,ClipTime/WeaponPresentation::InspectDuration):Firing?WeaponPresentation::Sample(WeaponPresentation::FireKeys,ClipTime/WeaponPresentation::FireDuration):WeaponPresentation::Sample(WeaponPresentation::ReadyKeys,0);
 const float K=Flash/.09f;
 AimBlend+=((Aim?1.f:0.f)-AimBlend)*(1-FMath::Exp(-18*Dt));const float A=AimBlend;
 SetActorRelativeLocation(FVector(42-3.5*K+100*Pose.forward,10*(1-A)+100*Pose.side,-17+9.3*A+100*Pose.lift));SetActorRelativeRotation(FRotator(4*K+FMath::RadiansToDegrees(Pose.pitch),-FMath::RadiansToDegrees(Pose.yaw),FMath::RadiansToDegrees(Pose.roll)));
 Slide->SetRelativeLocation(FVector(-2.7*K,0,0));Magazine->SetRelativeLocation(FVector(0,0,Pose.magY)*100);
 if(PlayingClip!=ClipName){Hands->PlayAnimation(Clip,false);Hands->SetPlayRate(0);PlayingClip=ClipName;}
 Hands->SetPosition(ClipTime,false);Hands->TickAnimation(0,false);Hands->RefreshBoneTransforms();if(!Testing)return;
`+s.slice(b);
const c=s.indexOf(' if(Phase==0'),d=s.indexOf('\n}\nvoid AWeaponHUD',c);if(c<0||d<0)throw Error('Test anchors');
s=s.slice(0,c)+` if(Phase==0&&Elapsed>3){Check(Hands->GetNumBones()==33,TEXT("skin_33_bones"));Check(Parts.Num()==72,TEXT("weapon_parts_loaded"));Check(Hands->GetBoneIndex(LeftBone)!=INDEX_NONE,TEXT("semantic_wrist_survived_import"));Check(ReadyClip&&ReloadClip&&InspectClip&&FireClip,TEXT("four_authored_clips_bound"));Check(ReloadClip&&FMath::Abs(ReloadClip->GetPlayLength()-3.2f)<.025f&&InspectClip&&FMath::Abs(InspectClip->GetPlayLength()-3.6f)<.025f,TEXT("clip_durations_match_contract"));Check(!AttachItem(TEXT("optic"),TEXT("red-dot")),TEXT("incompatible_attachment_rejected"));Check(AttachItem(TEXT("grip"),TEXT("charcoal"))&&Grips.Num()==32,TEXT("compatible_grips_native_override"));Check(Action(TEXT("aim"))&&Aim,TEXT("aim"));Check(Action(TEXT("fire"))&&Ammo==6&&Hits==1,TEXT("fire_consumes_and_hits"));Check(!Action(TEXT("fire")),TEXT("cooldown_rejects_repeat"));Capture(TEXT("aim"));Phase++;}
 else if(Phase==1&&Elapsed>3.5){Check(Action(TEXT("inspect"))&&!Aim,TEXT("inspect_clears_aim"));Check(!Action(TEXT("fire")),TEXT("inspect_blocks_fire"));Phase++;}
 else if(Phase==2&&Elapsed>4.65){Check(Pose.yaw>.8f&&PlayingClip==TEXT("Inspect"),TEXT("inspect_left_view"));Check(Hands->GetSocketTransform(TEXT("Joint_leftFinger2_left_finger2_mid"),RTS_Component).GetRotation().AngularDistance(FingerRest)>.08f,TEXT("authored_finger_motion"));Capture(TEXT("inspect-left"));Phase++;}
 else if(Phase==3&&Elapsed>5.9){Check(Pose.yaw<-.6f&&PlayingClip==TEXT("Inspect"),TEXT("inspect_right_view"));Capture(TEXT("inspect-right"));Phase++;}
 else if(Phase==4&&Elapsed>7.3){Check(Mode==TEXT("idle")&&Ammo==6,TEXT("inspect_completes"));Check(Hands->GetSocketTransform(LeftBone,RTS_Component).GetLocation().Equals(LeftRest,.05f),TEXT("inspect_returns_to_ready"));Check(Action(TEXT("reload")),TEXT("reload_starts"));Check(!Action(TEXT("fire"))&&!Action(TEXT("aim")),TEXT("reload_blocks_fire_and_aim"));Phase++;}
 else if(Phase==5&&Elapsed>8.10){Check(FMath::Abs(Pose.magY)<.004f&&Pose.handRoll<-.20f,TEXT("grasp_before_magazine_moves"));Capture(TEXT("grasp"));Phase++;}
 else if(Phase==6&&Elapsed>8.75){Check(Ammo==6&&Pose.lift>.15f,TEXT("reload_has_no_early_commit"));Check(Hands->GetSocketTransform(LeftBone,RTS_Component).GetLocation().Z<LeftRest.Z-20,TEXT("clip_left_hand_deforms"));Capture(TEXT("reload"));Phase++;}
 else if(Phase==7&&Elapsed>9.50){Check(Pose.magY<-.02f&&Pose.magY>-.09f&&Ammo==6,TEXT("insertion_before_commit"));Capture(TEXT("insert"));Phase++;}
 else if(Phase==8&&Elapsed>10.43){Check(FMath::Abs(Pose.magY)<.001f&&FMath::Abs(Pose.handY)<.004f,TEXT("regrip_after_seating"));Capture(TEXT("regrip"));Phase++;}
 else if(Phase==9&&Elapsed>10.8){Check(Ammo==7&&Reserve==27&&Mode==TEXT("idle"),TEXT("reload_commits_once"));Check(Grip==TEXT("charcoal")&&Grips.Num()==32,TEXT("native_override_survives_animation"));Check(Hands->GetSocketTransform(LeftBone,RTS_Component).GetLocation().Equals(LeftRest,.05f),TEXT("reload_returns_to_ready"));Capture(TEXT("ready"));Phase++;}
 else if(Phase==10&&Elapsed>11.3){for(int32 J=0;J<7;J++){Cooldown=0;Action(TEXT("fire"));}Cooldown=0;Check(Ammo==0&&!Action(TEXT("fire"))&&Shots==8,TEXT("empty_rejects_fire"));Phase++;}
 else if(Phase==11&&Elapsed>12.5){UE_LOG(LogTemp,Display,TEXT("WEAPON_RESULT %s"),Failed?TEXT("FAIL"):TEXT("PASS"));FPlatformMisc::RequestExitWithStatus(false,Failed?1:0);Phase++;}`+s.slice(d);
await writeFile(p,s);
