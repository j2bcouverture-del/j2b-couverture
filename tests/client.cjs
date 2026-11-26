// Modèle DOM contrôlé : exécute le fichier public, avec transport et horloge simulés.
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const script=fs.readFileSync(require('node:path').join(__dirname,'../ntfy-visites.js'),'utf8');
function run(ua,device=false) {
  const window=new EventTarget(),document=new EventTarget(), data=new Map(),consent=new Map(),requests=[];
  const storage=m=>({getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)});
  let now=100000,timer,offline=false;
  Object.assign(document,{hidden:false,querySelectorAll:()=>[],documentElement:{scrollHeight:2000}});
  const env={window,document,navigator:{userAgent:ua,webdriver:false,maxTouchPoints:device?5:0,sendBeacon:(url,body)=>{requests.push(JSON.parse(body));return true}},
    crypto:{randomUUID},localStorage:storage(consent),sessionStorage:storage(data),performance:{now:()=>now,getEntriesByType:()=>[]},
    location:{pathname:'/index.html',search:'?utm_source=person%40example.org'},URL,URLSearchParams,Date:class extends Date {static now(){return now}},
    J2B_API:'https://test.invalid',innerHeight:800,innerWidth:400,scrollY:0,AbortController,
    IntersectionObserver:class {observe(){}disconnect(){}},setTimeout:fn=>(timer=fn,1),clearTimeout:()=>{},
    fetch:async(url,opt)=>{if(offline)throw Error('offline');if(url.endsWith('/events'))requests.push(JSON.parse(opt.body));return {ok:true,status:200}}};
  window.J2B_UTM=[];window.J2B_SOURCES=[];
  vm.runInNewContext(script,env);assert.equal(requests.length,0);assert.equal(data.size,0);
  consent.set('j2b_choice_v10','refused');window.dispatchEvent(new Event('j2b-choice'));assert.equal(data.size,0);
  consent.set('j2b_choice_v10','accepted');window.dispatchEvent(new Event('j2b-choice'));
  return {requests,window,document,consent,data,advance:ms=>{now+=ms;timer()},offline:v=>offline=v};
}
(async()=>{
 for(const [ua,mobile] of [['Desktop Chrome/123',false],['iPhone Mobile Safari/605',true]]) {
   const t=run(ua,mobile);await new Promise(setImmediate);
   const first=t.requests[0].events[0];assert.equal(first.type,'page');assert.equal(first.device,mobile?'mobile':'ordinateur');
   assert(!JSON.stringify(first).includes('example.org'));assert.deepEqual(Array.from(first.signals),[]);
   t.advance(46000);await new Promise(setImmediate);
   assert.equal(t.requests.at(-1).events.at(-1).state,'idle');assert.equal(t.requests.at(-1).events.at(-1).active,10);
   t.document.hidden=true;t.document.dispatchEvent(new Event('visibilitychange'));t.advance(60000);
   t.document.hidden=false;t.document.dispatchEvent(new Event('visibilitychange'));await new Promise(setImmediate);
   assert.equal(t.requests.at(-1).events.at(-1).active,10);
   t.offline(true);t.advance(16000);await new Promise(setImmediate);assert(JSON.parse(t.data.get('j2b_session_v10')).queue.length>0);
   t.offline(false);t.window.dispatchEvent(new Event('online'));await new Promise(setImmediate);assert.equal(JSON.parse(t.data.get('j2b_session_v10')).queue.length,0);
   t.window.dispatchEvent(new Event('pagehide'));assert.equal(t.requests.at(-1).events.at(-1).type,'hide');
   t.consent.set('j2b_choice_v10','refused');t.window.dispatchEvent(new Event('j2b-choice'));assert.equal(t.data.size,0);
 }
 console.log('Deux profils DOM simulés : consentement, arrivée, inactivité, arrière-plan, reprise, hors ligne, fermeture et retrait OK.');
})().catch(e=>{console.error(e);process.exitCode=1});
