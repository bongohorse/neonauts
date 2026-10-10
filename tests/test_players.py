import io
import json
import tempfile
import unittest
from pathlib import Path
from fetch_players import publish, snapshot

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
            self.assertEqual(json.loads(path.read_text()),{'players':None,'checkedAt':None})
