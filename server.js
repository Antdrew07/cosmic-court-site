const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const uploadPost = require('./lib/uploadpost');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- storage ----------
const DATA_DIR = (() => {
  const vol = '/data';
  try { fs.mkdirSync(vol, { recursive: true }); fs.accessSync(vol, fs.constants.W_OK); return vol; }
  catch { const local = path.join(__dirname, 'data'); fs.mkdirSync(local, { recursive: true }); return local; }
})();

function readJson(name, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8')); }
  catch { return fallback; }
}
function writeJson(name, value) {
  const file = path.join(DATA_DIR, name);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

// ---------- config ----------
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD || '').trim();
const SESSION_SECRET = (process.env.SESSION_SECRET || '').trim() || crypto.randomBytes(32).toString('hex');
const SITE_URL = (process.env.SITE_URL || 'https://www.cosmiccourtbook.com').replace(/\/$/, '');
const SESSION_HOURS = 24 * 7;

// ---------- sessions (signed cookie, no deps) ----------
function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}
function makeToken() {
  const exp = String(Date.now() + SESSION_HOURS * 3600 * 1000);
  return `${exp}.${sign(exp)}`;
}
function validToken(token) {
  if (!token) return false;
  const [exp, sig] = String(token).split('.');
  if (!exp || !sig) return false;
  const expected = sign(exp);
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  return Number(exp) > Date.now();
}
function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}
function isAuthed(req) {
  return validToken(getCookie(req, 'cc_admin'));
}

// ---------- login rate limiting ----------
const attempts = new Map();
function allowAttempt(ip) {
  const now = Date.now();
  const rec = attempts.get(ip) || { count: 0, reset: now + 15 * 60 * 1000 };
  if (now > rec.reset) { rec.count = 0; rec.reset = now + 15 * 60 * 1000; }
  rec.count += 1;
  attempts.set(ip, rec);
  return rec.count <= 10;
}

app.use(express.json({ limit: '1mb' }));
app.set('trust proxy', 1);

// ---------- health ----------
app.get('/health', (_req, res) => res.json({ ok: true }));

// ---------- public: reader list signup ----------
app.post('/api/leads', (req, res) => {
  const { name, email, company } = req.body || {};
  if (company) return res.json({ ok: true }); // honeypot
  const clean = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }
  const leads = readJson('leads.json', []);
  if (!leads.some((l) => l.email === clean)) {
    leads.push({
      email: clean,
      name: String(name || '').trim().slice(0, 120),
      source: 'website',
      createdAt: new Date().toISOString(),
    });
    writeJson('leads.json', leads);
  }
  res.json({ ok: true });
});

// ---------- admin auth ----------
const LOGIN_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex,nofollow"/>
<title>Case File Access</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0a07;color:#f4ecdc;font-family:Georgia,'Times New Roman',serif}
.card{width:min(380px,90vw);padding:2.6rem 2.2rem;border:1px solid #c9a24b;background:#131009;text-align:center}
h1{margin:0 0 .3rem;font-size:1.25rem;letter-spacing:.3em;color:#debA6a;font-weight:500}
p{margin:0 0 1.6rem;color:#a08a60;font-size:.8rem;letter-spacing:.12em}
input{width:100%;box-sizing:border-box;padding:.85rem 1rem;margin-bottom:1rem;border:1px solid #3a2f1c;background:#0d0a07;color:#f4ecdc;font-size:1rem;letter-spacing:.08em}
input:focus{outline:1px solid #c9a24b}
button{width:100%;padding:.9rem;border:1px solid #c9a24b;background:linear-gradient(110deg,#81500d,#debA6a 55%,#b97815);color:#0d0a07;font-weight:700;letter-spacing:.18em;text-transform:uppercase;font-size:.75rem;cursor:pointer}
.err{color:#e08a7a;font-size:.8rem;min-height:1.1em;margin-top:.8rem}
</style></head><body><form class="card" method="post" action="/admin/login" onsubmit="return go(event)">
<h1>COSMIC COURT</h1><p>KINGDOM PUBLICATIONS · MARKETING STUDIO</p>
<input type="password" name="password" id="pw" placeholder="Access password" autofocus autocomplete="current-password"/>
<button type="submit">Enter the record</button><div class="err" id="err"></div></form>
<script>async function go(e){e.preventDefault();const r=await fetch('/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.getElementById('pw').value})});if(r.ok){location.href='/admin';}else{const j=await r.json().catch(()=>({}));document.getElementById('err').textContent=j.error||'Access denied.';}}</script>
</body></html>`;

app.post('/admin/login', (req, res) => {
  const ip = req.ip || 'unknown';
  if (!allowAttempt(ip)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: 'Admin password is not configured yet.' });
  const given = String((req.body || {}).password || '');
  const a = Buffer.from(given);
  const b = Buffer.from(ADMIN_PASSWORD);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) return res.status(401).json({ error: 'Access denied.' });
  res.setHeader('Set-Cookie', `cc_admin=${makeToken()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_HOURS * 3600}`);
  res.json({ ok: true });
});

app.post('/admin/logout', (_req, res) => {
  res.setHeader('Set-Cookie', 'cc_admin=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  res.json({ ok: true });
});

app.get('/admin', (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!isAuthed(req)) return res.type('html').send(LOGIN_PAGE);
  res.sendFile(path.join(__dirname, 'private', 'admin.html'));
});

function requireAuth(req, res, next) {
  if (!isAuthed(req)) return res.status(401).json({ error: 'Not signed in' });
  next();
}

// ---------- admin APIs ----------
app.get('/api/admin/overview', requireAuth, (_req, res) => {
  const leads = readJson('leads.json', []);
  const schedule = readJson('schedule.json', []);
  res.json({
    leads: leads.length,
    scheduled: schedule.filter((s) => s.status === 'scheduled').length,
    posted: schedule.filter((s) => s.status === 'posted').length,
    failed: schedule.filter((s) => s.status === 'failed').length,
    socialConfigured: Boolean(uploadPost.apiKey()),
    profile: uploadPost.profileName(),
    siteUrl: SITE_URL,
    dataDir: DATA_DIR,
  });
});

app.get('/api/admin/content', requireAuth, (_req, res) => {
  let captions = {};
  try { captions = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets', 'marketing', 'captions.json'), 'utf8')); } catch {}
  const schedule = readJson('schedule.json', []);
  const items = Object.entries(captions).map(([id, c]) => ({
    id,
    ...c,
    imageUrl: `${SITE_URL}/${c.image}`,
    history: schedule.filter((s) => s.contentId === id).map((s) => ({ status: s.status, at: s.postAt, platforms: s.platforms })),
  }));
  res.json({ items });
});

app.get('/api/admin/leads', requireAuth, (_req, res) => {
  res.json({ leads: readJson('leads.json', []).slice().reverse() });
});

app.get('/api/admin/leads.csv', requireAuth, (_req, res) => {
  const leads = readJson('leads.json', []);
  const rows = [['email', 'name', 'source', 'createdAt']]
    .concat(leads.map((l) => [l.email, l.name || '', l.source || '', l.createdAt || '']));
  const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  res.setHeader('Content-Disposition', 'attachment; filename="cosmic-court-leads.csv"');
  res.type('text/csv').send(csv);
});

app.get('/api/admin/schedule', requireAuth, (_req, res) => {
  const schedule = readJson('schedule.json', []);
  res.json({ schedule: schedule.slice().sort((a, b) => String(a.postAt).localeCompare(String(b.postAt))) });
});

app.post('/api/admin/schedule', requireAuth, (req, res) => {
  const { contentId, image, caption, platforms, postAt, mediaType } = req.body || {};
  if (!caption || !Array.isArray(platforms) || !platforms.length || !postAt) {
    return res.status(400).json({ error: 'caption, platforms and postAt are required' });
  }
  const when = new Date(postAt);
  if (Number.isNaN(when.getTime())) return res.status(400).json({ error: 'postAt is not a valid date' });
  const schedule = readJson('schedule.json', []);
  const item = {
    id: crypto.randomUUID(),
    contentId: contentId || null,
    image: image || null,
    mediaType: mediaType || (image ? 'photo' : 'text'),
    caption,
    platforms,
    postAt: when.toISOString(),
    status: 'scheduled',
    createdAt: new Date().toISOString(),
  };
  schedule.push(item);
  writeJson('schedule.json', schedule);
  res.json({ ok: true, item });
});

// Auto-queue: schedule every not-yet-used content card daily at a given local hour
app.post('/api/admin/schedule/auto', requireAuth, (req, res) => {
  const { platforms, hourUtc = 16, startDate } = req.body || {}; // 16:00 UTC = 9am PT
  if (!Array.isArray(platforms) || !platforms.length) return res.status(400).json({ error: 'platforms required' });
  let captions = {};
  try { captions = JSON.parse(fs.readFileSync(path.join(__dirname, 'assets', 'marketing', 'captions.json'), 'utf8')); } catch {}
  const schedule = readJson('schedule.json', []);
  const used = new Set(schedule.filter((s) => s.status !== 'failed').map((s) => s.contentId));
  const pending = Object.entries(captions).filter(([id]) => !used.has(id));
  const start = startDate ? new Date(startDate) : new Date(Date.now() + 24 * 3600 * 1000);
  let day = 0;
  const added = [];
  for (const [id, c] of pending) {
    const when = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + day, hourUtc, 0, 0));
    const item = {
      id: crypto.randomUUID(), contentId: id, image: c.image, mediaType: 'photo',
      caption: c.caption, platforms, postAt: when.toISOString(),
      status: 'scheduled', createdAt: new Date().toISOString(),
    };
    schedule.push(item); added.push(item); day += 1;
  }
  writeJson('schedule.json', schedule);
  res.json({ ok: true, added: added.length });
});

app.delete('/api/admin/schedule/:id', requireAuth, (req, res) => {
  const schedule = readJson('schedule.json', []);
  const next = schedule.filter((s) => !(s.id === req.params.id && s.status === 'scheduled'));
  writeJson('schedule.json', next);
  res.json({ ok: true, removed: schedule.length - next.length });
});

app.post('/api/admin/post-now', requireAuth, async (req, res) => {
  const { image, caption, platforms, mediaType } = req.body || {};
  if (!caption || !Array.isArray(platforms) || !platforms.length) {
    return res.status(400).json({ error: 'caption and platforms are required' });
  }
  try {
    const result = await publish({ image, caption, platforms, mediaType });
    const schedule = readJson('schedule.json', []);
    schedule.push({
      id: crypto.randomUUID(), contentId: (req.body || {}).contentId || null,
      image: image || null, mediaType: mediaType || 'photo', caption, platforms,
      postAt: new Date().toISOString(), status: 'posted',
      result: summarize(result), createdAt: new Date().toISOString(),
    });
    writeJson('schedule.json', schedule);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(err.code === 'NO_KEY' ? 409 : 502).json({ error: String(err.message || err) });
  }
});

// ---------- social connection ----------
app.get('/api/admin/social', requireAuth, async (_req, res) => {
  if (!uploadPost.apiKey()) {
    return res.json({ configured: false, profile: uploadPost.profileName() });
  }
  try {
    const profiles = await uploadPost.listProfiles();
    res.json({ configured: true, profile: uploadPost.profileName(), profiles });
  } catch (err) {
    res.json({ configured: true, profile: uploadPost.profileName(), error: String(err.message || err) });
  }
});

app.post('/api/admin/social/profile', requireAuth, async (req, res) => {
  try {
    const username = String((req.body || {}).username || uploadPost.profileName());
    const out = await uploadPost.createProfile(username);
    res.json({ ok: true, out });
  } catch (err) {
    res.status(err.code === 'NO_KEY' ? 409 : 502).json({ error: String(err.message || err) });
  }
});

app.post('/api/admin/social/connect', requireAuth, async (req, res) => {
  try {
    const username = String((req.body || {}).username || uploadPost.profileName());
    const out = await uploadPost.generateConnectUrl(username, `${SITE_URL}/?connected=1`);
    res.json({ ok: true, out });
  } catch (err) {
    res.status(err.code === 'NO_KEY' ? 409 : 502).json({ error: String(err.message || err) });
  }
});

// ---------- publishing + scheduler ----------
function summarize(result) {
  try { return JSON.stringify(result).slice(0, 500); } catch { return String(result).slice(0, 500); }
}

async function publish({ image, caption, platforms, mediaType }) {
  const toUrl = (p) => (p && /^https?:\/\//.test(p) ? p : `${SITE_URL}/${String(p || '').replace(/^\//, '')}`);
  if (mediaType === 'video' && image) {
    return uploadPost.postVideo({ videoUrl: toUrl(image), caption, platforms });
  }
  if (image) {
    return uploadPost.postPhotos({ imageUrls: [toUrl(image)], caption, platforms });
  }
  return uploadPost.postText({ caption, platforms });
}

let ticking = false;
async function schedulerTick() {
  if (ticking) return;
  ticking = true;
  try {
    const schedule = readJson('schedule.json', []);
    const now = Date.now();
    let changed = false;
    for (const item of schedule) {
      if (item.status !== 'scheduled') continue;
      if (new Date(item.postAt).getTime() > now) continue;
      try {
        const result = await publish(item);
        item.status = 'posted';
        item.result = summarize(result);
        item.postedAt = new Date().toISOString();
      } catch (err) {
        item.status = 'failed';
        item.error = String(err.message || err).slice(0, 500);
      }
      changed = true;
    }
    if (changed) writeJson('schedule.json', schedule);
  } catch (err) {
    console.error('scheduler error', err);
  } finally {
    ticking = false;
  }
}
setInterval(schedulerTick, 60 * 1000);

// ---------- static site ----------
const BLOCKED = ['/private', '/data', '/server.js', '/package.json', '/package-lock.json', '/lib', '/.git', '/node_modules'];
app.use((req, res, next) => {
  if (BLOCKED.some((p) => req.path === p || req.path.startsWith(`${p}/`))) return res.status(404).end();
  next();
});
app.use(express.static(path.join(__dirname), { extensions: ['html'] }));

app.listen(PORT, () => {
  console.log(`Cosmic Court site + Marketing Studio on :${PORT} (data: ${DATA_DIR})`);
});
