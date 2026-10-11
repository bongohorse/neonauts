#!/usr/bin/env python3
"""Publish one timestamped Steam count for the static site; no key required."""
import argparse
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import Request, urlopen

STEAM_URL='https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=204300'

def snapshot(payload):
    data=payload.get('response', {})
    count=data.get('player_count')
    if data.get('result')!=1 or type(count) is not int or count<0:
        raise ValueError('Invalid Steam player count')
    return {'players':count, 'checkedAt':datetime.now(timezone.utc).isoformat()}

def clean_history(history, now=None):
    now=now or datetime.now(timezone.utc)
    points={}
    if not isinstance(history,list):return []
    for point in history[-200:]:
        try:
            count=point['players'];date=datetime.fromisoformat(point['checkedAt'].replace('Z','+00:00'))
            if date.tzinfo is None:continue
            date=date.astimezone(timezone.utc)
            if type(count) is int and 0<=count<=2**53-1 and now-timedelta(hours=24)<=date<=now:
                points[date.isoformat()]={'players':count,'checkedAt':date.isoformat()}
        except (KeyError,ValueError,TypeError,AttributeError):pass
    return [points[k] for k in sorted(points)][-120:]

def previous_history(url, opener=urlopen):
    try:
        with opener(url,timeout=15) as response:
            return clean_history(json.loads(response.read(256000)).get('history',[]))
    except (OSError,ValueError,TypeError,AttributeError):return []

def combine_previous_histories(urls, opener=urlopen):
    """Preserve validated samples if any one published history is unavailable."""
    points=[]
    for url in urls or []:
        if not url.startswith('https://'):
            raise ValueError('history-url must use HTTPS')
        points.extend(previous_history(url, opener=opener))
    # Each origin is already bounded and validated. Sort before the final
    # bounded cleanup so source order cannot discard newer samples.
    unique={point['checkedAt']:point for point in points}
    return clean_history([unique[key] for key in sorted(unique)[-120:]])

def publish(destination, opener=urlopen, history=None):
    points=clean_history(history)
    try:
        request=Request(STEAM_URL,headers={'User-Agent':'Neonauts-player-count/1.0'})
        with opener(request,timeout=20) as response:
            data=snapshot(json.load(response))
    except (OSError, ValueError, TypeError, AttributeError) as error:
        # Never present a failed fetch as zero or preserve a misleading old count.
        data={'players':None,'checkedAt':None}
        print(f'Steam count unavailable: {type(error).__name__}')
    if data['players'] is not None:points=clean_history(points+[data])
    data['history']=points
    destination.write_text(json.dumps(data,separators=(',',':'))+'\n',encoding='utf-8')
    return data

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--out',type=Path,default=Path(__file__).resolve().parents[1]/'dist/players.json')
    parser.add_argument('--history-url',action='append',default=[],
                        help='Previous published players.json; repeat to merge multiple sources')
    args=parser.parse_args()
    if any(not url.startswith('https://') for url in args.history_url):
        parser.error('history-url must use HTTPS')
    publish(args.out,history=combine_previous_histories(args.history_url))
