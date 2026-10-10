import base64
import tempfile
import unittest
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
