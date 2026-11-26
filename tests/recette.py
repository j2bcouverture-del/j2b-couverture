"""Recette locale, Chromium + collecteur + services de test en boucle locale."""
from pathlib import Path
import contextlib, functools, http.server, json, os, sys, tempfile, threading, time, uuid
from wsgiref.simple_server import make_server, WSGIRequestHandler
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'backend'))
import app
class Quiet(WSGIRequestHandler):
    def log_message(self,*args):pass
class Static(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
class Mock(http.server.BaseHTTPRequestHandler):
    rows=set(); notifications=[];fail=False
    def log_message(self,*args):pass
    def do_POST(self):
        body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        if self.path=='/sheet':
            if self.fail:self.send_error(503);return
            self.rows.add(body['id']);result={'receipt':body['id']}
        else:self.notifications.append(body);result={'id':str(uuid.uuid4())}
        self.send_response(200);self.end_headers();self.wfile.write(json.dumps(result).encode())
def serve(server):
    threading.Thread(target=server.serve_forever,daemon=True).start()
    return 'http://127.0.0.1:'+str(server.server_port)
def rows():
    with app.db() as c:return [json.loads(r[0]) for r in c.execute('select data from events order by t,rowid')]
def wait(page,fn):
    for _ in range(70):
        page.wait_for_timeout(100)
        if fn():return
    raise AssertionError('Attente expirée')
with tempfile.TemporaryDirectory() as tmp, sync_playwright() as pw:
    site=serve(http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Static,directory=ROOT)))
    mock=serve(http.server.ThreadingHTTPServer(('127.0.0.1',0),Mock))
    api=serve(make_server('127.0.0.1',0,app.application,handler_class=Quiet))
    os.environ.update(J2B_ORIGIN=site,J2B_DB=tmp+'/db',NTFY_BASE=mock,NTFY_TOKEN='test',NTFY_TOPIC='test',SHEETS_URL=mock+'/sheet',SHEETS_SECRET='test')
    app.init()
    engine=os.getenv('BROWSER_ENGINE','chromium');binary=os.getenv('CHROMIUM_PATH')
    browser=getattr(pw,engine).launch(**({'executable_path':binary} if binary and engine=='chromium' else {}))
    def context(**opts):
        c=browser.new_context(**opts)
        def route(r):
            if r.request.url.startswith(site+'/lead-config.js'):
                r.fulfill(content_type='text/javascript',body=(ROOT/'lead-config.js').read_text().replace('https://suivi.j2b-couverture.fr',api))
            elif r.request.url.startswith((site,api)):r.continue_()
            else:r.abort()
        c.route('**/*',route);return c
    c=context();p=c.new_page();errors=[]
    p.on('pageerror',lambda e:errors.append((p.url,str(e))))
    for name in app.CAT:
        p.goto(site+'/'+name);assert p.evaluate('window.j2bTrackingInstalled'),name
    assert not rows();print('31 pages chargées sans collecte préalable. Erreurs JS :',errors);assert not errors
    p.goto(site);p.click('#refuseCookies');p.reload();assert not rows()
    p.click('#cookieSettingsBtn');p.click('#acceptCookies');wait(p,lambda:bool(rows()));sess=p.evaluate('j2bSession()')
    assert app.assess(rows())[0]==2
    p.locator('#heroQuoteForm button[type=submit]').click();wait(p,lambda:any(r['type']=='validation' for r in rows()))
    p.select_option('#heroNeed',index=1);p.fill('#heroPhone','0600000000');p.check('#heroConsent')
    assert not Mock.rows
    Mock.fail=True;p.locator('#heroQuoteForm button[type=submit]').click()
    wait(p,lambda:any(r['type']=='error' for r in rows()))
    Mock.fail=False;p.locator('#heroQuoteForm button[type=submit]').click()
    wait(p,lambda:any(r['type']=='confirmed' for r in rows()));assert len(Mock.rows)==1
    for sel,kind in [('a[href^="tel:"]','call'),('a[href^="https://wa.me"]','whatsapp')]:
        p.locator(sel).first.evaluate("a=>{a.addEventListener('click',e=>e.preventDefault(),{once:true});a.click()}")
        wait(p,lambda:any(r['type']==kind for r in rows()))
    p.goto(site+'/zinguerie.html');assert p.evaluate('j2bSession()')==sess
    p.select_option('#j2bAutoQuoteForm select',index=1);p.fill('#j2bAutoQuoteForm [name=city]','VALEUR_PRIVEE');p.locator('#j2bAutoQuoteForm [name=phone]').focus()
    p.goto(site+'/contact.html');p.go_back();p.wait_for_timeout(300)
    assert 'VALEUR_PRIVEE' not in json.dumps(rows()) and '0600000000' not in json.dumps(rows())
    # Suspension/réveil simulés : la livraison utilise la vraie API HTTP.
    p.evaluate("""()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));}""")
    wait(p,lambda:any(r['type']=='hidden' for r in rows()))
    p.evaluate("""()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));}""")
    wait(p,lambda:any(r['type']=='resume' for r in rows()))
    c.set_offline(True);p.evaluate("document.querySelector('button').click()");p.wait_for_timeout(350)
    assert p.evaluate("JSON.parse(sessionStorage.j2b_session_v10).queue.length")>0
    c.set_offline(False);p.evaluate("dispatchEvent(new Event('online'))");wait(p,lambda:p.evaluate("JSON.parse(sessionStorage.j2b_session_v10).queue.length")==0)
    p.close()
    with app.db() as con:
        app.sweep(con,int(time.time())+1801);app.sweep(con,int(time.time())+1802)
        assert con.execute("select count(*) from messages where kind='final'").fetchone()[0]==1
        assert con.execute("select count(*) from messages where kind='abandon'").fetchone()[0]>=1
        assert app.assess(app.events(con,sess))[2]==5
    for _ in range(25):app.deliver()
    assert any(x['title']=='Rapport final' for x in Mock.notifications)
    print('Formulaire réel sur accueil : validation, échec, reprise, écriture simulée confirmée. Parcours, CTA, abandon, hors ligne, onglet masqué, fermeture, déduplication et ntfy local OK.')
    profile=dict(pw.devices['iPhone 13']);profile.pop('default_browser_type',None);
    if engine=='firefox':profile.pop('is_mobile',None)
    phone=context(**profile);m=phone.new_page();m.goto(site);m.tap('#acceptCookies')
    m.locator('#heroPhone').tap();m.wait_for_timeout(250);assert rows()[-1]['device']=='mobile'
    m.click('#cookieSettingsBtn');wait(m,lambda:m.evaluate("sessionStorage.getItem('j2b_session_v10')===null"));phone.close()
    print('Profil mobile émulé et retrait OK :', engine)
    e=rows()[0] if rows() else None
    if e:
        for sig,verified,expected in [([],False,2),(['webdriver'],False,2),(['declared'],False,2),(['webdriver','headless'],False,1),(['declared'],True,0),(['mouse','click','paced','scroll'],False,4)]:
            assert app.assess([dict(e,signals=sig,verified=verified)])[0]==expected
    print('Classifications sur signaux contrôlés OK.')
    browser.close()
