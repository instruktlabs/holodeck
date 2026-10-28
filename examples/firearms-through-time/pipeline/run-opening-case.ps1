param([switch]$Packaged,[switch]$Interactive,[switch]$FullTextureResidency)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$run=Join-Path $root ('evidence/opening-case-run-'+[datetime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ'))
New-Item -ItemType Directory -Path $run|Out-Null
$log=Join-Path $run 'runtime.log';$capture=(Join-Path $run 'case').Replace('\','/')
$exe=if($Packaged){(process.env.FTT_PACKAGE_ROOT??'packages')+'/OpeningCaseLab/Windows/ToolchainValidation/Binaries/Win64/ToolchainValidation.exe'}else{'C:/Program Files/Epic Games/UE_5.8/Engine/Binaries/Win64/UnrealEditor.exe'}
$arguments=@()
if(-not $Packaged){$arguments+=('"'+(Join-Path $root 'native/ToolchainValidation/ToolchainValidation.uproject')+'"')}
$arguments+=@('/Game/Qualification/OpeningCaseLab','-game','-windowed','-ResX=1280','-ResY=720','-ForceRes','-NoSound',('-abslog="'+$log+'"'))
if($FullTextureResidency){$arguments+='-NoTextureStreaming'}
if(-not $Interactive){$arguments+=@('-unattended','-OpeningCaseTest',('-OpeningCaseCapture="'+$capture+'"'))}
$launch=@{FilePath=$exe;ArgumentList=$arguments;PassThru=$true};if(-not $Interactive){$launch.WindowStyle='Hidden'}
$p=Start-Process @launch
$receipt=[ordered]@{map='OpeningCaseLab';packaged=[bool]$Packaged;exe=$exe;exeSha256=(Get-FileHash -LiteralPath $exe).Hash;pid=$p.Id;started=$p.StartTime.ToUniversalTime().ToString('o');log=$log;captures=@('closed','mid','open'|ForEach-Object{"$capture-$_.png"});status='running'}
$receipt.fullTextureResidency=[bool]$FullTextureResidency
if($Packaged){$receipt.content=@(Get-ChildItem -LiteralPath (process.env.FTT_PACKAGE_ROOT??'packages')+'/OpeningCaseLab/Windows/ToolchainValidation/Content/Paks' -File|ForEach-Object{@{name=$_.Name;bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName).Hash}})}
if($Interactive){$receipt|ConvertTo-Json -Depth 5|Set-Content (Join-Path $run 'result.json');return}
if(-not $p.WaitForExit(180000)){Stop-Process -InputObject $p;throw 'Case test startup and shutdown exceeded 180 seconds'}
$p.Refresh();$text=Get-Content -LiteralPath $log -Raw
$receipt.exitCode=$p.ExitCode;$receipt.checks=@([regex]::Matches($text,'CASE_CHECK [^\r\n]+')|ForEach-Object{$_.Value});$receipt.dx12sm6=$text -match 'Creating D3D12 RHI with Max Feature Level SM6'
$receipt.status=if($p.ExitCode -eq 0 -and $receipt.checks.Count -eq 9 -and $text -match 'CASE_RESULT PASS' -and $text -notmatch 'CASE_CHECK .* FAIL|Fatal error:' -and @($receipt.captures|Where-Object{-not(Test-Path -LiteralPath $_)}).Count -eq 0){'passed'}else{'failed'}
$receipt|ConvertTo-Json -Depth 5|Set-Content (Join-Path $run 'result.json');$receipt|ConvertTo-Json -Depth 5|Set-Content (Join-Path $root ('evidence/opening-case-'+$(if($Packaged){'packaged'}else{'editor-game'})+'-latest.json'))
if($receipt.status -ne 'passed'){throw "Case checks failed; inspect $log"}
$receipt|ConvertTo-Json -Depth 5
