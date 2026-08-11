/**
 * POST /api/lead : capture des leads des lead magnets Silex.
 *
 * Multi-source : le champ `magnet` du payload ("guide" | "phases") choisit la
 * validation, le rendu Slack, la note Attio et la liste Attio de destination.
 * Absent → "guide" (le front historique du Guide Claude ne l'envoie pas).
 *
 * Intégrations (chacune optionnelle, aucune ne bloque la capture) :
 *  - Slack : SLACK_BOT_TOKEN + SLACK_CHANNEL_LEADS (chat.postMessage)
 *            ou SLACK_WEBHOOK (incoming webhook) en repli
 *  - Attio : ATTIO_API_KEY → assert de la personne + note + entrée de liste
 *  - Brevo : BREVO_API_KEY → upsert contact + email (magnet "guide" uniquement)
 *
 * Le payload complet est toujours loggé (trace de secours dans les logs Vercel).
 */

const GUIDE_URL = process.env.GUIDE_URL || "https://s.gosilex.com/guide";
const GUIDE_KEY = "silex-4-niveaux";

const LEVEL_NAMES = {
  1: "Le sceptique isolé",
  2: "Le productif",
  3: "L'architecte",
  4: "Le multiplicateur",
};

/* ── Ressource « Les 4 phases » ─────────────────────────────── */

const EFFECTIF_LABEL = {
  "1": "1 personne (solo)",
  "2-10": "2 à 10 salariés",
  "11-50": "11 à 50 salariés",
  "51-200": "51 à 200 salariés",
  "200+": "plus de 200 salariés",
};

const PROBLEME_LABEL = {
  repetitif: "Perd du temps sur des tâches répétitives",
  equipes: "Les équipes n'utilisent pas l'IA, ou très mal",
  outils: "Les outils ne se parlent pas, tout finit sur Excel",
  demarrage: "Ne sait pas par où commencer sur l'IA",
  embauche: "Veut faire plus sans embaucher",
  commercial: "Le process commercial fuit (leads, relances, suivi)",
};

// Poids de qualification : taille de boîte (0-3) + douleur (1-3) + email pro (1).
const EFFECTIF_SCORE = { "1": 0, "2-10": 1, "11-50": 3, "51-200": 3, "200+": 2 };
const PROBLEME_SCORE = {
  repetitif: 2,
  equipes: 3,
  outils: 3,
  demarrage: 1,
  embauche: 2,
  commercial: 3,
};

const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "outlook.fr", "hotmail.com",
  "hotmail.fr", "live.fr", "live.com", "msn.com", "yahoo.com", "yahoo.fr",
  "free.fr", "orange.fr", "wanadoo.fr", "sfr.fr", "neuf.fr", "bbox.fr",
  "laposte.net", "icloud.com", "me.com", "aol.com", "gmx.fr", "gmx.com",
  "protonmail.com", "proton.me", "numericable.fr",
]);

function emailDomain(email) {
  return String(email || "").split("@")[1]?.toLowerCase() || "";
}

function isEmailPro(email) {
  const d = emailDomain(email);
  return Boolean(d) && !FREE_MAIL.has(d);
}

function temperature(lead) {
  const score =
    (EFFECTIF_SCORE[lead.effectif] ?? 0) +
    (PROBLEME_SCORE[lead.probleme] ?? 0) +
    (isEmailPro(lead.email) ? 1 : 0);
  if (score >= 5) return { emoji: "🔥", label: "CHAUD", score };
  if (score >= 3) return { emoji: "🟠", label: "TIÈDE", score };
  return { emoji: "⚪", label: "FROID", score };
}

/* ── Registre des lead magnets ──────────────────────────────── */

const MAGNETS = {
  guide: {
    label: "Guide Claude",
    defaultSource: "s.gosilex.com/guide",
    attioListEnv: "ATTIO_LIST_ID",
    noteTitle: "Lead Guide Claude (diagnostic)",
    sep: "—", // format historique du Guide, laissé tel quel
    brevo: true,
    validate(lead) {
      return lead.douleurCat ? null : "Irritant requis.";
    },
    header() {
      return "🔥 *Nouveau lead — Guide Claude*";
    },
    details(lead) {
      return [
        lead.site ? `Site : ${esc(lead.site)}` : null,
        `Diagnostic : ${diagnosticLine(lead)}`,
        `Irritant : ${esc(lead.douleurCat)}`,
        lead.douleurTxt ? `> « ${esc(lead.douleurTxt)} »` : null,
      ];
    },
    noteLines(lead) {
      return [
        `Site : ${lead.site || "non renseigné"}`,
        `Diagnostic : ${diagnosticLine(lead)}`,
        `Irritant : ${lead.douleurCat}`,
        lead.douleurTxt ? `Verbatim : « ${lead.douleurTxt} »` : null,
      ];
    },
  },

  phases: {
    label: "Les 4 phases",
    defaultSource: "s.gosilex.com/phases",
    attioListEnv: "ATTIO_LIST_ID_PHASES",
    noteTitle: "Lead · Ressource « Les 4 phases »",
    sep: "·",
    brevo: false,
    validate(lead) {
      if (!lead.site) return "URL de l'entreprise requise.";
      if (!EFFECTIF_LABEL[lead.effectif]) return "Nombre de salariés requis.";
      if (!PROBLEME_LABEL[lead.probleme]) return "Problématique principale requise.";
      return null;
    },
    header(lead) {
      const t = temperature(lead);
      return `${t.emoji} *Nouveau lead ${t.label} · Les 4 phases*`;
    },
    details(lead) {
      const t = temperature(lead);
      return [
        `Entreprise : ${esc(lead.site)} · ${EFFECTIF_LABEL[lead.effectif]}`,
        `Problématique : ${PROBLEME_LABEL[lead.probleme]}`,
        lead.problemeTxt ? `> « ${esc(lead.problemeTxt)} »` : null,
        `Qualif : ${t.score}/7${isEmailPro(lead.email) ? "" : " · email perso"}`,
      ];
    },
    noteLines(lead) {
      const t = temperature(lead);
      return [
        `Entreprise : ${lead.site}`,
        `Effectif : ${EFFECTIF_LABEL[lead.effectif]}`,
        `Problématique : ${PROBLEME_LABEL[lead.probleme]}`,
        lead.problemeTxt ? `Verbatim : « ${lead.problemeTxt} »` : null,
        `Qualif : ${t.label} (${t.score}/7)${isEmailPro(lead.email) ? "" : " · email perso"}`,
      ];
    },
  },
};

function getMagnet(lead) {
  return MAGNETS[lead.magnet] || MAGNETS.guide;
}

function diagnosticLine(lead) {
  return lead.niveau
    ? `Niveau ${lead.niveau} — ${LEVEL_NAMES[lead.niveau] || "?"} (score ${lead.score}/20)`
    : "non renseigné";
}

/* ── Helpers ────────────────────────────────────────────────── */

function esc(s) {
  return String(s || "").slice(0, 1500);
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function validate(lead, magnet) {
  if (lead.website) return "spam"; // honeypot rempli → bot
  if (!lead.prenom || !lead.nom) return "Prénom et nom requis.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email || "")) return "Email invalide.";
  if ((lead.telephone || "").replace(/[^0-9]/g, "").length < 6) return "Téléphone requis.";
  return magnet.validate(lead);
}

function slackText(lead, magnet) {
  const sep = magnet.sep;
  const lines = [
    magnet.header(lead),
    `*${esc(lead.prenom)} ${esc(lead.nom)}* ${sep} ${esc(lead.email)}`,
    lead.telephone ? `📞 ${esc(lead.telephone)} ${sep} à appeler sous 24 h` : null,
    ...magnet.details(lead),
  ];
  return lines.filter(Boolean).join("\n");
}

/* ── Intégrations ───────────────────────────────────────────── */

async function notifySlack(lead, magnet, warnings) {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_CHANNEL_LEADS;
  const webhook = process.env.SLACK_WEBHOOK;
  const text = slackText(lead, magnet);

  if (token && channel) {
    const r = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel, text, unfurl_links: false }),
    });
    const j = await r.json();
    if (!j.ok) throw new Error(`slack: ${j.error}`);
    return;
  }
  if (webhook) {
    const r = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) throw new Error(`slack webhook: HTTP ${r.status}`);
    return;
  }
  warnings.push("slack: non configuré");
}

async function pushAttio(lead, magnet, warnings) {
  const key = process.env.ATTIO_API_KEY;
  if (!key) {
    warnings.push("attio: non configuré");
    return;
  }
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
  // Assert de la personne par email (crée ou met à jour)
  const r = await fetch(
    "https://api.attio.com/v2/objects/people/records?matching_attribute=email_addresses",
    {
      method: "PUT",
      headers,
      body: JSON.stringify({
        data: {
          values: {
            email_addresses: [{ email_address: lead.email }],
            name: [
              {
                first_name: lead.prenom,
                last_name: lead.nom,
                full_name: `${lead.prenom} ${lead.nom}`,
              },
            ],
          },
        },
      }),
    }
  );
  const j = await r.json();
  if (!r.ok) throw new Error(`attio: ${JSON.stringify(j).slice(0, 200)}`);

  const recordId = j?.data?.id?.record_id;
  // Liste de destination : celle du magnet si elle est configurée, sinon la
  // liste par défaut du workspace (aujourd'hui « Guide Claude - 5 personnes »,
  // qui reçoit les leads des deux lead magnets).
  const listId = process.env[magnet.attioListEnv] || process.env.ATTIO_LIST_ID;
  if (recordId && listId) {
    // Ajout à la liste (sans doublon si la personne y est déjà)
    try {
      const q = await fetch(`https://api.attio.com/v2/lists/${listId}/entries/query`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          filter: { parent_record_id: recordId },
          limit: 1,
        }),
      });
      const qj = await q.json();
      if (!qj?.data?.length) {
        await fetch(`https://api.attio.com/v2/lists/${listId}/entries`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            data: {
              parent_record_id: recordId,
              parent_object: "people",
              entry_values: {},
            },
          }),
        });
      }
    } catch {
      warnings.push("attio: entrée liste non créée");
    }
  }
  // Téléphone sur la fiche : best-effort séparé : un format que le workspace
  // n'arrive pas à parser ne doit jamais casser la fiche ni la note.
  if (recordId && lead.telephone) {
    try {
      const pr = await fetch(
        `https://api.attio.com/v2/objects/people/records/${recordId}`,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            data: {
              values: {
                phone_numbers: [
                  { original_phone_number: lead.telephone, country_code: "FR" },
                ],
              },
            },
          }),
        }
      );
      if (!pr.ok) warnings.push("attio: téléphone non enregistré sur la fiche");
    } catch {
      warnings.push("attio: téléphone non enregistré sur la fiche");
    }
  }

  if (recordId) {
    await fetch("https://api.attio.com/v2/notes", {
      method: "POST",
      headers,
      body: JSON.stringify({
        data: {
          parent_object: "people",
          parent_record_id: recordId,
          title: magnet.noteTitle,
          format: "plaintext",
          content: [
            `Source : ${lead.source || magnet.defaultSource}`,
            `Téléphone : ${lead.telephone || "non renseigné"} (à appeler sous 24 h)`,
            ...magnet.noteLines(lead),
          ]
            .filter(Boolean)
            .join("\n"),
        },
      }),
    }).catch(() => warnings.push("attio: note non créée"));
  }
}

async function pushBrevo(lead, magnet, warnings) {
  if (!magnet.brevo) return; // ressource délivrée en direct, pas d'email
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    warnings.push("brevo: non configuré");
    return;
  }
  const headers = { "Content-Type": "application/json", "api-key": key };

  const contact = {
    email: lead.email,
    attributes: {
      PRENOM: lead.prenom,
      NOM: lead.nom,
      TELEPHONE: lead.telephone || "",
      SITE_WEB: lead.site || "",
      DOULEUR: lead.douleurCat,
      NIVEAU_IA: lead.niveau || 0,
    },
    updateEnabled: true,
  };
  if (process.env.BREVO_LIST_ID) {
    contact.listIds = [Number(process.env.BREVO_LIST_ID)];
  }
  const r = await fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers,
    body: JSON.stringify(contact),
  });
  if (!r.ok && r.status !== 204) {
    const t = await r.text();
    throw new Error(`brevo contact: ${t.slice(0, 200)}`);
  }

  const guideLink = `${GUIDE_URL.replace(/\/$/, "")}?k=${GUIDE_KEY}`;
  const mail = {
    sender: { name: "Pierre de Silex", email: "p@gosilex.com" },
    to: [{ email: lead.email, name: `${lead.prenom} ${lead.nom}` }],
    subject: "Ton guide — Les 4 niveaux de l'entreprise AI-native",
    htmlContent: `
      <div style="font-family: Arial, sans-serif; font-size: 15px; color: #1F2937; line-height: 1.6;">
        <p>Salut ${lead.prenom},</p>
        <p>Voici ton accès au guide, comme promis :</p>
        <p><a href="${guideLink}" style="color: #2F86DC; font-weight: bold;">→ Lire « Les 4 niveaux de l'entreprise AI-native »</a></p>
        <p>Tu as répondu au diagnostic${lead.niveau ? ` — niveau ${lead.niveau}, ${LEVEL_NAMES[lead.niveau]}` : ""}. Si tu veux qu'on regarde ta situation précise (parfois on prépare même une démo à partir de ton site), réponds simplement à cet email.</p>
        <p>— Pierre, Silex<br><a href="https://gosilex.com" style="color: #6B7280;">gosilex.com</a></p>
      </div>`,
  };
  const r2 = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers,
    body: JSON.stringify(mail),
  });
  if (!r2.ok) {
    const t = await r2.text();
    throw new Error(`brevo email: ${t.slice(0, 200)}`);
  }
}

/* ── Handler ────────────────────────────────────────────────── */

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "POST uniquement" });
  }

  let lead;
  try {
    lead = await readBody(req);
  } catch {
    return res.status(400).json({ ok: false, error: "JSON invalide" });
  }

  const magnet = getMagnet(lead);
  const invalid = validate(lead, magnet);
  if (invalid === "spam") return res.status(200).json({ ok: true }); // on ne renseigne pas les bots
  if (invalid) return res.status(400).json({ ok: false, error: invalid });

  // Trace de secours : le lead complet dans les logs serveur
  console.log("LEAD", JSON.stringify(lead));

  const warnings = [];
  const results = await Promise.allSettled([
    notifySlack(lead, magnet, warnings),
    pushAttio(lead, magnet, warnings),
    pushBrevo(lead, magnet, warnings),
  ]);
  for (const r of results) {
    if (r.status === "rejected") warnings.push(String(r.reason?.message || r.reason));
  }
  if (warnings.length) console.warn("LEAD_WARNINGS", JSON.stringify(warnings));

  return res.status(200).json({ ok: true });
}
