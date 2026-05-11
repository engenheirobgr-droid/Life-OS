const { getFirestoreAdmin, getAuthAdmin } = require('./_lib/firebaseAdmin');
const { sendWebPush } = require('./_lib/push');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'missing_bearer' });
    const idToken = authHeader.slice(7).trim();
    if (!idToken) return res.status(401).json({ error: 'missing_token' });

    const authAdmin = getAuthAdmin();
    const decoded = await authAdmin.verifyIdToken(idToken);
    const uid = String(decoded?.uid || '');
    if (!uid) return res.status(401).json({ error: 'invalid_token' });

    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(400).json({ error: 'missing_body' });

    const title = String(req.body?.title || 'Life OS').trim() || 'Life OS';
    const tag = String(req.body?.tag || 'lifeos-push').trim() || 'lifeos-push';
    const url = String(req.body?.url || '/').trim() || '/';
    const requireInteraction = !!req.body?.requireInteraction;
    const dedupeIdRaw = String(req.body?.dedupeId || '').trim();
    const dedupeId = (dedupeIdRaw || `evt_${Date.now()}`).replace(/[^\w-]/g, '_').slice(0, 120);

    const db = getFirestoreAdmin();
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(200).json({ ok: true, sent: 0, reason: 'user_not_found' });

    const state = userSnap.data() || {};
    if (!state.settings?.notificationsEnabled) {
      return res.status(200).json({ ok: true, sent: 0, reason: 'notifications_disabled' });
    }

    const dedupeRef = userRef.collection('push_logs').doc(`internal_${dedupeId}`);
    const dedupeSnap = await dedupeRef.get();
    if (dedupeSnap.exists) {
      return res.status(200).json({ ok: true, sent: 0, deduped: true });
    }

    const subsSnap = await userRef.collection('push_subscriptions').get();
    if (subsSnap.empty) return res.status(200).json({ ok: true, sent: 0, reason: 'no_subscriptions' });

    let sent = 0;
    let removed = 0;
    for (const subDoc of subsSnap.docs) {
      const data = subDoc.data() || {};
      const subscription = { endpoint: data.endpoint, keys: data.keys || {} };
      if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) continue;
      try {
        await sendWebPush(subscription, { title, body, tag, url, requireInteraction });
        sent += 1;
      } catch (err) {
        const code = Number(err?.statusCode || 0);
        if (code === 404 || code === 410) {
          await subDoc.ref.delete();
          removed += 1;
        }
      }
    }

    await dedupeRef.set({
      title,
      body,
      tag,
      url,
      dedupeId,
      sent,
      removed,
      createdAt: Date.now()
    }, { merge: false });

    return res.status(200).json({ ok: true, sent, removed });
  } catch (error) {
    return res.status(500).json({ error: 'internal_event_push_error', detail: String(error?.message || error) });
  }
};
