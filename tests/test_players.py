import io
import json
import tempfile
import unittest
from pathlib import Path
from fetch_players import publish, snapshot, clean_history, combine_previous_histories
from datetime import datetime, timezone, timedelta

class PlayersTests(unittest.TestCase):
    def test_zero_is_a_valid_count(self):
        data=snapshot({'response':{'result':1,'player_count':0}})
        self.assertEqual(data['players'],0)
        self.assertTrue(data['checkedAt'].endswith('+00:00'))

    def test_rejects_bad_counts_and_steam_failures(self):
        for count in [True,-1,2.5,'42',None]:
            with self.subTest(count=count),self.assertRaises(ValueError):
                snapshot({'response':{'result':1,'player_count':count}})
        with self.assertRaises(ValueError):snapshot({'response':{'result':0,'player_count':42}})

    def test_publish_real_response(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'players.json'
            publish(path,lambda request,timeout:io.BytesIO(b'{"response":{"result":1,"player_count":42}}'))
            self.assertEqual(json.loads(path.read_text())['players'],42)

    def test_outage_replaces_old_number_with_unavailable(self):
        def offline(request,timeout):raise OSError('offline')
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'players.json';path.write_text('{"players":42}')
            publish(path,offline)
            self.assertEqual(json.loads(path.read_text()),{'players':None,'checkedAt':None,'history':[]})

    def test_history_is_bounded_sorted_and_deduplicated(self):
        now=datetime.now(timezone.utc)
        p=lambda age,n:{'players':n,'checkedAt':(now-timedelta(minutes=age)).isoformat()}
        points=clean_history([p(0,1),p(30,2),p(30,3),p(1500,4),p(-1,5),p(5,True)],now)
        self.assertEqual([p['players'] for p in points],[3,1])
        self.assertEqual(len(clean_history([p(i,10) for i in range(150)],now)),120)


    def test_combines_public_history_and_tolerates_one_offline_origin(self):
        now=datetime.now(timezone.utc)
        first={'players':5,'checkedAt':(now-timedelta(minutes=30)).isoformat()}
        second={'players':6,'checkedAt':(now-timedelta(minutes=15)).isoformat()}
        urls=['https://awesomenauts.neocities.org/players.json',
              'https://bongohorse.github.io/neonauts/players.json']
        def opener(url,timeout):
            if url==urls[0]:
                return io.BytesIO(json.dumps({'history':[first,second]}).encode())
            return io.BytesIO(json.dumps({'history':[second]}).encode())
        history=combine_previous_histories(urls,opener=opener)
        self.assertEqual([x['players'] for x in history],[5,6])
        def pages_only(url,timeout):
            if url==urls[0]:raise OSError('first host temporarily offline')
            return io.BytesIO(json.dumps({'history':[first]}).encode())
        self.assertEqual(combine_previous_histories(urls,opener=pages_only),[first])
        self.assertEqual(combine_previous_histories(urls,opener=lambda url,timeout: io.BytesIO(b'bad json')),[])

    def test_combined_history_ignores_invalid_points_and_rejects_http(self):
        now=datetime.now(timezone.utc)
        valid={'players':3,'checkedAt':(now-timedelta(minutes=1)).isoformat()}
        stale={'players':4,'checkedAt':(now-timedelta(days=3)).isoformat()}
        def opener(url,timeout):
            return io.BytesIO(json.dumps({'history':[valid,stale,{'players':'wrong','checkedAt':valid['checkedAt']}]}).encode())
        self.assertEqual(combine_previous_histories(['https://example.org/players.json'],opener=opener),[valid])
        with self.assertRaisesRegex(ValueError,'HTTPS'):
            combine_previous_histories(['http://example.org/players.json'],opener=opener)

    def test_full_histories_keep_latest_samples_in_either_source_order(self):
        now=datetime.now(timezone.utc)
        points=[{'players':i,'checkedAt':(now-timedelta(minutes=i)).isoformat()} for i in range(240)]
        urls=['https://example.org/new','https://example.org/old']
        def opener(url,timeout):
            history=list(reversed(points[:120] if url.endswith('/new') else points[120:]))
            return io.BytesIO(json.dumps({'history':history}).encode())
        expected=list(reversed(points[:120]))
        for order in [urls,list(reversed(urls)),urls+[urls[0]]]:
            self.assertEqual(combine_previous_histories(order,opener),expected)

    def test_neocities_workflow_imports_both_histories(self):
        workflow=(Path(__file__).resolve().parents[1]/'.github/workflows/deploy.yml').read_text()
        self.assertIn('--history-url https://awesomenauts.neocities.org/players.json',workflow)
        self.assertIn('--history-url https://bongohorse.github.io/neonauts/players.json',workflow)

    def test_outage_preserves_valid_history(self):
        point={'players':42,'checkedAt':datetime.now(timezone.utc).isoformat()}
        def offline(request,timeout):raise OSError('offline')
        with tempfile.TemporaryDirectory() as temp:
            data=publish(Path(temp)/'players.json',offline,history=[point])
            self.assertIsNone(data['players']);self.assertEqual(data['history'],[point])
