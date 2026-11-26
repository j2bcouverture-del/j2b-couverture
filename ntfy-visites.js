(() => {
  'use strict';
  if (window.j2bTrackingInstalled) return;
  window.j2bTrackingInstalled = true;
  const key = 'j2b_session_v10', ttl = 30 * 60000;
  const choice = () => {try {return localStorage.getItem('j2b_choice_v10') === 'accepted'} catch {return false}};
  let stop, lastId;
  function reconcile() {
    if (choice()) { if (!stop) stop = start(); return; }
    if (stop) stop();
    stop = null;
    try { lastId ||= JSON.parse(sessionStorage.getItem(key))?.id; sessionStorage.removeItem(key); } catch {}
    if (lastId) {
      fetch(J2B_API+'/forget',{method:'POST',body:lastId,keepalive:true,referrerPolicy:'no-referrer'}).catch(()=>{});
      lastId=null;
    }
  }
  window.addEventListener('storage', reconcile);
  window.addEventListener('j2b-choice', reconcile);
  window.addEventListener('pageshow',reconcile);
  function start() {
    const controller = new AbortController(), signal = controller.signal;
    const on = (target,name,fn,opts={}) => target.addEventListener(name,fn,{signal,...opts});
    let session;
    try {session=JSON.parse(sessionStorage.getItem(key));} catch {}
    if (!session || Date.now()-session.at >= ttl) session={id:crypto.randomUUID(),at:Date.now(),queue:[]};
    lastId=session.id;
    window.j2bSession=()=>choice() ? session.id : null;
    const page=location.pathname.split('/').pop() || 'index.html';
    const view=crypto.randomUUID(), observed=new Set();
    let previous=performance.now(), activity=previous, active=0, lastClick=0, element=0, button=0;
    let section=0, dwell=0, ratio=0, depth=0, maxY=0, busy=false, timer, heartbeat=0, lastTap=0;
    let interacted=false,first=0, field=0, complete=0, total=0, form='', state='active', n=0, lastMove, moves=0, motions=0, scrolls=0;
    const signals=new Set(), friction=new Set();
    const ua=navigator.userAgent;
    if (/bot\b|crawler|spider|slurp|preview|scanner|facebookexternalhit/i.test(ua)) signals.add('declared');
    if (/Headless/i.test(ua)) signals.add('headless');
    if (navigator.webdriver) signals.add('webdriver');
    const device=/Mobile|Android|iPhone/i.test(ua)?'mobile':'ordinateur';
    const browser=/Edg\//.test(ua)?'Edge':/Firefox|FxiOS/.test(ua)?'Firefox':/Chrome|CriOS/.test(ua)?'Chrome':/Safari/.test(ua)?'Safari':'autre';
    const id=el=>Number(el?.dataset?.v)||0;
    const scope='section,article,form,header,footer,nav';
    const controls='button,a[href],summary,[role=button]';
    const observer=new IntersectionObserver(entries=>{
      for(const e of entries) {if(e.isIntersecting) observed.add(e.target); else observed.delete(e.target);}
      sample();
    }, {threshold:[0,.1,.25,.5,.75,1]});
    document.querySelectorAll(scope+','+controls+',img,h1,h2,h3').forEach(el=>observer.observe(el));
    function sample(){
      const now=performance.now();
      if(!document.hidden && state!=='hidden') {
        active+=Math.max(0,Math.min(now,activity+10000)-previous);
        dwell+=Math.max(0,now-previous);
        let best=0, chosen=0, pct=0, lastButton=0, lastElement=0, bottom=-1;
        for(const el of observed){
          const r=el.getBoundingClientRect(), h=Math.min(innerHeight,r.bottom)-Math.max(0,r.top);
          if(h<=0 || r.right<=0 || r.left>=innerWidth || !el.getClientRects().length) continue;
          if(el.matches(scope) && h>=best && id(el)){best=h;chosen=id(el);pct=Math.round(100*h/Math.max(1,r.height));}
          if(el.matches(controls) && r.top>=bottom){bottom=r.top;lastButton=id(el);}
          if(el.matches('h1,h2,h3,img') && r.top>=0)lastElement=id(el);
        }
        if(chosen!==section) dwell=0;
        section=chosen;ratio=pct;button=lastButton;element=lastElement;
        maxY=Math.max(maxY,Math.round(scrollY));
        depth=Math.max(depth,Math.min(100,Math.round(100*scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight))));
      }
      previous=now;
    }
    function persist(){try{sessionStorage.setItem(key,JSON.stringify(session));}catch{}}
    function enqueue(type, urgent=false){
      if(!choice()||signal.aborted)return;
      sample();
      const t=Date.now(), params=new URLSearchParams(location.search);
      const event={id:crypto.randomUUID(),view,page,type,t,n:++n,active:Math.round(active/1000),section,dwell:Math.round(dwell/1000),ratio,depth,maxY,
        element,button,lastClick, gap:Math.round((performance.now()-activity)/1000),interacted,signals:[...signals],friction:[...friction],form,first,field,complete,total,state,device,browser};
      if(type==='page'){
        const host=document.referrer ? new URL(document.referrer).hostname : '';
        event.source=window.J2B_SOURCES.includes(host)?host:'';
        event.utm=Object.fromEntries(['source','medium','campaign','term','content'].map(k=>[k,window.J2B_UTM.includes(params.get('utm_'+k)) ? params.get('utm_'+k) : '']));
        if(performance.getEntriesByType('navigation')[0]?.type==='back_forward') event.state='back';
      }
      session.queue.push(event); session.at=t;
      while(session.queue.length>100)session.queue.splice(Math.max(0,session.queue.findIndex(e=>e.type==='pulse')),1);
      persist();if(urgent)flush();
    }
    async function flush(leaving=false){
      if(!choice()||signal.aborted||!session.queue.length)return;
      const events=session.queue.slice(0,12), body=JSON.stringify({session:session.id,events});
      if(leaving && navigator.sendBeacon?.(J2B_API+'/events',body))return;
      if(busy)return;busy=true;
      try {
        const response=await fetch(J2B_API+'/events',{method:'POST',body,keepalive:true,referrerPolicy:'no-referrer',signal});
        if(response.status===410){controller.abort();observer.disconnect();clearTimeout(timer);sessionStorage.removeItem(key);stop=null;reconcile();return;}
        if(!response.ok) return;
        if(signal.aborted||!choice())return;
        session.queue=session.queue.filter(e=>!events.some(sent=>sent.id===e.id));persist();
      } catch {} finally {busy=false;}
    }
    function touch(e) {
      if(!e.isTrusted || document.hidden)return;
      const now=performance.now();
      if(e.type==='pointermove' && now-activity<120)return;
      sample();
      if(now-activity>700 && now-activity<10000 && active>2500)signals.add('paced');
      activity=now;interacted=true;
      if(state==='idle')state='active';
      if(e.type==='pointermove' && e.pointerType==='mouse'){
        if(lastMove && e.clientX!==lastMove[0] && e.clientY!==lastMove[1])moves++;
        lastMove=[e.clientX,e.clientY];if(moves>=4)signals.add('mouse');
      }
      if(e.pointerType==='touch' && navigator.maxTouchPoints && ++motions>=2)signals.add('touch');
      if(e.type==='wheel' && ++scrolls>=2)signals.add('scroll');
    }
    for(const type of ['pointermove','pointerdown','wheel','touchstart','keydown'])on(document,type,touch,{passive:true});
    on(document,'click',e=>{
      const el=e.target.closest(controls);touch(e);
      if(!el){if(!e.target.closest('input,textarea,select,label,[contenteditable]'))friction.add('noninteractive');return;}
      if(el===lastTap && performance.now()-lastClickTime<600){friction.add('repeat');
        const interval=Math.round(performance.now()-lastClickTime);
        repeats=Math.abs(interval-lastInterval)<8 ? repeats+1 : 0;lastInterval=interval;if(repeats>=5)signals.add('regular');
      }
      lastTap=el;lastClickTime=performance.now();lastClick=id(el);
      if(e.isTrusted) signals.add('click');
      const href=el.getAttribute('href')||'';
      const type=href.startsWith('tel:')?'call':/^https:\/\/(wa\.me|api\.whatsapp\.com)\//.test(href)?'whatsapp':el.matches('[type=submit]')?'send_click':el.closest('nav')?'menu':'click';
      enqueue(type,true);
    },{capture:true});
    let lastClickTime=0,lastInterval=0,repeats=0;
    function fieldEvent(e){
      const el=e.target, container=el.closest('form,#quoteWizard');
      if(!container || !el.matches('input:not([type=hidden]),select,textarea') || el.name==='website')return;
      const name=container.id;
      if(form!==name){form=name;first=0;field=0;complete=0;total=0;enqueue('open');}
      field=id(el)||dynamicField(el);if(!first)first=field;
      if(e.type==='focusin')return;
      const inputs=[...container.querySelectorAll('input:not([type=hidden]),textarea,select')].filter(x=>x.name!=='website');
      total=inputs.length;complete=inputs.filter(x=>x.type==='checkbox'?x.checked:x.value.length>0).length;
      if(!started.has(form)){started.add(form);enqueue('start',true);}else enqueue('progress');
    }
    function dynamicField(el){return 10001+['need','city','customer','phone','email','message','consent'].indexOf(el.name);}
    const started=new Set();
    on(document,'focusin',fieldEvent);on(document,'change',fieldEvent);
    on(document,'input',e=>{if(e.target.matches('input,select,textarea') && !started.has(e.target.closest('form,#quoteWizard')?.id))fieldEvent(e);});
    on(document,'invalid',e=>{field=id(e.target);form=e.target.form?.id||'';enqueue('validation');},{capture:true});
    for(const type of ['whatsapp','call'])on(window,'j2b-'+type,()=>enqueue(type,true));
    on(window,'j2b-validation',e=>{form=e.detail.form;field=id(document.getElementById(e.detail.field));enqueue('validation',true);});
    on(document,'submit',e=>{form=e.target.id;enqueue('submit');},{capture:true});
    on(window,'j2b-submit',e=>{form=e.detail.form;enqueue('attempt',true);});
    on(window,'j2b-result',e=>{form=e.detail.form;if(e.detail.ok)started.delete(form);enqueue(e.detail.ok?'receipt':'error',true);});
    on(window,'error',()=>friction.add('js'));
    on(window,'load',()=>{if(performance.now()>4000)friction.add('slow');});
    on(window,'online',()=>flush());
    on(document,'visibilitychange',()=>{if(document.hidden){
      const end=performance.now();active+=Math.max(0,Math.min(end,activity+10000)-previous);dwell+=Math.max(0,end-previous);previous=end;
      state='hidden';enqueue('hidden');flush(true);
    }else{previous=activity=performance.now();state='active';enqueue('resume',true);}});
    on(window,'pagehide',()=>{state='leaving';enqueue('hide');flush(true);});
    on(window,'pageshow',e=>{if(e.persisted){try{const saved=JSON.parse(sessionStorage.getItem(key));if(saved?.id===session.id)session=saved;}catch{} previous=activity=performance.now();state='active';enqueue('resume',true);}});
    function tick(){
      if(!choice()){reconcile();return;}
      sample();
      if(!document.hidden){state=performance.now()-activity>=10000?'idle':'active';
        if(Date.now()-heartbeat>=(state==='idle'?45000:15000)){heartbeat=Date.now();enqueue('pulse',true);}
      }
      timer=setTimeout(tick,document.hidden?15000:1000);
    }
    enqueue('page',true);heartbeat=Date.now();tick();
    return ()=>{clearTimeout(timer);observer.disconnect();controller.abort();delete window.j2bSession;};
  }
  reconcile();
})();
