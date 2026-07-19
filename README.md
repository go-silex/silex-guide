# silex-guide — Lead magnet « Guide Claude »

Plateforme du lead magnet lié au post LinkedIn du 15/07/2026 (100+ demandes) :
**diagnostic 4 niveaux → formulaire → guide web**, avec capture des leads vers
Slack / Attio / Brevo.

- **Prod** : `s.gosilex.com/guide` (shortlink Shlink → déploiement Vercel)
- **Contenu source du guide** : vault `09_COMMUNICATION/Lead_Magnet_Guide_Claude/Guide_4_Niveaux.md`
- **Leads Slack** : canal `#int-closing` (bot Flint, déjà membre)

## Parcours

1. `index.html` — landing → diagnostic 5 questions (score 5–20 → niveau 1–4)
   → résultat personnalisé → formulaire (prénom, nom, email pro, site, irritant
   catégorie + verbatim libre).
2. `POST /api/lead` — notifie Slack, upsert Attio + note diagnostic, upsert
   contact Brevo + email avec le lien du guide. **Aucune intégration ne bloque
   la capture** : tout est loggé (`LEAD …`) dans les logs serveur en secours.
3. `guide.html` — le guide complet. Soft-gate : accessible après formulaire
   (sessionStorage) ou via `?k=silex-4-niveaux` (lien envoyé par email).

## Dev local

```bash
node dev-server.mjs          # http://localhost:3600
# avec Slack réel :
source ~/.config/silex/slack.env && SLACK_CHANNEL_LEADS=C0BJU9GNPPA node dev-server.mjs
```

## Variables d'environnement (Vercel)

| Variable | Requis | Rôle |
|---|---|---|
| `SLACK_BOT_TOKEN` | oui | Bot Flint — notifs leads (`chat.postMessage`) |
| `SLACK_CHANNEL_LEADS` | oui | `C0BJU9GNPPA` = `#int-closing` |
| `SLACK_WEBHOOK` | non | Repli si pas de bot token |
| `ATTIO_API_KEY` | non | Fiche personne + note diagnostic dans Attio |
| `ATTIO_LIST_ID` | non | Liste Attio « Guide Claude » (`1a45f1fa-3a03-4014-af69-08c3c9564c60`) |
| `BREVO_API_KEY` | non | Contact + email d'envoi du guide |
| `BREVO_LIST_ID` | non | Liste Brevo où ranger les leads |
| `GUIDE_URL` | non | Base du lien guide dans l'email (défaut `https://s.gosilex.com/guide`) |

### Reste à configurer (Pierre)

- [ ] `ATTIO_API_KEY` : Attio → Workspace settings → Developers → générer une
  clé, puis `vercel env add ATTIO_API_KEY production` (ou dashboard Vercel).
- [ ] `BREVO_API_KEY` : Brevo → SMTP & API → clés API. Sans elle, pas d'email
  de livraison — le guide reste accessible juste après le formulaire.
- [ ] (optionnel) `BREVO_LIST_ID` : créer une liste « Leads Guide Claude ».

## Déploiement

Vercel, projet `silex-guide` (fichiers statiques racine + `api/lead.js` en
fonction serverless — zéro build). Puis shortlink :

```bash
shlink s.gosilex.com/guide → https://<deployment>.vercel.app
```

⚠️ Si le projet Vercel a « Deployment Protection » activé (cf. Sleeq), la
désactiver pour ce projet — sinon les prospects tombent sur un mur de login.
