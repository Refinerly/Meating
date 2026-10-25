import { describe, expect, it } from 'vitest';
import { requireIdentity, setJwksFetchForTest } from './identity';
import type { Env } from './types';
import { SignJWT, generateKeyPair, exportJWK } from 'jose';

const domain = 'https://team.example.cloudflareaccess.com';
const env = { ALLOWED_EMAIL: 'owner@example.com', CF_ACCESS_AUD: 'test-aud', CF_ACCESS_TEAM_DOMAIN: domain } as Env;

describe('Cloudflare Access identity gate', () => {
  it('rejects a request without an Access assertion', async () => {
    const result = await requireIdentity(new Request('https://app.example/api/me'), env);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it('rejects malformed assertions', async () => {
    const request = new Request('https://app.example/api/me', {
      headers: { 'Cf-Access-Jwt-Assertion': 'bad', 'Cf-Access-Authenticated-User-Email': 'owner@example.com' },
    });
    const result = await requireIdentity(request, env);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it('rejects an unset access allowlist', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    setJwksFetchForTest(async () => Response.json({ keys: [{ ...jwk, kid: 'test-empty-allowlist', use: 'sig', alg: 'RS256' }] }));
    try {
      const token = await new SignJWT({ email: 'owner@example.com' })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-empty-allowlist' })
        .setIssuer(domain).setAudience('test-aud').setSubject('owner').setExpirationTime('2m').sign(privateKey);
      const request = new Request('https://app.example/api/me', {
        headers: {
          'Cf-Access-Jwt-Assertion': token,
          'Cf-Access-Authenticated-User-Email': 'owner@example.com',
        },
      });
      const result = await requireIdentity(request, { ...env, ALLOWED_EMAIL: '' });
      expect(result).toBeInstanceOf(Response);
      expect((result as Response).status).toBe(503);
    } finally {
      setJwksFetchForTest(fetch);
    }
  });

  it('rejects forged unsigned JWT claims', async () => {
    const encoded = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const claims = btoa(JSON.stringify({ aud: ['test-aud'], exp: Math.floor(Date.now() / 1000) + 60, email: 'owner@example.com', sub: 'owner', iss: domain })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const assertion = `${encoded}.${claims}.forged-signature`;
    const request = new Request('https://app.example/api/me', {
      headers: {
        'Cf-Access-Jwt-Assertion': assertion,
        'Cf-Access-Authenticated-User-Email': 'owner@example.com',
      },
    });
    const result = await requireIdentity(request, env);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it('requires the Access assertion email to match the configured single owner', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    setJwksFetchForTest(async () => Response.json({ keys: [{ ...jwk, kid: 'test-key', use: 'sig', alg: 'RS256' }] }));
    try {
      const token = await new SignJWT({ email: 'owner@example.com', name: 'Owner' })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(domain).setAudience('test-aud').setSubject('owner').setExpirationTime('2m').sign(privateKey);
      const request = new Request('https://app.example/api/me', {
        headers: { 'Cf-Access-Jwt-Assertion': token, 'Cf-Access-Authenticated-User-Email': 'owner@example.com' },
      });
      const result = await requireIdentity(request, env);
      expect(result).toEqual({ email: 'owner@example.com', name: 'Owner', subject: 'owner' });
    } finally {
      setJwksFetchForTest(fetch);
    }
  });
});