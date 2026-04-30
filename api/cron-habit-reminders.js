const { getFirestoreAdmin } = require('./_lib/firebaseAdmin');
const { sendWebPush } = require('./_lib/push');

function nowInTimeZoneParts(tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short'
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return {
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    hhmm: `${get('hour')}:${get('minute')}`,
    weekdayShort: get('weekday')
  };
}

function weekdayToIndex(weekdayShort) {
  const map = { Sun: '0', Mon: '1', Tue: '2', Wed: '3', Thu: '4', Fri: '5', Sat: '6' };
  return map[weekdayShort] || '0';
}

function hhmmToMinutes(hhmm) {
  const [hhRaw, mmRaw] = String(hhmm || '').slice(0, 5).split(':');
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  return hh * 60 + mm;
}

module.exports = async function handler(req, res) {
  try {
    const authHeader = req.headers.authorization || '';
    const cronSecret = process.env.CRON_SECRET || '';
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const db = getFirestoreAdmin();
    const tz = process.env.DEFAULT_TZ || 'America/Bahia';
    const toleranceMin = Math.max(1, Number(process.env.CRON_TOLERANCE_MINUTES || 6));
    const now = nowInTimeZoneParts(tz);
    const todayDow = weekdayToIndex(now.weekdayShort);
    const nowMinutes = hhmmToMinutes(now.hhmm);

    const stateRef = db.collection('users').doc('meu-sistema-vida');
    const stateSnap = await stateRef.get();
    if (!stateSnap.exists) return res.status(200).json({ ok: true, sent: 0, reason: 'no_state' });

    const state = stateSnap.data() || {};
    const settings = state.settings || {};
    if (!settings.notificationsEnabled) return res.status(200).json({ ok: true, sent: 0, reason: 'notifications_disabled' });
    const habits = Array.isArray(state.habits) ? state.habits : [];
    if (!habits.length) return res.status(200).json({ ok: true, sent: 0, reason: 'no_habits' });

    const dueHabits = habits.filter((h) => {
      if (!h || !h.reminderEnabled || !h.reminderTime) return false;
      const reminderMinutes = hhmmToMinutes(h.reminderTime);
      if (nowMinutes == null || reminderMinutes == null) return false;
      const diff = nowMinutes - reminderMinutes;
      if (diff < 0 || diff > toleranceMin) return false;
      if (h.frequency === 'specific' && Array.isArray(h.specificDays) && h.specificDays.length > 0) {
        return h.specificDays.map(String).includes(todayDow);
      }
      return true;
    });
    if (!dueHabits.length) return res.status(200).json({ ok: true, sent: 0, reason: 'no_due_habits' });

    const subsSnap = await stateRef.collection('push_subscriptions').get();
    if (subsSnap.empty) return res.status(200).json({ ok: true, sent: 0, reason: 'no_subscriptions' });

    let sent = 0;
    let removed = 0;
    const sentLogRef = stateRef.collection('push_logs');
    for (const habit of dueHabits) {
      const dedupeId = `${now.dateKey}_${habit.id || habit.title || 'habit'}_${now.hhmm}`.replace(/[^\w-]/g, '_');
      const dedupeRef = sentLogRef.doc(dedupeId);
      const dedupeSnap = await dedupeRef.get();
      if (dedupeSnap.exists) continue;

      for (const subDoc of subsSnap.docs) {
        const data = subDoc.data() || {};
        const subscription = { endpoint: data.endpoint, keys: data.keys || {} };
        if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) continue;
        try {
          await sendWebPush(subscription, {
            title: 'Life OS',
            body: `Lembrete de hábito: ${habit.title || 'Seu hábito'}`,
            tag: `habit_${habit.id || 'default'}`,
            url: '/'
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
      await dedupeRef.set({
        habitId: habit.id || '',
        title: habit.title || '',
        hhmm: now.hhmm,
        dateKey: now.dateKey,
        createdAt: Date.now()
      }, { merge: false });
    }

    return res.status(200).json({ ok: true, sent, removed, dueHabits: dueHabits.length, hhmm: now.hhmm, dateKey: now.dateKey });
  } catch (error) {
    return res.status(500).json({ error: 'cron_habit_reminders_error', detail: String(error?.message || error) });
  }
};
