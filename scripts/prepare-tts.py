from pathlib import Path
import shutil

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
TTS_DIR = ROOT / "data" / "tts"
SOURCE_DIR = TTS_DIR / "source"
def main() -> None:
    voices = {}
    voice_paths = sorted((SOURCE_DIR / "voices").glob("zf_*.bin"))
    if len(voice_paths) < 55:
        raise ValueError(f"Expected 55 Chinese female voices, found {len(voice_paths)}")
    for voice_path in voice_paths:
        name = voice_path.stem
        voice = np.fromfile(voice_path, dtype=np.float32)
        if voice.size % 256:
            raise ValueError(f"Invalid voice file: {voice_path}")
        voices[name] = voice.reshape(-1, 1, 256)

    TTS_DIR.mkdir(parents=True, exist_ok=True)
    with (TTS_DIR / "voices-v1.1-zh.bin").open("wb") as file:
        np.savez(file, **voices)

    model_source = SOURCE_DIR / "onnx" / "model.onnx"
    model_target = TTS_DIR / "kokoro-v1.1-zh.onnx"
    if model_source.exists():
        model_source.replace(model_target)
    elif not model_target.exists():
        raise FileNotFoundError(f"Missing model file: {model_source}")

    config_source = TTS_DIR / "v1.1-config" / "config.json"
    shutil.copyfile(config_source, TTS_DIR / "config.json")
    print(f"Prepared Kokoro model with {len(voices)} selectable female voices in {TTS_DIR}")


if __name__ == "__main__":
    main()
