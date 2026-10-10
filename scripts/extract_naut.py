#!/usr/bin/env python3
"""Extract a saved Fandom/SingleFile Naut page offline. No network requests."""
import argparse
import base64
import hashlib
import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import unquote, urlsplit
from io import BytesIO
from lxml import html
from PIL import Image

SCHEMA_VERSION = 1

def clean(text):
    return re.sub(r'\s+', ' ', re.sub(r'\[edit\]|\[\]', '', text or '')).strip()

def text(node):
    return clean(node.text_content())

def slug(value):
    value = value.translate(str.maketrans({'ø':'o','Ø':'O','ß':'ss'}))
    value = unicodedata.normalize('NFKD', value).encode('ascii','ignore').decode()
    return re.sub(r'[^a-z0-9]+','-',value.lower()).strip('-') or 'asset'

def excluded_section(title):
    return bool(re.search(r'\bquotes\s*$',title,re.IGNORECASE))

def rows(table):
    # Only this table's rows. Outer ability tables contain the same text again.
    return table.xpath('./tr|./tbody/tr')

def pairs(table):
    result=[]
    for row in rows(table):
        cells=row.xpath('./td')
        if len(cells)==2 and not any(c.xpath('.//table') or int(c.get('colspan','1'))>1 for c in cells):
            label,value=map(text,cells)
            if label and value: result.append({'label':label.rstrip(':'),'value':value})
    return result

def after_label(label):
    parts=[label.tail or '']
    for sibling in label.itersiblings():
        if sibling.tag=='b' or sibling.xpath('.//b'):break
        parts.extend([sibling.text_content(),sibling.tail or ''])
    return clean(' '.join(parts)).lstrip(':').strip()

def blocks(heading):
    level=int(heading.tag[1])
    result=[]
    for sibling in heading.itersiblings():
        if re.fullmatch(r'h[1-6]',sibling.tag or '') and int(sibling.tag[1])<=level:break
        if sibling.tag=='p' and text(sibling):
            result.append({'type':'paragraph','text':text(sibling)})
        elif sibling.tag in ('ul','ol'):
            result.append({'type':'list','ordered':sibling.tag=='ol','items':[text(li) for li in sibling.xpath('./li') if text(li)]})
    return result

class AssetExtractor:
    def __init__(self, document, directory):
        self.directory=directory
        self.directory.mkdir(parents=True,exist_ok=True)
        self.variables={}
        # SingleFile saves image data inside CSS custom properties.
        for style in document.xpath('//style'):
            for match in re.finditer(r'(--sf-img-\d+)\s*:\s*url\(\s*(["\']?)(data:[^\s"\')]+)\2\s*\)',style.text or ''):
                self.variables[match.group(1)]=match.group(3)
        self.assets=[];self.by_hash={};self.by_node={};self.warnings=[]

    def extract(self, img):
        if img in self.by_node:return self.by_node[img]
        name=img.get('data-image-name') or img.get('alt') or 'image'
        uri=img.get('src','')
        variable=re.search(r'background-image\s*:\s*var\((--sf-img-\d+)\)',img.get('style',''))
        origin='src'
        if variable:
            uri=self.variables.get(variable.group(1),'');origin='css-variable'
        if not uri.startswith('data:') or ',' not in uri:
            self.warnings.append({'code':'missing_embedded_image','image':name})
            self.by_node[img]=None;return None
        try:
            header,payload=uri.split(',',1)
            if ';base64' not in header:raise ValueError('Non-raster placeholder')
            raw=base64.b64decode(unquote(payload),validate=True)
            with Image.open(BytesIO(raw)) as image:
                image.load();width,height=image.size;fmt=image.format
        except Exception as error:
            self.warnings.append({'code':'unreadable_image','image':name,'reason':type(error).__name__})
            self.by_node[img]=None;return None
        # A saved lazy-loading page may contain only a transparent pixel.
        # Do not export it as the artwork named by data-image-name.
        lazy_source=img.get('data-src') or img.get('data-original')
        if origin=='src' and width==1 and height==1 and lazy_source and not lazy_source.startswith('data:'):
            self.warnings.append({'code':'missing_lazy_image','image':name,'url':lazy_source})
            self.by_node[img]=None;return None
        digest=hashlib.sha256(raw).hexdigest()
        if digest in self.by_hash:
            asset_id=self.by_hash[digest];self.by_node[img]=asset_id;return asset_id
        ext={'WEBP':'webp','PNG':'png','JPEG':'jpg','GIF':'gif'}.get(fmt)
        if not ext:
            self.warnings.append({'code':'unsupported_image','image':name,'format':fmt});return None
        stem=slug(Path(name).stem)
        filename=f'{stem}-{digest[:8]}.{ext}'
        (self.directory/filename).write_bytes(raw)
        asset_id=f'asset-{len(self.assets)+1:03d}'
        record={'id':asset_id,'path':'assets/'+filename,'source_name':name,'alt':img.get('alt',''),'width':width,'height':height,'format':fmt,'sha256':digest,'storage':origin}
        self.assets.append(record);self.by_hash[digest]=asset_id;self.by_node[img]=asset_id
        return asset_id

def extract(source, output):
    raw=source.read_bytes();document=html.fromstring(raw.decode('utf-8'))
    containers=document.xpath('//*[@id="mw-content-text"]')
    headings=document.xpath('//*[@id="firstHeading"]')
    if not containers or not headings:raise ValueError('Missing Wiki article container or title')
    content=containers[0];name=text(headings[0])
    output.mkdir(parents=True,exist_ok=True)
    assets=AssetExtractor(document,output/'assets')
    for img in content.xpath('.//img'):assets.extract(img)
    candidates=content.xpath('.//table[contains(concat(" ",normalize-space(@class)," ")," framed-table ")]')
    infobox=next((table for table in candidates if any(text(th)=='Stats' for th in table.xpath('./tbody/tr/th|./tr/th'))),None)
    if infobox is None:raise ValueError('No Naut Stats infobox; this may not be a Naut page')
    stats=pairs(infobox)
    metadata={}
    for label in infobox.xpath('.//b'):
        key=text(label).rstrip(':')
        value=after_label(label)
        if key and value:metadata[key]=value
    portrait=infobox.xpath('.//*[contains(@class,"Awesomenaut-Portrait")]//img')
    abilities=[];seen=set()
    for table in candidates:
        if table.xpath('.//table'):continue
        title_nodes=table.xpath('./tbody/tr/th//b/a|./tr/th//b/a')
        if not title_nodes:continue
        title=title_nodes[0];ability_name=text(title);url=title.get('href')
        if not ability_name or ability_name in seen:continue
        description=[]
        for row in rows(table):
            cells=row.xpath('./td')
            if len(cells)==1 and int(cells[0].get('colspan','1'))>1 and text(cells[0]):description.append(text(cells[0]))
        values=pairs(table)
        if not values:continue
        seen.add(ability_name)
        outer=table.xpath('ancestor::table[1]')
        icons=outer[0].xpath('.//*[contains(@class,"Skill-Icon")]//img') if outer else []
        abilities.append({'name':ability_name,'source_url':url,'description':' '.join(description),'values':values,'icon_asset':assets.extract(icons[0]) if icons else None})
    items=[];seen_items=set()
    for table in content.xpath('.//table[contains(concat(" ",normalize-space(@class)," ")," filled ")]'):
        skill_links=table.xpath('.//*[contains(@class,"Skill-Icon")]//a[@href]')
        group=text(skill_links[0]) or skill_links[0].get('title') if skill_links else None
        for img in table.xpath('.//img'):
            image_name=img.get('data-image-name','')
            # Upgrade tables also use character-specific filenames (e.g.
            # Coco Nebulon Skill1-1.png); identify entries by table structure.
            if img in table.xpath('.//*[contains(@class,"Skill-Icon")]//img')[:1]:continue
            links=img.xpath('ancestor::a[@href][1]')
            if not links:continue
            link=links[0];url=link.get('href')
            if url in seen_items:continue
            seen_items.add(url)
            item_name=link.get('title') or unquote(urlsplit(url).path.rsplit('/',1)[-1]).replace('_',' ')
            items.append({'name':item_name,'source_url':url,'group':group,'icon_asset':assets.extract(img),'cost':None,'effects':None})
    sections={};skins=[]
    excluded=[]
    for heading in content.xpath('.//h2'):
        title=text(heading)
        if excluded_section(title):excluded.append(title);continue
        sections[title]=blocks(heading)
        if title=='Skin Information':
            for sibling in heading.itersiblings():
                if sibling.tag=='h2':break
                if sibling.tag!='h3':continue
                skin_assets=[]
                for node in sibling.itersiblings():
                    if node.tag in ('h2','h3'):break
                    for img in node.xpath('.//img'):
                        asset_id=assets.extract(img)
                        if asset_id and asset_id not in skin_assets:skin_assets.append(asset_id)
                skins.append({'name':text(sibling),'content':blocks(sibling),'assets':skin_assets})
    warnings=list(assets.warnings)
    warnings.extend({'code':'missing_skin_image','skin':skin['name']} for skin in skins if not skin['assets'])
    if items:warnings.append({'code':'item_details_not_in_snapshot','count':len(items),'message':'Item links/icons found; costs and effects require item-page snapshots.'})
    warnings.append({'code':'game_version_unverified','message':'Values are copied verbatim; the snapshot does not establish a verified game version or meaning of parenthesised values.'})
    if not abilities:warnings.append({'code':'no_abilities_detected'})
    canonical=document.xpath('//link[@rel="canonical"]/@href')
    result={'schema_version':SCHEMA_VERSION,'name':name,'slug':slug(name),'source':{'filename':source.name,'url':canonical[0] if canonical else None,'sha256':hashlib.sha256(raw).hexdigest(),'size_bytes':len(raw)},'stats':stats,'metadata':metadata,'portrait_asset':assets.extract(portrait[0]) if portrait else None,'abilities':abilities,'items':items,'skins':skins,'sections':sections,'assets':assets.assets,'diagnostics':{'warnings':warnings,'excluded_sections':excluded,'status':'partial' if any(w['code'].startswith('missing_') for w in warnings) or not abilities else 'extracted'}}
    (output/'naut.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    summary={'name':name,'abilities':len(abilities),'items':len(items),'skins':len(skins),'unique_assets':len(assets.assets),'source_bytes':len(raw),'json_bytes':(output/'naut.json').stat().st_size,'warnings':warnings}
    (output/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    return result

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path);parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args()
    try:
        result=extract(args.source,args.out)
    except (ValueError,OSError) as error:parser.exit(2,f'Extraction failed: {error}\n')
    print(json.dumps({'name':result['name'],'abilities':len(result['abilities']),'items':len(result['items']),'skins':len(result['skins']),'assets':len(result['assets']),'status':result['diagnostics']['status'],'output':str(args.out/'naut.json')},ensure_ascii=False))
    return 2 if result['diagnostics']['status']=='partial' else 0

if __name__=='__main__':raise SystemExit(main())
