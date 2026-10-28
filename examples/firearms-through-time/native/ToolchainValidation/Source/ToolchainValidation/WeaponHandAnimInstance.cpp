#include "WeaponHandAnimInstance.h"
#include "WeaponArmRigData.h"
#include "Animation/AnimInstanceProxy.h"
#include "Animation/AnimSequence.h"
#include "Animation/AnimNodeSpaceConversions.h"
#include "AnimNodes/AnimNode_SequenceEvaluator.h"
#include "BoneControllers/AnimNode_TwoBoneIK.h"

// Helpers are elbow children, not ancestors of the wrist: distributing twist
// cannot move the IK effector or change its authored orientation.
struct FForearmTwistNode final : FAnimNode_SkeletalControlBase {
 FBoneReference Elbows[2],Wrists[2],Helpers[2][2];
 FVector LowerAxes[2]={WeaponArmRig::LeftLowerAxis,WeaponArmRig::RightLowerAxis};FVector2D Fractions=FVector2D(.4,.8);
 FForearmTwistNode(){Alpha=1;const TCHAR* Sides[]={TEXT("left"),TEXT("right")};for(int32 S=0;S<2;S++){
  Elbows[S].BoneName=FName(*FString::Printf(TEXT("Joint_%sArm_%s_elbow"),Sides[S],Sides[S]));
  Wrists[S].BoneName=FName(*FString::Printf(TEXT("Joint_%s_%s_wrist"),Sides[S],Sides[S]));
  for(int32 T=0;T<2;T++)Helpers[S][T].BoneName=FName(*FString::Printf(TEXT("Joint_%sTwist%d_%s_forearm_twist%d"),Sides[S],T,Sides[S],T));
 }}
 virtual void InitializeBoneReferences(const FBoneContainer& B)override{for(int32 S=0;S<2;S++){Elbows[S].Initialize(B);Wrists[S].Initialize(B);for(auto& H:Helpers[S])H.Initialize(B);}}
 virtual bool IsValidToEvaluate(const USkeleton*,const FBoneContainer& B)override{for(int32 S=0;S<2;S++){if(!Elbows[S].IsValidToEvaluate(B)||!Wrists[S].IsValidToEvaluate(B))return false;for(auto& H:Helpers[S])if(!H.IsValidToEvaluate(B))return false;}return true;}
 virtual void EvaluateSkeletalControl_AnyThread(FComponentSpacePoseContext& Output,TArray<FBoneTransform>& Out)override{
  const auto& B=Output.Pose.GetPose().GetBoneContainer();
  for(int32 S=0;S<2;S++){
   const auto& E=Output.Pose.GetComponentSpaceTransform(Elbows[S].GetCompactPoseIndex(B));
   const auto& W=Output.Pose.GetComponentSpaceTransform(Wrists[S].GetCompactPoseIndex(B));
   const FVector Axis=LowerAxes[S];
   const FQuat Q=E.GetRotation().Inverse()*W.GetRotation();const double P=Q.X*Axis.X+Q.Y*Axis.Y+Q.Z*Axis.Z;
   const double Angle=FMath::Abs(P)+FMath::Abs(Q.W)<1e-8?0:FMath::UnwindRadians(2*FMath::Atan2(P,Q.W));
   for(int32 T=0;T<2;T++){const auto Index=Helpers[S][T].GetCompactPoseIndex(B);FTransform Transform=Output.Pose.GetComponentSpaceTransform(Index);Transform.SetRotation(E.GetRotation()*FQuat(Axis,Angle*Fractions[T]));Out.Emplace(Index,Transform);}
  }
  Out.Sort([](const FBoneTransform& A,const FBoneTransform& B){return A.BoneIndex<B.BoneIndex;});
 }
};

// Evaluate the authored finger/wrist clip, then solve both arms using Epic's
// runtime TwoBoneIK nodes. Only a game-thread snapshot crosses into the proxy.
struct FWeaponHandProxy final : FAnimInstanceProxy {
 FAnimNode_SequenceEvaluator_Standalone Sequence;
 FAnimNode_ConvertLocalToComponentSpace ToComponent;
 FAnimNode_TwoBoneIK Left,Right;
 FForearmTwistNode Twist;
 FAnimNode_ConvertComponentToLocalSpace ToLocal;
 explicit FWeaponHandProxy(UAnimInstance* Instance):FAnimInstanceProxy(Instance){
  Sequence.SetShouldLoop(false);Sequence.SetTeleportToExplicitTime(true);
  ToComponent.LocalPose.SetLinkNode(&Sequence);
  Left.ComponentPose.SetLinkNode(&ToComponent);Right.ComponentPose.SetLinkNode(&Left);Twist.ComponentPose.SetLinkNode(&Right);ToLocal.ComponentPose.SetLinkNode(&Twist);
  Left.IKBone.BoneName=TEXT("Joint_left_left_wrist");Right.IKBone.BoneName=TEXT("Joint_right_right_wrist");
  Left.JointTargetLocation=WeaponArmRig::LeftPole;Right.JointTargetLocation=WeaponArmRig::RightPole;
  for(auto* N:{&Left,&Right}){N->Alpha=1;N->bAllowStretching=false;N->bMaintainEffectorRelRot=false;N->bTakeRotationFromEffectorSpace=false;N->EffectorLocationSpace=BCS_ComponentSpace;N->JointTargetLocationSpace=BCS_ComponentSpace;}
 }
 virtual FAnimNode_Base* GetCustomRootNode()override{return &ToLocal;}
 virtual void GetCustomNodes(TArray<FAnimNode_Base*>& Out)override{Out.Append({&Sequence,&ToComponent,&Left,&Right,&Twist,&ToLocal});}
 virtual void PreUpdate(UAnimInstance* Instance,float Delta)override{
  FAnimInstanceProxy::PreUpdate(Instance,Delta);const auto* A=CastChecked<UWeaponHandAnimInstance>(Instance);
  Sequence.SetSequence(A->FrameSequence);Sequence.SetExplicitTime(A->FrameTime);Left.EffectorLocation=A->LeftGoal;Right.EffectorLocation=A->RightGoal;
  Left.JointTargetLocation=A->LeftPoleGoal;Right.JointTargetLocation=A->RightPoleGoal;Twist.LowerAxes[0]=A->LeftTwistAxis;Twist.LowerAxes[1]=A->RightTwistAxis;Twist.Fractions=A->TwistFractions;
 }
};
UWeaponHandAnimInstance::UWeaponHandAnimInstance(){SetRig(WeaponArmRig::LeftPole,WeaponArmRig::RightPole,WeaponArmRig::LeftLowerAxis,WeaponArmRig::RightLowerAxis,FVector2D(WeaponArmRig::TwistFractions[0],WeaponArmRig::TwistFractions[1]));}
void UWeaponHandAnimInstance::SetRig(const FVector& LP,const FVector& RP,const FVector& LA,const FVector& RA,const FVector2D& Fractions){LeftPoleGoal=LP;RightPoleGoal=RP;LeftTwistAxis=LA;RightTwistAxis=RA;TwistFractions=Fractions;}
void UWeaponHandAnimInstance::SetFrame(UAnimSequence* Sequence,float Time,const FVector& Left,const FVector& Right){FrameSequence=Sequence;FrameTime=Time;LeftGoal=Left;RightGoal=Right;}
FAnimInstanceProxy* UWeaponHandAnimInstance::CreateAnimInstanceProxy(){return new FWeaponHandProxy(this);}
void UWeaponHandAnimInstance::DestroyAnimInstanceProxy(FAnimInstanceProxy* Proxy){delete Proxy;}
