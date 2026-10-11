import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from lxml import html
from build import build, make_dossier, page_data, ROOT
from check import check

class BuildTests(unittest.TestCase):
    def test_github_pages_prefix_and_404_assets(self):
        with tempfile.TemporaryDirectory() as temp:
            out=build(Path(temp)/'site',base_path='/neonauts/')
            doc=html.fromstring((out/'404.html').read_text())
            self.assertIn('/neonauts/styles.css',doc.xpath('//link/@href'))
            self.assertIn('/neonauts/index.html#nauts',doc.xpath('//a/@href'))
            check(out)

    def test_build_is_deterministic_and_pages_are_separate(self):
        with tempfile.TemporaryDirectory() as temp:
            out=Path(temp)/'site';build(out)
            before={p.relative_to(out):hashlib.sha256(p.read_bytes()).hexdigest() for p in out.rglob('*') if p.is_file()}
            overrides=json.loads((ROOT/'data/presentation.json').read_text(encoding='utf-8'))
            for source in sorted((ROOT/'data/nauts').glob('*.json')):
                slug=source.stem
                p=out/'nauts'/slug/'index.html';self.assertTrue(p.is_file())
                doc=html.fromstring(p.read_text())
                self.assertEqual(len(doc.xpath('//*[@class="dossier"]')),1)
                dossier=doc.xpath('//*[@class="dossier"]')[0]
                self.assertEqual([child.get('class') for child in dossier],['dossier-main','character-stage'])
                self.assertEqual([child.get('class') for child in dossier[0]],['dossier-heading','dossier-content'])
                self.assertEqual(doc.xpath('//base/@href'),['../../'])
                data=json.loads((ROOT/'data/nauts'/f'{slug}.json').read_text())
                runtime=json.loads((out/'nauts'/slug/'page-data.json').read_text(encoding='utf-8'))
                editorial_path=ROOT/'data/editorial'/f'{slug}.json'
                editorial_view=json.loads(editorial_path.read_text(encoding='utf-8')).get('view') if editorial_path.exists() else None
                canonical=page_data(data,overrides,editorial_view)
                for section in ('abilities','items','itemGroups','skins'):
                    self.assertEqual(runtime[section],canonical[section],f'{slug}: {section} must be canonical')
                self.assertEqual(doc.xpath('//*[@class="roster-note"]')[0].text_content(),data['name'].upper()+' SELECTED')
                self.assertFalse(doc.xpath('//*[@id="nauts"]/*[@class="section-line"]'))
                self.assertFalse(doc.xpath('//*[@class="stage-index"]'))
                self.assertEqual(doc.xpath('//*[@class="trait-row"]/*')[0].text_content(),next(s['value'] for s in data['stats'] if s['label']=='Role').upper())
                self.assertEqual(len(doc.xpath('//*[@class="dossier-heading"]/h1/span')),1)
                self.assertIn('PLAY THEME',doc.text_content())
                self.assertFalse(doc.xpath('//*[contains(concat(" ",normalize-space(@class)," ")," steam-mini ")]'))
                self.assertNotIn('NAUT DOSSIER',doc.text_content())
                self.assertNotIn('AWESOMENAUTS FIELD GUIDE',doc.text_content())
                if slug=='admiral-swiggins':
                    self.assertIn('THE ANCHOR-WIELDING SPACE ADMIRAL',doc.text_content())
                    self.assertIn('FROM TITAN TO THE STARS',doc.text_content())
                    self.assertIn('Swiggins excels with backup.',doc.text_content())
                else:self.assertFalse(doc.xpath('//*[@class="subtitle"]'))
            build(out)
            after={p.relative_to(out):hashlib.sha256(p.read_bytes()).hexdigest() for p in out.rglob('*') if p.is_file()}
            self.assertEqual(before,after)

    def test_editorial_contains_narrative_copy_only(self):
        for source in sorted((ROOT/'data/editorial').glob('*.json')):
            editorial=json.loads(source.read_text(encoding='utf-8'))
            self.assertEqual(set(editorial),{'view'},f'{source.name}: editorial must not override runtime data')
        swiggins=json.loads((ROOT/'data/editorial/admiral-swiggins.json').read_text(encoding='utf-8'))
        self.assertEqual(swiggins['view']['story'][0]['text'],'BACKSTORY')
        self.assertEqual(swiggins['view']['story'][1]['text'],'FROM TITAN TO THE STARS')
        self.assertEqual(set(swiggins['view']['skin_descriptions']),{'default','Admiral Swiggins, PHD','Abyssal Swiggins'})
        source=json.loads((ROOT/'data/nauts/admiral-swiggins.json').read_text(encoding='utf-8'))
        runtime=page_data(source,{},swiggins['view'])
        self.assertIn('deep-sea creature',runtime['skins']['skin-2']['description'])

    def test_legacy_dossier_css_supports_cached_html(self):
        css=(ROOT/'src/static/styles.css').read_text(encoding='utf-8')
        self.assertIn('.dossier:has(> .dossier-heading)',css)
        self.assertIn('grid-template-areas:"heading stage" "content stage"',css)
        self.assertIn('grid-template-rows:max-content minmax(0,1fr);row-gap:0',css)
        self.assertIn('.dossier > .dossier-content{grid-area:content}',css)

    def test_unmarked_output_is_protected(self):
        with tempfile.TemporaryDirectory() as temp:
            out=Path(temp)/'valuable';out.mkdir();(out/'keep.txt').write_text('keep')
            with self.assertRaisesRegex(ValueError,'marked build'):build(out)
            self.assertEqual((out/'keep.txt').read_text(),'keep')

    def test_imported_text_is_escaped(self):
        data=json.loads((ROOT/'data/nauts/ayla.json').read_text())
        data['name']='<script>alert(1)</script>'
        template=html.fromstring((ROOT/'src/templates/naut-dossier.html').read_text())
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
