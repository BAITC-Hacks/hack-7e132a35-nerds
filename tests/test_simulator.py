import json
import threading
import unittest
from unittest.mock import patch
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from http.server import ThreadingHTTPServer
from model import evaluate, dataset, DISTRICTS
from server import Handler, analyze

PLAN = [dict(action=a, district=i % 4, scale=1) for i, a in enumerate([0, 2, 4, 6, 8])]

class ModelTests(unittest.TestCase):
    def test_same_start(self):
        self.assertEqual(evaluate([]), evaluate([]))
        self.assertEqual(evaluate([])['spent'], 0)
        self.assertEqual(dataset()['budget'], 100)

    def test_score_formula_and_effects(self):
        r = evaluate(PLAN, complete=True)
        self.assertEqual(r['spent'], 54)
        expected = sum(sum(d['metrics']) / 5 * d['population'] for d in r['after']) / 220000
        self.assertEqual(r['score'], round(expected, 2))
        self.assertGreater(r['score'], r['baseline'])
        self.assertEqual(r['after'][0]['metrics'][0], 53)  # bus +16, waste -1
        self.assertEqual(DISTRICTS[0]['metrics'][0], 38)

    def test_choices_change_result(self):
        changed = [dict(d) for d in PLAN]
        changed[0]['action'] = 1
        self.assertNotEqual(evaluate(PLAN)['score'], evaluate(changed)['score'])

    def test_order_independence(self):
        plan = [dict(action=a, district=1, scale=s) for a, s in [(0, 3), (2, 1), (5, 1), (6, 1), (8, 1)]]
        self.assertEqual(evaluate(plan)['after'], evaluate(list(reversed(plan)))['after'])

    def test_validation(self):
        invalid = [None, {}, [{'action': -1, 'district': 0, 'scale': 1}],
                   [{'action': True, 'district': 0, 'scale': 1}],
                   [{'action': 0, 'district': 4, 'scale': 1}],
                   [{'action': 0, 'district': 0, 'scale': 0}], [PLAN[0], PLAN[0]],
                   [dict(d, scale=3) for d in PLAN]]
        for plan in invalid:
            with self.subTest(plan=plan), self.assertRaises(ValueError):
                evaluate(plan)
        with self.assertRaises(ValueError):
            evaluate(PLAN[:4], complete=True)

    def test_exact_budget_and_cap(self):
        plan = [dict(action=a, district=0, scale=s) for a, s in [(0, 3), (2, 3), (5, 1), (6, 1), (8, 2)]]
        self.assertEqual(evaluate(plan, True)['remaining'], 0)
        self.assertTrue(all(0 <= v <= 100 for d in evaluate(plan)['after'] for v in d['metrics']))

    @patch.dict('os.environ', {}, clear=True)
    def test_honest_fallback(self):
        self.assertEqual(analyze(evaluate(PLAN))['mode'], 'local')

    @patch.dict('os.environ', {'OPENAI_API_KEY': 'test'})
    @patch('server.urlopen')
    def test_ai_response(self, mock):
        mock.return_value.__enter__.return_value.read.return_value = json.dumps({'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':'Разбор сценария'}]}]}).encode()
        self.assertEqual(analyze(evaluate(PLAN)), {'mode':'ai','text':'Разбор сценария'})
        payload = json.loads(mock.call_args[0][0].data)
        self.assertFalse(payload['store'])
        self.assertIn('score', payload['input'])

    @patch.dict('os.environ', {'OPENAI_API_KEY': 'test'})
    @patch('server.urlopen', side_effect=TimeoutError)
    def test_ai_failure(self, mock):
        self.assertEqual(analyze(evaluate(PLAN))['mode'], 'local')

class HTTPTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = 'http://127.0.0.1:' + str(cls.server.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def post(self, path, data):
        return urlopen(Request(self.base + path, data=json.dumps(data).encode(), headers={'Content-Type':'application/json'}))

    def test_private_files_not_served(self):
        with self.assertRaises(HTTPError) as e:
            urlopen(self.base + '/server.py')
        self.assertEqual(e.exception.code, 404)

    def test_server_rejects_forged_budget(self):
        with self.assertRaises(HTTPError) as e:
            self.post('/api/analyze', {'decisions':[dict(d,scale=3) for d in PLAN], 'budget':99999})
        self.assertEqual(e.exception.code, 400)

    @patch.dict('os.environ', {}, clear=True)
    def test_full_flow(self):
        with urlopen(self.base + '/') as r:
            self.assertIn('Аким на 5 часов', r.read().decode())
        with self.post('/api/analyze', {'decisions':PLAN}) as r:
            result=json.load(r)
        self.assertEqual(result['analysis']['mode'], 'local')
        self.assertEqual(result['score'], evaluate(PLAN)['score'])

if __name__ == '__main__':
    unittest.main()
