# Migration & Cutover Guide: AI Studio / Firebase to Cloudflare + Supabase

This document provides the complete, step-by-step cutover plan to migrate Meating to a production stack hosted on **Cloudflare Pages / Workers**, **Supabase (Auth + Postgres)**, and self-hosted **Google Gemini API**.

---

## Phase 0: Pre-Deletion Checklist (Do Before Deleting AI Studio)

Before deleting or shutting down this AI Studio workspace, manually copy/export the following items:

1. **Export Firestore Data (JSON / Collection Snapshots)**:
   - Go to [Firebase Console](https://console.firebase.google.com/) for project `youtube-updater-483515`.
   - Under Firestore Database, export current data or copy your active documents in `users/4Or5XF1Hl6Nz2BcVe6xlxgEbRf73` (`healthLogs`, `habits`, `quests`, `projects`, `accounts`, `checkins`, `stravaTokens`).
2. **Retrieve API Keys & Secrets**:
   - `GEMINI_API_KEY`: Create/retrieve your independent API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
   - `STRAVA_CLIENT_ID` & `STRAVA_CLIENT_SECRET`: Check [Strava API Settings](https://www.strava.com/settings/api).
   - `MEATING_DASHBOARD_API_KEY`: Copy the dashboard authorization token if you plan to continue syncing.
3. **Google OAuth Client Credentials**:
   - In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), locate your OAuth 2.0 Client ID and Client Secret (or create a dedicated one for your Supabase domain).
4. **Download Full Source Code ZIP / Git Repository**:
   - Export this complete project directory.

---

## Phase 1: Local Setup

1. **Initialize Git Repository**:
   ```bash
   cd meating
   git init
   git add .
   git commit -m "feat: pre-migration baseline export from AI Studio"
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Local Environment**:
   ```bash
   cp .env.example .env.local
   ```
   Add your `GEMINI_API_KEY`, `STRAVA_CLIENT_ID`, and `STRAVA_CLIENT_SECRET`.

4. **Verify Build**:
   ```bash
   npm run build
   ```
   Ensure `dist/index.html` and `dist/server.js` build without errors.

---

## Phase 2: Supabase Project Setup & Database Schema

1. **Create Supabase Project**:
   - Go to [Supabase](https://supabase.com) and create a new project (e.g. `meating-app`).
2. **Enable Google Authentication**:
   - In Supabase Dashboard -> **Authentication** -> **Providers** -> **Google**.
   - Enable Google provider.
   - Enter your **Google Client ID** and **Google Client Secret**.
   - Add required Google Scopes:
     ```
     https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks
     ```
   - Copy the **Callback URL (for OAuth)** from Supabase and add it to your Google Cloud Console OAuth Authorized Redirect URIs.
3. **Run Database Migration Script (DDL)**:
   In Supabase **SQL Editor**, execute the following schema:

```sql
-- 1. Profiles Table
CREATE TABLE public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pilot_level INTEGER DEFAULT 1,
  avatar_level INTEGER DEFAULT 1,
  pilot_wins INTEGER DEFAULT 0,
  avatar_wins INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  check_in_times TEXT[] DEFAULT ARRAY['08:00', '12:00', '18:00'],
  badges TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Health Logs Table
CREATE TABLE public.health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight NUMERIC(5,2),
  sleep_time TEXT,
  wake_time TEXT,
  exercises TEXT[] DEFAULT ARRAY[]::TEXT[],
  supplements JSONB DEFAULT '[]'::JSONB,
  teas JSONB DEFAULT '[]'::JSONB,
  meals JSONB DEFAULT '[]'::JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- 3. Check-ins Table
CREATE TABLE public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  stats JSONB NOT NULL,
  social_behavior TEXT,
  note TEXT,
  nudges_applied TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Projects, Missions, Quests
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  notion_link TEXT,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.quests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  mission_id UUID REFERENCES public.missions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  due_time TEXT,
  completed BOOLEAN DEFAULT FALSE,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Habits
CREATE TABLE public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  mission_id UUID REFERENCES public.missions(id) ON DELETE SET NULL,
  schedule TEXT DEFAULT 'daily',
  streak INTEGER DEFAULT 0,
  completed_dates DATE[] DEFAULT ARRAY[]::DATE[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Financial Management
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  balance NUMERIC(12,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  due_date INTEGER CHECK (due_date BETWEEN 1 AND 31),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cost NUMERIC(10,2) NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Settings & Integrations
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  check_in_schedule JSONB DEFAULT '[]'::JSONB,
  notifications BOOLEAN DEFAULT TRUE,
  weight_goal JSONB DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.strava_tokens (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for all tables
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strava_tokens ENABLE ROW LEVEL SECURITY;

-- Owner Access Policies
CREATE POLICY "user_profiles_owner" ON public.user_profiles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "health_logs_owner" ON public.health_logs FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "checkins_owner" ON public.checkins FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "projects_owner" ON public.projects FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "missions_owner" ON public.missions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "quests_owner" ON public.quests FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "habits_owner" ON public.habits FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts_owner" ON public.accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bills_owner" ON public.bills FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "expenses_owner" ON public.expenses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wishlist_owner" ON public.wishlist FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_settings_owner" ON public.user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "strava_tokens_owner" ON public.strava_tokens FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

---

## Phase 3: Client SDK Swap (Firebase -> Supabase)

1. Install Supabase Client:
   ```bash
   npm install @supabase/supabase-js
   npm uninstall firebase @firebase/firestore @firebase/auth firebase-admin
   ```
2. Create `src/supabase.ts`:
   ```typescript
   import { createClient } from '@supabase/supabase-js';

   export const supabase = createClient(
     import.meta.env.VITE_SUPABASE_URL,
     import.meta.env.VITE_SUPABASE_ANON_KEY
   );
   ```
3. Update `src/contexts/AuthContext.tsx` to use `supabase.auth.signInWithOAuth({ provider: 'google' })`.
4. Update page files (`Health.tsx`, `Dashboard.tsx`, etc.) to query `supabase.from('health_logs')` instead of `doc(db, ...)`.

---

## Phase 4: Deploying to Cloudflare Pages + Functions / Workers

1. **Push to GitHub**:
   ```bash
   git remote add origin https://github.com/your-org/meating-pwa.git
   git push -u origin main
   ```
2. **Connect to Cloudflare Pages**:
   - In Cloudflare Dashboard -> **Workers & Pages** -> **Create Application** -> **Pages** -> **Connect to Git**.
   - Build settings:
     - Framework preset: `Vite`
     - Build command: `npm run build`
     - Build output directory: `dist`
     - Node version: `20`
3. **Configure Environment Variables in Cloudflare Dashboard**:
   - `VITE_SUPABASE_URL`: `https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `your-anon-key`
   - `GEMINI_API_KEY`: `your-google-gemini-key`
   - `STRAVA_CLIENT_ID`: `your-strava-id`
   - `STRAVA_CLIENT_SECRET`: `your-strava-secret`
4. **Migrate `/api/*` Routes to Cloudflare Functions**:
   - Create directory `/functions/api/estimate-calories.ts`:
   ```typescript
   import { GoogleGenAI, Type } from '@google/genai';

   export const onRequestPost: PagesFunction<{ GEMINI_API_KEY: string }> = async (context) => {
     const { mealName } = await context.request.json() as { mealName: string };
     const ai = new GoogleGenAI({ apiKey: context.env.GEMINI_API_KEY });
     
     const response = await ai.models.generateContent({
       model: 'gemini-2.5-flash',
       contents: `Estimate the calories for a typical serving of "${mealName}". Return the result as JSON.`,
       config: {
         responseMimeType: 'application/json',
         responseSchema: {
           type: Type.OBJECT,
           properties: {
             calories: { type: Type.NUMBER },
             notes: { type: Type.STRING },
           },
           required: ['calories', 'notes'],
         },
       },
     });

     return new Response(response.text, {
       headers: { 'Content-Type': 'application/json' },
     });
   };
   ```

---

## Phase 5: Post-Migration Verification Checklist

- [ ] **Google Login**: User can authenticate with Google and receive access tokens for Calendar/Tasks.
- [ ] **Data Persistence**: Creating check-ins, quests, habits, health logs persists to Supabase Postgres.
- [ ] **AI Calorie Estimation**: Food items typed in Health tab successfully return calories and nutritionist notes.
- [ ] **Strava Sync**: Connecting Strava exchanges tokens and imports today's workouts into daily health logs.
- [ ] **PWA Installation**: App triggers install prompt on mobile/desktop Chrome/Safari and opens standalone.
- [ ] **Offline Resilience**: App shell loads instantly from Service Worker cache when offline.

---

## Rollback Plan

Keep the initial Git commit tagged as `v1.1-ai-studio-baseline`. If any issue arises during Supabase or Cloudflare migration, checkout `v1.1-ai-studio-baseline` and run `npm run dev` to restore the complete original Express + Firebase client runtime.
