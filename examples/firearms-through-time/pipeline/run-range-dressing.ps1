param([switch]$Packaged,[string]$Label='editor',[ValidateRange(45,900)][int]$TimeoutSeconds=600)
# WeaponLab expansion run with the range-dressing-v1 checks: the nine v7 checks plus four dressing checks and a service capture.
$ErrorActionPreference='Stop'
if($Label -notmatch '^[a-z0-9-]+$'){throw 'Simple label required'}
$root=Split-Path -Parent $PSScriptRoot
$exe=if($Packaged){(Join-Path $env:FTT_PACKAGE_ROOT 'WeaponLab\Windows\ToolchainValidation\Binaries\Win64\ToolchainValidation.exe')}else{'C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe'}
$log=Join-Path $root "evidence/range-dressing-v1-$Label.log";$capture=(Join-Path $root "evidence/range-dressing-v1-$Label").Replace('\','/')
$argsList=@('/Game/Qualification/WeaponLab','-game','-unattended','-windowed','-ResX=1280','-ResY=720','-ForceRes','-NoSound','-NoTextureStreaming','-RangeExpansionTest','-RangeDressingTest',('-RangeExpansionCapture="'+$capture+'"'),('-abslog="'+$log+'"'))
if(-not $Packaged){$argsList=@(('"'+(Join-Path $root 'native/ToolchainValidation/ToolchainValidation.uproject')+'"'))+$argsList}
$started=Get-Date;$p=Start-Process -FilePath $exe -ArgumentList $argsList -WindowStyle Hidden -PassThru
if(-not $p.WaitForExit($TimeoutSeconds*1000)){Stop-Process -InputObject $p;throw "Dressing run exceeded $TimeoutSeconds seconds"}
$p.Refresh();$content=Get-Content -LiteralPath $log -Raw
$checks=@([regex]::Matches($content,'EXPANSION_CHECK (\w+) (PASS|FAIL)')|ForEach-Object{@{name=$_.Groups[1].Value;status=$_.Groups[2].Value}})
$warnings=@([regex]::Matches($content,'[^\r\n]*(?:Default Material will be used in game|Failed to compile Material)[^\r\n]*')|ForEach-Object{$_.Value})
$captures=@('overview','targets','gallery','paper','service')|ForEach-Object{"$capture-$_.png"}
$fresh=@($captures|Where-Object{(Test-Path -LiteralPath $_) -and (Get-Item -LiteralPath $_).LastWriteTime -ge $started}).Count -eq $captures.Count
$result=@{exitCode=$p.ExitCode;packaged=[bool]$Packaged;map='WeaponLab';executable=$exe;executableSha256=(Get-FileHash -LiteralPath $exe).Hash;checks=$checks;materialFallbackWarnings=$warnings;performance='DIRTY';captures=$captures;capturesPresent=$fresh;ok=($p.ExitCode -eq 0 -and $checks.Count -eq 13 -and @($checks|Where-Object status -eq 'FAIL').Count -eq 0 -and $content.Contains('EXPANSION_RESULT PASS') -and $warnings.Count -eq 0 -and $fresh)}
$result|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $root "evidence/range-dressing-v1-$Label-result.json")
if(-not $result.ok){throw "Dressing verification failed; inspect $log"}
$result|ConvertTo-Json -Depth 8
