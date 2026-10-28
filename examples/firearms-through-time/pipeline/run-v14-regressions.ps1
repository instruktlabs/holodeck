param([switch]$Packaged,[string]$Label='v14-editor')
# Round v14 regressions: the pistol, 1866, No.4, range session, range dressing and range v7 fixtures, one after another, after the
# held-trigger runtime changes. Each runner writes its own result; this prints one line per fixture and fails if any did.
$ErrorActionPreference='Stop'
if($Label -notmatch '^[a-z0-9-]+$'){throw 'Simple label required'}
$root=Split-Path -Parent $PSScriptRoot
$runs=@(@{script='run-weapon-lab';result="weapon-$Label-result.json"},@{script='run-rifle-lab';result="rifle-$Label-result.json"},@{script='run-bolt-lab';result="bolt-$Label-result.json"},@{script='run-range-session';result="range-session-$Label-result.json"},@{script='run-range-dressing';result="range-dressing-v1-$Label-result.json"},@{script='run-range-expansion';result="range-v7-$Label-result.json"})
$rows=foreach($run in $runs){
 $failure=$null;try{$arguments=@{Label=$Label};if($Packaged){$arguments.Packaged=$true};& (Join-Path $PSScriptRoot "$($run.script).ps1") @arguments|Out-Null}catch{$failure=$_.Exception.Message}
 $path=Join-Path $root "evidence/$($run.result)";$r=if(Test-Path -LiteralPath $path){Get-Content -LiteralPath $path -Raw|ConvertFrom-Json}else{$null}
 $checks=@($r.checks);[pscustomobject]@{fixture=$run.script;ok=[bool]($r.ok -and -not $failure);checks=$checks.Count;failed=(@($checks|Where-Object status -eq 'FAIL'|ForEach-Object name) -join ',');fallbacks=if($r.PSObject.Properties.Name -contains 'materialFallbackWarnings'){@($r.materialFallbackWarnings).Count}else{'not tracked'};error=$failure}
}
$rows|Format-Table -AutoSize|Out-String -Width 220
if(@($rows|Where-Object{-not $_.ok -or $_.failed}).Count){throw 'A regression fixture did not pass'}
