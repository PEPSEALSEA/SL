import { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import { JWT } from 'google-auth-library';

type Bindings = {
  SPREADSHEET_ID: string;
  GOOGLE_DRIVE_FOLDER_ID: string;
  GOOGLE_CLIENT_EMAIL: string;
  GOOGLE_PRIVATE_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const MAX_UPLOAD_BYTES = 14 * 1024 * 1024;

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  maxAge: 86400,
}));

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ success: false, error: 'Server error', message: 'Server error' }, 500, CORS_HEADERS);
});

const USERS_SHEET = 'Users';
const URLS_SHEET = 'URLs';
const QRS_SHEET = 'QRCodes';

const USERS_HEADERS = ['User ID', 'Email', 'Username', 'Real Password', 'Password Hash', 'Created At (UTC)'];
const URLS_HEADERS = ['Short Code', 'Original URL', 'User ID', 'Created At (UTC)', 'Click Count', 'Expiry Date', 'Drive ID'];
const QRS_HEADERS = ['QR ID', 'User ID', 'Name', 'Content', 'Config JSON', 'Logo Drive ID', 'Image Drive ID', 'Created At (UTC)'];

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
];

// --- Auth & Sheets helpers ---

async function getAuthToken(env: Bindings): Promise<string> {
  const client = new JWT({
    email: env.GOOGLE_CLIENT_EMAIL,
    key: env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: SCOPES,
  });
  const credentials = await client.authorize();
  if (!credentials.access_token) throw new Error('Failed to obtain access token');
  return credentials.access_token;
}

async function getSheetValues(env: Bindings, range: string): Promise<string[][]> {
  const token = await getAuthToken(env);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets API error: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { values?: string[][] };
  return data.values || [];
}

function parseCreatedTimestamp(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeCreatedDate(value: string | undefined): string {
  const ts = parseCreatedTimestamp(value);
  return ts > 0 ? new Date(ts).toISOString() : '';
}

function resolveCreatedAt(clientValue: string | undefined): string {
  const ts = parseCreatedTimestamp(clientValue);
  if (ts > 0) return new Date(ts).toISOString();
  return new Date().toISOString();
}

async function appendSheetRow(env: Bindings, range: string, values: unknown[]) {
  const token = await getAuthToken(env);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] }),
  });
  if (!res.ok) throw new Error(`Sheets append error: ${res.statusText}`);
}

async function updateSheetRow(env: Bindings, range: string, values: unknown[]) {
  const token = await getAuthToken(env);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [values] }),
  });
  if (!res.ok) throw new Error(`Sheets update row error: ${res.statusText}`);
}

async function updateSheetCell(env: Bindings, range: string, value: unknown) {
  const token = await getAuthToken(env);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: [[value]] }),
  });
  if (!res.ok) throw new Error(`Sheets update error: ${res.statusText}`);
}

async function getSheetId(env: Bindings, sheetName: string): Promise<number> {
  const token = await getAuthToken(env);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}?fields=sheets.properties`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Sheets metadata error: ${res.statusText}`);
  const data = (await res.json()) as { sheets?: { properties: { title: string; sheetId: number } }[] };
  const sheet = data.sheets?.find((s) => s.properties.title === sheetName);
  if (!sheet) throw new Error(`Sheet not found: ${sheetName}`);
  return sheet.properties.sheetId;
}

async function ensureSheetExists(env: Bindings, sheetName: string) {
  try {
    await getSheetId(env, sheetName);
  } catch {
    const token = await getAuthToken(env);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}:batchUpdate`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Sheets addSheet error: ${res.status} ${err}`);
    }
  }
}

async function deleteSheetRow(env: Bindings, sheetName: string, rowIndex: number) {
  const sheetId = await getSheetId(env, sheetName);
  const token = await getAuthToken(env);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SPREADSHEET_ID}:batchUpdate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowIndex, endIndex: rowIndex + 1 },
        },
      }],
    }),
  });
  if (!res.ok) throw new Error(`Sheets delete error: ${res.statusText}`);
}

// --- Drive helpers ---

async function uploadToDrive(
  env: Bindings,
  filename: string,
  contentType: string,
  base64Content: string
) {
  const token = await getAuthToken(env);
  const binary = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0));
  const boundary = `boundary_${crypto.randomUUID()}`;
  const metadata = JSON.stringify({
    name: filename,
    parents: [env.GOOGLE_DRIVE_FOLDER_ID],
  });

  const encoder = new TextEncoder();
  const prefix = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`
  );
  const suffix = encoder.encode(`\r\n--${boundary}--`);

  const body = new Uint8Array(prefix.length + binary.length + suffix.length);
  body.set(prefix, 0);
  body.set(binary, prefix.length);
  body.set(suffix, prefix.length + binary.length);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink',
    {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload error: ${res.status} ${err}`);
  }

  const file = (await res.json()) as { id: string; webViewLink?: string };

  await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/permissions?supportsAllDrives=true`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });

  return {
    driveId: file.id,
    url: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
    directUrl: `https://drive.google.com/file/d/${file.id}`,
    downloadUrl: `https://drive.google.com/uc?export=download&id=${file.id}`,
    viewUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
  };
}

async function trashDriveFiles(env: Bindings, driveIds: string[]) {
  const token = await getAuthToken(env);
  const processed: string[] = [];
  const errors: { id: string; error: string }[] = [];

  for (const id of driveIds) {
    try {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ trashed: true }),
      });
      if (!res.ok) throw new Error(await res.text());
      processed.push(id);
    } catch (err) {
      errors.push({ id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { count: processed.length, errors };
}

// --- Utilities ---

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function ok(message: string, extra: Record<string, unknown> = {}) {
  return jsonResponse({ success: true, message, ...extra });
}

function fail(message: string, status = 200, extra: Record<string, unknown> = {}) {
  return jsonResponse({ success: false, error: message, message, ...extra }, status);
}

async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return btoa(String.fromCharCode(...hashArray));
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return (await hashPassword(password)) === hash;
}

function generateUUID(): string {
  return crypto.randomUUID();
}

function generateShortUUID(): string {
  return crypto.randomUUID().replace(/-/g, '').substring(0, 8);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUrl(string: string): boolean {
  try {
    if (!string) return false;
    let url = ('' + string).trim();
    if (url.length < 3) return false;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const pattern = /^(https?:\/\/)(localhost(:\d+)?|(\d{1,3}\.){3}\d{1,3}|([a-z0-9-]+\.)+[a-z]{2,})(\/[^\s]*)?$/i;
    return pattern.test(url);
  } catch {
    return false;
  }
}

async function parseParams(c: Context): Promise<Record<string, string>> {
  const contentType = c.req.header('content-type') || '';
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const body = await c.req.text();
    return Object.fromEntries(new URLSearchParams(body));
  }
  if (contentType.includes('application/json')) {
    try {
      const body = (await c.req.json()) as Record<string, unknown>;
      const result: Record<string, string> = {};
      for (const [k, v] of Object.entries(body)) {
        if (v !== undefined && v !== null) result[k] = String(v);
      }
      return result;
    } catch {
      return {};
    }
  }
  return {};
}

function mergeQueryParams(query: Record<string, string>, body: Record<string, string>): Record<string, string> {
  return { ...query, ...body };
}

// --- Action handlers ---

async function handleRegister(env: Bindings, params: Record<string, string>) {
  const email = params.email?.trim();
  const username = params.username?.trim();
  const password = params.password;

  if (!email || !username || !password) return fail('All fields are required');
  if (!isValidEmail(email)) return fail('Invalid email format');
  if (username.length < 3) return fail('Username must be at least 3 characters');
  if (password.length < 6) return fail('Password must be at least 6 characters');

  const users = await getSheetValues(env, `${USERS_SHEET}!A:F`);
  for (let i = 1; i < users.length; i++) {
    if (users[i][1] === email || users[i][2] === username) {
      return fail('Email or username already exists');
    }
  }

  const userId = generateUUID();
  const hashedPassword = await hashPassword(password);
  await appendSheetRow(env, USERS_SHEET, [userId, email, username, password, hashedPassword, new Date().toISOString()]);

  return ok('User registered successfully');
}

async function handleLogin(env: Bindings, params: Record<string, string>) {
  const identifier = params.identifier?.trim();
  const password = params.password;

  if (!identifier || !password) return fail('Email/username and password are required');

  const users = await getSheetValues(env, `${USERS_SHEET}!A:F`);
  for (let i = 1; i < users.length; i++) {
    const [userId, email, username, , storedHash] = users[i];
    if (email === identifier || username === identifier) {
      if (await verifyPassword(password, storedHash)) {
        return ok('Login successful', {
          user: { id: userId, email, username },
        });
      }
      return fail('Invalid password');
    }
  }

  return fail('User not found');
}

async function handleCreate(env: Bindings, params: Record<string, string>) {
  let originalUrl = params.originalUrl?.trim() || '';
  const customSlug = params.customSlug?.trim();
  const userId = params.userId;
  const expiryDate = params.expiryDate;
  const driveId = params.driveId;

  if (!originalUrl.match(/^https?:\/\//i)) originalUrl = 'https://' + originalUrl;
  if (!isValidUrl(originalUrl)) return fail('Invalid URL format');
  if (!userId) return fail('User not authenticated');

  const urls = await getSheetValues(env, `${URLS_SHEET}!A:G`);
  let shortCode: string;

  if (customSlug) {
    shortCode = customSlug;
    for (let i = 1; i < urls.length; i++) {
      if (urls[i][0] === shortCode) return fail('Custom short code already exists');
    }
  } else {
    shortCode = generateShortUUID();
  }

  const createdAt = resolveCreatedAt(params.createdAt);

  await appendSheetRow(env, URLS_SHEET, [
    shortCode, originalUrl, userId, createdAt, 0, expiryDate || '', driveId || '',
  ]);

  return ok('Short URL created successfully', { shortCode, originalUrl });
}

async function handleDelete(env: Bindings, params: Record<string, string>) {
  const shortCode = params.shortCode;
  const userId = params.userId;
  if (!shortCode || !userId) return fail('Missing required parameters');

  const urls = await getSheetValues(env, `${URLS_SHEET}!A:G`);
  for (let i = 1; i < urls.length; i++) {
    if (urls[i][0] === shortCode && urls[i][2] === userId) {
      await deleteSheetRow(env, URLS_SHEET, i);
      return ok('Link deleted successfully');
    }
  }

  return fail('Link not found or you do not have permission to delete it');
}

async function handleGetUserLinks(env: Bindings, userId: string) {
  if (!userId) return fail('User not authenticated');

  const urls = await getSheetValues(env, `${URLS_SHEET}!A:G`);
  const userLinks: Record<string, unknown>[] = [];

  for (let i = 1; i < urls.length; i++) {
    if (urls[i][2] === userId) {
      userLinks.push({
        shortCode: urls[i][0],
        originalUrl: urls[i][1],
        created: normalizeCreatedDate(urls[i][3]),
        clicks: Number(urls[i][4]) || 0,
        expiryDate: urls[i][5] || '',
        driveId: urls[i][6] || '',
      });
    }
  }

  userLinks.sort((a, b) => parseCreatedTimestamp(String(b.created)) - parseCreatedTimestamp(String(a.created)));
  return ok('Links retrieved successfully', { links: userLinks });
}

type ResolvedLink =
  | { ok: true; originalUrl: string; expiryDate: string; driveId: string }
  | { ok: false; reason: 'not_found' | 'expired' };

async function resolveShortCode(env: Bindings, shortCode: string): Promise<ResolvedLink> {
  const urls = await getSheetValues(env, `${URLS_SHEET}!A:G`);

  for (let i = 1; i < urls.length; i++) {
    if (urls[i][0] === shortCode) {
      const currentClicks = Number(urls[i][4]) || 0;
      await updateSheetCell(env, `${URLS_SHEET}!E${i + 1}`, currentClicks + 1);

      const expiryDate = urls[i][5] || '';
      if (expiryDate) {
        const expiry = new Date(expiryDate);
        if (expiry < new Date()) {
          return { ok: false, reason: 'expired' };
        }
      }

      return {
        ok: true,
        originalUrl: urls[i][1],
        expiryDate,
        driveId: urls[i][6] || '',
      };
    }
  }

  return { ok: false, reason: 'not_found' };
}

function redirectDestination(link: Extract<ResolvedLink, { ok: true }>): string {
  if (link.driveId) {
    return `https://drive.google.com/file/d/${link.driveId}/view`;
  }
  return link.originalUrl;
}

async function handleGet(env: Bindings, shortCode: string) {
  const result = await resolveShortCode(env, shortCode);
  if (!result.ok) {
    if (result.reason === 'expired') {
      return fail('Link has expired', 200, { expired: true });
    }
    return fail('Short code not found');
  }

  return ok('URL found', {
    originalUrl: result.originalUrl,
    expiryDate: result.expiryDate,
    driveId: result.driveId,
  });
}

async function handleUpload(env: Bindings, params: Record<string, string>) {
  let base64Content = params.content || '';
  if (base64Content.includes('base64,')) {
    base64Content = base64Content.split('base64,')[1];
  }
  if (!base64Content) return fail('No file content provided');

  const filename = params.filename || `file_${Date.now()}.jpg`;
  const contentType = params.contentType || 'application/octet-stream';

  try {
    const result = await uploadToDrive(env, filename, contentType, base64Content);
    return ok('Upload successful', result);
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'Upload failed');
  }
}

async function handleDeleteFiles(env: Bindings, params: Record<string, string>) {
  let driveIds: string[] = [];
  const raw = params.driveIds;
  if (raw) {
    try {
      driveIds = JSON.parse(raw);
    } catch {
      driveIds = raw.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }

  if (!Array.isArray(driveIds) || driveIds.length === 0) {
    return fail('No driveIds provided');
  }

  const { count, errors } = await trashDriveFiles(env, driveIds);
  return ok(`Successfully processed ${count} files`, { count, errors });
}

async function handleSaveQR(env: Bindings, params: Record<string, string>) {
  const userId = params.userId;
  const name = params.name?.trim();
  const content = params.content?.trim();
  const configJson = params.config;
  const logoDriveId = params.logoDriveId || '';
  const imageDriveId = params.imageDriveId || '';
  const existingId = params.qrId?.trim();

  if (!userId) return fail('User not authenticated');
  if (!name) return fail('QR name is required');
  if (!content) return fail('QR content is required');
  if (!configJson) return fail('QR config is required');

  try {
    JSON.parse(configJson);
  } catch {
    return fail('Invalid config JSON');
  }

  const qrs = await getSheetValues(env, `${QRS_SHEET}!A:H`);

  if (existingId) {
    for (let i = 1; i < qrs.length; i++) {
      if (qrs[i][0] === existingId && qrs[i][1] === userId) {
        await updateSheetRow(env, `${QRS_SHEET}!A${i + 1}:H${i + 1}`, [
          existingId, userId, name, content, configJson,
          logoDriveId, imageDriveId, qrs[i][7] || new Date().toISOString(),
        ]);
        return ok('QR code updated successfully', { qrId: existingId });
      }
    }
    return fail('QR code not found or you do not have permission to edit it');
  }

  const qrId = generateUUID();
  await appendSheetRow(env, QRS_SHEET, [
    qrId, userId, name, content, configJson,
    logoDriveId, imageDriveId, new Date().toISOString(),
  ]);

  return ok('QR code saved successfully', { qrId });
}

async function handleGetUserQRs(env: Bindings, userId: string) {
  if (!userId) return fail('User not authenticated');

  const qrs = await getSheetValues(env, `${QRS_SHEET}!A:H`);
  const userQRs: Record<string, unknown>[] = [];

  for (let i = 1; i < qrs.length; i++) {
    if (qrs[i][1] === userId) {
      let config = {};
      try {
        config = JSON.parse(qrs[i][4] || '{}');
      } catch {
        config = {};
      }
      userQRs.push({
        id: qrs[i][0],
        name: qrs[i][2],
        content: qrs[i][3],
        config,
        logoDriveId: qrs[i][5] || '',
        imageDriveId: qrs[i][6] || '',
        created: normalizeCreatedDate(qrs[i][7]),
      });
    }
  }

  userQRs.sort((a, b) => parseCreatedTimestamp(String(b.created)) - parseCreatedTimestamp(String(a.created)));
  return ok('QR codes retrieved successfully', { qrs: userQRs });
}

async function handleDeleteQR(env: Bindings, params: Record<string, string>) {
  const qrId = params.qrId;
  const userId = params.userId;
  if (!qrId || !userId) return fail('Missing required parameters');

  const qrs = await getSheetValues(env, `${QRS_SHEET}!A:H`);
  for (let i = 1; i < qrs.length; i++) {
    if (qrs[i][0] === qrId && qrs[i][1] === userId) {
      await deleteSheetRow(env, QRS_SHEET, i);
      return ok('QR code deleted successfully');
    }
  }

  return fail('QR code not found or you do not have permission to delete it');
}

async function handleSetup(env: Bindings) {
  const users = await getSheetValues(env, `${USERS_SHEET}!A:F`);
  const urls = await getSheetValues(env, `${URLS_SHEET}!A:G`);

  await ensureSheetExists(env, QRS_SHEET);
  const qrs = await getSheetValues(env, `${QRS_SHEET}!A:H`);

  if (users.length === 0) {
    await appendSheetRow(env, USERS_SHEET, USERS_HEADERS);
  } else {
    await updateSheetRow(env, `${USERS_SHEET}!A1:F1`, USERS_HEADERS);
  }

  if (urls.length === 0) {
    await appendSheetRow(env, URLS_SHEET, URLS_HEADERS);
  } else {
    await updateSheetRow(env, `${URLS_SHEET}!A1:G1`, URLS_HEADERS);
  }

  if (qrs.length === 0) {
    await appendSheetRow(env, QRS_SHEET, QRS_HEADERS);
  } else {
    await updateSheetRow(env, `${QRS_SHEET}!A1:H1`, QRS_HEADERS);
  }

  const usersRows = await getSheetValues(env, `${USERS_SHEET}!A:A`);
  const urlsRows = await getSheetValues(env, `${URLS_SHEET}!A:A`);
  const qrsRows = await getSheetValues(env, `${QRS_SHEET}!A:A`);
  return ok('Sheets initialized successfully', {
    usersRows: usersRows.length,
    urlsRows: urlsRows.length,
    qrsRows: qrsRows.length,
    usersHeaders: USERS_HEADERS,
    urlsHeaders: URLS_HEADERS,
    qrsHeaders: QRS_HEADERS,
  });
}

// --- Routes ---

app.get('/health', (c) => c.json({ ok: true, service: 'sl-worker' }));

app.get('/sl/:shortCode', async (c) => {
  try {
    const shortCode = c.req.param('shortCode') || '';
    if (!shortCode) {
      return new Response('Short link not found', { status: 404 });
    }

    const result = await resolveShortCode(c.env, shortCode);
    if (!result.ok) {
      const message = result.reason === 'expired' ? 'Link has expired' : 'Short link not found';
      const status = result.reason === 'expired' ? 410 : 404;
      return new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }

    return Response.redirect(redirectDestination(result), 302);
  } catch (err) {
    console.error('Redirect error:', err);
    return new Response('Server error', { status: 500 });
  }
});

app.get('/', async (c) => {
  try {
    const action = c.req.query('action');
    if (action === 'get') {
      const shortCode = c.req.query('shortCode') || '';
      return handleGet(c.env, shortCode);
    }
    if (action === 'getUserLinks') {
      const userId = c.req.query('userId') || '';
      return handleGetUserLinks(c.env, userId);
    }
    if (action === 'getUserQRs') {
      const userId = c.req.query('userId') || '';
      return handleGetUserQRs(c.env, userId);
    }
    return fail('Invalid request');
  } catch (err) {
    console.error('GET error:', err);
    return fail('Server error', 500);
  }
});

app.post('/', async (c) => {
  try {
    const queryParams: Record<string, string> = {};
    const url = new URL(c.req.url);
    url.searchParams.forEach((v, k) => { queryParams[k] = v; });

    if (url.searchParams.get('action') === 'upload') {
      const contentLength = Number(c.req.header('content-length') || 0);
      if (contentLength > MAX_UPLOAD_BYTES) {
        return fail('File too large. Maximum upload size is 10MB.');
      }
    }

    const bodyParams = await parseParams(c);
    const params = mergeQueryParams(queryParams, bodyParams);
    const action = params.action;

    switch (action) {
      case 'register': return handleRegister(c.env, params);
      case 'login': return handleLogin(c.env, params);
      case 'create': return handleCreate(c.env, params);
      case 'delete': return handleDelete(c.env, params);
      case 'upload': return handleUpload(c.env, params);
      case 'deleteFiles': return handleDeleteFiles(c.env, params);
      case 'saveQR': return handleSaveQR(c.env, params);
      case 'deleteQR': return handleDeleteQR(c.env, params);
      case 'setup': return handleSetup(c.env);
      default: return fail('Invalid request');
    }
  } catch (err) {
    console.error('POST error:', err);
    return fail('Server error', 500);
  }
});

export default app;
