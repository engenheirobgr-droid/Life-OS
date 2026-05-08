export function attachGamificationModule(app) {
    Object.assign(app, {
getDimensionProgressionCatalog: function() {
        return {
            'Saúde': {
                tone: '#10b981',
                stages: [
                    ['airline_seat_recline_normal', 'Sedentário'],
                    ['self_improvement', 'Despertando'],
                    ['directions_walk', 'Em movimento'],
                    ['exercise', 'Ritmo'],
                    ['fitness_center', 'Treinando'],
                    ['monitor_heart', 'Condicionado'],
                    ['bolt', 'Energizado'],
                    ['directions_run', 'Atlético'],
                    ['favorite', 'Vital'],
                    ['workspace_premium', 'Imparável']
                ]
            },
            'Mente': {
                tone: '#0ea5e9',
                stages: [
                    ['search', 'Curioso'],
                    ['menu_book', 'Leitor'],
                    ['school', 'Estudioso'],
                    ['psychology_alt', 'Analítico'],
                    ['lightbulb', 'Reflexivo'],
                    ['neurology', 'Criativo'],
                    ['schema', 'Estrategista'],
                    ['psychology', 'Sábio'],
                    ['explore', 'Visionário'],
                    ['auto_awesome', 'Luminar']
                ]
            },
            'Carreira': {
                tone: '#6366f1',
                stages: [
                    ['school', 'Aprendiz'],
                    ['build', 'Executor'],
                    ['inventory_2', 'Criador'],
                    ['assignment', 'Organizador'],
                    ['architecture', 'Construtor'],
                    ['verified', 'Especialista'],
                    ['supervisor_account', 'Líder'],
                    ['business_center', 'Diretor'],
                    ['rocket_launch', 'Visionário'],
                    ['military_tech', 'Referência']
                ]
            },
            'Finanças': {
                tone: '#059669',
                stages: [
                    ['account_balance_wallet', 'Administrador'],
                    ['savings', 'Poupador'],
                    ['receipt_long', 'Controlado'],
                    ['calculate', 'Planejador'],
                    ['shield', 'Estável'],
                    ['monitoring', 'Estrategista'],
                    ['trending_up', 'Investidor'],
                    ['paid', 'Multiplicador'],
                    ['diamond', 'Próspero'],
                    ['account_balance', 'Patrimonial']
                ]
            },
            'Relacionamentos': {
                tone: '#ec4899',
                stages: [
                    ['visibility', 'Presente'],
                    ['chat_bubble', 'Acessível'],
                    ['handshake', 'Confiável'],
                    ['groups', 'Vinculado'],
                    ['favorite', 'Afetuoso'],
                    ['diversity_2', 'Parceiro'],
                    ['hub', 'Conector'],
                    ['campaign', 'Influente'],
                    ['support_agent', 'Mentor'],
                    ['emoji_people', 'Catalisador']
                ]
            },
            'Família': {
                tone: '#f59e0b',
                stages: [
                    ['home', 'Presente'],
                    ['family_restroom', 'Cuidador'],
                    ['shield', 'Protetor'],
                    ['volunteer_activism', 'Apoio'],
                    ['night_shelter', 'Guardião'],
                    ['foundation', 'Pilar'],
                    ['workspace_premium', 'Referência'],
                    ['diversity_1', 'Elo'],
                    ['account_tree', 'Raiz'],
                    ['emoji_events', 'Legado']
                ]
            },
            'Lazer': {
                tone: '#8b5cf6',
                stages: [
                    ['tv', 'Espectador'],
                    ['sentiment_satisfied', 'Curioso'],
                    ['sports_esports', 'Brincante'],
                    ['explore', 'Explorador'],
                    ['hiking', 'Aventureiro'],
                    ['palette', 'Criativo'],
                    ['celebration', 'Entusiasta'],
                    ['music_note', 'Celebrador'],
                    ['theater_comedy', 'Artista'],
                    ['stars', 'Maestro']
                ]
            },
            'Propósito': {
                tone: '#0d9488',
                stages: [
                    ['search', 'Buscador'],
                    ['quiz', 'Questionador'],
                    ['travel_explore', 'Explorador'],
                    ['near_me', 'Direcionado'],
                    ['my_location', 'Alinhado'],
                    ['flag', 'Missionário'],
                    ['shield_with_heart', 'Guardião'],
                    ['flare', 'Guia'],
                    ['wb_incandescent', 'Inspirador'],
                    ['auto_awesome', 'Legado vivo']
                ]
            }
        };
    },

awardGamification: function(eventType, payload = {}) {
        const gamification = this.ensureGamificationState();
        const key = payload.key || `${eventType}:${payload.id || ''}:${payload.date || this.getLocalDateKey()}`;
        if (!key || gamification.events[key]) return null;

        let xp = 0;
        if (eventType === 'micro_complete') xp = 12 + (payload.planned ? 6 : 0) + (payload.inProgress ? 4 : 0);
        if (eventType === 'habit_complete') xp = payload.isKey ? 4 : 2;
        if (eventType === 'habit_recovery') xp = 3;
        if (eventType === 'deep_work') xp = Math.max(10, Math.min(40, Math.round((Number(payload.focusSec) || 0) / 300)));
        if (eventType === 'weekly_review') xp = 25;
        if (eventType === 'daily_checkin') xp = 10;
        if (eventType === 'daily_intention') xp = 5;
        if (eventType === 'daily_diary') xp = 8;
        if (eventType === 'daily_shutdown') xp = 8;
        if (eventType === 'weekly_plan') xp = 15;
        if (eventType === 'habit_complete' && payload.sourceStrengthId) xp += 1;
        if (eventType === 'habit_complete' && payload.sourceShadowId) xp += 2;
        if (eventType === 'habit_complete' && payload.hasIfThen) xp += 1;
        if (eventType === 'habit_complete' && payload.maturity === 'graduated') xp = Math.max(1, Math.round(xp * 0.5));
        if (eventType === 'weekly_review' && payload.identityReflection) xp += 5;
        if (xp <= 0) return null;

        const dimension = payload.dimension || '';
        const totalBefore = gamification.totalXp;
        const overallBefore = this.getOverallLevelProgress(gamification).level;
        const dimensionBefore = Math.max(0, Number(gamification.dimensionXp[dimension]) || 0);
        const allocation = this.allocateGamificationXp(xp, dimension);
        gamification.events[key] = {
            type: eventType,
            at: new Date().toISOString(),
            xp,
            dimension,
            dimensionShares: allocation,
            sourceType: payload.sourceType || '',
            sourceId: payload.sourceId || '',
            sourceStrengthId: payload.sourceStrengthId || '',
            sourceShadowId: payload.sourceShadowId || '',
            isKey: !!payload.isKey,
            habitMode: payload.habitMode || '',
            maturity: payload.maturity || ''
        };
        Object.entries(allocation).forEach(([dim, amount]) => {
            gamification.dimensionXp[dim] = Math.max(0, Number(gamification.dimensionXp[dim]) || 0) + (Number(amount) || 0);
        });
        gamification.totalXp = this.getGamificationDimensionKeys().reduce((sum, dim) => sum + (Number(gamification.dimensionXp[dim]) || 0), 0);
        gamification.recentEvents.unshift({
            type: eventType,
            title: payload.title || '',
            xp,
            dimension,
            dimensionShares: allocation,
            sourceType: payload.sourceType || '',
            sourceId: payload.sourceId || '',
            sourceStrengthId: payload.sourceStrengthId || '',
            sourceShadowId: payload.sourceShadowId || '',
            isKey: !!payload.isKey,
            maturity: payload.maturity || '',
            at: new Date().toISOString()
        });
        gamification.recentEvents = gamification.recentEvents.slice(0, 20);

        const unlocked = [];
        if (eventType === 'micro_complete') {
            const firstMicro = this.unlockAchievement('first_micro_done');
            if (firstMicro) unlocked.push(firstMicro);
            if (payload.planned) {
                const planned = this.unlockAchievement('first_planned_micro');
                if (planned) unlocked.push(planned);
            }
            // Progressive micro milestones
            const microsDoneTotal = Object.values(gamification.events).filter(e => e.type === 'micro_complete').length;
            const microMilestones = [
                { n: 5,   key: 'micros_5',   title: '5 ações concluídas',   icon: 'task_alt' },
                { n: 10,  key: 'micros_10',  title: '10 ações concluídas',  icon: 'task_alt' },
                { n: 25,  key: 'micros_25',  title: '25 ações concluídas',  icon: 'local_fire_department' },
                { n: 50,  key: 'micros_50',  title: '50 ações concluídas',  icon: 'local_fire_department' },
                { n: 100, key: 'micros_100', title: '100 ações concluídas', icon: 'military_tech' }
            ];
            microMilestones.forEach(({ n, key, title, icon }) => {
                if (microsDoneTotal >= n) {
                    const ach = this.unlockAchievement(key, { title, icon });
                    if (ach) unlocked.push(ach);
                }
            });
        }
        if (eventType === 'habit_complete') {
            const habit = this.unlockAchievement('first_habit_done');
            if (habit) unlocked.push(habit);
            // Progressive habit milestones
            const habitsDoneTotal = Object.values(gamification.events).filter(e => e.type === 'habit_complete').length;
            const habitMilestones = [
                { n: 7,   key: 'habits_7',   title: '7 registros de hábito',   icon: 'repeat' },
                { n: 30,  key: 'habits_30',  title: '30 registros de hábito',  icon: 'repeat_on' },
                { n: 100, key: 'habits_100', title: '100 registros de hábito', icon: 'military_tech' }
            ];
            habitMilestones.forEach(({ n, key, title, icon }) => {
                if (habitsDoneTotal >= n) {
                    const ach = this.unlockAchievement(key, { title, icon });
                    if (ach) unlocked.push(ach);
                }
            });
            // Key habit streak achievements
            if (payload.isKey && (payload.keyHabitStreak || 0) >= 7) {
                const ach7 = this.unlockAchievement('key_habit_streak_7', { title: '7 dias com Hábito-Chave', icon: 'local_fire_department' });
                if (ach7) unlocked.push(ach7);
            }
            if (payload.isKey && (payload.keyHabitStreak || 0) >= 30) {
                const ach30 = this.unlockAchievement('key_habit_streak_30', { title: '30 dias com Hábito-Chave', icon: 'military_tech' });
                if (ach30) unlocked.push(ach30);
            }
        }
        if (eventType === 'deep_work') {
            const focus = this.unlockAchievement('first_focus_session');
            if (focus) unlocked.push(focus);
        }
        if (eventType === 'weekly_review') {
            const review = this.unlockAchievement('first_weekly_review');
            if (review) unlocked.push(review);
        }
        if (eventType === 'daily_checkin') {
            // Progressive check-in milestones
            const checkinTotal = Object.values(gamification.events).filter(e => e.type === 'daily_checkin').length;
            const checkinMilestones = [
                { n: 7,  key: 'checkins_7',  title: '7 check-ins realizados',  icon: 'monitor_heart' },
                { n: 30, key: 'checkins_30', title: '30 check-ins realizados', icon: 'monitor_heart' }
            ];
            checkinMilestones.forEach(({ n, key, title, icon }) => {
                if (checkinTotal >= n) {
                    const ach = this.unlockAchievement(key, { title, icon });
                    if (ach) unlocked.push(ach);
                }
            });
        }
        const overallAfter = this.getOverallLevelProgress(gamification).level;
        if (overallBefore < 5 && overallAfter >= 5) {
            const total = this.unlockAchievement('total_level_5');
            if (total) unlocked.push(total);
        }
        const dimLevelAfter = dimension ? this.getLevelFromXp(gamification.dimensionXp[dimension]) : 0;
        const dimLevelBefore = this.getLevelFromXp(dimensionBefore);
        const tierBefore = this.getTierFromLevel(dimLevelBefore);
        const tierAfter = this.getTierFromLevel(dimLevelAfter);
        const tierPromotion = !!(dimension && tierAfter > tierBefore);

        if (dimension && dimLevelBefore < 3 && dimLevelAfter >= 3) {
            const identity = this.getDimensionIdentity(dimension, dimLevelAfter);
            const dimAchievement = this.unlockAchievement(`dimension_tier_2:${dimension}`, {
                title: `${identity.title} desbloqueado`,
                icon: identity.icon
            });
            if (dimAchievement) unlocked.push(dimAchievement);
        }
        if (dimension && dimLevelBefore < 6 && dimLevelAfter >= 6) {
            const identity = this.getDimensionIdentity(dimension, dimLevelAfter);
            const dimAchievement = this.unlockAchievement(`dimension_tier_3:${dimension}`, {
                title: `${identity.title} desbloqueado`,
                icon: identity.icon
            });
            if (dimAchievement) unlocked.push(dimAchievement);
        }
        if (dimension && dimLevelBefore < 10 && dimLevelAfter >= 10) {
            const identity = this.getDimensionIdentity(dimension, dimLevelAfter);
            const dimAchievement = this.unlockAchievement(`dimension_tier_4:${dimension}`, {
                title: `${identity.title} desbloqueado`,
                icon: identity.icon
            });
            if (dimAchievement) unlocked.push(dimAchievement);
        }
        if (dimension && dimLevelBefore < 15 && dimLevelAfter >= 15) {
            const identity = this.getDimensionIdentity(dimension, dimLevelAfter);
            const dimAchievement = this.unlockAchievement(`dimension_tier_5:${dimension}`, {
                title: `${identity.title} desbloqueado`,
                icon: identity.icon
            });
            if (dimAchievement) unlocked.push(dimAchievement);
        }
        if (eventType === 'habit_complete' || eventType === 'weekly_review') {
            this.syncIdentityLinkedHabits();
            const identityAchievements = this.evaluateIdentityAchievements();
            identityAchievements.forEach(ach => unlocked.push(ach));
        }

        if (!window.sistemaVidaState.profile) window.sistemaVidaState.profile = {};
        window.sistemaVidaState.profile.xp = gamification.totalXp;
        window.sistemaVidaState.profile.level = overallAfter;
        return {
            xp,
            dimension,
            sourceTitle: payload.title || '',
            eventType,
            identity: this.getDimensionIdentity(dimension, dimLevelAfter),
            totalLevel: overallAfter,
            dimensionLevel: dimLevelAfter || null,
            totalLeveledUp: overallBefore < overallAfter,
            dimensionLeveledUp: !!(dimension && dimLevelBefore < dimLevelAfter),
            tierPromotion,
            achievementsUnlocked: unlocked
        };
    },

showGamificationToast: function(result) {
        if (!result || !this.showToast) return;
        const tierPromotion = result.tierPromotion;
        const leveledUp = tierPromotion || result.totalLeveledUp || result.dimensionLeveledUp || result.achievementsUnlocked?.some(a => /desbloqueado|Sistema em movimento/i.test(a.title));

        // Contextual "why" prefix — shows what action earned the XP
        const sourceLabel = result.sourceTitle
            ? this.escapeHtml(result.sourceTitle).slice(0, 48) + (result.sourceTitle.length > 48 ? '…' : '')
            : null;
        const whyPrefix = sourceLabel || ({
            micro_complete: 'Ação concluída',
            habit_complete: 'Hábito registrado',
            daily_checkin:  'Check-in feito',
            daily_diary:    'Diário registrado',
            daily_shutdown: 'Shutdown feito',
            weekly_plan:    'Semana planejada',
            weekly_review:  'Revisão semanal',
            deep_work:      'Sessão de foco'
        })[result.eventType] || null;

        const openers = tierPromotion
            ? ['Novo título desbloqueado!', 'Você avançou de tier!', 'Promoção registrada!']
            : leveledUp
                ? ['Subiu de nível!', 'Novo patamar!', 'Evolução registrada!']
                : ['Boa execução!', 'Pequena vitória!', 'Consistência conta!'];
        const opener = openers[Math.floor(Math.random() * openers.length)];

        const parts = [];
        if (whyPrefix) parts.push(whyPrefix);
        parts.push(`${opener} +${result.xp} XP`);

        if (result.achievementsUnlocked && result.achievementsUnlocked.length) {
            parts.push(`Conquista: ${result.achievementsUnlocked[0].title}`);
        } else if (result.dimension && result.identity) {
            parts.push(tierPromotion
                ? `${result.dimension}: agora ${result.identity.title}`
                : `${result.identity.title} · nível ${result.dimensionLevel}`);
        } else {
            parts.push(`Sistema nível ${result.totalLevel}`);
        }

        this.showToast(parts.join(' · '), 'success');
        if (this.pushSocialInternalNotification) {
            this.pushSocialInternalNotification('xp_gain', {
                xp: result.xp,
                title: whyPrefix || 'Acao registrada',
                message: `+${result.xp} XP`
            }).catch(() => {});
            if (leveledUp) {
                this.pushSocialInternalNotification('level_up', {
                    level: result.totalLevel,
                    title: 'Subiu de nivel',
                    message: `Sistema nivel ${result.totalLevel}`
                }).catch(() => {});
            }
            if (result.achievementsUnlocked && result.achievementsUnlocked.length) {
                const first = result.achievementsUnlocked[0];
                this.pushSocialInternalNotification('achievement_unlock', {
                    title: first.title || 'Conquista desbloqueada',
                    icon: first.icon || 'military_tech',
                    message: first.title || 'Conquista desbloqueada'
                }).catch(() => {});
            }
        }
        this.showGamificationAwardEffects(result);
    },
    });
}
