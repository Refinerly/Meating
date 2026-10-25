# External Integrations Matrix

| Service | Role in Application | Current Credentials Location | Scopes Requested / Endpoints | Callback / Webhook URLs | Target Stack Replacement | Migration Priority |
|---|---|---|---|---|---|---|
| **Google Authentication** | Primary user login and account identity | Firebase Auth / `firebase-applet-config.json` | `openid`, `email`, `profile` | Handled by Firebase Auth (`/__/auth/handler`) | **Supabase Auth** (Google Provider) | **Must-Have (P0)** |
| **Google Calendar API** | Fetch user events to avoid scheduling check-ins during busy times & display on Calendar page | Captured during Google OAuth popup via `GoogleAuthProvider.addScope` | `https://www.googleapis.com/auth/calendar` | Client-side direct Google API calls (`/calendar/v3/...`) | Direct Google Calendar API client using Supabase Google OAuth access token | **Must-Have (P1)** |
| **Google Tasks API** | Display daily actionable tasks alongside local quests | Captured during Google OAuth popup via `GoogleAuthProvider.addScope` | `https://www.googleapis.com/auth/tasks` | Client-side direct Google API calls (`/tasks/v1/...`) | Direct Google Tasks API client using Supabase Google OAuth access token | **Nice-to-Have (P2)** |
| **Google Gemini API** | AI estimation of meal calories and nutritional notes | `process.env.GEMINI_API_KEY` (AI Studio backend injection) | Model endpoint: `gemini-3-flash-preview` / `gemini-2.5-flash` | Server-side `/api/estimate-calories` | Direct `@google/genai` or REST call in Cloudflare Worker / Node backend using custom `GEMINI_API_KEY` | **Must-Have (P1)** |
| **Strava API v3** | Sync workouts, runs, rides, calories, and duration into daily health logs | `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` (in `.env`) | `activity:read_all` | `${APP_URL}/api/auth/strava/callback` | Cloudflare Worker / Supabase Edge Function with Strava OAuth exchange & token refresh | **Must-Have (P1)** |
| **Cloud Firestore** | Primary database for all user state, check-ins, logs, quests, habits, finances | Client SDK credentials in `firebase-applet-config.json` | Real-time / persistent indexed cache | N/A | **Supabase PostgreSQL** with Row Level Security (RLS) | **Must-Have (P0)** |
| **Meating Business Dashboard Proxy** | Syncs high-level aggregated check-in and habit data to external dashboard | `MEATING_DASHBOARD_API_KEY` (in `.env`) | Endpoint: `POST https://ais-dev-zh7s4sl2oavhar4qz6gznr-31321158591.europe-west2.run.app/api/meating` | Server-side `/api/sync-dashboard` | Supabase Webhook / Cloudflare Scheduled Worker | **Nice-to-Have (P2)** |
| **Firebase Cloud Storage** | Bucket declared in configuration (`youtube-updater-483515.firebasestorage.app`) | `firebase-applet-config.json` | N/A (Only external HTTP image URLs currently used for wishlist) | N/A | **Supabase Storage** | **Nice-to-Have (P3)** |

---

## OAuth Details & Configuration Notes

### 1. Google OAuth Client
- In GCP Console / Supabase Auth:
  - Authorized JavaScript Origins: `https://<your-domain>.pages.dev`, `http://localhost:3000`
  - Authorized Redirect URIs: `https://<your-supabase-project>.supabase.co/auth/v1/callback`
  - Required Scopes: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/calendar`, `https://www.googleapis.com/auth/tasks`

### 2. Strava API Application
- In Strava Developer Settings:
  - Authorization Callback Domain: `<your-domain>.pages.dev` (or `localhost:3000` for local dev)
  - Redirect URI configured in app: `https://<your-domain>.pages.dev/api/auth/strava/callback`
