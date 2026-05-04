const { getFirestoreAdmin } = require('./_lib/firebaseAdmin');
const { sendWebPush } = require('./_lib/push');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    const adminKey = process.env.LIFEOS_ADMIN_API_KEY || '';
    const provided = req.headers['x-lifeos-admin-key'] || '';
    if (!adminKey || provided !== adminKey) return res.status(401).json({ error: 'unauthorized' });

    const db = getFirestoreAdmin();
    const usersSnap = await db.collection('users').get();
    let sent = 0;
    let removed = 0;
    let checkedUsers = 0;
    let subscriptions = 0;
    const now = Date.now();

    for (const userDoc of usersSnap.docs) {
      const state = userDoc.data() || {};
      if (!state.profile && !state.settings && !state.habits) continue;
      checkedUsers += 1;

      const subsSnap = await userDoc.ref.collection('push_subscriptions').get();
      if (subsSnap.empty) continue;
      subscriptions += subsSnap.size;

      for (const subDoc of subsSnap.docs) {
        const data = subDoc.data() || {};
        const subscription = { endpoint: data.endpoint, keys: data.keys || {} };
        if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) continue;
        try {
          await sendWebPush(subscription, {
            title: 'Life OS',
            body: 'Teste de notificacao push funcionando.',
            tag: 'lifeos-push-test',
            url: '/'
          });
          sent += 1;
          await subDoc.ref.set({ lastSentAt: now }, { merge: true });
        } catch (err) {
          const code = Number(err?.statusCode || 0);
          if (code === 404 || code === 410) {
            await subDoc.ref.delete();
            removed += 1;
          }
        }
      }
    }

    return res.status(200).json({ ok: true, sent, removed, checkedUsers, subscriptions });
  } catch (error) {
    return res.status(500).json({ error: 'push_test_error', detail: String(error?.message || error) });
  }
};
