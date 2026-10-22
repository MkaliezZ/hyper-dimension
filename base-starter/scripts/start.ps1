param([int]$Port = 8765, [string]$HostAddress = '127.0.0.1')
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $taskRoot
$env:PYTHONPATH = Join-Path $taskRoot 'src'
$env:PYTHONUTF8 = '1'
& ./.venv/Scripts/python.exe -m base --port $Port --host $HostAddress --data (Join-Path $taskRoot 'data/base')
if ($LASTEXITCODE -ne 0) { throw '启动失败，请检查安装、端口与上方提示' }
