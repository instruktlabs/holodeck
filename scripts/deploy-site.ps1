<#
.SYNOPSIS
  Upload the committed site/ folder to Cloudflare Pages after release authorization.
.DESCRIPTION
  Node owns every check and the exact Wrangler pin; see scripts/deploy-site.mjs.
  -DryRun performs the complete offline preflight without preparing Wrangler or uploading.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$ProjectName,
  [string]$Branch = 'main',
  [string]$Wrangler,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$arguments = @((Join-Path $PSScriptRoot 'deploy-site.mjs'), '--project-name', $ProjectName, '--branch', $Branch)
if ($Wrangler) { $arguments += @('--wrangler', $Wrangler) }
if ($DryRun) { $arguments += '--dry-run' }
& node @arguments
exit $LASTEXITCODE
