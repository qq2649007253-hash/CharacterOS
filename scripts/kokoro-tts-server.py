from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
import json
import os
from pathlib import Path
from threading import Lock

import soundfile as sf
from kokoro_onnx import Kokoro
from misaki import zh


ROOT = Path(__file__).resolve().parents[1]
TTS_DIR = ROOT / "data" / "tts"
HOST = "127.0.0.1"
PORT = int(os.environ.get("KOKORO_TTS_PORT", "9890"))


class Runtime:
    def __init__(self) -> None:
        model = TTS_DIR / "kokoro-v1.1-zh.onnx"
        voices = TTS_DIR / "voices-v1.1-zh.bin"
        config = TTS_DIR / "config.json"
        missing = [str(path) for path in (model, voices, config) if not path.exists()]
        if missing:
            raise FileNotFoundError(f"Missing TTS files: {', '.join(missing)}. Run pnpm tts:setup first.")
        self.g2p = zh.ZHG2P(version="1.1")
        self.kokoro = Kokoro(str(model), str(voices), vocab_config=str(config))
        self.lock = Lock()

    def synthesize(self, text: str, voice: str, speed: float) -> bytes:
        if voice not in self.kokoro.get_voices():
            raise ValueError(f"Unknown voice: {voice}")
        with self.lock:
            phonemes, _ = self.g2p(text)
            samples, sample_rate = self.kokoro.create(
                phonemes,
                voice=voice,
                speed=speed,
                is_phonemes=True,
            )
        output = BytesIO()
        sf.write(output, samples, sample_rate, format="WAV")
        return output.getvalue()


RUNTIME = Runtime()


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path != "/health":
            self.send_json(404, {"error": "Not found"})
            return
        self.send_json(200, {"status": "ok", "voices": RUNTIME.kokoro.get_voices()})

    def do_POST(self) -> None:
        if self.path != "/tts":
            self.send_json(404, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length))
            text = str(payload.get("text", "")).strip()
            voice = str(payload.get("voice", ""))
            speed = float(payload.get("speed", 1.0))
            if not text or len(text) > 3000:
                raise ValueError("Text must contain 1 to 3000 characters")
            if not 0.5 <= speed <= 2.0:
                raise ValueError("Speed must be between 0.5 and 2.0")
            audio = RUNTIME.synthesize(text, voice, speed)
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(audio)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(audio)
        except (TypeError, ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error)})
        except Exception as error:
            self.send_json(500, {"error": str(error)})

    def log_message(self, format_: str, *args: object) -> None:
        print(f"[kokoro-tts] {self.address_string()} {format_ % args}")


if __name__ == "__main__":
    print(
        f"Kokoro TTS ready at http://{HOST}:{PORT} with {len(RUNTIME.kokoro.get_voices())} voices",
        flush=True,
    )
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
