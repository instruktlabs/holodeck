$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $root 'native\PackagedValidation\Windows\ToolchainValidation\Binaries\Win64\ToolchainValidation.exe'
$runId = 'packaged-' + [datetime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
$runDir = Join-Path $root "evidence\$runId"
New-Item -ItemType Directory -Path $runDir | Out-Null
$log = Join-Path $runDir 'runtime.log'
$capture = (Join-Path $runDir 'capture.png').Replace('\','/')
$receipt = [ordered]@{runId=$runId;exe=$exe;sha256=(Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash;started=[datetime]::UtcNow.ToString('o');log=$log;capture=$capture;status='started'}
$receipt.content = @(Get-ChildItem -LiteralPath (Join-Path $root 'native\PackagedValidation\Windows\ToolchainValidation\Content\Paks') -File | ForEach-Object { @{name=$_.Name;bytes=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash} })
$process = Start-Process -FilePath $exe -ArgumentList @('-unattended','-windowed','-ResX=1280','-ResY=720','-ForceRes','-NoSound','-benchmark','-fps=60','-seconds=20',('-ExecCmds="HighResShot 1 filename='+$capture+'"'),('-abslog="'+$log+'"')) -WindowStyle Hidden -PassThru
$receipt.pid = $process.Id
$receipt.processStarted = $process.StartTime.ToUniversalTime().ToString('o')
$receipt | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runDir 'result.json')
try {
    if (-not $process.WaitForExit(120000)) {
        # The retained Process object refers to this launch, never an arbitrary recycled PID.
        Stop-Process -InputObject $process
        throw 'Packaged validation exceeded 120 seconds.'
    }
    $receipt.exitCode = $process.ExitCode
    if ($process.ExitCode -ne 0) { throw "Packaged process failed: $($process.ExitCode)" }
    $text = Get-Content -LiteralPath $log -Raw
    $receipt.mapLoaded = $text -match 'Bringing World /Game/Qualification/ValidationMap.ValidationMap up for play'
    $receipt.dx12sm6 = $text -match 'Creating D3D12 RHI with Max Feature Level SM6'
    $receipt.captureWritten = (Test-Path -LiteralPath $capture) -and (Get-Item -LiteralPath $capture).Length -gt 1000
    $receipt.cleanShutdown = $text -match 'LogExit: Exiting\.'
    if (-not ($receipt.mapLoaded -and $receipt.dx12sm6 -and $receipt.captureWritten -and $receipt.cleanShutdown)) { throw 'Runtime postcondition failed; inspect receipt and log.' }
    if ($text -match 'Fatal error:|Assertion failed:') { throw 'Runtime reported a fatal error or assertion.' }
    $receipt.status = 'smoke-passed'
    $receipt.limit = 'Launch/map/RHI/capture/exit proof only. Image still requires inspection; no gameplay, stability or performance qualification.'
} catch {
    $receipt.status = 'failed'
    $receipt.failure = $_.Exception.Message
    throw
} finally {
    $receipt.completed = [datetime]::UtcNow.ToString('o')
    $receipt | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $runDir 'result.json')
    $receipt | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $root 'evidence\validation-packaged-latest.json')
}
$receipt | ConvertTo-Json -Depth 4
