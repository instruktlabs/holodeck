# Invoke from the shared project root to keep Kiln separate from Unreal's port 8000.
$ErrorActionPreference = 'Stop'
$workspaceRoot = Split-Path $PSScriptRoot -Parent
$oldPort = $env:KILN_RENDER_SERVICE_PORT
$oldUrl = $env:KILN_RENDER_PORT_URL
try {
    $env:KILN_RENDER_SERVICE_PORT = '8010'
    $env:KILN_RENDER_PORT_URL = 'http://127.0.0.1:8010'
    & node (Join-Path $workspaceRoot 'authoring\kiln.mjs') @args
    $resultCode = $LASTEXITCODE
} finally {
    $env:KILN_RENDER_SERVICE_PORT = $oldPort
    $env:KILN_RENDER_PORT_URL = $oldUrl
}
exit $resultCode
