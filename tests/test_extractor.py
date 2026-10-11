import base64
import tempfile
import unittest
from unittest.mock import patch
import json
from import_naut import import_naut
from pathlib import Path
from io import BytesIO
from PIL import Image
from lxml import html
from extract_naut import AssetExtractor,extract,slug,pairs,excluded_section

class ExtractorTests(unittest.TestCase):
    def test_utf8_title_and_character_named_upgrade_icons(self):
        buffer=BytesIO();Image.new('RGB',(4,4)).save(buffer,'PNG')
        uri='data:image/png;base64,'+base64.b64encode(buffer.getvalue()).decode()
        snapshot=f'''<h1 id="firstHeading">Skølldir</h1><div id="mw-content-text">
          <table class="framed-table"><tr><th>Stats</th></tr><tr><td>Health</td><td>100</td></tr></table>
          <table class="filled"><tr><td><span class="Skill-Icon"><a href="/wiki/Punch" title="Punch"><img src="{uri}" data-image-name="Skolldir Skill1.png"></a></span></td>
          <td><span class="Skill-Icon"><a href="/wiki/Gloves" title="Gloves"><img src="{uri}" data-image-name="Skolldir Skill1-1.png"></a></span></td></tr></table></div>'''
        with tempfile.TemporaryDirectory() as directory:
            p=Path(directory)/'page.html';p.write_text(snapshot,encoding='utf-8')
            data=extract(p,Path(directory)/'out')
            self.assertEqual(data['name'],'Skølldir')
            self.assertEqual(data['slug'],'skolldir')
            self.assertEqual([i['name'] for i in data['items']],['Gloves'])
            self.assertEqual(data['items'][0]['group'],'Punch')

    def test_real_html_import_validates_canonical_before_replacing_dataset(self):
        buffer=BytesIO();Image.new('RGB',(4,4)).save(buffer,'PNG')
        uri='data:image/png;base64,'+base64.b64encode(buffer.getvalue()).decode()
        snapshot=f'''<html><head><link rel="canonical" href="CANONICAL"></head><body>
          <h1 id="firstHeading">Ayla</h1><div id="mw-content-text">
          <table class="framed-table"><tr><th>Stats</th></tr>
          <tr><td><span class="Awesomenaut-Portrait"><img src="{uri}"></span></td></tr>
          <tr><td>Health</td><td>100</td></tr></table>
          <table class="framed-table"><tr><th><b><a href="https://awesomenauts.fandom.com/wiki/Evil_Eye">Evil Eye</a></b></th></tr>
          <tr><td>Damage</td><td>100</td></tr></table></div></body></html>'''
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);(root/'data/nauts').mkdir(parents=True)
            source=root/'snapshot.html';target=root/'data/nauts/ayla.json'
            url='https://awesomenauts.fandom.com/wiki/Ayla'
            source.write_text(snapshot.replace('CANONICAL',url))
            with patch('import_naut.ROOT',root),patch('builtins.print'):
                data=import_naut(source)
                self.assertIs(type(data['source']['url']),str)
                self.assertEqual(json.loads(target.read_text())['source']['url'],url)
                self.assertTrue(data['portrait_asset'])
                self.assertTrue(list((root/'src/static/assets/nauts/ayla').iterdir()))
                accepted=target.read_bytes()
                for bad in ['javascript:alert(1)','https://attacker.example/wiki/Ayla']:
                    source.write_text(snapshot.replace('CANONICAL',bad))
                    with self.assertRaises(ValueError):import_naut(source)
                    self.assertEqual(target.read_bytes(),accepted)

    def test_import_without_required_portrait_preserves_data_and_assets(self):
        snapshot='''<html><head><link rel="canonical" href="https://awesomenauts.fandom.com/wiki/Ayla"></head>
          <body><h1 id="firstHeading">Ayla</h1><div id="mw-content-text">
          <table class="framed-table"><tr><th>Stats</th></tr>PORTRAIT
          <tr><td>Health</td><td>100</td></tr></table>
          <table class="framed-table"><tr><th><b><a href="https://awesomenauts.fandom.com/wiki/Evil_Eye">Evil Eye</a></b></th></tr>
          <tr><td>Damage</td><td>100</td></tr></table></div></body></html>'''
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);(root/'data/nauts').mkdir(parents=True)
            target=root/'data/nauts/ayla.json';target.write_bytes(b'previous accepted dataset')
            asset_dir=root/'src/static/assets/nauts/ayla';asset_dir.mkdir(parents=True)
            (asset_dir/'accepted.webp').write_bytes(b'previous accepted artwork')
            source=root/'snapshot.html'
            for portrait in ['', '<tr><td><span class="Awesomenaut-Portrait"><img src="https://example.org/missing.png"></span></td></tr>']:
                with self.subTest(portrait=portrait),patch('import_naut.ROOT',root):
                    source.write_text(snapshot.replace('PORTRAIT',portrait))
                    with self.assertRaisesRegex(ValueError,'No embedded Naut portrait'):
                        import_naut(source)
                    self.assertEqual(target.read_bytes(),b'previous accepted dataset')
                    self.assertEqual({p.name:p.read_bytes() for p in asset_dir.iterdir()},
                                     {'accepted.webp':b'previous accepted artwork'})

    def test_skin_quote_sections_are_excluded(self):
        self.assertTrue(excluded_section('Quotes'))
        self.assertTrue(excluded_section('Skull Chopper Chucho Quotes'))
        self.assertFalse(excluded_section('Skin Information'))

    def test_ascii_filenames(self):
        self.assertEqual(slug('Skølldir / Med-i’-can'), 'skolldir-med-i-can')

    def test_nested_tables_and_colspan_are_not_values(self):
        table=html.fromstring('<table><tr><td colspan="2">Type of abilities</td><td>Release date</td></tr><tr><td>Damage</td><td>300 (471)</td></tr><tr><td>Outer</td><td><table><tr><td>Range</td><td>9</td></tr></table></td></tr></table>')
        self.assertEqual(pairs(table),[{'label':'Damage','value':'300 (471)'}])

    def test_css_image_replaces_placeholder_and_deduplicates(self):
        buffer=BytesIO();Image.new('RGBA',(4,4),(255,180,0,255)).save(buffer,'PNG')
        uri='data:image/png;base64,'+base64.b64encode(buffer.getvalue()).decode()
        document=html.fromstring(f'<html><head><style>:root{{--sf-img-17:url("{uri}")}}</style></head><body><img src="data:image/svg+xml,placeholder" style="background-image:var(--sf-img-17)!important" data-image-name="Skølldir.png"><img src="{uri}"></body></html>')
        with tempfile.TemporaryDirectory() as directory:
            assets=AssetExtractor(document,Path(directory))
            images=document.xpath('//img')
            self.assertEqual(assets.extract(images[0]),assets.extract(images[1]))
            self.assertEqual(len(assets.assets),1)
            self.assertEqual(assets.assets[0]['storage'],'css-variable')
            self.assertEqual(assets.assets[0]['width'],4)
            self.assertEqual(assets.warnings,[])

    def test_missing_image_is_reported_without_network(self):
        document=html.fromstring('<img src="https://example.com/missing.png" alt="Missing">')
        with tempfile.TemporaryDirectory() as directory:
            assets=AssetExtractor(document,Path(directory))
            self.assertIsNone(assets.extract(document))
            self.assertEqual(assets.warnings[0]['code'],'missing_embedded_image')

    def test_percent_encoded_base64(self):
        buffer=BytesIO();Image.new('RGB',(2,2)).save(buffer,'PNG')
        payload=base64.b64encode(buffer.getvalue()).decode().replace('=','%3D')
        document=html.fromstring(f'<img src="data:image/png;base64,{payload}">')
        with tempfile.TemporaryDirectory() as directory:
            assets=AssetExtractor(document,Path(directory))
            self.assertIsNotNone(assets.extract(document))
            self.assertEqual(assets.warnings,[])

    def test_lazy_pixel_is_not_exported_as_artwork(self):
        document=html.fromstring('<img src="data:image/gif;base64,R0lGODlhAQABAIABAAAAAP///yH5BAEAAAEALAAAAAABAAEAQAICTAEAOw%3D%3D" data-src="https://example.com/skin.png" data-image-name="Skin.png">')
        with tempfile.TemporaryDirectory() as directory:
            assets=AssetExtractor(document,Path(directory))
            self.assertIsNone(assets.extract(document))
            self.assertEqual(assets.assets,[])
            self.assertEqual(assets.warnings[0]['code'],'missing_lazy_image')

    def test_non_naut_page_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            p=Path(directory)/'page.html';p.write_text('<h1 id="firstHeading">Maps</h1><div id="mw-content-text">Map list</div>')
            with self.assertRaisesRegex(ValueError,'No Naut Stats'):
                extract(p,Path(directory)/'out')

if __name__=='__main__':unittest.main()
