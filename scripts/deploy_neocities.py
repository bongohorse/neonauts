#!/usr/bin/env python3
"""Upload a validated dist directory to Neocities. Never deletes remote files."""
import argparse
import json
import os
import uuid
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError

def multipart(files, boundary):
    body=bytearray()
    for name,path in files:
        if any(c in name for c in ['"','\r','\n']):raise ValueError('Unsafe upload filename')
        body.extend(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{path.name}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode())
        body.extend(path.read_bytes());body.extend(b'\r\n')
    body.extend(f'--{boundary}--\r\n'.encode())
    return bytes(body)

def deploy(directory):
    from check import check
    check(directory)
    key=os.environ.get('NEOCITIES_API_KEY')
    if not key:raise ValueError('NEOCITIES_API_KEY is required; use a GitHub Actions secret or your local environment')
    files=[(p.relative_to(directory).as_posix(),p) for p in sorted(directory.rglob('*')) if p.is_file() and not any(s.startswith('.') for s in p.relative_to(directory).parts)]
    if not files:raise ValueError('No build files found')
    # The current build is small; one request avoids bursts of API calls.
    boundary='neonauts-'+uuid.uuid4().hex
    request=Request('https://neocities.org/api/upload',data=multipart(files,boundary),headers={'Authorization':'Bearer '+key,'Content-Type':'multipart/form-data; boundary='+boundary},method='POST')
    try:
        with urlopen(request,timeout=120) as response:result=json.load(response)
    except HTTPError as error:
        raise RuntimeError(f'Neocities upload failed (HTTP {error.code})') from None
    if result.get('result')!='success':raise RuntimeError('Neocities rejected the upload: '+str(result.get('error_type','unknown')))
    print(f'Uploaded {len(files)} files. Existing remote files were not deleted.')

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--directory',type=Path,default=Path(__file__).resolve().parents[1]/'dist')
    deploy(parser.parse_args().directory)
