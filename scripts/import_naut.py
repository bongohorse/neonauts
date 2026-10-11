#!/usr/bin/env python3
"""Import a user-supplied saved Naut HTML without committing the raw page."""
import argparse
import json
import shutil
import tempfile
from pathlib import Path
from extract_naut import extract
from url_policy import validate_naut_urls

ROOT=Path(__file__).resolve().parents[1]

def import_naut(source):
    with tempfile.TemporaryDirectory() as temp:
        directory=Path(temp)
        data=extract(Path(source),directory)
        validate_naut_urls(data)
        slug=data['slug']
        # Validate before replacing any maintained dataset.
        if not data['abilities']:raise ValueError('No abilities found; import rejected')
        target=ROOT/'data/nauts'/f'{slug}.json'
        asset_dir=ROOT/'src/static/assets/nauts'/slug
        asset_dir.mkdir(parents=True,exist_ok=True)
        for asset in data['assets']:
            shutil.copyfile(directory/asset['path'],asset_dir/Path(asset['path']).name)
        target.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        print(json.dumps({'name':data['name'],'status':data['diagnostics']['status'],'abilities':len(data['abilities']),'items':len(data['items']),'skins':len(data['skins']),'images':len(data['assets']),'warnings':data['diagnostics']['warnings']},ensure_ascii=False,indent=2))
        return data

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('html',type=Path)
    import_naut(parser.parse_args().html)
