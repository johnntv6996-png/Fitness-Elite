// modules/measurements.js

const MeasurementsModule = {
  _state: {
    editingId: null,
    expandedId: null
  },

  // Поля замера: id -> { label, unit, icon, min, max, step, group }
  FIELDS: [
    { id: 'weight',     label: 'Вес',       unit: 'кг', icon: 'ph-scales',         min: 20,  max: 300, step: 0.1, group: 'main' },
    { id: 'bodyFat',    label: '% жира',    unit: '%',  icon: 'ph-percent',        min: 1,   max: 70,  step: 0.1, group: 'main' },
    { id: 'neck',       label: 'Шея',       unit: 'см', icon: 'ph-circle',         min: 10,  max: 80,  step: 0.5, group: 'girths' },
    { id: 'shoulders',  label: 'Плечи',     unit: 'см', icon: 'ph-arrows-out-line-horizontal', min: 30, max: 200, step: 0.5, group: 'girths' },
    { id: 'chest',      label: 'Грудь',     unit: 'см', icon: 'ph-heart',          min: 30,  max: 200, step: 0.5, group: 'girths' },
    { id: 'waist',      label: 'Талия',     unit: 'см', icon: 'ph-align-center-horizontal', min: 30, max: 200, step: 0.5, group: 'girths' },
    { id: 'hips',       label: 'Бёдра',     unit: 'см', icon: 'ph-circle',         min: 30,  max: 200, step: 0.5, group: 'girths' },
    { id: 'bicep',      label: 'Бицепс',    unit: 'см', icon: 'ph-hand-fist',      min: 10,  max: 80,  step: 0.5, group: 'girths' },
    { id: 'thigh',      label: 'Бедро',     unit: 'см', icon: 'ph-person-simple',  min: 20,  max: 120, step: 0.5, group: 'girths' },
    { id: 'calf',       label: 'Голень',    unit: 'см', icon: 'ph-person-simple-run', min: 15, max: 80, step: 0.5, group: 'girths' }
  ],

  init: function() {
    if (typeof Logger !== 'undefined') Logger.log('Модуль замеров тела инициализирован', 'info');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { MeasurementsModule.setup(); });
    } else {
      this.setup();
    }
  },

  setup: function() {
    this.createMeasurementsScreen();
    if (typeof Core !== 'undefined') {
      Core.addNavButton('Замеры тела', 'measurements', '<i class="ph ph-ruler"></i>');
      Core.registerScreen('measurements', function() { MeasurementsModule.createMeasurementsScreen(); });
    }
    var self = this;
    if (typeof Events !== 'undefined' && Events.on) {
      Events.on('history:changed', function() {
        var screen = document.getElementById('screen-measurements');
        if (screen && screen.classList.contains('active')) self.createMeasurementsScreen();
      });
    }
  },

  /* ---------- ДАННЫЕ ---------- */
  getMeasurements: function() {
    try {
      var raw;
      if (typeof FTStorage !== 'undefined' && FTStorage.get) raw = FTStorage.get('measurements');
      else {
        var s = localStorage.getItem('ft_measurements');
        raw = s ? JSON.parse(s) : null;
      }
      if (!Array.isArray(raw)) return [];
      // Валидация + сортировка по дате (новые сверху)
      return raw
        .filter(function(m) { return m && typeof m.date === 'string' && m.date; })
        .sort(function(a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });
    } catch (e) {
      if (typeof Logger !== 'undefined') Logger.log('getMeasurements error: ' + e.message, 'warn');
      return [];
    }
  },

  saveMeasurements: function(list) {
    if (typeof FTStorage !== 'undefined' && FTStorage.set) FTStorage.set('measurements', list || []);
    else {
      try { localStorage.setItem('ft_measurements', JSON.stringify(list || [])); } catch (e) {}
    }
    if (typeof Events !== 'undefined' && Events.emit) Events.emit('measurements:changed', { count: (list || []).length });
  },

  getMeasurementByDate: function(dateStr) {
    var list = this.getMeasurements();
    for (var i = 0; i < list.length; i++) if (list[i].date === dateStr) return list[i];
    return null;
  },

  getMeasurementById: function(id) {
    if (!id) return null;
    var list = this.getMeasurements();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  },

  /* ---------- УТИЛИТЫ ---------- */
  _esc: function(t) {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.escapeHtml) return Core.utils.escapeHtml(t);
    if (t == null) return '';
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
  _uid: function() {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.generateId) return Core.utils.generateId('msr');
    return 'msr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  },
  _todayStr: function() {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.formatLocalDate) return Core.utils.formatLocalDate(new Date());
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },
  _formatDateRu: function(dateStr) {
    if (!dateStr) return '';
    var parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return parts[2] + '.' + parts[1] + '.' + parts[0];
  },
  _getField: function(id) {
    for (var i = 0; i < this.FIELDS.length; i++) if (this.FIELDS[i].id === id) return this.FIELDS[i];
    return null;
  },
  _formatValue: function(field, value) {
    if (value === null || value === undefined || value === '') return '—';
    var num = Number(value);
    if (isNaN(num)) return String(value);
    var rounded = Math.round(num * 10) / 10;
    return rounded + (field.unit ? ' ' + field.unit : '');
  },

  /* ---------- ИНТЕГРАЦИЯ С HISTORY ---------- */
  // Если в замере есть weight, синхронизируем с history[date].weight
  _syncWeightToHistory: function(measurement) {
    if (!measurement || !measurement.date || measurement.weight == null) return;
    var history;
    if (typeof CoreData !== 'undefined' && CoreData.getHistory) history = CoreData.getHistory();
    else if (typeof FTStorage !== 'undefined') history = FTStorage.get('history') || [];
    else return;

    if (!Array.isArray(history)) return;

    var found = null;
    for (var i = 0; i < history.length; i++) {
      if (history[i].date === measurement.date) { found = history[i]; break; }
    }

    if (found) {
      found.weight = measurement.weight;
    } else {
      // Создаём пустую запись, чтобы график веса подхватил
      history.push({
        date: measurement.date,
        dayName: '',
        muscleGroup: '',
        exercises: [],
        details: [],
        duration: 0,
        weight: measurement.weight,
        timestamp: Date.now()
      });
    }

    if (typeof CoreData !== 'undefined' && CoreData.setHistory) CoreData.setHistory(history);
    else if (typeof FTStorage !== 'undefined') FTStorage.set('history', history);

    if (typeof Core !== 'undefined') Core._historyMapCache = null;
  },

  /* ---------- ЭКРАН ---------- */
  createMeasurementsScreen: function() {
    var esc = this._esc;
    var screen = document.getElementById('screen-measurements');
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'screen-measurements';
      screen.className = 'screen';
      document.getElementById('userInterface').appendChild(screen);
    }

    var list = this.getMeasurements();
    var latest = list[0] || null;
    var summary = this._buildSummary(list);

    var css = '<style>' +
      '.msr-card { background:var(--bg-card); border-radius:14px; margin-bottom:12px; border:1px solid var(--border-subtle); overflow:hidden; transition:all 0.2s; }' +
      '.msr-card:hover { border-color:var(--border-gold); }' +
      '.msr-header { padding:14px 16px; cursor:pointer; display:flex; align-items:center; gap:12px; }' +
      '.msr-header .date-block { width:56px; text-align:center; flex-shrink:0; }' +
      '.msr-header .date-day { font-family:var(--font-display); font-size:1.4em; font-weight:900; color:var(--accent-gold); line-height:1; }' +
      '.msr-header .date-month { font-size:0.7em; opacity:0.6; text-transform:uppercase; letter-spacing:1px; margin-top:2px; }' +
      '.msr-header .info { flex:1; min-width:0; }' +
      '.msr-header .main-value { font-size:1.1em; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:8px; flex-wrap:wrap; }' +
      '.msr-header .main-value .delta { font-size:0.78em; font-weight:600; padding:2px 8px; border-radius:10px; }' +
      '.msr-header .main-value .delta.up { color:var(--accent-warning); background:rgba(251,191,36,0.15); }' +
      '.msr-header .main-value .delta.down { color:var(--accent-success); background:rgba(74,222,128,0.15); }' +
      '.msr-header .main-value .delta.same { color:var(--text-muted); background:var(--bg-primary); }' +
      '.msr-header .sub-line { font-size:0.78em; opacity:0.65; margin-top:3px; display:flex; gap:10px; flex-wrap:wrap; }' +
      '.msr-header .chevron { color:var(--accent-gold); font-size:1.1em; flex-shrink:0; transition:transform 0.2s; }' +
      '.msr-card.open .msr-header .chevron { transform:rotate(180deg); }' +
      '.msr-body { display:none; padding:0 16px 16px; border-top:1px solid var(--border-subtle); }' +
      '.msr-card.open .msr-body { display:block; }' +
      '.msr-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(110px, 1fr)); gap:8px; margin-top:12px; }' +
      '.msr-field { background:var(--bg-primary); border:1px solid var(--border-subtle); border-radius:10px; padding:10px 12px; }' +
      '.msr-field .f-label { font-size:0.72em; opacity:0.6; text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:4px; }' +
      '.msr-field .f-value { font-size:1.05em; font-weight:700; color:var(--accent-gold); margin-top:4px; display:flex; align-items:baseline; gap:6px; }' +
      '.msr-field .f-delta { font-size:0.7em; font-weight:600; }' +
      '.msr-field .f-delta.up { color:var(--accent-warning); }' +
      '.msr-field .f-delta.down { color:var(--accent-success); }' +
      '.msr-field .f-delta.same { color:var(--text-muted); }' +
      '.msr-actions { display:flex; gap:8px; margin-top:14px; justify-content:flex-end; }' +
      '.msr-summary { background:var(--bg-card); border-radius:14px; padding:16px; margin-bottom:16px; border:1px solid var(--border-gold); }' +
      '.msr-summary h3 { font-family:var(--font-display); color:var(--accent-gold); margin:0 0 12px 0; font-size:1.1em; display:flex; align-items:center; gap:8px; }' +
      '.msr-summary-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(100px, 1fr)); gap:10px; }' +
      '.msr-summary-item { text-align:center; padding:10px; background:var(--bg-primary); border-radius:10px; border:1px solid var(--border-subtle); }' +
      '.msr-summary-item .sv { font-size:1.4em; font-weight:800; color:var(--accent-gold); line-height:1; }' +
      '.msr-summary-item .sl { font-size:0.7em; opacity:0.65; margin-top:4px; }' +
      '.msr-empty { text-align:center; padding:40px 20px; opacity:0.6; }' +
      '.msr-empty i { font-size:3em; color:var(--accent-gold); display:block; margin-bottom:12px; }' +
      '.msr-sparkline { width:100%; height:80px; display:block; margin-top:12px; border-radius:8px; background:var(--bg-primary); }' +
      '.ex-modal { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); backdrop-filter:blur(15px); z-index:1000; display:flex; justify-content:center; align-items:center; padding:15px; }' +
      '.ex-modal-content { background:var(--modal-bg, var(--bg-secondary)); padding:24px; border-radius:20px; width:100%; max-width:520px; max-height:90vh; overflow-y:auto; border:1px solid var(--border-gold); box-shadow:var(--modal-shadow, 0 10px 40px rgba(0,0,0,0.5)); }' +
      '.msr-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }' +
      '.msr-form-field { display:flex; flex-direction:column; gap:4px; }' +
      '.msr-form-field label { font-size:0.8em; font-weight:600; opacity:0.85; display:flex; align-items:center; gap:4px; }' +
      '.msr-form-field input { padding:9px 10px; background:var(--bg-input); border:1px solid var(--border-subtle); border-radius:8px; color:var(--text-primary); font-size:0.95em; }' +
      '.msr-form-field input:focus { border-color:var(--border-gold); }' +
      '@media (max-width: 400px) { .msr-form-grid { grid-template-columns:1fr; } }' +
      '@media (prefers-reduced-motion: reduce) { .msr-card, .msr-card.open .msr-header .chevron { transition: none !important; } }' +
    '</style>';

    var html = css + '<div style="padding:4px;max-width:700px;margin:0 auto">';
    html += '<h2 style="font-family:var(--font-display);font-size:1.8em;margin-bottom:10px;color:var(--accent-gold);display:flex;align-items:center;gap:12px"><i class="ph ph-ruler"></i> Замеры тела</h2>';
    html += '<div class="hint" style="margin-bottom:16px;display:flex;align-items:center;gap:6px;font-size:0.8em;opacity:0.7"><i class="ph ph-info"></i> Вес синхронизируется с графиком в статистике</div>';

    // Кнопки
    html += '<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">';
    html += '<button class="btn btn-primary" style="flex:1;min-width:150px;padding:12px;font-weight:600" onclick="MeasurementsModule.openForm()"><i class="ph ph-plus-circle"></i> Добавить замер</button>';
    if (list.length > 0) {
      html += '<button class="btn btn-secondary" style="padding:12px 16px" onclick="MeasurementsModule.exportCsv()" title="Экспорт в CSV"><i class="ph ph-export"></i></button>';
    }
    html += '</div>';

    // Сводка
    if (latest && summary) {
      html += '<div class="msr-summary">';
      html += '<h3><i class="ph ph-chart-line-up"></i> Сводка</h3>';
      html += '<div class="msr-summary-grid">';
      if (summary.latestWeight != null) {
        html += '<div class="msr-summary-item"><div class="sv">' + this._formatValue(this._getField('weight'), summary.latestWeight) + '</div><div class="sl">Текущий вес</div></div>';
      }
      if (summary.delta30 != null) {
        var cls30 = summary.delta30 > 0 ? 'up' : (summary.delta30 < 0 ? 'down' : 'same');
        var sign30 = summary.delta30 > 0 ? '+' : '';
        html += '<div class="msr-summary-item"><div class="sv" style="color:var(--accent-' + (summary.delta30 > 0 ? 'warning' : summary.delta30 < 0 ? 'success' : 'text-muted') + ')">' + sign30 + summary.delta30.toFixed(1) + '</div><div class="sl">за 30 дней, кг</div></div>';
      }
      if (summary.minWeight != null) {
        html += '<div class="msr-summary-item"><div class="sv">' + summary.minWeight.toFixed(1) + '</div><div class="sl">Мин. вес</div></div>';
      }
      if (summary.maxWeight != null) {
        html += '<div class="msr-summary-item"><div class="sv">' + summary.maxWeight.toFixed(1) + '</div><div class="sl">Макс. вес</div></div>';
      }
      html += '</div>';
      // Sparkline веса
      if (summary.weightSeries && summary.weightSeries.length >= 2) {
        html += '<canvas class="msr-sparkline" id="msrSparkline" width="600" height="80"></canvas>';
      }
      html += '</div>';
    }

    // Список
    if (list.length === 0) {
      html += '<div class="msr-empty"><i class="ph ph-ruler"></i><p>Пока нет замеров.<br>Добавь первый — и отслеживай прогресс!</p></div>';
    } else {
      for (var i = 0; i < list.length; i++) {
        html += this._renderMeasurementCard(list[i], i, list);
      }
    }

    html += '</div>';
    screen.innerHTML = html;

    // Биндинги
    var self = this;
    screen.querySelectorAll('.msr-header').forEach(function(h) {
      h.onclick = function() {
        var card = h.closest('.msr-card');
        if (card) {
          var id = card.getAttribute('data-id');
          self._state.expandedId = (self._state.expandedId === id) ? null : id;
          card.classList.toggle('open');
        }
      };
    });

    // Sparkline
    if (summary && summary.weightSeries && summary.weightSeries.length >= 2) {
      setTimeout(function() { self._drawSparkline(); }, 30);
    }
  },

  _renderMeasurementCard: function(m, idx, allList) {
    var esc = this._esc;
    var prev = allList[idx + 1] || null; // предыдущий замер (старше)
    var dateParts = (m.date || '').split('-');
    var day = dateParts[2] || '?';
    var monthNames = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
    var month = dateParts[1] ? monthNames[parseInt(dateParts[1], 10) - 1] : '';
    var isOpen = this._state.expandedId === m.id;

    // Главное значение — вес
    var mainHtml = '—';
    if (m.weight != null) {
      mainHtml = this._formatValue(this._getField('weight'), m.weight);
      if (prev && prev.weight != null) {
        var diff = m.weight - prev.weight;
        var cls = diff > 0 ? 'up' : (diff < 0 ? 'down' : 'same');
        var sign = diff > 0 ? '+' : '';
        if (Math.abs(diff) >= 0.05) {
          mainHtml += ' <span class="delta ' + cls + '">' + sign + diff.toFixed(1) + '</span>';
        }
      }
    }

    // Подпись — сколько параметров заполнено
    var filled = 0, total = 0;
    for (var i = 0; i < this.FIELDS.length; i++) {
      total++;
      if (m[this.FIELDS[i].id] != null) filled++;
    }

    var html = '<div class="msr-card ' + (isOpen ? 'open' : '') + '" data-id="' + esc(m.id) + '">';
    html += '<div class="msr-header">';
    html += '<div class="date-block"><div class="date-day">' + esc(day) + '</div><div class="date-month">' + esc(month) + '</div></div>';
    html += '<div class="info">';
    html += '<div class="main-value">' + mainHtml + '</div>';
    html += '<div class="sub-line"><span><i class="ph ph-list-checks"></i> ' + filled + '/' + total + ' параметров</span>';
    if (m.bodyFat != null) html += '<span><i class="ph ph-percent"></i> ' + m.bodyFat + '%</span>';
    if (m.waist != null) html += '<span><i class="ph ph-align-center-horizontal"></i> ' + m.waist + ' см</span>';
    html += '</div></div>';
    html += '<i class="ph ph-caret-down chevron"></i>';
    html += '</div>';

    html += '<div class="msr-body">';
    html += '<div class="msr-grid">';
    for (var f = 0; f < this.FIELDS.length; f++) {
      var field = this.FIELDS[f];
      var val = m[field.id];
      if (val == null) continue;
      var deltaHtml = '';
      if (prev && prev[field.id] != null) {
        var d = val - prev[field.id];
        if (Math.abs(d) >= 0.05) {
          var dcls = d > 0 ? 'up' : 'down';
          var dsign = d > 0 ? '+' : '';
          deltaHtml = '<span class="f-delta ' + dcls + '">' + dsign + d.toFixed(1) + '</span>';
        }
      }
      html += '<div class="msr-field">';
      html += '<div class="f-label"><i class="ph ' + field.icon + '"></i> ' + esc(field.label) + '</div>';
      html += '<div class="f-value">' + this._formatValue(field, val) + deltaHtml + '</div>';
      html += '</div>';
    }
    html += '</div>';
    html += '<div class="msr-actions">';
    html += '<button class="btn btn-danger" style="padding:8px 14px;font-size:0.85em" onclick="event.stopPropagation();MeasurementsModule.deleteMeasurement(\'' + esc(m.id) + '\')"><i class="ph ph-trash"></i> Удалить</button>';
    html += '<button class="btn btn-secondary" style="padding:8px 14px;font-size:0.85em" onclick="event.stopPropagation();MeasurementsModule.openForm(\'' + esc(m.id) + '\')"><i class="ph ph-pencil-simple"></i> Редактировать</button>';
    html += '</div>';
    html += '</div></div>';
    return html;
  },

  _buildSummary: function(list) {
    if (!list || list.length === 0) return null;
    var weights = [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].weight != null) weights.push({ date: list[i].date, weight: Number(list[i].weight) });
    }
    // weights отсортированы: новые сверху
    if (weights.length === 0) {
      return { latestWeight: null, minWeight: null, maxWeight: null, delta30: null, weightSeries: [] };
    }

    var latestWeight = weights[0].weight;
    var minW = weights[0].weight, maxW = weights[0].weight;
    for (var k = 1; k < weights.length; k++) {
      if (weights[k].weight < minW) minW = weights[k].weight;
      if (weights[k].weight > maxW) maxW = weights[k].weight;
    }

    // Дельта за 30 дней: ищем ближайшую запись >= 30 дней назад
    var delta30 = null;
    var latestDate = new Date(weights[0].date + 'T00:00:00');
    var threshold = new Date(latestDate);
    threshold.setDate(threshold.getDate() - 30);
    var closest = null;
    for (var j = 1; j < weights.length; j++) {
      var d = new Date(weights[j].date + 'T00:00:00');
      if (d <= threshold) { closest = weights[j]; break; }
    }
    if (closest) delta30 = latestWeight - closest.weight;

    // Серия для спарклайна (по возрастанию даты)
    var series = weights.slice().sort(function(a, b) {
      return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0);
    });

    return {
      latestWeight: latestWeight,
      minWeight: minW,
      maxWeight: maxW,
      delta30: delta30,
      weightSeries: series
    };
  },

  _drawSparkline: function() {
    var canvas = document.getElementById('msrSparkline');
    if (!canvas) return;
    var list = this.getMeasurements();
    var summary = this._buildSummary(list);
    if (!summary || !summary.weightSeries || summary.weightSeries.length < 2) return;

    var series = summary.weightSeries;
    var dpr = window.devicePixelRatio || 1;
    var W = canvas.clientWidth || 600;
    var H = canvas.clientHeight || 80;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    var values = series.map(function(p) { return p.weight; });
    var minV = Math.min.apply(null, values);
    var maxV = Math.max.apply(null, values);
    var range = maxV - minV || 1;
    var padding = 8;
    var chartW = W - padding * 2;
    var chartH = H - padding * 2;

    // Сетка
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (var g = 0; g <= 3; g++) {
      var gy = padding + (g / 3) * chartH;
      ctx.beginPath(); ctx.moveTo(padding, gy); ctx.lineTo(W - padding, gy); ctx.stroke();
    }

    // Линия
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    var points = [];
    for (var i = 0; i < series.length; i++) {
      var x = padding + (i / (series.length - 1)) * chartW;
      var y = padding + (1 - (series[i].weight - minV) / range) * chartH;
      points.push({ x: x, y: y });
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Точки
    for (var p = 0; p < points.length; p++) {
      ctx.beginPath();
      ctx.arc(points[p].x, points[p].y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#d4af37';
      ctx.fill();
    }

    // Подписи min/max
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(maxV.toFixed(1), padding + 2, padding + 10);
    ctx.fillText(minV.toFixed(1), padding + 2, H - padding - 2);
  },

  /* ---------- ФОРМА ---------- */
  openForm: function(id) {
    var esc = this._esc;
    var isEdit = !!id;
    var m = isEdit ? this.getMeasurementById(id) : null;
    if (isEdit && !m) {
      if (typeof Notify !== 'undefined') Notify.warn('Замер не найден');
      return;
    }

    var old = document.getElementById('msrFormModal');
    if (old) old.remove();

    var modal = document.createElement('div');
    modal.className = 'ex-modal';
    modal.id = 'msrFormModal';

    var today = this._todayStr();
    var dateVal = isEdit ? m.date : today;

    var fieldsHtml = '';
    // Группа 1: основные
    fieldsHtml += '<div style="grid-column:1/-1;font-size:0.8em;text-transform:uppercase;letter-spacing:1px;color:var(--accent-gold);font-weight:600;margin-top:6px">Основное</div>';
    for (var i = 0; i < this.FIELDS.length; i++) {
      var f = this.FIELDS[i];
      if (f.group !== 'main') continue;
      var v = isEdit && m[f.id] != null ? m[f.id] : '';
      fieldsHtml += '<div class="msr-form-field">' +
        '<label><i class="ph ' + f.icon + '"></i> ' + esc(f.label) + (f.unit ? ' (' + esc(f.unit) + ')' : '') + '</label>' +
        '<input type="number" step="' + f.step + '" min="' + f.min + '" max="' + f.max + '" data-field="' + f.id + '" value="' + esc(v) + '" placeholder="—">' +
      '</div>';
    }
    // Группа 2: обхваты
    fieldsHtml += '<div style="grid-column:1/-1;font-size:0.8em;text-transform:uppercase;letter-spacing:1px;color:var(--accent-gold);font-weight:600;margin-top:10px">Обхваты</div>';
    for (var k = 0; k < this.FIELDS.length; k++) {
      var f2 = this.FIELDS[k];
      if (f2.group !== 'girths') continue;
      var v2 = isEdit && m[f2.id] != null ? m[f2.id] : '';
      fieldsHtml += '<div class="msr-form-field">' +
        '<label><i class="ph ' + f2.icon + '"></i> ' + esc(f2.label) + (f2.unit ? ' (' + esc(f2.unit) + ')' : '') + '</label>' +
        '<input type="number" step="' + f2.step + '" min="' + f2.min + '" max="' + f2.max + '" data-field="' + f2.id + '" value="' + esc(v2) + '" placeholder="—">' +
      '</div>';
    }

    modal.innerHTML =
      '<div class="ex-modal-content">' +
        '<button style="float:right;background:transparent;border:none;color:var(--text-secondary);font-size:1.5em;cursor:pointer" onclick="document.getElementById(\'msrFormModal\').remove()" aria-label="Закрыть"><i class="ph ph-x"></i></button>' +
        '<h2 style="font-family:var(--font-display);color:var(--accent-gold);margin-top:0;display:flex;align-items:center;gap:10px">' +
          (isEdit ? '<i class="ph ph-pencil-simple"></i> Редактировать замер' : '<i class="ph ph-plus-circle"></i> Новый замер') +
        '</h2>' +
        '<div style="margin-bottom:14px">' +
          '<label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em"><i class="ph ph-calendar"></i> Дата:</label>' +
          '<input type="date" id="msrDate" value="' + esc(dateVal) + '" max="' + esc(today) + '" style="width:100%;padding:10px;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:1em">' +
        '</div>' +
        '<div class="msr-form-grid">' + fieldsHtml + '</div>' +
        '<div style="margin-top:14px">' +
          '<label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em"><i class="ph ph-note"></i> Заметка (опционально):</label>' +
          '<textarea id="msrNote" rows="2" placeholder="Условия замера, самочувствие..." style="width:100%;padding:10px;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:0.95em;resize:vertical">' + esc(isEdit && m.note ? m.note : '') + '</textarea>' +
        '</div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">' +
          '<button class="btn btn-secondary" onclick="document.getElementById(\'msrFormModal\').remove()">Отмена</button>' +
          '<button class="btn btn-primary" onclick="MeasurementsModule.saveForm(\'' + esc(id || '') + '\')"><i class="ph ph-floppy-disk"></i> Сохранить</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    // Автофокус на первое пустое поле
    setTimeout(function() {
      var inputs = modal.querySelectorAll('input[data-field]');
      for (var i = 0; i < inputs.length; i++) {
        if (!inputs[i].value) { inputs[i].focus(); break; }
      }
    }, 50);
  },

  saveForm: function(id) {
    var esc = this._esc;
    var dateEl = document.getElementById('msrDate');
    if (!dateEl) return;
    var date = dateEl.value;
    if (!date) {
      if (typeof Notify !== 'undefined') Notify.warn('Укажи дату');
      return;
    }

    var data = { date: date, id: id || this._uid() };
    var hasAnyValue = false;
    var inputs = document.querySelectorAll('#msrFormModal input[data-field]');
    for (var i = 0; i < inputs.length; i++) {
      var field = inputs[i].getAttribute('data-field');
      var raw = inputs[i].value.trim();
      if (raw === '') {
        data[field] = null;
      } else {
        var num = Number(raw);
        if (isNaN(num)) {
          if (typeof Notify !== 'undefined') Notify.warn('Некорректное значение в поле ' + field);
          return;
        }
        data[field] = num;
        hasAnyValue = true;
      }
    }

    if (!hasAnyValue) {
      if (typeof Notify !== 'undefined') Notify.warn('Заполни хотя бы одно поле');
      return;
    }

    var noteEl = document.getElementById('msrNote');
    if (noteEl) data.note = noteEl.value.trim();

    var list = this.getMeasurements();
    var existingIdx = -1;
    for (var j = 0; j < list.length; j++) {
      if (list[j].id === data.id) { existingIdx = j; break; }
    }

    // Проверка на дубликат даты (если создаём новый и дата уже есть)
    if (existingIdx === -1) {
      for (var k = 0; k < list.length; k++) {
        if (list[k].date === data.date) {
          if (!confirm('Замер на эту дату уже есть. Заменить?')) return;
          existingIdx = k;
          data.id = list[k].id;
          break;
        }
      }
    }

    if (existingIdx !== -1) list[existingIdx] = data;
    else list.push(data);

    // Сортировка
    list.sort(function(a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0); });

    this.saveMeasurements(list);
    this._syncWeightToHistory(data);

    var modal = document.getElementById('msrFormModal');
    if (modal) modal.remove();

    this.createMeasurementsScreen();

    if (typeof Notify !== 'undefined') Notify.success('Замер сохранён!');
    if (typeof AchievementsModule !== 'undefined' && AchievementsModule.checkAchievements) {
      AchievementsModule.checkAchievements();
    }
  },

  deleteMeasurement: function(id) {
    if (!confirm('Удалить этот замер?')) return;
    var list = this.getMeasurements();
    var filtered = list.filter(function(m) { return m.id !== id; });
    this.saveMeasurements(filtered);
    this.createMeasurementsScreen();
    if (typeof Notify !== 'undefined') Notify.info('Замер удалён');
  },

  /* ---------- ЭКСПОРТ CSV ---------- */
  exportCsv: function() {
    var list = this.getMeasurements();
    if (list.length === 0) {
      if (typeof Notify !== 'undefined') Notify.warn('Нет данных для экспорта');
      return;
    }

    // Собираем заголовки
    var headers = ['date'];
    for (var i = 0; i < this.FIELDS.length; i++) headers.push(this.FIELDS[i].id + ' (' + this.FIELDS[i].unit + ')');
    headers.push('note');

    var rows = [headers.join(';')];
    // Экспорт в хронологическом порядке (старые сверху)
    var sorted = list.slice().sort(function(a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
    for (var j = 0; j < sorted.length; j++) {
      var m = sorted[j];
      var row = [m.date];
      for (var k = 0; k < this.FIELDS.length; k++) {
        var v = m[this.FIELDS[k].id];
        row.push(v == null ? '' : String(v).replace(/;/g, ','));
      }
      row.push((m.note || '').replace(/;/g, ',').replace(/\n/g, ' '));
      rows.push(row.join(';'));
    }

    var csv = '\uFEFF' + rows.join('\n'); // BOM для Excel
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'measurements_' + this._todayStr() + '.csv';
    a.click();
    URL.revokeObjectURL(url);

    if (typeof Notify !== 'undefined') Notify.success('Экспортировано записей: ' + list.length);
  }
};

window.MeasurementsModule = MeasurementsModule;
module.exports = MeasurementsModule;