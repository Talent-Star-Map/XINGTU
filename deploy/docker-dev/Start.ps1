$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$accessRoot = Join-Path $env:USERPROFILE '.xingtu-access'
& (Join-Path $accessRoot 'XingtuAccess.ps1') -Action Connect
$python = Join-Path $accessRoot 'venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $python)) { $python = Join-Path $repoRoot 'backend\venv\Scripts\python.exe' }
& $python (Join-Path $PSScriptRoot 'prepare_env.py')
if ($LASTEXITCODE -ne 0) { throw 'Could not prepare cloud database configuration.' }
& docker compose -f (Join-Path $PSScriptRoot 'compose.yaml') up -d --build
if ($LASTEXITCODE -ne 0) { throw 'Development containers failed to start.' }
Write-Host 'Web: http://localhost:3000  API: http://localhost:8082/docs'
