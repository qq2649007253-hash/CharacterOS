"""Loopback bridge to Microsoft's online speech service; no API key required."""
import asyncio
import json
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import BoundedSemaphore
import edge_tts

VOICES = ['zh-CN-XiaoxiaoNeural', 'zh-CN-XiaoyiNeural', 'zh-TW-HsiaoChenNeural']
CAPACITY = BoundedSemaphore(3)

async def synthesize(text, voice, rate):
    audio = bytearray()
    async for chunk in edge_tts.Communicate(text, voice, rate=rate).stream():
        if chunk['type'] == 'audio':
            audio.extend(chunk['data'])
    if len(audio) < 100:
        raise ValueError('未收到完整音频')
    return bytes(audio)

class Handler(BaseHTTPRequestHandler):
    def send_body(self, status, body, content_type='application/json; charset=utf-8'):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def error(self, status, message):
        self.send_body(status, json.dumps({'error': message}, ensure_ascii=False).encode())

    def do_GET(self):
        if self.path != '/health':
            self.error(404, '接口不存在'); return
        self.send_body(200, json.dumps({'status': 'ready', 'provider': 'edge-online', 'onlineRequired': True, 'voices': VOICES}).encode())

    def do_POST(self):
        if self.path != '/tts':
            self.error(404, '接口不存在'); return
        acquired = False
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 65536:
                self.error(413, '请求过大'); return
            data = json.loads(self.rfile.read(length))
            text = data.get('text', '')
            voice = data.get('voice')
            speed = float(data.get('speed', 1))
            if not isinstance(text, str) or not 0 < len(text.strip()) <= 3000 or voice not in VOICES or not 0.8 <= speed <= 1.2:
                self.error(400, '语音参数不合法'); return
            acquired = CAPACITY.acquire(blocking=False)
            if not acquired:
                self.error(429, '语音繁忙，请稍后重试'); return
            text = re.sub(r'```[\s\S]*?```', '代码内容略。', text)
            text = re.sub(r'[*#_`]+', '', text).strip()
            audio = asyncio.run(asyncio.wait_for(synthesize(text, voice, f'{round((speed - 1) * 100):+d}%'), timeout=45))
            self.send_body(200, audio, 'audio/mpeg')
        except (BrokenPipeError, ConnectionResetError):
            pass
        except (TypeError, ValueError):
            self.error(400, '语音内容不合法')
        except Exception:
            self.error(502, '在线语音暂时不可用，请检查网络后重试')
        finally:
            if acquired: CAPACITY.release()

if __name__ == '__main__':
    print('Edge online speech bridge ready at http://127.0.0.1:9891', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 9891), Handler).serve_forever()

