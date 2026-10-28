param([ValidateSet('Start','Stop','Status')][string]$Action = 'Status')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$editor = 'C:\Program Files\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor.exe'
$project = Join-Path $root 'native\ToolchainValidation\ToolchainValidation.uproject'
$receiptPath = Join-Path $root 'evidence\validation-editor-process.json'
$owned = $null
if (Test-Path -LiteralPath $receiptPath) {
    $receipt = Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json
    $candidate = Get-Process -Id $receipt.pid -ErrorAction SilentlyContinue
    if ($candidate -and $candidate.Path -eq $editor -and $candidate.StartTime.ToUniversalTime() -eq ([datetime]$receipt.started).ToUniversalTime()) {
        $command = (Get-CimInstance Win32_Process -Filter "ProcessId = $($candidate.Id)").CommandLine
        if ($command -like "*$project*") { $owned = $candidate }
    }
}
if ($Action -eq 'Stop') {
    if (-not $owned) { throw 'No matching owned validation editor; refusing to stop another process.' }
    # Use only after saving needed work and stopping PIE. This is a forced process stop.
    Stop-Process -InputObject $owned
    return
}
if ($Action -eq 'Start' -and -not $owned) {
    if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 8000 is occupied; refusing to start a second Unreal endpoint.' }
    if ((Get-PSDrive C).Free -lt 50GB) { throw 'Less than 50 GiB workspace headroom on C:.' }
    $log = Join-Path $root 'evidence\validation-editor.log'
    $owned = Start-Process -FilePath $editor -ArgumentList @(('"'+$project+'"'), '-unattended','-nosplash','-nop4','-NoSound','-ModelContextProtocolStartServer',('-abslog="'+$log+'"')) -WindowStyle Hidden -PassThru
    @{pid=$owned.Id;started=$owned.StartTime.ToUniversalTime().ToString('o');project=$project;log=$log} | ConvertTo-Json | Set-Content -LiteralPath $receiptPath
}
@{ownedProcess=if($owned){$owned.Id}else{$null}; listening=@(Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,OwningProcess); note='Socket readiness alone is not a live MCP or project-identity check.'} | ConvertTo-Json -Depth 3
