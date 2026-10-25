# AGENTS.md

> **Standing Instructions for AI Coding Agents and Developers in VS Code / Cursor / Windsurf**
>
> You are working on **Meating** (Meat Suit Pilot), a personal life-management, health-tracking, and gamification PWA.
> **CRITICAL**: Read all documentation in `docs/*` before writing or modifying any code.

---

## 1. Directory & Codebase Map

```
/
├── .env.example                 # Required environment variables template
├── docs/                        # Complete technical specs & migration documentation
│   ├── ARCHITECTURE.md          # Lifecycle, security, request flows, PWA specs
│   ├── DATA-MODEL.md            # Schema definitions, document structures, SQL tables
│   ├── RULES.md                 # Security rules (Firestore / Supabase RLS)
│   ├── GEMINI.md                # AI prompts, model IDs, payload structures
│   ├── INTEGRATIONS.md          # External service matrix
│   ├── MIGRATION.md             # Step-by-step Cloudflare + Supabase cutover plan
│   ├── SECRETS.md               # Secrets registry & location guide
│   └── INVENTORY.json           # Machine-readable inventory of routes & features
├── prompts/                     # Reusable LLM prompts
│   └── system.md                # System prompts for AI features
├── public/                      # Static assets & PWA manifest icons
│   └── icon.svg                 # SVG App icon
├── server.ts                    # Backend Express server (API proxy + Vite middleware)
├── src/                         # Client application source code
│   ├── App.tsx                  # Root routing & protected route boundary
│   ├── main.tsx                 # Entry point with React 19 root
│   ├── index.css                # Tailwind CSS v4 entry & theme variables
│   ├── firebase.ts              # Firebase client SDK initialization & Firestore cache
│   ├── components/              # Shared layout and UI components
│   │   └── Layout.tsx           # Persistent responsive sidebar/bottom-nav wrapper
│   ├── contexts/                # Global React Contexts
│   │   └── AuthContext.tsx      # Auth state, Google token capture, Firestore error logging
│   ├── lib/                     # Utilities
│   │   └── utils.ts             # Tailwind class merging (clsx + twMerge)
│   ├── pages/                   # Application views
│   │   ├── Analytics.tsx        # Charts, stats history, weekly reflections
│   │   ├── Calendar.tsx         # Unified Google Calendar, Tasks & Quests agenda
│   │   ├── CheckIn.tsx          # 10-stat daily slider check-in & notes
│   │   ├── Dashboard.tsx        # Main command center, daily status, XP progress
│   │   ├── Habits.tsx           # Daily habits management & streak tracking
│   │   ├── Health.tsx           # Sleep, weight, supplements, meals & AI calorie estimation
│   │   ├── Login.tsx            # Google OAuth login landing view
│   │   ├── Missions.tsx         # Projects, Missions, and Daily Quests hierarchy
│   │   ├── Money.tsx            # Account balances, recurring bills, expenses, wishlist
│   │   └── Settings.tsx         # Check-in schedules, Strava OAuth connection, weight goals
│   └── utils/
│       └── leveling.ts          # Gamification XP calculation and Firestore level updates
├── firebase-applet-config.json  # Legacy Firebase client connection credentials
├── firebase-blueprint.json      # Legacy Firebase schema definition blueprint
├── firestore.rules              # Active Firestore security rules
├── metadata.json                # Project metadata
├── package.json                 # Project dependencies & npm scripts
├── tsconfig.json                # TypeScript compiler configuration
└── vite.config.ts               # Vite bundler configuration + VitePWA plugin
```

---

## 2. Standard Commands

| Action | Command | Notes |
|---|---|---|
| **Install Dependencies** | `npm install` | Uses `package.json` |
| **Start Development** | `npm run dev` | Boots `server.ts` on port 3000 with Vite middleware |
| **Lint & Typecheck** | `npm run lint` | Runs `tsc --noEmit` |
| **Production Build** | `npm run build` | Builds Vite client (`dist/`) + bundles `dist/server.js` |
| **Production Run** | `npm start` | Runs bundled `dist/server.js` via Node |
| **Preview PWA** | `npm run preview` | Runs Vite static preview server |
| **Clean Output** | `npm run clean` | Deletes `dist/` |

---

## 3. Architecture & Conventions

### Coding Style & Rules
- **Framework**: React 19 with functional components and hooks only.
- **Language**: Strict TypeScript. No `any` when avoidable; keep models strongly typed.
- **Styling**: Tailwind CSS v4 classes exclusively. Use CSS variables defined in `@theme` in `src/index.css` (e.g., `var(--color-bg-dark)`, `text-neon-green`).
- **Icons**: Import only from `lucide-react`. Never inline ad-hoc SVGs.
- **Animations**: Use `motion/react` (Motion v12).
- **Date Handling**: Use `date-fns` v4 (`format`, `subDays`, `addDays`, `parseISO`). Standard date format across the database is `yyyy-MM-dd`.

### State Management & Data Fetching
- **Auth State**: Global via `useAuth()` in `src/contexts/AuthContext.tsx`.
- **Database Reads/Writes**:
  - Direct Firestore reads via `getDocs`, `getDoc`, `setDoc`, `addDoc`, `updateDoc`.
  - Subcollections are scoped under `users/{userId}/*` to maintain complete user isolation.
- **Backend API Routes**:
  - Live in `server.ts` with prefix `/api/*`.
  - Never call external APIs requiring secret keys (Gemini, Strava tokens, external sync keys) directly from the client.

---

## 4. "Do Not Touch / Do Not Break" List

1. **PWA Capabilities**: Never break `vite-plugin-pwa` configuration in `vite.config.ts`. The app must remain installable on iOS/Android home screens with offline caching.
2. **Gamification Math (`src/utils/leveling.ts`)**: `calculateLevel` uses a deterministic formula ($Level\ N \text{ requires } N \times 100 \text{ XP}$). Do not alter level requirements without migrating existing user XP documents.
3. **Date String Keys**: `HealthLog` and `quests` rely on ISO date strings (`yyyy-MM-dd`) for document indexing and local day comparisons. Do not change this date format.
4. **Secret Exposure**: Never add `GEMINI_API_KEY`, `STRAVA_CLIENT_SECRET`, or `MEATING_DASHBOARD_API_KEY` to client-side code (`import.meta.env`). All secret interactions MUST route through `/api/*`.

---

## 5. How Services are Invoked Today

### Gemini AI
- **Server Route**: `server.ts` -> `app.post('/api/estimate-calories')`
- **SDK**: `@google/genai` -> `ai.models.generateContent({ model: "gemini-3-flash-preview", ... })`
- **Client Trigger**: `src/pages/Health.tsx` -> `estimateCalories()`
- **Output**: JSON Schema `{ calories: number, notes: string }`

### Firebase
- **Client Initializer**: `src/firebase.ts` -> `initializeApp`, `initializeFirestore`, `getAuth`
- **Collections Accessed**:
  - `users/{uid}` (User profile)
  - `users/{uid}/checkins`
  - `users/{uid}/healthLogs`
  - `users/{uid}/projects`
  - `users/{uid}/missions`
  - `users/{uid}/quests`
  - `users/{uid}/habits`
  - `users/{uid}/habitLogs`
  - `users/{uid}/accounts`
  - `users/{uid}/bills`
  - `users/{uid}/expenses`
  - `users/{uid}/wishlist`
  - `users/{uid}/settings/preferences`
  - `users/{uid}/stravaTokens/main`
  - `users/{uid}/evaluations`
  - `users/{uid}/reflections`

---

## 6. Post-Migration Architecture (Cloudflare + Supabase)

When executing changes for the target architecture:
1. **Frontend Hosting**: Cloudflare Pages serving `dist/` SPA with `_headers` and `_routes.json`.
2. **Auth & Database**: Replace `firebase.ts` and `AuthContext.tsx` with `@supabase/supabase-js` client pointing to Supabase Postgres tables with Row Level Security (RLS).
3. **API Proxy & Gemini**: Move `/api/*` endpoints from `server.ts` to Cloudflare Workers or Supabase Edge Functions.
4. **Definition of Done for Any Change**:
   - PWA installs and updates correctly.
   - User authentication and session persistence function seamlessly.
   - All CRUD actions conform to the schema in `docs/DATA-MODEL.md`.
   - Linter (`npm run lint`) and build (`npm run build`) pass cleanly.
