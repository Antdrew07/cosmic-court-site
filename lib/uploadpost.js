// Upload-Post API wrapper for the Marketing Studio.
// Requires UPLOAD_POST_API_KEY in the environment (set in Railway Variables).
const API_BASE = 'https://api.upload-post.com/api';

function apiKey() {
  return (process.env.UPLOAD_POST_API_KEY || '').trim();
}

function profileName() {
  return (process.env.UPLOAD_POST_PROFILE || 'iesha-golden').trim();
}

async function request(method, endpoint, body, isForm) {
  const key = apiKey();
  if (!key) {
    const err = new Error('UPLOAD_POST_API_KEY is not configured');
    err.code = 'NO_KEY';
    throw err;
  }
  const headers = { Authorization: `Apikey ${key}` };
  let payload = body;
  if (body && !isForm) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${endpoint}`, { method, headers, body: payload });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`Upload-Post ${res.status}: ${text.slice(0, 400)}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// ---- Profiles ----
async function listProfiles() {
  return request('GET', '/uploadposts/users');
}

async function createProfile(username) {
  return request('POST', '/uploadposts/users', { username });
}

// Generate a connect URL the author can open to OAuth her own socials
async function generateConnectUrl(username, redirectUrl, platforms) {
  const body = { username };
  if (redirectUrl) body.redirect_url = redirectUrl;
  if (platforms && platforms.length) body.platforms = platforms;
  return request('POST', '/uploadposts/users/generate-jwt', body);
}

// ---- Posting ----
// Photos: imageUrls are public https URLs; platforms like ['instagram','facebook']
async function postPhotos({ imageUrls, caption, platforms, user }) {
  const form = new FormData();
  form.append('user', user || profileName());
  (platforms || []).forEach((p) => form.append('platform[]', p));
  (imageUrls || []).forEach((u) => form.append('photos[]', u));
  form.append('title', caption || '');
  form.append('caption', caption || '');
  return request('POST', '/upload_photos', form, true);
}

async function postVideo({ videoUrl, caption, platforms, user }) {
  const form = new FormData();
  form.append('user', user || profileName());
  (platforms || []).forEach((p) => form.append('platform[]', p));
  form.append('video', videoUrl);
  form.append('title', caption || '');
  return request('POST', '/upload', form, true);
}

async function postText({ caption, platforms, user }) {
  const form = new FormData();
  form.append('user', user || profileName());
  (platforms || []).forEach((p) => form.append('platform[]', p));
  form.append('title', caption || '');
  return request('POST', '/upload_text', form, true);
}

module.exports = {
  apiKey,
  profileName,
  listProfiles,
  createProfile,
  generateConnectUrl,
  postPhotos,
  postVideo,
  postText,
};
