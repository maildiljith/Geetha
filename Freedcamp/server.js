/**
 * server.js — Local proxy server for Freedcamp API
 * Supports both unsecured (api_key only) and secured (api_key + timestamp + hash) auth.
 *
 * Usage: node server.js
 * Dashboard: http://localhost:3456
 *
 * For secured API keys, set API_SECRET below.
 * Hash formula: HMAC-SHA1(api_key + timestamp, api_secret)
 */

const http = require('http');
const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3456;
const API_KEY    = 'e73ea921952c4777e10be30ec793968f4b61fc08';
const API_SECRET = '0dac4c7f5ea5018bdfbfcc4678b3b83b16166dee';

const FREEDCAMP_BASE = 'https://freedcamp.com/api/v1';

// MIME types for static files
const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

// ─── Auth params ──────────────────────────────────────────────────────────────
function getAuthParams() {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { api_key: API_KEY, timestamp };
  if (API_SECRET) {
    // Secured key: hash = HMAC-SHA1(api_key + timestamp, api_secret)
    const hash = crypto
      .createHmac('sha1', API_SECRET)
      .update(API_KEY + timestamp)
      .digest('hex');
    params.hash = hash;
  }
  return params;
}

// ─── Proxy Freedcamp API ──────────────────────────────────────────────────────
function proxyFreedcamp(apiPath, queryParams, res) {
  const targetUrl = new URL(`${FREEDCAMP_BASE}${apiPath}`);

  // Add auth params
  const authParams = getAuthParams();
  Object.entries(authParams).forEach(([k, v]) => targetUrl.searchParams.set(k, String(v)));

  // Forward extra client query params (limit, offset, project_id)
  Object.entries(queryParams).forEach(([k, v]) => {
    if (!['api_key', 'timestamp', 'hash'].includes(k)) {
      targetUrl.searchParams.set(k, v);
    }
  });

  console.log(`  → ${apiPath} ${targetUrl.searchParams.toString().slice(0, 80)}…`);

  https.get(targetUrl.toString(), (apiRes) => {
    let body = '';
    apiRes.on('data', chunk => body += chunk);
    apiRes.on('end', () => {
      console.log(`  ← ${apiRes.statusCode} ${apiPath}`);
      res.writeHead(apiRes.statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(body);
    });
  }).on('error', (err) => {
    console.error(`  ✗ ${apiPath}:`, err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  });
}

// ─── Serve Static Files ───────────────────────────────────────────────────────
function serveStatic(filePath, res) {
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'text/plain';
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// ─── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (pathname.startsWith('/api/v1/')) {
    const apiPath = pathname.replace('/api/v1', '');
    proxyFreedcamp(apiPath, parsed.query, res);
    return;
  }

  // Named HTML routes
  const htmlRoutes = { '/': 'index.html', '/team': 'team.html' };
  const htmlFile = htmlRoutes[pathname];
  const filePath = htmlFile
    ? path.join(__dirname, htmlFile)
    : path.join(__dirname, pathname);
  serveStatic(filePath, res);
});

server.listen(PORT, () => {
  const authMode = API_SECRET ? 'Secured (HMAC-SHA1)' : 'Timestamp only';
  console.log(`\n  ✅ Freedcamp Dashboard running at http://localhost:${PORT}`);
  console.log(`  🔑 Auth mode: ${authMode}`);
  console.log(`  API proxy:    http://localhost:${PORT}/api/v1/projects\n`);
});
