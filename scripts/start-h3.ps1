$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$comfyRoot = Resolve-Path (Join-Path $projectRoot '..\ComfyUI_H3')
$pythonPath = Join-Path $comfyRoot '.venv\Scripts\python.exe'
$mainPath = Join-Path $comfyRoot 'main.py'

if (-not (Test-Path -LiteralPath $pythonPath)) {
  throw "H3 Python environment not found: $pythonPath"
}
if (-not (Test-Path -LiteralPath $mainPath)) {
  throw "ComfyUI main.py not found: $mainPath"
}

Write-Host 'Starting MiniMax H3 emotion service at http://127.0.0.1:8188'
Write-Host 'RTX 5060 8GB mode: lowvram + disable-pinned-memory'
& $pythonPath $mainPath --lowvram --disable-pinned-memory --listen 127.0.0.1 --port 8188
