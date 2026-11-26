// Configurer ce sous-domaine HTTPS avant la bascule.
window.J2B_API = 'https://suivi.j2b-couverture.fr';
window.J2B_SOURCES=['google.fr','google.com','www.google.fr','www.google.com','www.facebook.com','l.facebook.com','j2b-couverture.fr'];
window.J2B_UTM=['google','cpc','facebook','organic'];
(() => {
  const attempts = new Map();
  window.J2BLead = {
    async submit(form, fields) {
      const signature = JSON.stringify(fields);
      const last = attempts.get(form);
      const id = last?.signature === signature ? last.id : crypto.randomUUID();
      attempts.set(form, {signature, id});
      window.dispatchEvent(new CustomEvent('j2b-submit', {detail:{form}}));
      try {
        const response = await fetch(window.J2B_API + '/lead', {
          method:'POST', headers:{'Content-Type':'application/json'}, credentials:'omit',
          referrerPolicy:'no-referrer', body:JSON.stringify({id, form, fields, session:window.j2bSession?.() || null})
        });
        const receipt = await response.json();
        if (!response.ok || receipt.receipt !== id) throw Error('Réception non confirmée');
        attempts.delete(form);
        window.dispatchEvent(new CustomEvent('j2b-result', {detail:{form, ok:true}}));
      } catch (error) {
        window.dispatchEvent(new CustomEvent('j2b-result', {detail:{form, ok:false}}));
        throw error;
      }
    }
  };
})();
(() => {
  function syncGoogle() {
    let enabled=false;
    try {enabled=localStorage.getItem('j2b_choice_v10')==='accepted';} catch {}
    for(const id of ['G-ZGCBS6FYZR','AW-16552414221'])window['ga-disable-'+id]=!enabled;
    if(!enabled){window.j2bGoogleLoaded=false;return;}
    if(typeof window.loadGoogleTags==='function') {window.loadGoogleTags();return;}
    if(window.j2bGoogleLoaded)return;
    window.j2bGoogleLoaded=true;
    window.dataLayer ||= [];
    window.gtag=function(){if(window.j2bGoogleLoaded)window.dataLayer.push(arguments);};
    const script=document.createElement('script');script.async=true;
    script.src='https://www.googletagmanager.com/gtag/js?id=G-ZGCBS6FYZR';
    document.head.append(script);
    window.gtag('js',new Date());window.gtag('config','G-ZGCBS6FYZR');
  }
  window.addEventListener('storage',syncGoogle);
  window.addEventListener('j2b-choice',syncGoogle);
  syncGoogle();
})();
