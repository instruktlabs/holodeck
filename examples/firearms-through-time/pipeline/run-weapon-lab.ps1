param([switch]$Packaged,[string]$Label='editor',[ValidateRange(30,900)][int]$TimeoutSeconds=600)
$ErrorActionPreference='Stop'
if($Label -notmatch '^[a-z0-9-]+$'){throw 'Simple label required'}
$root=Split-Path -Parent $PSScriptRoot
$exe=if($Packaged){(Join-Path $env:FTT_PACKAGE_ROOT 'WeaponLab\Windows\ToolchainValidation\Binaries\Win64\ToolchainValidation.exe')}else{'C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe'}
$log=Join-Path $root "evidence/weapon-$Label.log";$capture=(Join-Path $root "evidence/weapon-$Label").Replace('\','/')
$argsList=@('/Game/Qualification/WeaponLab','-game','-unattended','-windowed','-ResX=1280','-ResY=720','-ForceRes','-NoSound','-NoTextureStreaming','-WeaponLoopTest',('-WeaponCapture="'+$capture+'"'),('-abslog="'+$log+'"'))
if(-not $Packaged){$argsList=@(('"'+(Join-Path $root 'native/ToolchainValidation/ToolchainValidation.uproject')+'"'))+$argsList}
$p=Start-Process -FilePath $exe -ArgumentList $argsList -WindowStyle Hidden -PassThru
if(-not $p.WaitForExit($TimeoutSeconds*1000)){Stop-Process -InputObject $p;throw "Weapon startup/run/shutdown exceeded $TimeoutSeconds seconds"}
$p.Refresh();$content=Get-Content -LiteralPath $log -Raw
$checks=@([regex]::Matches($content,'WEAPON_CHECK (\w+) (PASS|FAIL)')|ForEach-Object{@{name=$_.Groups[1].Value;status=$_.Groups[2].Value}})
$result=@{exitCode=$p.ExitCode;packaged=[bool]$Packaged;executable=$exe;sha256=(Get-FileHash -LiteralPath $exe).Hash;checks=$checks;ok=($p.ExitCode -eq 0 -and $checks.Count -ge 34 -and @($checks|Where-Object status -eq 'FAIL').Count -eq 0 -and $content.Contains('WEAPON_RESULT PASS'))}
$result|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $root "evidence/weapon-$Label-result.json")
if(-not $result.ok){throw "Weapon verification failed; inspect $log"}
$result|ConvertTo-Json -Depth 8


