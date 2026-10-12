# Connexion Google — Mail & Agenda bureau

> Facultatif. Sans Google, l’agenda du bureau est rangé sur Netlify avec un abonnement pour les téléphones ([DOC-AGENDA.md](DOC-AGENDA.md)) et le site envoie ses mails par la boîte de l’asso ([DOC-MAIL.md](DOC-MAIL.md)). La boîte mail se lit aussi sans Google, en IMAP ([DOC-MAIL.md](DOC-MAIL.md)). Cette connexion ne sert que pour lire une boîte Gmail par l’API Google, ou garder l’agenda dans Google Agenda.

Document **interne** pour le référent site.  
**Ne jamais** y coller Client Secret, refresh token, ni mot de passe.

Compte coffre (adresse publique) : `contact@exemple-asso.fr`  
Auth bénévoles : mot de passe **Bureau** déjà en place (distinct du Gmail).

---

## Variables Netlify à créer

| Variable | Rôle |
|----------|------|
| `GOOGLE_CLIENT_ID` | OAuth client Web (Google Cloud) |
| `GOOGLE_CLIENT_SECRET` | Secret du client OAuth |
| `GOOGLE_REFRESH_TOKEN` | Obtenu via `/bureau/connexion-google` |
| `GOOGLE_CALENDAR_ID` | `primary` ou id du calendrier unique asso |
| `GOOGLE_OAUTH_REDIRECT_URI` | *(optionnel)* sinon `SITE_ORIGIN` + `/api/bureau/google/callback` |

Déjà requis pour le bureau (inchangé) : `BUREAU_PASSWORD`, `BUREAU_SECRET`, compte de service Sheets, etc.

Scopes utilisés (minimaux) :

- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/contacts` (People API — sync Adhérents)

Pas de scope `mail.google.com` (trop large).

---

## Checklist référent (une fois)

1. [Google Cloud Console](https://console.cloud.google.com/) — projet déjà utilisé pour les Sheets, ou nouveau projet « ASE site ».
2. Activer **Gmail API**, **Google Calendar API** et **People API** (Contacts).
3. Écran de consentement OAuth : type **Externe**, app en mode **Testing**. Ajouter `contact@exemple-asso.fr` comme **utilisateur de test**.
4. Identifiants → **Créer un client OAuth** → type **Application Web**.
5. URI de redirection autorisées :
   - Prod : `https://www.exemple-asso.fr/api/bureau/google/callback`
   - Local (si besoin) : `http://localhost:8888/api/bureau/google/callback`
6. Copier **Client ID** et **Client secret** dans Netlify (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`). Redéployer.
7. Se connecter au **Bureau** (mot de passe partagé) → Autre → **Connecter Google** → autoriser **uniquement** le compte asso.
8. Sur la page de retour : copier le jeton dans Netlify → `GOOGLE_REFRESH_TOKEN`. Mettre `GOOGLE_CALENDAR_ID=primary` (ou l’id du calendrier). Redéployer.
9. Tester `/bureau/mail` et `/bureau/agenda` (sans ouvrir mail.google.com).
10. Contacts / WhatsApp (référent, en local) :
    ```bash
    node scripts/sync-adherents-contacts.mjs --whatsapp
    node scripts/sync-adherents-contacts.mjs --apply
    ```
    Export dans `tmp/adherents-whatsapp.csv` et `.vcf`.  
    Sync → groupe Google Contacts **ASE Adhérents** sur le compte asso.  
    Si erreur de scope : retirer l’appli sur myaccount.google.com/permissions, refaire l’étape 7, coller le nouveau `GOOGLE_REFRESH_TOKEN`, redéployer.

Si Google ne renvoie pas de refresh token : retirer l’accès de l’appli sur  
https://myaccount.google.com/permissions (compte asso), puis recommencer l’étape 7.

---

## Pages

| URL | Qui |
|-----|-----|
| `/bureau/mail` | Bureau (session) |
| `/bureau/agenda` | Bureau (session) |
| `/bureau/connexion-google` | Référent (session bureau) |

Les appels API passent par Netlify Functions ; le navigateur ne parle pas à Google.

---


