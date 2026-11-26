"""Collecteur WSGI. Exécuter le processus maintenance séparément."""
import datetime as dt
import ipaddress
import json
import os
import re
import sqlite3
import sys
import time
import urllib.request
import uuid
from pathlib import Path
from contextlib import closing, contextmanager

CAT = json.loads(Path(__file__).with_name('catalog.json').read_text())
TTL = 1800
DAY = 86400
TYPES = set('page pulse click call whatsapp submit send_click menu open start progress validation attempt receipt error hidden resume hide'.split())
FORMS = {'heroQuoteForm','quoteForm','j2bAutoQuoteForm','callbackForm','quoteWizard'}
SIG = set('mouse touch click scroll paced webdriver headless declared regular'.split())
FLAGS = set('noninteractive repeat js slow'.split())
STATES = set('active back idle hidden leaving'.split())
STATUS = {'active':'actif','back':'historique','idle':'inactif','hidden':'onglet masqué','leaving':'page quittée'}
TITLE = {'page':'Nouvelle visite','class':'Identification comportementale','hot':'Prospect chaud','call':'Clic sur Appeler','whatsapp':'Clic sur WhatsApp','start':'Début de formulaire','abandon':'Formulaire interrompu','error':'Erreur de soumission','confirmed':'Demande de devis confirmée','route':'Détail du parcours','final':'Rapport final'}
HUMAN = ['🤖 Robot vérifié','🔴 Automatisation fortement suspectée','🟠 Visiteur indéterminé','🟢 Humain probable','👤 Humain fortement probable']
INTENT = ['⚪ Simple consultation','🔵 Visiteur intéressé','🟡 Prospect potentiel','🟠 Prospect chaud','🔥 Très forte intention commerciale','✅ Conversion confirmée']
WHY = dict(regular='cadence de clic répétitive',mouse='trajectoire du pointeur variée',touch='gestes tactiles sur appareil compatible',click='clic natif',scroll='défilements successifs',paced='interactions espacées',declared='agent de collecte déclaré',webdriver='automatisation déclarée',headless='agent headless',rapid='enchaînement rapide de pages',verified='identité vérifiée au proxy')
@contextmanager
def db():
    with closing(sqlite3.connect(os.environ['J2B_DB'],timeout=8)) as c, c:
        c.row_factory=sqlite3.Row
        c.execute('begin immediate')
        yield c

def init():
    with db() as c:
        c.executescript("""
        create table if not exists sessions(s text primary key, seen integer, closed integer default 0);
        create table if not exists events(id text primary key,s text, t integer, data text);
        create index if not exists session_events on events(s,t);
        create table if not exists messages(k text primary key,s text, kind text, body text, due integer,status text default 'ready',tries integer default 0);
        create table if not exists receipts(id text primary key, at integer);
        """)
def uid(x):
    if not isinstance(x,str) or not re.fullmatch(r'[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}',x): raise ValueError()
    return x

def number(x,limit=86400):
    return max(0,min(limit,int(x))) if isinstance(x,(float,int)) else 0

def clean(e,now,verified):
    page=e['page']
    if page not in CAT or e['type'] not in TYPES: raise ValueError()
    d={k:number(e.get(k)) for k in 'n active dwell ratio depth maxY gap complete total'.split()}
    for k in 'section element button lastClick first field'.split():
        v=number(e.get(k));d[k]=v if str(v) in CAT[page] or 10001<=v<=10007 else 0
    d.update(id=uid(e['id']),view=uid(e['view']),page=page,type=e['type'],t=int(e['t']),form=e.get('form') if e.get('form') in FORMS else '',
             interacted=e.get('interacted') is True,state=e.get('state') if e.get('state') in STATES else 'active', signals=sorted(SIG.intersection(e.get('signals',[]))),
             friction=sorted(FLAGS.intersection(e.get('friction',[]))),verified=verified)
    if not (now-DAY <= d['t']/1000 <= now+60):raise ValueError()
    for key,allowed in [('device',{'mobile','ordinateur'}),('browser',{'Safari','Chrome','Firefox','Edge'})]:
        d[key]=e.get(key) if e.get(key) in allowed else 'autre'
    hosts=set(os.getenv('J2B_SOURCES','google.fr,google.com,www.google.fr,www.google.com,www.facebook.com,l.facebook.com,j2b-couverture.fr').split(','))
    d['source']=e.get('source') if e.get('source') in hosts else 'directe ou inconnue'
    allowed=set(os.getenv('J2B_UTM','google,cpc,facebook,organic').split(','))
    d['utm']={k:v for k,v in e.get('utm',{}).items() if k in {'source','medium','campaign','term','content'} and v in allowed}
    return d

def events(c,s):
    return [json.loads(r[0]) for r in c.execute('select data from events where s=? order by t,rowid',(s,))]

def assess(rows):
    sig=set().union(*(r['signals'] for r in rows)); pages=[r for r in rows if r['type']=='page']
    if len(pages)>=4 and pages[-1]['t']-pages[-4]['t']<2000:sig.add('rapid')
    bad=sig & {'declared','webdriver','headless','rapid','regular'}
    good=sig-bad
    score=max(0,min(100,50+len(good)*11-len(bad)*22))
    if any(r['verified'] for r in rows) and 'declared' in sig: h=0;sig.add('verified')
    elif len(bad)>=2:h=1
    elif len(good)>=4 and not bad:h=4
    elif len(good)>=2 and score>=70:h=3
    else:h=2
    kinds={r['type'] for r in rows}
    services={r['page'] for r in rows if re.search('toiture|zinguerie|charpente|gouttieres|faitage|isolation',r['page'])}
    points=min(25,len(services)*10)+10*any(r['active']>=15 and r['page'] in services for r in rows)
    points+=10*any('avis' in (r['page']+' '+label(r,'section')).lower() and r['dwell']>=3 for r in rows)
    points+=15*(sum(p['page']=='contact.html' for p in pages)>=2)+10*('open' in kinds)+30*('start' in kinds)
    points+=55*bool(kinds & {'call','whatsapp'})+35*('attempt' in kinds)
    points=min(100,points)
    level=5 if 'confirmed' in kinds else 4 if points>=80 else 3 if points>=50 else 2 if points>=30 else 1 if points>=10 else 0
    return h,score,level,points,', '.join(WHY[k] for k in sorted(sig)) or 'indices insuffisants'

def label(r,k):
    v=r[k]
    if 10001<=v<=10007:return ['Prestation','Ville','Nom','Téléphone','E-mail','Message','Accord'][v-10001]
    return CAT[r['page']].get(str(v),'non observé')

def queue(c,s,kind,key,body):
    c.execute('insert or ignore into messages(k,s,kind,body,due) values(?,?,?,?,?)',(s+'/'+key,s,kind,body,int(time.time())))

def report(rows):
    views={}
    for r in rows:views[r['view']]=r
    last=rows[-1];h,score,i,points,reasons=assess(rows)
    route=' → '.join(f"{r['page']} ({r['active']} s actives)" for r in views.values())
    first=rows[0]
    return '\n'.join([f"{HUMAN[h]} · {score}/100 · {reasons}",f"{INTENT[i]} · {points}/100",route,
      f"Arrivée {dt.datetime.fromtimestamp(first['t']/1000,dt.timezone.utc).isoformat()} · {first['source']} · {first['utm']} · {first['device']} / {first['browser']}",
      f"Intervalle observé {(last['t']-first['t'])//1000} s · dernier état {STATUS[last['state']]}",
      f"Dernière section : {label(last,'section')} · {last['dwell']} s · {last['ratio']} % de sa hauteur · "+('affichée ≥ 3 s' if last['dwell']>=3 else 'passage bref'),
      f"Élément visible : {label(last,'element')} · bouton visible : {label(last,'button')}",
      f"Formulaire : {last['form'] or 'aucun'} · premier champ {label(last,'first')} · dernier {label(last,'field')} · progression {last['complete']}/{last['total']}",
      f"Dernier clic : {label(last,'lastClick')} · dernière interaction : {str(last['gap'])+' s auparavant' if last['interacted'] else 'aucune observée'}",
      f"Maximum : {last['depth']} % · {last['maxY']} px",
      'Observations : '+(', '.join(sorted(set().union(*(r['friction'] for r in rows)))) or 'aucune friction signalée')])

def ingest(c,s,batch,verified=False):
    now=int(time.time());uid(s)
    if not isinstance(batch,list) or not 1<=len(batch)<=12:raise ValueError()
    batch=[clean(e,now,verified) for e in batch]
    row=c.execute('select * from sessions where s=?',(s,)).fetchone()
    if row and (row['closed'] or row['seen']<now-TTL):return 410
    c.execute('insert or ignore into sessions(s,seen) values(?,?)',(s,now))
    for e in batch:
        old=events(c,s)
        if len(old)>=2400 or (old and old[0]['t']/1000<now-DAY):return 410
        if not c.execute('insert or ignore into events values(?,?,?,?)',(e['id'],s,e['t'],json.dumps(e))).rowcount:continue
        c.execute('update sessions set seen=? where s=?',(now,s))
        rows=events(c,s);h,score,i,points,why=assess(rows)
        prev=assess(old) if old else (2,50,0,0,'')
        head=f"{e['page']} · {label(e,'section')}\n{HUMAN[h]} · {score}/100 · {why}\n{INTENT[i]} · {points}/100"
        queue(c,s,'page','arrival',head)
        if h!=prev[0]:queue(c,s,'class','class-'+str(h),head)
        if i>=3 and prev[2]<3:queue(c,s,'hot','hot',head)
        if e['type'] in {'call','whatsapp','start','error'}:
            queue(c,s,e['type'],e['type']+'-'+e['view']+'-'+e['form'],head)
    return 200

def forget(c,s):
    uid(s)
    for table in ['events','messages']:c.execute('delete from '+table+' where s=?',(s,))
    c.execute('insert or replace into sessions values(?,?,1)',(s,int(time.time())))

def sweep(c,now):
    for (s,) in c.execute('select s from sessions where closed=0 and seen<=?',(now-TTL,)).fetchall():
        rows=events(c,s)
        if rows:
            unfinished={}
            for r in rows:
                f=r['form']
                if f and r['type'] in {'start','progress','validation','error','attempt'}:unfinished[f]=r
                if r['type'] in {'confirmed','receipt'}:unfinished.pop(f,None)
            for f,r in unfinished.items():
                queue(c,s,'abandon','abandon-'+f,f"{f} · dernier champ {label(r,'field')} · {r['complete']}/{r['total']} · dernier événement {r['type']} · réception non observée")
            summary=report(rows)
            if len(summary.encode())>3800:
                lines=summary.splitlines(); route=lines[2].split(' → '); part=''
                for j,step in enumerate(route):
                    if len((part+step).encode())>3400:
                        queue(c,s,'route','route-'+str(j),part);part=''
                    part+=(' → ' if part else '')+step
                if part:queue(c,s,'route','route-last',part)
                lines[2]='Parcours détaillé dans les notifications associées.';summary='\n'.join(lines)
            queue(c,s,'final','final',summary)
        c.execute('update sessions set closed=1 where s=?',(s,))
    c.execute('delete from events where t<?',((now-DAY)*1000,))
    for table in ['events','messages']:
        c.execute('delete from '+table+' where s in (select s from sessions where seen<?)',(now-DAY,))
    c.execute('delete from sessions where seen<?',(now-DAY,))
    c.execute('delete from receipts where at<?',(now-DAY,))
    c.execute('delete from messages where due<?',(now-DAY,))

def post(url,body,headers):
    req=urllib.request.Request(url,data=json.dumps(body).encode(),headers={'Content-Type':'application/json',**headers})
    with urllib.request.urlopen(req,timeout=12) as response:return json.load(response)

def lead(data):
    rid=uid(data['id']);form=data['form'];fields=data['fields']
    if form not in FORMS or not isinstance(fields,dict):raise ValueError()
    allowed={'phone','need','city','name','email','details','urgency','consent'}
    if fields.keys()-allowed or any(not isinstance(v,(str,bool)) or len(str(v))>4000 for v in fields.values()):raise ValueError()
    if not re.fullmatch(r'[+()\d .-]{6,28}',fields.get('phone','')):raise ValueError()
    if form in {'heroQuoteForm','quoteForm','j2bAutoQuoteForm'} and fields.get('consent') is not True:raise ValueError()
    with db() as c:
        if c.execute('select 1 from receipts where id=?',(rid,)).fetchone():return rid
    receipt=post(os.environ['SHEETS_URL'],{'secret':os.environ['SHEETS_SECRET'],'id':rid,'form':form,'fields':fields},{})
    if receipt.get('receipt')!=rid:raise OSError('Reçu Sheets absent')
    with db() as c:
        if c.execute('insert or ignore into receipts values(?,?)',(rid,int(time.time()))).rowcount:
            s=data.get('session')
            if s and c.execute('select 1 from sessions where s=? and closed=0',(s,)).fetchone():
                rows=events(c,s)
                if rows:
                    r=dict(rows[-1],id=rid,type='confirmed',form=form,t=int(time.time()*1000))
                    c.execute('insert into events values(?,?,?,?)',(rid,s,r['t'],json.dumps(r)))
            else:s='service'
            queue(c,s,'confirmed',rid,'Écriture Google Sheets confirmée · '+form)
    return rid

def deliver():
    with db() as c:
        now=int(time.time());sweep(c,now)
        row=c.execute("select * from messages where status='ready' and due<=? order by due,rowid limit 1",(now,)).fetchone()
        if not row:return
        c.execute("update messages set status='sending',tries=tries+1 where k=?",(row['k'],))
    try:
        r=post(os.environ['NTFY_BASE'],{'topic':os.environ['NTFY_TOPIC'],'title':TITLE[row['kind']],'message':row['body'].encode()[:3960].decode('utf-8','ignore')+'\nRéf. '+row['s'][:8],'priority':5 if row['kind']=='confirmed' else 4 if row['kind'] in {'hot','call','whatsapp','error'} else 2 if row['kind']=='class' else 3},{'Authorization':'Bearer '+os.environ['NTFY_TOKEN'],'Cache':'no'})
        status='sent' if r.get('id') else 'uncertain'
    except urllib.error.HTTPError as exc:
        status='ready' if exc.code==429 else 'failed' if 400<=exc.code<500 else 'uncertain'
    except urllib.error.URLError as exc:
        status='ready' if isinstance(exc.reason,ConnectionRefusedError) else 'uncertain'
    except Exception:status='uncertain'
    with db() as c:c.execute('update messages set status=?,due=? where k=?',(status,int(time.time())+min(600,30*(1+row['tries'])),row['k']))

def verified_google(env):
    path=os.getenv('GOOGLEBOT_RANGES')
    if not path or 'googlebot' not in env.get('HTTP_USER_AGENT','').lower():return False
    try:
        # Le proxy privé remplace ce champ. Aucun en-tête transféré n'est lu par défaut.
        peer=env.get('HTTP_X_J2B_PEER') if os.getenv('J2B_TRUST_LOCAL_PROXY')=='1' and env.get('REMOTE_ADDR') in {'127.0.0.1','::1'} else env.get('REMOTE_ADDR')
        ip=ipaddress.ip_address(peer)
        if time.time()-os.stat(path).st_mtime>2*DAY:return False
        return any(ip in ipaddress.ip_network(net) for net in json.loads(Path(path).read_text()))
    except (OSError,ValueError,TypeError):return False

def application(env,start):
    origin=env.get('HTTP_ORIGIN','');allowed=os.environ['J2B_ORIGIN']
    headers=[('Cache-Control','no-store'),('Content-Type','application/json'),('Vary','Origin')]
    status=403;out={}
    if allowed==origin:
        headers += [('Access-Control-Allow-Origin',origin),('Access-Control-Allow-Methods','POST, OPTIONS'),('Access-Control-Allow-Headers','Content-Type')]
        try:
            path=env['PATH_INFO'];method=env['REQUEST_METHOD'];length=int(env.get('CONTENT_LENGTH') or 0)
            if method=='OPTIONS':status=204
            elif method!='POST':status=405
            elif length>48000:status=413
            else:
                body=env['wsgi.input'].read(length)
                if path=='/forget':
                    with db() as c:forget(c,body.decode())
                    status=200
                elif path=='/events':
                    payload=json.loads(body)
                    with db() as c:status=ingest(c,payload['session'],payload['events'],verified_google(env))
                elif path=='/lead':out={'receipt':lead(json.loads(body))};status=200
                else:status=404
        except (KeyError,ValueError,TypeError,AttributeError,OverflowError):status=400
        except (OSError,sqlite3.Error):status=503
    from http import HTTPStatus
    start(f'{status} {HTTPStatus(status).phrase}',headers)
    return [b'' if status==204 else json.dumps(out).encode()]

if __name__=='__main__':
    init()
    if sys.argv[1:]==['worker']:
        while True:
            deliver();time.sleep(1)
