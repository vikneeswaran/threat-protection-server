Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")

python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt pyinstaller

pyinstaller --noconfirm --onedir --windowed --name KuaminiSecurityClient main.py

Write-Host "Built: dist\KuaminiSecurityClient"
