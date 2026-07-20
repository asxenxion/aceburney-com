// Vercel serverless function: receives an intake submission and emails the brief to Ace via Resend.
// No npm dependency — uses global fetch (Node 18+) against Resend's REST API.
// Requires env var RESEND_API_KEY. Sends from onboarding@resend.dev (works to your own inbox);
// switch `from` to intake@aceburney.com once the domain is verified in Resend.

const TO = 'ascencion@aceburney.com';
const FROM = 'aceburney.com <onboarding@resend.dev>';

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function row(label, value) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return '';
  const v = Array.isArray(value) ? value.map(esc).join(' &middot; ') : esc(value).replace(/\n/g, '<br>');
  return (
    '<tr>' +
    '<td style="padding:9px 14px 9px 0;vertical-align:top;font:11px/1.4 monospace;letter-spacing:.08em;text-transform:uppercase;color:#8a857c;white-space:nowrap;">' + esc(label) + '</td>' +
    '<td style="padding:9px 0;vertical-align:top;font:14px/1.55 -apple-system,Segoe UI,Arial,sans-serif;color:#111;">' + v + '</td>' +
    '</tr>'
  );
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let d = req.body;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) { d = {}; } }
  if (!d || typeof d !== 'object') {
    // fallback: read the raw stream
    try {
      const raw = await new Promise((resolve) => { let s = ''; req.on('data', (c) => (s += c)); req.on('end', () => resolve(s)); });
      d = JSON.parse(raw || '{}');
    } catch (_) { d = {}; }
  }

  // spam honeypot — pretend success, send nothing
  if (d.honeypot) return res.status(200).json({ ok: true });

  const name = (d.name || '').trim();
  const email = (d.email || '').trim();
  const oneliner = (d.oneliner || '').trim();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !oneliner) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(500).json({ ok: false, error: 'Email not configured' });

  let needs = Array.isArray(d.services) ? d.services.slice() : [];
  if (d.notSure) needs.push('Not sure yet');

  const html =
    '<div style="background:#f4f2ee;padding:28px;">' +
    '<div style="max-width:620px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e5e1d8;">' +
    '<div style="background:#0D0D0D;color:#e8e6e1;padding:22px 24px;">' +
    '<div style="font:11px/1 monospace;letter-spacing:.24em;text-transform:uppercase;color:#8a857c;">New project brief</div>' +
    '<div style="font:700 22px/1.1 -apple-system,Segoe UI,Arial,sans-serif;margin-top:8px;">' + esc(oneliner) + '</div>' +
    '</div>' +
    '<table style="width:100%;border-collapse:collapse;padding:8px;margin:8px 24px;"><tbody>' +
    row('Who', [name, d.role, d.org].filter(Boolean).join(' · ')) +
    row('Email', email) +
    row('Big idea', d.bigidea) +
    row('For', d.audience) +
    row('Success', d.success) +
    row('Needs', needs) +
    row('Start with', d.priority ? '→ ' + d.priority : '') +
    row('Current site', [d.currentSite, d.builtOn].filter(Boolean).join(' · ')) +
    row('Has', d.existing) +
    row('References', d.references) +
    row('Timeline', d.timeline) +
    row('Who signs off', d.stakeholders) +
    row('Working with', d.workingWith) +
    row('Notes', d.notes) +
    '</tbody></table>' +
    '<div style="padding:14px 24px 22px;font:11px/1.5 monospace;color:#a29d94;border-top:1px solid #eee;">Submitted via aceburney.com/start</div>' +
    '</div></div>';

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject: '[New Brief] ' + name + ' — ' + oneliner.slice(0, 60),
        html,
      }),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => '');
      return res.status(502).json({ ok: false, error: 'Email send failed', detail: t.slice(0, 300) });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Send error' });
  }
};
