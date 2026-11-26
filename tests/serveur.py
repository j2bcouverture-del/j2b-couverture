import io,json,os,sys,tempfile,time,unittest,uuid
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'backend'))
import app
ident=lambda:str(uuid.uuid4())
class Recette(unittest.TestCase):
 def setUp(self):
    self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
    os.environ.update(J2B_DB=self.temp.name+'/db',J2B_ORIGIN='https://test.invalid',SHEETS_URL='https://sheet.invalid',SHEETS_SECRET='test',NTFY_BASE='https://ntfy.invalid',NTFY_TOPIC='test',NTFY_TOKEN='test')
    app.init();self.s=ident();self.v=ident()
 def request(self,path,data,origin=None):
    body=(data if isinstance(data,str) else json.dumps(data)).encode()
    env=dict(HTTP_ORIGIN=origin or os.environ['J2B_ORIGIN'],REQUEST_METHOD='POST',CONTENT_LENGTH=str(len(body)),PATH_INFO=path)
    env['wsgi.input']=io.BytesIO(body);status=[]
    res=b''.join(app.application(env,lambda s,h:status.append(int(s[:3]))))
    return status[0],json.loads(res)
 def event(self,kind,**fields):
    return dict(id=ident(),view=self.v,t=int(time.time()*1000),page='index.html',type=kind,**fields)
 def send(self,*ev):
    return self.request('/events',{'session':self.s,'events':ev})[0]
 def test_classification(self):
    e=self.event('page')
    for sig,v,expected in [([],False,2),(['webdriver'],False,2),(['declared'],False,2),(['webdriver','headless'],False,1),(['declared'],True,0),(['mouse','click'],False,3),(['touch','paced','click','scroll'],False,4)]:
        r=app.clean(dict(e,signals=sig),int(time.time()),v);self.assertEqual(app.assess([r])[0],expected)
 def test_queue_expiration_and_restart(self):
    e=self.event('page');self.assertEqual(self.send(e,e),200)
    self.assertEqual(self.send(self.event('call'),self.event('whatsapp'),self.event('hidden'),self.event('resume'),self.event('start',form='quoteForm',field=10004,complete=2,total=7)),200)
    with app.db() as c:
        self.assertEqual(len(app.events(c,self.s)),6)
        now=int(time.time());app.sweep(c,now+1801);app.sweep(c,now+1802)
        self.assertEqual(c.execute("select count(*) from messages where kind='final'").fetchone()[0],1)
        kinds={x[0] for x in c.execute('select kind from messages')}
        self.assertTrue({'call','whatsapp','start','abandon','final','hot'}<=kinds)
    self.assertEqual(self.send(e),410)
    self.s=ident();self.assertEqual(self.send(self.event('page')),200)
 def test_receipt_and_delivery(self):
    self.send(self.event('page'));r=ident();body={'id':r,'form':'heroQuoteForm','fields':{'phone':'0600000000','consent':True},'session':self.s}
    with patch.object(app,'post',return_value={'receipt':'wrong'}):self.assertEqual(self.request('/lead',body)[0],503)
    with patch.object(app,'post',return_value={'receipt':r}) as service:
        for _ in range(2):self.assertEqual(self.request('/lead',body),(200,{'receipt':r}))
        self.assertEqual(service.call_count,1)
    with app.db() as c:self.assertEqual(app.assess(app.events(c,self.s))[2],5)
    with patch.object(app,'post',return_value={'id':'local'}) as ntfy:
        for _ in range(5):app.deliver()
        self.assertEqual(ntfy.call_count,2);self.assertNotIn('0600000000',str(ntfy.call_args_list))
 def test_withdraw_and_validation(self):
    e=self.event('page',utm={'source':'secret@example.org'},field=9999,source='example.org')
    self.assertEqual(self.send(e),200)
    with app.db() as c:self.assertNotIn('example.org',str(app.events(c,self.s)))
    self.assertEqual(self.request('/forget',self.s)[0],200)
    self.assertEqual(self.send(e),410)
    with app.db() as c:self.assertFalse(app.events(c,self.s))
    self.assertEqual(self.request('/events',{},'https://other.invalid')[0],403)
    self.assertEqual(self.send(self.event('confirmed')),400)
 def test_lost_ack(self):
    self.send(self.event('page'))
    with patch.object(app,'post',side_effect=TimeoutError()) as ntfy:
        app.deliver();app.deliver();self.assertEqual(ntfy.call_count,1)
    with app.db() as c:self.assertEqual(c.execute('select status from messages').fetchone()[0],'uncertain')
if __name__=='__main__':unittest.main(verbosity=2)
