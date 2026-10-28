param([Parameter(Mandatory)][ValidateSet('carbineM4','flintlock1742')][string]$Profile,[switch]$Packaged,[string]$Label='editor',[ValidateRange(45,900)][int]$TimeoutSeconds=600)
# WeaponLab with a held-trigger profile (round v14: Colt M4, Pattern 1742). Same flags, report and capture hooks as the bolt fixture
# (RifleLoopTest), which dispatches on the profile's action kind.
$ErrorActionPreference='Stop'
if($Label -notmatch '^[a-z0-9-]+$'){throw 'Simple label required'}
$root=Split-Path -Parent $PSScriptRoot
$name=@{carbineM4='carbine';flintlock1742='flintlock'}[$Profile]
$asset=@{carbineM4='CarbineV14/DA_CarbineM4.uasset';flintlock1742='FlintlockV14/DA_Flintlock1742.uasset'}[$Profile]
$shots=@{carbineM4=@('ready','aim','fire-held','inspect-left','inspect-right','reload-mag-out','reload-cue','charging-handle','ready-return');flintlock1742=@('ready','aim','lock','fired','inspect-left','inspect-right','drill-prime','drill-ram','ready-return')}[$Profile]
$exe=if($Packaged){(Join-Path $env:FTT_PACKAGE_ROOT 'WeaponLab\Windows\ToolchainValidation\Binaries\Win64\ToolchainValidation.exe')}else{'C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe'}
$log=Join-Path $root "evidence/$name-$Label.log"
$capture=(Join-Path $root "evidence/$name-$Label").Replace('\','/')
$report=Join-Path $root "evidence/$name-$Label-runtime.json"
$resultPath=Join-Path $root "evidence/$name-$Label-result.json"
$capturePaths=$shots|ForEach-Object{"$capture-$_.png"}
$result=@{ok=$false;status='STARTING';packaged=[bool]$Packaged;map='WeaponLab';profile=$Profile;executable=$exe;performance='DIRTY';report=$report;log=$log;captures=$capturePaths}
try{
 $result.executableSha256=(Get-FileHash -LiteralPath $exe).Hash
 if(-not $Packaged){$result.projectModuleSha256=(Get-FileHash -LiteralPath (Join-Path $root 'native/ToolchainValidation/Binaries/Win64/UnrealEditor-ToolchainValidation.dll')).Hash}
 $result.sourceHashes=@(Get-ChildItem -Path (Join-Path $root 'native/ToolchainValidation/Source/ToolchainValidation/Weapon*') -File|ForEach-Object{@{path=$_.FullName;sha256=(Get-FileHash -LiteralPath $_.FullName).Hash}})
 $result.profileAssetSha256=(Get-FileHash -LiteralPath (Join-Path $root "native/ToolchainValidation/Content/Qualification/$asset")).Hash
 $mapFile=Join-Path $root 'native/ToolchainValidation/Content/Qualification/WeaponLab.umap';$result.mapSha256=(Get-FileHash -LiteralPath $mapFile).Hash
 if($Packaged){$pakDir=Join-Path (Split-Path (Split-Path $exe -Parent) -Parent) '../Content/Paks';$result.cookedFiles=@(Get-ChildItem -LiteralPath $pakDir -File|Where-Object Extension -in '.pak','.utoc','.ucas'|ForEach-Object{@{path=$_.FullName;sha256=(Get-FileHash -LiteralPath $_.FullName).Hash}})}
 $launchArgs=@('/Game/Qualification/WeaponLab','-game','-unattended','-windowed','-ResX=1280','-ResY=720','-ForceRes','-NoSound','-NoTextureStreaming',"-WeaponProfile=$Profile",'-RifleLoopTest',('-RifleCapture="'+$capture+'"'),('-RifleReport="'+$report+'"'),('-abslog="'+$log+'"'))
 if(-not $Packaged){$launchArgs=@(('"'+(Join-Path $root 'native/ToolchainValidation/ToolchainValidation.uproject')+'"'))+$launchArgs}
 $started=Get-Date;$process=Start-Process -FilePath $exe -ArgumentList $launchArgs -WindowStyle Hidden -PassThru;$result.pid=$process.Id;$result.status='RUNNING'
 if(-not $process.WaitForExit($TimeoutSeconds*1000)){Stop-Process -InputObject $process;$result.status='TIMEOUT';throw "$Profile fixture exceeded $TimeoutSeconds seconds"}
 $process.Refresh();$result.exitCode=$process.ExitCode;$content=Get-Content -LiteralPath $log -Raw
 $result.checks=@([regex]::Matches($content,'RIFLE_CHECK (\w+) (PASS|FAIL)')|ForEach-Object{@{name=$_.Groups[1].Value;status=$_.Groups[2].Value}})
 $result.triggerFixture=([regex]::Match($content,'TRIGGER_FIXTURE ([^\r\n]+)')).Groups[1].Value
 $result.recoilFixture=([regex]::Match($content,'RECOIL_FIXTURE ([^\r\n]+)')).Groups[1].Value
 if(-not(Test-Path -LiteralPath $report) -or (Get-Item -LiteralPath $report).LastWriteTime -lt $started){throw 'Fresh runtime report missing'}
 $runtime=Get-Content -LiteralPath $report -Raw|ConvertFrom-Json;$result.reportSha256=(Get-FileHash -LiteralPath $report).Hash
 $result.capturesPresent=@($capturePaths|Where-Object{(Test-Path -LiteralPath $_) -and (Get-Item -LiteralPath $_).LastWriteTime -ge $started}).Count -eq $capturePaths.Count
 $result.materialFallbackWarnings=@([regex]::Matches($content,'[^\r\n]*(?:Default Material will be used in game|Failed to compile Material)[^\r\n]*')|ForEach-Object{$_.Value})
 $result.mapUnchanged=(Get-FileHash -LiteralPath $mapFile).Hash -eq $result.mapSha256
 $result.ok=$process.ExitCode -eq 0 -and $runtime.ok -and $result.checks.Count -ge 30 -and @($result.checks|Where-Object status -eq 'FAIL').Count -eq 0 -and $content.Contains('RIFLE_RESULT PASS') -and $result.capturesPresent -and $result.materialFallbackWarnings.Count -eq 0 -and $result.mapUnchanged
 $result.status=if($result.ok){'PASS'}else{'FAIL'};if(-not $result.ok){throw "$Profile runtime failed; inspect exact report and captures"}
}catch{$result.error=$_.Exception.Message;if($result.status -notin @('TIMEOUT','FAIL')){$result.status='ERROR'}}finally{$result|ConvertTo-Json -Depth 12|Set-Content -LiteralPath $resultPath}
$result|ConvertTo-Json -Depth 12
if(-not $result.ok){throw "$Profile verification $($result.status); evidence:$resultPath"}
