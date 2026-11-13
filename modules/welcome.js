// modules/welcome.js

const WelcomeModule = {
  init: function() {
    if (typeof Logger !== 'undefined') Logger.log('Модуль приветствия инициализирован', 'info');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { WelcomeModule.setup(); });
    } else {
      this.setup();
    }
  },

  setup: function() {
    this.createWelcomeScreen();
    if (typeof Core !== 'undefined') {
      Core.addNavButton('Главная', 'welcome', '<i class="ph ph-house"></i>');
      Core.registerScreen('welcome', function() { WelcomeModule.createWelcomeScreen(); });
    }
    var self = this;
    if (typeof Events !== 'undefined' && Events.on) {
      Events.on('stats:changed', function() {
        var screen = document.getElementById('screen-welcome');
        if (screen && screen.classList.contains('active')) self.createWelcomeScreen();
      });
      Events.on('history:changed', function() {
        var screen = document.getElementById('screen-welcome');
        if (screen && screen.classList.contains('active')) self.createWelcomeScreen();
      });
    }
  },

  /* ---------- УТИЛИТЫ (fallback) ---------- */
  _todayStr: function() {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.formatLocalDate) {
      return Core.utils.formatLocalDate(new Date());
    }
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },
  _todayIdx: function() {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.getTodayIndex) return Core.utils.getTodayIndex();
    return (new Date().getDay() + 6) % 7;
  },
  _dayName: function() {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.getDayName) return Core.utils.getDayName(this._todayIdx());
    return ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'][this._todayIdx()];
  },
  _esc: function(t) {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.escapeHtml) return Core.utils.escapeHtml(t);
    if (t == null) return '';
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
  _getHistoryMap: function(history) {
    if (typeof Core !== 'undefined' && Core.getHistoryMap) return Core.getHistoryMap(history);
    var map = {};
    for (var i = 0; i < history.length; i++) if (history[i] && history[i].date) map[history[i].date] = history[i];
    return map;
  },

  /* ---------- ДАННЫЕ ---------- */
  getUserName: function() {
    if (typeof Profile !== 'undefined' && Profile.getUserName) return Profile.getUserName();
    if (typeof FTStorage !== 'undefined') return FTStorage.get('user_name') || '';
    return '';
  },
  getUserAvatar: function() {
    if (typeof Profile !== 'undefined' && Profile.getUserAvatar) return Profile.getUserAvatar();
    if (typeof FTStorage !== 'undefined') return FTStorage.get('user_avatar') || null;
    return null;
  },
  getStats: function() {
    var defaults = { yes: 0, later: 0, no: 0, xp: 0, level: 1, streak: 0, lastWorkoutDate: null, lastLaterDate: null };
    if (typeof CoreData !== 'undefined' && CoreData.getStats) {
      var s1 = CoreData.getStats();
      for (var k1 in defaults) if (s1[k1] === undefined) s1[k1] = defaults[k1];
      return s1;
    }
    if (typeof FTStorage !== 'undefined') {
      var s = FTStorage.get('stats') || {};
      for (var k in defaults) if (s[k] === undefined) s[k] = defaults[k];
      return s;
    }
    return defaults;
  },
  saveStats: function(s) {
    if (typeof CoreData !== 'undefined' && CoreData.setStats) { CoreData.setStats(s); return; }
    if (typeof FTStorage !== 'undefined') FTStorage.set('stats', s);
  },
  getHistory: function() {
    if (typeof CoreData !== 'undefined' && CoreData.getHistory) return CoreData.getHistory();
    if (typeof FTStorage !== 'undefined') return FTStorage.get('history') || [];
    return [];
  },
  saveHistory: function(h) {
    if (typeof CoreData !== 'undefined' && CoreData.setHistory) { CoreData.setHistory(h); return; }
    if (typeof FTStorage !== 'undefined') FTStorage.set('history', h);
    if (typeof Core !== 'undefined') Core._historyMapCache = null;
  },
  getPlan: function() {
    if (typeof CoreData !== 'undefined' && CoreData.getPlan) return CoreData.getPlan();
    if (typeof FTStorage !== 'undefined') return FTStorage.get('plan') || [];
    return [];
  },

  getMotivationalMessage: function(stats) {
    var streak = (stats && stats.streak) || 0;
    if (streak === 0) return { text: 'Начни свой путь сегодня!', icon: 'ph-rocket-launch' };
    if (streak < 3) return { text: 'Хорошее начало! Продолжай', icon: 'ph-flame' };
    if (streak < 7) return { text: 'Отличная серия! Ты на пути', icon: 'ph-target' };
    if (streak < 14) return { text: 'Неделя силы! Ты машина', icon: 'ph-rocket-launch' };
    if (streak < 30) return { text: 'Дисциплина — суперсила', icon: 'ph-lightning' };
    if (streak < 60) return { text: 'Месяц! Ты легенда', icon: 'ph-crown' };
    return { text: 'Ты непобедим', icon: 'ph-trophy' };
  },

  animateValue: function(element, start, end, duration) {
    if (!element || duration <= 0) { if (element) element.textContent = end; return; }
    var startTime = null;
    var range = end - start;
    var step = function(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = Math.floor(start + range * eased);
      if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  },

  _renderAvatar: function(avatar) {
    var esc = this._esc;
    if (avatar && typeof avatar === 'string' && avatar.indexOf('data:image') === 0) {
      return '<img src="' + esc(avatar) + '" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid var(--accent-gold)">';
    }
    if (avatar && typeof avatar === 'string' && /^ph-[a-z0-9-]+$/.test(avatar)) {
      return '<i class="ph ' + esc(avatar) + '" style="font-size:2.4em;color:var(--accent-gold)"></i>';
    }
    return '<i class="ph ph-user-circle" style="font-size:2.4em;color:var(--accent-gold)"></i>';
  },

  /* ---------- СТАТУС ДНЯ ---------- */
  _renderStatus: function(todayRecord, exCount) {
    if (!todayRecord) return '';

    if (todayRecord.skipped) {
      return '<div class="w-fade w-delay-4" style="background:rgba(248,113,113,0.1);padding:12px 16px;border-radius:12px;margin-top:12px;border-left:3px solid var(--accent-error);font-size:0.9em;display:flex;align-items:center;gap:10px">' +
        '<i class="ph ph-x-circle" style="font-size:1.3em;color:var(--accent-error)"></i>' +
        '<div><strong style="color:var(--accent-error)">День пропущен</strong>' +
        '<div style="font-size:0.85em;opacity:0.7;margin-top:2px">Можно передумать и начать тренировку</div></div></div>';
    }

    if (todayRecord.xpDayAwarded) {
      var done = Array.isArray(todayRecord.exercises) ? todayRecord.exercises.length : 0;
      var total = exCount > 0 ? exCount : done;
      return '<div class="w-fade w-delay-4" style="background:rgba(74,222,128,0.1);padding:12px 16px;border-radius:12px;margin-top:12px;border-left:3px solid var(--accent-success);font-size:0.9em;display:flex;align-items:center;gap:10px">' +
        '<i class="ph ph-check-circle" style="font-size:1.3em;color:var(--accent-success)"></i>' +
        '<div><strong style="color:var(--accent-success)">Тренировка проведена</strong>' +
        '<div style="font-size:0.85em;opacity:0.7;margin-top:2px">' + done + '/' + total + ' упражнений</div></div></div>';
    }

    // День в процессе: есть подходы, но не закрыт
    var hasProgress = false;
    if (Array.isArray(todayRecord.details)) {
      for (var i = 0; i < todayRecord.details.length; i++) {
        var det = todayRecord.details[i];
        if (det && Array.isArray(det.sets)) {
          for (var s = 0; s < det.sets.length; s++) {
            if (det.sets[s]) { hasProgress = true; break; }
          }
        }
        if (hasProgress) break;
      }
    }
    if (hasProgress) {
      return '<div class="w-fade w-delay-4" style="background:rgba(251,191,36,0.1);padding:12px 16px;border-radius:12px;margin-top:12px;border-left:3px solid var(--accent-warning);font-size:0.9em;display:flex;align-items:center;gap:10px">' +
        '<i class="ph ph-hourglass" style="font-size:1.3em;color:var(--accent-warning)"></i>' +
        '<div><strong style="color:var(--accent-warning)">Тренировка в процессе</strong>' +
        '<div style="font-size:0.85em;opacity:0.7;margin-top:2px">Продолжи, чтобы закрыть день</div></div></div>';
    }

    return '';
  },

  /* ---------- ЭКРАН ---------- */
  createWelcomeScreen: function() {
    var esc = this._esc;
    var screen = document.getElementById('screen-welcome');
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'screen-welcome';
      screen.className = 'screen active';
      document.getElementById('userInterface').appendChild(screen);
    }

    var userName = this.getUserName();
    var userAvatar = this.getUserAvatar();
    var greeting = userName ? 'Приветствую, ' + esc(userName) + '!' : 'Приветствую!';
    var stats = this.getStats();
    var xpNeeded = Math.floor(100 * Math.pow(1.2, (stats.level || 1) - 1));
    var xpPercent = xpNeeded > 0 ? Math.min(100, Math.round(((stats.xp || 0) / xpNeeded) * 100)) : 0;
    var todayIdx = this._todayIdx();
    var dayName = this._dayName();
    var plan = this.getPlan();
    var todayPlan = plan[todayIdx] || null;
    var exCount = todayPlan && Array.isArray(todayPlan.exercises) ? todayPlan.exercises.length : 0;
    var history = this.getHistory();
    var todayStr = this._todayStr();
    var historyMap = this._getHistoryMap(history);
    var todayRecord = historyMap[todayStr] || null;
    var motivation = this.getMotivationalMessage(stats);
    var levelIcon = (typeof Core !== 'undefined' && Core.utils && Core.utils.getLevelIcon)
      ? Core.utils.getLevelIcon(stats.level || 1)
      : 'ph-star';
    var totalXp = (typeof Core !== 'undefined' && Core.utils && Core.utils.totalXp)
      ? Core.utils.totalXp(stats)
      : (stats.xp || 0);
    var hintsEnabled = typeof shouldShowHints === 'function' ? shouldShowHints() : true;

    // День уже закрыт?
    var dayClosed = todayRecord && todayRecord.xpDayAwarded;
    // День помечен как пропуск?
    var daySkipped = todayRecord && todayRecord.skipped;

    // Кнопка «Начать»
    var yesButton;
    if (dayClosed) {
      yesButton = '<button class="start-circle" disabled style="opacity:0.6;cursor:not-allowed"><i class="ph ph-check-circle"></i><span>Готово</span><small>закрыт</small></button>';
    } else if (daySkipped) {
      yesButton = '<button class="start-circle" id="btnStartWorkout" style="border-color:var(--accent-warning)"><i class="ph ph-arrow-counterclockwise"></i><span>Вернуться</span><small>передумал?</small></button>';
    } else if (exCount > 0) {
      yesButton = '<button class="start-circle" id="btnStartWorkout"><i class="ph ph-play-circle"></i><span>Начать</span><small>' + exCount + ' упр.</small></button>';
    } else {
      yesButton = '<button class="start-circle" onclick="WelcomeModule.goToPlan()"><i class="ph ph-calendar-plus"></i><span>План</span></button>';
    }

    var skipBtnDisabled = dayClosed ? 'disabled style="opacity:0.4;cursor:not-allowed"' : '';

    var css = '<style>' +
      '@keyframes fadeInUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }' +
      '@keyframes fillBar { from { width:0%; } }' +
      '@keyframes pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.1); } }' +
      '@keyframes glow { 0%,100% { box-shadow:0 0 10px rgba(212,175,55,0.2); } 50% { box-shadow:0 0 25px rgba(212,175,55,0.4); } }' +
      '.w-fade { animation:fadeInUp 0.5s ease-out both; }' +
      '.w-delay-1 { animation-delay:0.1s; } .w-delay-2 { animation-delay:0.2s; }' +
      '.w-delay-3 { animation-delay:0.3s; } .w-delay-4 { animation-delay:0.4s; }' +
      '.w-pulse { animation:pulse 2s ease-in-out infinite; display:inline-block; }' +
      '.w-glow { animation:glow 2s ease-in-out infinite; }' +
      '.w-xp-bar { animation:fillBar 1.2s ease-out both; }' +
      '.w-card { transition:transform 0.2s, box-shadow 0.2s; }' +
      '.w-card:hover { transform:translateY(-3px); box-shadow:0 8px 20px rgba(0,0,0,0.3); }' +
      '.w-btn { transition:all 0.2s; cursor:pointer; flex:1; min-width:0; }' +
      '.w-btn:hover:not(:disabled) { transform:translateY(-2px); filter:brightness(1.1); }' +
      '.w-btn:active:not(:disabled) { transform:scale(0.97); }' +
      '.w-icon { color:var(--accent-gold); }' +
      '.start-circle { width:140px; height:140px; border-radius:50%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:4px; padding:0; border:2px solid var(--border-gold); background:var(--bg-card); color:var(--accent-gold); cursor:pointer; font-family:var(--font-primary); font-weight:700; transition:all 0.25s; }' +
      '.start-circle i { font-size:2.2em; }' +
      '.start-circle span { font-size:0.85em; text-transform:uppercase; letter-spacing:2px; font-weight:700; }' +
      '.start-circle small { font-size:0.6em; opacity:0.8; font-weight:500; }' +
      '.start-circle:hover:not(:disabled) { transform:translateY(-2px) scale(1.02); }' +
      '.start-circle:active:not(:disabled) { transform:scale(0.96); }' +
      '.w-skip { background:var(--bg-card); color:var(--text-secondary); border:1px solid var(--border-subtle); }' +
      '.w-skip:hover:not(:disabled) { background:rgba(248,113,113,0.15); color:var(--accent-error); border-color:var(--accent-error); }' +
      '@media (prefers-reduced-motion: reduce) { .w-fade, .w-pulse, .w-glow, .w-xp-bar { animation: none !important; } }' +
      '@media (max-width: 480px) { .w-btn { padding:12px 6px !important; font-size:0.85em !important; } .w-btn i { font-size:1em !important; } }' +
      '@media (max-width: 380px) { .start-circle { width:120px; height:120px; } .start-circle i { font-size:1.9em; } .start-circle span { font-size:0.75em; } }' +
    '</style>';

    screen.innerHTML = css +
      '<div style="padding:4px;max-width:500px;margin:0 auto">' +
      '<div class="w-fade w-glow" style="background:var(--bg-card);border-radius:16px;padding:16px 20px;margin-bottom:16px;border:1px solid var(--border-gold)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
          '<div style="display:flex;align-items:center;gap:10px">' +
            '<i class="ph ' + levelIcon + ' w-icon w-pulse" style="font-size:1.8em"></i>' +
            '<div style="font-size:1.8em;font-weight:bold;color:var(--accent-gold);line-height:1" class="w-anim-level">' + (stats.level || 1) + '</div>' +
            '<div style="font-size:0.75em;opacity:0.7">уровень</div>' +
          '</div>' +
          '<div style="text-align:right"><div style="font-size:0.75em;opacity:0.7">XP</div><div style="font-size:1em;font-weight:bold"><span class="w-anim-xp">' + (stats.xp || 0) + '</span><span style="font-size:0.7em;opacity:0.6">/' + xpNeeded + '</span></div></div>' +
        '</div>' +
        '<div style="height:6px;background:rgba(0,0,0,0.3);border-radius:3px;overflow:hidden;border:1px solid var(--border-subtle)"><div class="w-xp-bar" style="height:100%;width:' + xpPercent + '%;background:linear-gradient(90deg,var(--accent-gold),var(--accent-gold-light));border-radius:3px"></div></div>' +
      '</div>' +
      '<div class="w-fade w-delay-1" style="background:var(--bg-card);border-radius:16px;padding:16px 20px;border:1px solid var(--border-subtle);margin-bottom:16px">' +
        '<div style="display:flex;align-items:center;gap:12px">' +
          this._renderAvatar(userAvatar) +
          '<div style="flex:1;min-width:0"><div style="font-size:1.1em;font-weight:600;color:var(--accent-gold);line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + greeting + '</div><div style="font-size:0.85em;opacity:0.7;margin-top:2px">Сегодня <strong>' + esc(dayName) + '</strong></div></div>' +
          '<div style="font-size:0.8em;color:var(--accent-gold);text-align:right;flex-shrink:0"><i class="ph ph-list-checks"></i> ' + (exCount > 0 ? exCount + ' упр.' : 'нет плана') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="w-fade w-delay-2" style="display:flex;flex-direction:column;align-items:center;gap:16px;margin-bottom:16px">' +
        yesButton +
        '<div class="small-buttons" style="display:flex;gap:8px;width:100%;max-width:320px">' +
          '<button class="btn w-btn btn-secondary" ' + skipBtnDisabled + ' onclick="WelcomeModule.handleAnswer(\'later\')"><i class="ph ph-clock"></i> Позже</button>' +
          '<button class="btn w-btn w-skip" ' + skipBtnDisabled + ' onclick="WelcomeModule.handleAnswer(\'no\')"><i class="ph ph-x"></i> Пропустить</button>' +
        '</div>' +
      '</div>' +
      this._renderStatus(todayRecord, exCount) +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(100px, 1fr));gap:8px;margin:16px 0">' +
        '<div class="w-card w-fade w-delay-2" style="background:var(--bg-card);border-radius:12px;padding:12px 8px;text-align:center;border:1px solid var(--border-subtle)"><i class="ph ph-flame w-pulse w-icon" style="font-size:1.5em"></i><div style="font-size:1.3em;font-weight:bold;color:var(--accent-gold);line-height:1.2;margin-top:4px"><span class="w-anim-streak">' + (stats.streak || 0) + '</span></div><div style="font-size:0.7em;opacity:0.7">стрик</div></div>' +
        '<div class="w-card w-fade w-delay-3" style="background:var(--bg-card);border-radius:12px;padding:12px 8px;text-align:center;border:1px solid var(--border-subtle)"><i class="ph ph-barbell w-icon" style="font-size:1.5em"></i><div style="font-size:1.3em;font-weight:bold;color:var(--accent-gold);line-height:1.2;margin-top:4px"><span class="w-anim-workouts">' + (stats.yes || 0) + '</span></div><div style="font-size:0.7em;opacity:0.7">тренировок</div></div>' +
        '<div class="w-card w-fade w-delay-4" style="background:var(--bg-card);border-radius:12px;padding:12px 8px;text-align:center;border:1px solid var(--border-subtle)"><i class="ph ph-lightning w-icon" style="font-size:1.5em"></i><div style="font-size:1.3em;font-weight:bold;color:var(--accent-gold);line-height:1.2;margin-top:4px"><span class="w-anim-totalxp">' + totalXp + '</span></div><div style="font-size:0.7em;opacity:0.7">всего XP</div></div>' +
      '</div>' +
      '<div class="w-fade w-delay-4" style="background:var(--bg-card);border-radius:12px;padding:12px 16px;margin-bottom:16px;border-left:3px solid var(--accent-gold);font-size:0.9em;display:flex;align-items:center;gap:10px">' +
        '<i class="ph ' + motivation.icon + ' w-icon" style="font-size:1.3em"></i>' +
        '<div style="color:var(--accent-gold);font-weight:600">' + esc(motivation.text) + '</div>' +
      '</div>' +
      (hintsEnabled ? '<details class="w-fade w-delay-4" style="background:var(--bg-card);border-radius:12px;padding:12px 16px;font-size:0.8em;opacity:0.85;cursor:pointer;border:1px solid var(--border-subtle)">' +
        '<summary style="font-weight:600;color:var(--accent-gold);margin-bottom:8px;display:flex;align-items:center;gap:8px"><i class="ph ph-info"></i> Как получать XP</summary>' +
        '<div style="margin-top:8px;line-height:1.6">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><i class="ph ph-check" style="color:var(--accent-success)"></i> Подход: <strong>+5 XP</strong></div>' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><i class="ph ph-warning-circle" style="color:var(--accent-warning)"></i> Частично: <strong>+3 XP</strong></div>' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><i class="ph ph-flag-checkered" style="color:var(--accent-success)"></i> Упражнение: <strong>+15 XP</strong></div>' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><i class="ph ph-trophy" style="color:var(--accent-success)"></i> День: <strong>+20 XP</strong></div>' +
          '<div style="display:flex;align-items:center;gap:8px"><i class="ph ph-chart-bar" style="color:var(--accent-success)"></i> Опрос: <strong>+10 XP</strong></div>' +
        '</div>' +
      '</details>' : '') +
      '</div>';

    var self = this;
    setTimeout(function() {
      var btnStart = document.getElementById('btnStartWorkout');
      if (btnStart) btnStart.onclick = function() { self.startWorkout(); };
      // Анимации только для элементов, которые ещё не в финальном состоянии
      var levelEl = document.querySelector('.w-anim-level');
      var xpEl = document.querySelector('.w-anim-xp');
      var streakEl = document.querySelector('.w-anim-streak');
      var workoutsEl = document.querySelector('.w-anim-workouts');
      var totalXpEl = document.querySelector('.w-anim-totalxp');
      if (levelEl) self.animateValue(levelEl, 0, stats.level || 1, 800);
      if (xpEl) self.animateValue(xpEl, 0, stats.xp || 0, 1000);
      if (streakEl) self.animateValue(streakEl, 0, stats.streak || 0, 800);
      if (workoutsEl) self.animateValue(workoutsEl, 0, stats.yes || 0, 1000);
      if (totalXpEl) self.animateValue(totalXpEl, 0, totalXp, 1200);
    }, 300);
  },

  /* ---------- СТАРТ ТРЕНИРОВКИ ---------- */
  startWorkout: function() {
    var todayStr = this._todayStr();
    var history = this.getHistory();
    var historyMap = this._getHistoryMap(history);
    var todayRecord = historyMap[todayStr];

    // День уже закрыт
    if (todayRecord && todayRecord.xpDayAwarded) {
      if (typeof Notify !== 'undefined') Notify.info('Тренировка уже проведена сегодня!');
      else alert('Тренировка уже проведена сегодня!');
      return;
    }

    // День помечен как пропуск — спросим
    if (todayRecord && todayRecord.skipped) {
      if (!confirm('Ты отмечал день как пропущенный. Начать тренировку и отменить пропуск?')) return;
      todayRecord.skipped = false;
      this.saveHistory(history);
      if (typeof Core !== 'undefined') Core._historyMapCache = null;
    }

    if (typeof WorkoutFlow !== 'undefined' && WorkoutFlow.start) {
      WorkoutFlow.start();
    } else if (typeof WorkoutModule !== 'undefined' && WorkoutModule.openWorkoutModal) {
      WorkoutModule.openWorkoutModal();
    } else if (typeof Notify !== 'undefined') {
      Notify.error('Модуль тренировки ещё не загружен');
    } else {
      alert('Модуль тренировки ещё не загружен');
    }
  },

  goToPlan: function() {
    if (typeof moduleManager !== 'undefined' && moduleManager.loadedModules && moduleManager.loadedModules.has('plan')) {
      Core.navigate('plan');
    } else if (typeof Notify !== 'undefined') {
      Notify.warn('Модуль «План» ещё не добавлен');
    } else {
      alert('Модуль "План" ещё не добавлен.');
    }
  },

  /* ---------- ОТВЕТЫ ---------- */
  handleAnswer: function(answer) {
    var todayStr = this._todayStr();
    var todayIdx = this._todayIdx();
    var dayName = this._dayName();
    var stats = this.getStats();
    var history = this.getHistory();
    var plan = this.getPlan();
    var historyMap = this._getHistoryMap(history);
    var todayRecord = historyMap[todayStr];

    // День уже закрыт — блокируем оба действия
    if (todayRecord && todayRecord.xpDayAwarded) {
      if (typeof Notify !== 'undefined') Notify.info('Тренировка уже проведена сегодня!');
      else alert('Тренировка уже проведена сегодня!');
      return;
    }

    if (answer === 'later') {
      if (stats.lastLaterDate === todayStr) {
        if (typeof Notify !== 'undefined') Notify.info('Уже напоминал сегодня — вернись вечером 💪');
        else alert('Уже напоминал сегодня');
        return;
      }
      stats.later = (stats.later || 0) + 1;
      stats.lastLaterDate = todayStr;
      this.saveStats(stats);
      if (typeof Notify !== 'undefined') Notify.info('Напомню через 3 часа ⏰');
      else alert('Напомню через 3 часа');
      this.createWelcomeScreen();
    } else if (answer === 'no') {
      // Если день уже помечен как пропущенный — не увеличиваем счётчик повторно
      if (todayRecord && todayRecord.skipped) {
        if (typeof Notify !== 'undefined') Notify.info('День уже отмечен как пропущенный');
        return;
      }
      // Если сегодня уже была тренировка — не портим стрик (защита)
      if (stats.lastWorkoutDate === todayStr && stats.streak > 0) {
        if (typeof Notify !== 'undefined') Notify.warn('Сегодня уже была тренировка — стрик не сбрасываем');
        return;
      }

      stats.no = (stats.no || 0) + 1;
      stats.streak = 0;
      stats.lastWorkoutDate = null;
      this.saveStats(stats);

      if (!todayRecord) {
        var muscleGroup = '';
        if (plan[todayIdx] && plan[todayIdx].muscleGroup) muscleGroup = plan[todayIdx].muscleGroup;
        todayRecord = {
          date: todayStr,
          dayName: dayName,
          muscleGroup: muscleGroup,
          exercises: [],
          details: [],
          duration: 0,
          skipped: true,
          timestamp: Date.now()
        };
        history.push(todayRecord);
      } else {
        todayRecord.skipped = true;
      }
      this.saveHistory(history);
      if (typeof refreshHeaderAfterXP === 'function') refreshHeaderAfterXP();
      if (typeof Notify !== 'undefined') Notify.info('Понял, день пропущен. Завтра новый шанс!');
      this.createWelcomeScreen();
    }
  }
};

window.WelcomeModule = WelcomeModule;
module.exports = WelcomeModule;