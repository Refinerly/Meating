export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  AI?: Ai;
  ALLOWED_EMAIL: string;
  CF_ACCESS_AUD?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
}

export interface AccessContext {
  access?: {
    getIdentity(): Promise<{ email?: string; name?: string; id?: string } | null>;
  };
}

export interface Identity {
  email: string;
  name: string | null;
  subject: string;
}

export interface ApiError {
  error: string;
}