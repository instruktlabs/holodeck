param([switch]$SparkDiagnostic,[switch]$Packaged,[string]$Label='editor',[ValidateRange(30,900)][int]$TimeoutSeconds=600)
$ErrorActionPreference='Stop'
if($Label -notmatch '^[a-z0-9-]+$'){throw 'Simple label required'}
$root=Split-Path -Parent $PSScriptRoot
$exe=if($Packaged){(Join-Path $env:FTT_PACKAGE_ROOT 'WeaponLab\Windows\ToolchainValidation\Binaries\Win64\ToolchainValidation.exe')}else{'C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe'}
$log=Join-Path $root "evidence/range-session-$Label.log"
$capture=(Join-Path $root "evidence/range-session-$Label").Replace('\','/')
$report=Join-Path $root "evidence/range-session-$Label-runtime.json"
$resultPath=Join-Path $root "evidence/range-session-$Label-result.json"
$result=[ordered]@{ok=$false;status='NOT_STARTED';packaged=[bool]$Packaged;map='WeaponLab';executable=$exe;performance='DIRTY';report=$report;log=$log;checks=@();captures=@('paper-group','paper-docked','plates-cleared','console-current','console-archive','console-ready','steel-sparks','paper-fibers','original-puncture')|ForEach-Object{"$capture-$_.png"}}
$process=$null
try {
 if(-not(Test-Path -LiteralPath $exe)){throw "Executable missing: $exe"}
 $result.executableSha256=(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash
 if(-not $Packaged){$result.projectModuleSha256=(Get-FileHash -LiteralPath (Join-Path $root "native/ToolchainValidation/Binaries/Win64/UnrealEditor-ToolchainValidation.dll") -Algorithm SHA256).Hash}
 # Bind evidence to source and packaged containers; never infer a clean frame budget.
 $result.sourceHashes=@('RangeSession.h','RangeSession.cpp','RangePresentation.cpp','RangeRulesData.h','WeaponLoop.h','WeaponLoop.cpp')|ForEach-Object { $p=Join-Path $root "native/ToolchainValidation/Source/ToolchainValidation/$_"; @{path=$p;sha256=(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash} }
 if($Packaged){$pakDir=Join-Path (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $exe))) 'Content/Paks';$result.cookedContent=@(Get-ChildItem -LiteralPath $pakDir -File|Where-Object Extension -in '.pak','.utoc','.ucas'|ForEach-Object{@{path=$_.FullName;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash}})}
 $argsList=@('/Game/Qualification/WeaponLab','-game','-unattended','-windowed','-ResX=1280','-ResY=720','-ForceRes','-NoSound','-NoTextureStreaming','-RangeSessionTest',('-RangeSessionCapture="'+$capture+'"'),('-RangeSessionReport="'+$report+'"'),('-abslog="'+$log+'"'))
 if($SparkDiagnostic){$argsList+='-RangeSparkDiagnostic'}
 if(-not $Packaged){$argsList=@(('"'+(Join-Path $root 'native/ToolchainValidation/ToolchainValidation.uproject')+'"'))+$argsList}
 $started=Get-Date
 $process=Start-Process -FilePath $exe -ArgumentList $argsList -WindowStyle Hidden -PassThru
 $result.pid=$process.Id;$result.status='RUNNING'
 if(-not $process.WaitForExit($TimeoutSeconds*1000)){Stop-Process -InputObject $process;$result.status='TIMEOUT';throw "Range session exceeded $TimeoutSeconds seconds"}
 $process.Refresh();$result.exitCode=$process.ExitCode
 $content=Get-Content -LiteralPath $log -Raw
 $result.checks=@([regex]::Matches($content,'RANGE_SESSION_CHECK (\w+) (PASS|FAIL)')|ForEach-Object{@{name=$_.Groups[1].Value;status=$_.Groups[2].Value}})
 if(-not(Test-Path -LiteralPath $report) -or (Get-Item -LiteralPath $report).LastWriteTime -lt $started){throw 'Fresh runtime report missing'}
 $runtime=Get-Content -LiteralPath $report -Raw|ConvertFrom-Json
 $result.reportSha256=(Get-FileHash -LiteralPath $report).Hash
 $result.runtimeStatus=$runtime.status
 $result.materialFallbackWarnings=@([regex]::Matches($content,'[^\r\n]*(?:Default Material will be used in game|Failed to compile Material)[^\r\n]*')|ForEach-Object{$_.Value})
 $result.capturesPresent=@($result.captures|Where-Object{(Test-Path -LiteralPath $_) -and (Get-Item -LiteralPath $_).LastWriteTime -ge $started}).Count -eq $result.captures.Count
 $result.ok=$process.ExitCode -eq 0 -and $runtime.ok -and $result.checks.Count -ge 30 -and @($result.checks|Where-Object status -eq 'FAIL').Count -eq 0 -and $content.Contains('RANGE_SESSION_RESULT PASS') -and $result.capturesPresent -and $result.materialFallbackWarnings.Count -eq 0
 $result.status=if($result.ok){'PASS'}else{'FAIL'}
 if(-not $result.ok){throw 'Range session runtime checks failed; inspect exact report and log'}
}catch {
 $result.error=$_.Exception.Message
 if($result.status -notin @('TIMEOUT','FAIL')){$result.status='ERROR'}
}finally {
 $result|ConvertTo-Json -Depth 12|Set-Content -LiteralPath $resultPath
}
$result|ConvertTo-Json -Depth 12
if(-not $result.ok){throw "Range session verification $($result.status); evidence: $resultPath"}
