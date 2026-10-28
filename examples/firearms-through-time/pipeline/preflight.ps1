param([string]$EngineRoot = 'C:\Program Files\Epic Games\UE_5.8')
$ErrorActionPreference = 'Stop'
$workspaceRoot = Split-Path $PSScriptRoot -Parent
$buildFile = Join-Path $EngineRoot 'Engine\Build\Build.version'
$editor = Join-Path $EngineRoot 'Engine\Binaries\Win64\UnrealEditor.exe'
$compilerRoot = 'C:\Program Files\Microsoft Visual Studio\18\Community\VC\Tools\MSVC'
$compilers = @(Get-ChildItem -LiteralPath $compilerRoot -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $binary = Join-Path $_.FullName 'bin\Hostx64\x64\cl.exe'
    if (Test-Path -LiteralPath $binary) {
        $version = (Get-Item -LiteralPath $binary).VersionInfo
        @{folder=$_.Name;productVersion=$version.ProductVersion;fileVersion=$version.FileVersion;path=$binary}
    }
})
$manifest = Get-Content -Raw -LiteralPath (Join-Path $workspaceRoot 'authoring\.kiln\workspace.json') | ConvertFrom-Json
$engineVersion = if (Test-Path -LiteralPath $buildFile) { Get-Content -Raw -LiteralPath $buildFile | ConvertFrom-Json } else { $null }
$disk = Get-PSDrive -Name C
$report = [ordered]@{
    checkedUtc = [DateTime]::UtcNow.ToString('o')
    workspace = $workspaceRoot
    engineRoot = $EngineRoot
    editorPresent = Test-Path -LiteralPath $editor
    engineVersion = $engineVersion
    compilers = $compilers
    hasRecommendedCompiler = @($compilers | Where-Object { $_.productVersion -match '^14\.50\.(\d+)' -and [int]$Matches[1] -ge 35723 }).Count -gt 0
    kilnVersion = $manifest.runtimeVersion
    kilnRuntime = $manifest.runtime
    freeGiB = [math]::Round($disk.Free / 1GB, 2)
    ports = @{ unrealMcp = 8000; kilnRenderer = 8010 }
    qualification = 'Inventory only. Does not prove compilation, editor connectivity, rendering, import or packaging.'
}
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $workspaceRoot 'evidence\preflight.json')
$report | ConvertTo-Json -Depth 8
