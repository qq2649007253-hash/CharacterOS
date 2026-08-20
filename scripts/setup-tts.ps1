$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
  uv python install 3.11
  uv venv --python 3.11 --managed-python .venv-tts-native
  uv pip install --python ".venv-tts-native\Scripts\python.exe" `
    "kokoro-onnx==0.6.1" `
    "misaki-fork[zh]==0.9.6" `
    "onnxruntime==1.23.2" `
    "soundfile==0.14.0" `
    "modelscope==1.39.1"

  $modelId = "onnx-community/Kokoro-82M-v1.1-zh-ONNX"
  $files = @(
    "onnx/model.onnx",
    "voices/zf_001.bin",
    "voices/zf_007.bin",
    "voices/zf_027.bin",
    "voices/zf_042.bin",
    "voices/zf_059.bin",
    "voices/zf_079.bin",
    "voices/zf_099.bin"
  )
  & ".venv-tts-native\Scripts\modelscope.exe" download $modelId @files --local-dir "data\tts\source"
  & ".venv-tts-native\Scripts\modelscope.exe" download `
    "hexgrad/Kokoro-82M-v1.1-zh" `
    "config.json" `
    --local-dir "data\tts\v1.1-config"
  & ".venv-tts-native\Scripts\python.exe" "scripts\prepare-tts.py"
} finally {
  Pop-Location
}
