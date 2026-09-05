function () {
  "use strict";

  /* ==========================================================
     J2B COUVERTURE TOUL — SUIVI NTFY + GOOGLE ADS
     - provenance / campagne / mot-clé / correspondance
     - parcours du visiteur pendant la session
     - clics appel / WhatsApp / e-mail / formulaires
     - appareil détecté : téléphone / tablette / ordinateur
     ========================================================== */

  const NTFY_TOPIC = "https://ntfy.sh/j2b-visites-X83LmP91Qa";
  const STORAGE_KEY = "j2b_toul_tracking_v5";
  const VISITOR_SENT_KEY = "j2b_toul_visitor_sent_v5";

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

  function getDeviceFromValueTrack(value) {
    if (!value) return "";
    value = String(value).toLowerCase();

    if (value === "m") return "📱 Téléphone";
    if (value === "t") return "📱 Tablette";
    if (value === "c") return "💻 Ordinateur";

    return "";
  }

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

  function getMatchType(value) {
    if (!value) return "";
    value = String(value).toLowerCase();

    if (value === "e") return "Exact";
    if (value === "p") return "Expression";
    if (value === "b") return "Requête large";

    return clean(value);
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

  function now() {
    return new Date().toLocaleString("fr-FR");
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
      network: "",
      creative: "",
      targetId: "",
      gclid: "",
      gbraid: "",
      wbraid: ""
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

    data.network = clean(p.get("network"));
    data.creative = clean(p.get("creative"));
    data.targetId = clean(p.get("targetid"));

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

    if (p.get("utm_source")) {
      data.source = clean(p.get("utm_source"));
      data.medium = clean(p.get("utm_medium"));
      return data;
    }

    if (document.referrer) {
      try {
        const host = new URL(document.referrer)
          .hostname
          .replace(/^www\./, "")
          .toLowerCase();

        if (host.includes("google.")) {
          data.source = "Google naturel";
          data.medium = "Organic";
        } else if (host.includes("bing.")) {
          data.source = "Bing";
        } else if (host.includes("facebook.") || host === "fb.com") {
          data.source = "Facebook";
        } else if (host.includes("instagram.")) {
          data.source = "Instagram";
        } else {
          data.source = host;
        }

        return data;
      } catch (e) {}
    }

    data.source = "Direct / inconnue";
    return data;
  }

  let session = loadSession();

  if (!session) {
    const traffic = detectTraffic();

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
      network: traffic.network,
      creative: traffic.creative,
      targetId: traffic.targetId,

      gclid: traffic.gclid,
      gbraid: traffic.gbraid,
      wbraid: traffic.wbraid,

      pages: [],
      actions: []
    };
  }

  const freshTraffic = detectTraffic();

  [
    "source",
    "medium",
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

  session.device = freshTraffic.device || getBrowserDevice();

  const pageRecord = {
    path: currentPage(),
    title: pageName(),
    time: now()
  };

  const lastPage =
    session.pages && session.pages.length
      ? session.pages[session.pages.length - 1]
      : null;

  if (!lastPage || lastPage.path !== pageRecord.path) {
    session.pages = session.pages || [];
    session.pages.push(pageRecord);
  }

  saveSession(session);

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

  function adsInfoLines() {
    const lines = [];

    lines.push(
      "Provenance : " +
      (session.source || "Inconnue")
    );

    if (session.medium) {
      lines.push("Support : " + session.medium);
    }

    lines.push(
      "Appareil : " +
      (session.device || getBrowserDevice())
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
      lines.push("Mot-clé déclencheur : " + session.keyword);
    }

    if (session.matchType) {
      lines.push("Correspondance : " + session.matchType);
    }

    if (session.network) {
      lines.push("Réseau : " + session.network);
    }

    if (session.creative) {
      lines.push("Annonce / creative : " + session.creative);
    }

    if (session.targetId) {
      lines.push("Cible : " + session.targetId);
    }

    return lines;
  }

  function sendNtfy(title, message, priority, tags) {
    const url =
      NTFY_TOPIC +
      "?title=" + encodeURIComponent(title) +
      "&priority=" + encodeURIComponent(priority || "high") +
      "&tags=" + encodeURIComponent(tags || "eyes,house");

    return fetch(url, {
      method: "POST",
      body: message,
      keepalive: true,
      cache: "no-store"
    }).catch(function () {});
  }

  let visitorAlreadySent = false;

  try {
    visitorAlreadySent =
      sessionStorage.getItem(VISITOR_SENT_KEY) === "1";
  } catch (e) {}

  if (!visitorAlreadySent) {
    try {
      sessionStorage.setItem(VISITOR_SENT_KEY, "1");
    } catch (e) {}

    const visitorMessage = [
      "NOUVEAU VISITEUR - J2B COUVERTURE TOUL",
      "",
      "Page d'entrée : " + session.entryPage,
      "Titre : " + session.entryTitle,
      "",
      ...adsInfoLines(),
      "",
      "Début de session : " + session.startedAt
    ].join("\n");

    sendNtfy(
      session.source === "Google Ads"
        ? "🔥 Visiteur Google Ads - J2B Toul"
        : "Nouveau visiteur - J2B Toul",
      visitorMessage,
      session.source === "Google Ads" ? "high" : "default",
      session.source === "Google Ads"
        ? "moneybag,eyes,house"
        : "eyes,house"
    );
  }

  function registerAction(type, label) {
    const action = {
      type: type,
      label: label || "",
      page: currentPage(),
      time: now()
    };

    session.actions = session.actions || [];
    session.actions.push(action);
    saveSession(session);

    return action;
  }

  document.addEventListener(
    "click",
    function (event) {
      const target = event.target.closest("a,button");
      if (!target) return;

      const href = target.getAttribute("href") || "";
      const label = (
        target.textContent ||
        target.getAttribute("aria-label") ||
        target.getAttribute("title") ||
        "Bouton"
      )
        .replace(/\s+/g, " ")
        .trim();

      let actionType = "";

      if (/^tel:/i.test(href)) {
        actionType = "APPEL";
      } else if (/wa\.me|whatsapp/i.test(href)) {
        actionType = "WHATSAPP";
      } else if (/^mailto:/i.test(href)) {
        actionType = "EMAIL";
      }

      if (!actionType) return;

      registerAction(actionType, label);

      const message = [
        actionType + " - J2B COUVERTURE TOUL",
        "",
        "Action : " + actionType,
        "Bouton : " + label,
        "Page du clic : " + currentPage(),
        "",
        "Page d'entrée : " + session.entryPage,
        "",
        ...adsInfoLines(),
        "",
        "PARCOURS DU VISITEUR :",
        journeyText(),
        "",
        "Heure du clic : " + now()
      ].join("\n");

      let title = "Action visiteur - J2B Toul";
      let tags = "bell,house";

      if (actionType === "APPEL") {
        title = "📞 CLIC SUR APPELER - J2B Toul";
        tags = "telephone,fire,house";
      }

      if (actionType === "WHATSAPP") {
        title = "💬 Clic WhatsApp - J2B Toul";
        tags = "speech_balloon,house";
      }

      if (actionType === "EMAIL") {
        title = "✉️ Clic E-mail - J2B Toul";
        tags = "email,house";
      }

      sendNtfy(title, message, "urgent", tags);

      if (typeof window.gtag === "function") {
        if (actionType === "APPEL") {
          window.gtag("event", "click_appel", {
            event_category: "Contact",
            event_label: label,
            page_path: currentPage()
          });
        }

        if (actionType === "WHATSAPP") {
          window.gtag("event", "click_whatsapp", {
            event_category: "Contact",
            event_label: label,
            page_path: currentPage()
          });
        }

        if (actionType === "EMAIL") {
          window.gtag("event", "click_email", {
            event_category: "Contact",
            event_label: label,
            page_path: currentPage()
          });
        }
      }
    },
    true
  );

  document.addEventListener(
    "submit",
    function (event) {
      const form = event.target;
      if (!form) return;

      const label =
        form.id ||
        form.getAttribute("name") ||
        "Formulaire";

      registerAction("FORMULAIRE", label);

      const message = [
        "FORMULAIRE - J2B COUVERTURE TOUL",
        "",
        "Formulaire : " + label,
        "Page : " + currentPage(),
        "",
        "Page d'entrée : " + session.entryPage,
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
})();