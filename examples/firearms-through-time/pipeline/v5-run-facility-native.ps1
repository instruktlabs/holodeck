param([ValidateSet('ReadOnly','Apply','Verify')][string]$Action='ReadOnly')
$ErrorActionPreference='Stop'
$previousFacilityMode=$env:FACILITY_V5_NATIVE_MODE
try {
  $env:FACILITY_V5_NATIVE_MODE=$Action.ToLowerInvariant()
  & (Join-Path $PSScriptRoot 'run-unreal-script.ps1') -Script 'pipeline/v5-facility-native.py' -Label ('v5-facility-native-'+$Action.ToLowerInvariant()) -TimeoutSeconds 600
} finally {
  $env:FACILITY_V5_NATIVE_MODE=$previousFacilityMode
}
