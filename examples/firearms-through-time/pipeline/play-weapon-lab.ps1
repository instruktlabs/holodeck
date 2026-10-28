param([ValidateSet('pistol','rifle1866','boltNo4')][string]$Profile='pistol')
$ErrorActionPreference='Stop'
$exe=(Join-Path $env:FTT_PACKAGE_ROOT 'WeaponLab\Windows\ToolchainValidation\Binaries\Win64\ToolchainValidation.exe')
if(-not(Test-Path -LiteralPath $exe)){throw 'Package WeaponLab first'}
$launchArgs=@('/Game/Qualification/WeaponLab','-game','-windowed','-ResX=1280','-ResY=720','-NoTextureStreaming')
if($Profile -ne 'pistol'){$launchArgs+="-WeaponProfile=$Profile"}
Start-Process -FilePath $exe -ArgumentList $launchArgs -WindowStyle Normal
