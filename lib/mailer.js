// Resend mailer + branded email templates for the Cosmic Court funnel.
// Requires RESEND_API_KEY in the environment; without it, sending is skipped gracefully.
const crypto = require('crypto');

const SITE_URL = (process.env.SITE_URL || 'https://www.cosmiccourtbook.com').replace(/\/$/, '');
const FROM = process.env.MAIL_FROM || 'Iesha D. Golden <hello@cosmiccourtbook.com>';
const REPLY_TO = process.env.MAIL_REPLY_TO || '';
const AMAZON = 'https://a.co/d/03QthpNm';
const BN = 'https://www.barnesandnoble.com/w/cosmic-court-iesha-golden/1151331761?ean=9798995775324';

function apiKey() { return (process.env.RESEND_API_KEY || '').trim(); }

function unsubToken(email) {
  const secret = (process.env.SESSION_SECRET || 'cc') + ':unsub';
  return crypto.createHmac('sha256', secret).update(String(email).toLowerCase()).digest('hex').slice(0, 24);
}
function unsubUrl(email) {
  return `${SITE_URL}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${unsubToken(email)}`;
}

function layout(inner, email) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0d0a07;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;font-family:Georgia,'Times New Roman',serif;">
    <div style="text-align:center;padding:18px 0 22px;">
      <div style="color:#deba6a;font-size:20px;letter-spacing:6px;">COSMIC COURT</div>
      <div style="color:#a08a60;font-size:11px;letter-spacing:4px;margin-top:4px;">THE LEGALIST &nbsp;&middot;&nbsp; IESHA D. GOLDEN</div>
    </div>
    <div style="background:#fffcf5;border:1px solid #c9a24b;padding:30px 28px;color:#201a12;font-size:16px;line-height:1.6;">
      ${inner}
    </div>
    <div style="text-align:center;padding:16px 10px 4px;">
      <a href="https://www.instagram.com/cosmiccourtthelegalist" style="color:#deba6a;font-size:13px;text-decoration:none;letter-spacing:1px;">Follow the case files on Instagram &rarr; @cosmiccourtthelegalist</a>
    </div>
    <div style="text-align:center;padding:14px 10px;color:#8a7550;font-size:11px;line-height:1.7;">
      Kingdom Publications &middot; Vista, California<br/>
      You are receiving this because you requested the free chapter at cosmiccourtbook.com.<br/>
      <a href="${unsubUrl(email)}" style="color:#a08a60;">Unsubscribe</a>
    </div>
  </div></body></html>`;
}

function button(href, label) {
  return `<div style="text-align:center;margin:26px 0;"><a href="${href}" style="display:inline-block;background:#b97815;color:#0d0a07;text-decoration:none;font-weight:bold;letter-spacing:2px;font-size:13px;padding:14px 26px;border:1px solid #81500d;">${label.toUpperCase()}</a></div>`;
}

const TEMPLATES = {
  welcome: {
    delayHours: 0,
    subject: 'Your free chapter is here. The court is in session.',
    html(lead) {
      const name = lead.name ? ` ${lead.name}` : '';
      return layout(`
        <p>Hi${name},</p>
        <p>Here is your free chapter of <b>Cosmic Court: The Legalist</b>. You are about to hear the enemy tell on himself: how accusations are filed, how prayers rise as evidence, and why the Advocate has never lost a case.</p>
        ${button(`${SITE_URL}/assets/cosmic-court-free-chapter.pdf`, 'Download your chapter')}
        <p>Read it with spiritual eyes. This story is fiction, but the battle behind it is not, and neither is the victory.</p>
        <p style="text-align:center;background:#f7efdc;border:1px solid #c9a24b;padding:14px 16px;font-size:15px;">Cannot wait to see how the case unfolds? The full paperback is ready now on <a href="${AMAZON}" style="color:#81500d;font-weight:bold;">Amazon</a> or <a href="${BN}" style="color:#81500d;font-weight:bold;">Barnes &amp; Noble</a>.</p>
        <p>In a couple of days I will share why I wrote this book. It started in the ICU.</p>
        <p style="margin-bottom:0;">Grace and peace,<br/><i>Iesha D. Golden</i></p>`, lead.email);
    },
  },
  story: {
    delayHours: 48,
    subject: 'It started in the ICU',
    html(lead) {
      const name = lead.name ? ` ${lead.name}` : '';
      return layout(`
        <p>Hi${name},</p>
        <p>Before I was an author, I was a critical care nurse practitioner. I spent over a decade watching battles that machines could measure and battles they could not.</p>
        <p>In the ICU you learn that crises rarely come from nowhere. There is a history, a chart, a chain of events. The spirit realm works the same way. The enemy does not play fair, but he does play legal: he looks for agreement, access, and right.</p>
        <p>That is why I wrote Cosmic Court from the Accuser's point of view. When you hear how he builds a case, you learn how to close every door he uses, and you learn who stands as your Advocate when he files anyway.</p>
        <p>If the free chapter gripped you, the full book goes much deeper: the case files, the Marine Kingdom, the counter-suit built on 21 days of prayer, and the blood that speaks a better word.</p>
        ${button(AMAZON, 'Get the book on Amazon')}
        <p style="text-align:center;font-size:14px;">Prefer Barnes &amp; Noble? <a href="${BN}" style="color:#81500d;">Get it here</a>.</p>
        <p style="margin-bottom:0;">Grace and peace,<br/><i>Iesha D. Golden</i></p>`, lead.email);
    },
  },
  invitation: {
    delayHours: 120,
    subject: 'The court is waiting on your verdict',
    html(lead) {
      const name = lead.name ? ` ${lead.name}` : '';
      return layout(`
        <p>Hi${name},</p>
        <p>Quick question: did you finish the free chapter?</p>
        <p>If you did, you already know the Legalist does not lose on evidence. The rest of the book shows the one way his cases fall apart, told through believers who learned to answer accusation with advocacy: Jessica's 21 days of warfare prayer, a pastor named Ben, and a courtroom where every prayer you have ever prayed is on the record.</p>
        <p>The paperback is $24.99 and readers are finishing it in a weekend.</p>
        ${button(AMAZON, 'Order your copy today')}
        <p style="text-align:center;font-size:14px;">Also at <a href="${BN}" style="color:#81500d;">Barnes &amp; Noble</a>.</p>
        <p>And if you have already read it, it would mean the world to Iesha if you left an honest review on Amazon. Reviews are how this message reaches the next reader.</p>
        <p style="margin-bottom:0;">Grace and peace,<br/><i>The Kingdom Publications team</i></p>`, lead.email);
    },
  },
};

async function send({ to, subject, html }) {
  const key = apiKey();
  if (!key) { const e = new Error('RESEND_API_KEY not set'); e.code = 'NO_KEY'; throw e; }
  const body = { from: FROM, to: [to], subject, html };
  if (REPLY_TO) body.reply_to = REPLY_TO;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Resend ${res.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

module.exports = { apiKey, send, TEMPLATES, unsubToken, SITE_URL };
