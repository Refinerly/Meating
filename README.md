# Meating

Meating is a personal life-management PWA for check-ins, projects, missions, quests, habits, health logs, analytics, and budgeting. It uses **Cloudflare Access** for sign-in, a **Cloudflare Worker** for the API, and **Cloudflare D1** for persistent data. There are no Firebase, Google account, Google Calendar/Tasks, or Strava integrations.

## Requirements

- Node.js 24.22.1 or newer and npm
- A Cloudflare account with Workers and D1 enabled for deployment
- A Cloudflare Access application protecting the deployed app

## Local development

1. Install packages: `npm install`
2. Create and migrate the local D1 database:

   ```sh
   npm run db:local
   ```

   `wrangler d1 create` is only needed for a **remote** database; local D1 is created automatically. No `.dev.vars` or Cloudflare account is needed for local D1 setup.
3. Run `npm run dev` to start the Cloudflare Vite development server. The browser UI can be opened locally, but authenticated API requests require a Cloudflare Access JWT and therefore cannot be exercised through the ordinary local identity endpoint without an Access-protected staging hostname.

To demonstrate authenticated API behavior without deploying, run `npm run test:worker`; tests supply mocked Access identities and a D1 test double. For real browser sign-in and persisted CRUD, use a protected staging deployment with Access and D1 configured.

## Cloudflare deployment

1. Create the D1 database and copy its ID into `wrangler.jsonc`.
2. Set `ALLOWED_EMAIL`, `CF_ACCESS_AUD`, and `CF_ACCESS_TEAM_DOMAIN` as Worker secrets using `npx wrangler secret put`. The allowlisted email must also be permitted by the Access policy.
3. Apply migrations with `npm run db:remote`.
4. Create a Cloudflare Access self-hosted application for the app hostname and add the intended user/email policy.
5. Run `npm run build`, then deploy with `npx wrangler deploy`.

Workers AI calorie estimates are optional and return a clear manual-entry fallback when the AI binding is not configured.

## Useful commands

- `npm run dev` — local Vite + Cloudflare Worker development
- `npm run build` — production build
- `npm run lint` — frontend TypeScript check
- `npm run typecheck:worker` — Worker TypeScript check
- `npm run test:worker` — Worker tests
- `npm run db:local` / `npm run db:remote` — apply D1 migrations

## Data and identity

All data operations are scoped to the signed Cloudflare Access JWT subject. The Worker verifies the assertion signature, issuer, audience, and email allowlist; it does not trust a user ID sent by the browser. D1 tables are defined in `migrations/`.