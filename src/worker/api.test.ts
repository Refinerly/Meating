import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import * as access from './identity';

const identity = { email: 'owner@example.com', name: 'Owner', subject: 'access-subject' };

function createEnv(responses: Record<string, unknown> = {}) {
  const state: { sql: string; bindings: unknown[] }[] = [];
  const env = {
    ALLOWED_EMAIL: 'owner@example.com',
    CF_ACCESS_AUD: 'aud',
    CF_ACCESS_TEAM_DOMAIN: 'https://team.example.com',
    ASSETS: { fetch: vi.fn() },
    DB: {
      prepare(sql: string) {
        const entry = { sql, bindings: [] as unknown[] };
        state.push(entry);
        const statement = {
          bind(...bindings: unknown[]) { entry.bindings = bindings; return statement; },
          async run() { return { meta: { changes: 1 } }; },
          async first() { return responses[sql] ?? null; },
          async all() { return { results: [] }; },
        };
        return statement;
      },
      async batch() { return []; },
    },
  } as any;
  return { env, state };
}

describe('Worker API data handlers', () => {
  afterEach(() => vi.restoreAllMocks());

  it('creates a check-in using the authenticated account and only supported schema fields', async () => {
    vi.spyOn(access, 'requireIdentity').mockResolvedValue(identity);
    const row = { id: 'checkin-id', user_id: identity.subject, timestamp: '2026-10-24T12:00:00.000Z', stats: '{"mood":4}', social_behavior: 'posting', note: 'Feeling good', nudges_applied: '[]' };
    const { env, state } = createEnv();
    vi.spyOn(env.DB, 'prepare').mockImplementation((query: unknown) => {
      const sql = String(query);
      const entry = { sql, bindings: [] as unknown[] }; state.push(entry);
      const statement = { bind(...bindings: unknown[]) { entry.bindings = bindings; return statement; }, async run() { return { meta: { changes: 1 } }; }, async first() { return sql.startsWith('SELECT * FROM checkins') ? row : null; }, async all() { return { results: [] }; } };
      return statement as any;
    });
    const response = await worker.fetch(new Request('https://meating.example/api/checkins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ timestamp: row.timestamp, stats: { mood: 4 }, socialBehavior: 'posting', note: row.note, nudgesApplied: [] }) }), env);
    expect(response.status).toBe(201);
    const insert = state.find(entry => entry.sql.includes('INSERT INTO checkins'))!;
    expect(insert.bindings).toContain(identity.email.toLowerCase());
    expect(insert.sql).not.toContain('is_optional');
  });

  it('returns a health log by date using the date path', async () => {
    vi.spyOn(access, 'requireIdentity').mockResolvedValue(identity);
    const { env, state } = createEnv();
    const response = await worker.fetch(new Request('https://meating.example/api/health-logs/2026-10-24'), env);
    expect(response.status).toBe(200);
    expect(state.some(entry => entry.sql.includes('FROM health_logs WHERE user_id=? AND date=?'))).toBe(true);
  });

  it('rejects an invalid date before querying D1', async () => {
    vi.spyOn(access, 'requireIdentity').mockResolvedValue(identity);
    const { env, state } = createEnv();
    const response = await worker.fetch(new Request('https://meating.example/api/health-logs/not-a-date'), env);
    expect(response.status).toBe(400);
    expect(state.filter(entry => entry.sql.includes('health_logs')).length).toBe(0);
  });

  it('accepts partial health-log saves and binds arrays as valid JSON', async () => {
    vi.spyOn(access, 'requireIdentity').mockResolvedValue(identity);
    const saved = { id: '2026-10-24', user_id: identity.subject, date: '2026-10-24', exercises: '["Walk"]', supplements: '[]', teas: '[]', meals: '[]', weight: null, sleep_time: '', wake_time: '' };
    const { env, state } = createEnv();
    vi.spyOn(env.DB, 'prepare').mockImplementation((query: unknown) => {
      const sql = String(query); const entry = { sql, bindings: [] as unknown[] }; state.push(entry);
      const statement = { bind(...bindings: unknown[]) { entry.bindings = bindings; return statement; }, async run() { return { meta: { changes: 1 } }; }, async first() { return sql.startsWith('SELECT * FROM health_logs') ? saved : null; }, async all() { return { results: [] }; } };
      return statement as any;
    });
    const response = await worker.fetch(new Request('https://meating.example/api/health-logs/2026-10-24', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exercises: ['Walk'] }) }), env);
    expect(response.status).toBe(200);
    const insert = state.find(entry => entry.sql.includes('INSERT INTO health_logs'))!;
    expect(insert.bindings).toEqual(['2026-10-24', identity.email.toLowerCase(), '2026-10-24', '["Walk"]']);
    expect(insert.sql).toContain('ON CONFLICT(user_id,date)');
  });

  it('scopes collection requests to the authenticated account', async () => {
    vi.spyOn(access, 'requireIdentity').mockResolvedValue(identity);
    const { env, state } = createEnv();
    const response = await worker.fetch(new Request('https://meating.example/api/quests?date=2026-10-24'), env);
    expect(response.status).toBe(200);
    const select = state.find(entry => entry.sql.includes('FROM quests'))!;
    expect(select.bindings).toContain(identity.email.toLowerCase());
    expect(select.sql).not.toContain(identity.subject);
  });
});