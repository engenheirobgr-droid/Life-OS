import { db, auth, doc, setDoc, getDoc, onSnapshot, deleteDoc, serverTimestamp, collection, query, orderBy, limit, getDocs, LOCAL_USER_SCOPE } from './firebase.js';

const DEFAULT_SOCIAL_VISIBILITY = {
    name: true,
    avatar: true,
    level: true,
    xp: true,
    dimensionLevels: true,
    achievements: true,
    keyHabitsDone: true,
    streak: true,
    lastActiveAt: true
};

const SOCIAL_FIELD_LABELS = {
    name: 'Nome',
    avatar: 'Avatar',
    level: 'Nivel',
    xp: 'XP pessoal',
    dimensionLevels: 'Niveis por dimensao',
    achievements: 'Conquistas recentes',
    keyHabitsDone: 'Habitos-chave concluidos',
    streak: 'Dias em sequencia pessoal',
    lastActiveAt: 'Ultima atividade'
};

const SOCIAL_REACTIONS = {
    strength: { label: 'Forca', icon: 'workspace_premium', emoji: '💪' },
    congrats: { label: 'Parabens', icon: 'celebration', emoji: '🎉' },
    together: { label: 'Vamos junto', icon: 'group', emoji: '🤝' }
};

const SOCIAL_CHALLENGES = {
    key_habits_3: { label: '3 habitos-chave na semana', target: 3, metric: 'keyHabitsDone' },
    streak_5: { label: '5 dias em sequencia no grupo', target: 5, metric: 'sharedStreak' },
    xp_100: { label: '100 XP coletivos', target: 100, metric: 'collectiveXp' }
};

function makeSocialCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    return code;
}

export function attachSocial(app) {
    Object.assign(app, {
        getSocialDefaultVisibility: function() {
            return { ...DEFAULT_SOCIAL_VISIBILITY };
        },

        isSocialFeatureEnabled: function() {
            const features = window.sistemaVidaState?.settings?.features || {};
            return features.social === true;
        },

        ensureSocialState: function() {
            if (!window.sistemaVidaState.settings) window.sistemaVidaState.settings = {};
            if (!window.sistemaVidaState.settings.features || typeof window.sistemaVidaState.settings.features !== 'object') {
                window.sistemaVidaState.settings.features = {};
            }
            if (typeof window.sistemaVidaState.settings.features.social !== 'boolean') {
                window.sistemaVidaState.settings.features.social = false;
            }
            if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
            const profile = window.sistemaVidaState.profile;
            if (!profile.social || typeof profile.social !== 'object' || Array.isArray(profile.social)) {
                profile.social = {};
            }
            if (typeof profile.social.sharingEnabled !== 'boolean') profile.social.sharingEnabled = false;
            if (!profile.social.visibility || typeof profile.social.visibility !== 'object' || Array.isArray(profile.social.visibility)) {
                profile.social.visibility = {};
            }
            profile.social.visibility = {
                ...DEFAULT_SOCIAL_VISIBILITY,
                ...profile.social.visibility
            };
            Object.keys(profile.social.visibility).forEach((key) => {
                if (!(key in DEFAULT_SOCIAL_VISIBILITY)) delete profile.social.visibility[key];
                else profile.social.visibility[key] = profile.social.visibility[key] !== false;
            });
            if (typeof profile.social.publicProfileId !== 'string') profile.social.publicProfileId = '';
            if (typeof profile.social.lastPublishedAt !== 'string') profile.social.lastPublishedAt = '';
            if (typeof profile.social.lastDisabledAt !== 'string') profile.social.lastDisabledAt = '';
            if (!profile.social.invites || typeof profile.social.invites !== 'object' || Array.isArray(profile.social.invites)) {
                profile.social.invites = {};
            }
            if (!profile.social.connections || typeof profile.social.connections !== 'object' || Array.isArray(profile.social.connections)) {
                profile.social.connections = {};
            }
            if (!profile.social.connectionProfiles || typeof profile.social.connectionProfiles !== 'object' || Array.isArray(profile.social.connectionProfiles)) {
                profile.social.connectionProfiles = {};
            }
            if (!profile.social.reactions || typeof profile.social.reactions !== 'object' || Array.isArray(profile.social.reactions)) {
                profile.social.reactions = {};
            }
            if (!profile.social.notifications || typeof profile.social.notifications !== 'object' || Array.isArray(profile.social.notifications)) {
                profile.social.notifications = {};
            }
            if (!Array.isArray(profile.social.notifications.items)) profile.social.notifications.items = [];
            if (!profile.social.challenges || typeof profile.social.challenges !== 'object' || Array.isArray(profile.social.challenges)) {
                profile.social.challenges = {};
            }
        },

        getSocialPublicProfileDocRef: function(userId = this.getActiveUserId()) {
            return doc(db, 'users', userId, 'public', 'profile');
        },

        getSocialPrivateDocRef: function(userId = this.getActiveUserId()) {
            return doc(db, 'users', userId, 'private', 'social');
        },

        getSocialConnectionsDocRef: function(userId = this.getActiveUserId()) {
            return doc(db, 'users', userId, 'private', 'connections');
        },

        getSocialEngagementDocRef: function(userId = this.getActiveUserId()) {
            return doc(db, 'users', userId, 'private', 'engagement');
        },

        getSocialInviteCodeDocRef: function(code) {
            return doc(db, 'inviteCodes', String(code || '').trim().toUpperCase());
        },

        getSocialInboxCollectionRef: function(userId = this.getActiveUserId()) {
            return collection(db, 'users', userId, 'private', 'social', 'inbox');
        },

        getSocialInboxDocRef: function(userId, eventId) {
            return doc(db, 'users', userId, 'private', 'social', 'inbox', eventId);
        },

        pushSocialInternalNotification: async function(type, payload = {}) {
            this.ensureSocialState();
            const nowIso = new Date().toISOString();
            const item = {
                id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                type: String(type || 'app_event'),
                sourceUid: this.getActiveUserId(),
                sourceName: window.sistemaVidaState.profile?.name || 'Usuario',
                targetUid: this.getActiveUserId(),
                status: 'new',
                readAt: '',
                createdAt: nowIso,
                payload
            };
            const social = window.sistemaVidaState.profile.social;
            if (!Array.isArray(social.notifications.items)) social.notifications.items = [];
            social.notifications.items.unshift(item);
            social.notifications.items = social.notifications.items.slice(0, 100);
            const userId = this.getActiveUserId();
            if (this.isSocialFeatureEnabled() && userId && userId !== LOCAL_USER_SCOPE && !auth.currentUser?.isAnonymous) {
                const cloudId = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await setDoc(this.getSocialInboxDocRef(userId, cloudId), {
                    type: item.type,
                    sourceUid: item.sourceUid,
                    sourceName: item.sourceName,
                    targetUid: item.targetUid,
                    status: item.status,
                    readAt: '',
                    createdAt: nowIso,
                    payload
                }, { merge: false });
            }
            this.renderAppNotificationCenter();
            if (this.currentView === 'perfil') this.renderSocialConnectionsPanel();
        },

        markSocialNotificationRead: async function(notificationId) {
            this.ensureSocialState();
            const social = window.sistemaVidaState.profile.social;
            const id = String(notificationId || '');
            if (!id || !Array.isArray(social.notifications.items)) return;
            const item = social.notifications.items.find((entry) => String(entry.id || '') === id);
            if (!item || item.readAt) return;
            const nowIso = new Date().toISOString();
            item.readAt = nowIso;
            item.status = 'read';
            this.saveState(true);
            const userId = this.getActiveUserId();
            if (userId && userId !== LOCAL_USER_SCOPE && !auth.currentUser?.isAnonymous) {
                try { await setDoc(this.getSocialInboxDocRef(userId, id), { readAt: nowIso, status: 'read' }, { merge: true }); } catch (_) {}
            }
            this.renderAppNotificationCenter();
            if (this.currentView === 'perfil') this.renderSocialConnectionsPanel();
        },

        markAllSocialNotificationsRead: async function() {
            this.ensureSocialState();
            const social = window.sistemaVidaState.profile.social;
            if (!Array.isArray(social.notifications.items)) return;
            const unread = social.notifications.items.filter((entry) => !entry.readAt);
            if (!unread.length) return;
            const nowIso = new Date().toISOString();
            unread.forEach((entry) => {
                entry.readAt = nowIso;
                entry.status = 'read';
            });
            this.saveState(true);
            const userId = this.getActiveUserId();
            if (userId && userId !== LOCAL_USER_SCOPE && !auth.currentUser?.isAnonymous) {
                await Promise.all(unread.map(async (entry) => {
                    try { await setDoc(this.getSocialInboxDocRef(userId, entry.id), { readAt: nowIso, status: 'read' }, { merge: true }); } catch (_) {}
                }));
            }
            this.renderAppNotificationCenter();
            if (this.currentView === 'perfil') this.renderSocialConnectionsPanel();
        },

        normalizeSocialConnectionMap: function(input = {}) {
            const now = new Date().toISOString();
            const out = {};
            Object.entries(input || {}).forEach(([uid, raw]) => {
                if (!uid || !raw || typeof raw !== 'object') return;
                const status = ['pending_incoming', 'pending_outgoing', 'active', 'removed'].includes(raw.status)
                    ? raw.status
                    : 'active';
                out[uid] = {
                    uid,
                    status,
                    inviteCode: String(raw.inviteCode || ''),
                    source: String(raw.source || 'invite'),
                    requestedAt: String(raw.requestedAt || raw.connectedAt || now),
                    acceptedAt: String(raw.acceptedAt || raw.connectedAt || ''),
                    removedAt: String(raw.removedAt || '')
                };
            });
            return out;
        },

        getSocialDimensionLevels: function() {
            const gamification = window.sistemaVidaState.gamification || {};
            const dimXp = gamification.dimensionXp || {};
            const dims = window.sistemaVidaState.dimensions || {};
            const keys = Object.keys(dims);
            const result = {};
            keys.forEach((dim) => {
                const xp = Math.max(0, Number(dimXp[dim]) || 0);
                result[dim] = {
                    level: this.getLevelFromXp ? this.getLevelFromXp(xp) : 1,
                    xp
                };
            });
            return result;
        },

        getSocialKeyHabitsDoneCount: function() {
            const habits = window.sistemaVidaState.habits || [];
            return habits
                .filter((habit) => habit?.isKey)
                .reduce((total, habit) => total + (this.getHabitDoneDates ? this.getHabitDoneDates(habit).length : 0), 0);
        },

        getSocialBestStreak: function() {
            if (this.getPersonalActivityStreak) return this.getPersonalActivityStreak();
            const gamification = window.sistemaVidaState.gamification || {};
            const habitStreak = (window.sistemaVidaState.habits || []).reduce((best, habit) => {
                const streak = this.getHabitConsecutiveStreak ? this.getHabitConsecutiveStreak(habit) : 0;
                return Math.max(best, streak);
            }, 0);
            return Math.max(habitStreak, Number(gamification.currentStreak || 0) || 0);
        },

        getSocialAchievementsPreview: function() {
            const achievements = window.sistemaVidaState.gamification?.achievements || [];
            return achievements
                .filter(Boolean)
                .slice(-6)
                .reverse()
                .map((item) => ({
                    id: String(item.id || item.key || ''),
                    title: String(item.title || 'Conquista'),
                    unlockedAt: String(item.unlockedAt || item.date || '')
                }))
                .filter((item) => item.id || item.title);
        },

        getSocialHighlightsPreview: function(visibility = {}) {
            const gamification = window.sistemaVidaState.gamification || {};
            const recentEvents = Array.isArray(gamification.recentEvents) ? gamification.recentEvents : [];
            const highlights = [];
            if (visibility.xp !== false || visibility.level !== false) {
                recentEvents
                    .filter((event) => ['micro_complete', 'habit_complete', 'deep_work', 'weekly_review', 'daily_checkin', 'daily_diary', 'daily_shutdown'].includes(event.type))
                    .slice(0, 3)
                    .forEach((event, idx) => {
                        const labelMap = {
                            micro_complete: 'Micro concluida',
                            habit_complete: 'Habito concluido',
                            deep_work: 'Bloco de foco concluido',
                            weekly_review: 'Revisao semanal feita',
                            daily_checkin: 'Check-in realizado',
                            daily_diary: 'Diario registrado',
                            daily_shutdown: 'Fechamento do dia feito'
                        };
                        highlights.push({
                            id: event.sourceId || `${event.type}_${idx}_${event.at || ''}`,
                            type: 'highlight',
                            sourceType: event.type,
                            title: labelMap[event.type] || 'Movimento registrado',
                            subtitle: event.title || event.dimension || '',
                            createdAt: event.at || ''
                        });
                    });
            }
            return highlights
                .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
                .slice(0, 3);
        },

        buildPublicProfilePayload: function() {
            this.ensureSocialState();
            const state = window.sistemaVidaState;
            const profile = state.profile || {};
            const social = profile.social || {};
            const visibility = social.visibility || DEFAULT_SOCIAL_VISIBILITY;
            const gamification = this.ensureGamificationState ? this.ensureGamificationState() : (state.gamification || {});
            const totalXp = Math.max(0, Number(gamification.totalXp || profile.xp) || 0);
            const overallLevel = this.getOverallLevelProgress ? this.getOverallLevelProgress(gamification).level : (this.getLevelFromXp ? this.getLevelFromXp(totalXp) : Math.max(1, Number(profile.level) || 1));
            const payload = {
                schemaVersion: 1,
                userId: this.getActiveUserId(),
                sharingEnabled: !!social.sharingEnabled,
                updatedAt: new Date().toISOString()
            };
            if (visibility.name) payload.name = String(profile.name || 'Usuario');
            if (visibility.avatar) payload.avatarUrl = String(profile.avatarUrl || '');
            if (visibility.level) payload.level = overallLevel;
            if (visibility.xp) payload.xp = totalXp;
            if (visibility.dimensionLevels) payload.dimensionLevels = this.getSocialDimensionLevels();
            if (visibility.achievements) payload.achievements = this.getSocialAchievementsPreview();
            if (visibility.keyHabitsDone) payload.keyHabitsDone = this.getSocialKeyHabitsDoneCount();
            if (visibility.streak) payload.streak = this.getSocialBestStreak();
            if (visibility.lastActiveAt) payload.lastActiveAt = new Date().toISOString();
            if (visibility.xp || visibility.level || visibility.achievements) payload.recentHighlights = this.getSocialHighlightsPreview(visibility);
            return payload;
        },

        getSocialPreviewRows: function() {
            this.ensureSocialState();
            const payload = this.buildPublicProfilePayload();
            const rows = [];
            Object.entries(SOCIAL_FIELD_LABELS).forEach(([key, label]) => {
                if (!(key in payload)) return;
                let value = payload[key];
                if (key === 'avatar') value = payload.avatarUrl ? 'Imagem de perfil' : 'Sem avatar';
                else if (Array.isArray(value)) value = value.length ? `${value.length} conquista(s) recente(s)` : 'Nenhuma ainda';
                else if (key === 'dimensionLevels' && value && typeof value === 'object') {
                    const areas = Object.entries(value).slice(0, 8);
                    value = areas.length
                        ? areas.map(([name, item]) => `${name} N${item?.level || 1}`).join(' | ')
                        : 'Sem niveis ainda';
                } else if (value && typeof value === 'object') value = `${Object.keys(value).length} item(ns)`;
                else if (key === 'lastActiveAt') value = 'Agora';
                rows.push({ key, label, value: String(value ?? '') });
            });
            return rows;
        },

        getAppNotificationTypeMeta: function(type) {
            const key = String(type || '');
            const meta = {
                invite_request: { group: 'social', title: 'Convite recebido', icon: 'mail', tone: 'text-primary' },
                reaction: { group: 'social', title: 'Reacao recebida', icon: 'favorite', tone: 'text-primary' },
                social_activity: { group: 'social', title: 'Conquista da conexao', icon: 'emoji_events', tone: 'text-primary' },
                challenge: { group: 'social', title: 'Desafio social', icon: 'flag', tone: 'text-primary' },
                xp_gain: { group: 'app', title: 'XP ganho', icon: 'bolt', tone: 'text-primary' },
                level_up: { group: 'app', title: 'Novo nivel', icon: 'trending_up', tone: 'text-primary' },
                achievement_unlock: { group: 'app', title: 'Conquista desbloqueada', icon: 'military_tech', tone: 'text-primary' },
                sync_warning: { group: 'app', title: 'Aviso de sincronizacao', icon: 'sync_problem', tone: 'text-error' },
                ritual: { group: 'app', title: 'Rito importante', icon: 'event_repeat', tone: 'text-primary' }
            };
            return meta[key] || { group: 'app', title: 'Atualizacao do app', icon: 'notifications', tone: 'text-primary' };
        },

        broadcastSocialActivityToConnections: async function(activity = {}) {
            this.ensureSocialState();
            if (!this.isSocialFeatureEnabled()) return false;
            const social = window.sistemaVidaState.profile.social || {};
            if (!social.sharingEnabled) return false;
            const sourceUid = this.getActiveUserId();
            if (!sourceUid || sourceUid === LOCAL_USER_SCOPE || auth.currentUser?.isAnonymous) return false;
            const connectionIds = this.getSocialActiveConnectionIds();
            if (!connectionIds.length) return false;
            const createdAt = new Date().toISOString();
            await Promise.all(connectionIds.map(async (targetUid) => {
                const eventId = `social_activity_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                try {
                    await setDoc(this.getSocialInboxDocRef(targetUid, eventId), {
                        type: 'social_activity',
                        sourceUid,
                        sourceName: window.sistemaVidaState.profile?.name || 'Usuario',
                        targetUid,
                        status: 'new',
                        readAt: '',
                        createdAt,
                        payload: {
                            contextType: String(activity.contextType || ''),
                            contextId: String(activity.contextId || ''),
                            contextTitle: String(activity.contextTitle || ''),
                            summary: String(activity.summary || ''),
                            subtitle: String(activity.subtitle || '')
                        }
                    }, { merge: false });
                } catch (err) {
                    console.warn('[SOCIAL] Falha ao notificar conexao sobre atividade:', err);
                }
            }));
            return true;
        },

        openAppNotificationsPanel: function() {
            const modal = document.getElementById('app-notifications-modal');
            if (!modal) return;
            modal.classList.remove('hidden');
            this.renderAppNotificationCenter();
        },

        closeAppNotificationsPanel: function() {
            const modal = document.getElementById('app-notifications-modal');
            if (modal) modal.classList.add('hidden');
        },

        toggleAppNotificationsPanel: function() {
            const modal = document.getElementById('app-notifications-modal');
            if (!modal) return;
            if (modal.classList.contains('hidden')) this.openAppNotificationsPanel();
            else this.closeAppNotificationsPanel();
        },

        formatSocialTimestamp: function(value) {
            const raw = String(value || '');
            if (!raw) return 'Agora';
            const date = new Date(raw);
            if (Number.isNaN(date.getTime())) return raw.slice(0, 16).replace('T', ' ');
            return date.toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        },

        acknowledgeVisibleNotifications: async function() {
            this.ensureSocialState();
            const items = Array.isArray(window.sistemaVidaState.profile.social.notifications?.items)
                ? window.sistemaVidaState.profile.social.notifications.items
                : [];
            const unread = items.filter((entry) => !entry.readAt);
            if (!unread.length) return;
            const nowIso = new Date().toISOString();
            unread.forEach((entry) => {
                entry.readAt = nowIso;
                entry.status = 'seen';
            });
            this.saveState(true);
            const userId = this.getActiveUserId();
            if (userId && userId !== LOCAL_USER_SCOPE && !auth.currentUser?.isAnonymous) {
                await Promise.all(unread
                    .filter((entry) => String(entry.id || '').startsWith('evt_'))
                    .map(async (entry) => {
                        try {
                            await setDoc(this.getSocialInboxDocRef(userId, entry.id), { readAt: nowIso, status: 'seen' }, { merge: true });
                        } catch (_) {}
                    }));
            }
        },

        renderAppNotificationCenter: function() {
            const notificationsEl = document.getElementById('app-notifications-panel-list');
            const badgeEls = Array.from(document.querySelectorAll('[data-app-notification-badge]'));
            if (!notificationsEl) return;
            this.ensureSocialState();
            if (this.isSocialFeatureEnabled()) {
                this.startSocialInboxListener();
            }
            const notifications = Array.isArray(window.sistemaVidaState.profile.social.notifications?.items)
                ? window.sistemaVidaState.profile.social.notifications.items.slice(0, 24)
                : [];
            const unread = notifications.filter((item) => !item.readAt).length;
            badgeEls.forEach((badge) => {
                badge.textContent = unread > 9 ? '9+' : String(unread);
                badge.classList.toggle('hidden', unread === 0);
                badge.classList.toggle('inline-flex', unread > 0);
            });

            const grouped = { app: [], social: [] };
            notifications.forEach((item) => {
                const meta = this.getAppNotificationTypeMeta(item.type);
                grouped[meta.group].push({ item, meta });
            });

            const renderCard = ({ item, meta }) => {
                const readCls = item.readAt ? 'opacity-80' : '';
                const baseDetail = item.payload?.message || item.payload?.title || item.payload?.summary || '';
                let body = baseDetail;
                let actions = '';
                if (item.type === 'invite_request') {
                    body = `${item.sourceName || 'Usuario'} quer se conectar com voce.`;
                    if (item.status === 'pending') {
                        actions = `<div class="flex flex-wrap gap-2 pt-2">
                            <button type="button" onclick="window.app.handleSocialInviteDecision('${this.escapeHtml(item.id)}','${this.escapeHtml(item.sourceUid)}',true)" class="h-9 px-3 rounded-lg bg-primary text-on-primary text-[10px] font-bold uppercase tracking-wider">Aceitar</button>
                            <button type="button" onclick="window.app.handleSocialInviteDecision('${this.escapeHtml(item.id)}','${this.escapeHtml(item.sourceUid)}',false)" class="h-9 px-3 rounded-lg bg-surface-container-high text-outline text-[10px] font-bold uppercase tracking-wider">Recusar</button>
                        </div>`;
                    }
                } else if (item.type === 'reaction') {
                    const cfg = SOCIAL_REACTIONS[item.reactionType] || SOCIAL_REACTIONS.strength;
                    const targetCopy = item.payload?.contextTitle ? ` em "${item.payload.contextTitle}"` : '';
                    body = `${item.sourceName || 'Usuario'} enviou ${cfg.label.toLowerCase()} para voce${targetCopy}.`;
                    if (item.sourceUid) {
                        actions = `<div class="flex flex-wrap gap-2 pt-2">
                            ${Object.entries(SOCIAL_REACTIONS).map(([type, cfgAction]) => `<button type="button" title="${this.escapeHtml(cfgAction.label)}" aria-label="${this.escapeHtml(cfgAction.label)}" onclick="window.app.sendSocialReaction('${this.escapeHtml(item.sourceUid)}','${type}','${encodeURIComponent(String(item.payload?.contextType || ''))}','${encodeURIComponent(String(item.payload?.contextId || ''))}','${encodeURIComponent(String(item.payload?.contextTitle || ''))}')" class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/5 border border-primary/15 text-base hover:bg-primary/10"><span aria-hidden="true">${cfgAction.emoji}</span></button>`).join('')}
                        </div>`;
                    }
                } else if (item.type === 'social_activity') {
                    const context = item.payload?.contextTitle || 'movimento recente';
                    const subtitle = item.payload?.subtitle ? ` · ${item.payload.subtitle}` : '';
                    body = `${item.sourceName || 'Usuario'} registrou ${context}${subtitle}.`;
                    if (item.sourceUid) {
                        actions = `<div class="flex flex-wrap gap-2 pt-2">
                            ${Object.entries(SOCIAL_REACTIONS).map(([type, cfgAction]) => `<button type="button" title="${this.escapeHtml(cfgAction.label)}" aria-label="${this.escapeHtml(cfgAction.label)}" onclick="window.app.sendSocialReaction('${this.escapeHtml(item.sourceUid)}','${type}','${encodeURIComponent(String(item.payload?.contextType || ''))}','${encodeURIComponent(String(item.payload?.contextId || ''))}','${encodeURIComponent(String(item.payload?.contextTitle || ''))}')" class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/5 border border-primary/15 text-base hover:bg-primary/10"><span aria-hidden="true">${cfgAction.emoji}</span></button>`).join('')}
                        </div>`;
                    }
                }
                return `<article class="rounded-xl bg-surface-container-low p-3 border border-outline-variant/10 ${readCls}">
                    <div class="flex items-start gap-3">
                        <span class="material-symbols-outlined notranslate text-[18px] ${meta.tone}">${meta.icon}</span>
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <p class="text-xs font-bold text-on-surface">${this.escapeHtml(meta.title)}</p>
                                <span class="text-[10px] text-outline shrink-0">${this.escapeHtml(this.formatSocialTimestamp(item.createdAt))}</span>
                            </div>
                            <p class="mt-1 text-xs text-on-surface-variant leading-relaxed">${this.escapeHtml(body || 'Atualizacao registrada no app.')}</p>
                            ${actions}
                        </div>
                    </div>
                </article>`;
            };

            const sections = [
                { key: 'app', label: 'App', empty: 'Ganhos de XP, niveis, conquistas e avisos internos aparecem aqui.' },
                { key: 'social', label: 'Social', empty: 'Convites, reacoes e interacoes com conexoes aparecem aqui.' }
            ];
            notificationsEl.innerHTML = sections.map((section) => {
                const items = grouped[section.key] || [];
                return `<div class="space-y-2">
                    <div class="flex items-center justify-between gap-3">
                        <p class="text-[10px] font-bold uppercase tracking-[0.18em] text-outline">${section.label}</p>
                        <span class="text-[10px] text-outline">${items.length ? `${items.length} evento(s)` : 'Sem eventos'}</span>
                    </div>
                    ${items.length
                        ? `<div class="space-y-2">${items.map(renderCard).join('')}</div>`
                        : `<div class="rounded-xl bg-surface-container-low p-3 border border-outline-variant/10 text-xs text-outline">${section.empty}</div>`}
                </div>`;
            }).join('');

            if (unread > 0 && !this._notificationAcknowledgeQueued) {
                this._notificationAcknowledgeQueued = true;
                setTimeout(() => {
                    this._notificationAcknowledgeQueued = false;
                    this.acknowledgeVisibleNotifications().catch(() => {});
                }, 600);
            }
        },

        setSocialFeatureForLocalAudit: function(enabled) {
            this.ensureSocialState();
            window.sistemaVidaState.settings.features.social = !!enabled;
            this.saveState(true);
            if (this.currentView === 'perfil' && this.render?.perfil) this.render.perfil();
        },

        setSocialFeatureEnabled: function(enabled) {
            this.ensureSocialState();
            const nextValue = !!enabled;
            window.sistemaVidaState.settings.features.social = nextValue;
            if (!nextValue) {
                this.stopSocialConnectionsListener();
            }
            this.saveState(true);
            if (this.currentView === 'perfil' && this.render?.perfil) this.render.perfil();
            this.showToast(
                nextValue
                    ? 'Area social liberada neste perfil.'
                    : 'Area social ocultada novamente.',
                'success'
            );
        },

        getSocialActiveConnectionIds: function() {
            this.ensureSocialState();
            const connections = window.sistemaVidaState.profile.social.connections || {};
            return Object.entries(connections)
                .filter(([, item]) => item?.status === 'active')
                .map(([uid]) => uid);
        },

        startSocialConnectionsListener: function() {
            if (this._socialConnectionsUnsub || !this.isSocialFeatureEnabled()) return;
            const userId = this.getActiveUserId();
            if (!userId || userId === LOCAL_USER_SCOPE || auth.currentUser?.isAnonymous) return;
            try {
                this._socialConnectionsUnsub = onSnapshot(this.getSocialConnectionsDocRef(userId), (snap) => {
                    this.ensureSocialState();
                    const data = snap.exists() ? snap.data() : {};
                    const connectionsRaw = data.connections && typeof data.connections === 'object' ? data.connections : {};
                    const connections = this.normalizeSocialConnectionMap(connectionsRaw);
                    window.sistemaVidaState.profile.social.connections = connections;
                    this.refreshSocialConnectionProfiles().catch(() => {});
                    if (this.currentView === 'perfil') this.renderSocialConnectionsPanel();
                }, (err) => {
                    console.warn('[SOCIAL] Listener de conexoes falhou:', err);
                });
            } catch (err) {
                console.warn('[SOCIAL] Nao foi possivel iniciar listener de conexoes:', err);
            }
            this.startSocialInboxListener();
        },

        stopSocialConnectionsListener: function() {
            if (this._socialConnectionsUnsub) {
                try { this._socialConnectionsUnsub(); } catch (_) {}
                this._socialConnectionsUnsub = null;
            }
            if (this._socialInboxUnsub) {
                try { this._socialInboxUnsub(); } catch (_) {}
                this._socialInboxUnsub = null;
            }
        },

        startSocialInboxListener: function() {
            if (this._socialInboxUnsub || !this.isSocialFeatureEnabled()) return;
            const userId = this.getActiveUserId();
            if (!userId || userId === LOCAL_USER_SCOPE || auth.currentUser?.isAnonymous) return;
            const q = query(this.getSocialInboxCollectionRef(userId), orderBy('createdAt', 'desc'), limit(60));
            this._socialInboxUnsub = onSnapshot(q, (snap) => {
                this.ensureSocialState();
                const items = [];
                snap.forEach((itemDoc) => {
                    items.push({ id: itemDoc.id, ...itemDoc.data() });
                });
                window.sistemaVidaState.profile.social.notifications.items = items;
                this.renderAppNotificationCenter();
                if (this.currentView === 'perfil') this.renderSocialConnectionsPanel();
            }, (err) => {
                console.warn('[SOCIAL] Listener da central social falhou:', err);
            });
        },

        generateSocialInviteCode: async function() {
            this.ensureSocialState();
            if (!this.isSocialFeatureEnabled()) return;
            const userId = this.getActiveUserId();
            if (!userId || userId === LOCAL_USER_SCOPE || auth.currentUser?.isAnonymous) {
                this.showToast('Entre em uma conta para gerar convite.', 'error');
                return;
            }
            try {
                let code = '';
                for (let tries = 0; tries < 5; tries++) {
                    const candidate = makeSocialCode();
                    const snap = await getDoc(this.getSocialInviteCodeDocRef(candidate));
                    if (!snap.exists()) { code = candidate; break; }
                }
                if (!code) {
                    this.showToast('Nao consegui gerar um codigo agora. Tente novamente.', 'error');
                    return;
                }
                const payload = {
                    code,
                    ownerUid: userId,
                    ownerName: window.sistemaVidaState.profile?.name || 'Usuario',
                    status: 'active',
                    createdAt: serverTimestamp(),
                    expiresAt: Date.now() + 7 * 86400000
                };
                await setDoc(this.getSocialInviteCodeDocRef(code), payload, { merge: false });
                window.sistemaVidaState.profile.social.invites.lastCode = code;
                window.sistemaVidaState.profile.social.invites.lastCreatedAt = new Date().toISOString();
                this.saveState(true);
                this.renderSocialConnectionsPanel();
                this.showToast('Codigo de convite gerado.', 'success');
            } catch (err) {
                console.warn('[SOCIAL] Falha ao gerar convite:', err);
                this.showToast('Nao consegui gerar o codigo. Verifique a sincronizacao e tente novamente.', 'error');
            }
        },

        acceptSocialInviteCode: async function(rawCode) {
            this.ensureSocialState();
            if (!this.isSocialFeatureEnabled()) return;
            const userId = this.getActiveUserId();
            if (!userId || userId === LOCAL_USER_SCOPE || auth.currentUser?.isAnonymous) {
                this.showToast('Entre em uma conta para aceitar convite.', 'error');
                return;
            }
            const code = String(rawCode || document.getElementById('social-invite-code-input')?.value || '').trim().toUpperCase();
            if (!code) {
                this.showToast('Informe um codigo de convite.', 'error');
                return;
            }
            try {
                const snap = await getDoc(this.getSocialInviteCodeDocRef(code));
                if (!snap.exists()) {
                    this.showToast('Codigo nao encontrado.', 'error');
                    return;
                }
                const invite = snap.data() || {};
                const otherUid = String(invite.ownerUid || '');
                if (!otherUid || otherUid === userId) {
                    this.showToast('Esse convite nao pode ser aceito por esta conta.', 'error');
                    return;
                }
                if (invite.status && invite.status !== 'active') {
                    this.showToast('Esse convite nao esta ativo.', 'error');
                    return;
                }
                const nowIso = new Date().toISOString();
                const myDocSnap = await getDoc(this.getSocialConnectionsDocRef(userId));
                const myConnections = this.normalizeSocialConnectionMap(myDocSnap.exists() ? (myDocSnap.data()?.connections || {}) : {});
                myConnections[otherUid] = {
                    uid: otherUid,
                    status: 'pending_outgoing',
                    source: 'invite',
                    inviteCode: code,
                    requestedAt: nowIso,
                    acceptedAt: '',
                    removedAt: ''
                };
                await setDoc(this.getSocialConnectionsDocRef(userId), {
                    connections: myConnections,
                    updatedAt: serverTimestamp()
                }, { merge: true });

                const eventId = `invite_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                await setDoc(this.getSocialInboxDocRef(otherUid, eventId), {
                    type: 'invite_request',
                    sourceUid: userId,
                    sourceName: window.sistemaVidaState.profile?.name || 'Usuario',
                    targetUid: otherUid,
                    inviteCode: code,
                    status: 'pending',
                    readAt: '',
                    createdAt: new Date().toISOString()
                }, { merge: false });

                window.sistemaVidaState.profile.social.connections[otherUid] = myConnections[otherUid];
                await this.refreshSocialConnectionProfiles();
                this.saveState(true);
                this.renderSocialConnectionsPanel();
                this.showToast('Pedido enviado. A conexao ativa apos aceite final do dono do codigo.', 'success');
            } catch (err) {
                console.warn('[SOCIAL] Falha ao aceitar convite:', err);
                this.showToast('Nao consegui aceitar o codigo. Confira se ele esta correto e tente novamente.', 'error');
            }
        },

        handleSocialInviteDecision: async function(eventId, sourceUid, accept) {
            this.ensureSocialState();
            const userId = this.getActiveUserId();
            if (!userId || !sourceUid) return;
            const nowIso = new Date().toISOString();
            const meSnap = await getDoc(this.getSocialConnectionsDocRef(userId));
            const meConnections = this.normalizeSocialConnectionMap(meSnap.exists() ? (meSnap.data()?.connections || {}) : {});
            meConnections[sourceUid] = {
                uid: sourceUid,
                status: accept ? 'active' : 'removed',
                source: 'invite',
                inviteCode: String(meConnections[sourceUid]?.inviteCode || ''),
                requestedAt: String(meConnections[sourceUid]?.requestedAt || nowIso),
                acceptedAt: accept ? nowIso : '',
                removedAt: accept ? '' : nowIso
            };
            await setDoc(this.getSocialConnectionsDocRef(userId), { connections: meConnections, updatedAt: serverTimestamp() }, { merge: true });

            const sourceSnap = await getDoc(this.getSocialConnectionsDocRef(sourceUid));
            const sourceConnections = this.normalizeSocialConnectionMap(sourceSnap.exists() ? (sourceSnap.data()?.connections || {}) : {});
            sourceConnections[userId] = {
                uid: userId,
                status: accept ? 'active' : 'removed',
                source: 'invite',
                inviteCode: String(sourceConnections[userId]?.inviteCode || ''),
                requestedAt: String(sourceConnections[userId]?.requestedAt || nowIso),
                acceptedAt: accept ? nowIso : '',
                removedAt: accept ? '' : nowIso
            };
            await setDoc(this.getSocialConnectionsDocRef(sourceUid), { connections: sourceConnections, updatedAt: serverTimestamp() }, { merge: true });

            await setDoc(this.getSocialInboxDocRef(userId, eventId), {
                status: accept ? 'accepted' : 'declined',
                readAt: nowIso
            }, { merge: true });
            this.showToast(accept ? 'Conexao ativada.' : 'Convite recusado.', accept ? 'success' : 'warning');
            this.renderSocialConnectionsPanel();
        },

        removeSocialConnection: async function(otherUid) {
            this.ensureSocialState();
            const userId = this.getActiveUserId();
            const target = String(otherUid || '');
            if (!target || !userId || userId === LOCAL_USER_SCOPE || auth.currentUser?.isAnonymous) return;
            const removed = { uid: target, status: 'removed', removedAt: new Date().toISOString() };
            const reciprocal = { uid: userId, status: 'removed', removedAt: new Date().toISOString() };
            await setDoc(this.getSocialConnectionsDocRef(userId), {
                connections: { [target]: removed },
                updatedAt: serverTimestamp()
            }, { merge: true });
            await setDoc(this.getSocialConnectionsDocRef(target), {
                connections: { [userId]: reciprocal },
                updatedAt: serverTimestamp()
            }, { merge: true });
            window.sistemaVidaState.profile.social.connections[target] = removed;
            delete window.sistemaVidaState.profile.social.connectionProfiles[target];
            this.saveState(true);
            this.renderSocialConnectionsPanel();
            this.showToast('Conexao removida dos dois lados.', 'success');
        },

        refreshSocialConnectionProfiles: async function() {
            this.ensureSocialState();
            const ids = this.getSocialActiveConnectionIds();
            const profiles = window.sistemaVidaState.profile.social.connectionProfiles || {};
            await Promise.all(ids.map(async (uid) => {
                try {
                    const snap = await getDoc(this.getSocialPublicProfileDocRef(uid));
                    if (snap.exists()) profiles[uid] = { uid, visible: true, ...snap.data() };
                    else profiles[uid] = { uid, visible: false };
                } catch (err) {
                    profiles[uid] = { uid, visible: false, error: true };
                }
            }));
            window.sistemaVidaState.profile.social.connectionProfiles = profiles;
        },

        sendSocialReaction: async function(targetUid, reactionType, contextType = '', contextId = '', contextTitle = '') {
            this.ensureSocialState();
            const uid = String(targetUid || '');
            const type = SOCIAL_REACTIONS[reactionType] ? reactionType : 'strength';
            const safeDecode = (value) => {
                try { return decodeURIComponent(String(value || '')); } catch (_) { return String(value || ''); }
            };
            if (!uid) return;
            const conn = this.normalizeSocialConnectionMap(window.sistemaVidaState.profile.social.connections || {})[uid];
            if (!conn || conn.status !== 'active') {
                this.showToast('Reacoes so funcionam com conexoes ativas.', 'warning');
                return;
            }
            const reaction = {
                id: `reaction_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                targetUid: uid,
                type,
                label: SOCIAL_REACTIONS[type].label,
                contextType: safeDecode(contextType),
                contextId: safeDecode(contextId),
                contextTitle: safeDecode(contextTitle),
                sentAt: new Date().toISOString()
            };
            const reactions = window.sistemaVidaState.profile.social.reactions;
            if (!Array.isArray(reactions.sent)) reactions.sent = [];
            reactions.sent.unshift(reaction);
            reactions.sent = reactions.sent.slice(0, 80);
            const eventId = `reaction_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            await setDoc(this.getSocialInboxDocRef(uid, eventId), {
                type: 'reaction',
                sourceUid: this.getActiveUserId(),
                sourceName: window.sistemaVidaState.profile?.name || 'Usuario',
                targetUid: uid,
                reactionType: type,
                status: 'new',
                readAt: '',
                createdAt: reaction.sentAt,
                payload: {
                    contextType: reaction.contextType,
                    contextId: reaction.contextId,
                    contextTitle: reaction.contextTitle
                }
            }, { merge: false });
            await this.persistSocialEngagement();
            this.renderSocialConnectionsPanel();
            this.showToast(`${SOCIAL_REACTIONS[type].label} enviado.`, 'success');
        },

        getSocialChallengeWeekKey: function() {
            return this._getWeekKey ? this._getWeekKey() : new Date().toISOString().slice(0, 10);
        },

        createSocialWeeklyChallenge: async function(challengeType = 'key_habits_3') {
            this.ensureSocialState();
            const type = SOCIAL_CHALLENGES[challengeType] ? challengeType : 'key_habits_3';
            const ids = this.getSocialActiveConnectionIds();
            if (!ids.length) {
                this.showToast('Adicione uma conexao antes de criar desafio.', 'error');
                return;
            }
            const weekKey = this.getSocialChallengeWeekKey();
            const challenge = {
                id: `challenge_${weekKey}_${type}`,
                type,
                label: SOCIAL_CHALLENGES[type].label,
                status: 'pending',
                weekKey,
                participants: [this.getActiveUserId(), ...ids].filter(Boolean),
                createdAt: new Date().toISOString(),
                acceptedAt: ''
            };
            window.sistemaVidaState.profile.social.challenges[challenge.id] = challenge;
            await this.persistSocialEngagement();
            this.renderSocialConnectionsPanel();
            this.showToast('Desafio semanal criado.', 'success');
        },

        acceptSocialChallenge: async function(challengeId) {
            this.ensureSocialState();
            const challenge = window.sistemaVidaState.profile.social.challenges?.[challengeId];
            if (!challenge) return;
            challenge.status = 'accepted';
            challenge.acceptedAt = new Date().toISOString();
            await this.persistSocialEngagement();
            this.renderSocialConnectionsPanel();
            this.showToast('Desafio aceito.', 'success');
        },

        getSocialCollectiveMetrics: function() {
            const own = this.buildPublicProfilePayload();
            const profiles = Object.values(window.sistemaVidaState.profile?.social?.connectionProfiles || {})
                .filter((profile) => profile?.visible);
            const all = [own, ...profiles];
            return {
                people: all.length,
                collectiveXp: all.reduce((sum, item) => sum + (Number(item.xp) || 0), 0),
                keyHabitsDone: all.reduce((sum, item) => sum + (Number(item.keyHabitsDone) || 0), 0),
                sharedStreak: all.reduce((sum, item) => sum + (Number(item.streak) || 0), 0)
            };
        },

        getSocialChallengeProgress: function(challenge) {
            const cfg = SOCIAL_CHALLENGES[challenge?.type] || SOCIAL_CHALLENGES.key_habits_3;
            const metrics = this.getSocialCollectiveMetrics();
            const value = Math.max(0, Number(metrics[cfg.metric]) || 0);
            const target = Math.max(1, Number(cfg.target) || 1);
            return { value, target, pct: Math.min(100, Math.round((value / target) * 100)) };
        },

        persistSocialEngagement: async function() {
            this.ensureSocialState();
            this.saveState(true);
            const userId = this.getActiveUserId();
            if (!this.isSocialFeatureEnabled() || !userId || userId === LOCAL_USER_SCOPE || auth.currentUser?.isAnonymous) return false;
            const social = window.sistemaVidaState.profile.social;
            await setDoc(this.getSocialEngagementDocRef(userId), {
                reactions: social.reactions || {},
                challenges: social.challenges || {},
                updatedAt: serverTimestamp()
            }, { merge: true });
            return true;
        },

        toggleSocialSharing: async function() {
            this.ensureSocialState();
            if (!this.isSocialFeatureEnabled()) {
                this.showToast('Base social ainda esta em modo interno.', 'error');
                return;
            }
            const social = window.sistemaVidaState.profile.social;
            social.sharingEnabled = !social.sharingEnabled;
            if (social.sharingEnabled) {
                const published = await this.publishSocialProfile();
                if (published) this.showToast('Compartilhamento ativado.', 'success');
            } else {
                await this.deleteSocialPublicProfile();
                this.showToast('Compartilhamento desativado e perfil publico removido.', 'success');
            }
            this.saveState(true);
            if (this.currentView === 'perfil' && this.render?.perfil) this.render.perfil();
        },

        setSocialVisibility: async function(key, enabled) {
            this.ensureSocialState();
            if (!(key in DEFAULT_SOCIAL_VISIBILITY)) return;
            window.sistemaVidaState.profile.social.visibility[key] = !!enabled;
            if (window.sistemaVidaState.profile.social.sharingEnabled && this.isSocialFeatureEnabled()) {
                await this.publishSocialProfile({ silent: true });
            }
            this.saveState(true);
            this.renderSocialPrivacyPanel();
        },

        publishSocialProfile: async function(options = {}) {
            this.ensureSocialState();
            if (!this.isSocialFeatureEnabled()) return false;
            const userId = this.getActiveUserId();
            if (!userId || userId === LOCAL_USER_SCOPE || auth.currentUser?.isAnonymous) {
                window.sistemaVidaState.profile.social.sharingEnabled = false;
                if (!options.silent) this.showToast('Entre em uma conta para criar perfil publico.', 'error');
                return false;
            }
            const payload = this.buildPublicProfilePayload();
            const now = new Date().toISOString();
            await setDoc(this.getSocialPublicProfileDocRef(userId), {
                ...payload,
                updatedAt: serverTimestamp()
            }, { merge: false });
            await setDoc(this.getSocialPrivateDocRef(userId), {
                sharingEnabled: true,
                visibility: { ...window.sistemaVidaState.profile.social.visibility },
                updatedAt: serverTimestamp()
            }, { merge: true });
            window.sistemaVidaState.profile.social.publicProfileId = userId;
            window.sistemaVidaState.profile.social.lastPublishedAt = now;
            return true;
        },

        deleteSocialPublicProfile: async function() {
            this.ensureSocialState();
            const userId = this.getActiveUserId();
            window.sistemaVidaState.profile.social.sharingEnabled = false;
            window.sistemaVidaState.profile.social.lastDisabledAt = new Date().toISOString();
            if (!userId || userId === LOCAL_USER_SCOPE || auth.currentUser?.isAnonymous) return true;
            try { await deleteDoc(this.getSocialPublicProfileDocRef(userId)); } catch (err) { console.warn('[SOCIAL] Falha ao apagar public/profile:', err); }
            try {
                await setDoc(this.getSocialPrivateDocRef(userId), {
                    sharingEnabled: false,
                    visibility: { ...window.sistemaVidaState.profile.social.visibility },
                    disabledAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                }, { merge: true });
            } catch (err) {
                console.warn('[SOCIAL] Falha ao atualizar private/social:', err);
            }
            return true;
        },

        syncSocialPublicProfileIfNeeded: async function() {
            this.ensureSocialState();
            if (!this.isSocialFeatureEnabled()) return false;
            if (!window.sistemaVidaState.profile.social.sharingEnabled) return false;
            return this.publishSocialProfile({ silent: true });
        },

        renderSocialPrivacyPanel: function() {
            this.renderSocialAccessPanel();
            this.renderAppNotificationCenter();
            const section = document.getElementById('social-privacy-section');
            if (!section) return;
            this.ensureSocialState();
            const enabled = this.isSocialFeatureEnabled();
            section.classList.toggle('hidden', !enabled);
            if (!enabled) return;

            const social = window.sistemaVidaState.profile.social;
            const sharing = !!social.sharingEnabled;
            const track = document.getElementById('social-share-toggle-track');
            const knob = document.getElementById('social-share-toggle-knob');
            if (track && knob) {
                track.className = `w-10 h-5 rounded-full relative flex items-center px-1 transition-colors ${sharing ? 'bg-primary/30' : 'bg-outline-variant/40'}`;
                knob.className = `w-3 h-3 rounded-full absolute transition-all ${sharing ? 'right-1 bg-primary' : 'left-1 bg-outline'}`;
            }

            const status = document.getElementById('social-share-status');
            if (status) {
                const canPublish = this.getActiveUserId() !== LOCAL_USER_SCOPE && !auth.currentUser?.isAnonymous;
                status.textContent = sharing
                    ? 'Ativo. O preview abaixo mostra tudo que pode ficar publico.'
                    : canPublish
                        ? 'Desativado. Nada e publicado enquanto o opt-in estiver desligado.'
                        : 'Desativado. Entre em uma conta para publicar um perfil social.';
                status.className = sharing ? 'text-xs text-primary leading-relaxed' : 'text-xs text-outline leading-relaxed';
            }

            const toggles = document.getElementById('social-visibility-toggles');
            if (toggles) {
                toggles.innerHTML = Object.entries(SOCIAL_FIELD_LABELS).map(([key, label]) => {
                    const checked = social.visibility?.[key] !== false;
                    return `<label class="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low px-3 py-2.5 border border-outline-variant/10">
                        <span class="text-xs font-semibold text-on-surface">${this.escapeHtml(label)}</span>
                        <input type="checkbox" ${checked ? 'checked' : ''} onchange="window.app.setSocialVisibility('${key}', this.checked)" class="accent-primary">
                    </label>`;
                }).join('');
            }

            const preview = document.getElementById('social-public-preview');
            if (preview) {
                const rows = this.getSocialPreviewRows();
                preview.innerHTML = rows.length
                    ? rows.map((row) => `<div class="flex items-center justify-between gap-3 py-2 border-b border-outline-variant/10 last:border-b-0">
                        <span class="text-[11px] font-bold uppercase tracking-wider text-outline">${this.escapeHtml(row.label)}</span>
                        <span class="text-xs text-on-surface text-right">${this.escapeHtml(row.value)}</span>
                    </div>`).join('')
                    : '<p class="text-xs text-outline italic">Nenhum campo selecionado para publicar.</p>';
            }

            this.startSocialConnectionsListener();
            this.renderSocialConnectionsPanel();
        },

        renderSocialAccessPanel: function() {
            const section = document.getElementById('social-access-section');
            if (!section) return;
            this.ensureSocialState();

            const enabled = this.isSocialFeatureEnabled();
            const signedAccount = this.getActiveUserId() !== LOCAL_USER_SCOPE && !auth.currentUser?.isAnonymous;

            const statusEl = document.getElementById('social-access-status');
            if (statusEl) {
                statusEl.textContent = enabled
                    ? 'Fases sociais ativas neste perfil. As secoes de privacidade, conexoes e desafios aparecem logo abaixo.'
                    : 'Fases sociais instaladas, mas ainda ocultas neste perfil. Ative para liberar compartilhamento, convites e desafios.';
                statusEl.className = enabled ? 'text-xs text-primary leading-relaxed' : 'text-xs text-outline leading-relaxed';
            }

            const hintEl = document.getElementById('social-access-hint');
            if (hintEl) {
                hintEl.textContent = signedAccount
                    ? 'Para usar com outra pessoa, ative a area social e depois ligue o compartilhamento publico.'
                    : 'Entre em uma conta antes de compartilhar perfil, gerar codigo ou aceitar convites.';
            }

            const button = document.getElementById('social-access-toggle');
            if (button) {
                button.textContent = enabled ? 'Ocultar area social' : 'Ativar area social';
                button.className = enabled
                    ? 'h-10 px-4 rounded-xl bg-primary text-on-primary text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity'
                    : 'h-10 px-4 rounded-xl bg-surface-container-high text-primary border border-primary/20 text-xs font-bold uppercase tracking-wider hover:bg-primary/10 transition-colors';
                button.onclick = () => this.setSocialFeatureEnabled(!enabled);
            }

            const badge = document.getElementById('social-access-badge');
            if (badge) {
                badge.textContent = enabled ? 'Ativo' : 'Oculto';
                badge.className = enabled
                    ? 'inline-flex items-center rounded-full bg-primary/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-primary'
                    : 'inline-flex items-center rounded-full bg-surface-container-high px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-outline';
            }
        },

        renderSocialConnectionsPanel: function() {
            const section = document.getElementById('social-connections-section');
            if (!section) return;
            this.ensureSocialState();
            const enabled = this.isSocialFeatureEnabled();
            section.classList.toggle('hidden', !enabled);
            if (!enabled) return;

            const inviteCode = window.sistemaVidaState.profile.social.invites?.lastCode || '';
            const inviteEl = document.getElementById('social-current-invite-code');
            if (inviteEl) inviteEl.textContent = inviteCode || 'Sem codigo ativo';

            const profiles = window.sistemaVidaState.profile.social.connectionProfiles || {};
            const connectionsMap = this.normalizeSocialConnectionMap(window.sistemaVidaState.profile.social.connections || {});
            const ids = Object.keys(connectionsMap).filter((uid) => connectionsMap[uid]?.status !== 'removed');
            const list = document.getElementById('social-connections-list');
            if (list) {
                list.innerHTML = ids.length ? ids.map((uid) => {
                    const conn = connectionsMap[uid] || {};
                    const profile = profiles[uid] || { uid, visible: false };
                    const isActive = conn.status === 'active';
                    const visible = isActive && profile.visible !== false && profile.sharingEnabled !== false;
                    const name = visible ? (profile.name || 'Companheiro') : 'Companheiro privado';
                    const activeLabel = !isActive
                        ? (conn.status === 'pending_outgoing' ? 'aguardando aceite' : 'convite pendente')
                        : (visible && profile.lastActiveAt ? 'ativo hoje' : 'visibilidade indisponivel');
                    const achievements = Array.isArray(profile.achievements) ? profile.achievements : [];
                    const dimensions = profile.dimensionLevels && typeof profile.dimensionLevels === 'object'
                        ? Object.entries(profile.dimensionLevels)
                        : [];
                    const recentHighlights = Array.isArray(profile.recentHighlights) ? profile.recentHighlights : [];
                    const infoRows = [];
                    if (profile.xp !== undefined) infoRows.push(['XP pessoal', Number(profile.xp || 0)]);
                    if (profile.keyHabitsDone !== undefined) infoRows.push(['Habitos-chave', Number(profile.keyHabitsDone || 0)]);
                    if (profile.streak !== undefined) infoRows.push(['Sequencia pessoal', `${Number(profile.streak || 0)} dia(s)`]);
                    if (profile.lastActiveAt) infoRows.push(['Ultima atividade', 'Agora']);
                    const summaryRows = infoRows.length ? `<div class="grid grid-cols-2 gap-2 text-center">${infoRows.map(([label, value]) => `<div class="rounded-lg bg-surface-container-high p-2"><p class="text-[10px] text-outline">${this.escapeHtml(label)}</p><p class="text-xs font-bold text-on-surface">${this.escapeHtml(value)}</p></div>`).join('')}</div>` : '';
                    const identitySection = visible && (dimensions.length || profile.level !== undefined)
                        ? `<details class="group rounded-xl border border-outline-variant/10 bg-surface-container-lowest">
                            <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
                                <div>
                                    <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-outline">Identidade e niveis</p>
                                    <p class="text-xs text-on-surface-variant">${dimensions.length ? `${dimensions.length} dimensao(oes) publicadas` : `Nivel ${this.escapeHtml(profile.level || 1)}`}</p>
                                </div>
                                <span class="material-symbols-outlined notranslate text-outline transition-transform group-open:rotate-180">expand_more</span>
                            </summary>
                            <div class="px-3 pb-3 space-y-3">
                                <div class="rounded-xl bg-surface-container-high px-3 py-2">
                                    <p class="text-[10px] font-bold uppercase tracking-[0.14em] text-outline">Nivel geral</p>
                                    <p class="mt-1 text-sm font-bold text-on-surface">Nivel ${this.escapeHtml(profile.level || 1)}</p>
                                </div>
                                ${dimensions.length ? `<div class="grid grid-cols-2 gap-2">${dimensions.map(([dimensionName, item]) => {
                                    const level = Number(item?.level || 1);
                                    const identity = this.getDimensionIdentity ? this.getDimensionIdentity(dimensionName, level) : { title: `Nivel ${level}`, icon: 'stars' };
                                    return `<div class="rounded-lg border border-outline-variant/10 bg-surface-container-high px-2.5 py-2 min-w-0">
                                        <div class="flex items-start justify-between gap-2">
                                            <div class="min-w-0 flex-1">
                                                <p class="text-[9px] font-bold uppercase tracking-[0.14em] text-outline truncate">${this.escapeHtml(dimensionName)}</p>
                                                <p class="mt-0.5 text-[11px] font-bold text-on-surface truncate">${this.escapeHtml(identity.title)}</p>
                                            </div>
                                            <span class="material-symbols-outlined notranslate text-primary text-[16px] shrink-0">${this.escapeHtml(identity.icon || 'stars')}</span>
                                        </div>
                                        <p class="mt-1 text-[10px] text-primary font-semibold">Nivel ${level}</p>
                                    </div>`;
                                }).join('')}</div>` : ''}
                            </div>
                        </details>`
                        : '';
                    const achievementItems = [
                        ...achievements.map((ach) => ({
                            id: `achievement_${ach.id || ach.title || ''}`,
                            type: 'achievement',
                            title: ach.title || 'Conquista',
                            subtitle: 'Conquista recente',
                            createdAt: ach.unlockedAt || ''
                        })),
                        ...recentHighlights.map((item) => ({
                            id: item.id || `${item.type || 'highlight'}_${item.createdAt || ''}`,
                            type: item.type || 'highlight',
                            sourceType: item.sourceType || '',
                            title: item.title || 'Destaque recente',
                            subtitle: item.subtitle || 'Movimento recente',
                            createdAt: item.createdAt || ''
                        }))
                    ]
                        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
                        .slice(0, 6);
                    const achievementsSection = visible && (Array.isArray(profile.achievements) || recentHighlights.length)
                        ? `<details class="group rounded-xl border border-outline-variant/10 bg-surface-container-lowest">
                            <summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
                                <div>
                                    <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-outline">Conquistas</p>
                                    <p class="text-xs text-on-surface-variant">${achievementItems.length ? `${achievementItems.length} conquista(s) ou destaque(s)` : 'Sem conquistas publicadas'}</p>
                                </div>
                                <span class="material-symbols-outlined notranslate text-outline transition-transform group-open:rotate-180">expand_more</span>
                            </summary>
                            <div class="px-3 pb-3 space-y-2">
                                ${achievementItems.length ? achievementItems.map((item) => `<div class="rounded-xl bg-surface-container-high px-3 py-2.5 space-y-2">
                                    <div class="flex items-center gap-3">
                                        <span class="material-symbols-outlined notranslate text-primary text-[18px]">${item.type === 'achievement' ? 'military_tech' : 'bolt'}</span>
                                        <div class="min-w-0 flex-1">
                                            <p class="text-xs font-bold text-on-surface">${this.escapeHtml(item.title || 'Conquista')}</p>
                                            <p class="text-[10px] text-outline">${this.escapeHtml(item.subtitle || '')}${item.subtitle ? ' · ' : ''}${this.escapeHtml(this.formatSocialTimestamp(item.createdAt))}</p>
                                        </div>
                                    </div>
                                    ${isActive ? `<div class="flex flex-wrap gap-2">
                                        ${Object.entries(SOCIAL_REACTIONS).map(([type, cfg]) => `<button type="button" title="${this.escapeHtml(cfg.label)}" aria-label="${this.escapeHtml(cfg.label)}" onclick="window.app.sendSocialReaction('${this.escapeHtml(uid)}','${type}','${encodeURIComponent(String(item.type || ''))}','${encodeURIComponent(String(item.id || ''))}','${encodeURIComponent(String(item.title || ''))}')" class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/60 dark:bg-surface-container-low border border-primary/15 text-base hover:bg-primary/10"><span aria-hidden="true">${cfg.emoji}</span></button>`).join('')}
                                    </div>` : ''}
                                </div>`).join('') : `<p class="rounded-xl bg-surface-container-high px-3 py-2 text-xs text-outline">Sem conquistas publicadas neste perfil.</p>`}
                            </div>
                        </details>`
                        : '';
                    return `<div class="rounded-xl bg-surface-container-low p-4 border border-outline-variant/10 space-y-3">
                        <div class="flex items-start justify-between gap-3">
                            <div class="flex items-center gap-3 min-w-0">
                                <div class="w-10 h-10 rounded-full bg-surface-container-high overflow-hidden flex items-center justify-center shrink-0">
                                    ${visible && profile.avatarUrl ? `<img src="${this.escapeHtml(profile.avatarUrl)}" alt="" class="w-full h-full object-cover">` : '<span class="material-symbols-outlined notranslate text-outline text-[20px]">account_circle</span>'}
                                </div>
                                <div class="min-w-0">
                                    <p class="text-sm font-bold text-on-surface truncate">${this.escapeHtml(name)}</p>
                                    <p class="text-[10px] text-outline uppercase tracking-wider">Nivel ${visible ? this.escapeHtml(profile.level || 1) : '-'} · ${this.escapeHtml(activeLabel)}</p>
                                </div>
                            </div>
                            <button type="button" onclick="window.app.removeSocialConnection('${this.escapeHtml(uid)}')" class="text-outline hover:text-error transition-colors" title="Remover conexao">
                                <span class="material-symbols-outlined notranslate text-[18px]">person_remove</span>
                            </button>
                        </div>
                        ${summaryRows}
                        ${identitySection}
                        ${achievementsSection}
                    </div>`;
                }).join('') : '<p class="text-xs text-outline italic">Nenhum companheiro conectado ainda.</p>';
            }

            const metrics = this.getSocialCollectiveMetrics();
            const metricsEl = document.getElementById('social-collective-metrics');
            if (metricsEl) {
                metricsEl.innerHTML = [
                    ['Pessoas', metrics.people],
                    ['XP do grupo', metrics.collectiveXp],
                    ['Habitos-chave', metrics.keyHabitsDone],
                    ['Dias em sequencia no grupo', `${metrics.sharedStreak} dia(s)`]
                ].map(([label, value]) => `<div class="rounded-lg bg-surface-container-low p-3"><p class="text-[10px] text-outline uppercase tracking-wider">${label}</p><p class="text-sm font-bold text-on-surface">${value}</p></div>`).join('');
            }

            const challengesEl = document.getElementById('social-challenges-list');
            if (challengesEl) {
                const challenges = Object.values(window.sistemaVidaState.profile.social.challenges || {})
                    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
                    .slice(0, 4);
                challengesEl.innerHTML = challenges.length ? challenges.map((challenge) => {
                    const progress = this.getSocialChallengeProgress(challenge);
                    return `<div class="rounded-xl bg-surface-container-low p-4 border border-outline-variant/10">
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <p class="text-sm font-bold text-on-surface">${this.escapeHtml(challenge.label || 'Desafio semanal')}</p>
                                <p class="text-[10px] text-outline uppercase tracking-wider">${this.escapeHtml(challenge.weekKey || '')} · ${challenge.status === 'accepted' ? 'aceito' : 'pendente'}</p>
                            </div>
                            ${challenge.status === 'accepted' ? '<span class="material-symbols-outlined notranslate text-primary text-[18px]">check_circle</span>' : `<button type="button" onclick="window.app.acceptSocialChallenge('${this.escapeHtml(challenge.id)}')" class="text-[10px] font-bold uppercase tracking-wider text-primary">Aceitar</button>`}
                        </div>
                        <div class="mt-3 h-1.5 rounded-full bg-outline-variant/20 overflow-hidden"><div class="h-full bg-primary rounded-full" style="width:${progress.pct}%"></div></div>
                        <p class="mt-2 text-[10px] text-outline">${progress.value}/${progress.target}</p>
                    </div>`;
                }).join('') : '<p class="text-xs text-outline italic">Nenhum desafio criado ainda.</p>';
            }

            const reactionsEl = document.getElementById('social-reactions-list');
            if (reactionsEl) {
                const sent = Array.isArray(window.sistemaVidaState.profile.social.reactions?.sent)
                    ? window.sistemaVidaState.profile.social.reactions.sent.slice(0, 6)
                    : [];
                reactionsEl.innerHTML = sent.length ? sent.map((reaction) => {
                    const cfg = SOCIAL_REACTIONS[reaction.type] || SOCIAL_REACTIONS.strength;
                    const profile = profiles[reaction.targetUid] || {};
                    return `<div class="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3 border border-outline-variant/10">
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="material-symbols-outlined notranslate text-primary text-[16px]">${cfg.icon}</span>
                            <span class="text-xs text-on-surface truncate">${this.escapeHtml(cfg.label)} para ${this.escapeHtml(profile.name || 'companheiro')}</span>
                        </div>
                        <span class="text-[10px] text-outline shrink-0">${this.escapeHtml(String(reaction.sentAt || '').slice(0, 10))}</span>
                    </div>`;
                }).join('') : '<p class="text-xs text-outline italic">Nenhuma reacao enviada ainda.</p>';
            }
            this.renderAppNotificationCenter();
        }
    });
}

