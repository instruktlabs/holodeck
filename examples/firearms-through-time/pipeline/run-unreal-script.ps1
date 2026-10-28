param([Parameter(Mandatory)][string]$Script,[Parameter(Mandatory)][string]$Label,[ValidateRange(30,600)][int]$TimeoutSeconds=300,[switch]$UseGPU)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$path=(Resolve-Path -LiteralPath (Join-Path $root $Script)).Path
if(-not $path.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase) -or $Label -notmatch '^[a-z0-9-]+$'){throw 'Use a workspace script and simple label'}
$log=Join-Path $root "evidence/$Label.log"
$engineArgs=@(('"'+(Join-Path $root 'native/ToolchainValidation/ToolchainValidation.uproject')+'"'),'-unattended','-NoSound','-NoSplash','-nop4',('-ExecutePythonScript="'+$path+'"'),('-abslog="'+$log+'"'))
if(-not $UseGPU){$engineArgs+='-nullrhi'}
$p=Start-Process -FilePath 'C:/Program Files/Epic Games/UE_5.8/Engine/Binaries/Win64/UnrealEditor-Cmd.exe' -WindowStyle Hidden -PassThru -ArgumentList $engineArgs
if(-not $p.WaitForExit($TimeoutSeconds*1000)){Stop-Process -InputObject $p;throw "Engine startup, script, and shutdown exceeded $TimeoutSeconds seconds; inspect checkpoint receipts before retrying mutations"}
$p.Refresh()
if($p.ExitCode -ne 0 -or (Get-Content -LiteralPath $log -Raw) -match 'LogPython: Error:|Fatal error:'){throw "Unreal script failed; inspect $log"}
@{script=$path;exitCode=$p.ExitCode;log=$log}|ConvertTo-Json
