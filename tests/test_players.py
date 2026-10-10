import io
import json
import tempfile
import unittest
from pathlib import Path
from fetch_players import publish, snapshot, clean_history
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

    def test_outage_preserves_valid_history(self):
        point={'players':42,'checkedAt':datetime.now(timezone.utc).isoformat()}
        def offline(request,timeout):raise OSError('offline')
        with tempfile.TemporaryDirectory() as temp:
            data=publish(Path(temp)/'players.json',offline,history=[point])
            self.assertIsNone(data['players']);self.assertEqual(data['history'],[point])
