# Workspace Hub — Vercel Deployment Guide

**Stack:** GitHub (frontend + backend code) + Vercel (serverless API)

---

## File Structure

```
workspace-hub/
├── index.html          ← Dashboard UI
├── vercel.json         ← Vercel routing config
├── package.json        ← Dependencies
├── api/
│   ├── auth.js         ← OAuth login starter
│   ├── callback.js     ← OAuth token exchange
│   ├── feed.js         ← Live data fetcher for all apps
│   ├── status.js       ← Connection status checker
│   └── disconnect.js   ← Revoke access
└── README.md
```

---

## Step 1 — Push to GitHub

1. Go to [github.com](https://github.com) → **New repository**
2. Name it `workspace-hub`, set to **Public**
3. Upload ALL files (keep the `api/` folder structure intact)
4. Your repo URL will be: `https://github.com/YOUR_USERNAME/workspace-hub`

---

## Step 2 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Sign up with GitHub** (one click)
2. Click **"Add New Project"**
3. Import your `workspace-hub` repository
4. Leave all settings as default → click **Deploy**
5. Your backend URL will be:
   ```
   https://workspace-hub-YOUR_USERNAME.vercel.app
   ```

---

## Step 3 — Add Environment Variables in Vercel

Go to your project on Vercel → **Settings → Environment Variables**
Add these one by one (you'll fill in values after Step 4):

| Name | Value |
|------|-------|
| `GOOGLE_CLIENT_ID` | (from Google Console) |
| `GOOGLE_CLIENT_SECRET` | (from Google Console) |
| `MS_CLIENT_ID` | (from Azure) |
| `MS_CLIENT_SECRET` | (from Azure) |
| `GITHUB_CLIENT_ID` | (from GitHub Developer Settings) |
| `GITHUB_CLIENT_SECRET` | (from GitHub Developer Settings) |
| `DROPBOX_CLIENT_ID` | (from Dropbox App Console) |
| `DROPBOX_CLIENT_SECRET` | (from Dropbox App Console) |
| `VERCEL_URL_FULL` | `https://workspace-hub-YOUR_USERNAME.vercel.app` |
| `DASHBOARD_URL` | `https://workspace-hub-YOUR_USERNAME.vercel.app` |
| `ALLOWED_ORIGIN` | `https://workspace-hub-YOUR_USERNAME.vercel.app` |

After adding all variables → click **Redeploy** in the Deployments tab.

---

## Step 4 — Create OAuth Apps

### Google (Gmail + Drive + Calendar)
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create project → Enable: Gmail API, Google Drive API, Google Calendar API
3. OAuth consent screen → External → fill in app name
4. Credentials → Create OAuth 2.0 Client ID → Web application
5. Authorized redirect URI:
   ```
   https://workspace-hub-YOUR_USERNAME.vercel.app/callback/google
   ```
6. Copy Client ID and Client Secret → paste into Vercel env vars

### Microsoft (Outlook + OneDrive + Teams + Calendar)
1. Go to [portal.azure.com](https://portal.azure.com)
2. Azure Active Directory → App registrations → New registration
3. Redirect URI:
   ```
   https://workspace-hub-YOUR_USERNAME.vercel.app/callback/microsoft
   ```
4. API permissions: Mail.Read, Files.Read, Calendars.Read, offline_access
5. Certificates & secrets → New client secret
6. Copy Application ID (Client ID) and Secret value → paste into Vercel env vars

### GitHub
1. Go to [github.com/settings/developers](https://github.com/settings/developers)
2. New OAuth App
3. Authorization callback URL:
   ```
   https://workspace-hub-YOUR_USERNAME.vercel.app/callback/github
   ```
4. Copy Client ID and Client Secret → paste into Vercel env vars

### Dropbox
1. Go to [dropbox.com/developers/apps](https://www.dropbox.com/developers/apps)
2. Create app → Scoped access → Full Dropbox
3. Redirect URI:
   ```
   https://workspace-hub-YOUR_USERNAME.vercel.app/callback/dropbox
   ```
4. Permissions: files.metadata.read
5. Copy App key (Client ID) and App secret → paste into Vercel env vars

---

## Step 5 — Connect index.html to Vercel

Open `index.html`, find this line near the bottom:

```js
const WORKER_URL = ""; // ← paste your Vercel URL here
```

Change it to:
```js
const WORKER_URL = "https://workspace-hub-YOUR_USERNAME.vercel.app";
```

Save and push to GitHub — Vercel auto-deploys in ~30 seconds.

---

## Step 6 — Connect your accounts

Visit each URL in your browser to authorize:

| Account | Authorization URL |
|---------|------------------|
| Google | `https://workspace-hub-YOUR_USERNAME.vercel.app/auth/google` |
| Microsoft | `https://workspace-hub-YOUR_USERNAME.vercel.app/auth/microsoft` |
| GitHub | `https://workspace-hub-YOUR_USERNAME.vercel.app/auth/github` |
| Dropbox | `https://workspace-hub-YOUR_USERNAME.vercel.app/auth/dropbox` |

Each login redirects back to the dashboard automatically.

---

## Step 7 — Verify

Check connection status:
```
https://workspace-hub-YOUR_USERNAME.vercel.app/api/status
```

Should return:
```json
{ "google": true, "microsoft": true, "github": true, "dropbox": true }
```

Test Gmail feed:
```
https://workspace-hub-YOUR_USERNAME.vercel.app/api/feed/gmail
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| CORS error | Make sure `ALLOWED_ORIGIN` exactly matches your Vercel URL |
| `redirect_uri_mismatch` | The redirect URI in OAuth app must exactly match the one in env vars |
| `401 Unauthorized` | Re-visit `/auth/google` (or relevant provider) to re-authorize |
| Vercel function timeout | Normal on first cold start — refresh the page |
| Cookie not saved | Make sure you're on HTTPS (Vercel is always HTTPS) |

---

## Cost

| Service | Free tier |
|---------|-----------|
| GitHub | Free public repo + hosting |
| Vercel | 100GB bandwidth, 100k function calls/day |
| **Total** | **$0 / month** |

---

*Workspace Hub — all your accounts in one place.*
