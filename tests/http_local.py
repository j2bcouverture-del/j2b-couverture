"""Parcours HTTP local complet avec un récepteur ntfy et un récepteur Sheets de test."""
import json,os,tempfile,threading,uuid,sys,time,urllib.request
from pathlib import Path
from http.server import BaseHTTPRequestHandler,HTTPServer
from wsgiref.simple_server import make_server,WSGIRequestHandler
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
import app
class Quiet(WSGIRequestHandler):
    def log_message(self,*args):pass
class Peers(BaseHTTPRequestHandler):
    notifications=[];leads=set()
    def log_message(self,*args):pass
    def do_POST(self):
        data=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        if self.path=='/sheet':
            self.leads.add(data['id']);result={'receipt':data['id']}
        else:
            assert self.headers['Authorization']=='Bearer local'
            self.notifications.append(data);result={'id':str(uuid.uuid4())}
        self.send_response(200);self.end_headers();self.wfile.write(json.dumps(result).encode())
def serve(server):
    threading.Thread(target=server.serve_forever,daemon=True).start();return 'http://127.0.0.1:'+str(server.server_port)
with tempfile.TemporaryDirectory() as tmp:
    peer=serve(HTTPServer(('127.0.0.1',0),Peers))
    api=serve(make_server('127.0.0.1',0,app.application,handler_class=Quiet))
    origin='https://recette.invalid'
    os.environ.update(J2B_DB=tmp+'/db',J2B_ORIGIN=origin,NTFY_BASE=peer,NTFY_TOPIC='test',NTFY_TOKEN='local',SHEETS_URL=peer+'/sheet',SHEETS_SECRET='test')
    app.init();sid=str(uuid.uuid4());view=str(uuid.uuid4())
    def post(path,data):
        req=urllib.request.Request(api+path,data=json.dumps(data).encode(),headers={'Origin':origin})
        with urllib.request.urlopen(req) as r:return json.load(r)
    def event(t,**kw):return dict(type=t,t=int(time.time()*1000),view=view,id=str(uuid.uuid4()),page='index.html',**kw)
    post('/events',{'session':sid,'events':[event('page'),event('call'),event('start',form='heroQuoteForm')]})
    rid=str(uuid.uuid4())
    body={'id':rid,'form':'heroQuoteForm','fields':{'phone':'0600000000','consent':True},'session':sid}
    for _ in range(2):assert post('/lead',body)=={'receipt':rid}
    with app.db() as c:app.sweep(c,int(time.time())+1802)
    for _ in range(10):app.deliver()
    titles=[x['title'] for x in Peers.notifications]
    assert titles.count('Demande de devis confirmée')==1 and titles.count('Rapport final')==1 and len(Peers.leads)==1
    assert '0600000000' not in json.dumps(Peers.notifications) and 'Formulaire interrompu' not in titles
    print('Reçus par le serveur HTTP ntfy de test :',titles)
