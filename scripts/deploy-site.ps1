<#
.SYNOPSIS
  Emergency manual deploy: build the site from this clean checkout and upload it to Cloudflare Pages after release authorization.
.DESCRIPTION
  The site workflow is the normal path (docs/distribution.md). Node owns the build, every check and the exact Wrangler pin; see scripts/deploy-site.mjs.
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
