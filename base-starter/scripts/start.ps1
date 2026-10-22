param([int]$Port = 8765, [string]$HostAddress = '127.0.0.1', [string]$DataPath = 'data/base')
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $taskRoot
$env:PYTHONPATH = Join-Path $taskRoot 'src'
$env:PYTHONUTF8 = '1'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$taskData = if ([System.IO.Path]::IsPathRooted($DataPath)) { $DataPath } else { Join-Path $taskRoot $DataPath }
& ./.venv/Scripts/python.exe -m base --port $Port --host $HostAddress --data $taskData
if ($LASTEXITCODE -ne 0) { throw '启动失败，请检查安装、端口与上方提示' }
