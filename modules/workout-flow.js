// modules/workout-flow.js

const WorkoutFlow = {
  _state: {
    active: false,
    phase: 'overview',
    exIdx: 0,
    setIdx: 0,
    elapsedDayStart: 0,
    exercises: [],
    db: [],
    plan: [],
    todayPlan: null,
    timerHandle: null,
    timerStartedAt: 0,
    timerTotalSec: 0,
    timerElapsedSec: 0,
    timerRunning: false,
    timerMode: 'down',
    timerKind: 'set',
    metronomeHandle: null,
    metronomeTick: 0,
    audioCtx: null,
    container: null,
    busy: false,
    lastSummary: null
  },

  XP: { PER_SET: 5, PER_PARTIAL: 3, PER_MISS: 0, PER_EXERCISE: 15, PER_DAY: 20 },

  init: function() {
    if (typeof Logger !== 'undefined') Logger.log('Модуль пошаговой тренировки инициализирован', 'info');
  },

  /* ---------- НАСТРОЙКИ ---------- */
  getSettings: function() {
    var defaults = {
      autoRestAfterSet: false,
      autoNextSetAfterRest: false,
      timerSoundEnabled: true,
      timerVibrateEnabled: true,
      metronomeEnabled: true,
      metronomeInterval: 1,
      defaultRestSec: 60,
      hideWorkoutSummary: false
    };
    try {
      var raw;
      if (typeof FTStorage !== 'undefined') raw = FTStorage.get('settings');
      else { var s = localStorage.getItem('ft_settings'); raw = s ? JSON.parse(s) : null; }
      raw = raw || {};
      for (var k in defaults) if (raw[k] === undefined) raw[k] = defaults[k];
      return raw;
    } catch (e) { return defaults; }
  },
  saveSetting: function(key, value) {
    try {
      var s = this.getSettings();
      s[key] = value;
      if (typeof FTStorage !== 'undefined') FTStorage.set('settings', s);
      else localStorage.setItem('ft_settings', JSON.stringify(s));
    } catch (e) {}
  },

  /* ---------- ДАННЫЕ ---------- */
  getPlan: function() {
    if (typeof CoreData !== 'undefined' && CoreData.getPlan) return CoreData.getPlan();
    if (typeof FTStorage !== 'undefined') return FTStorage.get('plan') || [];
    return [];
  },
  getDB: function() {
    if (typeof ExercisesModule !== 'undefined' && ExercisesModule.getDB) return ExercisesModule.getDB();
    if (typeof CoreData !== 'undefined' && CoreData.getDB) return CoreData.getDB();
    if (typeof FTStorage !== 'undefined') return FTStorage.get('db') || [];
    return [];
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
  getStats: function() {
    var defaults = { yes: 0, later: 0, no: 0, xp: 0, level: 1, streak: 0, lastWorkoutDate: null };
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

  _todayStr: function() {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.formatLocalDate) return Core.utils.formatLocalDate(new Date());
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },
  _todayIdx: function() {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.getTodayIndex) return Core.utils.getTodayIndex();
    return (new Date().getDay() + 6) % 7;
  },
  _todayName: function() {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.getDayName) return Core.utils.getDayName(this._todayIdx());
    return ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'][this._todayIdx()];
  },
  _esc: function(t) {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.escapeHtml) return Core.utils.escapeHtml(t);
    if (t == null) return '';
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
  _parseSetsReps: function(setsStr) {
    var m = (setsStr || '3×10').match(/(\d+)\s*[×xх*]\s*(\d+)/i);
    return { sets: m ? parseInt(m[1]) : 3, reps: m ? parseInt(m[2]) : 10 };
  },
  _formatSec: function(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
  },

  /* ---------- ЗВУК ---------- */
  _getAudioCtx: function() {
    if (this._state.audioCtx) return this._state.audioCtx;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this._state.audioCtx = new Ctx();
      return this._state.audioCtx;
    } catch (e) { return null; }
  },
  playBeep: function(freq, durationMs, volume) {
    if (!this.getSettings().timerSoundEnabled) return;
    var ctx = this._getAudioCtx();
    if (!ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq || 880;
      gain.gain.value = volume == null ? 0.15 : volume;
      osc.connect(gain);
      gain.connect(ctx.destination);
      var now = ctx.currentTime;
      osc.start(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (durationMs || 60) / 1000);
      osc.stop(now + (durationMs || 60) / 1000 + 0.02);
    } catch (e) {}
  },
  playCustomSound: function(dataUri) {
    if (!this.getSettings().timerSoundEnabled) return false;
    if (!dataUri) return false;
    try {
      var audio = new Audio(dataUri);
      audio.volume = 0.7;
      audio.play().catch(function() {});
      return true;
    } catch (e) { return false; }
  },
  _metronomeTick: function() {
    var s = this.getSettings();
    if (!s.metronomeEnabled) return;
    var custom = this._getCustomSound('metronome');
    if (!this.playCustomSound(custom)) this.playBeep(800, 40, 0.08);
  },
  _setEndSound: function() {
    var custom = this._getCustomSound('setEnd');
    if (!this.playCustomSound(custom)) {
      this.playBeep(660, 200, 0.2);
      var self = this;
      setTimeout(function() { self.playBeep(880, 300, 0.2); }, 220);
    }
  },
  _restEndSound: function() {
    var custom = this._getCustomSound('restEnd');
    if (!this.playCustomSound(custom)) {
      this.playBeep(880, 250, 0.2);
      var self = this;
      setTimeout(function() { self.playBeep(660, 250, 0.2); }, 270);
      setTimeout(function() { self.playBeep(880, 400, 0.2); }, 540);
    }
  },
  _getCustomSound: function(key) {
    try {
      var raw;
      if (typeof FTStorage !== 'undefined') raw = FTStorage.get('timer_sounds');
      else { var s = localStorage.getItem('ft_timer_sounds'); raw = s ? JSON.parse(s) : null; }
      if (!raw || typeof raw !== 'object') return null;
      return raw[key] || null;
    } catch (e) { return null; }
  },
  _vibrate: function(pattern) {
    if (!this.getSettings().timerVibrateEnabled) return;
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern || [200, 100, 200]); } catch (e) {}
    }
  },

  /* ---------- ЗАПУСК ---------- */
  start: function() {
    if (this._state.active) { this._focusContainer(); return; }

    var plan = this.getPlan();
    var todayIdx = this._todayIdx();
    var todayPlan = plan[todayIdx];
    if (!todayPlan || !Array.isArray(todayPlan.exercises) || todayPlan.exercises.length === 0) {
      if (typeof Notify !== 'undefined') Notify.warn('План на сегодня пуст. Добавь упражнения в план.');
      return;
    }

    var db = this.getDB();
    var exercises = [];
    for (var i = 0; i < todayPlan.exercises.length; i++) {
      var ref = todayPlan.exercises[i];
      var ex = null;
      for (var j = 0; j < db.length; j++) if (db[j].id === ref.id) { ex = db[j]; break; }
      if (!ex) continue;
      exercises.push({ ref: ref, ex: ex, parsed: this._parseSetsReps(ref.sets) });
    }
    if (exercises.length === 0) {
      if (typeof Notify !== 'undefined') Notify.warn('Упражнения из плана не найдены в базе');
      return;
    }

    this._state.active = true;
    this._state.phase = 'overview';
    this._state.exIdx = 0;
    this._state.setIdx = 0;
    this._state.exercises = exercises;
    this._state.db = db;
    this._state.plan = plan;
    this._state.todayPlan = todayPlan;
    this._state.elapsedDayStart = Date.now();
    this._state.busy = false;
    this._state.lastSummary = null;
    this._state._daySummaryShown = false;
    this._wasDayDoneBefore = false;

    this._createContainer();
    this.render();
  },

  close: function() {
    this._stopTimer();
    this._stopMetronome();
    if (this._state.container) {
      this._state.container.remove();
      this._state.container = null;
    }
    this._state.active = false;
    this._state.phase = 'overview';
    if (typeof WelcomeModule !== 'undefined' && WelcomeModule.createWelcomeScreen) {
      var w = document.getElementById('screen-welcome');
      if (w && w.classList.contains('active')) WelcomeModule.createWelcomeScreen();
    }
  },

  _focusContainer: function() {
    if (this._state.container) {
      this._state.container.style.display = 'flex';
    } else {
      this.start();
    }
  },

  // Контейнер — обычная модалка, НЕ на весь экран
  _createContainer: function() {
    var old = document.getElementById('workoutFlowContainer');
    if (old) old.remove();
    var div = document.createElement('div');
    div.id = 'workoutFlowContainer';
    div.className = 'workout-modal';
    div.style.zIndex = '2500';
    document.body.appendChild(div);
    this._state.container = div;
  },

  /* ---------- РЕНДЕР ---------- */
  render: function() {
    if (!this._state.container) return;
    var phase = this._state.phase;
    if (phase === 'overview') this._renderOverview();
    else if (phase === 'exercise') this._renderExercise();
    else if (phase === 'set-timer') this._renderSetTimer();
    else if (phase === 'survey') this._renderSurvey();
    else if (phase === 'rest') this._renderRest();
    else if (phase === 'summary') this._renderSummary();
  },

  // Шапка модалки (как в workout.js)
  _buildShell: function(title, opts) {
    opts = opts || {};
    var esc = this._esc;
    var content = document.createElement('div');
    content.className = 'workout-modal-content';
    content.style.cssText = 'max-width:640px;padding:0;overflow:hidden;display:flex;flex-direction:column;max-height:92vh';

    // Шапка
    var header = document.createElement('div');
    header.style.cssText = 'padding:14px 16px 10px;border-bottom:1px solid var(--border-subtle);flex-shrink:0;background:var(--bg-secondary)';
    header.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px">' +
        '<h2 style="font-family:var(--font-display);color:var(--accent-gold);margin:0;font-size:1.15em;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + title + '</h2>' +
        '<div style="display:flex;gap:6px;align-items:center;flex-shrink:0">' +
          (opts.onBack ? '<button class="wf-hdr-btn" data-act="back" aria-label="Назад" style="background:var(--bg-card);border:1px solid var(--border-subtle);color:var(--text-secondary);width:34px;height:34px;border-radius:50%;font-size:1em;cursor:pointer;display:flex;align-items:center;justify-content:center"><i class="ph ph-arrow-left"></i></button>' : '') +
          '<button class="wf-hdr-btn" data-act="switch" title="Обычный режим (список)" aria-label="Обычный режим" style="background:var(--bg-card);border:1px solid var(--border-subtle);color:var(--text-secondary);width:34px;height:34px;border-radius:50%;font-size:1em;cursor:pointer;display:flex;align-items:center;justify-content:center"><i class="ph ph-list-dashes"></i></button>' +
          '<button class="wf-hdr-btn" data-act="close" aria-label="Закрыть" style="background:var(--bg-card);border:1px solid var(--border-subtle);color:var(--text-secondary);width:34px;height:34px;border-radius:50%;font-size:1em;cursor:pointer;display:flex;align-items:center;justify-content:center"><i class="ph ph-x"></i></button>' +
        '</div>' +
      '</div>';

    // Прогресс-бар
    var totalSets = 0, doneSets = 0;
    var dayRecord = this._getTodayRecord(this.getHistory());
    for (var i = 0; i < this._state.exercises.length; i++) {
      var e = this._state.exercises[i];
      totalSets += e.parsed.sets;
      var detail = this._getExDetail(dayRecord, e.ex.id);
      if (detail && Array.isArray(detail.sets)) {
        for (var s = 0; s < e.parsed.sets; s++) {
          var st = detail.sets[s];
          if (st === 'done' || st === 'partial') doneSets++;
        }
      }
    }
    var pct = totalSets > 0 ? Math.round(doneSets / totalSets * 100) : 0;
    var barWrap = document.createElement('div');
    barWrap.style.cssText = 'margin-top:10px;height:6px;background:rgba(0,0,0,0.3);border-radius:3px;overflow:hidden;border:1px solid var(--border-subtle)';
    barWrap.innerHTML = '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,var(--accent-gold),var(--accent-gold-light));border-radius:3px;transition:width 0.3s"></div>';
    header.appendChild(barWrap);
    content.appendChild(header);

    // Кнопки
    var self = this;
    header.querySelector('[data-act="close"]').onclick = function() { self.close(); };
    header.querySelector('[data-act="switch"]').onclick = function() { self._switchToClassic(); };
    if (opts.onBack) {
      var b = header.querySelector('[data-act="back"]');
      if (b) b.onclick = opts.onBack;
    }

    // Тело
    var body = document.createElement('div');
    body.style.cssText = 'padding:14px 16px 16px;overflow-y:auto;flex:1;-webkit-overflow-scrolling:touch';
    content.appendChild(body);

    // Пересобираем контейнер
    this._state.container.innerHTML = '';
    this._state.container.appendChild(content);

    return body;
  },

  _css: function() {
    return '<style>' +
      '.wf-ex-card { background:var(--bg-card); border-radius:12px; margin-bottom:10px; border:1px solid var(--border-subtle); overflow:hidden; }' +
      '.wf-ex-card.done { border-color:var(--accent-success); background:rgba(74,222,128,0.04); }' +
      '.wf-ex-row { display:flex; align-items:center; gap:10px; padding:10px 12px; }' +
      '.wf-ex-row .idx { width:26px; height:26px; border-radius:50%; background:var(--bg-primary); border:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:center; font-size:0.78em; font-weight:700; color:var(--accent-gold); flex-shrink:0; }' +
      '.wf-ex-card.done .idx { background:var(--accent-success); color:#000; border-color:var(--accent-success); }' +
      '.wf-ex-row .info { flex:1; min-width:0; }' +
      '.wf-ex-row .name { font-weight:600; font-size:0.9em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }' +
      '.wf-ex-row .meta { font-size:0.72em; opacity:0.65; margin-top:2px; }' +
      '.wf-media { border-radius:10px; overflow:hidden; background:var(--bg-primary); max-height:200px; display:flex; align-items:center; justify-content:center; margin-bottom:12px; }' +
      '.wf-media img { max-width:100%; max-height:200px; display:block; object-fit:contain; }' +
      '.wf-meta-line { display:flex; flex-wrap:wrap; gap:6px; font-size:0.75em; opacity:0.8; margin-top:8px; }' +
      '.wf-meta-line span { display:inline-flex; align-items:center; gap:4px; padding:3px 9px; background:var(--bg-primary); border-radius:12px; border:1px solid var(--border-subtle); }' +
      '.wf-set-dots { display:flex; gap:8px; justify-content:center; margin:12px 0; flex-wrap:wrap; }' +
      '.wf-set-dot { width:38px; height:38px; border-radius:50%; border:2px solid var(--border-subtle); background:var(--bg-primary); display:flex; align-items:center; justify-content:center; font-weight:700; font-size:0.85em; color:var(--text-secondary); }' +
      '.wf-set-dot.done { border-color:var(--accent-success); background:rgba(74,222,128,0.12); color:var(--accent-success); }' +
      '.wf-set-dot.partial { border-color:var(--accent-warning); background:rgba(251,191,36,0.12); color:var(--accent-warning); }' +
      '.wf-set-dot.active { border-color:var(--accent-gold); box-shadow:0 0 10px var(--accent-gold); color:var(--accent-gold); }' +
      '.wf-set-dot.missed { border-color:var(--accent-error); background:rgba(248,113,113,0.1); color:var(--accent-error); }' +
      '.wf-btn { padding:12px 16px; border:none; border-radius:12px; font-family:var(--font-primary); font-weight:700; font-size:0.92em; cursor:pointer; transition:all 0.2s; display:flex; align-items:center; justify-content:center; gap:6px; width:100%; }' +
      '.wf-btn:hover:not(:disabled) { transform:translateY(-2px); }' +
      '.wf-btn:active:not(:disabled) { transform:scale(0.98); }' +
      '.wf-btn:disabled { opacity:0.4; cursor:not-allowed; }' +
      '.wf-btn-primary { background:linear-gradient(135deg, var(--accent-gold), var(--accent-gold-light)); color:#000; }' +
      '.wf-btn-secondary { background:var(--bg-card); color:var(--text-primary); border:1px solid var(--border-subtle); }' +
      '.wf-btn-success { background:linear-gradient(135deg,#16a34a,#22c55e); color:#fff; }' +
      '.wf-btn-warning { background:linear-gradient(135deg,#d97706,#f59e0b); color:#fff; }' +
      '.wf-btn-danger { background:linear-gradient(135deg,#dc2626,#ef4444); color:#fff; }' +
      '.wf-big-timer { display:flex; align-items:center; justify-content:center; min-height:230px; position:relative; }' +
      '.wf-timer-ring { position:relative; width:220px; height:220px; max-width:70vw; max-height:70vw; }' +
      '.wf-timer-ring svg { width:100%; height:100%; transform:rotate(-90deg); }' +
      '.wf-timer-ring .wf-timer-bg { fill:none; stroke:rgba(255,255,255,0.06); stroke-width:10; }' +
      '.wf-timer-ring .wf-timer-fill { fill:none; stroke:var(--accent-gold); stroke-width:10; stroke-linecap:round; transition:stroke-dashoffset 0.4s linear; }' +
      '.wf-timer-ring.rest .wf-timer-fill { stroke:var(--accent-info); }' +
      '.wf-timer-text { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; pointer-events:none; }' +
      '.wf-timer-text .val { font-family:var(--font-display); font-size:3em; font-weight:900; color:var(--accent-gold); line-height:1; letter-spacing:-2px; }' +
      '.wf-timer-text .val.rest { color:var(--accent-info); }' +
      '.wf-timer-text .lbl { font-size:0.75em; opacity:0.7; text-transform:uppercase; letter-spacing:2px; margin-top:6px; }' +
      '.wf-timer-actions { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }' +
      '.wf-summary-hero { text-align:center; padding:12px 0; }' +
      '.wf-summary-hero .trophy { font-size:3.4em; color:var(--accent-gold); margin-bottom:8px; display:inline-block; animation:achBounce 0.7s ease-out; }' +
      '.wf-summary-hero h1 { font-family:var(--font-display); font-size:1.5em; margin:0 0 4px 0; color:var(--accent-gold); }' +
      '.wf-summary-hero p { margin:0; opacity:0.7; font-size:0.85em; }' +
      '.wf-summary-stats { display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; margin:14px 0; }' +
      '.wf-summary-stat { background:var(--bg-primary); border:1px solid var(--border-subtle); border-radius:10px; padding:10px; text-align:center; }' +
      '.wf-summary-stat .v { font-family:var(--font-display); font-size:1.4em; font-weight:800; color:var(--accent-gold); line-height:1; }' +
      '.wf-summary-stat .l { font-size:0.68em; opacity:0.6; text-transform:uppercase; letter-spacing:1px; margin-top:4px; }' +
      '.wf-tip-card { background:linear-gradient(135deg, rgba(74,158,255,0.1), rgba(138,92,255,0.05)); border:1px solid rgba(74,158,255,0.3); border-radius:12px; padding:12px 14px; display:flex; gap:10px; align-items:start; }' +
      '.wf-tip-card .ti { font-size:1.4em; color:var(--accent-info); flex-shrink:0; }' +
      '.wf-tip-card .tc { font-size:0.82em; line-height:1.5; }' +
      '.wf-tip-card .tc strong { color:var(--accent-info); }' +
      '.wf-checkbox-row { display:flex; align-items:center; gap:10px; padding:10px 12px; background:var(--bg-primary); border-radius:10px; border:1px solid var(--border-subtle); margin-top:12px; cursor:pointer; }' +
      '.wf-checkbox-row input { width:18px; height:18px; accent-color:var(--accent-gold); cursor:pointer; flex-shrink:0; }' +
      '.wf-checkbox-row span { font-size:0.82em; }' +
      '.wf-autohint { font-size:0.72em; opacity:0.6; margin-top:8px; display:flex; align-items:center; justify-content:center; gap:4px; text-align:center; }' +
      '@keyframes achBounce { 0% { transform:scale(0) rotate(-180deg); } 60% { transform:scale(1.3) rotate(10deg); } 100% { transform:scale(1) rotate(0); } }' +
      '@media (max-width: 480px) {' +
        '.wf-timer-ring { width:190px; height:190px; }' +
        '.wf-timer-text .val { font-size:2.6em; }' +
        '.wf-timer-actions { grid-template-columns:1fr 1fr; }' +
        '.wf-timer-actions .wf-btn:last-child { grid-column:1/-1; }' +
      '}' +
      '@media (prefers-reduced-motion: reduce) {' +
        '.wf-btn, .wf-timer-fill, .wf-summary-hero .trophy { transition:none !important; animation:none !important; }' +
      '}' +
    '</style>';
  },

  _switchToClassic: function() {
    this.close();
    if (typeof WorkoutModule !== 'undefined' && WorkoutModule.openWorkoutModal) {
      WorkoutModule.openWorkoutModal();
    }
  },

  /* ---------- ЭКРАН 1: ОБЗОР ---------- */
  _renderOverview: function() {
    var body = this._buildShell('<i class="ph ph-barbell"></i> ' + this._esc(this._state.todayPlan.dayName || 'Сегодня'));
    body.innerHTML = this._css() + this._buildOverviewHtml();
  },

  _buildOverviewHtml: function() {
    var esc = this._esc;
    var exercises = this._state.exercises;
    var history = this.getHistory();
    var dayRecord = this._getTodayRecord(history);
    var settings = this.getSettings();
    var dayClosed = dayRecord && dayRecord.xpDayAwarded;

    var html = '';

    if (dayClosed) {
      html += '<div style="text-align:center;padding:10px 0 14px">' +
        '<i class="ph ph-check-circle" style="font-size:2.4em;color:var(--accent-success);display:block;margin-bottom:6px"></i>' +
        '<div style="font-weight:700;color:var(--accent-success)">Тренировка завершена</div>' +
        '<div style="font-size:0.82em;opacity:0.7;margin-top:2px">Все упражнения выполнены</div>' +
      '</div>';
    }

    html += '<div style="font-weight:600;font-size:0.78em;text-transform:uppercase;letter-spacing:1px;color:var(--accent-gold);margin-bottom:8px"><i class="ph ph-list-checks"></i> Упражнения</div>';

    for (var k = 0; k < exercises.length; k++) {
      var ex = exercises[k];
      var parsed = ex.parsed;
      var detail = this._getExDetail(dayRecord, ex.ex.id);
      var sd = 0, allAnswered = true;
      if (detail && Array.isArray(detail.sets)) {
        for (var s = 0; s < parsed.sets; s++) {
          var st = detail.sets[s];
          if (!st) allAnswered = false;
          if (st === 'done' || st === 'partial') sd++;
        }
      } else { allAnswered = false; }
      var isFull = allAnswered && sd > 0;
      html += '<div class="wf-ex-card ' + (isFull ? 'done' : '') + '">' +
        '<div class="wf-ex-row">' +
          '<div class="idx">' + (isFull ? '<i class="ph ph-check"></i>' : (k + 1)) + '</div>' +
          '<div class="info">' +
            '<div class="name">' + esc(ex.ex.name) + '</div>' +
            '<div class="meta">' + parsed.sets + '×' + parsed.reps + ' · ' + sd + '/' + parsed.sets + ' подх.' +
              (ex.ex.timer > 0 ? ' · ⏱ ' + ex.ex.timer + 'с' : '') +
              (ex.ex.restTimer > 0 ? ' · 😴 ' + ex.ex.restTimer + 'с' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    if (dayClosed) {
      html += '<button class="wf-btn wf-btn-secondary" style="margin-top:12px" onclick="WorkoutFlow.close()"><i class="ph ph-x"></i> Закрыть</button>';
    } else {
      var startIdx = 0;
      for (var si = 0; si < exercises.length; si++) {
        if (!this._isExerciseFullyAnswered(exercises[si], dayRecord)) { startIdx = si; break; }
      }

      var totalAnswered = 0;
      if (dayRecord && Array.isArray(dayRecord.details)) {
        for (var a = 0; a < dayRecord.details.length; a++) {
          if (dayRecord.details[a] && Array.isArray(dayRecord.details[a].sets)) {
            for (var a2 = 0; a2 < dayRecord.details[a].sets.length; a2++) {
              if (dayRecord.details[a].sets[a2]) totalAnswered++;
            }
          }
        }
      }
      if (totalAnswered === 0) {
        html += '<div style="background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:10px;padding:10px;margin-top:12px">' +
          '<div style="font-weight:600;font-size:0.78em;color:var(--accent-gold);margin-bottom:6px;display:flex;align-items:center;gap:4px"><i class="ph ph-gear"></i> Автопереход</div>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:0.78em">' +
            '<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" ' + (settings.autoRestAfterSet ? 'checked' : '') + ' onchange="WorkoutFlow.saveSetting(\'autoRestAfterSet\', this.checked)" style="accent-color:var(--accent-gold)"> После подхода — отдых</label>' +
            '<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" ' + (settings.autoNextSetAfterRest ? 'checked' : '') + ' onchange="WorkoutFlow.saveSetting(\'autoNextSetAfterRest\', this.checked)" style="accent-color:var(--accent-gold)"> После отдыха — следующий</label>' +
            '<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" ' + (settings.metronomeEnabled ? 'checked' : '') + ' onchange="WorkoutFlow.saveSetting(\'metronomeEnabled\', this.checked)" style="accent-color:var(--accent-gold)"> Метроном</label>' +
          '</div>' +
        '</div>';
      }

      html += '<button class="wf-btn wf-btn-primary" style="margin-top:12px" onclick="WorkoutFlow._startFrom(' + startIdx + ')"><i class="ph ph-play-circle"></i> ' +
        (totalAnswered > 0 ? 'Продолжить' : 'Начать') + '</button>';
    }

    return html;
  },

  _startFrom: function(idx) {
    this._state.exIdx = idx;
    this._state.setIdx = 0;
    this._state.phase = 'exercise';
    this.render();
  },

  /* ---------- ЭКРАН 2: УПРАЖНЕНИЕ ---------- */
  _renderExercise: function() {
    var esc = this._esc;
    var exData = this._state.exercises[this._state.exIdx];
    if (!exData) { this.close(); return; }
    var ex = exData.ex;
    var parsed = exData.parsed;
    var history = this.getHistory();
    var dayRecord = this._getTodayRecord(history);
    var detail = this._getExDetail(dayRecord, ex.id);

    var currentSet = 0;
    if (detail && Array.isArray(detail.sets)) {
      for (var i = 0; i < parsed.sets; i++) {
        var st = detail.sets[i];
        if (st !== 'done' && st !== 'partial') { currentSet = i; break; }
        currentSet = i + 1;
      }
    }
    if (currentSet >= parsed.sets) currentSet = parsed.sets - 1;
    this._state.setIdx = currentSet;

    var isDone = this._isExerciseFullyAnswered(exData, dayRecord);

    var body = this._buildShell(
      'Упражнение ' + (this._state.exIdx + 1) + ' / ' + this._state.exercises.length,
      { onBack: function() { WorkoutFlow._backToOverview(); } }
    );

    var html = this._css();

    // Медиа
    if (ex.imageUrl) {
      html += '<div class="wf-media"><img src="' + esc(ex.imageUrl) + '" alt="" onerror="this.style.display=\'none\'"></div>';
    }

    // Название и мета
    html += '<div>' +
      '<h1 style="font-family:var(--font-display);color:var(--accent-gold);margin:0 0 4px 0;font-size:1.3em">' + esc(ex.name) + '</h1>' +
      '<div class="wf-meta-line">' +
        (ex.muscleGroup ? '<span><i class="ph ph-tag"></i> ' + esc(ex.muscleGroup) + '</span>' : '') +
        '<span><i class="ph ph-fire" style="color:var(--accent-warning)"></i> ' + (ex.difficulty || 3) + '/5</span>' +
        '<span><i class="ph ph-list-numbers"></i> ' + parsed.sets + '×' + parsed.reps + '</span>' +
        (ex.timer > 0 ? '<span><i class="ph ph-timer" style="color:var(--accent-gold)"></i> ' + ex.timer + ' с</span>' : '') +
        (ex.restTimer > 0 ? '<span><i class="ph ph-pause-circle"></i> ' + ex.restTimer + ' с</span>' : '') +
      '</div>' +
    '</div>';

    // Описание
    if (ex.description) {
      html += '<div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:10px;padding:10px 12px;font-size:0.85em;line-height:1.5;white-space:pre-wrap;opacity:0.85;margin-top:10px">' + esc(ex.description) + '</div>';
    }
    // Инвентарь
    if (ex.inventory) {
      html += '<div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:10px;padding:8px 12px;display:flex;align-items:center;gap:6px;font-size:0.82em;margin-top:8px"><i class="ph ph-backpack" style="color:var(--accent-gold)"></i> ' + esc(ex.inventory) + '</div>';
    }

    // Видео
    if (ex.videoUrl && typeof Media !== 'undefined') {
      var videoEl = Media.renderVideo(ex.videoUrl, { maxHeight: 180, marginTop: 0 });
      if (videoEl) {
        html += '<div id="wfVideoWrap" style="margin-top:8px"></div>';
        setTimeout(function() {
          var w = document.getElementById('wfVideoWrap');
          if (w) w.appendChild(videoEl);
        }, 20);
      }
    }

    // Подходы
    html += '<div style="text-align:center;margin-top:14px">' +
      '<div style="font-size:0.72em;text-transform:uppercase;letter-spacing:2px;color:var(--accent-gold);margin-bottom:8px">Подходы</div>' +
      '<div class="wf-set-dots">';
    for (var s = 0; s < parsed.sets; s++) {
      var status = detail && Array.isArray(detail.sets) ? detail.sets[s] : null;
      var cls = '';
      if (status === 'done') cls = 'done';
      else if (status === 'partial') cls = 'partial';
      else if (status === 'missed' || status === 'skipped') cls = 'missed';
      else if (s === currentSet) cls = 'active';
      var icon = status === 'done' ? '✓' : (status === 'partial' ? '~' : (status === 'missed' ? '✕' : (s + 1)));
      html += '<div class="wf-set-dot ' + cls + '">' + icon + '</div>';
    }
    html += '</div></div>';

    // Кнопки
    if (isDone) {
      html += '<button class="wf-btn wf-btn-success" style="margin-top:10px" onclick="WorkoutFlow._nextExercise()"><i class="ph ph-arrow-right"></i> Следующее упражнение</button>';
    } else {
      html += '<button class="wf-btn wf-btn-primary" style="margin-top:10px" onclick="WorkoutFlow._startSet()"><i class="ph ph-play"></i> ' +
        (ex.timer > 0 ? 'Начать подход (' + ex.timer + ' с)' : 'Начать подход') + '</button>';
      if (currentSet > 0) {
        html += '<button class="wf-btn wf-btn-secondary" style="margin-top:8px" onclick="WorkoutFlow._skipSetPrompt()"><i class="ph ph-skip-forward"></i> Пропустить подход</button>';
      }
    }

    body.innerHTML = html;
  },

  /* ---------- ЭКРАН 3: ТАЙМЕР ВЫПОЛНЕНИЯ ---------- */
  _renderSetTimer: function() {
    var esc = this._esc;
    var exData = this._state.exercises[this._state.exIdx];
    if (!exData) { this.close(); return; }
    var ex = exData.ex;
    var parsed = exData.parsed;
    var setIdx = this._state.setIdx;
    var timerSec = ex.timer || 0;
    var mode = timerSec > 0 ? 'down' : 'up';
    this._state.timerMode = mode;
    this._state.timerKind = 'set';
    this._state.timerTotalSec = timerSec;
    this._state.timerElapsedSec = 0;

    var body = this._buildShell(
      'Подход ' + (setIdx + 1) + ' / ' + parsed.sets + ' · ' + esc(ex.name),
      { onBack: function() { WorkoutFlow._cancelSetTimer(); } }
    );

    var html = this._css();
    html += '<div class="wf-big-timer">' +
      '<div class="wf-timer-ring" id="wfTimerRing">' +
        '<svg viewBox="0 0 260 260"><circle class="wf-timer-bg" cx="130" cy="130" r="115"/><circle class="wf-timer-fill" id="wfTimerFill" cx="130" cy="130" r="115" stroke-dasharray="722.5" stroke-dashoffset="0"/></svg>' +
        '<div class="wf-timer-text"><div class="val" id="wfTimerVal">' + (mode === 'down' ? this._formatSec(timerSec) : '0:00') + '</div>' +
        '<div class="lbl" id="wfTimerLbl">' + (mode === 'down' ? 'выполнение' : 'секундомер') + '</div></div>' +
      '</div>' +
    '</div>';

    html += '<div class="wf-timer-actions">' +
      '<button class="wf-btn wf-btn-secondary" id="wfPauseBtn" onclick="WorkoutFlow._togglePause()"><i class="ph ph-pause"></i> Пауза</button>' +
      '<button class="wf-btn wf-btn-success" onclick="WorkoutFlow._stopSetTimer()"><i class="ph ph-check"></i> Закончил</button>' +
      '<button class="wf-btn wf-btn-danger" onclick="WorkoutFlow._skipSetPrompt()"><i class="ph ph-x"></i> Пропустить</button>' +
    '</div>';

    html += '<div class="wf-autohint"><i class="ph ph-info"></i> ' +
      (mode === 'down' ? 'Таймер идёт вниз, по нулю — сигнал' : 'Секундомер идёт вверх — жми «Закончил»') +
    '</div>';

    body.innerHTML = html;
    var self = this;
    setTimeout(function() { self._startTimer(mode, timerSec, 'set'); }, 50);
  },

  /* ---------- ЭКРАН 5: ОТДЫХ ---------- */
  _renderRest: function() {
    var esc = this._esc;
    var exData = this._state.exercises[this._state.exIdx];
    if (!exData) { this.close(); return; }
    var ex = exData.ex;
    var settings = this.getSettings();
    var restSec = ex.restTimer > 0 ? ex.restTimer : (settings.defaultRestSec || 60);
    this._state.timerKind = 'rest';
    this._state.timerMode = 'down';
    this._state.timerTotalSec = restSec;
    this._state.timerElapsedSec = 0;

    var nextLabel = 'Следующий подход';
    if (this._state.setIdx + 1 >= exData.parsed.sets) nextLabel = 'Следующее упражнение';

    var body = this._buildShell(
      '<i class="ph ph-pause-circle"></i> Отдых',
      { onBack: function() { WorkoutFlow._skipRest(); } }
    );

    var html = this._css();
    html += '<div class="wf-big-timer">' +
      '<div class="wf-timer-ring rest" id="wfTimerRing">' +
        '<svg viewBox="0 0 260 260"><circle class="wf-timer-bg" cx="130" cy="130" r="115"/><circle class="wf-timer-fill" id="wfTimerFill" cx="130" cy="130" r="115" stroke-dasharray="722.5" stroke-dashoffset="0"/></svg>' +
        '<div class="wf-timer-text"><div class="val rest" id="wfTimerVal">' + this._formatSec(restSec) + '</div>' +
        '<div class="lbl" id="wfTimerLbl">' + esc(nextLabel) + '</div></div>' +
      '</div>' +
    '</div>';

    html += '<div class="wf-timer-actions">' +
      '<button class="wf-btn wf-btn-secondary" id="wfPauseBtn" onclick="WorkoutFlow._togglePause()"><i class="ph ph-pause"></i> Пауза</button>' +
      '<button class="wf-btn wf-btn-success" onclick="WorkoutFlow._stopRest()"><i class="ph ph-check"></i> Хватит</button>' +
      '<button class="wf-btn wf-btn-danger" onclick="WorkoutFlow._skipRest()"><i class="ph ph-skip-forward"></i> Пропустить</button>' +
    '</div>';

    html += '<div class="wf-autohint"><i class="ph ph-info"></i> По нулю — сигнал. Останови вручную «Хватит».</div>';
    body.innerHTML = html;

    var self = this;
    setTimeout(function() { self._startTimer('down', restSec, 'rest'); }, 50);
  },

  /* ---------- ЭКРАН 4: МИНИ-ОПРОС ---------- */
  _renderSurvey: function() {
    var exData = this._state.exercises[this._state.exIdx];
    if (!exData) { this.close(); return; }
    var parsed = exData.parsed;
    var setIdx = this._state.setIdx;

    var body = this._buildShell('Подход ' + (setIdx + 1) + ' из ' + parsed.sets);
    body.innerHTML = this._css() +
      '<div style="text-align:center;padding:10px 0">' +
        '<div style="font-size:2.4em;margin-bottom:6px">💪</div>' +
        '<h2 style="font-family:var(--font-display);color:var(--accent-gold);margin:0 0 4px 0;font-size:1.2em">Как выполнил?</h2>' +
        '<p style="opacity:0.7;font-size:0.85em;margin:0 0 16px 0">' + parsed.reps + ' повторений</p>' +
        '<button class="wf-btn wf-btn-success" style="margin-bottom:8px" onclick="WorkoutFlow._answerSet(\'done\')"><i class="ph ph-check-circle"></i> Да, все ' + parsed.reps + '</button>' +
        '<button class="wf-btn wf-btn-warning" style="margin-bottom:8px" onclick="WorkoutFlow._answerSet(\'partial\')"><i class="ph ph-warning-circle"></i> Частично</button>' +
        '<button class="wf-btn wf-btn-danger" onclick="WorkoutFlow._answerSet(\'missed\')"><i class="ph ph-x-circle"></i> Не выполнил</button>' +
      '</div>';
  },

  /* ---------- ЭКРАН 6: ИТОГ ---------- */
  _renderSummary: function() {
    var esc = this._esc;
    var s = this._state.lastSummary;
    if (!s) { this.close(); return; }

    var elapsedMin = Math.max(1, Math.round(s.elapsedMs / 60000));
    var tips = this._getPostWorkoutTips(s);
    var settings = this.getSettings();

    var body = this._buildShell('<i class="ph ph-trophy"></i> Тренировка завершена');

    var html = this._css();
    html += '<div class="wf-summary-hero">' +
      '<i class="ph-fill ph-trophy trophy"></i>' +
      '<h1>Отличная работа!</h1>' +
      '<p>' + esc(this._todayName()) + ' · ' + elapsedMin + ' мин</p>' +
    '</div>';

    html += '<div class="wf-summary-stats">' +
      '<div class="wf-summary-stat"><div class="v">' + s.doneEx + '/' + s.totalEx + '</div><div class="l">Упражнений</div></div>' +
      '<div class="wf-summary-stat"><div class="v">' + s.doneSets + '/' + s.totalSets + '</div><div class="l">Подходов</div></div>' +
      '<div class="wf-summary-stat"><div class="v">+' + s.xpDay + '</div><div class="l">XP за день</div></div>' +
      '<div class="wf-summary-stat"><div class="v">' + s.doneSets + '</div><div class="l">Выполнено</div></div>' +
    '</div>';

    html += '<div class="wf-tip-card">' +
      '<div class="ti">💡</div>' +
      '<div class="tc"><strong>' + esc(tips.title) + '</strong><br>' + tips.text + '</div>' +
    '</div>';

    html += '<label class="wf-checkbox-row">' +
      '<input type="checkbox" id="wfHideSummary" ' + (settings.hideWorkoutSummary ? 'checked' : '') + ' onchange="WorkoutFlow.saveSetting(\'hideWorkoutSummary\', this.checked)">' +
      '<span>Больше не показывать это окно</span>' +
    '</label>';

    html += '<button class="wf-btn wf-btn-primary" style="margin-top:12px" onclick="WorkoutFlow.close()"><i class="ph ph-check"></i> Закрыть</button>';

    body.innerHTML = html;
  },

  _getPostWorkoutTips: function(summary) {
    var tips = [
      { title: 'Восстановление', text: 'Выпей 300–500 мл воды. В течение 60 минут съешь порцию белка (20–30 г) и сложные углеводы.' },
      { title: 'Сон', text: 'Старайся спать 7–9 часов. Мышцы растут во сне, а не в зале.' },
      { title: 'Растяжка', text: '5–10 минут лёгкой растяжки помогут снизить крепатуру.' },
      { title: 'Следующая тренировка', text: 'Дай мышцам отдохнуть 24–48 часов перед следующей нагрузкой этой группы.' }
    ];
    var idx = summary.elapsedMs > 45 * 60000 ? 1 : Math.floor(Math.random() * tips.length);
    return tips[idx];
  },

  /* ---------- ТАЙМЕР ---------- */
  _startTimer: function(mode, totalSec, kind) {
    this._stopTimer();
    var self = this;
    this._state.timerMode = mode;
    this._state.timerKind = kind;
    this._state.timerTotalSec = totalSec;
    this._state.timerElapsedSec = 0;
    this._state.timerStartedAt = Date.now();
    this._state.timerRunning = true;

    this._updateTimerDisplay();
    if (kind === 'set') this._startMetronome();

    this._state.timerHandle = setInterval(function() {
      if (!self._state.timerRunning) return;
      var elapsed = Math.floor((Date.now() - self._state.timerStartedAt) / 1000);
      self._state.timerElapsedSec = elapsed;

      if (mode === 'down') {
        var remaining = totalSec - elapsed;
        if (remaining <= 0) {
          self._handleTimerEnd(kind);
          return;
        }
      }
      self._updateTimerDisplay();
    }, 200);
  },

  _stopTimer: function() {
    if (this._state.timerHandle) {
      clearInterval(this._state.timerHandle);
      this._state.timerHandle = null;
    }
    this._state.timerRunning = false;
  },

  _togglePause: function() {
    if (this._state.timerRunning) {
      this._state.timerRunning = false;
      if (this._state.timerHandle) clearInterval(this._state.timerHandle);
      this._state.timerHandle = null;
      this._stopMetronome();
      var btn = document.getElementById('wfPauseBtn');
      if (btn) btn.innerHTML = '<i class="ph ph-play"></i> Продолжить';
    } else {
      var mode = this._state.timerMode;
      var kind = this._state.timerKind;
      this._state.timerStartedAt = Date.now() - this._state.timerElapsedSec * 1000;
      this._state.timerRunning = true;
      if (kind === 'set') this._startMetronome();
      var self = this;
      this._state.timerHandle = setInterval(function() {
        if (!self._state.timerRunning) return;
        var elapsed = Math.floor((Date.now() - self._state.timerStartedAt) / 1000);
        self._state.timerElapsedSec = elapsed;
        if (mode === 'down' && (self._state.timerTotalSec - elapsed) <= 0) {
          self._handleTimerEnd(kind);
          return;
        }
        self._updateTimerDisplay();
      }, 200);
      var btn2 = document.getElementById('wfPauseBtn');
      if (btn2) btn2.innerHTML = '<i class="ph ph-pause"></i> Пауза';
      this._updateTimerDisplay();
    }
  },

  _handleTimerEnd: function(kind) {
    this._stopTimer();
    this._stopMetronome();
    if (kind === 'set') {
      this._setEndSound();
      this._vibrate([200, 100, 200]);
      if (this.getSettings().autoRestAfterSet) {
        this._state.phase = 'survey';
        this.render();
      } else {
        this._updateTimerDisplay(0, true);
      }
    } else if (kind === 'rest') {
      this._restEndSound();
      this._vibrate([300, 150, 300]);
      var lbl = document.getElementById('wfTimerLbl');
      if (lbl) { lbl.textContent = 'Пора продолжать!'; lbl.style.color = 'var(--accent-success)'; }
      if (this.getSettings().autoNextSetAfterRest) {
        var self = this;
        setTimeout(function() { self._advanceAfterRest(); }, 600);
      }
    }
  },

  _updateTimerDisplay: function(forceVal) {
    var valEl = document.getElementById('wfTimerVal');
    var fillEl = document.getElementById('wfTimerFill');
    if (!valEl) return;
    var mode = this._state.timerMode;
    var total = this._state.timerTotalSec;
    var elapsed = this._state.timerElapsedSec;
    var display;
    if (forceVal !== undefined) display = this._formatSec(forceVal);
    else if (mode === 'down') display = this._formatSec(Math.max(0, total - elapsed));
    else display = this._formatSec(elapsed);
    valEl.textContent = display;
    if (fillEl) {
      var circumference = 2 * Math.PI * 115;
      var pct = mode === 'down' ? Math.min(1, elapsed / total) : 0;
      fillEl.style.strokeDashoffset = (circumference * pct).toFixed(1);
    }
  },

  _startMetronome: function() {
    this._stopMetronome();
    var s = this.getSettings();
    if (!s.metronomeEnabled) return;
    var interval = Math.max(1, parseInt(s.metronomeInterval, 10) || 1) * 1000;
    var self = this;
    this._state.metronomeTick = 0;
    this._state.metronomeHandle = setInterval(function() {
      if (!self._state.timerRunning) return;
      self._state.metronomeTick++;
      self._metronomeTick();
    }, interval);
  },
  _stopMetronome: function() {
    if (this._state.metronomeHandle) {
      clearInterval(this._state.metronomeHandle);
      this._state.metronomeHandle = null;
    }
  },

  /* ---------- ДЕЙСТВИЯ ---------- */
  _backToOverview: function() {
    this._stopTimer();
    this._stopMetronome();
    this._state.phase = 'overview';
    this.render();
  },

  _startSet: function() {
    this._state.phase = 'set-timer';
    this.render();
  },

  _cancelSetTimer: function() {
    this._stopTimer();
    this._stopMetronome();
    this._state.phase = 'exercise';
    this.render();
  },

  _stopSetTimer: function() {
    this._stopTimer();
    this._stopMetronome();
    this._state.phase = 'survey';
    this.render();
  },

  _skipSetPrompt: function() {
    this._stopTimer();
    this._stopMetronome();
    this._answerSet('missed');
  },

  _answerSet: function(status) {
    var exData = this._state.exercises[this._state.exIdx];
    if (!exData) { this.close(); return; }

    var exId = exData.ex.id;
    var setIdx = this._state.setIdx;
    var history = this.getHistory();
    var dayRecord = this._getTodayRecord(history, true);

    var detail = this._getExDetail(dayRecord, exId, true);
    while (detail.sets.length <= setIdx) detail.sets.push(null);
    var prevStatus = detail.sets[setIdx];
    detail.sets[setIdx] = status;

    var stats = this.getStats();
    var delta = this._xpForStatus(status) - this._xpForStatus(prevStatus);
    if (delta !== 0) {
      stats.xp = Math.max(0, (stats.xp || 0) + delta);
      if (typeof CoreData !== 'undefined' && CoreData.logXP) {
        CoreData.logXP(delta, 'Подход', { exId: exId, setIdx: setIdx, status: status });
      }
    }

    var hasEx = false;
    for (var i = 0; i < dayRecord.exercises.length; i++) if (dayRecord.exercises[i].id === exId) { hasEx = true; break; }
    if (!hasEx) dayRecord.exercises.push({ id: exId });

    var exDone = true;
    for (var s = 0; s < exData.parsed.sets; s++) if (!detail.sets[s]) { exDone = false; break; }
    if (exDone && !detail.xpAwarded) {
      detail.xpAwarded = true;
      stats.xp += this.XP.PER_EXERCISE;
      if (typeof CoreData !== 'undefined' && CoreData.logXP) {
        CoreData.logXP(this.XP.PER_EXERCISE, 'Упражнение завершено', { exId: exId });
      }
    }

    var dayFully = this._isDayFullyAnswered(dayRecord);
    if (dayFully && !dayRecord.xpDayAwarded) {
      dayRecord.xpDayAwarded = true;
      var todayStr = this._todayStr();
      if (stats.lastWorkoutDate !== todayStr) {
        stats.yes = (stats.yes || 0) + 1;
        stats.streak = (stats.streak || 0) + 1;
        stats.lastWorkoutDate = todayStr;
      }
      stats.xp += this.XP.PER_DAY;
      if (typeof CoreData !== 'undefined' && CoreData.logXP) {
        CoreData.logXP(this.XP.PER_DAY, 'День завершён', null);
      }
    }

    var xpNeeded = this._xpForLevel(stats.level);
    var leveledUp = false;
    while (stats.xp >= xpNeeded) {
      stats.xp -= xpNeeded;
      stats.level++;
      leveledUp = true;
      xpNeeded = this._xpForLevel(stats.level);
    }

    this.saveStats(stats);
    this.saveHistory(history);

    if (typeof refreshHeaderAfterXP === 'function') refreshHeaderAfterXP();
    if (leveledUp) {
      var lvl = stats.level;
      setTimeout(function() {
        if (typeof showAchievementToast === 'function') {
          showAchievementToast('Новый уровень ' + lvl + '!', 'Ты достиг уровня ' + lvl, 'ph-star');
        }
      }, 100);
    }
    if (typeof AchievementsModule !== 'undefined' && AchievementsModule.checkAchievements) {
      AchievementsModule.checkAchievements();
    }

    if (dayFully && !this._state._daySummaryShown) {
      this._state._daySummaryShown = true;
      var self = this;
      setTimeout(function() { self._showSummary(); }, 300);
      return;
    }

    var settings = this.getSettings();
    var hasRest = exData.ex.restTimer > 0 || (settings.defaultRestSec > 0);
    var nextSetExists = (setIdx + 1) < exData.parsed.sets;

    if (nextSetExists && hasRest) {
      this._state.phase = 'rest';
      this.render();
    } else if (nextSetExists) {
      this._state.setIdx = setIdx + 1;
      this._state.phase = 'exercise';
      this.render();
    } else {
      this._nextExercise();
    }
  },

  _xpForStatus: function(status) {
    if (status === 'done') return this.XP.PER_SET;
    if (status === 'partial') return this.XP.PER_PARTIAL;
    return 0;
  },
  _xpForLevel: function(level) {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.xpForLevel) return Core.utils.xpForLevel(level);
    return Math.floor(100 * Math.pow(1.2, Math.max(0, (level || 1) - 1)));
  },

  _stopRest: function() {
    this._stopTimer();
    this._advanceAfterRest();
  },
  _skipRest: function() {
    this._stopTimer();
    this._advanceAfterRest();
  },
  _advanceAfterRest: function() {
    var exData = this._state.exercises[this._state.exIdx];
    if (!exData) { this.close(); return; }
    if (this._state.setIdx + 1 < exData.parsed.sets) {
      this._state.setIdx++;
      this._state.phase = 'exercise';
    } else {
      this._nextExercise();
    }
    this.render();
  },

  _nextExercise: function() {
    var nextIdx = this._state.exIdx + 1;
    if (nextIdx >= this._state.exercises.length) {
      this._showSummary();
      return;
    }
    this._state.exIdx = nextIdx;
    this._state.setIdx = 0;
    this._state.phase = 'exercise';
    this.render();
  },

  _showSummary: function() {
    var settings = this.getSettings();
    if (settings.hideWorkoutSummary) {
      if (typeof Notify !== 'undefined') Notify.success('Тренировка завершена!');
      this.close();
      return;
    }
    var history = this.getHistory();
    var dayRecord = this._getTodayRecord(history);
    var totalEx = this._state.exercises.length;
    var doneEx = 0, totalSets = 0, doneSets = 0;
    for (var i = 0; i < this._state.exercises.length; i++) {
      var e = this._state.exercises[i];
      totalSets += e.parsed.sets;
      var detail = this._getExDetail(dayRecord, e.ex.id);
      var sd = 0, allAnswered = true;
      if (detail && Array.isArray(detail.sets)) {
        for (var s = 0; s < e.parsed.sets; s++) {
          var st = detail.sets[s];
          if (!st) allAnswered = false;
          if (st === 'done' || st === 'partial') sd++;
        }
      } else { allAnswered = false; }
      if (allAnswered) doneEx++;
      doneSets += sd;
    }
    this._state.lastSummary = {
      doneEx: doneEx,
      totalEx: totalEx,
      doneSets: doneSets,
      totalSets: totalSets,
      xpDay: this.XP.PER_DAY,
      elapsedMs: Date.now() - this._state.elapsedDayStart
    };
    this._state.phase = 'summary';
    this.render();
  },

  /* ---------- ХЕЛПЕРЫ ---------- */
  _getTodayRecord: function(history, create) {
    var todayStr = this._todayStr();
    var found = null;
    for (var i = 0; i < history.length; i++) {
      if (history[i].date === todayStr) { found = history[i]; break; }
    }
    if (!found && create) {
      found = {
        date: todayStr,
        dayName: this._todayName(),
        muscleGroup: this._state.todayPlan ? (this._state.todayPlan.muscleGroup || '') : '',
        exercises: [],
        details: [],
        duration: 0,
        timestamp: Date.now()
      };
      history.push(found);
    }
    return found;
  },

  _getExDetail: function(dayRecord, exId, create) {
    if (!dayRecord) return create ? { exId: exId, sets: [], partialReps: [] } : null;
    if (!Array.isArray(dayRecord.details)) dayRecord.details = [];
    var found = null;
    for (var i = 0; i < dayRecord.details.length; i++) {
      if (dayRecord.details[i].exId === exId) { found = dayRecord.details[i]; break; }
    }
    if (!found && create) {
      found = { exId: exId, sets: [], partialReps: [] };
      dayRecord.details.push(found);
    }
    return found;
  },

  _isExerciseFullyAnswered: function(exData, dayRecord) {
    if (!dayRecord || !exData) return false;
    var detail = this._getExDetail(dayRecord, exData.ex.id);
    if (!detail || !Array.isArray(detail.sets)) return false;
    for (var s = 0; s < exData.parsed.sets; s++) {
      if (!detail.sets[s]) return false;
    }
    return true;
  },

  _isDayFullyAnswered: function(dayRecord) {
    if (!dayRecord || !Array.isArray(this._state.exercises) || this._state.exercises.length === 0) return false;
    var hasPositive = false;
    for (var i = 0; i < this._state.exercises.length; i++) {
      var e = this._state.exercises[i];
      var detail = this._getExDetail(dayRecord, e.ex.id);
      if (!detail || !Array.isArray(detail.sets)) return false;
      for (var s = 0; s < e.parsed.sets; s++) {
        var st = detail.sets[s];
        if (!st) return false;
        if (st === 'done' || st === 'partial') hasPositive = true;
      }
    }
    return hasPositive;
  }
};

window.WorkoutFlow = WorkoutFlow;
module.exports = WorkoutFlow;