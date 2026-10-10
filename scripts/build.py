#!/usr/bin/env python3
"""Build a static Neocities site from per-Naut JSON and shared templates."""
import argparse
import copy
import json
import re
import shutil
from pathlib import Path
from lxml import html, etree

ROOT = Path(__file__).resolve().parents[1]

def load(path):
    return json.loads(path.read_text(encoding='utf-8'))

def element(tag, text=None, **attrs):
    node = etree.Element(tag, {k.replace('_', '-'): str(v) for k, v in attrs.items()})
    node.text = text
    return node

def replace_contents(node, children):
    node.text = None
    for child in list(node): node.remove(child)
    node.extend(children)

def append_blocks(parent, blocks):
    for block in blocks:
        if block['type'] == 'paragraph': parent.append(element('p', block['text']))
        elif block['type'] == 'list':
            node = element('ol' if block.get('ordered') else 'ul')
            node.extend(element('li', item) for item in block['items'])
            parent.append(node)

def js_assignment(name, data):
    # External JS, with HTML metacharacters escaped for safe future reuse.
    encoded = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    return 'const '+name+'='+encoded.replace('<', '\\u003c').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')+';\n'

def page_data(data, overrides):
    slug = data['slug']
    assets = {a['id']: 'assets/nauts/'+slug+'/'+Path(a['path']).name for a in data['assets']}
    groups = list(dict.fromkeys(item['group'] for item in data['items']))
    skins = {'default': {'name': 'DEFAULT', 'image': assets[data['portrait_asset']], 'description': 'Default character artwork from the saved Wiki.'}}
    for index, skin in enumerate(data['skins'], 1):
        artwork = overrides.get(slug, {}).get('skin_assets', {}).get(skin['name'])
        artwork = artwork or next(iter(skin['assets']), None)
        # Text remains visible even when a saved snapshot lacks its skin image.
        skins['skin-'+str(index)] = {
            'name': skin['name'], 'image': assets.get(artwork),
            'description': ' '.join(b['text'] for b in skin['content'] if b['type']=='paragraph')
        }
    return {
        'name': data['name'], 'slug': slug, 'skins': skins, 'itemGroups': groups,
        'abilities': [{'id': 'skill-'+str(i), 'name': a['name'], 'image': assets.get(a['icon_asset']),
                       'text': a['description'], 'tip': '',
                       'values': [[v['label'], v['value']] for v in a['values']]} for i,a in enumerate(data['abilities'])],
        'items': [{'name': i['name'], 'url': i['source_url'], 'image': assets.get(i['icon_asset']), 'row': groups.index(i['group'])} for i in data['items']]
    }

def make_dossier(template, data, runtime):
    dossier = copy.deepcopy(template)
    name = data['name']
    stats = {s['label']: s['value'] for s in data['stats']}
    meta = data['metadata']
    head = dossier.xpath('.//header')[0]
    replace_contents(head.xpath('.//h1')[0], [element('span', name.upper())])
    head.xpath('.//*[@class="eyebrow"]/span')[0].text = 'NAUT DOSSIER'
    head.xpath('.//*[@class="tag"]')[0].text = stats.get('Role', 'NAUT').upper()
    head.xpath('.//*[@class="subtitle"]')[0].text = 'AWESOMENAUTS FIELD GUIDE'
    replace_contents(head.xpath('.//*[@class="trait-row"]')[0], [element('span', stats.get('Attack Type', '')), element('span', stats.get('Mobility', '')), element('span', 'DIFFICULTY: '+meta.get('Difficulty', 'Unknown'), **{'class':'hard'})])
    head.xpath('.//*[@class="intro"]')[0].text = 'Explore '+name+'’s abilities, upgrades, story and archived skins.'
    dossier.xpath('.//article')[0].set('aria-label', name+' field guide')
    dossier.xpath('.//*[@role="tablist"]')[0].set('aria-label', name+' dossier')
    grid = dossier.xpath('.//*[@class="stats-grid"]')[0]
    children=[]
    for label,value in [('HEALTH',stats.get('Health','')),('MOVEMENT SPEED',stats.get('Movement Speed','')),('ATTACK TYPE',stats.get('Attack Type','')),('RELEASED',meta.get('Release Date',''))]:
        row=element('div');row.extend([element('small',label),element('strong',value)]);children.append(row)
    replace_contents(grid, children)
    strip=dossier.xpath('.//*[@class="ability-strip"]')[0];buttons=[]
    for skill in runtime['abilities']:
        button=element('button',data_open_ability=skill['id'])
        if skill['image']: button.append(element('img',src=skill['image'],alt=''))
        button.append(element('span',skill['name']));buttons.append(button)
    replace_contents(strip,buttons)
    note=dossier.xpath('.//*[@class="field-note"]//p')[0]
    note.text='Values reflect the saved Wiki snapshot. Parentheses and game-version context are unverified.'
    tactics=dossier.xpath('.//*[@class="tactics"]')[0]
    replace_contents(tactics,[element('summary','TACTICS: PLAY AS / WITH / AGAINST')])
    for title in ['Playing As:', 'Playing With:', 'Playing Against:']:
        content=data['sections'].get(title,[])
        if content: tactics.append(element('h3',title));append_blocks(tactics,content)
    dossier.xpath('.//*[@id="abilities"]//*[@class="panel-intro"]')[0].text='Abilities and movement information for '+name+'.'
    story=dossier.xpath('.//*[@id="story"]')[0]
    replace_contents(story,[element('h2','BACKSTORY')]);append_blocks(story,data['sections'].get('Backstory',[]))
    link=element('a','Explore the complete Wiki dossier ↗',href=data['source']['url'],target='_blank',rel='noopener noreferrer',**{'class':'text-link'})
    story.append(link)
    notice=dossier.xpath('.//*[@class="data-note"]')[0]
    missing=sum(w['code']=='missing_lazy_image' for w in data['diagnostics']['warnings'])
    replace_contents(notice,[element('span','SOURCE: SAVED WIKI · 10 OCT 2026. Values retain their original parentheses; game version and scaling context are unverified.'+(f' {missing} images were not embedded in the snapshot.' if missing else '')),copy.deepcopy(link)])
    stage=dossier.xpath('.//*[@class="character-stage"]')[0];stage.set('aria-label',name+' character and skins')
    replace_contents(stage.xpath('.//*[@class="stage-index"]')[0],[element('span',name.upper())])
    default=runtime['skins']['default']
    art=stage.xpath('.//*[@id="character-art"]')[0];art.set('src',default['image']);art.set('alt',name+' default artwork')
    skin_buttons=[]
    for key,skin in runtime['skins'].items():
        button=element('button',data_skin=key,aria_pressed=str(key=='default').lower())
        if key=='default':button.set('class','active')
        if skin['image']:button.append(element('img',src=skin['image'],alt=''))
        button.append(element('span',skin['name']));skin_buttons.append(button)
    replace_contents(stage.xpath('.//*[@class="skin-buttons"]')[0],skin_buttons)
    stage.xpath('.//*[@id="skin-description"]')[0].text=default['description']
    stage.xpath('.//*[@id="skin-position"]')[0].text='01 / '+str(len(runtime['skins'])).zfill(2)
    return dossier

def build(output=None):
    output = Path(output) if output else ROOT/'dist'
    # Do not delete an arbitrary directory if a caller mistypes --out.
    if output.resolve() == ROOT.resolve() or ROOT.resolve().is_relative_to(output.resolve()):
        raise ValueError('Output must not contain the source repository')
    if output.exists():
        if not (output/'.neonauts-build').exists(): raise ValueError('Output directory is not a marked build directory')
        shutil.rmtree(output)
    shutil.copytree(ROOT/'src/static',output)
    (output/'.neonauts-build').write_text('generated\n')
    (output/'config.js').write_text(js_assignment('siteConfig',load(ROOT/'site.config.json')),encoding='utf-8')
    datasets = [load(p) for p in sorted((ROOT/'data/nauts').glob('*.json'))]
    overrides=load(ROOT/'data/presentation.json')
    for d in datasets:
        if d['schema_version']!=1 or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*',d['slug']):raise ValueError('Invalid Naut schema/slug')
    imported = {d['name']:d for d in datasets}
    roster=load(ROOT/'data/roster.json')
    for n in roster:
        d=imported.get(n['name']);n['available']=bool(d)
        if d:n.update(slug=d['slug'],url='nauts/'+d['slug']+'/')
    editorial=load(ROOT/'data/swiggins-editorial.json')
    (output/'roster-data.js').write_text(js_assignment('archiveData',{'roster':roster,'items':editorial['items']}),encoding='utf-8')
    shell=html.fromstring((ROOT/'src/templates/shell.html').read_text(encoding='utf-8'))
    site_url=load(ROOT/'site.config.json').get('siteUrl','').rstrip('/')
    if site_url:
        if not re.fullmatch(r'https://[A-Za-z0-9.-]+(?::[0-9]+)?',site_url):raise ValueError('siteUrl must be an HTTPS origin without a path')
        for textarea in shell.xpath('//textarea[contains(@class,"embed-code")]'):
            textarea.text=(textarea.text or '').replace('https://YOUR-SITE.neocities.org',site_url)
    dossier_template=html.fromstring((ROOT/'src/templates/swiggins-dossier.html').read_text(encoding='utf-8'))
    for d in datasets:
        runtime=page_data(d,overrides)
        document=copy.deepcopy(shell)
        if d['slug']=='admiral-swiggins':
            dossier=copy.deepcopy(dossier_template)
            runtime.update(itemGroups=['ANCHOR HOOK','DROP ANCHOR','ANCHOR SWING / INK SPRAY','UTILITY'])
            runtime['items']=editorial['items']
        else:dossier=make_dossier(dossier_template,d,runtime)
        slot=document.get_element_by_id('dossier-slot');slot.getparent().replace(slot,dossier)
        document.xpath('//title')[0].text=d['name']+' — Nauts Archive'
        document.xpath('//meta[@name="description"]')[0].set('content','Unofficial Awesomenauts field guide: '+d['name']+' abilities, upgrades, archived skins and story.')
        document.xpath('//*[@id="nauts"]/*[@class="section-line"]/span')[1].text=str(len(datasets)).zfill(2)+' DOSSIERS AVAILABLE / MORE TO COME'
        document.xpath('//*[@class="roster-note"]')[0].text=d['name'].upper()+' SELECTED'
        # A relative base keeps every shared asset/navigation working on nested URLs.
        head=document.xpath('//head')[0];head.insert(0,element('base',href='../../'))
        old_scripts=document.xpath('//script[@src]');first=old_scripts[0]
        for src in ['config.js','roster-data.js','nauts/'+d['slug']+'/page-data.js']:
            first.addprevious(element('script',src=src,defer='defer'))
        if d['slug']=='admiral-swiggins':
            first.addprevious(element('script',src='swiggins-editorial.js',defer='defer'))
        # Hash navigation stays on the chosen dossier rather than resolving to root.
        for anchor in document.xpath('//a[starts-with(@href,"#")]'):
            anchor.set('href','nauts/'+d['slug']+'/'+anchor.get('href'))
        directory=output/'nauts'/d['slug'];directory.mkdir(parents=True)
        code=js_assignment('nautPage',runtime)
        if d['slug']=='admiral-swiggins':code+='nautPage.abilities=editorialAbilities;nautPage.skins=editorialSkins;\n'
        # Editorial must load before page-data on the Swiggins page.
        if d['slug']=='admiral-swiggins':
            e=document.xpath('//script[@src="swiggins-editorial.js"]')[0]
            p=document.xpath('//script[contains(@src,"page-data.js")]')[0]
            e.getparent().remove(e);p.addprevious(e)
        (directory/'page-data.js').write_text(code,encoding='utf-8')
        markup='<!doctype html>\n'+html.tostring(document,encoding='unicode',method='html')
        (directory/'index.html').write_text(markup,encoding='utf-8')
        if d['slug']=='admiral-swiggins':
            root_doc=copy.deepcopy(document);root_doc.xpath('//base')[0].set('href','./')
            for anchor in root_doc.xpath('//a[contains(@href,"nauts/admiral-swiggins/#")]'):
                anchor.set('href','#'+anchor.get('href').split('/#')[-1])
            (output/'index.html').write_text('<!doctype html>\n'+html.tostring(root_doc,encoding='unicode',method='html'),encoding='utf-8')
    for name in ['404.html','not_found.html']:
        shutil.copyfile(ROOT/'src/templates'/name,output/name)
    print(f'Built {len(datasets)} Naut pages in {output}')
    return output

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--out',type=Path)
    build(parser.parse_args().out)
