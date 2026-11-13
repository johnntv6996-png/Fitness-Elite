// modules/nutrition.js

const NutritionModule = {
  _state: {
    currentDate: null,     // YYYY-MM-DD
    editingMealId: null,
    addingToMealType: null,
    _searchDebounce: null
  },

  MEAL_TYPES: [
    { id: 'breakfast', label: 'Завтрак', icon: 'ph-sun-horizon', color: '#fb923c' },
    { id: 'lunch',     label: 'Обед',    icon: 'ph-sun',          color: '#fbbf24' },
    { id: 'dinner',    label: 'Ужин',    icon: 'ph-moon',         color: '#a78bfa' },
    { id: 'snack',     label: 'Перекус', icon: 'ph-cookie',       color: '#f472b6' }
  ],

  DEFAULT_GOAL: { kcal: 2000, protein: 150, fat: 70, carbs: 250 },

  init: function() {
    if (typeof Logger !== 'undefined') Logger.log('Модуль питания инициализирован', 'info');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { NutritionModule.setup(); });
    } else {
      this.setup();
    }
  },

  setup: function() {
    this._state.currentDate = this._todayStr();
    this.createNutritionScreen();
    if (typeof Core !== 'undefined') {
      Core.addNavButton('Питание', 'nutrition', '<i class="ph ph-fork-knife"></i>');
      Core.registerScreen('nutrition', function() { NutritionModule.createNutritionScreen(); });
    }
    var self = this;
    if (typeof Events !== 'undefined' && Events.on) {
      Events.on('settings:changed', function() {
        var screen = document.getElementById('screen-nutrition');
        if (screen && screen.classList.contains('active')) self.createNutritionScreen();
      });
    }
  },

  /* ---------- ХРАНИЛИЩЕ ---------- */
  _read: function(key, fallback) {
    try {
      var v;
      if (typeof FTStorage !== 'undefined' && FTStorage.get) v = FTStorage.get(key);
      else {
        var raw = localStorage.getItem('ft_' + key);
        v = raw ? JSON.parse(raw) : null;
      }
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  },
  _write: function(key, value) {
    try {
      if (typeof FTStorage !== 'undefined' && FTStorage.set) FTStorage.set(key, value);
      else localStorage.setItem('ft_' + key, JSON.stringify(value));
    } catch (e) {
      if (typeof Logger !== 'undefined') Logger.log('nutrition write error: ' + e.message, 'error');
    }
  },

  getData: function() {
    var d = this._read('nutrition', {});
    if (!d || typeof d !== 'object' || Array.isArray(d)) return {};
    return d;
  },
  saveData: function(d) {
    this._write('nutrition', d || {});
    if (typeof Events !== 'undefined' && Events.emit) Events.emit('nutrition:changed');
  },

  getDay: function(dateStr) {
    var d = this.getData();
    return d[dateStr] || { meals: [] };
  },
  saveDay: function(dateStr, day) {
    var d = this.getData();
    d[dateStr] = day;
    this.saveData(d);
  },

  getFoods: function() {
    var foods = this._read('nutrition_foods', null);
    if (!Array.isArray(foods) || foods.length === 0) {
      // Seed популярных продуктов
      foods = [
        { id: 'f_chicken',  name: 'Куриная грудка',      kcal: 165, protein: 31,  fat: 3.6, carbs: 0   },
        { id: 'f_beef',     name: 'Говядина',            kcal: 250, protein: 26,  fat: 15,  carbs: 0   },
        { id: 'f_egg',      name: 'Яйцо куриное',        kcal: 155, protein: 13,  fat: 11,  carbs: 1.1 },
        { id: 'f_rice',     name: 'Рис варёный',         kcal: 130, protein: 2.7, fat: 0.3, carbs: 28  },
        { id: 'f_buckwheat',name: 'Гречка варёная',      kcal: 110, protein: 4,   fat: 1.1, carbs: 21  },
        { id: 'f_oats',     name: 'Овсянка на воде',     kcal: 88,  protein: 3,   fat: 1.7, carbs: 15  },
        { id: 'f_pasta',    name: 'Макароны варёные',    kcal: 131, protein: 5,   fat: 1.1, carbs: 25  },
        { id: 'f_bread',    name: 'Хлеб цельнозерновой', kcal: 247, protein: 13,  fat: 3.4, carbs: 41  },
        { id: 'f_milk',     name: 'Молоко 2.5%',         kcal: 52,  protein: 2.8, fat: 2.5, carbs: 4.7 },
        { id: 'f_kefir',    name: 'Кефир 1%',            kcal: 40,  protein: 2.8, fat: 1,   carbs: 4   },
        { id: 'f_cottage',  name: 'Творог 5%',           kcal: 121, protein: 17,  fat: 5,   carbs: 1.8 },
        { id: 'f_cheese',   name: 'Сыр твёрдый',         kcal: 364, protein: 25,  fat: 28,  carbs: 2   },
        { id: 'f_banana',   name: 'Банан',               kcal: 89,  protein: 1.1, fat: 0.3, carbs: 23  },
        { id: 'f_apple',    name: 'Яблоко',              kcal: 52,  protein: 0.3, fat: 0.2, carbs: 14  },
        { id: 'f_orange',   name: 'Апельсин',            kcal: 47,  protein: 0.9, fat: 0.1, carbs: 12  },
        { id: 'f_potato',   name: 'Картофель варёный',   kcal: 87,  protein: 2,   fat: 0.1, carbs: 20  },
        { id: 'f_tomato',   name: 'Помидор',             kcal: 18,  protein: 0.9, fat: 0.2, carbs: 3.9 },
        { id: 'f_cucumber', name: 'Огурец',              kcal: 15,  protein: 0.7, fat: 0.1, carbs: 3.6 },
        { id: 'f_broccoli', name: 'Брокколи',            kcal: 34,  protein: 2.8, fat: 0.4, carbs: 7   },
        { id: 'f_avocado',  name: 'Авокадо',             kcal: 160, protein: 2,   fat: 15,  carbs: 9   },
        { id: 'f_oil',      name: 'Масло оливковое',     kcal: 884, protein: 0,   fat: 100, carbs: 0   },
        { id: 'f_almond',   name: 'Миндаль',             kcal: 579, protein: 21,  fat: 50,  carbs: 22  },
        { id: 'f_fish',     name: 'Лосось',              kcal: 208, protein: 20,  fat: 13,  carbs: 0   },
        { id: 'f_tuna',     name: 'Тунец в с/с',         kcal: 96,  protein: 22,  fat: 1,   carbs: 0   }
      ];
      this._write('nutrition_foods', foods);
    }
    return foods;
  },
  saveFoods: function(foods) { this._write('nutrition_foods', foods); },

  getGoal: function() {
    var g = this._read('nutrition_goal', null);
    if (!g || typeof g !== 'object') return Object.assign({}, this.DEFAULT_GOAL);
    return Object.assign({}, this.DEFAULT_GOAL, g);
  },
  saveGoal: function(g) { this._write('nutrition_goal', g); },

  /* ---------- УТИЛИТЫ ---------- */
  _esc: function(t) {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.escapeHtml) return Core.utils.escapeHtml(t);
    if (t == null) return '';
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
  _uid: function() {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.generateId) return Core.utils.generateId('meal');
    return 'meal_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  },
  _todayStr: function() {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.formatLocalDate) return Core.utils.formatLocalDate(new Date());
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },
  _addDays: function(dateStr, delta) {
    var d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    return this._todayStr.call({ _todayStr: function(){} }, d) || this._formatDate(d);
  },
  _formatDate: function(d) {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.formatLocalDate) return Core.utils.formatLocalDate(d);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },
  _formatDateRu: function(dateStr) {
    if (!dateStr) return '';
    var p = dateStr.split('-');
    if (p.length !== 3) return dateStr;
    var months = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
    return p[2] + ' ' + (months[parseInt(p[1], 10) - 1] || '') + ' ' + p[0];
  },
  _isToday: function(dateStr) { return dateStr === this._todayStr(); },

  _sum: function(meals) {
    var total = { kcal: 0, protein: 0, fat: 0, carbs: 0 };
    for (var i = 0; i < meals.length; i++) {
      var m = meals[i];
      total.kcal += Number(m.kcal) || 0;
      total.protein += Number(m.protein) || 0;
      total.fat += Number(m.fat) || 0;
      total.carbs += Number(m.carbs) || 0;
    }
    total.kcal = Math.round(total.kcal);
    total.protein = Math.round(total.protein * 10) / 10;
    total.fat = Math.round(total.fat * 10) / 10;
    total.carbs = Math.round(total.carbs * 10) / 10;
    return total;
  },

  _mealsByType: function(day) {
    var map = {};
    for (var i = 0; i < this.MEAL_TYPES.length; i++) map[this.MEAL_TYPES[i].id] = [];
    if (day && Array.isArray(day.meals)) {
      for (var j = 0; j < day.meals.length; j++) {
        var m = day.meals[j];
        if (map[m.type]) map[m.type].push(m);
      }
    }
    return map;
  },

  /* ---------- ЭКРАН ---------- */
  createNutritionScreen: function() {
    var esc = this._esc;
    var screen = document.getElementById('screen-nutrition');
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'screen-nutrition';
      screen.className = 'screen';
      document.getElementById('userInterface').appendChild(screen);
    }

    if (!this._state.currentDate) this._state.currentDate = this._todayStr();

    var dateStr = this._state.currentDate;
    var day = this.getDay(dateStr);
    var meals = Array.isArray(day.meals) ? day.meals : [];
    var grouped = this._mealsByType({ meals: meals });
    var total = this._sum(meals);
    var goal = this.getGoal();
    var hintsEnabled = typeof shouldShowHints === 'function' ? shouldShowHints() : true;

    var kcalPct = goal.kcal > 0 ? Math.min(150, Math.round((total.kcal / goal.kcal) * 100)) : 0;
    var protPct = goal.protein > 0 ? Math.min(150, Math.round((total.protein / goal.protein) * 100)) : 0;
    var fatPct = goal.fat > 0 ? Math.min(150, Math.round((total.fat / goal.fat) * 100)) : 0;
    var carbsPct = goal.carbs > 0 ? Math.min(150, Math.round((total.carbs / goal.carbs) * 100)) : 0;

    var css = '<style>' +
      '.nut-date-bar { display:flex; align-items:center; justify-content:space-between; background:var(--bg-card); border-radius:12px; padding:10px 12px; margin-bottom:14px; border:1px solid var(--border-subtle); gap:8px; }' +
      '.nut-date-bar button { width:36px; height:36px; border-radius:50%; border:1px solid var(--border-subtle); background:var(--bg-primary); color:var(--accent-gold); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:1.1em; transition:all 0.15s; flex-shrink:0; }' +
      '.nut-date-bar button:hover:not(:disabled) { background:var(--accent-gold-dim); border-color:var(--border-gold); }' +
      '.nut-date-bar button:disabled { opacity:0.3; cursor:not-allowed; }' +
      '.nut-date-label { flex:1; text-align:center; font-weight:600; color:var(--accent-gold); font-size:0.95em; }' +
      '.nut-date-label small { display:block; font-weight:500; color:var(--text-secondary); font-size:0.75em; margin-top:2px; }' +
      '.nut-summary { background:var(--bg-card); border-radius:16px; padding:16px; margin-bottom:14px; border:1px solid var(--border-gold); }' +
      '.nut-summary-top { display:flex; align-items:center; gap:16px; margin-bottom:14px; }' +
      '.nut-ring-wrap { position:relative; width:110px; height:110px; flex-shrink:0; }' +
      '.nut-ring-wrap canvas { width:100%; height:100%; display:block; }' +
      '.nut-ring-center { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; pointer-events:none; }' +
      '.nut-ring-center .rc-val { font-family:var(--font-display); font-size:1.4em; font-weight:800; color:var(--accent-gold); line-height:1; }' +
      '.nut-ring-center .rc-lbl { font-size:0.65em; opacity:0.6; text-transform:uppercase; letter-spacing:0.5px; margin-top:3px; }' +
      '.nut-macros { flex:1; display:flex; flex-direction:column; gap:8px; min-width:0; }' +
      '.nut-macro-row { display:flex; align-items:center; gap:8px; font-size:0.85em; }' +
      '.nut-macro-row .ml { flex:1; display:flex; justify-content:space-between; gap:6px; }' +
      '.nut-macro-row .ml strong { color:var(--text-primary); }' +
      '.nut-macro-row .ml span { opacity:0.6; }' +
      '.nut-macro-bar { height:6px; background:var(--bg-primary); border-radius:3px; overflow:hidden; border:1px solid var(--border-subtle); flex-shrink:0; width:80px; }' +
      '.nut-macro-fill { height:100%; border-radius:3px; transition:width 0.5s; }' +
      '.nut-macro-fill.p { background:linear-gradient(90deg,#4ade80,#22c55e); }' +
      '.nut-macro-fill.f { background:linear-gradient(90deg,#fbbf24,#f59e0b); }' +
      '.nut-macro-fill.c { background:linear-gradient(90deg,#60a5fa,#3b82f6); }' +
      '.nut-goal-btn { font-size:0.75em; padding:6px 10px; background:var(--bg-primary); border:1px solid var(--border-subtle); border-radius:8px; color:var(--text-secondary); cursor:pointer; display:inline-flex; align-items:center; gap:4px; transition:all 0.15s; }' +
      '.nut-goal-btn:hover { border-color:var(--border-gold); color:var(--accent-gold); }' +
      '.nut-meal { background:var(--bg-card); border-radius:14px; margin-bottom:10px; border:1px solid var(--border-subtle); overflow:hidden; }' +
      '.nut-meal-head { padding:12px 14px; display:flex; align-items:center; gap:10px; cursor:pointer; }' +
      '.nut-meal-head:hover { background:var(--accent-gold-dim); }' +
      '.nut-meal-icon { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:1.1em; flex-shrink:0; background:var(--bg-primary); }' +
      '.nut-meal-name { flex:1; min-width:0; }' +
      '.nut-meal-name .mn { font-weight:600; font-size:0.95em; }' +
      '.nut-meal-name .mc { font-size:0.75em; opacity:0.6; margin-top:1px; }' +
      '.nut-meal-kcal { font-weight:700; color:var(--accent-gold); font-size:0.95em; flex-shrink:0; }' +
      '.nut-meal-body { padding:0 14px 12px; border-top:1px solid var(--border-subtle); }' +
      '.nut-item { display:flex; align-items:center; gap:10px; padding:8px 10px; background:var(--bg-primary); border-radius:8px; margin-top:6px; }' +
      '.nut-item .ni-name { flex:1; min-width:0; font-size:0.88em; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }' +
      '.nut-item .ni-grams { font-size:0.75em; opacity:0.6; }' +
      '.nut-item .ni-kcal { font-weight:600; color:var(--accent-gold); font-size:0.85em; flex-shrink:0; }' +
      '.nut-item .ni-actions { display:flex; gap:4px; }' +
      '.nut-item .ni-actions button { width:28px; height:28px; border-radius:6px; background:transparent; border:1px solid var(--border-subtle); color:var(--text-secondary); cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:0.8em; transition:all 0.15s; }' +
      '.nut-item .ni-actions button:hover { border-color:var(--border-gold); color:var(--accent-gold); }' +
      '.nut-item .ni-actions button.danger:hover { border-color:var(--accent-error); color:var(--accent-error); }' +
      '.nut-add-btn { width:100%; padding:8px; background:transparent; border:1px dashed var(--border-subtle); border-radius:8px; color:var(--text-secondary); cursor:pointer; margin-top:6px; font-size:0.82em; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.15s; font-family:var(--font-primary); }' +
      '.nut-add-btn:hover { border-color:var(--accent-gold); color:var(--accent-gold); background:var(--accent-gold-dim); }' +
      '.nut-toolbar { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; }' +
      '.nut-toolbar button { flex:1; min-width:120px; padding:10px; font-size:0.85em; font-weight:600; }' +
      '.nut-modal { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); backdrop-filter:blur(15px); z-index:1000; display:flex; justify-content:center; align-items:center; padding:15px; }' +
      '.nut-modal-content { background:var(--modal-bg, var(--bg-secondary)); padding:24px; border-radius:20px; width:100%; max-width:520px; max-height:90vh; overflow-y:auto; border:1px solid var(--border-gold); box-shadow:var(--modal-shadow, 0 10px 40px rgba(0,0,0,0.5)); }' +
      '.nut-food-search { width:100%; padding:10px 12px; background:var(--bg-input); border:1px solid var(--border-subtle); border-radius:10px; color:var(--text-primary); font-size:1em; margin-bottom:10px; }' +
      '.nut-food-list { max-height:280px; overflow-y:auto; display:flex; flex-direction:column; gap:4px; margin-bottom:14px; }' +
      '.nut-food-row { display:flex; align-items:center; gap:10px; padding:10px 12px; background:var(--bg-primary); border:1px solid var(--border-subtle); border-radius:10px; cursor:pointer; transition:all 0.15s; }' +
      '.nut-food-row:hover, .nut-food-row.selected { border-color:var(--accent-gold); background:var(--accent-gold-dim); }' +
      '.nut-food-row .fr-name { flex:1; min-width:0; font-size:0.9em; font-weight:500; }' +
      '.nut-food-row .fr-kcal { font-size:0.78em; color:var(--text-secondary); flex-shrink:0; }' +
      '.nut-form-row { display:flex; gap:10px; margin-bottom:12px; }' +
      '.nut-form-row .nf { flex:1; }' +
      '.nut-form-row label { display:block; font-size:0.8em; font-weight:600; margin-bottom:4px; opacity:0.85; }' +
      '.nut-form-row input { width:100%; padding:9px 10px; background:var(--bg-input); border:1px solid var(--border-subtle); border-radius:8px; color:var(--text-primary); font-size:0.95em; }' +
      '.nut-form-row input:focus { border-color:var(--border-gold); }' +
      '.nut-empty { text-align:center; padding:16px; opacity:0.6; font-size:0.85em; }' +
      '@media (max-width: 480px) { .nut-summary-top { gap:12px; } .nut-ring-wrap { width:90px; height:90px; } .nut-ring-center .rc-val { font-size:1.2em; } .nut-macro-bar { width:60px; } }' +
      '@media (prefers-reduced-motion: reduce) { .nut-macro-fill { transition: none !important; } }' +
    '</style>';

    var html = css + '<div style="padding:4px;max-width:700px;margin:0 auto">';
    html += '<h2 style="font-family:var(--font-display);font-size:1.8em;margin-bottom:12px;color:var(--accent-gold);display:flex;align-items:center;gap:12px"><i class="ph ph-fork-knife"></i> Питание</h2>';

    // Навигация по дате
    html += '<div class="nut-date-bar">';
    html += '<button onclick="NutritionModule.changeDay(-1)" aria-label="Предыдущий день"><i class="ph ph-caret-left"></i></button>';
    html += '<div class="nut-date-label">' + esc(this._formatDateRu(dateStr)) + '<small>' + (this._isToday(dateStr) ? 'сегодня' : '') + '</small></div>';
    html += '<button onclick="NutritionModule.changeDay(1)" aria-label="Следующий день"><i class="ph ph-caret-right"></i></button>';
    html += '</div>';

    // Сводка
    html += '<div class="nut-summary">';
    html += '<div class="nut-summary-top">';
    html += '<div class="nut-ring-wrap"><canvas id="nutRing" width="220" height="220"></canvas><div class="nut-ring-center"><div class="rc-val">' + total.kcal + '</div><div class="rc-lbl">из ' + goal.kcal + '</div></div></div>';
    html += '<div class="nut-macros">';
    html += this._renderMacroRow('Белки', total.protein, goal.protein, protPct, 'p');
    html += this._renderMacroRow('Жиры', total.fat, goal.fat, fatPct, 'f');
    html += this._renderMacroRow('Углеводы', total.carbs, goal.carbs, carbsPct, 'c');
    html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">';
    html += '<button class="nut-goal-btn" onclick="NutritionModule.openGoalModal()"><i class="ph ph-target"></i> Норма</button>';
    if (meals.length > 0) html += '<button class="nut-goal-btn" onclick="NutritionModule.exportCsv()"><i class="ph ph-export"></i> CSV</button>';
    html += '</div>';
    html += '</div></div>';
    html += '</div>';

    // Кнопка «Скопировать вчера»
    var hasYesterday = false;
    try {
      var y = new Date(dateStr + 'T00:00:00'); y.setDate(y.getDate() - 1);
      var yStr = this._formatDate(y);
      var yDay = this.getDay(yStr);
      hasYesterday = yDay && Array.isArray(yDay.meals) && yDay.meals.length > 0;
    } catch (e) {}

    if (hasYesterday && meals.length === 0) {
      html += '<div class="nut-toolbar"><button class="btn btn-secondary" onclick="NutritionModule.copyFromYesterday()"><i class="ph ph-copy"></i> Скопировать вчерашний день</button></div>';
    }

    // Приёмы пищи
    for (var i = 0; i < this.MEAL_TYPES.length; i++) {
      html += this._renderMealBlock(this.MEAL_TYPES[i], grouped[this.MEAL_TYPES[i].id] || []);
    }

    html += '</div>';
    screen.innerHTML = html;

    // Рисуем кольцо
    setTimeout(function() { NutritionModule._drawRing(kcalPct); }, 30);
  },

  _renderMacroRow: function(label, value, goal, percent, cls) {
    var p = Math.min(100, percent);
    var over = percent > 100;
    return '<div class="nut-macro-row">' +
      '<div class="ml"><strong>' + label + '</strong><span>' + value + ' / ' + goal + ' г</span></div>' +
      '<div class="nut-macro-bar"><div class="nut-macro-fill ' + cls + '" style="width:' + p + '%;' + (over ? 'opacity:0.7;' : '') + '"></div></div>' +
      '</div>';
  },

  _renderMealBlock: function(type, items) {
    var esc = this._esc;
    var total = this._sum(items);
    var html = '<div class="nut-meal">';
    html += '<div class="nut-meal-head">';
    html += '<div class="nut-meal-icon" style="color:' + type.color + '"><i class="ph ' + type.icon + '"></i></div>';
    html += '<div class="nut-meal-name"><div class="mn">' + esc(type.label) + '</div>';
    html += '<div class="mc">' + (items.length > 0 ? items.length + ' поз. · ' + total.protein + 'б / ' + total.fat + 'ж / ' + total.carbs + 'у' : 'пусто') + '</div></div>';
    html += '<div class="nut-meal-kcal">' + total.kcal + ' ккал</div>';
    html += '</div>';
    html += '<div class="nut-meal-body">';

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      html += '<div class="nut-item">';
      html += '<div style="flex:1;min-width:0">';
      html += '<div class="ni-name">' + esc(it.name) + ' <span class="ni-grams">' + (it.grams ? it.grams + ' г' : '') + '</span></div>';
      html += '</div>';
      html += '<div class="ni-kcal">' + Math.round(it.kcal || 0) + '</div>';
      html += '<div class="ni-actions">';
      html += '<button onclick="event.stopPropagation();NutritionModule.openEditMeal(\'' + esc(it.id) + '\')" aria-label="Редактировать"><i class="ph ph-pencil-simple"></i></button>';
      html += '<button class="danger" onclick="event.stopPropagation();NutritionModule.deleteMeal(\'' + esc(it.id) + '\')" aria-label="Удалить"><i class="ph ph-trash"></i></button>';
      html += '</div></div>';
    }
    html += '<button class="nut-add-btn" onclick="NutritionModule.openAddFood(\'' + esc(type.id) + '\')"><i class="ph ph-plus-circle"></i> Добавить</button>';
    html += '</div></div>';
    return html;
  },

  /* ---------- КОЛЬЦО ---------- */
  _drawRing: function(percent) {
    var canvas = document.getElementById('nutRing');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W = canvas.width, H = canvas.height;
    var cx = W / 2, cy = H / 2;
    var r = Math.min(W, H) / 2 - 14;
    var lw = 14;

    ctx.clearRect(0, 0, W, H);

    // Фон
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = lw;
    ctx.stroke();

    // Прогресс
    var p = Math.min(150, Math.max(0, percent)) / 100;
    var startAngle = -Math.PI / 2;
    var endAngle = startAngle + Math.PI * 2 * Math.min(1, p);
    if (p > 1) endAngle = startAngle + Math.PI * 2; // перебор — полное кольцо

    if (p > 0) {
      var grad = ctx.createLinearGradient(0, 0, W, H);
      if (p >= 1.2) { grad.addColorStop(0, '#f87171'); grad.addColorStop(1, '#ef4444'); }
      else if (p >= 1) { grad.addColorStop(0, '#fbbf24'); grad.addColorStop(1, '#f59e0b'); }
      else { grad.addColorStop(0, '#d4af37'); grad.addColorStop(1, '#f4d03f'); }

      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.strokeStyle = grad;
      ctx.lineWidth = lw;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  },

  /* ---------- НАВИГАЦИЯ ПО ДАТЕ ---------- */
  changeDay: function(delta) {
    var d = new Date(this._state.currentDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    this._state.currentDate = this._formatDate(d);
    this.createNutritionScreen();
  },

  /* ---------- РЕДАКТИРОВАНИЕ ЦЕЛИ ---------- */
  openGoalModal: function() {
    var esc = this._esc;
    var goal = this.getGoal();
    var old = document.getElementById('nutGoalModal');
    if (old) old.remove();

    var modal = document.createElement('div');
    modal.className = 'nut-modal';
    modal.id = 'nutGoalModal';
    modal.innerHTML =
      '<div class="nut-modal-content" style="max-width:400px">' +
        '<button style="float:right;background:transparent;border:none;color:var(--text-secondary);font-size:1.5em;cursor:pointer" onclick="document.getElementById(\'nutGoalModal\').remove()"><i class="ph ph-x"></i></button>' +
        '<h2 style="font-family:var(--font-display);color:var(--accent-gold);margin-top:0"><i class="ph ph-target"></i> Дневная норма</h2>' +
        '<div class="nut-form-row"><div class="nf"><label>Калории (ккал)</label><input type="number" id="goalKcal" min="500" max="10000" value="' + goal.kcal + '"></div></div>' +
        '<div class="nut-form-row"><div class="nf"><label>Белки (г)</label><input type="number" id="goalP" min="0" max="500" value="' + goal.protein + '"></div>' +
          '<div class="nf"><label>Жиры (г)</label><input type="number" id="goalF" min="0" max="500" value="' + goal.fat + '"></div>' +
          '<div class="nf"><label>Углеводы (г)</label><input type="number" id="goalC" min="0" max="1000" value="' + goal.carbs + '"></div></div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">' +
          '<button class="btn btn-secondary" onclick="document.getElementById(\'nutGoalModal\').remove()">Отмена</button>' +
          '<button class="btn btn-primary" onclick="NutritionModule.saveGoalFromModal()"><i class="ph ph-floppy-disk"></i> Сохранить</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
  },

  saveGoalFromModal: function() {
    var k = parseInt(document.getElementById('goalKcal').value, 10) || 0;
    var p = parseInt(document.getElementById('goalP').value, 10) || 0;
    var f = parseInt(document.getElementById('goalF').value, 10) || 0;
    var c = parseInt(document.getElementById('goalC').value, 10) || 0;
    if (k < 500) { if (typeof Notify !== 'undefined') Notify.warn('Калорий должно быть ≥ 500'); return; }
    this.saveGoal({ kcal: k, protein: p, fat: f, carbs: c });
    var m = document.getElementById('nutGoalModal');
    if (m) m.remove();
    this.createNutritionScreen();
    if (typeof Notify !== 'undefined') Notify.success('Норма обновлена');
  },

  /* ---------- ДОБАВЛЕНИЕ ЕДЫ ---------- */
  openAddFood: function(mealType) {
    this._state.addingToMealType = mealType;
    this._state.editingMealId = null;
    var esc = this._esc;
    var old = document.getElementById('nutAddModal');
    if (old) old.remove();

    var modal = document.createElement('div');
    modal.className = 'nut-modal';
    modal.id = 'nutAddModal';
    modal.innerHTML =
      '<div class="nut-modal-content">' +
        '<button style="float:right;background:transparent;border:none;color:var(--text-secondary);font-size:1.5em;cursor:pointer" onclick="document.getElementById(\'nutAddModal\').remove()"><i class="ph ph-x"></i></button>' +
        '<h2 style="font-family:var(--font-display);color:var(--accent-gold);margin-top:0"><i class="ph ph-plus-circle"></i> Добавить продукт</h2>' +
        '<input type="text" class="nut-food-search" id="nutFoodSearch" placeholder="Поиск продукта..." oninput="NutritionModule._filterFoods(this.value)">' +
        '<div class="nut-food-list" id="nutFoodList"></div>' +
        '<button class="btn btn-secondary" style="width:100%;margin-bottom:14px" onclick="NutritionModule.openCustomFood()"><i class="ph ph-plus"></i> Добавить свой продукт</button>' +
        '<div id="nutFoodForm" style="display:none;border-top:1px solid var(--border-subtle);padding-top:14px">' +
          '<div class="nut-form-row"><div class="nf"><label>Название</label><input type="text" id="nfName" placeholder="Например: Овсянка"></div></div>' +
          '<div class="nut-form-row">' +
            '<div class="nf"><label>Граммы</label><input type="number" id="nfGrams" value="100" min="1" max="5000"></div>' +
            '<div class="nf"><label>Ккал на 100 г</label><input type="number" id="nfKcal" value="0" min="0" max="900"></div>' +
          '</div>' +
          '<div class="nut-form-row">' +
            '<div class="nf"><label>Белки / 100 г</label><input type="number" id="nfP" value="0" min="0" max="100" step="0.1"></div>' +
            '<div class="nf"><label>Жиры / 100 г</label><input type="number" id="nfF" value="0" min="0" max="100" step="0.1"></div>' +
            '<div class="nf"><label>Углеводы / 100 г</label><input type="number" id="nfC" value="0" min="0" max="100" step="0.1"></div>' +
          '</div>' +
          '<div id="nutPreview" style="font-size:0.8em;opacity:0.7;margin-top:6px"></div>' +
          '<button class="btn btn-primary" style="width:100%;margin-top:12px" onclick="NutritionModule.saveMeal()"><i class="ph ph-check"></i> Добавить</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    this._renderFoodList('');
  },

  _renderFoodList: function(query) {
    var esc = this._esc;
    var list = document.getElementById('nutFoodList');
    if (!list) return;
    var foods = this.getFoods();
    query = (query || '').toLowerCase();
    var filtered = foods.filter(function(f) {
      return !query || (f.name || '').toLowerCase().indexOf(query) !== -1;
    });

    if (filtered.length === 0) {
      list.innerHTML = '<div class="nut-empty"><i class="ph ph-magnifying-glass" style="font-size:1.5em;display:block;margin-bottom:6px;color:var(--accent-gold)"></i>Ничего не найдено</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < filtered.length; i++) {
      var f = filtered[i];
      html += '<div class="nut-food-row" data-food-id="' + esc(f.id) + '" onclick="NutritionModule._selectFood(\'' + esc(f.id) + '\')">';
      html += '<div class="fr-name">' + esc(f.name) + '</div>';
      html += '<div class="fr-kcal">' + Math.round(f.kcal) + ' ккал/100г</div>';
      html += '</div>';
    }
    list.innerHTML = html;
  },

  _filterFoods: function(q) {
    var self = this;
    if (this._state._searchDebounce) clearTimeout(this._state._searchDebounce);
    this._state._searchDebounce = setTimeout(function() { self._renderFoodList(q); }, 100);
  },

  _selectFood: function(foodId) {
    var foods = this.getFoods();
    var food = null;
    for (var i = 0; i < foods.length; i++) if (foods[i].id === foodId) { food = foods[i]; break; }
    if (!food) return;

    // Заполняем форму
    var form = document.getElementById('nutFoodForm');
    if (form) form.style.display = 'block';
    document.getElementById('nfName').value = food.name || '';
    document.getElementById('nfGrams').value = 100;
    document.getElementById('nfKcal').value = food.kcal || 0;
    document.getElementById('nfP').value = food.protein || 0;
    document.getElementById('nfF').value = food.fat || 0;
    document.getElementById('nfC').value = food.carbs || 0;

    // Подсветка
    document.querySelectorAll('.nut-food-row').forEach(function(r) {
      r.classList.toggle('selected', r.getAttribute('data-food-id') === foodId);
    });

    this._updatePreview();
    // Биндинги на пересчёт
    var self = this;
    ['nfGrams','nfKcal','nfP','nfF','nfC'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.oninput = function() { self._updatePreview(); };
    });
  },

  _updatePreview: function() {
    var grams = parseFloat(document.getElementById('nfGrams').value) || 0;
    var k = parseFloat(document.getElementById('nfKcal').value) || 0;
    var p = parseFloat(document.getElementById('nfP').value) || 0;
    var f = parseFloat(document.getElementById('nfF').value) || 0;
    var c = parseFloat(document.getElementById('nfC').value) || 0;
    var factor = grams / 100;
    var preview = document.getElementById('nutPreview');
    if (preview) {
      preview.innerHTML = 'На порцию: <strong style="color:var(--accent-gold)">' + Math.round(k * factor) + ' ккал</strong> · Б ' +
        (p * factor).toFixed(1) + ' · Ж ' + (f * factor).toFixed(1) + ' · У ' + (c * factor).toFixed(1);
    }
  },

  openCustomFood: function() {
    var form = document.getElementById('nutFoodForm');
    if (form) form.style.display = 'block';
    document.querySelectorAll('.nut-food-row').forEach(function(r) { r.classList.remove('selected'); });
    ['nfName','nfKcal','nfP','nfF','nfC'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.value = id === 'nfGrams' ? '100' : '0';
    });
    document.getElementById('nfGrams').value = 100;
    document.getElementById('nfName').focus();
    this._updatePreview();
  },

  saveMeal: function() {
    var nameEl = document.getElementById('nfName');
    if (!nameEl) return;
    var name = nameEl.value.trim();
    if (!name) { if (typeof Notify !== 'undefined') Notify.warn('Укажи название'); return; }

    var grams = parseFloat(document.getElementById('nfGrams').value) || 0;
    if (grams <= 0) { if (typeof Notify !== 'undefined') Notify.warn('Граммы > 0'); return; }

    var kPer100 = parseFloat(document.getElementById('nfKcal').value) || 0;
    var pPer100 = parseFloat(document.getElementById('nfP').value) || 0;
    var fPer100 = parseFloat(document.getElementById('nfF').value) || 0;
    var cPer100 = parseFloat(document.getElementById('nfC').value) || 0;
    var factor = grams / 100;

    var entry = {
      id: this._uid(),
      type: this._state.addingToMealType || 'snack',
      name: name,
      grams: grams,
      kcal: Math.round(kPer100 * factor),
      protein: Math.round(pPer100 * factor * 10) / 10,
      fat: Math.round(fPer100 * factor * 10) / 10,
      carbs: Math.round(cPer100 * factor * 10) / 10,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    };

    // Сохраняем продукт в справочник, если такого нет
    var foods = this.getFoods();
    var exists = false;
    for (var i = 0; i < foods.length; i++) {
      if (foods[i].name.toLowerCase() === name.toLowerCase()) { exists = true; break; }
    }
    if (!exists) {
      foods.push({
        id: 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: name,
        kcal: kPer100, protein: pPer100, fat: fPer100, carbs: cPer100
      });
      this.saveFoods(foods);
    }

    var dateStr = this._state.currentDate;
    var day = this.getDay(dateStr);
    if (!Array.isArray(day.meals)) day.meals = [];

    var editingId = this._state.editingMealId;
    if (editingId) {
      // Редактирование — заменяем запись
      for (var j = 0; j < day.meals.length; j++) {
        if (day.meals[j].id === editingId) {
          entry.id = editingId;
          entry.type = day.meals[j].type;
          day.meals[j] = entry;
          break;
        }
      }
    } else {
      day.meals.push(entry);
    }

    this.saveDay(dateStr, day);
    var modal = document.getElementById('nutAddModal');
    if (modal) modal.remove();
    this._state.addingToMealType = null;
    this._state.editingMealId = null;
    this.createNutritionScreen();
    if (typeof Notify !== 'undefined') Notify.success(editingId ? 'Запись обновлена' : 'Добавлено');
  },

  openEditMeal: function(mealId) {
    var esc = this._esc;
    var day = this.getDay(this._state.currentDate);
    var meal = null;
    if (Array.isArray(day.meals)) {
      for (var i = 0; i < day.meals.length; i++) {
        if (day.meals[i].id === mealId) { meal = day.meals[i]; break; }
      }
    }
    if (!meal) return;

    this._state.editingMealId = mealId;
    this._state.addingToMealType = meal.type;

    var old = document.getElementById('nutAddModal');
    if (old) old.remove();

    var modal = document.createElement('div');
    modal.className = 'nut-modal';
    modal.id = 'nutAddModal';
    modal.innerHTML =
      '<div class="nut-modal-content" style="max-width:400px">' +
        '<button style="float:right;background:transparent;border:none;color:var(--text-secondary);font-size:1.5em;cursor:pointer" onclick="document.getElementById(\'nutAddModal\').remove();NutritionModule._state.editingMealId=null"><i class="ph ph-x"></i></button>' +
        '<h2 style="font-family:var(--font-display);color:var(--accent-gold);margin-top:0"><i class="ph ph-pencil-simple"></i> Редактировать</h2>' +
        '<div class="nut-form-row"><div class="nf"><label>Название</label><input type="text" id="nfName" value="' + esc(meal.name) + '"></div></div>' +
        '<div class="nut-form-row">' +
          '<div class="nf"><label>Граммы</label><input type="number" id="nfGrams" value="' + (meal.grams || 100) + '" min="1" max="5000"></div>' +
          '<div class="nf"><label>Ккал (всего)</label><input type="number" id="nfKcal" value="' + (meal.kcal || 0) + '" min="0" max="9000"></div>' +
        '</div>' +
        '<div class="nut-form-row">' +
          '<div class="nf"><label>Белки (всего)</label><input type="number" id="nfP" value="' + (meal.protein || 0) + '" min="0" max="500" step="0.1"></div>' +
          '<div class="nf"><label>Жиры (всего)</label><input type="number" id="nfF" value="' + (meal.fat || 0) + '" min="0" max="500" step="0.1"></div>' +
          '<div class="nf"><label>Углеводы (всего)</label><input type="number" id="nfC" value="' + (meal.carbs || 0) + '" min="0" max="1000" step="0.1"></div>' +
        '</div>' +
        '<button class="btn btn-primary" style="width:100%;margin-top:12px" onclick="NutritionModule.saveEditMeal(\'' + esc(mealId) + '\')"><i class="ph ph-check"></i> Сохранить</button>' +
      '</div>';
    document.body.appendChild(modal);
  },

  saveEditMeal: function(mealId) {
    var day = this.getDay(this._state.currentDate);
    if (!Array.isArray(day.meals)) return;
    var name = (document.getElementById('nfName').value || '').trim();
    if (!name) { if (typeof Notify !== 'undefined') Notify.warn('Укажи название'); return; }

    for (var i = 0; i < day.meals.length; i++) {
      if (day.meals[i].id === mealId) {
        day.meals[i].name = name;
        day.meals[i].grams = parseFloat(document.getElementById('nfGrams').value) || 100;
        day.meals[i].kcal = parseFloat(document.getElementById('nfKcal').value) || 0;
        day.meals[i].protein = parseFloat(document.getElementById('nfP').value) || 0;
        day.meals[i].fat = parseFloat(document.getElementById('nfF').value) || 0;
        day.meals[i].carbs = parseFloat(document.getElementById('nfC').value) || 0;
        break;
      }
    }
    this.saveDay(this._state.currentDate, day);
    var modal = document.getElementById('nutAddModal');
    if (modal) modal.remove();
    this._state.editingMealId = null;
    this.createNutritionScreen();
    if (typeof Notify !== 'undefined') Notify.success('Обновлено');
  },

  deleteMeal: function(mealId) {
    if (!confirm('Удалить запись?')) return;
    var day = this.getDay(this._state.currentDate);
    if (!Array.isArray(day.meals)) return;
    day.meals = day.meals.filter(function(m) { return m.id !== mealId; });
    this.saveDay(this._state.currentDate, day);
    this.createNutritionScreen();
  },

  copyFromYesterday: function() {
    var y = new Date(this._state.currentDate + 'T00:00:00');
    y.setDate(y.getDate() - 1);
    var yStr = this._formatDate(y);
    var yDay = this.getDay(yStr);
    if (!yDay || !Array.isArray(yDay.meals) || yDay.meals.length === 0) return;

    var day = this.getDay(this._state.currentDate);
    if (!Array.isArray(day.meals)) day.meals = [];
    for (var i = 0; i < yDay.meals.length; i++) {
      var copy = Object.assign({}, yDay.meals[i]);
      copy.id = this._uid();
      day.meals.push(copy);
    }
    this.saveDay(this._state.currentDate, day);
    this.createNutritionScreen();
    if (typeof Notify !== 'undefined') Notify.success('Скопировано: ' + yDay.meals.length);
  },

  /* ---------- ЭКСПОРТ ---------- */
  exportCsv: function() {
    var day = this.getDay(this._state.currentDate);
    if (!day || !Array.isArray(day.meals) || day.meals.length === 0) {
      if (typeof Notify !== 'undefined') Notify.warn('Нет данных');
      return;
    }
    var rows = ['Дата;Приём;Продукт;Граммы;Ккал;Белки;Жиры;Углеводы'];
    for (var i = 0; i < day.meals.length; i++) {
      var m = day.meals[i];
      var typeLabel = m.type;
      for (var t = 0; t < this.MEAL_TYPES.length; t++) if (this.MEAL_TYPES[t].id === m.type) typeLabel = this.MEAL_TYPES[t].label;
      rows.push([
        this._state.currentDate,
        typeLabel,
        String(m.name || '').replace(/;/g, ','),
        m.grams || '',
        m.kcal || 0,
        m.protein || 0,
        m.fat || 0,
        m.carbs || 0
      ].join(';'));
    }
    var csv = '\uFEFF' + rows.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'nutrition_' + this._state.currentDate + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    if (typeof Notify !== 'undefined') Notify.success('CSV экспортирован');
  }
};

window.NutritionModule = NutritionModule;
module.exports = NutritionModule;