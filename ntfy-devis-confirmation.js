/* J2B TOUL — CORRECTIF NTFY, 16/11/2026
 * À ajouter dans un NOUVEAU fichier : ntfy-devis-confirmation.js
 * Puis ajouter dans index.html, juste avant </body> :
 * <script src="./ntfy-devis-confirmation.js?v=1" defer></script>
 *
 * Ce correctif notifie quand l'interface affiche le succès de transmission.
 * IMPORTANT : le fetch Google Apps Script est en mode no-cors : cette indication
 * n'est PAS une preuve que Sheets a effectivement enregistré la ligne.
 * Pour une garantie de bout en bout, déclencher ntfy dans Apps Script après
 * SpreadsheetApp / appendRow ou update de la ligne, et journaliser l'échec.
 * Ne transmet AUCUNE coordonnée du prospect à ntfy.
 */
(function () {
  'use strict';
  if (window.__J2B_NTFY_DEVIS_CONFIRMATION_V1__) return;
  window.__J2B_NTFY_DEVIS_CONFIRMATION_V1__ = true;

  const TOPIC = 'https://ntfy.sh/j2b-visites-X83LmP91Qa';
  const FORMS = [
    {form: 'quoteForm', status: 'quoteStatus', label: 'Formulaire complet accueil'},
    {form: 'heroQuoteForm', status: 'heroStatus', label: 'Mini formulaire accueil'}
  ];

  function publish(message) {
    // Une requête simple, sans en-têtes personnalisés, compatible navigateur.
    // Une résolution no-cors ne prouve PAS la livraison de la notification.
    return fetch(TOPIC + '?title=' + encodeURIComponent('Devis transmis - J2B Toul') +
      '&priority=urgent&tags=memo,house', {
      method: 'POST',
      mode: 'no-cors',
      headers: {'Content-Type': 'text/plain'},
      body: message,
      keepalive: true,
      cache: 'no-store'
    });
  }

  function install(config) {
    const form = document.getElementById(config.form);
    const status = document.getElementById(config.status);
    if (!form || !status) return;
    let pending = false;
    let notified = false;
    let expiry = 0;

    form.addEventListener('submit', function () {
      // L'événement de soumission n'est pas une preuve de validation.
      // Le texte de succès affiché par le code existant est vérifié ensuite.
      pending = true;
      notified = false;
      expiry = Date.now() + 30000;
      queueMicrotask(check);
    }, false);

    function check() {
      if (!pending || notified || Date.now() > expiry) return;
      const msg = (status.textContent || '').trim();
      if (!/^✓\s*Demande enregistrée\./i.test(msg)) return;
      notified = true;
      pending = false;
      const body = [
        'DEMANDE DE DEVIS TRANSMISE — J2B TOUL',
        'Formulaire : ' + config.label,
        'Page : ' + location.origin + location.pathname,
        'Heure : ' + new Date().toLocaleString('fr-FR', {timeZone: 'Europe/Paris'}),
        'Statut : transmission indiquée comme réussie par le navigateur',
        'Attention : écriture Sheets non vérifiable depuis ce navigateur.'
      ].join('\n');
      publish(body).catch(function (error) {
        console.warn('[J2B ntfy] Envoi de la notification non confirmé', error);
      });
    }

    new MutationObserver(check).observe(status, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  function init() { FORMS.forEach(install); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once: true});
  } else init();
})();
