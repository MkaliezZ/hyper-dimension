$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $taskRoot
$env:PYTHONPATH = Join-Path $taskRoot 'src'
$env:PYTHONUTF8 = '1'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
& ./.venv/Scripts/python.exe scripts/verify.py
if ($LASTEXITCODE -ne 0) { throw '业务验证失败，请按上方提示检查' }
