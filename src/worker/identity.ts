import type { Env, Identity } from './types';
import { createRemoteJWKSet, customFetch, jwtVerify } from 'jose';

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
let keySetFetch: typeof fetch = fetch;

export function setJwksFetchForTest(fetcher: typeof fetch) {
  keySetFetch = fetcher;
  keySets.clear();
}

export async function requireIdentity(request: Request, env: Env): Promise<Identity | Response> {
  if (!env.ALLOWED_EMAIL?.trim()) return Response.json({ error: 'Access allowlist is not configured' }, { status: 503 });
  const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
  const emailHeader = request.headers.get('Cf-Access-Authenticated-User-Email');
  if (!assertion || !emailHeader) return Response.json({ error: 'Authentication required' }, { status: 401 });

  try {
    const aud = env.CF_ACCESS_AUD;
    const teamDomain = env.CF_ACCESS_TEAM_DOMAIN?.replace(/\/$/, '');
    if (!aud || !teamDomain) return Response.json({ error: 'Access identity is not configured' }, { status: 503 });
    if (new URL(teamDomain).protocol !== 'https:') return Response.json({ error: 'Access team domain must use HTTPS' }, { status: 503 });
    let jwks = keySets.get(teamDomain);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`), { [customFetch]: keySetFetch });
      keySets.set(teamDomain, jwks);
    }
    const { payload: claims } = await jwtVerify(assertion, jwks, { issuer: teamDomain, audience: aud });
    const claimEmail = typeof claims.email === 'string' ? claims.email : '';
    const subject = typeof claims.sub === 'string' ? claims.sub : '';
    const name = typeof claims.name === 'string' ? claims.name : null;
    if (!claimEmail || claimEmail.toLowerCase() !== emailHeader.toLowerCase() || !subject) {
      return Response.json({ error: 'Invalid identity claims' }, { status: 401 });
    }
    if (claimEmail.toLowerCase() !== env.ALLOWED_EMAIL.toLowerCase()) return Response.json({ error: 'Access denied' }, { status: 403 });
    return { email: claimEmail.toLowerCase(), name, subject };
  } catch {
    return Response.json({ error: 'Invalid identity assertion' }, { status: 401 });
  }
}

export function isResponse(value: Identity | Response): value is Response {
  return value instanceof Response;
}