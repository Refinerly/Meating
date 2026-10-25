import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { GoogleGenAI, Type } from "@google/genai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};
if (fs.existsSync(configPath)) {
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
}

// Initialize Firebase Admin
// We use the environment variables provided by the platform or the config file
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId || 'meating-app',
  });
}

const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId)
  : getFirestore();

// Initialize Gemini
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // Strava OAuth Routes
  app.get('/api/auth/strava/info', (req, res) => {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const fallbackUrl = `${proto}://${host}`;
    const appUrl = (process.env.APP_URL || fallbackUrl).replace(/\/$/, '');
    const redirectUri = `${appUrl}/api/auth/strava/callback`;
    const callbackDomain = host ? (host as string).split(':')[0] : '';

    res.json({
      configured: Boolean(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET),
      hasClientId: Boolean(process.env.STRAVA_CLIENT_ID),
      hasClientSecret: Boolean(process.env.STRAVA_CLIENT_SECRET),
      redirectUri,
      callbackDomain,
      appUrl
    });
  });

  app.get('/api/auth/strava/url', (req, res) => {
    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    const { uid } = req.query;
    
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const fallbackUrl = `${proto}://${host}`;
    const appUrl = (process.env.APP_URL || fallbackUrl).replace(/\/$/, '');
    const redirectUri = `${appUrl}/api/auth/strava/callback`;
    
    if (!clientId) {
      return res.status(400).json({ 
        error: 'STRAVA_CLIENT_ID is not set in environment variables. Please add it to your project settings.' 
      });
    }

    if (!clientSecret) {
      return res.status(400).json({ 
        error: 'STRAVA_CLIENT_SECRET is not set in environment variables. Please add it to your project settings.' 
      });
    }

    if (!uid) {
      return res.status(400).json({ error: 'User UID required' });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read,activity:read_all',
      approval_prompt: 'force',
      state: uid as string
    });

    const authUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;
    res.json({ url: authUrl, redirectUri });
  });

  app.get('/api/auth/strava/callback', async (req, res) => {
    const { code, state, error } = req.query;

    if (error) {
      return res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'STRAVA_AUTH_ERROR', error: '${error}' }, '*');
                window.close();
              }
            </script>
            <p>Authentication canceled: ${error}</p>
          </body>
        </html>
      `);
    }

    try {
      if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
        throw new Error('STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET is missing from server environment');
      }

      const response = await axios.post('https://www.strava.com/oauth/token', {
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code'
      });

      const { access_token, refresh_token, expires_at } = response.data;
      
      const userId = state as string;
      if (!userId) {
        throw new Error('User ID missing from authentication state');
      }

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'STRAVA_AUTH_SUCCESS', 
                  payload: {
                    accessToken: '${access_token}',
                    refreshToken: '${refresh_token}',
                    expiresAt: ${expires_at}
                  }
                }, '*');
                window.close();
              } else {
                window.location.href = '/settings';
              }
            </script>
            <p>Strava authentication successful! Closing window...</p>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error('Strava callback error:', err.response?.data || err.message);
      const errorMsg = err.response?.data?.message || err.response?.data?.errors?.[0]?.message || err.message;
      res.status(500).send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'STRAVA_AUTH_ERROR', error: ${JSON.stringify(errorMsg)} }, '*');
              }
            </script>
            <div style="font-family: sans-serif; padding: 24px; color: #333;">
              <h2 style="color: #e53e3e;">Strava Connection Failed</h2>
              <p><strong>Error:</strong> ${errorMsg}</p>
              <p>Please close this window and ensure <code>STRAVA_CLIENT_ID</code> and <code>STRAVA_CLIENT_SECRET</code> are correctly set in settings.</p>
            </div>
          </body>
        </html>
      `);
    }
  });

  app.post('/api/strava/activities', async (req, res) => {
    let { accessToken, refreshToken, expiresAt } = req.body;
    
    if (!accessToken || !refreshToken || !expiresAt) {
      return res.status(400).json({ error: 'Strava is not connected or tokens are missing. Please reconnect Strava in Settings.' });
    }

    if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
      return res.status(400).json({ error: 'STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET is missing from server environment variables.' });
    }

    try {
      let tokensUpdated = false;

      // Refresh token if expired or expiring within 5 minutes
      const nowInSeconds = Math.floor(Date.now() / 1000);
      if (!expiresAt || nowInSeconds > (expiresAt - 300)) {
        try {
          const refreshResponse = await axios.post('https://www.strava.com/oauth/token', {
            client_id: process.env.STRAVA_CLIENT_ID,
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token'
          });

          accessToken = refreshResponse.data.access_token;
          refreshToken = refreshResponse.data.refresh_token;
          expiresAt = refreshResponse.data.expires_at;
          tokensUpdated = true;
        } catch (refreshErr: any) {
          console.error('Strava token refresh failed:', refreshErr.response?.data || refreshErr.message);
          return res.status(401).json({ 
            error: 'Strava authorization expired or revoked. Please reconnect Strava in Settings.',
            details: refreshErr.response?.data || refreshErr.message 
          });
        }
      }

      const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { per_page: 30 }
      });

      res.json({
        activities: activitiesResponse.data,
        tokensUpdated,
        newTokens: tokensUpdated ? { accessToken, refreshToken, expiresAt } : null
      });
    } catch (err: any) {
      console.error('Strava activities error:', err.response?.data || err.message);
      const errorMsg = err.response?.data?.message || (err.response?.status === 401 ? 'Unauthorized by Strava. Please reconnect in Settings.' : 'Failed to fetch activities from Strava');
      res.status(err.response?.status || 500).json({ error: errorMsg, details: err.response?.data });
    }
  });

  // Business Dashboard Sync Proxy
  app.post('/api/sync-dashboard', async (req, res) => {
    try {
      const payload = req.body;
      const apiKey = process.env.MEATING_DASHBOARD_API_KEY;
      
      if (!apiKey) {
        return res.status(401).json({ error: 'MEATING_DASHBOARD_API_KEY not configured in environment' });
      }
      
      const response = await axios.post('https://ais-dev-zh7s4sl2oavhar4qz6gznr-31321158591.europe-west2.run.app/api/meating', payload, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      });

      res.json(response.data);
    } catch (err: any) {
      console.error('Dashboard sync proxy error:', err.response?.data || err.message);
      res.status(err.response?.status || 500).json(err.response?.data || { error: 'Sync failed' });
    }
  });

  // AI Calorie Estimation Route
  app.post('/api/estimate-calories', async (req, res) => {
    const { mealName } = req.body;
    if (!mealName) return res.status(400).json({ error: 'Meal name is required' });

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Estimate the calories for a typical serving of "${mealName}". Return the result as JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              calories: { type: Type.NUMBER, description: "Estimated calories" },
              notes: { type: Type.STRING, description: "Brief explanation of serving size or assumptions" }
            },
            required: ["calories", "notes"]
          }
        }
      });

      res.json(JSON.parse(response.text || '{}'));
    } catch (err: any) {
      console.error('Gemini error:', err.message);
      res.status(500).json({ error: 'Failed to estimate calories' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
