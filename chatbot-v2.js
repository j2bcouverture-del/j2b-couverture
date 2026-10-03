(function () {
  "use strict";

  if (window.__J2B_CHATBOT_V6__) return;
  window.__J2B_CHATBOT_V6__ = true;

  function cloneWithoutListeners(el) {
    if (!el || !el.parentNode) return el;
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
    return clone;
  }

  function init() {
    let launcher = document.getElementById("chatLauncher");
    const box = document.getElementById("chatBox");
    let closeBtn = document.getElementById("chatClose");
    const messages = document.getElementById("chatMessages");
    const choices = document.getElementById("chatChoices");
    const inputRow = document.getElementById("chatInputRow");
    let input = document.getElementById("chatInput");
    let send = document.getElementById("chatSend");

    if (!launcher || !box || !closeBtn || !messages || !choices || !inputRow || !input || !send) {
      return;
    }

    launcher = cloneWithoutListeners(launcher);
    closeBtn = cloneWithoutListeners(closeBtn);
    input = cloneWithoutListeners(input);
    send = cloneWithoutListeners(send);

    launcher.textContent = "💬 Une question ?";
    launcher.setAttribute("aria-expanded", "false");

    const subtitle = box.querySelector(".chatHead small");
    if (subtitle) subtitle.textContent = "Questions, urgence et devis";

    const NTFY_TOPIC = "https://ntfy.sh/j2b-visites-X83LmP91Qa";
    const OPEN_KEY = "j2b_chatbot_v6_open_sent";

    let state = {};
    let started = false;
    let currentInputHandler = null;
    let inputLocked = false;

    const conversation = {
      lastTopic: null,
      lastQuestion: ""
    };

    function now() {
      try {
        return new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
      } catch (e) {
        return new Date().toLocaleString("fr-FR");
      }
    }

    function robotLikely() {
      const ua = navigator.userAgent || "";
      return navigator.webdriver === true ||
        /bot|crawler|spider|headless|slurp|lighthouse|pagespeed|urlscan/i.test(ua);
    }

    function trafficSource() {
      const p = new URLSearchParams(location.search);

      if (p.get("gclid") || p.get("gbraid") || p.get("wbraid") || p.get("gad_source") === "1") {
        return "Google Ads";
      }

      if (p.get("utm_source")) return p.get("utm_source");

      if (document.referrer) {
        try {
          const host = new URL(document.referrer).hostname
            .replace(/^www\./, "")
            .toLowerCase();

          if (host.includes("google.")) return "Google naturel";
          if (host.includes("facebook.")) return "Facebook";
          if (host.includes("instagram.")) return "Instagram";
          return host;
        } catch (e) {}
      }

      return "Direct / inconnue";
    }

    function sendNtfy(title, body, priority, tags) {
      if (robotLikely()) return Promise.resolve(false);

      const url =
        NTFY_TOPIC +
        "?title=" + encodeURIComponent(title) +
        "&priority=" + encodeURIComponent(priority || "default") +
        "&tags=" + encodeURIComponent(tags || "speech_balloon,house");

      return fetch(url, {
        method: "POST",
        body: body,
        keepalive: true,
        cache: "no-store"
      })
        .then(function (r) { return r.ok; })
        .catch(function () { return false; });
    }

    function notifyOpen() {
      let already = false;

      try {
        already = sessionStorage.getItem(OPEN_KEY) === "1";
      } catch (e) {}

      if (already) return;

      try {
        sessionStorage.setItem(OPEN_KEY, "1");
      } catch (e) {}

      sendNtfy(
        "💬 Chatbot ouvert - J2B Toul",
        [
          "UTILISATION CHATBOT - J2B COUVERTURE TOUL",
          "",
          "Action : ouverture du chatbot",
          "Page : " + location.pathname,
          "Provenance : " + trafficSource(),
          "Heure : " + now()
        ].join("\n"),
        "default",
        "speech_balloon,eyes,house"
      );

      if (typeof window.gtag === "function") {
        window.gtag("event", "chatbot_open", {
          event_category: "Chatbot",
          event_label: "Ouverture",
          page_path: location.pathname
        });
      }
    }

    function notifyQuestion(question, answer) {
      sendNtfy(
        "❓ Question chatbot - J2B Toul",
        [
          "QUESTION CHATBOT - J2B COUVERTURE TOUL",
          "",
          "Question : " + question,
          "",
          "Réponse donnée : " + answer,
          "",
          "Page : " + location.pathname,
          "Provenance : " + trafficSource(),
          "Heure : " + now()
        ].join("\n"),
        "high",
        "speech_balloon,question,house"
      );

      if (typeof window.gtag === "function") {
        window.gtag("event", "chatbot_question", {
          event_category: "Chatbot",
          event_label: "Question posée",
          page_path: location.pathname
        });
      }
    }

    function notifyUrgency() {
      sendNtfy(
        "🚨 Urgence via chatbot - J2B Toul",
        [
          "URGENCE CHATBOT - J2B COUVERTURE TOUL",
          "",
          "Le visiteur a signalé une fuite / urgence",
          "Page : " + location.pathname,
          "Provenance : " + trafficSource(),
          "Heure : " + now()
        ].join("\n"),
        "urgent",
        "rotating_light,house"
      );
    }

    function notifyLead(action) {
      sendNtfy(
        "🔥 Lead chatbot - J2B Toul",
        [
          "LEAD CHATBOT - J2B COUVERTURE TOUL",
          "",
          "Action finale : " + action,
          "Besoin : " + (state.need || "Non précisé"),
          "Urgence : " + (state.urgency || "Non précisée"),
          "Ville : " + (state.city || "Non précisée"),
          "Nom : " + (state.name || "Non précisé"),
          "Téléphone : " + (state.phone || "Non précisé"),
          "Précisions : " + (state.details || "Aucune"),
          "",
          "Page : " + location.pathname,
          "Provenance : " + trafficSource(),
          "Heure : " + now()
        ].join("\n"),
        "urgent",
        "fire,telephone,house"
      );
    }

    function reportConversion() {
      if (typeof window.gtag === "function") {
        window.gtag("event", "conversion", {
          send_to: "AW-16552414221/vyNqCJ_ttfUcEI2Y59Q9"
        });
      }
    }

    function validPhone(value) {
      const phone = String(value || "").replace(/[^\d+]/g, "");
      return /^(?:\+33|0)[1-9]\d{8}$/.test(phone);
    }

    function whatsappLead(data) {
      const lines = [
        "Bonjour J2B Couverture,",
        "",
        "Demande depuis le chatbot :",
        "Besoin : " + (data.need || "Non précisé"),
        "Urgence : " + (data.urgency || "Non précisée"),
        "Ville : " + (data.city || "Non précisée"),
        "Nom : " + (data.name || "Non précisé"),
        "Téléphone : " + (data.phone || "Non précisé"),
        "Précisions : " + (data.details || "Aucune")
      ];

      return "https://wa.me/33601462612?text=" + encodeURIComponent(lines.join("\n"));
    }

    function addMessage(text, who) {
      const div = document.createElement("div");
      div.className = "msg " + (who || "bot");
      div.textContent = text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }

    function clearInputHandler() {
      currentInputHandler = null;
      inputLocked = false;
      send.onclick = null;
      input.onkeydown = null;
    }

    function setInputHandler(handler) {
      clearInputHandler();
      currentInputHandler = handler;

      function submit() {
        if (inputLocked || !currentInputHandler) return;

        const value = input.value.trim();
        if (!value) return;

        inputLocked = true;
        const activeHandler = currentInputHandler;
        currentInputHandler = null;

        addMessage(value, "user");
        input.value = "";

        Promise.resolve()
          .then(function () {
            return activeHandler(value);
          })
          .finally(function () {
            inputLocked = false;
          });
      }

      send.onclick = submit;

      input.onkeydown = function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        }
      };
    }

    function hideInput() {
      clearInputHandler();
      inputRow.hidden = true;
      input.value = "";
    }

    function showInput(placeholder, handler, keepChoices) {
      if (!keepChoices) choices.innerHTML = "";
      inputRow.hidden = false;
      input.placeholder = placeholder || "Votre réponse";
      input.value = "";
      setInputHandler(handler);

      try {
        input.focus({ preventScroll: true });
      } catch (e) {
        input.focus();
      }
    }

    function setChoices(items, handler) {
      hideInput();
      choices.innerHTML = "";

      items.forEach(function (item) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chatChoice";
        button.textContent = item;

        button.addEventListener("click", function () {
          choices.innerHTML = "";
          handler(item);
        }, { once: true });

        choices.appendChild(button);
      });
    }

    function askText(question, next, placeholder) {
      addMessage(question, "bot");

      showInput(placeholder || "Votre réponse", function (value) {
        hideInput();
        return next(value);
      });
    }

    function normalize(value) {
      return String(value || "")
        .toLowerCase()
        .replace(/[’']/g, " ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9+ ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function levenshtein(a, b) {
      a = String(a || "");
      b = String(b || "");

      const m = a.length;
      const n = b.length;
      const dp = Array.from({ length: m + 1 }, function () {
        return new Array(n + 1).fill(0);
      });

      for (let i = 0; i <= m; i++) dp[i][0] = i;
      for (let j = 0; j <= n; j++) dp[0][j] = j;

      for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
          const cost = a[i - 1] === b[j - 1] ? 0 : 1;
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1,
            dp[i - 1][j - 1] + cost
          );
        }
      }

      return dp[m][n];
    }

    function fuzzyWord(text, word) {
      if (text.includes(word)) return true;
      if (word.includes(" ")) return false;

      const tokens = text.split(" ");

      return tokens.some(function (token) {
        if (token.length < 4 || word.length < 4) return false;

        const maxDistance = word.length >= 8 ? 2 : 1;

        return Math.abs(token.length - word.length) <= maxDistance &&
          levenshtein(token, word) <= maxDistance;
      });
    }

    function smartHas(text, terms) {
      return terms.some(function (term) {
        return text.includes(term) || fuzzyWord(text, term);
      });
    }

    function wantsQuote(text) {
      if (text.includes("devis gratuit") ||
          text.includes("devis est gratuit") ||
          text.includes("prix du devis")) {
        return false;
      }

      if (text === "devis") return true;
      if (text.startsWith("devis ") && !text.includes("gratuit")) return true;

      return smartHas(text, [
        "je veux un devis",
        "je voudrais un devis",
        "faire un devis",
        "faire devis",
        "demande de devis",
        "demander un devis",
        "obtenir un devis",
        "avoir un devis",
        "besoin d un devis",
        "devis pour",
        "chiffrage",
        "estimation des travaux"
      ]);
    }

    function urgentSituation(text) {
      if (text === "fuite" || text === "urgence") return true;

      return smartHas(text, [
        "j ai une fuite",
        "ca fuit",
        "eau entre",
        "eau rentre",
        "infiltration en cours",
        "fuite active",
        "urgence toiture",
        "tuile envolee",
        "tuiles envolees",
        "toit ouvert",
        "element menace de tomber",
        "il pleut dans",
        "eau dans la maison"
      ]);
    }

    function topicLabel(topic) {
      const labels = {
        gutter: "les travaux de gouttière",
        zinc: "la zinguerie",
        ridge: "le faîtage",
        cleaning: "le nettoyage ou démoussage",
        renovation: "la rénovation de toiture",
        insulation: "l’isolation",
        wood: "la charpente",
        velux: "les fenêtres de toit",
        roof: "la couverture"
      };
      return labels[topic] || "les travaux";
    }

    function answerQuestion(question) {
      const q = normalize(question);
      let topic = null;
      let answer = "";

      if (smartHas(q, ["bonjour", "salut", "bonsoir", "hello"])) {
        return {
          topic: "greeting",
          text: "Bonjour 👋 Je peux répondre à vos questions sur votre toiture, les prestations de J2B Couverture, les zones d’intervention, les urgences ou préparer une demande de devis."
        };
      }

      if (smartHas(q, ["merci", "super", "parfait", "d accord", "ok", "okay"])) {
        return {
          topic: "thanks",
          text: "Avec plaisir 👌 Vous pouvez continuer à me poser vos questions ou demander un devis directement ici."
        };
      }

      if (smartHas(q, ["au revoir", "bonne journee", "bonne soiree", "a bientot"])) {
        return {
          topic: "bye",
          text: "Avec plaisir. Bonne journée 👋 Si besoin, J2B Couverture reste joignable par téléphone ou WhatsApp."
        };
      }

      if (smartHas(q, [
        "prix", "tarif", "combien", "cout", "combien ca coute",
        "prix au metre", "prix au m2"
      ])) {
        const context = conversation.lastTopic && conversation.lastTopic !== "price"
          ? " pour " + topicLabel(conversation.lastTopic)
          : "";

        return {
          topic: "price",
          text: "Le prix" + context + " dépend surtout de la surface, de l’état de la toiture, de l’accès et du type d’intervention. Si vous me décrivez le chantier et la commune, je peux vous orienter vers une demande de devis gratuite."
        };
      }

      if (q.includes("devis") && smartHas(q, ["gratuit", "payant", "prix du devis"])) {
        return {
          topic: "quote_info",
          text: "Oui, la demande de devis est gratuite. Si vous le souhaitez, je peux recueillir les informations nécessaires directement ici."
        };
      }

      if (smartHas(q, [
        "fuite", "infiltration", "eau entre", "tempete", "grele",
        "tuile envolee", "urgence"
      ])) {
        return {
          topic: "emergency",
          text: "J2B Couverture intervient pour les fuites, infiltrations et dégâts de toiture. Si de l’eau entre actuellement ou qu’un élément menace de tomber, ne montez pas sur le toit : appelez-nous ou envoyez des photos par WhatsApp."
        };
      }

      if (smartHas(q, [
        "gouttiere", "gouttieres", "descente zinc", "descente eau"
      ])) {
        topic = "gutter";
        answer = "Oui. J2B Couverture réalise la pose, le remplacement et la réparation de gouttières et descentes, notamment en zinc, selon la configuration du chantier.";
      } else if (smartHas(q, [
        "zinguerie", "zinc", "noue", "solin", "couvertine", "rive zinc"
      ])) {
        topic = "zinc";
        answer = "Oui. J2B Couverture réalise différents travaux de zinguerie : noues, solins, rives, couvertines, gouttières et autres éléments nécessaires à l’étanchéité et à l’évacuation des eaux.";
      } else if (smartHas(q, [
        "faitage", "aretier", "arretiers", "closoir"
      ])) {
        topic = "ridge";
        answer = "Oui. J2B Couverture intervient sur les faîtages et arêtiers : contrôle, réparation, remise en état ou pose sur closoir ventilé selon l’existant et l’état de la toiture.";
      } else if (smartHas(q, [
        "demoussage", "mousse", "lichen", "nettoyage toiture",
        "hydrofuge", "entretien toiture"
      ])) {
        topic = "cleaning";
        answer = "Oui. J2B Couverture réalise le nettoyage, le démoussage et l’entretien de toiture. Le traitement dépend du support, de l’encrassement et de l’état général de la couverture.";
      } else if (smartHas(q, [
        "renovation", "refaire toiture", "toiture complete",
        "remaniage", "reparation toiture"
      ])) {
        topic = "renovation";
        answer = "Oui. J2B Couverture réalise des réparations ciblées ainsi que des rénovations partielles ou complètes. Une infiltration ne signifie pas forcément qu’il faut refaire toute la toiture : l’état général doit d’abord être contrôlé.";
      } else if (smartHas(q, [
        "isolation", "isoler", "isolant", "triso"
      ])) {
        topic = "insulation";
        answer = "Oui. Des travaux d’isolation de toiture peuvent être intégrés à une rénovation selon la configuration du bâtiment et de la charpente.";
      } else if (smartHas(q, [
        "charpente", "traitement bois", "insecte bois",
        "vrillette", "capricorne"
      ])) {
        topic = "wood";
        answer = "Oui. J2B Couverture peut intervenir sur le traitement de charpente. Un contrôle préalable permet de déterminer l’état du bois et le traitement adapté.";
      } else if (smartHas(q, [
        "velux", "fenetre de toit", "fenetre toit"
      ])) {
        topic = "velux";
        answer = "Les interventions autour des fenêtres de toit peuvent concerner l’étanchéité, les raccords ou des travaux associés à une rénovation. Le mieux est d’envoyer quelques photos pour confirmer ce qui est possible.";
      } else if (smartHas(q, [
        "tuile", "tuiles", "ardoise", "bac acier", "couverture"
      ])) {
        topic = "roof";
        answer = "J2B Couverture intervient sur différents types d’éléments de couverture selon le chantier. Pour confirmer la solution adaptée, envoyez une photo du toit et précisez la commune.";
      } else if (smartHas(q, [
        "toul", "nancy", "ecrouves", "dommartin", "gondreville",
        "liverdun", "meurthe et moselle", "secteur", "zone",
        "intervenez", "deplacement", "vous venez"
      ])) {
        topic = "area";
        answer = "J2B Couverture intervient principalement à Toul et dans le Toulois, notamment à Écrouves, Dommartin-lès-Toul, Gondreville et Liverdun. Selon le chantier, des interventions sont aussi possibles à Nancy et dans d’autres communes de Meurthe-et-Moselle.";
      } else if (smartHas(q, [
        "garantie", "decennale", "assurance", "qbe"
      ])) {
        topic = "warranty";
        answer = "J2B Couverture dispose d’une garantie décennale QBE Europe SA/NV pour les travaux concernés par cette garantie.";
      } else if (smartHas(q, [
        "photo", "photos", "whatsapp", "envoyer image", "image toiture"
      ])) {
        topic = "photo";
        answer = "Oui. Vous pouvez envoyer des photos de la toiture, de la fuite ou de l’élément endommagé directement par WhatsApp au 06 01 46 26 12.";
      } else if (smartHas(q, [
        "telephone", "numero", "appeler", "contact", "email", "mail"
      ])) {
        topic = "contact";
        answer = "Vous pouvez joindre J2B Couverture au 06 01 46 26 12 ou au 03 72 76 00 60. L’adresse e-mail est j2b.couverture@gmail.com.";
      } else if (smartHas(q, [
        "rendez vous", "rdv", "disponible", "disponibilite",
        "quand pouvez vous", "horaire", "ouvert", "samedi", "dimanche", "week end"
      ])) {
        topic = "availability";
        answer = "Les disponibilités varient selon les chantiers en cours et le niveau d’urgence. Indiquez votre commune, votre besoin et votre numéro de téléphone afin que J2B Couverture puisse vous proposer un créneau.";
      } else if (smartHas(q, [
        "vous faites quoi", "prestations", "services", "travaux"
      ])) {
        topic = "services";
        answer = "J2B Couverture intervient notamment en réparation et rénovation de toiture, zinguerie, gouttières, faîtage, démoussage, entretien, isolation, charpente et recherche de fuite.";
      } else if (q === "oui" || q === "non") {
        topic = "clarify";
        answer = "D’accord. Dites-moi simplement ce que vous souhaitez savoir ou décrivez votre problème de toiture en une phrase.";
      } else {
        topic = "unknown";
        answer = "Je ne veux pas vous donner une mauvaise réponse. Donnez-moi un peu plus de contexte : le problème constaté, le type de toiture si vous le connaissez, et la commune du chantier.";
      }

      return { topic: topic, text: answer };
    }

    function showQuestionActions() {
      choices.innerHTML = "";

      const items = [
        "📩 Demander un devis",
        "💬 WhatsApp",
        "📞 Appeler"
      ];

      items.forEach(function (item) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chatChoice";
        button.textContent = item;

        button.addEventListener("click", function () {
          if (item.includes("devis")) {
            hideInput();
            choices.innerHTML = "";
            quoteFlow(false);
          } else if (item.includes("WhatsApp")) {
            window.open(
              "https://wa.me/33601462612?text=" +
                encodeURIComponent("Bonjour J2B Couverture, j’ai une question concernant ma toiture."),
              "_blank",
              "noopener"
            );
          } else {
            location.href = "tel:+33601462612";
          }
        });

        choices.appendChild(button);
      });
    }

    function handleFreeQuestion(question, rearm) {
      const q = normalize(question);
      conversation.lastQuestion = question;

      if (wantsQuote(q)) {
        const answer = "Bien sûr. Je vais vous poser quelques questions rapides pour préparer votre demande de devis.";
        addMessage(answer, "bot");
        notifyQuestion(question, answer);
        hideInput();
        quoteFlow(false);
        return;
      }

      if (urgentSituation(q)) {
        const answer = "D’accord, je traite cela comme une urgence toiture. Je vais vous proposer les moyens les plus rapides pour contacter J2B Couverture.";
        addMessage(answer, "bot");
        notifyQuestion(question, answer);
        hideInput();
        urgentFlow();
        return;
      }

      const result = answerQuestion(question);
      conversation.lastTopic = result.topic || conversation.lastTopic;

      addMessage(result.text, "bot");
      notifyQuestion(question, result.text);

      if (typeof rearm === "function") {
        rearm();
      }
    }

    function questionMode(firstPrompt) {
      if (firstPrompt) {
        addMessage(
          "Posez-moi votre question sur votre toiture ou les services de J2B Couverture.",
          "bot"
        );
      }

      function armQuestionInput() {
        showQuestionActions();

        showInput(
          "Posez une autre question…",
          function (question) {
            handleFreeQuestion(question, armQuestionInput);
          },
          true
        );
      }

      armQuestionInput();
    }

    function urgentFlow() {
      state = { urgency: "Fuite active / urgent" };
      notifyUrgency();

      addMessage(
        "Si de l’eau entre actuellement ou qu’un élément de toiture menace de tomber, ne montez pas sur le toit. Vous pouvez appeler J2B Couverture ou envoyer immédiatement des photos par WhatsApp.",
        "bot"
      );

      setChoices([
        "📞 Appeler maintenant",
        "📸 Envoyer des photos",
        "📩 Préparer une demande"
      ], function (action) {
        addMessage(action, "user");

        if (action.includes("Appeler")) {
          notifyLead("Appel urgence");
          location.href = "tel:+33601462612";
        } else if (action.includes("photos")) {
          notifyLead("WhatsApp urgence / photos");

          window.open(
            "https://wa.me/33601462612?text=" +
              encodeURIComponent("Bonjour J2B Couverture, j’ai une fuite ou une urgence toiture. Je vous envoie des photos."),
            "_blank",
            "noopener"
          );
        } else {
          quoteFlow(true);
        }
      });
    }

    function quoteFlow(urgentPreset) {
      if (!urgentPreset) state = {};
      if (urgentPreset) state.urgency = "Fuite active / urgent";

      addMessage("Quel type de travaux concerne votre demande ?", "bot");

      setChoices([
        "Fuite / infiltration",
        "Réparation toiture",
        "Rénovation toiture",
        "Zinguerie / gouttière",
        "Faîtage / arêtiers",
        "Démoussage / entretien",
        "Isolation / charpente",
        "Autre"
      ], function (need) {
        state.need = need;
        addMessage(need, "user");

        function continueFlow() {
          askText(
            "Dans quelle commune se trouve le chantier ?",
            function (city) {
              state.city = city;

              askText(
                "Indiquez votre nom ou prénom.",
                function (name) {
                  state.name = name;

                  askText(
                    "Quel numéro de téléphone pouvons-nous utiliser pour vous recontacter ?",
                    function (phone) {
                      state.phone = phone;

                      askText(
                        "Ajoutez une courte précision sur les travaux ou le problème constaté.",
                        function (details) {
                          state.details = details;

                          if (!validPhone(phone)) {
                            addMessage(
                              "Le numéro semble incomplet. Vous pourrez le corriger avant l’envoi sur WhatsApp.",
                              "bot"
                            );
                          }

                          addMessage(
                            "Merci. Votre demande est prête. Vous pouvez l’envoyer sur WhatsApp ou appeler directement J2B Couverture.",
                            "bot"
                          );

                          setChoices([
                            "💬 Envoyer sur WhatsApp",
                            "📞 Appeler J2B",
                            "❓ Poser une question"
                          ], function (action) {
                            addMessage(action, "user");

                            if (action.includes("WhatsApp")) {
                              notifyLead("WhatsApp devis");
                              reportConversion();

                              window.open(
                                whatsappLead(state),
                                "_blank",
                                "noopener"
                              );
                            } else if (action.includes("Appeler")) {
                              notifyLead("Appel devis");
                              location.href = "tel:+33601462612";
                            } else {
                              questionMode(true);
                            }
                          });
                        },
                        "Ex. fuite près de la cheminée, gouttière à remplacer…"
                      );
                    },
                    "06 12 34 56 78"
                  );
                },
                "Votre nom"
              );
            },
            "Toul, Nancy…"
          );
        }

        if (state.urgency) {
          continueFlow();
        } else {
          addMessage("Est-ce urgent ?", "bot");

          setChoices([
            "Fuite active / urgent",
            "À contrôler rapidement",
            "Projet à planifier"
          ], function (urgency) {
            state.urgency = urgency;
            addMessage(urgency, "user");
            continueFlow();
          });
        }
      });
    }

    function mainMenu(showIntro) {
      if (showIntro !== false) {
        addMessage(
          "Posez-moi directement votre question sur votre toiture ou les services de J2B Couverture.",
          "bot"
        );
      }

      choices.innerHTML = "";

      [
        "📩 Demander un devis",
        "🚨 Fuite / urgence"
      ].forEach(function (item) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chatChoice";
        button.textContent = item;

        button.addEventListener("click", function () {
          if (item.includes("devis")) {
            hideInput();
            choices.innerHTML = "";
            quoteFlow(false);
          } else {
            hideInput();
            choices.innerHTML = "";
            urgentFlow();
          }
        });

        choices.appendChild(button);
      });

      showInput(
        "Écrivez votre question…",
        function (question) {
          handleFreeQuestion(question, function () {
            mainMenu(false);
          });
        },
        true
      );
    }

    function startV6() {
      messages.innerHTML = "";
      choices.innerHTML = "";
      hideInput();
      state = {};
      conversation.lastTopic = null;
      conversation.lastQuestion = "";

      addMessage(
        "Bonjour 👋 Je suis l’assistant J2B Couverture. Écrivez directement votre question ci-dessous. Vous pouvez aussi utiliser les raccourcis Devis ou Urgence.",
        "bot"
      );

      mainMenu(true);
      started = true;
    }

    launcher.addEventListener("click", function () {
      box.classList.add("open");
      launcher.setAttribute("aria-expanded", "true");
      notifyOpen();

      if (!started) {
        startV6();
      }
    });

    closeBtn.addEventListener("click", function () {
      box.classList.remove("open");
      launcher.setAttribute("aria-expanded", "false");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();