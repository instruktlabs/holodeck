// Pistol grip v7 (forearm aligned with the hand): the ~10 degree reload twist was an artefact of the misaligned v5 arm and is now under 1 degree.
// The twist liveness proof therefore spans both hand actions (inspect still twists ~5.6 degrees); the distribution error check spans both too.
const fs=require('fs'),path=require('path');
const file=path.join(__dirname,'../native/ToolchainValidation/Source/ToolchainValidation/WeaponLoop.cpp');const raw=fs.readFileSync(file,'utf8'),eol=raw.includes('\r\n')?'\r\n':'\n';let s=raw.replace(/\r\n/g,'\n');
for(const [a,b] of [[' if(Reloading){const FQuat EQ=Hands->GetSocketTransform(TEXT("Joint_leftArm_left_elbow")',' if(Reloading||Inspecting){const FQuat EQ=Hands->GetSocketTransform(TEXT("Joint_leftArm_left_elbow")'],['Check(MaxTwistMotion>.05f,TEXT("forearm_twist_moves_during_reload"))','Check(MaxTwistMotion>.05f,TEXT("forearm_twist_moves_during_hand_actions"))']]){if(s.split(a).length!==2)throw Error('needs exactly one '+a.slice(0,60));s=s.replace(a,b);}
fs.writeFileSync(file,s.replace(/\n/g,eol));console.log('edited');
