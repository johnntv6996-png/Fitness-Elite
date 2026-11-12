// modules/core.js
const CoreModule = {
  /* =========================================================
     1. НИЗКОУРОВНЕВОЕ ХРАНИЛИЩЕ (localStorage)
     ========================================================= */
  storage: {
    _prefix: 'ft_',
    get: function(key) {
      try {
        var raw = localStorage.getItem(this._prefix + key);
        return raw === null ? null : JSON.parse(raw);
      } catch (e) {
        if (typeof Logger !== 'undefined') Logger.log('Storage parse error: ' + key, 'warn');
        return null;
      }
    },
    set: function(key, value) {
      try { localStorage.setItem(this._prefix + key, JSON.stringify(value)); return true; }
      catch (e) {
        if (typeof Logger !== 'undefined') Logger.log('Storage write error: ' + key, 'error');
        return false;
      }
    },
    remove: function(key) { localStorage.removeItem(this._prefix + key); }
  },

  /* =========================================================
     2. УТИЛИТЫ
     ========================================================= */
  utils: {
    escapeHtml: function(text) {
      if (text == null) return '';
      return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    formatLocalDate: function(date) {
      date = date || new Date();
      var y = date.getFullYear();
      var m = String(date.getMonth() + 1).padStart(2, '0');
      var d = String(date.getDate()).padStart(2, '0');
      return y + '-' + m + '-' + d;
    },
    getTodayIndex: function() { return (new Date().getDay() + 6) % 7; },
    getDayName: function(idx) {
      return ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'][idx];
    },
    renderStars: function(count) {
      var s = '';
      for (var i = 1; i <= 5; i++) {
        s += i <= count
          ? '<i class="ph-fill ph-star" style="color:var(--accent-gold)"></i>'
          : '<i class="ph ph-star" style="color:var(--text-secondary);opacity:0.3"></i>';
      }
      return s;
    },
    getLevelIcon: function(level) {
      if (level >= 50) return 'ph-diamond';
      if (level >= 20) return 'ph-crown';
      if (level >= 10) return 'ph-trophy';
      if (level >= 5) return 'ph-star-four';
      return 'ph-star';
    },
    xpForLevel: function(level) {
      return Math.floor(100 * Math.pow(1.2, Math.max(0, (level || 1) - 1)));
    },
    cumulativeXpForLevel: function(level) {
      var total = 0;
      for (var i = 1; i < (level || 1); i++) total += this.xpForLevel(i);
      return total;
    },
    totalXp: function(stats) {
      stats = stats || {};
      var level = stats.level || 1;
      var xp = stats.xp || 0;
      return this.cumulativeXpForLevel(level) + xp;
    },
    generateId: function(prefix) {
      prefix = prefix || 'id';
      var rnd = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
      return prefix + '_' + Date.now() + '_' + rnd;
    },
    debounce: function(fn, wait) {
      var t = null;
      return function() {
        var args = arguments, self = this;
        clearTimeout(t);
        t = setTimeout(function() { fn.apply(self, args); }, wait || 300);
      };
    },
    throttleRaf: function(fn) {
      var scheduled = false, lastArgs = null, self = null;
      return function() {
        lastArgs = arguments; self = this;
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(function() {
          scheduled = false;
          fn.apply(self, lastArgs);
        });
      };
    }
  },

  /* =========================================================
     3. ЕДИНЫЙ СЛОЙ ДАННЫХ (data)
     — все модули читают/пишут только через него
     ========================================================= */
  data: {
    SCHEMA_VERSION: 2,

    _defaults: {
      stats: { yes:0, later:0, no:0, xp:0, level:1, streak:0, lastWorkoutDate:null, lastLaterDate:null },
      settings: {},
      history: [],
      plan: [],
      db: [],
      categories: [],
      survey_config: null,
      unlocked_achievements: [],
      user_name: '',
      user_avatar: null,
      season: null,
      seasons_history: []
    },

    migrate: function() {
      var current = CoreModule.storage.get('schema_version') || 1;
      if (current >= this.SCHEMA_VERSION) return;
      if (typeof Logger !== 'undefined') Logger.log('Миграция схемы: v' + current + ' → v' + this.SCHEMA_VERSION, 'info');

      if (current < 2) {
        // Миграция history: гарантируем details[].sets — массив, добавляем timestamp
        var history = CoreModule.storage.get('history') || [];
        for (var i = 0; i < history.length; i++) {
          var day = history[i];
          if (!day.details) day.details = [];
          for (var j = 0; j < day.details.length; j++) {
            if (!day.details[j].sets) day.details[j].sets = [];
            if (!day.details[j].partialReps) day.details[j].partialReps = [];
          }
          if (!day.timestamp) day.timestamp = Date.now();
        }
        CoreModule.storage.set('history', history);
      }

      CoreModule.storage.set('schema_version', this.SCHEMA_VERSION);
    },

    _normalizeStats: function(s) {
      var d = this._defaults.stats;
      var out = {};
      for (var k in d) out[k] = (s && s[k] !== undefined) ? s[k] : d[k];
      return out;
    },
    _normalizeHistory: function(h) {
      if (!Array.isArray(h)) return [];
      for (var i = 0; i < h.length; i++) {
        if (!h[i].details) h[i].details = [];
        if (!h[i].exercises) h[i].exercises = [];
        if (!h[i].timestamp) h[i].timestamp = Date.now();
      }
      return h;
    },

    get: function(key) {
      var raw = CoreModule.storage.get(key);
      if (raw == null) return this._defaults[key] !== undefined ? this._clone(this._defaults[key]) : null;
      if (key === 'stats') return this._normalizeStats(raw);
      if (key === 'history') return this._normalizeHistory(raw);
      return raw;
    },
    set: function(key, value) {
      return CoreModule.storage.set(key, value);
    },
    _clone: function(v) {
      return JSON.parse(JSON.stringify(v));
    }
  },

  /* =========================================================
     4. ИСТОРИЯ (history) — единая точка мутаций
     ========================================================= */
  history: {
    _cache: null,
    _cacheKey: '',

    get: function() {
      return CoreModule.data.get('history');
    },
    save: function(h) {
      CoreModule.data.set('history', h);
      this.invalidate();
    },
    invalidate: function() {
      this._cache = null;
      this._cacheKey = '';
    },
    getMap: function(history) {
      history = history || this.get();
      var last = history.length > 0 ? history[history.length - 1] : null;
      var key = history.length + '|' + (last ? last.date + '|' + (last.timestamp || 0) : '');
      if (this._cache && this._cacheKey === key) return this._cache;
      var map = {};
      for (var i = 0; i < history.length; i++) {
        map[history[i].date] = history[i];
      }
      this._cache = map;
      this._cacheKey = key;
      return map;
    },
    getDay: function(dateStr) {
      var map = this.getMap();
      return map[dateStr] || null;
    },
    updateDay: function(dateStr, mutator) {
      var history = this.get();
      var day = null;
      for (var i = 0; i < history.length; i++) {
        if (history[i].date === dateStr) { day = history[i]; break; }
      }
      if (!day) {
        day = {
          date: dateStr,
          dayName: CoreModule.utils.getDayName(CoreModule.utils.getTodayIndex()),
          muscleGroup: '',
          exercises: [], details: [], duration: 0,
          timestamp: Date.now()
        };
        history.push(day);
      }
      mutator(day);
      day.timestamp = Date.now(); // ВСЕГДА обновляем timestamp
      this.save(history);
      return day;
    },
    removeDay: function(dateStr) {
      var history = this.get().filter(function(d) { return d.date !== dateStr; });
      this.save(history);
    }
  },

  /* =========================================================
     5. XP-ДВИЖОК — единая точка начисления
     ========================================================= */
  xp: {
    AWARDS: {
      SET_DONE: 5,
      SET_PARTIAL: 3,
      SET_MISSED: 0,
      EXERCISE_DONE: 15,
      DAY_DONE: 20,
      SURVEY_DONE: 10,
      ACHIEVEMENT_UNLOCK: 50,
      SEASON_ACHIEVEMENT: 150
    },

    getStats: function() {
      return CoreModule.data.get('stats');
    },
    award: function(amount, meta) {
      if (!amount || amount <= 0) return { leveledUp: false };
      var stats = this.getStats();
      stats.xp = (stats.xp || 0) + amount;
      var leveledUp = false;
      var xpNeeded = CoreModule.utils.xpForLevel(stats.level);
      while (stats.xp >= xpNeeded) {
        stats.xp -= xpNeeded;
        stats.level++;
        leveledUp = true;
        xpNeeded = CoreModule.utils.xpForLevel(stats.level);
      }
      CoreModule.data.set('stats', stats);
      if (typeof refreshHeaderAfterXP === 'function') refreshHeaderAfterXP();
      if (leveledUp && typeof showAchievementToast === 'function') {
        showAchievementToast('Новый уровень ' + stats.level + '!', 'Ты достиг уровня ' + stats.level, 'ph-star');
      }
      if (typeof AchievementsModule !== 'undefined' && AchievementsModule.checkAchievements) {
        AchievementsModule.checkAchievements();
      }
      return { leveledUp: leveledUp, level: stats.level, xp: stats.xp };
    }
  },

  /* =========================================================
     6. КОНТЕКСТНОЕ МЕНЮ
     ========================================================= */
  contextMenu: {
    _el: null,
    _backdrop: null,
    open: function(x, y, items, meta) {
      this.close();
      var el = document.createElement('div');
      el.className = 'ctx-menu';
      el.style.cssText = 'position:fixed;z-index:10000;background:var(--bg-secondary);border:1px solid var(--border-gold);border-radius:10px;padding:6px;min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,0.5)';
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.separator) {
          var sep = document.createElement('div');
          sep.style.cssText = 'height:1px;background:var(--border-subtle);margin:4px 0';
          el.appendChild(sep); continue;
        }
        var btn = document.createElement('button');
        btn.style.cssText = 'display:flex;width:100%;align-items:center;gap:10px;padding:10px 12px;background:transparent;border:none;border-radius:8px;color:' + (it.danger ? 'var(--accent-error)' : 'var(--text-primary)') + ';cursor:pointer;font-family:var(--font-primary);font-size:0.9em;text-align:left';
        btn.innerHTML = '<i class="ph ' + (it.icon || 'ph-dot') + '"></i> ' + CoreModule.utils.escapeHtml(it.label);
        if (it.disabled) { btn.disabled = true; btn.style.opacity = '0.4'; }
        (function(action, m) {
          btn.onclick = function() { CoreModule.contextMenu.close(); if (typeof action === 'function') action(m); };
        })(it.action, meta);
        el.appendChild(btn);
      }
      var backdrop = document.createElement('div');
      backdrop.style.cssText = 'position:fixed;inset:0;z-index:9999';
      backdrop.onclick = function() { CoreModule.contextMenu.close(); };
      document.body.appendChild(backdrop);
      document.body.appendChild(el);
      var vw = window.innerWidth, vh = window.innerHeight;
      var rect = el.getBoundingClientRect();
      if (x + rect.width > vw) x = vw - rect.width - 8;
      if (y + rect.height > vh) y = vh - rect.height - 8;
      el.style.left = Math.max(8, x) + 'px';
      el.style.top = Math.max(8, y) + 'px';
      this._el = el;
      this._backdrop = backdrop;
    },
    close: function() {
      if (this._el) { this._el.remove(); this._el = null; }
      if (this._backdrop) { this._backdrop.remove(); this._backdrop = null; }
    }
  },

  /* =========================================================
     7. ФАБРИКА МОДАЛОК
     ========================================================= */
  modal: {
    _stack: [],
    open: function(opts) {
      opts = opts || {};
      var id = opts.id || ('modal_' + Date.now());
      var existing = document.getElementById(id);
      if (existing) existing.remove();

      var overlay = document.createElement('div');
      overlay.id = id;
      overlay.className = 'ex-modal';
      overlay.style.zIndex = 2000 + this._stack.length * 10;

      var content = document.createElement('div');
      content.className = 'ex-modal-content';
      if (opts.maxWidth) content.style.maxWidth = opts.maxWidth;

      if (opts.title) {
        var h = document.createElement('h2');
        h.style.cssText = 'font-family:var(--font-display);color:var(--accent-gold);margin-top:0;display:flex;align-items:center;gap:10px';
        h.innerHTML = (opts.icon ? '<i class="ph ' + opts.icon + '"></i> ' : '') + CoreModule.utils.escapeHtml(opts.title);
        content.appendChild(h);
      }

      var closeBtn = document.createElement('button');
      closeBtn.innerHTML = '<i class="ph ph-x"></i>';
      closeBtn.setAttribute('aria-label', 'Закрыть');
      closeBtn.style.cssText = 'float:right;background:transparent;border:none;color:var(--text-secondary);font-size:1.5em;cursor:pointer';
      closeBtn.onclick = function() { CoreModule.modal.close(id); };
      content.appendChild(closeBtn);

      if (opts.body) {
        if (typeof opts.body === 'string') {
          var tmp = document.createElement('div');
          tmp.innerHTML = opts.body;
          while (tmp.firstChild) content.appendChild(tmp.firstChild);
        } else {
          content.appendChild(opts.body);
        }
      }

      overlay.appendChild(content);
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) CoreModule.modal.close(id);
      });
      document.body.appendChild(overlay);
      this._stack.push({ id: id, el: overlay, onClose: opts.onClose });
      return { id: id, el: overlay, content: content };
    },
    close: function(id) {
      var idx = -1;
      for (var i = 0; i < this._stack.length; i++) if (this._stack[i].id === id) { idx = i; break; }
      if (idx === -1) return;
      var item = this._stack[idx];
      if (item.el && item.el.parentNode) item.el.remove();
      if (typeof item.onClose === 'function') item.onClose();
      this._stack.splice(idx, 1);
    },
    closeAll: function() {
      for (var i = this._stack.length - 1; i >= 0; i--) this.close(this._stack[i].id);
    }
  },

  /* =========================================================
     8. НАВИГАЦИЯ И РЕНДЕРЫ ЭКРАНОВ
     ========================================================= */
  screenRenderers: {},
  screenState: {
    _store: {},
    save: function(screenId, state) { this._store[screenId] = state; },
    restore: function(screenId) { return this._store[screenId] || null; }
  },
  registerScreen: function(screenId, renderFn) {
    this.screenRenderers[screenId] = renderFn;
  },
  addNavButton: function(label, screenId, icon) {
    icon = icon || '<i class="ph ph-circle"></i>';
    var menu = document.getElementById('sidebarMenu');
    if (!menu) return;
    var existing = menu.querySelector('[data-screen="' + screenId + '"]');
    if (existing) return;
    var item = document.createElement('div');
    item.className = 'sidebar-item';
    item.setAttribute('data-screen', screenId);
    item.innerHTML = icon + ' ' + this.utils.escapeHtml(label);
    item.onclick = function() { CoreModule.navigate(screenId); };
    menu.appendChild(item);
  },
  navigate: function(screenId) {
    if (screenId === 'dev') {
      if (typeof switchMode === 'function') switchMode('dev');
      document.querySelectorAll('.sidebar-item').forEach(function(b) { b.classList.remove('active'); });
      var devItem = document.querySelector('.sidebar-item[data-screen="dev"]');
      if (devItem) devItem.classList.add('active');
      return;
    }
    document.querySelectorAll('#userInterface .screen').forEach(function(s) { s.classList.remove('active'); });
    var target = document.getElementById('screen-' + screenId);
    if (target) { target.classList.add('active'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    if (typeof switchMode === 'function') switchMode('user');
    document.querySelectorAll('.sidebar-item').forEach(function(b) { b.classList.remove('active'); });
    var activeBtn = document.querySelector('.sidebar-item[data-screen="' + screenId + '"]');
    if (activeBtn) activeBtn.classList.add('active');
    if (typeof toggleSidebar === 'function' && document.getElementById('sidebar').classList.contains('active')) toggleSidebar();
    if (typeof updateSidebarProfile === 'function') updateSidebarProfile();
    var renderer = this.screenRenderers[screenId];
    if (renderer) {
      try { renderer(); } catch (e) {
        if (typeof Logger !== 'undefined') Logger.log('Render error ' + screenId + ': ' + e.message, 'error');
      }
    }
  },

  /* =========================================================
     9. ИНИЦИАЛИЗАЦИЯ
     ========================================================= */
  init: function() {
    console.log('Core module initialized');
    if (typeof Logger !== 'undefined') Logger.log('Ядро системы загружено', 'info');
    window.Core = this;
    window.FTStorage = this.storage;
    window.FTUtils = this.utils;
    window.FTNavigate = this.navigate.bind(this);

    this.data.migrate();

    window.shouldShowHints = function() {
      try {
        var settings = JSON.parse(localStorage.getItem('ft_settings')) || {};
        return !settings.disableHints;
      } catch (e) { return true; }
    };
  }
};

window.CoreModule = CoreModule;
window.Core = CoreModule;
if (typeof module !== 'undefined' && module.exports) module.exports = CoreModule;