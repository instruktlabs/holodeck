param()
$ErrorActionPreference='Stop'
$exe=(Join-Path $env:FTT_PACKAGE_ROOT 'RangeSliceLab\Windows\ToolchainValidation.exe')
if(-not(Test-Path -LiteralPath $exe)){throw 'Build RangeSliceLab before launching.'}
# User-facing launcher: explicit map prevents the validation project's other
# default map from being selected. No assertions or automatic exit in this mode.
Start-Process -FilePath $exe -ArgumentList @('/Game/Qualification/RangeSliceLab','-windowed','-ResX=1280','-ResY=720','-NoSound') -WindowStyle Normal
