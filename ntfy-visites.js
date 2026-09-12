(function () {
  "use strict";

  /* ==========================================================
     J2B COUVERTURE TOUL — SUIVI NTFY + GOOGLE ADS V9
     - nouveau visiteur / visiteur déjà venu
     - provenance / campagne / mot-clé / correspondance
     - détection de nouveaux clics Google Ads distincts
     - évite de recompter un simple rafraîchissement avec le même click ID
     - NOTIFICATION À CHAQUE CHANGEMENT DE PAGE
     - parcours complet du visiteur pendant la session
     - mémorise le lien interne cliqué avant le changement de page
     - alerte renforcée sur contact / devis / diagnostic
     - clics appel / WhatsApp / e-mail / formulaires
     - appareil : téléphone / tablette / ordinateur
     - système : iOS / iPadOS / Android / Windows / macOS

     IMPORTANT :
     Le compteur "clic Ads distinct" signifie qu'un nouvel identifiant
     de clic Google Ads a été observé sur ce navigateur.
     Cela ne prouve pas à lui seul que Google a réellement facturé le clic.
     ========================================================== */

  const NTFY_TOPIC = "https://ntfy.sh/j2b-visites-X83LmP91Qa";

  // On conserve les anciennes clés pour garder l'historique déjà enregistré.
  const STORAGE_KEY = "j2b_toul_tracking_v8";
  const VISITOR_SENT_KEY = "j2b_toul_visitor_sent_v8";
  const VISITOR_PROFILE_KEY = "j2b_toul_visitor_profile_v2";
  const VISIT_COUNTED_KEY = "j2b_toul_visit_counted_v2";
  const ADS_CLICKS_KEY = "j2b_toul_ads_clicks_v2";
  const ADS_ALERT_SENT_KEY = "j2b_toul_ads_alert_sent_v2";

  function getParams() {
    return new URLSearchParams(window.location.search);
  }

  function clean(value) {
    if (!value) return "";
    try {
      return decodeURIComponent(String(value).replace(/\+/g, " "));
    } catch (e) {
      return String(value);
    }
  }

  function now() {
    return new Date().toLocaleString("fr-FR");
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function formatIsoDate(value) {
    if (!value) return "";
    try {
      return new Date(value).toLocaleString("fr-FR");
    } catch (e) {
      return String(value);
    }
  }

  function pageName() {
    return document.title || window.location.pathname || "Page inconnue";
  }

  function currentPage() {
    return window.location.pathname || "/";
  }

  function currentFullUrl() {
    return window.location.href;
  }

  function sameSiteReferrer() {
    if (!document.referrer) return false;
    try {
      return new URL(document.referrer).hostname === window.location.hostname;
    } catch (e) {
      return false;
    }
  }

  /* =========================
     APPAREIL GOOGLE ADS
     ========================= */

  function getDeviceFromValueTrack(value) {
    if (!value) return "";
    value = String(value).toLowerCase();

    if (value === "m") return "📱 Téléphone";
    if (value === "t") return "📱 Tablette";
    if (value === "c") return "💻 Ordinateur";

    return "";
  }

  /* =========================
     APPAREIL RÉEL
     ========================= */

  function getBrowserDevice() {
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    const touchPoints = navigator.maxTouchPoints || 0;

    const isIPad =
      /iPad/i.test(ua) ||
      (platform === "MacIntel" && touchPoints > 1);

    const isTablet =
      isIPad ||
      /Tablet|PlayBook|Silk/i.test(ua) ||
      (/Android/i.test(ua) && !/Mobile/i.test(ua));

    if (isTablet) return "📱 Tablette";

    const isPhone =
      /iPhone|iPod|Windows Phone|IEMobile|Opera Mini/i.test(ua) ||
      (/Android/i.test(ua) && /Mobile/i.test(ua)) ||
      /Mobi/i.test(ua);

    if (isPhone) return "📱 Téléphone";

    return "💻 Ordinateur";
  }

  /* =========================
     SYSTÈME D'EXPLOITATION
     ========================= */

  function getOperatingSystem() {
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    const touchPoints = navigator.maxTouchPoints || 0;

    if (/iPhone|iPod/i.test(ua)) return "🍎 iOS (iPhone)";

    if (
      /iPad/i.test(ua) ||
      (platform === "MacIntel" && touchPoints > 1)
    ) {
      return "🍎 iPadOS (iPad)";
    }

    if (/Android/i.test(ua)) return "🤖 Android";
    if (/Windows NT/i.test(ua)) return "🪟 Windows";
    if (/CrOS/i.test(ua)) return "💻 ChromeOS";
    if (/Macintosh|Mac OS X/i.test(ua)) return "🍎 macOS";
    if (/Linux/i.test(ua)) return "🐧 Linux";

    return "Système inconnu";
  }

  /* =========================
     TYPE DE CORRESPONDANCE ADS
     ========================= */

  function getMatchType(value) {
    if (!value) return "";
    value = String(value).toLowerCase();

    if (value === "e") return "Exact";
    if (value === "p") return "Expression";
    if (value === "b") return "Requête large";

    return clean(value);
  }

  /* =========================
     STOCKAGE
     ========================= */

  function loadLocalJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveLocalJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function loadSession() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveSession(data) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function generateVisitorId() {
    try {
      if (
        window.crypto &&
        typeof window.crypto.randomUUID === "function"
      ) {
        return window.crypto.randomUUID();
      }
    } catch (e) {}

    return (
      "j2b-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 10)
    );
  }

  /* =========================
     VISITEUR NOUVEAU / DÉJÀ VENU
     ========================= */

  function resolveVisitor() {
    const previous = loadLocalJson(VISITOR_PROFILE_KEY, null);

    const returning = !!(
      previous &&
      previous.id &&
      previous.firstSeen
    );

    let countedThisSession = false;

    try {
      countedThisSession =
        sessionStorage.getItem(VISIT_COUNTED_KEY) === "1";
    } catch (e) {}

    let visits =
      returning && Number(previous.visits)
        ? Number(previous.visits)
        : 0;

    if (!countedThisSession) {
      visits += 1;

      try {
        sessionStorage.setItem(VISIT_COUNTED_KEY, "1");
      } catch (e) {}
    }

    const profile = {
      id: returning ? previous.id : generateVisitorId(),
      firstSeen: returning ? previous.firstSeen : nowIso(),
      lastSeen: nowIso(),
      visits: visits
    };

    saveLocalJson(VISITOR_PROFILE_KEY, profile);

    return {
      type: returning ? "returning" : "new",
      label: returning ? "🔵 DÉJÀ VENU" : "🟢 NOUVEAU VISITEUR",
      id: profile.id,
      visits: profile.visits,
      firstSeen: profile.firstSeen,
      previousLastSeen:
        returning && previous.lastSeen
          ? previous.lastSeen
          : ""
    };
  }

  /* =========================
     PROVENANCE + GOOGLE ADS
     ========================= */

  function detectTraffic() {
    const p = getParams();

    const data = {
      source: "",
      medium: "",
      campaign: "",
      campaignId: "",
      adGroupId: "",
      keyword: "",
      matchType: "",
      device: "",
      os: "",
      network: "",
      creative: "",
      targetId: "",
      gclid: "",
      gbraid: "",
      wbraid: "",
      referrerHost: ""
    };

    data.gclid = clean(p.get("gclid"));
    data.gbraid = clean(p.get("gbraid"));
    data.wbraid = clean(p.get("wbraid"));

    data.campaign = clean(
      p.get("campaign") ||
      p.get("utm_campaign")
    );

    data.campaignId = clean(
      p.get("campaignid") ||
      p.get("campaign_id")
    );

    data.adGroupId = clean(
      p.get("adgroupid") ||
      p.get("adgroup_id")
    );

    data.keyword = clean(
      p.get("keyword") ||
      p.get("utm_term")
    );

    data.matchType = getMatchType(
      clean(p.get("matchtype"))
    );

    data.device =
      getDeviceFromValueTrack(clean(p.get("device"))) ||
      getBrowserDevice();

    data.os = getOperatingSystem();
    data.network = clean(p.get("network"));
    data.creative = clean(p.get("creative"));
    data.targetId = clean(p.get("targetid"));

    /* GOOGLE ADS */
    if (
      data.gclid ||
      data.gbraid ||
      data.wbraid ||
      p.get("gad_source") === "1" ||
      data.campaignId ||
      data.keyword
    ) {
      data.source = "Google Ads";
      data.medium = "CPC";
      return data;
    }

    /* UTM */
    if (p.get("utm_source")) {
      data.source = clean(p.get("utm_source"));
      data.medium = clean(p.get("utm_medium"));
      return data;
    }

    /* REFERRER */
    if (document.referrer) {
      try {
        const refUrl = new URL(document.referrer);
        const host = refUrl.hostname
          .replace(/^www\./, "")
          .toLowerCase();

        data.referrerHost = host;

        if (host === window.location.hostname.replace(/^www\./, "").toLowerCase()) {
          data.source = "Navigation interne J2B";
          data.medium = "Interne";
        } else if (host.includes("google.")) {
          data.source = "Google naturel";
          data.medium = "Organic";
        } else if (host.includes("bing.")) {
          data.source = "Bing";
          data.medium = "Organic";
        } else if (host.includes("facebook.") || host === "fb.com") {
          data.source = "Facebook";
          data.medium = "Social";
        } else if (host.includes("instagram.")) {
          data.source = "Instagram";
          data.medium = "Social";
        } else if (host.includes("linkedin.")) {
          data.source = "LinkedIn";
          data.medium = "Social";
        } else if (host.includes("pagesjaunes.")) {
          data.source = "PagesJaunes";
          data.medium = "Referral";
        } else {
          data.source = host;
          data.medium = "Referral";
        }

        return data;
      } catch (e) {}
    }

    data.source = "Direct / inconnue";
    return data;
  }

  /* =========================
     CLIC ADS DISTINCT
     ========================= */

  function getAdsClickFingerprint(traffic) {
    if (!traffic) return "";

    if (traffic.gclid) return "gclid:" + traffic.gclid;
    if (traffic.gbraid) return "gbraid:" + traffic.gbraid;
    if (traffic.wbraid) return "wbraid:" + traffic.wbraid;

    return "";
  }

  function registerAdsClick(traffic) {
    const fingerprint = getAdsClickFingerprint(traffic);
    const previousClicks = loadLocalJson(ADS_CLICKS_KEY, []);

    let clicks = Array.isArray(previousClicks)
      ? previousClicks
      : [];

    const previousCount = clicks.length;

    if (traffic.source !== "Google Ads") {
      return {
        isAds: false,
        verifiable: false,
        isNewDistinctClick: false,
        count: previousCount,
        previousCount: previousCount
      };
    }

    if (!fingerprint) {
      return {
        isAds: true,
        verifiable: false,
        isNewDistinctClick: false,
        count: previousCount,
        previousCount: previousCount
      };
    }

    const alreadyKnown = clicks.includes(fingerprint);

    if (!alreadyKnown) {
      clicks.push(fingerprint);

      if (clicks.length > 50) {
        clicks = clicks.slice(-50);
      }

      saveLocalJson(ADS_CLICKS_KEY, clicks);
    }

    return {
      isAds: true,
      verifiable: true,
      isNewDistinctClick: !alreadyKnown,
      count: clicks.length,
      previousCount: previousCount
    };
  }

  /* =========================
     CRÉATION / REPRISE SESSION
     ========================= */

  let session = loadSession();

  if (!session) {
    const traffic = detectTraffic();
    const visitor = resolveVisitor();

    session = {
      startedAt: now(),

      entryPage: currentPage(),
      entryTitle: pageName(),
      entryUrl: currentFullUrl(),

      source: traffic.source,
      medium: traffic.medium,
      campaign: traffic.campaign,
      campaignId: traffic.campaignId,
      adGroupId: traffic.adGroupId,
      keyword: traffic.keyword,
      matchType: traffic.matchType,
      device: traffic.device,
      os: traffic.os,
      network: traffic.network,
      creative: traffic.creative,
      targetId: traffic.targetId,
      gclid: traffic.gclid,
      gbraid: traffic.gbraid,
      wbraid: traffic.wbraid,
      referrerHost: traffic.referrerHost,

      visitorType: visitor.type,
      visitorLabel: visitor.label,
      visitorId: visitor.id,
      visitorVisits: visitor.visits,
      visitorFirstSeen: visitor.firstSeen,
      visitorPreviousLastSeen: visitor.previousLastSeen,

      pages: [],
      actions: [],
      pendingNavigation: null
    };
  }

  if (!Array.isArray(session.pages)) session.pages = [];
  if (!Array.isArray(session.actions)) session.actions = [];

  /* =========================
     ACTUALISATION INFOS ADS
     ========================= */

  const freshTraffic = detectTraffic();

  // Ne pas remplacer la provenance initiale par "Navigation interne J2B".
  [
    "campaign",
    "campaignId",
    "adGroupId",
    "keyword",
    "matchType",
    "network",
    "creative",
    "targetId",
    "gclid",
    "gbraid",
    "wbraid"
  ].forEach(function (key) {
    if (!session[key] && freshTraffic[key]) {
      session[key] = freshTraffic[key];
    }
  });

  if (
    (!session.source || session.source === "Direct / inconnue") &&
    freshTraffic.source &&
    freshTraffic.source !== "Navigation interne J2B"
  ) {
    session.source = freshTraffic.source;
    session.medium = freshTraffic.medium || session.medium;
  }

  if (!session.referrerHost && freshTraffic.referrerHost && !sameSiteReferrer()) {
    session.referrerHost = freshTraffic.referrerHost;
  }

  session.device =
    freshTraffic.device ||
    session.device ||
    getBrowserDevice();

  session.os =
    freshTraffic.os ||
    session.os ||
    getOperatingSystem();

  /* =========================
     CLIC ADS DISTINCT
     ========================= */

  const adsClickInfo = registerAdsClick(freshTraffic);

  session.adsClickCount = adsClickInfo.count;
  session.adsClickVerifiable = adsClickInfo.verifiable;
  session.newDistinctAdsClick = adsClickInfo.isNewDistinctClick;

  /* =========================
     PAGE VISITÉE
     ========================= */

  const previousPage =
    session.pages.length
      ? session.pages[session.pages.length - 1]
      : null;

  const pageRecord = {
    path: currentPage(),
    title: pageName(),
    url: currentFullUrl(),
    time: now()
  };

  const pageChanged =
    !!previousPage &&
    previousPage.path !== pageRecord.path;

  const firstPageOfSession = !previousPage;

  if (
    !previousPage ||
    previousPage.path !== pageRecord.path
  ) {
    session.pages.push(pageRecord);

    // On limite l'historique de session pour éviter un stockage énorme.
    if (session.pages.length > 50) {
      session.pages = session.pages.slice(-50);
    }
  }

  saveSession(session);

  /* =========================
     TEXTES D'INFO
     ========================= */

  function journeyText() {
    if (!session.pages || !session.pages.length) {
      return "Aucune page enregistrée";
    }

    return session.pages
      .map(function (p, i) {
        return (i + 1) + ". " + p.path;
      })
      .join("\n");
  }

  function visitorInfoLines() {
    const lines = [];

    lines.push(
      "Type : " +
      (session.visitorLabel || "Visiteur inconnu")
    );

    if (session.visitorVisits) {
      lines.push(
        "Nombre de visites : " +
        session.visitorVisits
      );
    }

    if (session.visitorFirstSeen) {
      lines.push(
        "Première visite : " +
        formatIsoDate(session.visitorFirstSeen)
      );
    }

    if (session.visitorPreviousLastSeen) {
      lines.push(
        "Dernière visite précédente : " +
        formatIsoDate(session.visitorPreviousLastSeen)
      );
    }

    return lines;
  }

  function adsInfoLines() {
    const lines = [];

    lines.push(
      "Provenance initiale : " +
      (session.source || "Inconnue")
    );

    if (session.medium) {
      lines.push("Support : " + session.medium);
    }

    if (session.referrerHost) {
      lines.push(
        "Site référent : " +
        session.referrerHost
      );
    }

    lines.push(
      "Appareil : " +
      (session.device || getBrowserDevice())
    );

    lines.push(
      "Système : " +
      (session.os || getOperatingSystem())
    );

    if (session.campaign) {
      lines.push("Campagne : " + session.campaign);
    }

    if (session.campaignId) {
      lines.push("ID campagne : " + session.campaignId);
    }

    if (session.adGroupId) {
      lines.push("ID groupe : " + session.adGroupId);
    }

    if (session.keyword) {
      lines.push(
        "Mot-clé déclencheur : " +
        session.keyword
      );
    }

    if (session.matchType) {
      lines.push(
        "Correspondance : " +
        session.matchType
      );
    }

    if (session.network) {
      lines.push("Réseau : " + session.network);
    }

    if (session.creative) {
      lines.push(
        "Annonce / creative : " +
        session.creative
      );
    }

    if (session.targetId) {
      lines.push("Cible : " + session.targetId);
    }

    if (session.source === "Google Ads") {
      if (session.adsClickVerifiable) {
        lines.push(
          "Clics Ads distincts observés : " +
          session.adsClickCount
        );
      } else {
        lines.push(
          "Clic Ads distinct : non vérifiable (aucun gclid/gbraid/wbraid)"
        );
      }
    }

    return lines;
  }

  /* =========================
     ENVOI NTFY
     ========================= */

  function sendNtfy(title, message, priority, tags) {
    const url =
      NTFY_TOPIC +
      "?title=" +
      encodeURIComponent(title) +
      "&priority=" +
      encodeURIComponent(priority || "high") +
      "&tags=" +
      encodeURIComponent(tags || "eyes,house");

    return fetch(url, {
      method: "POST",
      body: message,
      keepalive: true,
      cache: "no-store"
    }).catch(function () {});
  }

  /* =========================
     ALERTE NOUVEAU CLIC ADS
     MÊME VISITEUR
     ========================= */

  let adsAlertAlreadySent = false;

  try {
    adsAlertAlreadySent =
      sessionStorage.getItem(ADS_ALERT_SENT_KEY) === "1";
  } catch (e) {}

  if (
    !adsAlertAlreadySent &&
    session.source === "Google Ads" &&
    session.visitorType === "returning" &&
    adsClickInfo.verifiable &&
    adsClickInfo.isNewDistinctClick &&
    adsClickInfo.count >= 2
  ) {
    try {
      sessionStorage.setItem(
        ADS_ALERT_SENT_KEY,
        "1"
      );
    } catch (e) {}

    const repeatAdsMessage = [
      "MÊME VISITEUR - NOUVEAU CLIC GOOGLE ADS",
      "",
      ...visitorInfoLines(),
      "",
      "💸 Nouveau clic Ads distinct observé : #" +
        adsClickInfo.count,
      "Clics Ads distincts précédents : " +
        adsClickInfo.previousCount,
      "",
      "Page d'arrivée : " + currentPage(),
      "Titre : " + pageName(),
      "",
      ...adsInfoLines(),
      "",
      "Heure : " + now(),
      "",
      "⚠️ Cela indique un nouvel identifiant de clic Ads observé sur ce navigateur.",
      "Cela ne garantit pas à lui seul que Google a facturé ce clic."
    ].join("\n");

    sendNtfy(
      "💸 Même visiteur - nouveau clic Ads #" +
        adsClickInfo.count,
      repeatAdsMessage,
      "high",
      "moneybag,repeat,eyes,house"
    );
  }

  /* =========================
     NOTIFICATION VISITEUR
     1 NOTIFICATION / SESSION
     ========================= */

  let visitorAlreadySent = false;

  try {
    visitorAlreadySent =
      sessionStorage.getItem(VISITOR_SENT_KEY) === "1";
  } catch (e) {}

  if (!visitorAlreadySent) {
    try {
      sessionStorage.setItem(
        VISITOR_SENT_KEY,
        "1"
      );
    } catch (e) {}

    const visitorMessage = [
      (session.visitorLabel || "VISITEUR") +
        " - J2B COUVERTURE TOUL",
      "",
      ...visitorInfoLines(),
      "",
      "Page d'entrée : " + session.entryPage,
      "Titre : " + session.entryTitle,
      "",
      ...adsInfoLines(),
      "",
      "Début de session : " + session.startedAt
    ].join("\n");

    let visitorTitle =
      "🟢 Nouveau visiteur - J2B Toul";
    let visitorPriority = "default";
    let visitorTags = "eyes,house";

    if (session.visitorType === "returning") {
      visitorTitle =
        "🔵 Visiteur déjà venu - J2B Toul";
      visitorTags =
        "repeat,eyes,house";
    }

    if (
      session.source === "Google Ads" &&
      session.visitorType === "new"
    ) {
      visitorTitle =
        "🔥 🟢 Nouveau visiteur Google Ads - J2B Toul";
      visitorPriority = "high";
      visitorTags =
        "moneybag,eyes,house";
    }

    if (
      session.source === "Google Ads" &&
      session.visitorType === "returning"
    ) {
      if (
        adsClickInfo.verifiable &&
        adsClickInfo.isNewDistinctClick &&
        adsClickInfo.count >= 2
      ) {
        visitorTitle =
          "💸 🔵 Déjà venu + nouveau clic Ads #" +
          adsClickInfo.count +
          " - J2B Toul";
      } else {
        visitorTitle =
          "🔥 🔵 Visiteur déjà venu Google Ads - J2B Toul";
      }

      visitorPriority = "high";
      visitorTags =
        "moneybag,repeat,eyes,house";
    }

    sendNtfy(
      visitorTitle,
      visitorMessage,
      visitorPriority,
      visitorTags
    );
  }

  /* =========================
     NOUVEAU : NOTIFICATION
     À CHAQUE CHANGEMENT DE PAGE
     ========================= */

  function isHighIntentPage(path) {
    return /contact|devis|diagnostic/i.test(path || "");
  }

  if (pageChanged) {
    const pending = session.pendingNavigation || null;

    const navigationLines = [
      "NAVIGATION VISITEUR - J2B COUVERTURE TOUL",
      "",
      "Page précédente : " +
        (previousPage ? previousPage.path : "Inconnue"),
      "➡️ Nouvelle page : " + pageRecord.path,
      "Titre : " + pageRecord.title,
      "Page n° : " + session.pages.length,
      ""
    ];

    if (pending && pending.label) {
      navigationLines.push(
        "Lien cliqué : " + pending.label
      );
    }

    if (pending && pending.href) {
      navigationLines.push(
        "Destination du clic : " + pending.href
      );
    }

    navigationLines.push(
      "",
      ...visitorInfoLines(),
      "",
      ...adsInfoLines(),
      "",
      "PARCOURS COMPLET :",
      journeyText(),
      "",
      "Heure : " + now()
    );

    const highIntent =
      isHighIntentPage(pageRecord.path);

    sendNtfy(
      highIntent
        ? "🔥 Page à forte intention - J2B Toul"
        : "👣 Changement de page - J2B Toul",
      navigationLines.join("\n"),
      highIntent ? "high" : "default",
      highIntent
        ? "fire,eyes,house"
        : "footprints,eyes,house"
    );

    // Le clic ayant provoqué la navigation a été utilisé.
    session.pendingNavigation = null;
    saveSession(session);
  }

  /* =========================
     ENREGISTRER ACTION
     ========================= */

  function registerAction(type, label) {
    const action = {
      type: type,
      label: label || "",
      page: currentPage(),
      time: now()
    };

    session.actions = session.actions || [];
    session.actions.push(action);

    if (session.actions.length > 50) {
      session.actions = session.actions.slice(-50);
    }

    saveSession(session);

    return action;
  }

  /* =========================
     CLICS + NAVIGATION INTERNE
     ========================= */

  document.addEventListener(
    "click",
    function (event) {
      const clicked =
        event.target.closest("a,button");

      const link =
        event.target.closest("a[href]");

      if (!clicked && !link) return;

      const href =
        (link && link.getAttribute("href")) ||
        (clicked && clicked.getAttribute("href")) ||
        "";

      const label = (
        (clicked && clicked.textContent) ||
        (link && link.textContent) ||
        (clicked && clicked.getAttribute("aria-label")) ||
        (link && link.getAttribute("aria-label")) ||
        (clicked && clicked.getAttribute("title")) ||
        (link && link.getAttribute("title")) ||
        "Bouton"
      )
        .replace(/\s+/g, " ")
        .trim();

      /* MÉMORISER LE LIEN INTERNE AVANT DE QUITTER LA PAGE */
      if (link && href) {
        try {
          const targetUrl = new URL(
            href,
            window.location.href
          );

          const isInternal =
            targetUrl.origin === window.location.origin;

          const isSamePageHash =
            targetUrl.pathname === window.location.pathname &&
            targetUrl.search === window.location.search &&
            targetUrl.hash;

          if (
            isInternal &&
            !isSamePageHash &&
            targetUrl.pathname !== window.location.pathname
          ) {
            session.pendingNavigation = {
              from: currentPage(),
              to: targetUrl.pathname,
              href: href,
              label: label,
              time: now()
            };

            saveSession(session);
          }
        } catch (e) {}
      }

      let actionType = "";

      if (/^tel:/i.test(href)) {
        actionType = "APPEL";
      } else if (/wa\.me|whatsapp/i.test(href)) {
        actionType = "WHATSAPP";
      } else if (/^mailto:/i.test(href)) {
        actionType = "EMAIL";
      }

      if (!actionType) return;

      registerAction(
        actionType,
        label
      );

      const message = [
        actionType +
          " - J2B COUVERTURE TOUL",
        "",
        "Action : " + actionType,
        "Bouton : " + label,
        "Page du clic : " + currentPage(),
        "",
        ...visitorInfoLines(),
        "",
        "Page d'entrée : " +
          session.entryPage,
        "",
        ...adsInfoLines(),
        "",
        "PARCOURS DU VISITEUR :",
        journeyText(),
        "",
        "Heure du clic : " + now()
      ].join("\n");

      let title =
        "Action visiteur - J2B Toul";
      let tags =
        "bell,house";

      if (actionType === "APPEL") {
        title =
          "📞 CLIC SUR APPELER - J2B Toul";
        tags =
          "telephone,fire,house";
      }

      if (actionType === "WHATSAPP") {
        title =
          "💬 Clic WhatsApp - J2B Toul";
        tags =
          "speech_balloon,house";
      }

      if (actionType === "EMAIL") {
        title =
          "✉️ Clic E-mail - J2B Toul";
        tags =
          "email,house";
      }

      sendNtfy(
        title,
        message,
        "urgent",
        tags
      );

      /* GOOGLE ANALYTICS */
      if (typeof window.gtag === "function") {
        if (actionType === "APPEL") {
          window.gtag(
            "event",
            "click_appel",
            {
              event_category: "Contact",
              event_label: label,
              page_path: currentPage()
            }
          );
        }

        if (actionType === "WHATSAPP") {
          window.gtag(
            "event",
            "click_whatsapp",
            {
              event_category: "Contact",
              event_label: label,
              page_path: currentPage()
            }
          );
        }

        if (actionType === "EMAIL") {
          window.gtag(
            "event",
            "click_email",
            {
              event_category: "Contact",
              event_label: label,
              page_path: currentPage()
            }
          );
        }
      }
    },
    true
  );

  /* =========================
     FORMULAIRE
     ========================= */

  document.addEventListener(
    "submit",
    function (event) {
      const form = event.target;

      if (!form) return;

      const label =
        form.id ||
        form.getAttribute("name") ||
        "Formulaire";

      registerAction(
        "FORMULAIRE",
        label
      );

      const message = [
        "FORMULAIRE - J2B COUVERTURE TOUL",
        "",
        "Formulaire : " + label,
        "Page : " + currentPage(),
        "",
        ...visitorInfoLines(),
        "",
        "Page d'entrée : " +
          session.entryPage,
        "",
        ...adsInfoLines(),
        "",
        "PARCOURS :",
        journeyText(),
        "",
        "Heure : " + now()
      ].join("\n");

      sendNtfy(
        "📝 Formulaire - J2B Toul",
        message,
        "urgent",
        "memo,house"
      );
    },
    true
  );

  /* =========================
     MISE À JOUR DERNIÈRE ACTIVITÉ
     ========================= */

  try {
    const profile =
      loadLocalJson(
        VISITOR_PROFILE_KEY,
        null
      );

    if (profile && profile.id) {
      profile.lastSeen = nowIso();
      saveLocalJson(
        VISITOR_PROFILE_KEY,
        profile
      );
    }
  } catch (e) {}

  // Variable utilisée uniquement pour rendre l'intention claire lors du débogage.
  void firstPageOfSession;
})();