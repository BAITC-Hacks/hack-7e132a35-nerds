"""Local hackathon server. Python 3.9+, no third-party dependencies."""
import json
import os
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import URLError
from model import dataset, evaluate

PUBLIC = Path(__file__).parent / 'public'

def analyze(result):
    key = os.getenv('OPENAI_API_KEY')
    if not key:
        return dict(mode='local', text='AI не подключён: доступен расчетный разбор по правилам модели.')
    payload = dict(model=os.getenv('OPENAI_MODEL', 'gpt-4.1-mini'), store=False,
        instructions='Ты советник в учебном симуляторе города. Ответь по-русски, до 350 слов: сильные стороны, риски и компромиссы, последствия, рекомендации. Используй только приложенные синтетические данные. Не изменяй рассчитанный score. Не выдавай модель за прогноз реальной Астаны. Учитывай население, побочные эффекты, остаток бюджета. Не утверждай, что предложенная альтернатива лучше без расчета.',
        input=json.dumps(dict(result=result, catalog=dataset()), ensure_ascii=False), max_output_tokens=1600)
    req = Request('https://api.openai.com/v1/responses', data=json.dumps(payload).encode(),
                  headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    try:
        with urlopen(req, timeout=40) as response:
            data = json.load(response)
        text = '\n'.join(c['text'] for item in data.get('output', []) if item.get('type') == 'message'
                         for c in item.get('content', []) if c.get('type') == 'output_text')
        if not text or data.get('status') != 'completed':
            raise ValueError('Incomplete AI response')
        return dict(mode='ai', text=text)
    except (URLError, TimeoutError, ValueError, KeyError, OSError):
        return dict(mode='local', text='AI временно недоступен. Показан расчетный разбор; оценка сценария сохранена. Можно повторить анализ.')

class Handler(BaseHTTPRequestHandler):
    def send(self, status, data, kind='application/json; charset=utf-8'):
        body = json.dumps(data, ensure_ascii=False).encode() if isinstance(data, dict) else data
        self.send_response(status)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == '/api/data':
            return self.send(200, dict(**dataset(), ai_configured=bool(os.getenv('OPENAI_API_KEY'))))
        assets = {'/': ('index.html', 'text/html; charset=utf-8'), '/app.js': ('app.js', 'text/javascript; charset=utf-8'), '/style.css': ('style.css', 'text/css; charset=utf-8')}
        if self.path not in assets:
            return self.send(404, {'error': 'Не найдено'})
        name, kind = assets[self.path]
        self.send(200, (PUBLIC / name).read_bytes(), kind)

    def do_POST(self):
        if self.path not in ('/api/preview', '/api/analyze'):
            return self.send(404, {'error': 'Не найдено'})
        if self.headers.get('Origin') and self.headers['Origin'] != 'http://' + self.headers.get('Host', ''):
            return self.send(403, {'error': 'Недопустимый источник запроса'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 8192:
                raise ValueError('Недопустимый размер запроса.')
            body = json.loads(self.rfile.read(length))
            if not isinstance(body, dict):
                raise ValueError('Ожидается объект сценария.')
            result = evaluate(body.get('decisions'), complete=self.path == '/api/analyze')
        except (ValueError, UnicodeDecodeError) as e:
            return self.send(400, {'error': str(e)})
        if self.path == '/api/analyze':
            result['analysis'] = analyze(result)
        self.send(200, result)

if __name__ == '__main__':
    port = int(os.getenv('PORT', '8000'))
    print(f'Аким на 5 часов → http://localhost:{port}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
