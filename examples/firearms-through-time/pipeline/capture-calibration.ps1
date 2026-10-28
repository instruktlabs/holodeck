param([double]$EV=0,[ValidateSet('CalibrationMap','ExhibitLab','TransportCaseLab','MaterialDiagnostics','MaterialProbeLab','MaterialLibraryLab','ProceduralWoodLab','WoodLightControlLab','NaturalWoodLab')][string]$Map='CalibrationMap',[string]$Label='baseline',[double]$ProbeDistance=0,[switch]$FullTextureResidency)
$ErrorActionPreference='Stop'
if($Label -notmatch '^[a-z0-9-]+$'){throw 'Use a simple label'}
$root=Split-Path $PSScriptRoot -Parent
$exe='C:/Program Files/Epic Games/UE_5.8/Engine/Binaries/Win64/UnrealEditor.exe'
$project=Join-Path $root 'native/ToolchainValidation/ToolchainValidation.uproject'
$capture=(Join-Path $root "evidence/calibration-native-$Label.png").Replace('\','/')
$log=Join-Path $root "evidence/calibration-native-$Label.log"
if($ProbeDistance -ne 0 -and ($Map -ne 'MaterialProbeLab' -or $ProbeDistance -lt .5 -or $ProbeDistance -gt 20)){throw 'Distance control is bounded to the material probe'}
$textureFlag=if($FullTextureResidency){'-NoTextureStreaming'}else{'-NoSplash'}
$p=Start-Process -FilePath $exe -WindowStyle Hidden -PassThru -ArgumentList @(('"'+$project+'"'),"/Game/Qualification/$Map",'-game','-unattended','-windowed','-ResX=1280','-ResY=720','-ForceRes','-NoSound',$textureFlag,'-CalibrationCapture',"-CalibrationEV=$EV","-ProbeDistance=$ProbeDistance",('-ExhibitCapture="'+$capture+'"'),('-abslog="'+$log+'"'))
if(-not $p.WaitForExit(180000)){Stop-Process -InputObject $p;throw 'Capture startup and shutdown exceeded 180 seconds'}
if($p.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $capture)){throw "Capture failed: $($p.ExitCode)"}
$captureLog=Get-Content -LiteralPath $log -Raw
$fallbackWarnings=@([regex]::Matches($captureLog,'[^\r\n]*(?:Default Material will be used in game|Failed to compile Material)[^\r\n]*')|ForEach-Object{$_.Value})
@{label=$Label;ev=$EV;map=$Map;capture=$capture;exitCode=$p.ExitCode;log=$log;fullTextureResidency=[bool]$FullTextureResidency;materialFallbackWarnings=$fallbackWarnings;status=$(if($fallbackWarnings.Count){'invalid-material-fallback'}else{'captured'})} | ConvertTo-Json | Set-Content (Join-Path $root "evidence/calibration-native-$Label.json")
if($fallbackWarnings.Count){throw 'Capture contains a reported material fallback; inspect the image and repair before comparing lighting'}
