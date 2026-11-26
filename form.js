// Formulaires Agendo : chargement du lien personnel, sauvegarde automatique, envoi au robot.
(function () {
  const API = "https://vukexgjesgtoweahbgse.supabase.co/functions/v1/client-forms";
  const form = document.querySelector("form");
  const kind = form.dataset.form; // "demarrage" ou "contenu"
  const q = new URLSearchParams(location.search);
  const t = q.get("t") || "";
  const m = q.get("m") || "";
  const key = `agendo-${kind}-${t}-${m}`;
  const $ = (s) => document.querySelector(s);
  const errBox = $("#error");

  function showError(text) {
    errBox.textContent = text;
    errBox.classList.remove("hidden");
    errBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function collect() {
    const out = {};
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === "checkbox" && el.dataset.bool !== undefined) out[el.name] = el.checked;
      else if (el.type === "checkbox") {
        out[el.name] = out[el.name] || [];
        if (el.checked) out[el.name].push(el.value);
      } else if (el.type === "radio") {
        if (el.checked) out[el.name] = el.value;
      } else if (el.type === "number") {
        if (el.value !== "") out[el.name] = Number(el.value);
      } else out[el.name] = el.value;
    }
    return out;
  }

  function fill(data) {
    if (!data) return;
    for (const el of form.elements) {
      if (!el.name || !(el.name in data)) continue;
      const v = data[el.name];
      if (el.type === "checkbox" && el.dataset.bool !== undefined) el.checked = !!v;
      else if (el.type === "checkbox") el.checked = Array.isArray(v) && v.includes(el.value);
      else if (el.type === "radio") el.checked = v === el.value;
      else if (v != null) el.value = v;
    }
  }

  function progress() {
    const req = [...form.querySelectorAll("[required]")];
    const okCount = req.filter((el) => (el.type === "checkbox" ? el.checked : el.value.trim() !== "")).length;
    $(".progress i").style.width = (req.length ? Math.round((okCount / req.length) * 100) : 0) + "%";
  }

  let timer;
  form.addEventListener("input", () => {
    progress();
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(collect()));
        $("#saved").textContent = "Brouillon enregistré sur cet appareil";
      } catch (_) { /* navigation privée */ }
    }, 600);
  });

  if (!/^[0-9a-f]{32}$/.test(t) || (kind === "contenu" && !/^20\d\d-(0[1-9]|1[0-2])$/.test(m))) {
    form.classList.add("hidden");
    showError("Ce lien n'est pas complet. Utilisez le lien exact reçu de la part d'Agendo, ou écrivez-nous.");
    return;
  }

  fetch(`${API}?t=${t}&f=${kind}${m ? `&m=${m}` : ""}`)
    .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
    .then(({ ok, j }) => {
      if (!ok) throw new Error(j.error || "lien invalide");
      document.querySelectorAll("[data-client]").forEach((el) => (el.textContent = j.client));
      if (j.prenom) document.querySelectorAll("[data-prenom]").forEach((el) => (el.textContent = " " + j.prenom));
      if (j.month) document.querySelectorAll("[data-month]").forEach((el) => (el.textContent = j.month));
      fill(j.answers);
      try { fill(JSON.parse(localStorage.getItem(key) || "null")); } catch (_) { /* rien */ }
      progress();
    })
    .catch(() => {
      form.classList.add("hidden");
      showError("Ce lien ne fonctionne pas ou a expiré. Écrivez à Agendo pour en recevoir un nouveau.");
    });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errBox.classList.add("hidden");
    const missing = [...form.querySelectorAll("[required]")].find((el) => (el.type === "checkbox" ? !el.checked : !el.value.trim()));
    if (missing) {
      missing.focus();
      showError("Il manque une réponse obligatoire (marquée d'un *).");
      return;
    }
    const btn = $("button.send");
    btn.disabled = true;
    btn.textContent = "Envoi en cours…";
    fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ t, f: kind, m: m || undefined, answers: collect() }),
    })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) throw new Error(j.error || "erreur");
        try { localStorage.removeItem(key); } catch (_) { /* rien */ }
        form.classList.add("hidden");
        $(".intro").classList.add("hidden");
        $("#done").classList.remove("hidden");
        $(".progress i").style.width = "100%";
        window.scrollTo({ top: 0, behavior: "smooth" });
      })
      .catch(() => {
        btn.disabled = false;
        btn.textContent = "Envoyer mes réponses";
        showError("L'envoi n'a pas marché. Vos réponses sont gardées sur cet appareil : réessayez dans un instant.");
      });
  });
})();
