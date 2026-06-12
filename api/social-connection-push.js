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
    const sourceUid = String(decoded?.uid || '');
    if (!sourceUid) return res.status(401).json({ error: 'invalid_token' });

    const targetUid = String(req.body?.targetUid || '').trim();
    if (!targetUid || targetUid === sourceUid) return res.status(400).json({ error: 'invalid_target' });

    const sourceName = String(req.body?.sourceName || 'Companheiro').trim() || 'Companheiro';

    const db = getFirestoreAdmin();
    const targetRef = db.collection('users').doc(targetUid);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) return res.status(200).json({ ok: true, sent: 0, reason: 'target_not_found' });

    const targetState = targetSnap.data() || {};
    if (!targetState.settings?.notificationsEnabled) {
      return res.status(200).json({ ok: true, sent: 0, reason: 'notifications_disabled' });
    }

    const subsSnap = await targetRef.collection('push_subscriptions').get();
    if (subsSnap.empty) return res.status(200).json({ ok: true, sent: 0, reason: 'no_subscriptions' });

    let sent = 0;
    let removed = 0;
    for (const subDoc of subsSnap.docs) {
      const data = subDoc.data() || {};
      const subscription = { endpoint: data.endpoint, keys: data.keys || {} };
      if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) continue;
      try {
        await sendWebPush(subscription, {
          title: 'Life OS - Area Social',
          body: `${sourceName} entrou para as suas conexoes.`,
          tag: 'social_connection_created',
          url: '/?view=social'
        });
        sent += 1;
      } catch (err) {
        const code = Number(err?.statusCode || 0);
        if (code === 404 || code === 410) {
          await subDoc.ref.delete();
          removed += 1;
        }
      }
    }

    return res.status(200).json({ ok: true, sent, removed });
  } catch (error) {
    return res.status(500).json({ error: 'social_connection_push_error', detail: String(error?.message || error) });
  }
};
