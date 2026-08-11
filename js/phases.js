/* Silex / Les 4 phases : formulaire de capture en 2 étapes */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var form = $("lead-form");
  var step1 = $("fstep-1");
  var step2 = $("fstep-2");
  var count = $("fstep-count");
  var bar = $("form-progress-bar");
  var errBox = $("form-error");
  var btnNext = $("btn-next");
  var btnBack = $("btn-back");
  var btnSubmit = $("btn-submit");

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function setError(msg) {
    if (msg) {
      errBox.textContent = msg;
      errBox.classList.add("show");
    } else {
      errBox.classList.remove("show");
    }
  }

  function clearInvalid(ids) {
    ids.forEach(function (id) { $(id).classList.remove("invalid"); });
  }

  function flagInvalid(ids, msg) {
    ids.forEach(function (id) { $(id).classList.add("invalid"); });
    setError(msg);
    $(ids[0]).focus();
  }

  function goToStep(n) {
    step1.classList.toggle("hidden", n !== 1);
    step2.classList.toggle("hidden", n !== 2);
    count.textContent = n === 1 ? "Étape 1 sur 2 · Toi" : "Étape 2 sur 2 · Ton entreprise";
    bar.style.width = n === 1 ? "50%" : "100%";
    setError(null);
    if (n === 2) { $("f-site").focus(); }
  }

  // ── Étape 1 → 2 ──
  btnNext.addEventListener("click", function () {
    var ids = ["f-prenom", "f-nom", "f-email", "f-tel"];
    clearInvalid(ids);

    var missing = [];
    if (!$("f-prenom").value.trim()) { missing.push("f-prenom"); }
    if (!$("f-nom").value.trim()) { missing.push("f-nom"); }
    if (!EMAIL_RE.test($("f-email").value.trim())) { missing.push("f-email"); }
    if ($("f-tel").value.replace(/[^0-9]/g, "").length < 6) { missing.push("f-tel"); }

    if (missing.length) {
      flagInvalid(missing, "Il manque quelques infos : regarde les champs en rouge.");
      return;
    }
    goToStep(2);
  });

  btnBack.addEventListener("click", function () { goToStep(1); });

  // Entrée dans un champ de l'étape 1 = passer à l'étape suivante, pas soumettre
  step1.addEventListener("keydown", function (ev) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      btnNext.click();
    }
  });

  // ── Soumission ──
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    setError(null);

    var ids = ["f-site", "f-effectif", "f-probleme"];
    clearInvalid(ids);

    var site = $("f-site").value.trim();
    var effectif = $("f-effectif").value;
    var probleme = $("f-probleme").value;

    var missing = [];
    if (!site) { missing.push("f-site"); }
    if (!effectif) { missing.push("f-effectif"); }
    if (!probleme) { missing.push("f-probleme"); }
    if (missing.length) {
      flagInvalid(missing, "Il manque quelques infos : regarde les champs en rouge.");
      return;
    }

    if (!/^https?:\/\//i.test(site)) { site = "https://" + site; }

    var payload = {
      magnet: "phases",
      prenom: $("f-prenom").value.trim(),
      nom: $("f-nom").value.trim(),
      email: $("f-email").value.trim(),
      telephone: $("f-tel").value.trim(),
      site: site,
      effectif: effectif,
      probleme: probleme,
      problemeTxt: $("f-verbatim").value.trim(),
      website: $("f-website").value, // honeypot
      ts: new Date().toISOString(),
      source: "s.gosilex.com/phases"
    };

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span class="spinner"></span> Envoi en cours…';

    fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, body: j }; });
      })
      .then(function (res) {
        if (!res.ok || !res.body.ok) {
          throw new Error(res.body && res.body.error ? res.body.error : "server");
        }
        try { sessionStorage.setItem("silex_phases_unlocked", "1"); } catch (e) { /* no-op */ }
        window.location.href = "phases-ressource.html";
      })
      .catch(function () {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Accéder à la ressource";
        setError("Oups, l'envoi a échoué. Réessaie, ou écris-nous à p@gosilex.com et on t'envoie la ressource à la main.");
      });
  });

  goToStep(1);
})();
