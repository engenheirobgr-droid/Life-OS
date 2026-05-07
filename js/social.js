import { db, auth, doc, setDoc, deleteDoc, serverTimestamp, LOCAL_USER_SCOPE } from './firebase.js';

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
    xp: 'XP total',
    dimensionLevels: 'Niveis por dimensao',
    achievements: 'Conquistas',
    keyHabitsDone: 'Habitos-chave feitos',
    streak: 'Streak',
    lastActiveAt: 'Ultima atividade'
};

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
        },

        getSocialPublicProfileDocRef: function(userId = this.getActiveUserId()) {
            return doc(db, 'users', userId, 'public', 'profile');
        },

        getSocialPrivateDocRef: function(userId = this.getActiveUserId()) {
            return doc(db, 'users', userId, 'private', 'social');
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

        buildPublicProfilePayload: function() {
            this.ensureSocialState();
            const state = window.sistemaVidaState;
            const profile = state.profile || {};
            const social = profile.social || {};
            const visibility = social.visibility || DEFAULT_SOCIAL_VISIBILITY;
            const gamification = state.gamification || {};
            const totalXp = Math.max(0, Number(gamification.totalXp || profile.xp) || 0);
            const payload = {
                schemaVersion: 1,
                userId: this.getActiveUserId(),
                sharingEnabled: !!social.sharingEnabled,
                updatedAt: new Date().toISOString()
            };
            if (visibility.name) payload.name = String(profile.name || 'Usuario');
            if (visibility.avatar) payload.avatarUrl = String(profile.avatarUrl || '');
            if (visibility.level) payload.level = this.getLevelFromXp ? this.getLevelFromXp(totalXp) : Math.max(1, Number(profile.level) || 1);
            if (visibility.xp) payload.xp = totalXp;
            if (visibility.dimensionLevels) payload.dimensionLevels = this.getSocialDimensionLevels();
            if (visibility.achievements) payload.achievements = this.getSocialAchievementsPreview();
            if (visibility.keyHabitsDone) payload.keyHabitsDone = this.getSocialKeyHabitsDoneCount();
            if (visibility.streak) payload.streak = this.getSocialBestStreak();
            if (visibility.lastActiveAt) payload.lastActiveAt = new Date().toISOString();
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
                else if (Array.isArray(value)) value = value.length ? `${value.length} conquista(s)` : 'Nenhuma ainda';
                else if (value && typeof value === 'object') value = `${Object.keys(value).length} dimensao(oes)`;
                else if (key === 'lastActiveAt') value = 'Agora';
                rows.push({ key, label, value: String(value ?? '') });
            });
            return rows;
        },

        setSocialFeatureForLocalAudit: function(enabled) {
            this.ensureSocialState();
            window.sistemaVidaState.settings.features.social = !!enabled;
            this.saveState(true);
            if (this.currentView === 'perfil' && this.render?.perfil) this.render.perfil();
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
                    return `<label class="flex items-center justify-between gap-3 rounded-xl bg-surface-container-low p-3 border border-outline-variant/10">
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
        }
    });
}
