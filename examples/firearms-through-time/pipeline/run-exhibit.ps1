param([switch]$Interactive,[switch]$Updated,[ValidateSet('ExhibitLab','TransportCaseLab')][string]$Map='ExhibitLab')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$exe=Join-Path $root 'native/PackagedValidation/Windows/ToolchainValidation/Binaries/Win64/ToolchainValidation.exe'
$runDir=Join-Path $root ('evidence/exhibit-packaged-'+[datetime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ'))
New-Item -ItemType Directory -Path $runDir | Out-Null
$capture=(Join-Path $runDir 'capture.png').Replace('\','/')
$log=Join-Path $runDir 'runtime.log'
$arguments=@("/Game/Qualification/$Map",'-windowed','-ResX=1280','-ResY=720','-ForceRes','-NoSound',('-abslog="'+$log+'"'))
if(-not $Interactive){$arguments+=@('-unattended','-ExhibitTest',('-ExhibitCapture="'+$capture+'"'))}
if($Updated){$arguments+='-ExhibitUpdated'}
if($Updated -and $Map -ne 'ExhibitLab'){throw 'Updated checks apply only to ExhibitLab'}
$launch=@{FilePath=$exe;ArgumentList=$arguments;PassThru=$true}
if(-not $Interactive){$launch.WindowStyle='Hidden'}
$p=Start-Process @launch
$receipt=[ordered]@{map=$Map;exe=$exe;exeSha256=(Get-FileHash -LiteralPath $exe).Hash;pid=$p.Id;started=$p.StartTime.ToUniversalTime().ToString('o');log=$log;capture=$capture;interactive=[bool]$Interactive;status='running'}
$receipt.content=@(Get-ChildItem -LiteralPath (Join-Path $root 'native/PackagedValidation/Windows/ToolchainValidation/Content/Paks') -File | ForEach-Object {@{name=$_.Name;sha256=(Get-FileHash -LiteralPath $_.FullName).Hash;bytes=$_.Length}})
if($Interactive){$receipt | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $runDir 'result.json');return}
try {
 if(-not $p.WaitForExit(60000)){Stop-Process -InputObject $p;throw 'Exhibit exceeded 60 seconds'}
 $p.Refresh()
 $receipt.exitCode=$p.ExitCode
 $text=Get-Content -LiteralPath $log -Raw
 $receipt.checks=@([regex]::Matches($text,'EXHIBIT_CHECK [^\r\n]+') | ForEach-Object {$_.Value})
 $expectedChecks=if($Updated){8}else{5}
 if($p.ExitCode -ne 0 -or $receipt.checks.Count -ne $expectedChecks -or $text -notmatch 'EXHIBIT_RESULT PASS' -or $text -match 'EXHIBIT_CHECK .* FAIL|Fatal error:|Assertion failed:'){throw 'Runtime interaction checks failed'}
 if(-not (Test-Path -LiteralPath $capture)){throw 'Capture missing'}
 $receipt.status='passed'
 $receipt.dx12sm6=$text -match 'Creating D3D12 RHI with Max Feature Level SM6'
 $receipt.limit='Scripted packaged gameplay methods; inspect screenshot separately. Physical keyboard focus remains a separate check.'
}catch{$receipt.status='failed';$receipt.failure=$_.Exception.Message;throw}
finally{$receipt | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $runDir 'result.json');$receipt | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $root 'evidence/exhibit-packaged-latest.json')}
$receipt | ConvertTo-Json -Depth 5
