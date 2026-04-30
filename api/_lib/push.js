const webpush = require('web-push');

let configured = false;

function ensureVapidConfigured() {
  if (configured) return;
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY || '';
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY || '';
  const subject = process.env.WEB_PUSH_SUBJECT || 'mailto:admin@example.com';
  if (!publicKey || !privateKey) throw new Error('web_push_keys_missing');
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

async function sendWebPush(subscription, payloadObj) {
  ensureVapidConfigured();
  const payload = JSON.stringify(payloadObj || {});
  return webpush.sendNotification(subscription, payload);
}

module.exports = { ensureVapidConfigured, sendWebPush };
