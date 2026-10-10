import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from lxml import html
from build import build, make_dossier, page_data, ROOT

class BuildTests(unittest.TestCase):
    def test_build_is_deterministic_and_pages_are_separate(self):
        with tempfile.TemporaryDirectory() as temp:
            out=Path(temp)/'site';build(out)
            before={p.relative_to(out):hashlib.sha256(p.read_bytes()).hexdigest() for p in out.rglob('*') if p.is_file()}
            for slug in ['ayla','chucho-krokk','admiral-swiggins']:
                p=out/'nauts'/slug/'index.html';self.assertTrue(p.is_file())
                doc=html.fromstring(p.read_text())
                self.assertEqual(len(doc.xpath('//*[@class="dossier"]')),1)
                self.assertEqual(doc.xpath('//base/@href'),['../../'])
            build(out)
            after={p.relative_to(out):hashlib.sha256(p.read_bytes()).hexdigest() for p in out.rglob('*') if p.is_file()}
            self.assertEqual(before,after)

    def test_unmarked_output_is_protected(self):
        with tempfile.TemporaryDirectory() as temp:
            out=Path(temp)/'valuable';out.mkdir();(out/'keep.txt').write_text('keep')
            with self.assertRaisesRegex(ValueError,'marked build'):build(out)
            self.assertEqual((out/'keep.txt').read_text(),'keep')

    def test_imported_text_is_escaped(self):
        data=json.loads((ROOT/'data/nauts/ayla.json').read_text())
        data['name']='<script>alert(1)</script>'
        template=html.fromstring((ROOT/'src/templates/swiggins-dossier.html').read_text())
        node=make_dossier(template,data,page_data(data,{}))
        self.assertEqual(node.xpath('.//script'),[])
        self.assertIn(data['name'].upper(),node.xpath('.//h1')[0].text_content())

    def test_chucho_skin_fallback_uses_real_embedded_art(self):
        data=json.loads((ROOT/'data/nauts/chucho-krokk.json').read_text())
        config=json.loads((ROOT/'data/presentation.json').read_text())
        runtime=page_data(data,config)
        for skin in runtime['skins'].values():
            self.assertTrue((ROOT/'src/static'/skin['image']).is_file())
        self.assertEqual(data['diagnostics']['status'],'partial')
