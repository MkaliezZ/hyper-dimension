param([switch]$Business)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $taskRoot
$env:PYTHONPATH = Join-Path $taskRoot 'src'
$env:PYTHONUTF8 = '1'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
if ($Business) { & ./.venv/Scripts/python.exe scripts/check.py --business } else { & ./.venv/Scripts/python.exe scripts/check.py }
if ($LASTEXITCODE -ne 0) { throw '自检失败，请查看上方错误' }
