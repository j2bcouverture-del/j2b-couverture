(function () {
  'use strict';
  if (window.__J2B_AUTO_QUOTE__) return;
  window.__J2B_AUTO_QUOTE__ = true;

  function hasQuoteForm() {
    return Array.from(document.forms).some(function (form) {
      var identity = [form.id, form.className, form.getAttribute('name'), form.getAttribute('action')].join(' ');
      return /quote|devis|contact|heroQuote|j2b-auto/i.test(identity) ||
        Boolean(form.querySelector('input[type="tel"]')) ||
        Boolean(form.querySelector('input[type="email"]') && form.querySelector('textarea'));
    });
  }

  function init() {
    if (hasQuoteForm()) return;
    var style = document.createElement('style');
    style.id = 'j2b-auto-quote-style';
    style.textContent = `
      #j2b-auto-quote{box-sizing:border-box;width:min(920px,92%);margin:40px auto;padding:24px;background:#fff;color:#182536;border:1px solid #e1e3e5;border-top:4px solid #c1a66b;border-radius:18px;box-shadow:0 12px 32px #18253615;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;scroll-margin-top:100px}
      #j2b-auto-quote *{box-sizing:border-box}
      #j2b-auto-quote h2{margin:0 0 10px;font-size:clamp(1.5rem,4vw,2rem);line-height:1.2;color:#182536}
      #j2b-auto-quote p{line-height:1.5;margin:0 0 16px}
      #j2b-auto-quote .j2b-aq-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      #j2b-auto-quote label{display:flex;flex-direction:column;gap:6px;font-weight:700;font-size:.95rem}
      #j2b-auto-quote input,#j2b-auto-quote select,#j2b-auto-quote textarea{width:100%;min-height:46px;padding:11px;border:1px solid #cbd1d8;border-radius:10px;background:#fff;color:#182536;font:inherit}
      #j2b-auto-quote input:focus,#j2b-auto-quote select:focus,#j2b-auto-quote textarea:focus{outline:2px solid #c1a66b;outline-offset:2px}
      #j2b-auto-quote textarea{min-height:100px;resize:vertical}
      #j2b-auto-quote .j2b-aq-full{grid-column:1/-1}
      #j2b-auto-quote .j2b-aq-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
      #j2b-auto-quote .j2b-aq-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 16px;border:0;border-radius:10px;background:#b32025;color:#fff;font:inherit;font-weight:800;text-decoration:none;cursor:pointer}
      #j2b-auto-quote .j2b-aq-secondary{background:#182536}
      #j2b-auto-quote button:disabled{opacity:.6;cursor:wait}
      #j2b-auto-quote .j2b-aq-privacy{margin:14px 0 0;font-size:.8rem;color:#66717c}
      #j2b-auto-quote .j2b-aq-status{margin:12px 0 0;font-weight:700}
      #j2b-auto-quote .j2b-aq-trap{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important}
      @media(max-width:600px){#j2b-auto-quote{padding:20px 16px;margin:28px auto}#j2b-auto-quote .j2b-aq-grid{grid-template-columns:1fr}#j2b-auto-quote .j2b-aq-btn{width:100%}}
    `;
    document.head.appendChild(style);
    var section = document.createElement('section');
    section.id = 'j2b-auto-quote';
    section.dataset.v = '10100';
    section.setAttribute('aria-labelledby', 'j2b-aq-heading');
    section.innerHTML = `
      <h2 id="j2b-aq-heading">Demandez votre devis gratuit</h2>
      <p>Indiquez votre besoin, la ville du chantier et votre téléphone pour être recontacté.</p>
      <form id="j2bAutoQuoteForm" data-v="10100" data-j2b-auto-quote="true">
        <div class="j2b-aq-grid">
          <label>Type de travaux *
            <select name="need" required><option value="">Choisir les travaux</option>
              <option>Fuite / urgence toiture</option><option>Rénovation de toiture</option>
              <option>Zinguerie / gouttières</option><option>Démoussage / entretien</option>
              <option>Faîtage / arêtiers</option><option>Isolation toiture</option>
              <option>Traitement charpente</option><option>Autre besoin toiture</option>
            </select>
          </label>
          <label>Ville du chantier *<input name="city" autocomplete="address-level2" maxlength="120" placeholder="Ville ou code postal" required></label>
          <label>Nom (facultatif)<input name="customer" autocomplete="name" maxlength="120"></label>
          <label>Téléphone *<input name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="30" placeholder="06 12 34 56 78" required></label>
          <label class="j2b-aq-full">E-mail (facultatif)<input name="email" type="email" autocomplete="email" maxlength="180"></label>
          <label class="j2b-aq-full">Précisions (facultatif)<textarea name="message" maxlength="3000" placeholder="Décrivez brièvement les travaux souhaités."></textarea></label>
        </div>
        <label class="j2b-aq-full"><input type="checkbox" name="consent" required> J’accepte que J2B Couverture utilise mes coordonnées pour répondre à ma demande. <a href="/politique-confidentialite.html" target="_blank" rel="noopener">Confidentialité</a> *</label>
        <div class="j2b-aq-trap" aria-hidden="true"><label>Ne pas remplir<input name="website" tabindex="-1" autocomplete="off"></label></div>
        <div class="j2b-aq-actions">
          <button class="j2b-aq-btn" type="submit" data-v="10101">Envoyer ma demande de devis</button>
          <a class="j2b-aq-btn j2b-aq-secondary" data-v="10102" data-aq-wa href="https://wa.me/33601462612" target="_blank" rel="noopener">Envoyer sur WhatsApp</a>
          <a class="j2b-aq-btn j2b-aq-secondary" data-v="10103" data-aq-mail href="mailto:j2b.couverture@gmail.com">Préparer un e-mail</a>
        </div>
        <p class="j2b-aq-status" role="status" aria-live="polite"></p>
        <p class="j2b-aq-privacy">* Champs obligatoires. Vos coordonnées sont utilisées uniquement pour répondre à votre demande.</p>
      </form>`;

    // Réutiliser une ancre de devis vide, sans effacer son contenu.
    var anchor = document.getElementById('devis');
    var footer = document.querySelector('footer');
    var main = document.querySelector('main');
    if (anchor && !/^(A|INPUT|BUTTON|SELECT|TEXTAREA|FORM)$/.test(anchor.tagName)) {
      anchor.appendChild(section);
    } else {
      if (!anchor) {
        var marker = document.createElement('span');
        marker.id = 'devis';
        section.prepend(marker);
      }
      if (main) main.appendChild(section);
      else if (footer) footer.parentNode.insertBefore(section, footer);
      else document.body.appendChild(section);
    }

    var form = section.querySelector('form');
    var status = form.querySelector('.j2b-aq-status');
    var button = form.querySelector('button[type="submit"]');
    var busy = false;
    var lastSent = '';
    function value(name) { return form.elements.namedItem(name).value.trim(); }
    function message() {
      return [
        'DEMANDE DE DEVIS - J2B COUVERTURE', '',
        'Travaux : ' + value('need'), 'Ville : ' + value('city'),
        'Nom : ' + (value('customer') || 'Non renseigné'), 'Téléphone : ' + value('phone'),
        'E-mail : ' + (value('email') || 'Non renseigné'),
        'Précisions : ' + (value('message') || 'Aucune'),
        'Conditions : ' + (form.elements.namedItem('consent').checked ? 'ACCEPTÉES' : 'NON ACCEPTÉES'), '',
        'Page : ' + location.href,
        'Heure : ' + new Date().toLocaleString('fr-FR', {timeZone: 'Europe/Paris'})
      ].join('\n');
    }
    function links() {
      var text = message();
      form.querySelector('[data-aq-wa]').href = 'https://wa.me/33601462612?text=' + encodeURIComponent('Bonjour,\n\n' + text);
      form.querySelector('[data-aq-mail]').href = 'mailto:j2b.couverture@gmail.com?subject=' + encodeURIComponent('Demande de devis - ' + value('city')) + '&body=' + encodeURIComponent(text);
    }
    form.addEventListener('input', links);

    links();
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      if (busy || !form.reportValidity() || value('website')) return;
      var fingerprint = JSON.stringify(['need','city','customer','phone','email','message'].map(value));
      if (fingerprint === lastSent) {
        status.textContent = 'Votre demande a déjà été envoyée.';
        return;
      }
      busy = true;
      button.disabled = true;
      status.style.color = '#182536';
      status.textContent = 'Envoi de votre demande…';
      try {
        await J2BLead.submit(form.id, {
          need:value('need'), city:value('city'), name:value('customer'), phone:value('phone'),
          email:value('email'), details:value('message'), consent:true
        });
        lastSent = fingerprint;
        status.style.color = '#16794b';
        status.textContent = '✓ Demande envoyée. Nous vous recontacterons.';
        if (typeof window.gtag === 'function') {
          window.gtag('event', 'generate_lead', {send_to: 'G-ZGCBS6FYZR', form_id: form.id, page_location: location.href});
          window.gtag('event', 'conversion', {send_to: 'AW-16552414221/vyNqCJ_ttfUcEI2Y59Q9'});
        }
      } catch (error) {
        status.style.color = '#b32025';
        status.textContent = 'Envoi non confirmé. Utilisez WhatsApp, l’e-mail ou appelez le 06 01 46 26 12.';
      } finally {
        busy = false;
        button.disabled = false;
      }
    });
    // Une navigation directe avec #devis précède parfois l'insertion du formulaire.
    if (location.hash === '#devis') section.scrollIntoView({block: 'start'});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();