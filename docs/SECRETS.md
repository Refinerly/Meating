# Secrets Registry & Management Guide

This registry details all confidential credentials, API keys, and environment variables used across the Meating application.

---

## 1. Secrets Inventory

| Secret Name | Where to Obtain | Local `.env` | Cloudflare Pages / Workers | Supabase Dashboard | Access Scope |
|---|---|---|---|---|---|
| `GEMINI_API_KEY` | [Google AI Studio API Keys](https://aistudio.google.com/app/apikey) | `GEMINI_API_KEY` | Environment Variable (Secret) | Edge Function Secret | Server-side only (never exposed to browser) |
| `STRAVA_CLIENT_ID` | [Strava API Settings](https://www.strava.com/settings/api) | `STRAVA_CLIENT_ID` | Environment Variable | Edge Function Secret | Server-side & Public OAuth prompt |
| `STRAVA_CLIENT_SECRET` | [Strava API Settings](https://www.strava.com/settings/api) | `STRAVA_CLIENT_SECRET` | Environment Variable (Secret) | Edge Function Secret | Server-side only (token exchange & refresh) |
| `MEATING_DASHBOARD_API_KEY` | External Meating Dashboard Settings | `MEATING_DASHBOARD_API_KEY` | Environment Variable (Secret) | Edge Function Secret | Server-side proxy calls only |
| `VITE_SUPABASE_URL` | Supabase Project Settings -> API | `VITE_SUPABASE_URL` | Environment Variable (Plaintext) | Project URL | Client-side bundle (Public) |
| `VITE_SUPABASE_ANON_KEY` | Supabase Project Settings -> API | `VITE_SUPABASE_ANON_KEY` | Environment Variable (Plaintext) | API Keys -> `anon` public | Client-side bundle (Public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Project Settings -> API | `SUPABASE_SERVICE_ROLE_KEY` | Environment Variable (Secret) | API Keys -> `service_role` | Backend / Edge Functions only |

---

## 2. Configuration Instructions by Environment

### A. Local Development (`.env` / `.env.local`)
Create a `.env` or `.env.local` file in the project root based on `.env.example`. Never check `.env` into git (it is included in `.gitignore`).

### B. Cloudflare Pages & Workers
In the Cloudflare Dashboard:
1. Navigate to **Workers & Pages** -> your project -> **Settings** -> **Environment variables**.
2. Add variables for **Production** and **Preview**.
3. Mark `GEMINI_API_KEY`, `STRAVA_CLIENT_SECRET`, and `MEATING_DASHBOARD_API_KEY` as **Encrypted (Secret)**.

### C. Supabase Edge Functions / Postgres Vault
If running backend logic in Supabase Edge Functions:
```bash
supabase secrets set GEMINI_API_KEY=your_key_here
supabase secrets set STRAVA_CLIENT_ID=your_id_here
supabase secrets set STRAVA_CLIENT_SECRET=your_secret_here
```
