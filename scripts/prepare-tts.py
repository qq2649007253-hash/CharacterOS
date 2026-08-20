from pathlib import Path
import shutil

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
TTS_DIR = ROOT / "data" / "tts"
SOURCE_DIR = TTS_DIR / "source"
VOICE_NAMES = ("zf_001", "zf_007", "zf_027", "zf_042", "zf_059", "zf_079", "zf_099")


def main() -> None:
    voices = {}
    for name in VOICE_NAMES:
        voice_path = SOURCE_DIR / "voices" / f"{name}.bin"
        voice = np.fromfile(voice_path, dtype=np.float32)
        if voice.size % 256:
            raise ValueError(f"Invalid voice file: {voice_path}")
        voices[name] = voice.reshape(-1, 1, 256)

    TTS_DIR.mkdir(parents=True, exist_ok=True)
    with (TTS_DIR / "voices-v1.1-zh.bin").open("wb") as file:
        np.savez(file, **voices)

    shutil.move(SOURCE_DIR / "onnx" / "model.onnx", TTS_DIR / "kokoro-v1.1-zh.onnx")

    from kokoro_onnx import __file__ as package_file

    package_config = Path(package_file).with_name("config.json")
    shutil.copyfile(package_config, TTS_DIR / "config.json")
    print(f"Prepared Kokoro model with {len(voices)} distinct voices in {TTS_DIR}")


if __name__ == "__main__":
    main()
