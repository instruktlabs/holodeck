param([switch]$Packaged,[string]$Label='editor')
$ErrorActionPreference='Stop'
if($Label -notmatch '^[a-z0-9-]+$'){throw 'Simple label required'}
$root=Split-Path -Parent $PSScriptRoot
$exe=if($Packaged){(Join-Path $env:FTT_PACKAGE_ROOT 'WeaponLab\Windows\ToolchainValidation\Binaries\Win64\ToolchainValidation.exe')}else{'C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe'}
$map=if($Packaged){'WeaponLab'}else{'RangeSliceLab'}
$log=Join-Path $root "evidence/range-v7-$Label.log";$capture=(Join-Path $root "evidence/range-v7-$Label").Replace('\','/')
$argsList=@("/Game/Qualification/$map",'-game','-unattended','-windowed','-ResX=1280','-ResY=720','-ForceRes','-NoSound','-NoTextureStreaming','-RangeExpansionTest',('-RangeExpansionCapture="'+$capture+'"'),('-abslog="'+$log+'"'))
if(-not $Packaged){$argsList=@(('"'+(Join-Path $root 'native/ToolchainValidation/ToolchainValidation.uproject')+'"'))+$argsList}
$p=Start-Process -FilePath $exe -ArgumentList $argsList -WindowStyle Hidden -PassThru
if(-not $p.WaitForExit(600000)){Stop-Process -InputObject $p;throw 'Expansion run exceeded 600 seconds'}
$p.Refresh();$content=Get-Content -LiteralPath $log -Raw
$checks=@([regex]::Matches($content,'EXPANSION_CHECK (\w+) (PASS|FAIL)')|ForEach-Object{@{name=$_.Groups[1].Value;status=$_.Groups[2].Value}})
$warnings=@([regex]::Matches($content,'[^\r\n]*(?:Default Material will be used in game|Failed to compile Material)[^\r\n]*')|ForEach-Object{$_.Value})
$result=@{exitCode=$p.ExitCode;packaged=[bool]$Packaged;map=$map;executable=$exe;executableSha256=(Get-FileHash -LiteralPath $exe).Hash;checks=$checks;materialFallbackWarnings=$warnings;performance='DIRTY';captures=@('overview','targets','gallery','paper')|ForEach-Object{"$capture-$_.png"};ok=($p.ExitCode -eq 0 -and $checks.Count -eq 9 -and $content.Contains('EXPANSION_RESULT PASS') -and $warnings.Count -eq 0)}
$result|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $root "evidence/range-v7-$Label-result.json")
if(-not $result.ok){throw "Expansion verification failed; inspect $log"}
$result|ConvertTo-Json -Depth 8
