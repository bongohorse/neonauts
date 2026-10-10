#!/usr/bin/env python3
"""Publish one timestamped Steam count for the static site; no key required."""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

STEAM_URL='https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=204300'

def snapshot(payload):
    data=payload.get('response', {})
    count=data.get('player_count')
    if data.get('result')!=1 or type(count) is not int or count<0:
        raise ValueError('Invalid Steam player count')
    return {'players':count, 'checkedAt':datetime.now(timezone.utc).isoformat()}

def publish(destination, opener=urlopen):
    try:
        request=Request(STEAM_URL,headers={'User-Agent':'Neonauts-player-count/1.0'})
        with opener(request,timeout=20) as response:
            data=snapshot(json.load(response))
    except (OSError, ValueError, TypeError, AttributeError) as error:
        # Never present a failed fetch as zero or preserve a misleading old count.
        data={'players':None,'checkedAt':None}
        print(f'Steam count unavailable: {type(error).__name__}')
    destination.write_text(json.dumps(data,separators=(',',':'))+'\n',encoding='utf-8')
    return data

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--out',type=Path,default=Path(__file__).resolve().parents[1]/'dist/players.json')
    publish(parser.parse_args().out)
