$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $taskRoot
$env:PYTHONPATH = Join-Path $taskRoot 'src'
& ./.venv/Scripts/python.exe scripts/check.py
if ($LASTEXITCODE -ne 0) { throw '自检失败，请查看上方错误' }
