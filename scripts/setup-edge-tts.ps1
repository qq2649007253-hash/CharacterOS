$ErrorActionPreference = 'Stop'
Push-Location (Split-Path -Parent $PSScriptRoot)
try {
  if (!(Test-Path '.venv-tts-native/Scripts/python.exe')) {
    uv python install 3.11
    uv venv --python 3.11 --managed-python .venv-tts-native
  }
  uv pip install --python '.venv-tts-native/Scripts/python.exe' 'edge-tts==7.2.8'
  if ($LASTEXITCODE -ne 0) { throw '语音依赖安装失败' }
} finally { Pop-Location }
