// modules/stats.js

const StatsModule = {
  zoom: { xMin: 0, xMax: 29, yMin: 0, yMax: 10 },
  isPanning: false,
  panStart: { x: 0, y: 0 },
  panStartZoom: null,
  activeMetrics: {},
  allMetrics: {},
  totalDays: 30,
  calendarMonth: new Date().getMonth(),
  calendarYear: new Date().getFullYear(),
  lastMouseX: -1,
  lastMouseY: -1,
  _chartDataCache: null,
  _chartDataCacheKey: null,
  _zoomInitialized: false,
  _currentMaxY: 10,
  _maxYCache: {},       // NEW: мемоизация findMaxY по ключу данных
  _metricsBuilt: false, // NEW: buildMetrics только один раз
  _legendExpanded: false,

  init: function() {
    if (typeof Logger !== 'undefined') Logger.log('Модуль статистики инициализирован', 'info');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { StatsModule.setup(); });
    } else {
      this.setup();
    }
  },

  setup: function() {
    this.createStatsScreen();
    if (typeof Core !== 'undefined') {
      Core.addNavButton('Статистика', 'stats', '<i class="ph ph-chart-line-up"></i>');
      Core.registerScreen('stats', function() { StatsModule.createStatsScreen(); });
    }
    var self = this;
    if (typeof Events !== 'undefined' && Events.on) {
      Events.on('history:changed', function() {
        self.invalidateChartCache();
        var screen = document.getElementById('screen-stats');
        if (screen && screen.classList.contains('active') && typeof self.drawChart === 'function') {
          self.drawChart();
        }
      });
    }
  },

  invalidateChartCache: function() {
    this._chartDataCache = null;
    this._chartDataCacheKey = null;
    this._maxYCache = {};
  },

  /* ---------- ДАННЫЕ (безопасное чтение) ---------- */
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
    var h;
    if (typeof CoreData !== 'undefined' && CoreData.getHistory) h = CoreData.getHistory();
    else if (typeof FTStorage !== 'undefined' && FTStorage.get) h = FTStorage.get('history');
    else h = [];
    if (!Array.isArray(h)) return [];
    // Защита от битых записей
    return h.filter(function(r) { return r && typeof r.date === 'string' && r.date; });
  },

  getSurveyConfig: function() {
    if (typeof CoreData !== 'undefined' && CoreData.getSurveyConfig) return CoreData.getSurveyConfig();
    if (typeof FTStorage !== 'undefined' && FTStorage.get) return FTStorage.get('survey_config') || null;
    return null;
  },

  _formatDate: function(date) {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.formatLocalDate) {
      return Core.utils.formatLocalDate(date);
    }
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  },

  /* ---------- МЕТРИКИ ---------- */
  buildMetrics: function() {
    if (this._metricsBuilt && Object.keys(this.allMetrics).length > 0) return;

    var metrics = {};
    metrics['exercises'] = { id: 'exercises', label: 'Упражнения', color: '#d4af37', key: 'exCount', enabled: true, source: 'system', unit: '' };
    metrics['weight'] = { id: 'weight', label: 'Вес', color: '#4ade80', key: 'weight', enabled: false, source: 'system', unit: 'кг' };
    metrics['mood'] = { id: 'mood', label: 'Самочувствие', color: '#60a5fa', key: 'mood', enabled: false, source: 'system', unit: '/10' };

    var config = this.getSurveyConfig();
    if (config && Array.isArray(config.questions)) {
      for (var i = 0; i < config.questions.length; i++) {
        var q = config.questions[i];
        if (!q || ['rating', 'emoji', 'range', 'number'].indexOf(q.type) === -1) continue;
        var id = 'survey_' + q.id;
        var text = q.text || '';
        var shortLabel = text.length > 18 ? text.substring(0, 18) + '…' : text;
        metrics[id] = {
          id: id, label: shortLabel, color: this.getMetricColor(i + 3),
          key: 'survey_' + q.id, enabled: false, source: 'survey',
          questionId: q.id, questionType: q.type,
          min: q.min !== undefined ? q.min : 1,
          max: q.max !== undefined ? q.max : 10,
          unit: q.unit || '',
          emojiSet: q.emojiSet || null
        };
      }
    }

    this.allMetrics = metrics;
    if (Object.keys(this.activeMetrics).length === 0) {
      for (var key in metrics) this.activeMetrics[key] = metrics[key].enabled;
    }
    this._metricsBuilt = true;
  },

  getMetricColor: function(index) {
    var colors = ['#d4af37', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa', '#fb923c', '#2dd4bf', '#f87171', '#e879f9', '#38bdf8'];
    return colors[index % colors.length];
  },

  /* ---------- КЛЮЧ КЭША ---------- */
  buildChartDataCacheKey: function(history) {
    if (!history || history.length === 0) return 'empty';
    var first = history[0];
    var last = history[history.length - 1];
    var lastSurvey = '';
    try { lastSurvey = JSON.stringify(last.survey || {}); } catch (e) {}
    return [
      history.length,
      first.date || '',
      last.date || '',
      last.timestamp || 0,
      lastSurvey,
      last.weight || '',
      last.mood || ''
    ].join('|');
  },

  /* ---------- ДАННЫЕ ГРАФИКА (мемоизация) ---------- */
  buildChartData: function() {
    var history = this.getHistory();
    var key = this.buildChartDataCacheKey(history);
    if (this._chartDataCache && this._chartDataCacheKey === key) return this._chartDataCache;

    if (history.length === 0) {
      this._chartDataCache = { data: { exercises: [], weight: [], mood: [] }, labels: [], totalDays: 30 };
      this._chartDataCacheKey = key;
      this.totalDays = 30;
      return this._chartDataCache;
    }

    var dates = history.map(function(h) { return h.date; }).filter(Boolean).sort();
    if (dates.length === 0) {
      this._chartDataCache = { data: { exercises: [], weight: [], mood: [] }, labels: [], totalDays: 30 };
      this._chartDataCacheKey = key;
      this.totalDays = 30;
      return this._chartDataCache;
    }

    var firstDate = new Date(dates[0] + 'T00:00:00');
    if (isNaN(firstDate.getTime())) firstDate = new Date();
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var msPerDay = 1000 * 60 * 60 * 24;
    var totalDays = Math.floor((today - firstDate) / msPerDay) + 1;
    if (!isFinite(totalDays) || totalDays < 1) totalDays = 1;
    if (totalDays > 3650) totalDays = 3650; // защита от мусора в датах

    var data = { exercises: [], weight: [], mood: [] };
    var labels = [];
    var historyMap = (typeof Core !== 'undefined' && Core.getHistoryMap)
      ? Core.getHistoryMap(history)
      : this._buildHistoryMap(history);

    var config = this.getSurveyConfig();
    var surveyKeys = [];
    if (config && Array.isArray(config.questions)) {
      for (var i = 0; i < config.questions.length; i++) {
        var q = config.questions[i];
        if (q && ['rating', 'emoji', 'range', 'number'].indexOf(q.type) !== -1) {
          var sk = 'survey_' + q.id;
          data[sk] = [];
          surveyKeys.push(sk);
        }
      }
    }

    for (var d = 0; d < totalDays; d++) {
      var date = new Date(firstDate);
      date.setDate(date.getDate() + d);
      var dateStr = this._formatDate(date);
      var rec = historyMap[dateStr] || null;
      var exCount = 0;
      if (rec && !rec.skipped && Array.isArray(rec.exercises)) exCount = rec.exercises.length;
      data.exercises.push(exCount);
      data.weight.push(rec && rec.weight ? rec.weight : null);
      data.mood.push(rec && rec.mood ? rec.mood : null);
      for (var s = 0; s < surveyKeys.length; s++) {
        var qId = surveyKeys[s].replace('survey_', '');
        data[surveyKeys[s]].push(rec && rec.survey && rec.survey[qId] !== undefined ? rec.survey[qId] : null);
      }
      labels.push(date.getDate() + '.' + (date.getMonth() + 1));
    }

    this.totalDays = totalDays;

    if (!this._zoomInitialized) {
      this.zoom.xMin = 0;
      this.zoom.xMax = totalDays - 1;
      this.zoom.yMin = 0;
      this._zoomInitialized = true;
    }

    this._chartDataCache = { data: data, labels: labels, totalDays: totalDays };
    this._chartDataCacheKey = key;
    return this._chartDataCache;
  },

  _buildHistoryMap: function(history) {
    var map = {};
    if (!Array.isArray(history)) return map;
    for (var i = 0; i < history.length; i++) {
      if (history[i] && history[i].date) map[history[i].date] = history[i];
    }
    return map;
  },

  /* ---------- МАКСИМУМ Y (мемоизация) ---------- */
  findMaxY: function(data) {
    if (!data) return 10;

    // Ключ: cacheKey + активные метрики
    var activeKeys = [];
    for (var k in this.activeMetrics) if (this.activeMetrics[k]) activeKeys.push(k);
    activeKeys.sort();
    var cacheKey = (this._chartDataCacheKey || '') + '::' + activeKeys.join(',');

    if (this._maxYCache[cacheKey] !== undefined) return this._maxYCache[cacheKey];

    var maxVal = 0;
    for (var ak = 0; ak < activeKeys.length; ak++) {
      var series = data[activeKeys[ak]];
      if (!Array.isArray(series)) continue;
      for (var i = 0; i < series.length; i++) {
        var v = series[i];
        if (v !== null && v !== undefined && v > maxVal) maxVal = v;
      }
    }

    if (maxVal <= 0) maxVal = 10;
    else if (maxVal <= 10) maxVal = 10;
    else if (maxVal <= 20) maxVal = 20;
    else if (maxVal <= 50) maxVal = 50;
    else if (maxVal <= 100) maxVal = 100;
    else maxVal = Math.ceil(maxVal / 50) * 50;

    // Ограничим кэш
    if (Object.keys(this._maxYCache).length > 50) this._maxYCache = {};
    this._maxYCache[cacheKey] = maxVal;
    return maxVal;
  },

  /* ---------- ЭКРАН ---------- */
  createStatsScreen: function() {
    var screen = document.getElementById('screen-stats');
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'screen-stats';
      screen.className = 'screen';
      document.getElementById('userInterface').appendChild(screen);
    }
    this.buildMetrics();

    var stats = this.getStats();
    var history = this.getHistory();
    var sortedHistory = history.slice().sort(function(a, b) {
      return (a.date < b.date) ? -1 : (a.date > b.date) ? 1 : 0;
    });

    var bestStreak = 0, tempStreak = 0;
    for (var i = 0; i < sortedHistory.length; i++) {
      var rec = sortedHistory[i];
      if (!rec.skipped && Array.isArray(rec.exercises) && rec.exercises.length > 0) {
        tempStreak++;
        if (tempStreak > bestStreak) bestStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    }
    var currentStreak = 0;
    for (var j = sortedHistory.length - 1; j >= 0; j--) {
      var r2 = sortedHistory[j];
      if (!r2.skipped && Array.isArray(r2.exercises) && r2.exercises.length > 0) currentStreak++;
      else break;
    }

    var hintsEnabled = typeof shouldShowHints === 'function' ? shouldShowHints() : true;
    var hintHtml = hintsEnabled ? '<div class="hint" style="display:flex;align-items:center;gap:4px"><i class="ph ph-info"></i> Колёсико — зум, перетаскивание — панорама, скроллбары — навигация</div>' : '';

    var css = '<style>' +
      '.stat-card { background:var(--bg-card); border-radius:14px; padding:18px; margin-bottom:16px; border:1px solid var(--border-subtle); transition:all 0.2s; }' +
      '.stat-card:hover { border-color:var(--border-gold); transform:translateY(-2px); }' +
      '.stat-metric { text-align:center; }' +
      '.stat-metric-value { font-size:2.2em; font-weight:bold; color:var(--accent-gold); line-height:1; }' +
      '.stat-metric-label { font-size:0.8em; opacity:0.7; margin-top:6px; display:flex; align-items:center; justify-content:center; gap:4px; color:var(--text-secondary); }' +
      '.hint { font-size:0.75em; opacity:0.6; margin-top:3px; color:var(--text-secondary); }' +
      '.chart-container { position:relative; border-radius:12px; background:var(--bg-primary); border:1px solid var(--border-subtle); overflow:hidden; }' +
      '.chart-canvas-wrap { position:relative; width:100%; height:420px; cursor:crosshair; }' +
      '.chart-canvas-wrap canvas { display:block; width:100%; height:100%; }' +
      '.metrics-strip { display:flex; gap:6px; overflow-x:auto; padding:10px 4px; scrollbar-width:thin; scrollbar-color:var(--accent-gold) transparent; border-top:1px solid var(--border-subtle); }' +
      '.metrics-strip::-webkit-scrollbar { height: 6px; }' +
      '.metrics-strip::-webkit-scrollbar-thumb { background:var(--accent-gold); border-radius:3px; }' +
      '.metric-chip { display:flex; align-items:center; gap:6px; padding:6px 10px; background:var(--bg-secondary); border:1px solid var(--border-subtle); border-radius:16px; cursor:pointer; transition:all 0.2s; user-select:none; white-space:nowrap; flex-shrink:0; font-size:0.85em; }' +
      '.metric-chip:hover { border-color:var(--border-gold); }' +
      '.metric-chip.active { border-color:var(--accent-gold); background:var(--accent-gold-dim); }' +
      '.metric-chip input { display:none; }' +
      '.metric-chip .dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }' +
      '.metric-chip .check { font-size:0.9em; opacity:0; transition:opacity 0.2s; }' +
      '.metric-chip.active .check { opacity:1; }' +
      '.chart-zoom-info { position:absolute; top:10px; right:30px; background:var(--bg-glass); padding:6px 10px; border-radius:6px; font-size:0.75em; color:var(--text-primary); z-index:5; pointer-events:none; font-weight:600; border:1px solid var(--border-subtle); }' +
      '.chart-reset-btn { position:absolute; top:80px; right:30px; width:32px; height:32px; background:var(--bg-glass); border:1px solid var(--border-gold); border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s; z-index:4; flex-shrink:0; }' +
      '.chart-reset-btn:hover { background:var(--accent-gold-dim); border-color:var(--accent-gold); }' +
      '.chart-reset-btn i { color:var(--accent-gold); font-size:1.1em; }' +
      '.chart-legend { position:absolute; top:40px; right:30px; z-index:15; pointer-events:auto; display:flex; flex-direction:row-reverse; align-items:flex-start; gap:8px; }' +
      '.legend-toggle { width:32px; height:32px; background:var(--bg-glass); border:1px solid var(--border-gold); border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s; flex-shrink:0; }' +
      '.legend-toggle:hover { background:var(--accent-gold-dim); border-color:var(--accent-gold); }' +
      '.legend-toggle i { color:var(--accent-gold); font-size:1.1em; }' +
      '.legend-panel { background:var(--modal-bg, var(--bg-secondary)); border:1px solid var(--border-gold); border-radius:10px; padding:10px 14px; max-height:220px; overflow-y:auto; min-width:180px; box-shadow:0 4px 12px rgba(0,0,0,0.5); }' +
      '.legend-item { display:flex; align-items:center; gap:8px; margin-bottom:6px; font-size:0.8em; }' +
      '.legend-item:last-child { margin-bottom:0; }' +
      '.legend-color { width:12px; height:12px; border-radius:3px; flex-shrink:0; }' +
      '.legend-label { color:var(--text-secondary); flex:1; }' +
      '.tooltip { position:absolute; background:var(--modal-bg, var(--bg-secondary)); border:1px solid var(--border-gold); border-radius:8px; padding:10px 14px; font-size:0.8em; pointer-events:none; z-index:20; box-shadow:0 4px 12px rgba(0,0,0,0.5); max-width:250px; }' +
      '.tooltip-row { display:flex; align-items:center; gap:8px; margin-bottom:4px; }' +
      '.tooltip-row:last-child { margin-bottom:0; }' +
      '.tooltip-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }' +
      '.tooltip-label { opacity:0.7; flex:1; }' +
      '.tooltip-value { font-weight:600; color:var(--accent-gold); }' +
      '.tooltip-date { font-weight:600; color:var(--accent-gold); margin-bottom:6px; padding-bottom:6px; border-bottom:1px solid var(--border-subtle); }' +
      '.calendar-modal { position:fixed; top:0; left:0; width:100%; height:100%; background:var(--modal-overlay-bg, rgba(0,0,0,0.9)); backdrop-filter:blur(15px); z-index:2000; display:flex; justify-content:center; align-items:center; padding:20px; }' +
      '.calendar-content { background:var(--modal-bg, var(--bg-secondary)); padding:28px; border-radius:20px; width:100%; max-width:500px; max-height:90vh; overflow-y:auto; border:1px solid var(--border-gold); box-shadow:var(--shadow-modal, 0 10px 40px rgba(0,0,0,0.5)); }' +
      '.calendar-day { aspect-ratio:1; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:0.85em; cursor:pointer; transition:all 0.2s; border:1px solid var(--border-subtle); min-height:50px; position:relative; }' +
      '.calendar-day:hover { transform:scale(1.1); z-index:5; }' +
      '.calendar-day.full { background:rgba(74,222,128,0.2); border-color:var(--accent-success); }' +
      '.calendar-day.partial { background:rgba(251,191,36,0.2); border-color:var(--accent-warning); }' +
      '.calendar-day.skipped { background:rgba(248,113,113,0.2); border-color:var(--accent-error); }' +
      '.calendar-day.empty { background:var(--bg-primary); opacity:0.5; }' +
      '.calendar-day .day-num { font-weight:600; font-size:1.1em; }' +
      '.calendar-day .day-icon { font-size:1.2em; margin-top:2px; }' +
      '.calendar-tooltip { position:fixed; background:var(--modal-bg, var(--bg-secondary)); border:1px solid var(--border-gold); border-radius:8px; padding:10px 14px; font-size:0.8em; pointer-events:none; z-index:3000; box-shadow:0 4px 12px rgba(0,0,0,0.5); max-width:280px; display:none; }' +
      '.calendar-tooltip .ct-date { font-weight:600; color:var(--accent-gold); margin-bottom:6px; padding-bottom:6px; border-bottom:1px solid var(--border-subtle); }' +
      '.calendar-tooltip .ct-row { display:flex; align-items:center; gap:8px; margin-bottom:4px; }' +
      '.calendar-tooltip .ct-row:last-child { margin-bottom:0; }' +
      '.calendar-tooltip .ct-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }' +
      '.calendar-tooltip .ct-label { opacity:0.7; flex:1; }' +
      '.calendar-tooltip .ct-value { font-weight:600; color:var(--accent-gold); }' +
      '@media (max-width: 600px) { .stat-metric-value { font-size:1.6em; } .stat-card { padding:14px; } .chart-canvas-wrap { height:320px; } }' +
      '@media (prefers-reduced-motion: reduce) { .stat-card, .metric-chip, .calendar-day { transition: none !important; } }' +
    '</style>';

    var metricsHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(110px, 1fr));gap:10px;margin-bottom:20px">';
    metricsHtml += '<div class="stat-card stat-metric"><i class="ph ph-star" style="font-size:1.5em;color:var(--accent-gold)"></i><div class="stat-metric-value">' + (stats.level || 1) + '</div><div class="stat-metric-label">Уровень</div></div>';
    metricsHtml += '<div class="stat-card stat-metric"><i class="ph ph-flame" style="font-size:1.5em;color:var(--accent-gold)"></i><div class="stat-metric-value">' + currentStreak + '</div><div class="stat-metric-label">Текущий стрик</div></div>';
    metricsHtml += '<div class="stat-card stat-metric"><i class="ph ph-trophy" style="font-size:1.5em;color:var(--accent-gold)"></i><div class="stat-metric-value">' + bestStreak + '</div><div class="stat-metric-label">Лучший стрик</div></div>';
    metricsHtml += '<div class="stat-card stat-metric"><i class="ph ph-check-circle" style="font-size:1.5em;color:var(--accent-gold)"></i><div class="stat-metric-value">' + (stats.yes || 0) + '</div><div class="stat-metric-label">Тренировок</div></div>';
    metricsHtml += '<div class="stat-card stat-metric"><i class="ph ph-lightning" style="font-size:1.5em;color:var(--accent-gold)"></i><div class="stat-metric-value">' + (stats.xp || 0) + '</div><div class="stat-metric-label">XP</div></div>';
    metricsHtml += '</div>';

    var chartHtml = '<div class="stat-card" style="padding:0;overflow:hidden">';
    chartHtml += '<div style="padding:18px 18px 10px"><h3 style="font-family:var(--font-display);color:var(--accent-gold);margin:0 0 6px 0;display:flex;align-items:center;gap:10px"><i class="ph ph-chart-line-up"></i> Активность за весь период</h3>';
    chartHtml += hintHtml;
    chartHtml += '</div>';
    chartHtml += '<div class="chart-container" style="margin:0 18px 18px">';
    chartHtml += '<div class="chart-canvas-wrap" id="chartWrap">';
    chartHtml += '<canvas id="activityChart"></canvas>';
    chartHtml += '<button class="chart-reset-btn" onclick="StatsModule.resetZoom()" title="Сбросить зум"><i class="ph ph-arrows-counter-clockwise"></i></button>';
    chartHtml += '<div class="chart-zoom-info" id="zoomInfo">100%</div>';
    chartHtml += '<div class="tooltip" id="chartTooltip" style="display:none"></div>';
    chartHtml += '</div>';
    chartHtml += '<div class="metrics-strip" id="metricsStrip"></div>';
    chartHtml += '</div></div>';

    var streakHtml = '<div class="stat-card"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
    streakHtml += '<h3 style="font-family:var(--font-display);color:var(--accent-gold);margin:0;display:flex;align-items:center;gap:10px"><i class="ph ph-flame"></i> Последние 14 дней</h3>';
    streakHtml += '<button class="btn btn-secondary" style="padding:8px 12px;font-size:0.85em" onclick="StatsModule.openCalendar()"><i class="ph ph-calendar"></i> Календарь</button>';
    streakHtml += '</div>';
    if (hintsEnabled) streakHtml += '<div class="hint" style="display:flex;align-items:center;gap:4px;margin-bottom:12px"><i class="ph ph-info"></i> Зелёный = тренировка, красный = пропуск</div>';
    streakHtml += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">';

    var historyMap = (typeof Core !== 'undefined' && Core.getHistoryMap)
      ? Core.getHistoryMap(history)
      : this._buildHistoryMap(history);

    for (var d = 13; d >= 0; d--) {
      var date = new Date();
      date.setDate(date.getDate() - d);
      var dateStr = this._formatDate(date);
      var dayRecord = historyMap[dateStr] || null;
      var bgColor = 'var(--bg-primary)', iconClass = 'ph-circle', iconColor = 'var(--text-muted)';
      if (dayRecord) {
        if (dayRecord.skipped) { bgColor = 'rgba(248,113,113,0.15)'; iconClass = 'ph-x'; iconColor = 'var(--accent-error)'; }
        else if (Array.isArray(dayRecord.exercises) && dayRecord.exercises.length > 0) { bgColor = 'rgba(74,222,128,0.15)'; iconClass = 'ph-check'; iconColor = 'var(--accent-success)'; }
      }
      var dayName = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][date.getDay()];
      streakHtml += '<div style="background:' + bgColor + ';border-radius:8px;padding:10px 4px;text-align:center;cursor:pointer;border:1px solid ' + (bgColor === 'var(--bg-primary)' ? 'var(--border-subtle)' : 'transparent') + '" title="' + dateStr + '"><div style="font-size:0.7em;opacity:0.8;margin-bottom:2px;color:var(--text-secondary)">' + dayName + '</div><i class="ph ' + iconClass + '" style="font-size:1.2em;color:' + iconColor + '"></i></div>';
    }
    streakHtml += '</div></div>';

    var xpLogHtml = this._renderXpLog();

    screen.innerHTML = css + '<div style="padding:16px;max-width:900px;margin:0 auto"><h2 style="font-family:var(--font-display);font-size:2em;margin-bottom:20px;color:var(--accent-gold);display:flex;align-items:center;gap:12px"><i class="ph ph-chart-line-up"></i> Статистика</h2>' + metricsHtml + chartHtml + streakHtml + xpLogHtml + '</div>';

    this.renderMetricChips();

    var self = this;
    setTimeout(function() {
      self.setupChartInteractions();
      self.drawChart();
    }, 50);
  },

  _renderXpLog: function() {
    if (typeof CoreData === 'undefined' || !CoreData.getXpLog) return '';
    var log = CoreData.getXpLog();
    if (!Array.isArray(log) || log.length === 0) {
      return '<div class="stat-card"><h3 style="font-family:var(--font-display);color:var(--accent-gold);margin:0 0 10px 0;display:flex;align-items:center;gap:10px"><i class="ph ph-lightning"></i> История XP</h3><div style="text-align:center;padding:20px;opacity:0.6;font-size:0.9em"><i class="ph ph-clock" style="font-size:2em;color:var(--accent-gold);display:block;margin-bottom:8px"></i>Пока нет записей. Пройди тренировку или опрос.</div></div>';
    }

    var sorted = log.slice().sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
    if (sorted.length > 50) sorted = sorted.slice(0, 50);

    var esc = (typeof Core !== 'undefined' && Core.utils && Core.utils.escapeHtml)
      ? Core.utils.escapeHtml : function(t) { return t == null ? '' : String(t); };

    var total = 0;
    for (var i = 0; i < log.length; i++) total += (log[i].amount || 0);

    var html = '<div class="stat-card">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">';
    html += '<h3 style="font-family:var(--font-display);color:var(--accent-gold);margin:0;display:flex;align-items:center;gap:10px"><i class="ph ph-lightning"></i> История XP</h3>';
    html += '<div style="font-size:0.85em;opacity:0.7">Всего записей: ' + log.length + ' · Сумма: <strong style="color:var(--accent-gold)">' + total + ' XP</strong></div>';
    html += '</div>';

    html += '<div style="display:flex;flex-direction:column;gap:6px">';
    for (var k = 0; k < sorted.length; k++) {
      var e = sorted[k];
      var date = new Date(e.timestamp || Date.now());
      var dateStr = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      var timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

      var icon = 'ph-star';
      var color = 'var(--accent-gold)';
      var reason = e.reason || '';
      if (reason === 'Подход') { icon = 'ph-check-circle'; color = 'var(--accent-success)'; }
      else if (reason === 'Упражнение завершено') { icon = 'ph-barbell'; color = 'var(--accent-info)'; }
      else if (reason === 'День завершён') { icon = 'ph-trophy'; color = 'var(--accent-gold)'; }
      else if (reason === 'Опрос') { icon = 'ph-clipboard-text'; color = 'var(--accent-warning)'; }

      html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg-primary);border-radius:8px;border-left:3px solid ' + color + '">';
      html += '<i class="ph ' + icon + '" style="color:' + color + ';font-size:1.1em;flex-shrink:0"></i>';
      html += '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:0.9em">' + esc(reason) + '</div>';
      html += '<div style="font-size:0.75em;opacity:0.6">' + dateStr + ' · ' + timeStr + '</div></div>';
      html += '<div style="font-weight:700;color:var(--accent-gold);font-size:1em;flex-shrink:0">+' + (e.amount || 0) + ' XP</div>';
      html += '</div>';
    }
    html += '</div></div>';
    return html;
  },

  renderMetricChips: function() {
    var esc = (typeof Core !== 'undefined' && Core.utils && Core.utils.escapeHtml)
      ? Core.utils.escapeHtml : function(t){return t == null ? '' : String(t);};
    var strip = document.getElementById('metricsStrip');
    if (!strip) return;
    var html = '';
    for (var key in this.allMetrics) {
      var m = this.allMetrics[key];
      var active = this.activeMetrics[key] ? 'active' : '';
      html += '<div class="metric-chip ' + active + '" onclick="StatsModule.toggleMetricChip(\'' + esc(key) + '\')">';
      html += '<input type="checkbox" ' + (this.activeMetrics[key] ? 'checked' : '') + '>';
      html += '<span class="check">✓</span>';
      html += '<div class="dot" style="background:' + m.color + '"></div>';
      html += '<span>' + esc(m.label) + '</span>';
      html += '</div>';
    }
    strip.innerHTML = html;
  },

  toggleMetricChip: function(key) {
    this.activeMetrics[key] = !this.activeMetrics[key];
    this._maxYCache = {}; // NEW: сбросить кэш максимума
    this.renderMetricChips();
    this.drawChart();
  },

  /* ---------- ИНТЕРАКЦИИ ГРАФИКА ---------- */
  setupChartInteractions: function() {
    var wrap = document.getElementById('chartWrap');
    if (!wrap) return;
    if (wrap.dataset.inited === '1') return;
    wrap.dataset.inited = '1';
    var canvas = document.getElementById('activityChart');
    var self = this;
    var drawRaf = (typeof Core !== 'undefined' && Core.utils && Core.utils.throttleRaf)
      ? Core.utils.throttleRaf(function() { self.drawChart(); })
      : function() { self.drawChart(); };

    wrap.addEventListener('wheel', function(e) {
      e.preventDefault();
      var rect = canvas.getBoundingClientRect();
      var mouseX = e.clientX - rect.left;
      var mouseY = e.clientY - rect.top;
      var zoomFactor = e.deltaY > 0 ? 1.15 : 0.87;
      self.zoomAtPoint(mouseX, mouseY, rect.width, rect.height, zoomFactor);
    }, { passive: false });

    wrap.addEventListener('pointerdown', function(e) {
      if (e.target.closest('.chart-legend')) return;
      if (e.target.closest('.chart-reset-btn')) return;
      if (e.target.closest('.chart-zoom-info')) return;
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      self.isPanning = true;
      self.panStart = { x: e.clientX, y: e.clientY };
      self.panStartZoom = { xMin: self.zoom.xMin, xMax: self.zoom.xMax, yMin: self.zoom.yMin, yMax: self.zoom.yMax };
      wrap.style.cursor = 'grabbing';
      wrap.setPointerCapture && wrap.setPointerCapture(e.pointerId);
    });

    wrap.addEventListener('pointermove', function(e) {
      if (!self.isPanning) { self.handleTooltip(e); return; }
      var rect = canvas.getBoundingClientRect();
      var dx = e.clientX - self.panStart.x;
      var dy = e.clientY - self.panStart.y;
      var xRange = self.panStartZoom.xMax - self.panStartZoom.xMin;
      var yRange = self.panStartZoom.yMax - self.panStartZoom.yMin;
      self.zoom.xMin = self.panStartZoom.xMin - (dx / rect.width) * xRange;
      self.zoom.xMax = self.panStartZoom.xMax - (dx / rect.width) * xRange;
      self.zoom.yMin = self.panStartZoom.yMin + (dy / rect.height) * yRange;
      self.zoom.yMax = self.panStartZoom.yMax + (dy / rect.height) * yRange;
      self.clampZoom();
      drawRaf();
    });

    wrap.addEventListener('pointerup', function(e) {
      if (self.isPanning) {
        self.isPanning = false;
        wrap.style.cursor = 'crosshair';
        wrap.releasePointerCapture && e.pointerId && wrap.releasePointerCapture(e.pointerId);
      }
    });

    wrap.addEventListener('pointercancel', function() {
      if (self.isPanning) {
        self.isPanning = false;
        wrap.style.cursor = 'crosshair';
      }
    });

    canvas.addEventListener('pointerleave', function() {
      self.lastMouseX = -1;
      self.lastMouseY = -1;
      var tooltip = document.getElementById('chartTooltip');
      if (tooltip) tooltip.style.display = 'none';
    });

    canvas.addEventListener('click', function(e) {
      if (e.target.closest('.chart-legend')) return;
      self.handlePointClick(e);
    });

    var touchStartDist = 0;
    var touchStartZoom = null;
    wrap.addEventListener('touchstart', function(e) {
      if (e.touches.length === 2) {
        touchStartDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        touchStartZoom = { xMin: self.zoom.xMin, xMax: self.zoom.xMax, yMin: self.zoom.yMin, yMax: self.zoom.yMax };
      }
    }, { passive: true });

    wrap.addEventListener('touchmove', function(e) {
      if (e.touches.length === 2 && touchStartZoom) {
        var dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        var scale = touchStartDist / dist;
        var cx = (touchStartZoom.xMin + touchStartZoom.xMax) / 2;
        var cy = (touchStartZoom.yMin + touchStartZoom.yMax) / 2;
        var xRange = (touchStartZoom.xMax - touchStartZoom.xMin) * scale;
        var yRange = (touchStartZoom.yMax - touchStartZoom.yMin) * scale;
        self.zoom.xMin = cx - xRange / 2;
        self.zoom.xMax = cx + xRange / 2;
        self.zoom.yMin = cy - yRange / 2;
        self.zoom.yMax = cy + yRange / 2;
        self.clampZoom();
        drawRaf();
      }
    }, { passive: true });

    wrap.addEventListener('touchend', function() { touchStartZoom = null; });
  },

  handleTooltip: function(e) {
    var canvas = document.getElementById('activityChart');
    var tooltip = document.getElementById('chartTooltip');
    if (!canvas || !tooltip) return;
    if (e.target.closest('.chart-legend')) { tooltip.style.display = 'none'; return; }
    var rect = canvas.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      tooltip.style.display = 'none';
      this.lastMouseX = -1;
      this.lastMouseY = -1;
      return;
    }
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    var width = canvas.width, height = canvas.height;
    var padding = this.getPadding(width, height);
    var chartWidth = width - padding.left - padding.right;
    var xRange = this.zoom.xMax - this.zoom.xMin;
    var dayIdx = Math.round(this.zoom.xMin + (x - padding.left) / chartWidth * xRange);
    if (dayIdx < 0 || dayIdx >= this.totalDays) { tooltip.style.display = 'none'; return; }

    var history = this.getHistory();
    if (history.length === 0) { tooltip.style.display = 'none'; return; }
    var dates = history.map(function(h) { return h.date; }).filter(Boolean).sort();
    if (dates.length === 0) { tooltip.style.display = 'none'; return; }
    var firstDate = new Date(dates[0] + 'T00:00:00');
    var date = new Date(firstDate);
    date.setDate(date.getDate() + dayIdx);
    var dateStr = this._formatDate(date);
    var historyMap = (typeof Core !== 'undefined' && Core.getHistoryMap)
      ? Core.getHistoryMap(history) : this._buildHistoryMap(history);
    var dayRecord = historyMap[dateStr] || null;
    if (!dayRecord) { tooltip.style.display = 'none'; return; }

    var esc = (typeof Core !== 'undefined' && Core.utils && Core.utils.escapeHtml)
      ? Core.utils.escapeHtml : function(t){ return t == null ? '' : String(t); };

    var html = '<div class="tooltip-date">📅 ' + esc(dateStr) + '</div>';
    for (var key in this.allMetrics) {
      var m = this.allMetrics[key];
      if (!this.activeMetrics[key]) continue;
      var val = this.getMetricValue(dayRecord, key, m);
      if (val === null || val === undefined) continue;
      html += '<div class="tooltip-row">';
      html += '<div class="tooltip-dot" style="background:' + m.color + '"></div>';
      html += '<div class="tooltip-label">' + esc(m.label) + '</div>';
      html += '<div class="tooltip-value">' + this.formatMetricValue(val, m) + '</div>';
      html += '</div>';
    }
    if (html === tooltip.innerHTML && this.lastMouseX === x && this.lastMouseY === y) return;
    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    var tooltipX = x + 15;
    var tooltipY = y - 10;
    if (tooltipX + 250 > rect.width) tooltipX = x - 260;
    if (tooltipY < 0) tooltipY = 10;
    tooltip.style.left = tooltipX + 'px';
    tooltip.style.top = tooltipY + 'px';
    this.lastMouseX = x;
    this.lastMouseY = y;
  },

  getMetricValue: function(dayRecord, key, metric) {
    if (key === 'exercises') return Array.isArray(dayRecord.exercises) ? dayRecord.exercises.length : 0;
    if (key === 'weight') return dayRecord.weight || null;
    if (key === 'mood') return dayRecord.mood || null;
    if (key.indexOf('survey_') === 0) {
      var qId = key.replace('survey_', '');
      if (dayRecord.survey && dayRecord.survey[qId] !== undefined) return dayRecord.survey[qId];
    }
    return null;
  },

  formatMetricValue: function(val, metric) {
    if (val === null || val === undefined) return '—';
    if (metric.questionType === 'emoji' && metric.emojiSet && metric.emojiSet[val]) return metric.emojiSet[val];
    return val + (metric.unit ? ' ' + metric.unit : '');
  },

  handlePointClick: function(e) {
    var canvas = document.getElementById('activityChart');
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var width = canvas.width;
    var padding = this.getPadding(width, canvas.height);
    var chartWidth = width - padding.left - padding.right;
    var xRange = this.zoom.xMax - this.zoom.xMin;
    var dayIdx = Math.round(this.zoom.xMin + (x - padding.left) / chartWidth * xRange);
    if (dayIdx < 0 || dayIdx >= this.totalDays) return;
    var history = this.getHistory();
    if (history.length === 0) return;
    var dates = history.map(function(h) { return h.date; }).filter(Boolean).sort();
    if (dates.length === 0) return;
    var firstDate = new Date(dates[0] + 'T00:00:00');
    var date = new Date(firstDate);
    date.setDate(date.getDate() + dayIdx);
    var dateStr = this._formatDate(date);
    var historyMap = (typeof Core !== 'undefined' && Core.getHistoryMap)
      ? Core.getHistoryMap(history) : this._buildHistoryMap(history);
    var dayRecord = historyMap[dateStr] || null;
    if (dayRecord) {
      var info = '📅 ' + dateStr + '\n';
      if (Array.isArray(dayRecord.exercises)) info += 'Упражнений: ' + dayRecord.exercises.length + '\n';
      if (dayRecord.weight) info += 'Вес: ' + dayRecord.weight + ' кг\n';
      if (dayRecord.mood) info += 'Самочувствие: ' + dayRecord.mood + '/10\n';
      if (typeof Notify !== 'undefined') Notify.info(info); else alert(info);
    }
  },

  getPadding: function(width, height) {
    return { left: width < 400 ? 36 : 44, right: width < 400 ? 20 : 28, top: 20, bottom: 30 };
  },

  zoomAtPoint: function(mouseX, mouseY, canvasWidth, canvasHeight, zoomFactor) {
    var padding = this.getPadding(canvasWidth, canvasHeight);
    var chartWidth = canvasWidth - padding.left - padding.right;
    var chartHeight = canvasHeight - padding.top - padding.bottom;
    var xRatio = Math.max(0, Math.min(1, (mouseX - padding.left) / chartWidth));
    var yRatio = Math.max(0, Math.min(1, (mouseY - padding.top) / chartHeight));
    var xRange = this.zoom.xMax - this.zoom.xMin;
    var yRange = this.zoom.yMax - this.zoom.yMin;
    var newXRange = xRange * zoomFactor;
    var newYRange = yRange * zoomFactor;
    var xCenter = this.zoom.xMin + xRatio * xRange;
    var yCenter = this.zoom.yMin + (1 - yRatio) * yRange;
    this.zoom.xMin = xCenter - xRatio * newXRange;
    this.zoom.xMax = xCenter + (1 - xRatio) * newXRange;
    this.zoom.yMin = yCenter - (1 - yRatio) * newYRange;
    this.zoom.yMax = yCenter + yRatio * newYRange;
    this.clampZoom();
    this.drawChart();
  },

  clampZoom: function() {
    var xRange = this.zoom.xMax - this.zoom.xMin;
    var yRange = this.zoom.yMax - this.zoom.yMin;
    var maxY = this._currentMaxY || 10;

    var minXRange = (this.totalDays - 1) / 5;
    var minYRange = maxY / 5;
    if (minXRange < 3) minXRange = 3;
    if (minYRange < 2) minYRange = 2;

    if (xRange < minXRange) {
      var cx = (this.zoom.xMin + this.zoom.xMax) / 2;
      this.zoom.xMin = cx - minXRange / 2;
      this.zoom.xMax = cx + minXRange / 2;
      xRange = minXRange;
    }
    if (yRange < minYRange) {
      var cy = (this.zoom.yMin + this.zoom.yMax) / 2;
      this.zoom.yMin = cy - minYRange / 2;
      this.zoom.yMax = cy + minYRange / 2;
      yRange = minYRange;
    }

    if (xRange > this.totalDays - 1) { this.zoom.xMin = 0; this.zoom.xMax = this.totalDays - 1; xRange = this.totalDays - 1; }
    if (yRange > maxY) { this.zoom.yMin = 0; this.zoom.yMax = maxY; yRange = maxY; }

    if (this.zoom.xMin < 0) { this.zoom.xMax -= this.zoom.xMin; this.zoom.xMin = 0; }
    if (this.zoom.xMax > this.totalDays - 1) { this.zoom.xMin -= (this.zoom.xMax - this.totalDays + 1); this.zoom.xMax = this.totalDays - 1; }
    if (this.zoom.yMin < 0) { this.zoom.yMax -= this.zoom.yMin; this.zoom.yMin = 0; }
    if (this.zoom.yMax > maxY) { this.zoom.yMin -= (this.zoom.yMax - maxY); this.zoom.yMax = maxY; }

    var info = document.getElementById('zoomInfo');
    if (info) {
      var xZoom = Math.round((this.totalDays - 1) / (this.zoom.xMax - this.zoom.xMin) * 100);
      if (xZoom > 500) xZoom = 500;
      if (xZoom < 100) xZoom = 100;
      info.textContent = xZoom + '%';
    }
  },

  resetZoom: function() {
    this.invalidateChartCache();
    this._zoomInitialized = false;
    var chartData = this.buildChartData();
    this.zoom.xMin = 0;
    this.zoom.xMax = this.totalDays - 1;
    this.zoom.yMin = 0;
    this.zoom.yMax = this.findMaxY(chartData.data);
    this._currentMaxY = this.zoom.yMax;
    this.clampZoom();
    this.drawChart();
  },

  drawChart: function() {
    var canvas = document.getElementById('activityChart');
    if (!canvas) return;
    var wrap = document.getElementById('chartWrap');
    if (wrap) {
      canvas.width = wrap.clientWidth;
      canvas.height = wrap.clientHeight;
    }
    var ctx = canvas.getContext('2d');
    var width = canvas.width, height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    var chartData = this.buildChartData();
    var data = chartData.data;
    var labels = chartData.labels;
    this.totalDays = chartData.totalDays;

    // Один раз считаем maxY через кэш
    var computedMaxY = this.findMaxY(data);
    this._currentMaxY = computedMaxY;
    if (this.zoom.yMax === 0 || this.zoom.yMax < computedMaxY) {
      this.zoom.yMin = 0;
      this.zoom.yMax = computedMaxY;
    }
    if (this.zoom.yMax <= 0) this.zoom.yMax = 10;

    var padding = this.getPadding(width, height);
    var chartWidth = width - padding.left - padding.right;
    var chartHeight = height - padding.top - padding.bottom;
    var xRange = this.zoom.xMax - this.zoom.xMin;
    var yRange = this.zoom.yMax - this.zoom.yMin;
    if (yRange <= 0) yRange = 10;

    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (var i = 0; i <= 4; i++) {
      var y = padding.top + (i / 4) * chartHeight;
      ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(212,175,55,0.3)';
    ctx.beginPath(); ctx.moveTo(padding.left, padding.top); ctx.lineTo(padding.left, height - padding.bottom); ctx.lineTo(width - padding.right, height - padding.bottom); ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.rect(padding.left, padding.top, chartWidth, chartHeight);
    ctx.clip();

    for (var key in this.allMetrics) {
      var m = this.allMetrics[key];
      if (!this.activeMetrics[key]) continue;
      var series = data[key];
      if (!series) continue;

      ctx.strokeStyle = m.color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();

      for (var s = 0; s < series.length; s++) {
        var val = (series[s] === null || series[s] === undefined) ? 0 : series[s];
        var px = padding.left + ((s - this.zoom.xMin) / xRange) * chartWidth;
        var py = height - padding.bottom - ((val - this.zoom.yMin) / yRange) * chartHeight;
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();

      for (var s2 = 0; s2 < series.length; s2++) {
        var val2 = (series[s2] === null || series[s2] === undefined) ? 0 : series[s2];
        var px2 = padding.left + ((s2 - this.zoom.xMin) / xRange) * chartWidth;
        var py2 = height - padding.bottom - ((val2 - this.zoom.yMin) / yRange) * chartHeight;
        if (px2 >= padding.left && px2 <= width - padding.right && py2 >= padding.top && py2 <= height - padding.bottom) {
          ctx.beginPath();
          ctx.arc(px2, py2, 4, 0, Math.PI * 2);
          ctx.fillStyle = m.color;
          ctx.fill();
          ctx.strokeStyle = 'var(--bg-primary)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    ctx.fillStyle = 'var(--text-secondary)';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    var step = Math.max(1, Math.ceil(xRange / 8));
    for (var t = Math.ceil(this.zoom.xMin); t <= Math.floor(this.zoom.xMax); t += step) {
      if (t >= 0 && t < labels.length) {
        var tx = padding.left + ((t - this.zoom.xMin) / xRange) * chartWidth;
        ctx.fillText(labels[t], tx, height - padding.bottom + 18);
      }
    }

    ctx.textAlign = 'right';
    var yStep = Math.max(1, Math.ceil(yRange / 5));
    for (var v = Math.ceil(this.zoom.yMin); v <= Math.floor(this.zoom.yMax); v += yStep) {
      var vy = height - padding.bottom - ((v - this.zoom.yMin) / yRange) * chartHeight;
      ctx.fillText(v, padding.left - 4, vy + 4);
    }

    var oldLegend = document.getElementById('chartLegend');
    if (oldLegend) oldLegend.remove();

    var legendDiv = document.createElement('div');
    legendDiv.id = 'chartLegend';
    legendDiv.className = 'chart-legend';

    var hasAny = false;
    var itemsHtml = '';
    var esc = (typeof Core !== 'undefined' && Core.utils && Core.utils.escapeHtml)
      ? Core.utils.escapeHtml : function(t){ return t == null ? '' : String(t); };

    for (var lk in this.allMetrics) {
      var lm = this.allMetrics[lk];
      if (!this.activeMetrics[lk]) continue;
      hasAny = true;
      itemsHtml += '<div class="legend-item" style="cursor:pointer;padding:4px 8px;border-radius:4px;transition:background 0.15s" onmouseover="this.style.background=\'var(--accent-gold-dim)\'" onmouseout="this.style.background=\'transparent\'" onclick="event.stopPropagation();StatsModule.toggleMetricChip(\'' + esc(lk) + '\')">';
      itemsHtml += '<div class="legend-color" style="background:' + lm.color + '"></div>';
      itemsHtml += '<div class="legend-label">' + esc(lm.label) + '</div>';
      itemsHtml += '<i class="ph ' + (this.activeMetrics[lk] ? 'ph-check-square' : 'ph-square') + '" style="color:var(--accent-gold);font-size:1em"></i>';
      itemsHtml += '</div>';
    }

    var toggleBtn = document.createElement('div');
    toggleBtn.className = 'legend-toggle';
    toggleBtn.innerHTML = '<i class="ph ph-list"></i>';
    toggleBtn.title = 'Метрики';
    var self = this;
    toggleBtn.onclick = function(e) {
      e.stopPropagation();
      self._legendExpanded = !self._legendExpanded;
      self.drawChart();
    };
    legendDiv.appendChild(toggleBtn);

    if (this._legendExpanded && hasAny) {
      var panel = document.createElement('div');
      panel.className = 'legend-panel';
      panel.innerHTML = '<div style="font-size:0.75em;color:var(--text-secondary);margin-bottom:6px;font-weight:600;display:flex;align-items:center;gap:6px"><i class="ph ph-list"></i> Метрики</div>' + itemsHtml;
      legendDiv.appendChild(panel);
    }

    if (hasAny) wrap.appendChild(legendDiv);
  },

  /* ---------- КАЛЕНДАРЬ ---------- */
  openCalendar: function() {
    var oldTooltip = document.getElementById('calendarTooltip');
    if (oldTooltip) oldTooltip.remove();
    var oldModal = document.getElementById('calendarModal');
    if (oldModal) oldModal.remove();
    var modal = document.createElement('div');
    modal.className = 'calendar-modal';
    modal.id = 'calendarModal';
    var content = document.createElement('div');
    content.className = 'calendar-content';
    content.innerHTML =
      '<button style="float:right;background:transparent;border:none;color:var(--text-secondary);font-size:1.5em;cursor:pointer" onclick="document.getElementById(\'calendarModal\').remove()" aria-label="Закрыть"><i class="ph ph-x"></i></button>' +
      '<h2 style="font-family:var(--font-display);color:var(--accent-gold);margin-top:0;display:flex;align-items:center;gap:10px"><i class="ph ph-calendar"></i> Календарь тренировок</h2>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin:16px 0">' +
        '<button class="btn btn-secondary" style="padding:8px 12px" onclick="StatsModule.changeMonth(-1)" aria-label="Предыдущий месяц"><i class="ph ph-caret-left"></i></button>' +
        '<div id="calendarTitle" style="font-weight:600;font-size:1.1em;color:var(--accent-gold)"></div>' +
        '<button class="btn btn-secondary" style="padding:8px 12px" onclick="StatsModule.changeMonth(1)" aria-label="Следующий месяц"><i class="ph ph-caret-right"></i></button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:8px">' +
        '<div style="text-align:center;font-size:0.75em;opacity:0.6;padding:4px">Пн</div>' +
        '<div style="text-align:center;font-size:0.75em;opacity:0.6;padding:4px">Вт</div>' +
        '<div style="text-align:center;font-size:0.75em;opacity:0.6;padding:4px">Ср</div>' +
        '<div style="text-align:center;font-size:0.75em;opacity:0.6;padding:4px">Чт</div>' +
        '<div style="text-align:center;font-size:0.75em;opacity:0.6;padding:4px">Пт</div>' +
        '<div style="text-align:center;font-size:0.75em;opacity:0.6;padding:4px">Сб</div>' +
        '<div style="text-align:center;font-size:0.75em;opacity:0.6;padding:4px">Вс</div>' +
      '</div>' +
      '<div id="calendarGrid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px"></div>' +
      '<div style="margin-top:16px;display:flex;gap:12px;font-size:0.8em;flex-wrap:wrap;justify-content:center">' +
        '<div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;background:rgba(74,222,128,0.3);border-radius:3px"></div> Полная</div>' +
        '<div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;background:rgba(251,191,36,0.3);border-radius:3px"></div> Частичная</div>' +
        '<div style="display:flex;align-items:center;gap:6px"><div style="width:12px;height:12px;background:rgba(248,113,113,0.3);border-radius:3px"></div> Пропуск</div>' +
      '</div>';
    modal.appendChild(content);
    document.body.appendChild(modal);
    this.renderCalendar();
  },

  changeMonth: function(delta) {
    this.calendarMonth += delta;
    if (this.calendarMonth > 11) { this.calendarMonth = 0; this.calendarYear++; }
    if (this.calendarMonth < 0) { this.calendarMonth = 11; this.calendarYear--; }
    var now = new Date();
    if (this.calendarYear > now.getFullYear() || (this.calendarYear === now.getFullYear() && this.calendarMonth > now.getMonth())) {
      this.calendarMonth = now.getMonth();
      this.calendarYear = now.getFullYear();
    }
    this.renderCalendar();
  },

  renderCalendar: function() {
    var title = document.getElementById('calendarTitle');
    var grid = document.getElementById('calendarGrid');
    if (!title || !grid) return;
    var monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
    title.textContent = monthNames[this.calendarMonth] + ' ' + this.calendarYear;
    var history = this.getHistory();
    var historyMap = (typeof Core !== 'undefined' && Core.getHistoryMap)
      ? Core.getHistoryMap(history) : this._buildHistoryMap(history);
    var firstDay = new Date(this.calendarYear, this.calendarMonth, 1);
    var lastDay = new Date(this.calendarYear, this.calendarMonth + 1, 0);
    var daysInMonth = lastDay.getDate();
    var startDay = (firstDay.getDay() + 6) % 7;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var html = '';
    for (var i = 0; i < startDay; i++) html += '<div></div>';
    var esc = (typeof Core !== 'undefined' && Core.utils && Core.utils.escapeHtml)
      ? Core.utils.escapeHtml : function(t){ return t == null ? '' : String(t); };

    for (var d = 1; d <= daysInMonth; d++) {
      var date = new Date(this.calendarYear, this.calendarMonth, d);
      var dateStr = this._formatDate(date);
      var dayRecord = historyMap[dateStr] || null;
      var cls = 'empty';
      var icon = '';
      if (date > today) {
        cls = 'empty';
      } else if (dayRecord) {
        if (dayRecord.skipped) {
          cls = 'skipped';
          icon = '<i class="ph ph-x" style="color:var(--accent-error)"></i>';
        } else if (Array.isArray(dayRecord.exercises) && dayRecord.exercises.length > 0) {
          var allDone = true, anyDone = false;
          if (Array.isArray(dayRecord.details)) {
            for (var k = 0; k < dayRecord.details.length; k++) {
              var det = dayRecord.details[k];
              if (det && Array.isArray(det.sets)) {
                for (var s = 0; s < det.sets.length; s++) {
                  if (det.sets[s] === 'done') anyDone = true;
                  else if (det.sets[s] === 'partial') { allDone = false; anyDone = true; }
                  else if (det.sets[s] === 'missed') { allDone = false; }
                }
              }
            }
          }
          if (allDone && anyDone) { cls = 'full'; icon = '<i class="ph ph-check" style="color:var(--accent-success)"></i>'; }
          else if (anyDone) { cls = 'partial'; icon = '<i class="ph ph-warning" style="color:var(--accent-warning)"></i>'; }
          else { cls = 'full'; icon = '<i class="ph ph-check" style="color:var(--accent-success)"></i>'; }
        }
      }
      var isToday = date.getTime() === today.getTime();
      var dataAttrs = 'data-date="' + dateStr + '"';
      if (dayRecord) {
        if (Array.isArray(dayRecord.exercises)) dataAttrs += ' data-exercises="' + dayRecord.exercises.length + '"';
        if (dayRecord.weight) dataAttrs += ' data-weight="' + dayRecord.weight + '"';
        if (dayRecord.mood) dataAttrs += ' data-mood="' + dayRecord.mood + '"';
      }
      html += '<div class="calendar-day ' + cls + '" style="' + (isToday ? 'border:2px solid var(--accent-gold);' : '') + '" ' + dataAttrs + '>';
      html += '<div class="day-num">' + d + '</div>';
      html += '<div class="day-icon">' + icon + '</div>';
      html += '</div>';
    }
    grid.innerHTML = html;
    this.setupCalendarTooltips(historyMap);
  },

  setupCalendarTooltips: function(historyMap) {
    var tooltip = document.getElementById('calendarTooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'calendar-tooltip';
      tooltip.id = 'calendarTooltip';
      document.body.appendChild(tooltip);
    }
    if (!historyMap) {
      var history = this.getHistory();
      historyMap = (typeof Core !== 'undefined' && Core.getHistoryMap)
        ? Core.getHistoryMap(history) : this._buildHistoryMap(history);
    }
    var config = this.getSurveyConfig();
    var esc = (typeof Core !== 'undefined' && Core.utils && Core.utils.escapeHtml)
      ? Core.utils.escapeHtml : function(t){ return t == null ? '' : String(t); };

    var days = document.querySelectorAll('.calendar-day');
    days.forEach(function(dayEl) {
      dayEl.addEventListener('mouseenter', function() {
        var dateStr = dayEl.getAttribute('data-date');
        if (!dateStr) return;
        var html = '<div class="ct-date">📅 ' + esc(dateStr) + '</div>';
        var dayRecord = historyMap[dateStr] || null;
        if (dayRecord) {
          if (dayRecord.skipped) html += '<div class="ct-row"><div class="ct-dot" style="background:var(--accent-error)"></div><div class="ct-label">Статус:</div><div class="ct-value">Пропуск</div></div>';
          else if (Array.isArray(dayRecord.exercises) && dayRecord.exercises.length > 0) html += '<div class="ct-row"><div class="ct-dot" style="background:var(--accent-success)"></div><div class="ct-label">Упражнений:</div><div class="ct-value">' + dayRecord.exercises.length + '</div></div>';
          if (dayRecord.weight) html += '<div class="ct-row"><div class="ct-dot" style="background:#4ade80"></div><div class="ct-label">Вес:</div><div class="ct-value">' + dayRecord.weight + ' кг</div></div>';
          if (dayRecord.mood) html += '<div class="ct-row"><div class="ct-dot" style="background:#60a5fa"></div><div class="ct-label">Самочувствие:</div><div class="ct-value">' + dayRecord.mood + '/10</div></div>';
          if (dayRecord.survey && config && Array.isArray(config.questions)) {
            for (var i = 0; i < config.questions.length; i++) {
              var q = config.questions[i];
              if (!q) continue;
              var val = dayRecord.survey[q.id];
              if (val !== undefined && val !== null) {
                var displayVal = val;
                if (q.type === 'emoji' && q.emojiSet && q.emojiSet[val]) displayVal = q.emojiSet[val];
                var text = q.text || '';
                var shortQ = text.length > 25 ? text.substring(0, 25) + '…' : text;
                html += '<div class="ct-row"><div class="ct-dot" style="background:#f472b6"></div><div class="ct-label">' + esc(shortQ) + ':</div><div class="ct-value">' + esc(String(displayVal)) + '</div></div>';
              }
            }
          }
        } else {
          html += '<div class="ct-row"><div class="ct-dot" style="background:var(--text-muted)"></div><div class="ct-label">Статус:</div><div class="ct-value">Нет данных</div></div>';
        }
        tooltip.innerHTML = html;
        tooltip.style.display = 'block';
      });
      dayEl.addEventListener('mousemove', function(e) {
        var x = e.clientX + 15;
        var y = e.clientY + 15;
        if (x + 280 > window.innerWidth) x = e.clientX - 290;
        if (y + 200 > window.innerHeight) y = e.clientY - 210;
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
      });
      dayEl.addEventListener('mouseleave', function() {
        tooltip.style.display = 'none';
      });
    });
  }
};

window.StatsModule = StatsModule;
module.exports = StatsModule;