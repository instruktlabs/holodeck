// Mouse-and-keyboard parity with the browser (owner request, 27 Oct): hold the right mouse button to aim (Q still toggles),
// left mouse fires, and the game viewport captures and hides the cursor explicitly. Backups: evidence/sight-v12/native-source-before/*.before-controls.*
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'../native/ToolchainValidation/Source/ToolchainValidation');
function edit(f,pairs){const file=path.join(dir,f);const raw=fs.readFileSync(file,'utf8'),eol=raw.includes('\r\n')?'\r\n':'\n';let s=raw.replace(/\r\n/g,'\n');for(const [a,b] of pairs){if(s.split(a).length!==2)throw Error(f+' needs exactly one '+a.slice(0,80));s=s.replace(a,b);}fs.writeFileSync(file,s.replace(/\n/g,eol));}
edit('WeaponLoop.h',[[' float BaseFov=80,FrontSightWidthCm=0,LastGhostAim=0,LastFovDeg=0;\n',' float BaseFov=80,FrontSightWidthCm=0,LastGhostAim=0,LastFovDeg=0;\n // Hold-to-aim on the right mouse button: 1 while held, 2 after release until aim drops, 0 otherwise.\n int32 HoldAimState=0;\n']]);
edit('WeaponLoop.cpp',[
 ['if(PC->WasInputKeyJustPressed(EKeys::Q)||PC->WasInputKeyJustPressed(EKeys::RightMouseButton))Action(TEXT("aim"));',
  'if(PC->WasInputKeyJustPressed(EKeys::Q))Action(TEXT("aim"));if(PC->WasInputKeyJustPressed(EKeys::RightMouseButton))HoldAimState=1;if(PC->WasInputKeyJustReleased(EKeys::RightMouseButton)&&HoldAimState==1)HoldAimState=2;if(HoldAimState==1&&!Aim)Action(TEXT("aim"));else if(HoldAimState==2){if(Aim)Action(TEXT("aim"));if(!Aim)HoldAimState=0;}'],
 ['void AWeaponLoop::BeginPlay(){Super::BeginPlay();Testing=FParse::Param(FCommandLine::Get(),TEXT("WeaponLoopTest"));RifleTesting=FParse::Param(FCommandLine::Get(),TEXT("RifleLoopTest"));',
  'void AWeaponLoop::BeginPlay(){Super::BeginPlay();Testing=FParse::Param(FCommandLine::Get(),TEXT("WeaponLoopTest"));RifleTesting=FParse::Param(FCommandLine::Get(),TEXT("RifleLoopTest"));\n if(auto* PC=UGameplayStatics::GetPlayerController(this,0)){PC->SetInputMode(FInputModeGameOnly());PC->bShowMouseCursor=false;}\n'],
 ['TEXT("I Inspect | Q / RMB Aim | F / LMB Fire | R Load rounds | WASD M','TEXT("I Inspect | Q toggle / hold RMB Aim | F / LMB Fire | R Load rounds | WASD M'],
 ['TEXT("I Inspect | Q / RMB Aim | F / LMB Fire | R Reload | C Grips | W','TEXT("I Inspect | Q toggle / hold RMB Aim | F / LMB Fire | R Reload | C Grips | W']]);
console.log('edited');
