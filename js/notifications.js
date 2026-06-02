import { setDoc, deleteDoc } from './firebase.js';

export function attachNotifications(app) {
    Object.assign(app, {
isAppInForeground: function() {
        if (typeof document === 'undefined') return false;
        const isVisible = document.visibilityState === 'visible';
        const hasFocus = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
        return isVisible && hasFocus;
    },
getPushErrorMessage: function(error) {
        const msg = String(error?.message || error?.code || error || '');
        if (msg.includes('push_public_key') || msg.includes('Unexpected token') || msg.includes('api')) {
            return 'nao consegui conectar ao servico de push. Recarregue o app e tente novamente.';
        }
        if (msg.includes('permission') || msg.includes('denied')) {
            return 'permissao bloqueada no Android/Chrome. Reative em Informacoes do app > Notificacoes.';
        }
        if (msg.includes('PushManager') || msg.includes('serviceWorker')) {
            return 'este navegador nao oferece push para PWA neste contexto.';
        }
        if (msg.includes('auth_signed_out') || msg.includes('modo_local_sem_conta')) {
            return 'entre em uma conta para receber push em segundo plano.';
        }
        return msg || 'falha desconhecida ao registrar push.';
    },

isPushPermissionError: function(message) {
        const msg = String(message || '').toLowerCase();
        return msg.includes('permission') || msg.includes('permiss') || msg.includes('denied') || msg.includes('bloquead');
    },

getNotificationPermission: function() {
        if (typeof Notification === 'undefined') return 'unsupported';
        return Notification.permission || 'default';
    },

requestNotificationPermission: async function() {
        const current = this.getNotificationPermission();
        if (current === 'unsupported') throw new Error('notification_api_unavailable');
        if (current === 'granted') return 'granted';
        if (current === 'denied') throw new Error('notification_permission_denied');
        const result = await Notification.requestPermission();
        if (result !== 'granted') throw new Error('notification_permission_not_granted');
        return result;
    },

revalidateNotificationState: async function(options = {}) {
        this.ensureSettingsState();
        const register = options.register !== false;
        const rerender = options.rerender !== false;
        const force = !!options.force;
        const enabled = !!window.sistemaVidaState.settings.notificationsEnabled;
        const permission = this.getNotificationPermission();

        if (permission === 'granted' && this.lastPushRegistrationOk === false && this.isPushPermissionError(this.lastPushRegistrationError)) {
            this.lastPushRegistrationOk = null;
            this.lastPushRegistrationError = '';
        }

        if (!enabled) {
            if (rerender && this.currentView === 'perfil' && this.render.perfil) this.render.perfil();
            return { permission, enabled, pushOk: this.lastPushRegistrationOk };
        }

        if (permission === 'unsupported') {
            this.lastPushRegistrationOk = false;
            this.lastPushRegistrationError = 'este navegador nao oferece notificacoes neste contexto.';
        } else if (permission === 'denied') {
            this.lastPushRegistrationOk = false;
            this.lastPushRegistrationError = this.getPushErrorMessage(new Error('notification_permission_denied'));
        } else if (permission === 'default') {
            this.lastPushRegistrationOk = null;
            this.lastPushRegistrationError = '';
        } else if (permission === 'granted' && register) {
            if (this._pushRevalidateInFlight && !force) return { permission, enabled, pushOk: this.lastPushRegistrationOk };
            this._pushRevalidateInFlight = true;
            this.lastPushRegistrationOk = null;
            this.lastPushRegistrationError = '';
            if (rerender && this.currentView === 'perfil' && this.render.perfil) this.render.perfil();
            try {
                const pushOk = await this.withTimeout(this.registerPushSubscription(), 10000, 'push_revalidate');
                this.lastPushRegistrationOk = !!pushOk;
                this.lastPushRegistrationError = pushOk ? '' : 'Push em segundo plano indisponivel neste navegador.';
            } catch (err) {
                this.lastPushRegistrationOk = false;
                this.lastPushRegistrationError = this.getPushErrorMessage(err);
                console.warn('[PUSH] Falha ao reverificar assinatura:', err);
            } finally {
                this._pushRevalidateInFlight = false;
            }
        }

        if (rerender && this.currentView === 'perfil' && this.render.perfil) this.render.perfil();
        return { permission, enabled, pushOk: this.lastPushRegistrationOk, error: this.lastPushRegistrationError };
    },

toggleDailyNotifications: async function() {
        this.ensureSettingsState();
        if (this._notificationToggleBusy) {
            this.showToast('Aguarde, atualizando notificacoes...', 'error');
            return;
        }
        const enabled = !window.sistemaVidaState.settings.notificationsEnabled;
        if (enabled) {
            try {
                await this.requestNotificationPermission();
            } catch (err) {
                this.lastPushRegistrationOk = false;
                this.lastPushRegistrationError = this.getPushErrorMessage(err);
                if (this.currentView === 'perfil' && this.render.perfil) this.render.perfil();
                this.showToast(this.lastPushRegistrationError, 'error');
                return;
            }
        }
        this._notificationToggleBusy = true;
        window.sistemaVidaState.settings.notificationsEnabled = enabled;
        try { this.localSet('lifeos_notif_enabled', enabled ? '1' : '0'); } catch (_) {}
        this.lastPushRegistrationOk = null;
        this.lastPushRegistrationError = '';
        if (enabled) this.scheduleHabitReminders();
        else if (this._habitReminderTimers) this._habitReminderTimers.forEach(timerId => clearTimeout(timerId));
        if (this.currentView === 'perfil' && this.render.perfil) this.render.perfil();
        this.showToast(enabled ? 'Notificações ativadas.' : 'Notificações desativadas.', 'success');

        try {
            if (enabled) {
                try {
                    const pushOk = await this.withTimeout(this.registerPushSubscription(), 10000, 'push_register');
                    this.lastPushRegistrationOk = !!pushOk;
                    this.lastPushRegistrationError = pushOk ? '' : 'Push em segundo plano indisponivel neste navegador.';
                } catch (err) {
                    this.lastPushRegistrationOk = false;
                    this.lastPushRegistrationError = this.getPushErrorMessage(err);
                    console.warn('[PUSH] Falha ao registrar assinatura:', err);
                }
            } else {
                try { await this.withTimeout(this.unregisterPushSubscription(), 6000, 'push_unregister'); } catch (err) { console.warn('[PUSH] Falha ao remover assinatura:', err); }
                this.lastPushRegistrationOk = false;
            }
            try { await this.saveState(true); } catch (err) { console.warn('[PUSH] Falha ao salvar preferência de notificações:', err); }
        } finally {
            this._notificationToggleBusy = false;
            if (this.currentView === 'perfil' && this.render.perfil) this.render.perfil();
            if (enabled && this.lastPushRegistrationOk === false) {
                this.showToast('Notificações no app ativadas, mas push em segundo plano falhou: ' + this.lastPushRegistrationError, 'error');
            }
        }
    },

urlBase64ToUint8Array: function(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
    },

getPushSubscriptionDocId: function(endpoint = '') {
        try {
            return btoa(endpoint).replace(/[+/=]/g, '').slice(-80) || `sub_${Date.now()}`;
        } catch (_) {
            return `sub_${Date.now()}`;
        }
    },

getWebPushPublicKey: async function() {
        if (this.webPushPublicKey) return this.webPushPublicKey;
        const currentOrigin = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : '';
        const endpoints = [
            '/api/push-public-key',
            'https://life-os-mu-ashy.vercel.app/api/push-public-key'
        ].filter((url, index, arr) => {
            if (url.startsWith('https://') && currentOrigin && url.startsWith(currentOrigin)) return index === 1;
            return arr.indexOf(url) === index;
        });
        let lastError = null;
        for (const endpoint of endpoints) {
            try {
                const res = await fetch(endpoint, { cache: 'no-store' });
                if (!res.ok) throw new Error('push_public_key_unavailable_' + res.status);
                const data = await res.json();
                if (!data?.publicKey) throw new Error('push_public_key_missing');
                this.webPushPublicKey = String(data.publicKey);
                return this.webPushPublicKey;
            } catch (err) {
                lastError = err;
            }
        }
        throw lastError || new Error('push_public_key_unavailable');
    },

registerPushSubscription: async function() {
        if (!('serviceWorker' in navigator)) throw new Error('serviceWorker_unavailable');
        if (!('PushManager' in window)) throw new Error('PushManager_unavailable');
        await this.requestNotificationPermission();
        await this.withTimeout(this.getAuthReady(), 8000, 'auth_ready_push');
        const publicKey = await this.getWebPushPublicKey();
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
            sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(publicKey)
            });
        }
        const subJson = sub.toJSON();
        const docId = this.getPushSubscriptionDocId(subJson.endpoint || '');
        const ref = this.getPushSubscriptionDocRef(docId);
        await setDoc(ref, {
            endpoint: subJson.endpoint || '',
            keys: subJson.keys || {},
            userId: this.getActiveUserId(),
            ua: navigator.userAgent || '',
            updatedAt: Date.now(),
            createdAt: Date.now()
        }, { merge: true });
        return true;
    },

unregisterPushSubscription: async function() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return true;
        const subJson = sub.toJSON();
        const docId = this.getPushSubscriptionDocId(subJson.endpoint || '');
        try {
            const ref = this.getPushSubscriptionDocRef(docId);
            await deleteDoc(ref);
        } catch (_) {}
        try { await sub.unsubscribe(); } catch (_) {}
        return true;
    },

notifySelfPushEvent: async function(payload = {}, options = {}) {
        try {
            const state = window.sistemaVidaState || {};
            if (!state.settings?.notificationsEnabled) return false;
            if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false;
            if (!options.forceWhenForeground && this.isAppInForeground?.()) return false;
            if (!this.isRealAccount || !this.isRealAccount()) return false;
            const idToken = await this.getCurrentIdToken();
            const body = String(payload.body || '').trim();
            if (!body) return false;
            const requestBody = {
                title: String(payload.title || 'Life OS'),
                body,
                tag: String(payload.tag || 'lifeos-push'),
                url: String(payload.url || '/'),
                requireInteraction: !!payload.requireInteraction
            };
            if (options.dedupeId) requestBody.dedupeId = String(options.dedupeId);

            const currentOrigin = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : '';
            const endpoints = [
                '/api/internal-event-push',
                'https://life-os-mu-ashy.vercel.app/api/internal-event-push'
            ].filter((url, index, arr) => {
                if (url.startsWith('https://') && currentOrigin && url.startsWith(currentOrigin)) return index === 1;
                return arr.indexOf(url) === index;
            });

            for (const endpoint of endpoints) {
                try {
                    const res = await fetch(endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${idToken}`
                        },
                        body: JSON.stringify(requestBody)
                    });
                    if (!res.ok) continue;
                    return true;
                } catch (_) {}
            }
        } catch (_) {}
        return false;
    },

showNotification: function(messageOrOptions, toastType = 'success') {
        const payload = typeof messageOrOptions === 'string'
            ? { body: messageOrOptions }
            : (messageOrOptions || {});
        const body = String(payload.body || payload.message || '').trim();
        if (!body) return;
        const title = String(payload.title || 'Life OS');
        const tag = String(payload.tag || `lifeos-alert-${Date.now()}`);
        const url = String(payload.url || '/');
        const requireInteraction = !!payload.requireInteraction;

        this.showToast(body, payload.toastType || toastType);
        const shouldShowSystemNotification = !!payload.forceWhenForeground || !this.isAppInForeground?.();
        // Mostra notificação real do SO se permissão concedida e app aberto
        if (shouldShowSystemNotification && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
                if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.ready.then(reg => {
                        reg.showNotification(title, {
                            body,
                            icon: '/icon-192.png',
                            badge: '/icon-192.png',
                            tag,
                            data: { url },
                            requireInteraction
                        });
                    }).catch(() => {});
                } else {
                    new Notification(title, { body, icon: '/icon-192.png', tag });
                }
            } catch (_) {}
        }
    },

getOpenNudgeLog: function() {
        try {
            return JSON.parse(this.localGet('lifeos_open_nudges_log') || '{}') || {};
        } catch (_) {
            return {};
        }
    },

wasOpenNudgeShownToday: function(id, dateKey = this.getLocalDateKey()) {
        const log = this.getOpenNudgeLog();
        return log?.[id] === dateKey;
    },

markOpenNudgeShownToday: function(id, dateKey = this.getLocalDateKey()) {
        const log = this.getOpenNudgeLog();
        log[id] = dateKey;
        try { this.localSet('lifeos_open_nudges_log', JSON.stringify(log)); } catch (_) {}
    },

isMockupPurposeValue: function(value) {
        const sampleTexts = new Set([
            'Criar sistemas que ajudam pessoas a viverem com mais intenção.',
            'Desenvolvimento de software, pensamento sistêmico e design de produto.',
            'Ferramentas práticas de autogestão e produtividade com propósito.',
            'Desenvolvimento de apps, consultoria de produto e software sob medida.',
            'Construir tecnologia que transforma rotinas em jornadas com sentido.',
            'Ser presença constante e inspiração de integridade para minha família.',
            'Criar produtos que simplificam a vida de milhares de pessoas.',
            'Contribuir para uma cultura de autoconhecimento e intencionalidade.',
            'Energia alta e consistente. Treinar 4x por semana e dormir bem.',
            'Liderar meu próprio produto com autonomia e impacto real.',
            'Aprender continuamente. Ler 1 livro por mês e criar com frequência.',
            'A disciplina é a ponte entre metas e realizações. — Jim Rohn'
        ]);
        return sampleTexts.has(String(value || '').trim());
    },

getPurposeMockupCount: function() {
        const profile = window.sistemaVidaState.profile || {};
        const ikigai = profile.ikigai || {};
        const legacyObj = profile.legacyObj || {};
        const vision = profile.vision || {};
        const values = [
            ikigai.love, ikigai.good, ikigai.need, ikigai.paid, ikigai.sintese,
            legacyObj.familia, legacyObj.profissao, legacyObj.mundo,
            vision.saude, vision.carreira, vision.intelecto, vision.quote
        ];
        return values.filter((value) => this.isMockupPurposeValue(value)).length;
    },

buildOpenNudges: function() {
        const state = window.sistemaVidaState;
        const today = new Date();
        const dow = today.getDay();
        const weekKey = this._getWeekKey();
        const cadence = (key) => this.getCadenceStatus(key);
        const nudges = [];
        const hasPlan = !!(state.weekPlans || {})[weekKey];
        const hasReview = !!(state.reviews || {})[weekKey];
        const purposeMockupCount = this.getPurposeMockupCount();

        if (cadence('weeklyPlan').state === 'overdue' && [1, 2, 3, 4].includes(dow)) {
            nudges.push({
                id: 'weekly-plan-open',
                priority: 100,
                title: 'Life OS — Planejamento semanal',
                body: hasPlan
                    ? 'Sua semana já tem plano, mas está na hora de revisitar a carga e a intenção.'
                    : 'Sua semana ainda não foi planejada. Defina a intenção e escolha as ações prioritárias.',
                tag: 'lifeos-weekly-plan-open'
            });
        }

        if (cadence('weeklyReview').state === 'overdue' && [5, 6, 0].includes(dow) && (hasPlan || !hasReview)) {
            nudges.push({
                id: 'weekly-review-open',
                priority: 95,
                title: 'Life OS — Revisão semanal',
                body: 'Fim de semana pede fechamento. Revise execução, padrões e próximos ajustes.',
                tag: 'lifeos-weekly-review-open'
            });
        }

        if (purposeMockupCount >= 3) {
            nudges.push({
                id: 'purpose-mockup-open',
                priority: 92,
                title: 'Life OS — Propósito',
                body: 'Sua aba Propósito ainda está com textos de exemplo. Vale personalizar Visão, Legado e Ikigai.',
                tag: 'lifeos-purpose-mockup-open'
            });
        } else {
            const purposeTools = [
                {
                    key: 'ikigai',
                    id: 'ikigai-cadence-open',
                    title: 'Life OS — Ikigai',
                    body: 'Seu Ikigai está pedindo revisão. Releia amor, talento, necessidade, sustento e síntese.',
                    tag: 'lifeos-ikigai-cadence-open'
                },
                {
                    key: 'legacy',
                    id: 'legacy-cadence-open',
                    title: 'Life OS — Legado',
                    body: 'Seu legado está pedindo revisão. Releia o impacto desejado em família, profissão e mundo.',
                    tag: 'lifeos-legacy-cadence-open'
                },
                {
                    key: 'vision',
                    id: 'vision-cadence-open',
                    title: 'Life OS — Visão de Vida',
                    body: 'Sua Visão de Vida está pedindo revisão. Ajuste a vida concreta que você escolhe construir.',
                    tag: 'lifeos-vision-cadence-open'
                }
            ];
            const hasToolContent = {
                ikigai: this.hasCompleteIkigaiContent?.(),
                legacy: this.hasCompleteLegacyContent?.(),
                vision: this.hasCompleteVisionContent?.()
            };
            const duePurposeTool = purposeTools.find((tool) => {
                const status = cadence(tool.key);
                const hasCadence = !!window.sistemaVidaState.profile?.cadence?.[tool.key]?.lastAt;
                return status.state === 'overdue' && (hasCadence || hasToolContent[tool.key]);
            });
            if (duePurposeTool) {
                nudges.push({
                    id: duePurposeTool.id,
                    priority: 84,
                    title: duePurposeTool.title,
                    body: duePurposeTool.body,
                    tag: duePurposeTool.tag
                });
            }
        }

        if (cadence('lifeGoals').state === 'overdue') {
            nudges.push({
                id: 'life-goals-open',
                priority: 80,
                title: 'Life OS — Metas de vida',
                body: 'Suas metas de 1 a 5 anos merecem uma revisão. Confira se o rumo de longo prazo continua fazendo sentido.',
                tag: 'lifeos-life-goals-open'
            });
        }

        if (cadence('odyssey').state === 'overdue') {
            nudges.push({
                id: 'odyssey-open',
                priority: 78,
                title: 'Life OS — Odyssey Plan',
                body: 'Já faz tempo desde a última revisão dos seus cenários de vida. Atualize os próximos 5 anos possíveis.',
                tag: 'lifeos-odyssey-open'
            });
        }

        if (cadence('wheel').state === 'overdue') {
            nudges.push({
                id: 'wheel-open',
                priority: 74,
                title: 'Life OS — Roda da Vida',
                body: 'A Roda da Vida está atrasada. Vale medir novamente como estão suas 8 áreas.',
                tag: 'lifeos-wheel-open'
            });
        }

        if (cadence('perma').state === 'overdue') {
            nudges.push({
                id: 'perma-open',
                priority: 72,
                title: 'Life OS — PERMA',
                body: 'Seu diagnóstico de florescimento está desatualizado. Reavalie o PERMA para recalibrar o bem-estar.',
                tag: 'lifeos-perma-open'
            });
        }

        if (cadence('swls').state === 'overdue') {
            nudges.push({
                id: 'swls-open',
                priority: 70,
                title: 'Life OS — SWLS',
                body: 'A satisfação com a vida ainda não foi revisitada neste ciclo. Responder o SWLS ajuda a checar o panorama geral.',
                tag: 'lifeos-swls-open'
            });
        }

        return nudges.sort((a, b) => b.priority - a.priority);
    },

scheduleLocalNotifications: function() {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        const state = window.sistemaVidaState;
        if (!state.settings?.notificationsEnabled) return;
        const todayKey = this.getLocalDateKey();
        const nudges = this.buildOpenNudges()
            .filter((item) => !this.wasOpenNudgeShownToday(item.id, todayKey))
            .slice(0, 3);

        nudges.forEach((nudge, idx) => {
            setTimeout(() => {
                const payload = {
                    title: nudge.title,
                    body: nudge.body,
                    tag: nudge.tag,
                    url: '/'
                };
                this.showNotification(payload, 'info');
                this.notifySelfPushEvent(payload, { dedupeId: `open_nudge_${todayKey}_${nudge.id}` }).catch(() => {});
                this.markOpenNudgeShownToday(nudge.id, todayKey);
            }, 2500 + (idx * 1800));
        });
    },

scheduleRiskNotifications: function() {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        const state = window.sistemaVidaState;
        if (!state?.settings?.notificationsEnabled) return;
        if (!this.getRiskAlerts) return;

        const dateKey = this.getLocalDateKey();
        let sentLog = {};
        try { sentLog = JSON.parse(this.localGet('lifeos_risk_alerts_sent') || '{}') || {}; } catch (_) { sentLog = {}; }
        const alerts = this.getRiskAlerts().slice(0, 3);

        alerts.forEach((alert, idx) => {
            const microId = String(alert.id || 'micro');
            const type = String(alert.tipo || 'risk');
            const dedupeKey = `${dateKey}:${microId}:${type}`;
            if (sentLog[dedupeKey]) return;

            const bodyByType = {
                overdue: `Ação em atraso: ${alert.title}. Hora de renegociar prazo ou executar agora.`,
                hoje: `Ação vence hoje: ${alert.title}. Reserve um bloco para fechar isso hoje.`,
                urgente: `Ação urgente sem início: ${alert.title}. Defina o primeiro passo agora.`,
                risco: `Ação em risco: ${alert.title}. Vale iniciar hoje para evitar atraso.`
            };
            const payload = {
                title: 'Life OS - Risco de execucao',
                body: bodyByType[type] || `Ação em risco: ${alert.title}`,
                tag: `lifeos-risk-${type}`,
                url: '/?view=planos'
            };

            setTimeout(() => {
                this.showNotification(payload, 'info');
                this.notifySelfPushEvent(payload, { dedupeId: `risk_${dedupeKey}` }).catch(() => {});
                sentLog[dedupeKey] = true;
                try { this.localSet('lifeos_risk_alerts_sent', JSON.stringify(sentLog)); } catch (_) {}
            }, 2200 + (idx * 1300));
        });
    },

scheduleHabitReminders: function() {
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
        const state = window.sistemaVidaState;
        if (!state.settings?.notificationsEnabled) return;
        if (!Array.isArray(state.habits)) return;
        if (!this._habitReminderTimers) this._habitReminderTimers = [];
        this._habitReminderTimers.forEach(timerId => clearTimeout(timerId));
        this._habitReminderTimers = [];

        const today = new Date();
        const todayKey = this.getLocalDateKey();
        const dayIndex = String(today.getDay());
        let sent = {};
        try { sent = JSON.parse(this.localGet('lifeos_habit_reminders_sent') || '{}') || {}; } catch (_) { sent = {}; }

        const toMinutes = (hhmm) => {
            const [h, m] = String(hhmm || '').slice(0, 5).split(':');
            const hh = Number(h);
            const mm = Number(m);
            if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
            return hh * 60 + mm;
        };
        const toHHMM = (mins) => {
            const safe = Math.max(0, Math.min(1439, Number(mins) || 0));
            return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
        };
        const getReminderTimes = (habit) => {
            const single = String(habit?.reminderTime || '').slice(0, 5);
            if (!habit?.reminderIntervalEnabled) return single ? [single] : [];
            const startM = toMinutes(habit.reminderWindowStart);
            const endM = toMinutes(habit.reminderWindowEnd);
            const step = Math.max(5, Number(habit.reminderIntervalMin || 60));
            if (startM == null || endM == null || endM < startM) return single ? [single] : [];
            const times = [];
            for (let cursor = startM; cursor <= endM; cursor += step) times.push(toHHMM(cursor));
            if (!times.length && single) times.push(single);
            return times;
        };

        state.habits.forEach(habit => {
            if (!habit || !habit.reminderEnabled) return;
            if (typeof this.isHabitScheduledForDate === 'function' && !this.isHabitScheduledForDate(habit, todayKey)) return;
            getReminderTimes(habit).forEach((reminderHHMM) => {
                const [hhRaw, mmRaw] = String(reminderHHMM).slice(0, 5).split(':');
                const hh = Number(hhRaw);
                const mm = Number(mmRaw);
                if (!Number.isFinite(hh) || !Number.isFinite(mm)) return;

                const trigger = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hh, mm, 0, 0);
                const reminderKey = `${habit.id}:${todayKey}:${reminderHHMM}`;
                const delay = trigger.getTime() - Date.now();
                const notify = () => {
                    if (sent[reminderKey]) return;
                    sent[reminderKey] = true;
                    try { this.localSet('lifeos_habit_reminders_sent', JSON.stringify(sent)); } catch (_) {}
                    this.showNotification(`Lembrete de habito: ${habit.title}`);
                };

                if (delay > 0) {
                    this._habitReminderTimers.push(setTimeout(notify, delay));
                } else if (delay > -90 * 60 * 1000) {
                    notify();
                }
            });
        });
    },

startHabitReminderWatcher: function() {
        if (this._habitReminderWatcher) return;
        const toMinutes = (hhmm) => {
            const [h, m] = String(hhmm || '').slice(0, 5).split(':');
            const hh = Number(h);
            const mm = Number(m);
            if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
            return hh * 60 + mm;
        };
        const toHHMM = (mins) => {
            const safe = Math.max(0, Math.min(1439, Number(mins) || 0));
            return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
        };
        const getReminderTimes = (habit) => {
            const single = String(habit?.reminderTime || '').slice(0, 5);
            if (!habit?.reminderIntervalEnabled) return single ? [single] : [];
            const startM = toMinutes(habit.reminderWindowStart);
            const endM = toMinutes(habit.reminderWindowEnd);
            const step = Math.max(5, Number(habit.reminderIntervalMin || 60));
            if (startM == null || endM == null || endM < startM) return single ? [single] : [];
            const times = [];
            for (let cursor = startM; cursor <= endM; cursor += step) times.push(toHHMM(cursor));
            if (!times.length && single) times.push(single);
            return times;
        };
        this._habitReminderWatcher = setInterval(() => {
            try {
                const state = window.sistemaVidaState;
                if (!state?.settings?.notificationsEnabled) return;
                if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
                if (!Array.isArray(state.habits) || state.habits.length === 0) return;
                const now = new Date();
                const hh = String(now.getHours()).padStart(2, '0');
                const mm = String(now.getMinutes()).padStart(2, '0');
                const nowHHMM = `${hh}:${mm}`;
                const nowMinutes = toMinutes(nowHHMM);
                const todayKey = this.getLocalDateKey();
                let sent = {};
                try { sent = JSON.parse(this.localGet('lifeos_habit_reminders_sent') || '{}') || {}; } catch (_) { sent = {}; }

                state.habits.forEach(habit => {
                    if (!habit || !habit.reminderEnabled) return;
                    if (typeof this.isHabitScheduledForDate === 'function' && !this.isHabitScheduledForDate(habit, todayKey)) return;
                    getReminderTimes(habit).forEach((reminderHHMM) => {
                        const reminderMinutes = toMinutes(reminderHHMM);
                        if (nowMinutes == null || reminderMinutes == null) return;
                        const diff = nowMinutes - reminderMinutes;
                        if (diff < 0 || diff > 2) return; // tolera atraso de timer/background
                        const reminderKey = `${habit.id}:${todayKey}:${reminderHHMM}`;
                        if (sent[reminderKey]) return;
                        sent[reminderKey] = true;
                        try { this.localSet('lifeos_habit_reminders_sent', JSON.stringify(sent)); } catch (_) {}
                        this.showNotification(`Lembrete de habito: ${habit.title}`);
                    });
                });
            } catch (_) {}
        }, 30000);
    },
    });
}
