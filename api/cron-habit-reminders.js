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

function normalizeHHMM(hhmm) {
  const [hhRaw, mmRaw] = String(hhmm || '').slice(0, 5).split(':');
  const hh = Number(hhRaw);
  const mm = Number(mmRaw);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return '';
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function minutesToHHMM(minutes) {
  const safe = Math.max(0, Math.min(1439, Number(minutes) || 0));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function getReminderTimes(habit) {
  const single = normalizeHHMM(habit?.reminderTime || '');
  if (!habit?.reminderIntervalEnabled) return single ? [single] : [];

  const startM = hhmmToMinutes(habit.reminderWindowStart);
  const endM = hhmmToMinutes(habit.reminderWindowEnd);
  const step = Math.max(5, Number(habit.reminderIntervalMin || 60));
  if (startM == null || endM == null || endM < startM) return single ? [single] : [];

  const times = [];
  for (let cursor = startM; cursor <= endM; cursor += step) {
    times.push(minutesToHHMM(cursor));
  }
  if (!times.length && single) times.push(single);
  return times;
}

function getDueHabitItems(habits, nowMinutes, todayDow, toleranceMin) {
  return habits.map((h) => {
    if (!h || !h.reminderEnabled) return null;
    if (h.frequency === 'specific' && Array.isArray(h.specificDays) && h.specificDays.length > 0) {
      if (!h.specificDays.map(String).includes(todayDow)) return null;
    }

    const dueTimes = getReminderTimes(h)
      .map((reminderHHMM) => {
        const reminderMinutes = hhmmToMinutes(reminderHHMM);
        if (nowMinutes == null || reminderMinutes == null || !reminderHHMM) return null;
        const diff = nowMinutes - reminderMinutes;
        if (diff < 0 || diff > toleranceMin) return null;
        return { reminderHHMM, diff };
      })
      .filter(Boolean)
      .sort((a, b) => a.diff - b.diff);

    // If the scheduler was delayed, send the most recent due slot only.
    if (!dueTimes.length) return null;
    return { habit: h, reminderHHMM: dueTimes[0].reminderHHMM };
  }).filter(Boolean);
}

function getDueDeepWorkItem(state, nowTs, toleranceMs) {
  const dw = state?.deepWork || {};
  if (!dw || !dw.isRunning || dw.isPaused) return null;
  const mode = dw.mode === 'break' ? 'break' : 'focus';
  const deadlineAtMs = Number(dw.deadlineAtMs || 0);
  if (!Number.isFinite(deadlineAtMs) || deadlineAtMs <= 0) return null;
  const diff = nowTs - deadlineAtMs;
  if (diff < 0 || diff > toleranceMs) return null;
  return {
    mode,
    deadlineAtMs,
    microId: String(dw.microId || ''),
    intention: String(dw.intention || '')
  };
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
    const toleranceMin = Math.max(1, Number(process.env.CRON_TOLERANCE_MINUTES || 15));
    const now = nowInTimeZoneParts(tz);
    const todayDow = weekdayToIndex(now.weekdayShort);
    const nowMinutes = hhmmToMinutes(now.hhmm);
    const nowTs = Date.now();
    const toleranceMs = toleranceMin * 60 * 1000;
    const usersSnap = await db.collection('users').get();

    let checkedUsers = 0;
    let dueHabits = 0;
    let dueDeepWork = 0;
    let skippedNoSubs = 0;
    let sent = 0;
    let removed = 0;

    for (const userDoc of usersSnap.docs) {
      const stateRef = userDoc.ref;
      const state = userDoc.data() || {};
      if (!state.profile && !state.settings && !state.habits) continue;
      checkedUsers += 1;

      const settings = state.settings || {};
      if (!settings.notificationsEnabled) continue;
      const habits = Array.isArray(state.habits) ? state.habits : [];
      const dueItems = habits.length ? getDueHabitItems(habits, nowMinutes, todayDow, toleranceMin) : [];
      const dueDeepWorkItem = getDueDeepWorkItem(state, nowTs, toleranceMs);
      if (!dueItems.length && !dueDeepWorkItem) continue;
      dueHabits += dueItems.length;
      if (dueDeepWorkItem) dueDeepWork += 1;

      const subsSnap = await stateRef.collection('push_subscriptions').get();
      if (subsSnap.empty) {
        skippedNoSubs += 1;
        continue;
      }

      const sentLogRef = stateRef.collection('push_logs');
      for (const item of dueItems) {
        const habit = item.habit;
        const dedupeId = `${now.dateKey}_${habit.id || habit.title || 'habit'}_${item.reminderHHMM}`.replace(/[^\w-]/g, '_');
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
              body: `Lembrete de habito: ${habit.title || 'Seu habito'}`,
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
          scheduledHHMM: item.reminderHHMM,
          sentAtHHMM: now.hhmm,
          dateKey: now.dateKey,
          type: 'habit',
          createdAt: Date.now()
        }, { merge: false });
      }

      if (dueDeepWorkItem) {
        const dedupeId = `deepwork_${dueDeepWorkItem.mode}_${Math.round(dueDeepWorkItem.deadlineAtMs)}`.replace(/[^\w-]/g, '_');
        const dedupeRef = sentLogRef.doc(dedupeId);
        const dedupeSnap = await dedupeRef.get();
        if (!dedupeSnap.exists) {
          const payload = dueDeepWorkItem.mode === 'focus'
            ? {
                title: 'Life OS - Foco',
                body: 'Bloco de foco concluido. Abra o app para iniciar a pausa e concluir a micro.',
                tag: 'lifeos-focus-ended',
                url: '/?view=foco'
              }
            : {
                title: 'Life OS - Foco',
                body: 'Pausa concluida. Voce esta pronto para o proximo bloco.',
                tag: 'lifeos-break-ended',
                url: '/?view=foco'
              };

          for (const subDoc of subsSnap.docs) {
            const data = subDoc.data() || {};
            const subscription = { endpoint: data.endpoint, keys: data.keys || {} };
            if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) continue;
            try {
              await sendWebPush(subscription, payload);
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
            type: 'deepwork',
            mode: dueDeepWorkItem.mode,
            microId: dueDeepWorkItem.microId,
            intention: dueDeepWorkItem.intention,
            deadlineAtMs: dueDeepWorkItem.deadlineAtMs,
            sentAtHHMM: now.hhmm,
            dateKey: now.dateKey,
            createdAt: Date.now()
          }, { merge: false });
        }
      }
    }

    return res.status(200).json({
      ok: true,
      sent,
      removed,
      checkedUsers,
      dueHabits,
      dueDeepWork,
      skippedNoSubs,
      hhmm: now.hhmm,
      dateKey: now.dateKey,
      toleranceMin
    });
  } catch (error) {
    return res.status(500).json({ error: 'cron_habit_reminders_error', detail: String(error?.message || error) });
  }
};
