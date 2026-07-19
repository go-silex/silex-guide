/* Silex Guide — diagnostic + formulaire */
(function () {
  "use strict";

  var QUESTIONS = [
    {
      q: "Quand tu ouvres une conversation avec l'IA, elle sait quoi de ta boîte ?",
      options: [
        "Rien — je réexplique tout à chaque fois",
        "Ce que je lui colle : quelques docs, un brief",
        "L'essentiel : clients, offre, process — sans que je répète",
        "Tout — et elle agit dessus sans moi"
      ]
    },
    {
      q: "Le savoir de ta boîte (clients, décisions, historique) vit où ?",
      options: [
        "Dans les têtes et les boîtes mail",
        "Dans des docs éparpillés (Drive, Notion, Excel…)",
        "Dans un endroit central, structuré, partagé",
        "Dans un endroit central que l'IA lit ET enrichit"
      ]
    },
    {
      q: "Ton équipe et l'IA, c'est…",
      options: [
        "Pas d'usage, ou chacun en cachette",
        "Chacun ses prompts, rien ne se partage",
        "Un contexte commun que tout le monde utilise",
        "Des agents partagés qui bossent pour toute l'équipe"
      ]
    },
    {
      q: "La plus grosse chose que ton IA fait seule, de bout en bout ?",
      options: [
        "Reformuler des emails, résumer des docs",
        "Rédiger des briefs, trier des demandes, comparer des devis",
        "Préparer mes RDV avec tout l'historique",
        "Résoudre des tickets, mettre à jour le CRM — en autonomie"
      ]
    },
    {
      q: "Si tu coupais l'IA demain…",
      options: [
        "Honnêtement, rien ne changerait",
        "On perdrait quelques heures par semaine",
        "Gros ralentissement : elle porte notre contexte",
        "La boîte ne tournerait plus pareil"
      ]
    }
  ];

  var LEVELS = {
    1: {
      name: "Le sceptique isolé",
      desc: "L'IA t'aide ponctuellement — reformuler, résumer, brainstormer — mais chaque conversation repart de zéro. Si tu la coupais demain, personne ne verrait la différence. Ce n'est pas un problème de prompts : c'est l'absence de contexte persistant.",
      block: "<strong>Ce qui te bloque :</strong> tu réexpliques ta boîte à l'IA à chaque conversation. Le guide te montre comment passer de l'aide ponctuelle à la vraie délégation — puis comment construire la mémoire qui change tout."
    },
    2: {
      name: "Le productif",
      desc: "Tu délègues de vraies tâches et tu récupères des heures chaque semaine. C'est le mode copilote — et c'est déjà mieux que 90 % des PME. Mais tout repose sur toi : ton contexte, tes prompts, tes habitudes.",
      block: "<strong>Ce qui te bloque :</strong> le savoir reste individuel. Ton équipe ne partage ni contexte ni apprentissages. Le chapitre « Architecte » du guide te donne la construction du cerveau partagé, étape par étape."
    },
    3: {
      name: "L'architecte",
      desc: "Ta boîte a un cerveau partagé : clients, process, décisions vivent à un endroit que l'équipe et l'IA consultent. Tu ne réexpliques plus rien. Tu fais partie des rares — le plus dur est fait.",
      block: "<strong>Ce qui te bloque :</strong> le passage à l'échelle. Un cerveau que l'IA ne fait que lire reste une documentation. Le chapitre « Multiplicateur » te montre comment construire ton premier agent autonome dessus."
    },
    4: {
      name: "Le multiplicateur",
      desc: "Des agents lisent et écrivent dans le cerveau de ta boîte et font des travaux entiers en autonomie. Chaque interaction améliore le système. Tu es dans le 1 % — sérieusement.",
      block: "<strong>La suite pour toi :</strong> composer. Plus d'agents, des périmètres plus larges, et les garde-fous qui vont avec. Le guide te servira de checklist — et on serait sincèrement curieux d'échanger avec toi."
    }
  };

  var state = { current: 0, answers: [] };

  var $ = function (id) { return document.getElementById(id); };
  var stepLanding = $("step-landing");
  var stepQuiz = $("step-quiz");
  var stepResult = $("step-result");

  function show(step) {
    [stepLanding, stepQuiz, stepResult].forEach(function (el) { el.classList.add("hidden"); });
    step.classList.remove("hidden");
    window.scrollTo({ top: 0 });
  }

  function renderQuestion() {
    var i = state.current;
    var q = QUESTIONS[i];
    $("quiz-count").textContent = "Question " + (i + 1) + " sur " + QUESTIONS.length;
    $("quiz-q").textContent = q.q;
    $("progress-bar").style.width = ((i / QUESTIONS.length) * 100) + "%";
    $("btn-back").style.visibility = i === 0 ? "hidden" : "visible";

    var box = $("quiz-options");
    box.innerHTML = "";
    q.options.forEach(function (label, idx) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option";
      btn.innerHTML = '<span class="dot"></span><span>' + label + "</span>";
      btn.addEventListener("click", function () {
        state.answers[i] = idx + 1; // 1..4 points
        if (i + 1 < QUESTIONS.length) {
          state.current++;
          renderQuestion();
        } else {
          showResult();
        }
      });
      box.appendChild(btn);
    });
  }

  function computeLevel(score) {
    if (score <= 8) return 1;
    if (score <= 12) return 2;
    if (score <= 16) return 3;
    return 4;
  }

  function showResult() {
    var score = state.answers.reduce(function (a, b) { return a + b; }, 0);
    var lvl = computeLevel(score);
    var L = LEVELS[lvl];
    $("result-badge").textContent = "Ton niveau : " + lvl + " / 4";
    $("result-title").textContent = "Niveau " + lvl + " — " + L.name;
    $("result-score").textContent = "Score : " + score + " / 20";
    $("result-desc").textContent = L.desc;
    $("result-block").innerHTML = L.block;
    try {
      sessionStorage.setItem("silex_diag", JSON.stringify({ score: score, level: lvl, answers: state.answers }));
    } catch (e) { /* stockage indisponible : le diagnostic partira quand même dans le POST */ }
    show(stepResult);
  }

  // ── Navigation ──
  $("btn-start").addEventListener("click", function () {
    state.current = 0;
    state.answers = [];
    renderQuestion();
    show(stepQuiz);
  });

  $("btn-back").addEventListener("click", function () {
    if (state.current > 0) {
      state.current--;
      renderQuestion();
    }
  });

  // ── Formulaire ──
  var form = $("lead-form");
  var btnSubmit = $("btn-submit");
  var errBox = $("form-error");

  function setError(msg) {
    if (msg) {
      errBox.textContent = msg;
      errBox.classList.add("show");
    } else {
      errBox.classList.remove("show");
    }
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    setError(null);

    var prenom = $("f-prenom").value.trim();
    var nom = $("f-nom").value.trim();
    var email = $("f-email").value.trim();
    var site = $("f-site").value.trim();
    var douleurCat = $("f-douleur").value;
    var douleurTxt = $("f-verbatim").value.trim();

    ["f-prenom", "f-nom", "f-email", "f-douleur"].forEach(function (id) { $(id).classList.remove("invalid"); });

    var missing = [];
    if (!prenom) { missing.push("f-prenom"); }
    if (!nom) { missing.push("f-nom"); }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { missing.push("f-email"); }
    if (!douleurCat) { missing.push("f-douleur"); }
    if (missing.length) {
      missing.forEach(function (id) { $(id).classList.add("invalid"); });
      setError("Il manque quelques infos pour t'envoyer le guide — regarde les champs en rouge.");
      return;
    }

    if (site && !/^https?:\/\//i.test(site)) { site = "https://" + site; }

    var diag = { score: null, level: null, answers: [] };
    try { diag = JSON.parse(sessionStorage.getItem("silex_diag")) || diag; } catch (e) { /* no-op */ }

    var payload = {
      prenom: prenom,
      nom: nom,
      email: email,
      site: site,
      douleurCat: douleurCat,
      douleurTxt: douleurTxt,
      niveau: diag.level,
      score: diag.score,
      answers: diag.answers,
      website: $("f-website").value, // honeypot
      ts: new Date().toISOString(),
      source: "s.gosilex.com/guide"
    };

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="spinner"></span> Envoi en cours…';

    fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, body: j }; }); })
      .then(function (res) {
        if (!res.ok || !res.body.ok) {
          throw new Error(res.body && res.body.error ? res.body.error : "server");
        }
        try { sessionStorage.setItem("silex_guide_unlocked", "1"); } catch (e) { /* no-op */ }
        window.location.href = "guide.html";
      })
      .catch(function () {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Recevoir le guide";
        setError("Oups, l'envoi a échoué. Réessaie — ou écris-nous à p@gosilex.com, on t'enverra le guide à la main.");
      });
  });
})();
