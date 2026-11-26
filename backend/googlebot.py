"""Exécuter une fois par jour côté serveur, hors chemin des requêtes."""
import ipaddress
import json
import os
import tempfile
import urllib.request
from pathlib import Path

def refresh():
    dest=Path(os.environ['GOOGLEBOT_RANGES'])
    url='https://developers.google.com/static/crawling/ipranges/common-crawlers.json'
    with urllib.request.urlopen(url,timeout=10) as f: payload=json.load(f)
    networks=[str(ipaddress.ip_network(next(x[k] for k in ('ipv4Prefix','ipv6Prefix') if k in x))) for x in payload['prefixes']]
    if not networks:raise ValueError('Aucun préfixe')
    with tempfile.NamedTemporaryFile(mode='w',dir=dest.parent,delete=False) as tmp:
        json.dump(networks,tmp)
    os.replace(tmp.name,dest)

if __name__=='__main__':refresh()
