# Cloudflare rollout plan

## Target

- Private GitHub repository; never commit `.dev.vars`, Firebase config, OAuth credentials, or production tokens.
- Cloudflare Worker serves the Vite PWA and `/api/*` endpoints.
- D1 is the application database; migration `0001_initial_schema.sql` is a draft starting schema.
- Cloudflare Access is the only first-release sign-in gate. Protect both the app hostname and API paths with an **Allow** policy restricted to the owner's exact email.
- Workers AI is optional for meal estimates. Calls consume account usage even in local Wrangler development; quota/availability is not guaranteed to be zero-cost.
- Google Calendar/Tasks and Strava are disabled until their OAuth flows are redesigned and tested.

## Important Access trust boundary

Do not trust the `Cf-Access-Authenticated-User-Email` header by itself. The Worker verifies the `Cf-Access-Jwt-Assertion` signature against the Access application's published JWKS, and validates issuer, audience, expiry, and matching email using `jose`. Cloudflare Access must still be configured to protect the Worker hostname and allow only the owner. The Worker also checks the configured owner email.

## Staged work still required

1. Verify Access JWT signature validation and owner allowlisting against a real Access app in a deployed staging environment.
2. Complete the D1 API with per-table schemas/validation, safe query filters/sorts, pagination, and profile/settings operations.
3. Port every page off Firestore to the API. Remove old Firebase code only after search confirms no imports remain.
4. Implement secure backup/export and recovery before real use. Verify database retention/backups fit personal health/finance data.
5. Choose the AI provider/model after testing estimate quality and confirming the account's actual allowance. Make the feature optional and manual entry always available.
6. Exercise migrations and APIs locally with D1, add integration tests, and run the production build.
7. Create the Cloudflare D1 database and replace the placeholder ID in `wrangler.jsonc`; set `ALLOWED_EMAIL` and `CF_ACCESS_AUD` in Worker configuration, and create the matching Access app/policy.
8. Configure Worker AI binding only if desired, deploy from the private GitHub repo, and test login/API denial from an unauthenticated browser.
9. Only after production checks, rotate any credentials ever exposed in publicly shared code or logs.

## Current status

The Worker and D1 schema are scaffolding, not a finished migration. Existing React pages still call Firebase directly; the old Express server and Firebase initializers should not be deployed. The project is intentionally not deployable until the staged tasks above are complete.