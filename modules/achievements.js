// modules/achievements.js

const AchievementsModule = {
  _allCache: null,
  _cacheVersion: 0,

  init: function() {
    if (typeof Logger !== 'undefined') Logger.log('Модуль достижений инициализирован', 'info');

    // Инвалидация кэша при изменении данных
    var self = this;
    if (typeof Events !== 'undefined' && Events.on) {
      Events.on('db:changed', function() { self.invalidateCache(); });
      Events.on('plan:changed', function() { self.invalidateCache(); });
      Events.on('history:changed', function() { self.invalidateCache(); });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { AchievementsModule.setup(); });
    } else {
      this.setup();
    }
  },

  setup: function() {
    this.createAchievementsScreen();
    if (typeof Core !== 'undefined') {
      Core.addNavButton('Достижения', 'achievements', '<i class="ph ph-trophy"></i>');
      Core.registerScreen('achievements', function() { AchievementsModule.createAchievementsScreen(); });
    }
  },

  invalidateCache: function() {
    this._allCache = null;
    this._cacheVersion++;
  },

  /* ---------- ЧТЕНИЕ ДАННЫХ (безопасное) ---------- */
  getStats: function() {
    if (typeof CoreData !== 'undefined' && CoreData.getStats) return CoreData.getStats();
    var defaults = { yes: 0, later: 0, no: 0, xp: 0, level: 1, streak: 0 };
    if (typeof FTStorage !== 'undefined' && FTStorage.get) {
      var s = FTStorage.get('stats') || {};
      for (var k in defaults) if (s[k] === undefined) s[k] = defaults[k];
      return s;
    }
    return defaults;
  },

  getHistory: function() {
    if (typeof CoreData !== 'undefined' && CoreData.getHistory) return CoreData.getHistory();
    if (typeof FTStorage !== 'undefined' && FTStorage.get) return FTStorage.get('history') || [];
    return [];
  },

  getDB: function() {
    if (typeof CoreData !== 'undefined' && CoreData.getDB) return CoreData.getDB();
    if (typeof FTStorage !== 'undefined' && FTStorage.get) return FTStorage.get('db') || [];
    return [];
  },

  getPlan: function() {
    if (typeof CoreData !== 'undefined' && CoreData.getPlan) return CoreData.getPlan();
    if (typeof FTStorage !== 'undefined' && FTStorage.get) return FTStorage.get('plan') || [];
    return [];
  },

  getUnlockedAchievements: function() {
    if (typeof FTStorage === 'undefined' || !FTStorage.get) return [];
    var a = FTStorage.get('unlocked_achievements');
    if (!Array.isArray(a)) return [];
    // Дедупликация на всякий случай
    var seen = {};
    var result = [];
    for (var i = 0; i < a.length; i++) {
      if (!seen[a[i]]) { seen[a[i]] = true; result.push(a[i]); }
    }
    return result;
  },

  saveUnlockedAchievements: function(a) {
    if (typeof FTStorage !== 'undefined' && FTStorage.set) FTStorage.set('unlocked_achievements', a);
  },

  /* ---------- СПИСОК ДОСТИЖЕНИЙ ---------- */
  getAllAchievements: function() {
    if (this._allCache) return this._allCache;
    var achievements = [];

    achievements.push({
      id: 'first_workout', name: 'Первый шаг', description: 'Заверши первую тренировку',
      icon: 'ph-shoe-prints',
      condition: function(s) { return (s.yes || 0) >= 1; }
    });
    achievements.push({
      id: 'exercises_added', name: 'Коллекционер', description: 'Добавь 5 упражнений в базу',
      icon: 'ph-books',
      condition: function() { return AchievementsModule.getDB().length >= 5; }
    });
    achievements.push({
      id: 'plan_filled', name: 'Планомерный', description: 'Заполни план на 5 дней',
      icon: 'ph-calendar',
      condition: function() {
        var plan = AchievementsModule.getPlan();
        var filled = 0;
        for (var i = 0; i < plan.length; i++) {
          if (plan[i] && plan[i].exercises && plan[i].exercises.length > 0) filled++;
        }
        return filled >= 5;
      }
    });
    achievements.push({
      id: 'survey_completed', name: 'Аналитик', description: 'Пройди опрос после тренировки',
      icon: 'ph-clipboard-text',
      condition: function(s, history) {
        for (var i = 0; i < history.length; i++) {
          if (history[i].survey && Object.keys(history[i].survey).length > 0) return true;
        }
        return false;
      }
    });

    // Вехи для тренировок
    var workoutTiers = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    workoutTiers.forEach(function(t) {
      achievements.push({
        id: 'workouts_' + t,
        name: 'Марафонец (' + t + ')',
        description: 'Заверши ' + t + ' тренировок',
        icon: 'ph-medal',
        _tier: { type: 'workouts', target: t },
        condition: function(s) { return (s.yes || 0) >= t; }
      });
    });

    // Вехи для уровней
    var levelTiers = [5, 10, 20, 30, 50, 75, 100];
    levelTiers.forEach(function(lv) {
      achievements.push({
        id: 'level_' + lv,
        name: 'Мастер уровня ' + lv,
        description: 'Достигни ' + lv + ' уровня',
        icon: lv >= 50 ? 'ph-crown' : 'ph-star',
        _tier: { type: 'level', target: lv },
        condition: function(s) { return (s.level || 1) >= lv; }
      });
    });

    // Вехи для стрика
    var streakTiers = [3, 7, 14, 30, 60, 100, 365, 1000];
    streakTiers.forEach(function(st) {
      achievements.push({
        id: 'streak_' + st,
        name: 'Непрерывность (' + st + ')',
        description: 'Серия из ' + st + ' дней подряд',
        icon: 'ph-fire',
        _tier: { type: 'streak', target: st },
        condition: function(s) { return (s.streak || 0) >= st; }
      });
    });

    this._allCache = achievements;
    return achievements;
  },

  /* ---------- ПРОГРЕСС ДО РАЗБЛОКИРОВКИ ---------- */
  // Возвращает {current, target, percent} или null, если достижение не имеет числовой цели.
  getProgress: function(ach) {
    if (!ach || !ach._tier) return null;
    var stats = this.getStats();
    var current = 0;
    if (ach._tier.type === 'workouts') current = stats.yes || 0;
    else if (ach._tier.type === 'level') current = stats.level || 1;
    else if (ach._tier.type === 'streak') current = stats.streak || 0;
    var target = ach._tier.target;
    var percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    return { current: current, target: target, percent: percent };
  },

  /* ---------- ПРОВЕРКА ---------- */
  checkAchievements: function() {
    var stats, history, unlocked, all;
    try {
      stats = this.getStats();
      history = this.getHistory();
      unlocked = this.getUnlockedAchievements();
      all = this.getAllAchievements();
    } catch (e) {
      if (typeof Logger !== 'undefined') Logger.log('checkAchievements: ошибка чтения данных — ' + e.message, 'error');
      return [];
    }

    var unlockedSet = {};
    for (var u = 0; u < unlocked.length; u++) unlockedSet[unlocked[u]] = true;

    var newUnlocked = [];
    for (var i = 0; i < all.length; i++) {
      var ach = all[i];
      if (unlockedSet[ach.id]) continue;
      var ok = false;
      try {
        ok = !!ach.condition(stats, history);
      } catch (e) {
        if (typeof Logger !== 'undefined') Logger.log('Условие "' + ach.id + '" упало: ' + e.message, 'warn');
        ok = false;
      }
      if (ok) {
        unlocked.push(ach.id);
        unlockedSet[ach.id] = true;
        newUnlocked.push(ach);
      }
    }

    if (newUnlocked.length > 0) {
      this.saveUnlockedAchievements(unlocked);
      for (var j = 0; j < newUnlocked.length; j++) {
        (function(ach, delay) {
          if (typeof Logger !== 'undefined') Logger.log('🏆 Достижение разблокировано: ' + ach.name, 'info');
          if (typeof showAchievementToast === 'function') {
            setTimeout(function() {
              try { showAchievementToast(ach.name, ach.description, ach.icon); }
              catch (e) { /* ignore */ }
            }, 200 + delay);
          }
        })(newUnlocked[j], j * 300);
      }
    }
    return newUnlocked;
  },

  /* ---------- ЭКРАН ---------- */
  createAchievementsScreen: function() {
    var esc = (typeof Core !== 'undefined' && Core.utils && Core.utils.escapeHtml)
      ? Core.utils.escapeHtml
      : function(t){ return t == null ? '' : String(t); };

    var screen = document.getElementById('screen-achievements');
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'screen-achievements';
      screen.className = 'screen';
      document.getElementById('userInterface').appendChild(screen);
    }
    var unlocked = this.getUnlockedAchievements();
    var all = this.getAllAchievements();

    var css = '<style>' +
      '.ach-card { background:var(--bg-card); border-radius:14px; padding:18px; margin-bottom:12px; border:1px solid var(--border-subtle); transition:all 0.2s; display:flex; align-items:center; gap:16px; }' +
      '.ach-card.unlocked { border-color:var(--border-gold); background:var(--accent-gold-dim); }' +
      '.ach-card.locked { opacity:0.55; }' +
      '.ach-icon { width:56px; height:56px; border-radius:50%; background:var(--bg-primary); border:2px solid var(--border-subtle); display:flex; align-items:center; justify-content:center; font-size:1.8em; color:var(--text-muted); flex-shrink:0; }' +
      '.ach-card.unlocked .ach-icon { border-color:var(--accent-gold); color:var(--accent-gold); background:rgba(212,175,55,0.1); }' +
      '.ach-info { flex:1; min-width:0; }' +
      '.ach-name { font-weight:700; font-size:1.05em; color:var(--text-primary); margin-bottom:4px; }' +
      '.ach-desc { font-size:0.85em; color:var(--text-secondary); }' +
      '.ach-status { font-size:0.75em; margin-top:4px; }' +
      '.ach-status.unlocked { color:var(--accent-gold); font-weight:600; }' +
      '.ach-status.locked { color:var(--text-muted); }' +
      '.ach-progress { font-size:0.75em; color:var(--text-secondary); margin-top:6px; display:flex; justify-content:space-between; align-items:center; }' +
      '.ach-progress strong { color:var(--accent-gold); }' +
      '.progress-bar { height:6px; background:var(--bg-primary); border-radius:3px; overflow:hidden; margin-top:8px; border:1px solid var(--border-subtle); }' +
      '.progress-fill { height:100%; background:linear-gradient(90deg, var(--accent-gold), var(--accent-gold-light)); border-radius:3px; transition:width 0.5s; }' +
      '.ach-group-title { font-family:var(--font-display); font-size:1.1em; color:var(--accent-gold); margin:24px 0 12px; display:flex; align-items:center; gap:8px; }' +
      '.ach-group-title:first-of-type { margin-top:0; }' +
      '@media (prefers-reduced-motion: reduce) { .ach-card, .progress-fill { transition: none !important; } }' +
    '</style>';

    var html = css + '<div style="padding:16px;max-width:700px;margin:0 auto">';
    html += '<h2 style="font-family:var(--font-display);font-size:2em;margin-bottom:10px;color:var(--accent-gold);display:flex;align-items:center;gap:12px"><i class="ph ph-trophy"></i> Достижения</h2>';
    html += '<div style="background:var(--accent-gold-dim);border:1px solid var(--border-gold);border-radius:10px;padding:12px 16px;margin-bottom:18px;font-size:0.9em;display:flex;align-items:center;gap:10px">';
    html += '<i class="ph ph-medal" style="color:var(--accent-gold);font-size:1.3em"></i>';
    html += '<div><strong style="color:var(--accent-gold)">' + unlocked.length + ' из ' + all.length + '</strong> достижений разблокировано</div>';
    html += '</div>';

    var progressPercent = all.length > 0 ? Math.round((unlocked.length / all.length) * 100) : 0;
    html += '<div style="margin-bottom:20px">';
    html += '<div style="display:flex;justify-content:space-between;font-size:0.85em;margin-bottom:6px"><span style="color:var(--text-secondary)">Общий прогресс</span><span style="color:var(--accent-gold);font-weight:600">' + progressPercent + '%</span></div>';
    html += '<div class="progress-bar"><div class="progress-fill" style="width:' + progressPercent + '%"></div></div>';
    html += '</div>';

    // Группировка: сначала разблокированные, потом по категориям
    var unlockedSet = {};
    for (var u = 0; u < unlocked.length; u++) unlockedSet[unlocked[u]] = true;

    var groups = {
      unlocked: { title: 'Полученные', items: [] },
      base: { title: 'Базовые', items: [] },
      workouts: { title: 'Тренировки', items: [] },
      levels: { title: 'Уровни', items: [] },
      streaks: { title: 'Серии', items: [] }
    };

    for (var i = 0; i < all.length; i++) {
      var ach = all[i];
      if (unlockedSet[ach.id]) { groups.unlocked.items.push(ach); continue; }
      if (ach._tier) {
        if (ach._tier.type === 'workouts') groups.workouts.items.push(ach);
        else if (ach._tier.type === 'level') groups.levels.items.push(ach);
        else if (ach._tier.type === 'streak') groups.streaks.items.push(ach);
        else groups.base.items.push(ach);
      } else {
        groups.base.items.push(ach);
      }
    }

    var groupOrder = ['unlocked', 'base', 'workouts', 'levels', 'streaks'];
    for (var gi = 0; gi < groupOrder.length; gi++) {
      var key = groupOrder[gi];
      var group = groups[key];
      if (group.items.length === 0) continue;

      // Внутри группы сортируем: для вех — по возрастанию цели, иначе по id
      if (key === 'workouts' || key === 'levels' || key === 'streaks') {
        group.items.sort(function(a, b) { return a._tier.target - b._tier.target; });
      }

      html += '<div class="ach-group-title"><i class="ph ' + (key === 'unlocked' ? 'ph-check-circle' : 'ph-list') + '"></i> ' + group.title + ' <span style="opacity:0.6;font-weight:500;font-size:0.85em">(' + group.items.length + ')</span></div>';

      for (var k = 0; k < group.items.length; k++) {
        var a = group.items[k];
        var isUnlocked = !!unlockedSet[a.id];
        var progress = !isUnlocked ? this.getProgress(a) : null;

        html += '<div class="ach-card ' + (isUnlocked ? 'unlocked' : 'locked') + '">';
        html += '<div class="ach-icon"><i class="ph ' + (isUnlocked ? 'ph-fill ' : '') + esc(a.icon) + '"></i></div>';
        html += '<div class="ach-info">';
        html += '<div class="ach-name">' + esc(a.name) + '</div>';
        html += '<div class="ach-desc">' + esc(a.description) + '</div>';
        if (progress) {
          html += '<div class="ach-progress"><span>' + progress.current + ' / ' + progress.target + '</span><strong>' + progress.percent + '%</strong></div>';
          html += '<div class="progress-bar"><div class="progress-fill" style="width:' + progress.percent + '%"></div></div>';
        } else {
          html += '<div class="ach-status ' + (isUnlocked ? 'unlocked' : 'locked') + '">' + (isUnlocked ? '✓ Разблокировано' : '🔒 Заблокировано') + '</div>';
        }
        html += '</div></div>';
      }
    }
    html += '</div>';
    screen.innerHTML = html;
  }
};

window.AchievementsModule = AchievementsModule;
module.exports = AchievementsModule;