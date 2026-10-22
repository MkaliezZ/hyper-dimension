param([string]$PythonPath = 'python')
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $taskRoot
& $PythonPath -c "import sys; assert sys.version_info >= (3,11), 'Need Python 3.11+'"
if ($LASTEXITCODE -ne 0) { throw '需要 Python 3.11 或以上版本' }
if (-not (Test-Path -LiteralPath '.venv/Scripts/python.exe')) { & $PythonPath -m venv .venv; if ($LASTEXITCODE -ne 0) { throw '虚拟环境创建失败' } }
& ./.venv/Scripts/python.exe -m pip install -r requirements.lock
if ($LASTEXITCODE -ne 0) { throw '依赖安装失败，请检查网络后重新安装' }
Write-Output '安装完成。下一步运行 scripts/start.ps1。'
