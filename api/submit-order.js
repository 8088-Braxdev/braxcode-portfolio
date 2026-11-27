const { createClient } = require('@supabase/supabase-js');

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const ipHits = new Map();

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  return req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : 'unknown';
}

function rateLimited(ip) {
  const now = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
    ipHits.set(ip, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) return true;
  return false;
}

function trimStr(v) {
  return typeof v === 'string' ? v.trim() : '';
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const ip = getClientIp(req);
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Too many submissions. Please try again later.' });
  }

  const body = req.body || {};

  if (body.website && String(body.website).trim() !== '') {
    return res.status(400).json({ error: 'Invalid submission' });
  }

  const project = trimStr(body.project);
  const contact = trimStr(body.contact);
  const scope = trimStr(body.scope);
  const budget = trimStr(body.budget);
  const timeline = trimStr(body.timeline);

  if (!project || project.length < 1 || project.length > 200) {
    return res.status(400).json({ error: 'Invalid project' });
  }
  if (!contact || contact.length < 1 || contact.length > 200) {
    return res.status(400).json({ error: 'Invalid contact' });
  }
  if (scope.length > 2000) {
    return res.status(400).json({ error: 'Invalid scope' });
  }
  if (budget.length > 100) {
    return res.status(400).json({ error: 'Invalid budget' });
  }
  if (timeline.length > 100) {
    return res.status(400).json({ error: 'Invalid timeline' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const sb = createClient(supabaseUrl, serviceRoleKey);

  const payload = {
    project,
    contact,
    scope: scope || null,
    budget: budget || null,
    timeline: timeline || null,
    status: 'new',
  };

  try {
    const { error } = await sb.from('orders').insert([payload]);
    if (error) {
      return res.status(500).json({ error: 'Failed to save order' });
    }
    return res.status(201).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save order' });
  }
};