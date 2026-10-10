#!/usr/bin/env python3
"""Check the generated site and local datasets without network requests."""
import json
import re
import subprocess
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin, urlsplit, unquote
from lxml import html
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]

def check(directory=None):
    directory=Path(directory) if directory else ROOT/'dist'
    base_path=json.loads((directory/'.neonauts-build').read_text())['base_path']
    errors=[]
    for page in directory.rglob('*.html'):
        document=html.fromstring(page.read_text(encoding='utf-8'))
        ids=document.xpath('//@id')
        if len(ids)!=len(set(ids)):errors.append(f'{page}: duplicate IDs')
        url='https://local.test'+base_path+page.relative_to(directory).as_posix()
        bases=document.xpath('//base/@href');base=urljoin(url,bases[0]) if bases else url
        for node in document.xpath('//*[@src] | //*[@href]'):
            if node.tag=='base':continue
            ref=node.get('src') or node.get('href')
            resolved=urlsplit(urljoin(base,ref))
            if resolved.netloc!='local.test':continue
            if not resolved.path.startswith(base_path):
                errors.append(f'{page.name}: link escapes site base path: {ref}');continue
            target=directory/unquote(resolved.path[len(base_path):])
            if target.is_dir():target=target/'index.html'
            if not target.is_file():errors.append(f'{page.name}: missing {ref}')
            if resolved.fragment and target.is_file() and target.suffix=='.html':
                fragment=resolved.fragment.split('/')[0]
                other=html.fromstring(target.read_text(encoding='utf-8'))
                if not other.xpath('//*[@id=$id]',id=fragment):errors.append(f'{page.name}: missing fragment {ref}')
        for node in document.xpath('//*[@aria-controls] | //*[@aria-labelledby]'):
            for field in ['aria-controls','aria-labelledby']:
                for ref in node.get(field,'').split():
                    if ref not in ids:errors.append(f'{page.name}: missing ARIA target {ref}')
    for css in directory.rglob('*.css'):
        css_text=re.sub(r'/\*.*?\*/','',css.read_text(encoding='utf-8'),flags=re.DOTALL)
        for ref in re.findall(r'url\([\'"]?([^\)\'"\s]+)',css_text):
            if not ref.startswith(('data:','http','/')) and not (css.parent/ref).is_file():errors.append(f'{css.name}: missing {ref}')
    for path in directory.rglob('*.js'):
        result=subprocess.run(['node','--check',str(path)],capture_output=True,text=True)
        if result.returncode:errors.append(result.stderr)
    for path in (directory/'assets').rglob('*'):
        if path.suffix.lower() in ['.webp','.png','.jpg','.jpeg','.gif']:
            with Image.open(BytesIO(path.read_bytes())) as image:image.load()
    for path in (ROOT/'data/nauts').glob('*.json'):
        data=json.loads(path.read_text(encoding='utf-8'));ids={a['id'] for a in data['assets']}
        for asset in data['assets']:
            if not (ROOT/'src/static/assets/nauts'/data['slug']/Path(asset['path']).name).is_file():errors.append(f'{path.name}: missing asset {asset["id"]}')
        refs=[data['portrait_asset']]+[a['icon_asset'] for a in data['abilities']]+[a['icon_asset'] for a in data['items']]+[i for s in data['skins'] for i in s['assets']]
        if any(ref and ref not in ids for ref in refs):errors.append(f'{path.name}: invalid asset reference')
    if errors:raise ValueError('\n'.join(errors))
    print('Site checks passed: local links, CSS assets, IDs, ARIA, JavaScript, raster images and Naut asset references.')

if __name__=='__main__':check()
