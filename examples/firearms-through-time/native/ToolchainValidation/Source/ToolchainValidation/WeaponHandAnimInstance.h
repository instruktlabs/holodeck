#pragma once
#include "CoreMinimal.h"
#include "Animation/AnimInstance.h"
#include "WeaponHandAnimInstance.generated.h"
class UAnimSequence;
UCLASS(Transient)
class TOOLCHAINVALIDATION_API UWeaponHandAnimInstance : public UAnimInstance {
 GENERATED_BODY()
public:
 UWeaponHandAnimInstance();
 void SetFrame(UAnimSequence* Sequence,float Time,const FVector& Left,const FVector& Right);
 void SetRig(const FVector& LeftPole,const FVector& RightPole,const FVector& LeftAxis,const FVector& RightAxis,const FVector2D& Fractions);
 UPROPERTY(Transient) TObjectPtr<UAnimSequence> FrameSequence;
 float FrameTime=0;FVector LeftGoal=FVector::ZeroVector,RightGoal=FVector::ZeroVector;
 FVector LeftPoleGoal,RightPoleGoal,LeftTwistAxis,RightTwistAxis;FVector2D TwistFractions;
protected:
 virtual FAnimInstanceProxy* CreateAnimInstanceProxy() override;
 virtual void DestroyAnimInstanceProxy(FAnimInstanceProxy* InProxy) override;
};
