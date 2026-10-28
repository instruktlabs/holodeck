param([switch]$Negative)
# Compile the header-only native trigger, rules and recoil (WeaponTrigger*.h, WeaponRecoil*.h) outside Unreal with MSVC and a minimal
# stand-in for CoreMinimal.h (pipeline/native-shim), and replay game/trigger-fixtures-v1.json. -Negative also proves the replay catches one
# deliberate fault each in copies of the headers; the real headers are never modified. Writes evidence/m4-1742-v14/native-trigger-standalone.txt.
# The engine build still has the last word: this checks the logic, not Unreal's own types or compiler settings.
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$source=Join-Path $root 'native\ToolchainValidation\Source\ToolchainValidation'
$headers='WeaponTrigger.h','WeaponTriggerData.h','WeaponTriggerFixture.h','WeaponRecoil.h','WeaponRecoilData.h'
$vs=& "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -property installationPath
$vcvars=Join-Path $vs 'VC\Auxiliary\Build\vcvars64.bat'
if(-not(Test-Path -LiteralPath $vcvars)){throw 'MSVC (vcvars64.bat) not found'}
function Invoke-Replay([string]$Dir){
 Copy-Item -LiteralPath (Join-Path $root 'pipeline\native-shim\trigger-replay-main.cpp') -Destination $Dir
 $out=cmd /c "`"$vcvars`" >nul 2>&1 && cd /d `"$Dir`" && cl /nologo /std:c++20 /EHsc /O2 /fp:precise /W3 /w14456 /w14457 /w14458 /w14459 /we4456 /we4457 /we4458 /we4459 /I `"$root\pipeline\native-shim`" /I . trigger-replay-main.cpp /Fe:replay.exe >compile.txt 2>&1 && .\replay.exe" 2>&1
 @{exit=$LASTEXITCODE;output=($out -join "`n").Trim();compile=(Get-Content -LiteralPath (Join-Path $Dir 'compile.txt') -Raw -ErrorAction SilentlyContinue)}
}
$faults=@(
 @('burst cam resets on release','WeaponTrigger.h','if(!Latched)Engaged=false;','if(!Latched){Engaged=false;Cam=0;}'),
 @('burst runs on past three rounds','WeaponTrigger.h','T.Engaged=T.Down&&T.Cam!=0;','T.Engaged=T.Down;'),
 @('cycle ignored: rounds leave together','WeaponTrigger.h','T.ReadyAt=E.At+F.CycleSeconds;','T.ReadyAt=E.At;'),
 @('flintlock fires on the pull (no ignition delay)','WeaponTrigger.h','T.Pending.Add(E.At+F.IgnitionDelaySeconds);','T.Pending.Add(E.At);'),
 @('events handled at the frame start','WeaponTrigger.h','Advance(E.In);Left=FMath::Max(0.,Left-E.In);','Left=FMath::Max(0.,Left-E.In);'),
 @('a round ignores the kick turned earlier in its frame','WeaponTrigger.h','Act(E.Type,Turn)==true','Act(E.Type,FVector2D::ZeroVector)==true'),
 @('an empty reload takes the standard clip','WeaponTrigger.h','EmptyReload=Rules->ReloadEmpty>0&&!Ammo;','EmptyReload=false;'),
 @('the magazine seats at the end, not at its commit phase','WeaponTrigger.h','Rules->Policy!=EReload::AtEnd&&!ReloadCommitted','Rules->Policy==EReload::AtEnd&&!ReloadCommitted')
)
$lines=@();$caught=0;$work=Join-Path ([IO.Path]::GetTempPath()) ('trigger-native-'+[guid]::NewGuid().ToString('N'))
try{
 New-Item -ItemType Directory -Path $work|Out-Null
 foreach($h in $headers){Copy-Item -LiteralPath (Join-Path $source $h) -Destination $work}
 $base=Invoke-Replay $work
 if($base.exit -ne 0 -or -not $base.output.StartsWith('PASS')){throw "Native trigger replay failed: $($base.output) $($base.compile)"}
 $lines+="Real headers: $($base.output)"
 if($Negative){foreach($f in $faults){
  $dir=Join-Path $work ('fault-'+$caught+'-'+$lines.Count);New-Item -ItemType Directory -Path $dir|Out-Null
  foreach($h in $headers){Copy-Item -LiteralPath (Join-Path $source $h) -Destination $dir}
  $file=Join-Path $dir $f[1];$text=[IO.File]::ReadAllText($file)
  if(($text.Split([string[]]@($f[2]),[StringSplitOptions]::None)).Count -ne 2){throw "Fault anchor not found: $($f[0])"}
  [IO.File]::WriteAllText($file,$text.Replace($f[2],$f[3]))
  $r=Invoke-Replay $dir
  if(-not (Test-Path -LiteralPath (Join-Path $dir 'replay.exe'))){throw "Fault build failed: $($f[0]) $($r.compile)"}
  $hit=$r.exit -ne 0 -and $r.output.StartsWith('FAIL');if($hit){$caught++}
  $lines+=('{0}  {1} ({2}): {3}' -f ($(if($hit){'CAUGHT'}else{'MISSED'})),$f[0],$f[1],$r.output)
 }}
}finally{Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue}
$cl=(Get-ChildItem (Join-Path $vs 'VC\Tools\MSVC') -Directory|Sort-Object Name|Select-Object -Last 1).Name
$report="Native trigger standalone check ($([datetime]::Now.ToString('yyyy-MM-dd'))): $($headers -join ', ') compiled with MSVC $cl and pipeline/native-shim/CoreMinimal.h`n`n$($lines -join "`n")`n"
if($Negative){$report+="`n$caught/$($faults.Count) faults caught`n"}
New-Item -ItemType Directory -Force -Path (Join-Path $root 'evidence\m4-1742-v14')|Out-Null
Set-Content -LiteralPath (Join-Path $root 'evidence\m4-1742-v14\native-trigger-standalone.txt') -Value $report -Encoding utf8
$report
if($Negative -and $caught -ne $faults.Count){exit 1}
exit 0
