import sys, json, io, tempfile, hashlib
from pathlib import Path
from datetime import datetime, timezone, timedelta
from unittest.mock import patch
sys.path.insert(0,'scripts')
from fetch_players import combine_previous_histories
from deploy_neocities import require_immutable_release
from import_naut import import_naut
from build import page_data
results={"pythonVersion":sys.version.split()[0]}
now=datetime.now(timezone.utc)
first=[{'players':1000-i,'checkedAt':(now-timedelta(minutes=i)).isoformat()} for i in reversed(range(120))]
second=[{'players':1000-i,'checkedAt':(now-timedelta(minutes=i)).isoformat()} for i in reversed(range(120,240))]
def opener(url,timeout):return io.BytesIO(json.dumps({'history':first if url.endswith('/new') else second}).encode())
merged=combine_previous_histories(['https://example.test/new','https://example.test/old'],opener)
results['mergedHistory']={'size':len(merged),'newerPointsRetained':len({p['checkedAt'] for p in merged}&{p['checkedAt'] for p in first}),'expectedNewerPoints':120,'oldestAgeMinutes':round((now-datetime.fromisoformat(merged[0]['checkedAt'])).total_seconds()/60)}
with tempfile.TemporaryDirectory() as tmp:
 out=Path(tmp);(out/'.neonauts-build').write_text(json.dumps({'base_path':'/','immutable_release':True}));(out/'index.html').write_text('<h1>test</h1>')
 name='script.'+hashlib.sha256(b'original').hexdigest()[:24]+'.js';(out/name).write_bytes(b'changed after staging');require_immutable_release(out)
 results['incorrectLocalHashAccepted']={'accepted':True,'filename':name,'actualHash':hashlib.sha256((out/name).read_bytes()).hexdigest()[:24]}
with tempfile.TemporaryDirectory() as tmp:
 out=Path(tmp);(out/'data/nauts').mkdir(parents=True)
 snapshot=out/'snapshot.html';snapshot.write_text('<html><head><link rel="canonical" href="https://awesomenauts.fandom.com/wiki/Ayla"></head><body><h1 id="firstHeading">Ayla</h1><div id="mw-content-text"><table class="framed-table"><tr><th>Stats</th></tr><tr><td>Health</td><td>100</td></tr></table><table class="framed-table"><tr><th><b><a href="https://awesomenauts.fandom.com/wiki/Evil_Eye">Evil Eye</a></b></th></tr><tr><td>Damage</td><td>100</td></tr></table></div></body></html>')
 target=out/'data/nauts/ayla.json';target.write_text('previous accepted dataset')
 from extract_naut import extract
 extracted=extract(snapshot,out/'debug')
 try:
  with patch('import_naut.ROOT',out),patch('builtins.print'):
   import_naut(snapshot)
 except Exception as e:
  results['validImportRejected']={'canonicalURL':str(extracted['source']['url']),'canonicalType':type(extracted['source']['url']).__name__,'error':type(e).__name__,'message':str(e),'previousDatasetPreserved':target.read_text()=='previous accepted dataset'}
Path('tests/artifacts/review-python.json').write_text(json.dumps(results,indent=2)+'\n');print(json.dumps(results,indent=2))
