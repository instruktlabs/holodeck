param([ValidateSet('Editor','Package')][string]$Target = 'Editor', [ValidateSet('ValidationMap','ExhibitLab','TransportCaseLab','OpeningCaseLab','RangeSliceLab','WeaponLab')][string]$Map = 'ValidationMap',[ValidateRange(40,100)][int]$MinimumFreeGiB=50)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$project = Join-Path $root 'native\ToolchainValidation\ToolchainValidation.uproject'
$batch = 'C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles'
$freeBefore=(Get-PSDrive C).Free
if ($freeBefore -lt ($MinimumFreeGiB*1GB)) { throw "C: has less than $MinimumFreeGiB GiB working headroom." }
$started = [datetime]::UtcNow
$log = Join-Path $root "evidence\validation-build-$($Target.ToLower()).log"
if ($Target -eq 'Editor') {
    & (Join-Path $batch 'Build.bat') ToolchainValidationEditor Win64 Development "-Project=$project" '-WaitMutex' '-NoHotReloadFromIDE' '-MaxParallelActions=1' '-CompilerVersion=14.50.35737' '-NoUBA' 2>&1 | Tee-Object -FilePath $log
} else {
    # Compile targets separately for clear failure boundaries before cooking.
    # UE 5.8 still selected local UBA for the game despite NoUBA; inspect logs.
    foreach($name in @('ToolchainValidationEditor','ToolchainValidation')){
        & (Join-Path $batch 'Build.bat') $name Win64 Development "-Project=$project" '-WaitMutex' '-NoHotReloadFromIDE' '-MaxParallelActions=1' '-CompilerVersion=14.50.35737' '-NoUBA' 2>&1 | Tee-Object -FilePath $log -Append
        if($LASTEXITCODE -ne 0){throw "Target $name failed"}
    }
    $archive=if($Map -in @('OpeningCaseLab','RangeSliceLab','WeaponLab')){"$env:FTT_PACKAGE_ROOT\$Map"}else{"$root\native\PackagedValidation"}
    & (Join-Path $batch 'RunUAT.bat') BuildCookRun "-project=$project" '-noP4' '-unattended' '-platform=Win64' '-clientconfig=Development' '-skipbuild' '-cook' "-map=/Game/Qualification/$Map" '-stage' '-pak' '-archive' "-archivedirectory=$archive" '-utf8output' 2>&1 | Tee-Object -FilePath $log -Append
}
$resultCode = $LASTEXITCODE
@{target=$Target;map=$Map;minimumFreeGiB=$MinimumFreeGiB;freeBefore=$freeBefore;freeAfter=(Get-PSDrive C).Free;started=$started.ToString('o');completed=[datetime]::UtcNow.ToString('o');exitCode=$resultCode;log=$log;project=$project} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root "evidence\validation-build-$($Target.ToLower())-result.json")
if ($resultCode -ne 0) { throw "Validation $Target failed with exit code $resultCode; see $log" }
