(function(){
  "use strict";

  const NTFY_TOPIC = "https://ntfy.sh/j2b-visites-X83LmP91Qa";
  const SESSION_KEY = "j2b_toul_ntfy_visit_sent_v2";

  function alreadySent(){
    try{
      if(sessionStorage.getItem(SESSION_KEY)) return true;
      sessionStorage.setItem(SESSION_KEY, "1");
      return false;
    }catch(e){
      return false;
    }
  }

  function allowRetry(){
    try{ sessionStorage.removeItem(SESSION_KEY); }catch(e){}
  }

  function sourceFromVisit(){
    const p = new URLSearchParams(location.search);

    if(
      p.has("gclid") ||
      p.has("gbraid") ||
      p.has("wbraid") ||
      p.get("gad_source") === "1"
    ){
      return "Google Ads";
    }

    if(p.get("utm_source")){
      let source = p.get("utm_source");
      const medium = p.get("utm_medium");
      const campaign = p.get("utm_campaign");

      if(medium) source += " / " + medium;
      if(campaign) source += " / campagne " + campaign;

      return source;
    }

    if(document.referrer){
      try{
        const host = new URL(document.referrer).hostname
          .replace(/^www\./, "")
          .toLowerCase();

        if(host.includes("google.")) return "Google naturel / Google";
        if(host.includes("bing.")) return "Bing";
        if(host.includes("facebook.") || host === "fb.com") return "Facebook";
        if(host.includes("instagram.")) return "Instagram";

        return host;
      }catch(e){
        return "Lien externe";
      }
    }

    return "Direct / provenance inconnue";
  }

  if(alreadySent()) return;

  const source = sourceFromVisit();
  const pageTitle = document.title || "Page sans titre";
  const path = location.pathname || "/";
  const hour = new Date().toLocaleString("fr-FR");

  const message = [
    "NOUVEAU VISITEUR - J2B COUVERTURE TOUL",
    "",
    "Page : " + pageTitle,
    "Chemin : " + path,
    "Provenance : " + source,
    "Heure : " + hour
  ].join("\n");

  const publishUrl =
    NTFY_TOPIC +
    "?title=" + encodeURIComponent("Nouveau visiteur J2B Toul") +
    "&priority=high" +
    "&tags=eyes,house";

  fetch(publishUrl, {
    method: "POST",
    body: message,
    keepalive: true,
    cache: "no-store"
  }).catch(function(){
    allowRetry();
  });
})();
