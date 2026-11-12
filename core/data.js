// core/data.js
// Единый слой данных. Все чтения/записи истории, статистики, плана — через него.
// Эмитит события через Events: history:changed, stats:changed, plan:changed, db:changed.

(function() {
  'use strict';

  var KEYS = {
    history: 'history',
    stats: 'stats',
    plan: 'plan',
    db: 'db',
    categories: 'categories',
    surveyConfig: 'survey_config',
    settings: 'settings'
  };

  function storage() {
    return window.FTStorage || window.Core && window.Core.storage;
  }

  function emit(eventName, payload) {
    if (window.Events && window.Events.emit) {
      window.Events.emit(eventName, payload);
    }
  }

  function invalidateCaches() {
    // Core._historyMapCache
    if (window.Core && typeof window.Core.invalidateHistoryMap === 'function') {
      window.Core.invalidateHistoryMap();
    } else if (window.Core) {
      window.Core._historyMapCache = null;
      window.Core._historyMapSourceLength = 0;
      window.Core._historyMapLastDate = '';
    }
    // StatsModule._chartDataCache
    if (window.StatsModule) {
      window.StatsModule._chartDataCache = null;
      window.StatsModule._chartDataCacheKey = null;
    }
  }

  // === История ===
  function getHistory() {
    var s = storage();
    if (!s) return [];
    var h = s.get(KEYS.history);
    return Array.isArray(h) ? h : [];
  }

  function setHistory(history) {
    var s = storage();
    if (!s) return false;
    var ok = s.set(KEYS.history, history || []);
    invalidateCaches();
    emit('history:changed', { count: (history || []).length });
    return ok;
  }

  // Upsert: одна запись на дату. Если есть — обновляем, если нет — добавляем.
  function upsertDayRecord(record) {
    if (!record || !record.date) return false;
    var history = getHistory();
    var idx = -1;
    for (var i = 0; i < history.length; i++) {
      if (history[i].date === record.date) { idx = i; break; }
    }
    if (idx === -1) history.push(record);
    else history[idx] = record;
    history.sort(function(a, b) { return (a.date < b.date) ? -1 : (a.date > b.date) ? 1 : 0; });
    return setHistory(history);
  }

  function getDayRecord(dateStr) {
    var history = getHistory();
    for (var i = 0; i < history.length; i++) {
      if (history[i].date === dateStr) return history[i];
    }
    return null;
  }

  // === Статистика ===
  function getStats() {
    var s = storage();
    if (!s) return { yes: 0, later: 0, no: 0, xp: 0, level: 1, streak: 0 };
    var st = s.get(KEYS.stats) || {};
    if (st.yes === undefined) st.yes = 0;
    if (st.later === undefined) st.later = 0;
    if (st.no === undefined) st.no = 0;
    if (st.xp === undefined) st.xp = 0;
    if (st.level === undefined) st.level = 1;
    if (st.streak === undefined) st.streak = 0;
    return st;
  }

	function setStats(stats) {
		var s = storage();
		if (!s) return false;
		var ok = s.set(KEYS.stats, stats || {});
		emit('stats:changed', stats);   // ← ВОТ ЭТА СТРОКА
		return ok;
	}

  // === План ===
  function getPlan() {
    var s = storage();
    if (!s) return [];
    var p = s.get(KEYS.plan);
    return Array.isArray(p) ? p : [];
  }

  function setPlan(plan) {
    var s = storage();
    if (!s) return false;
    var ok = s.set(KEYS.plan, plan || []);
    emit('plan:changed', plan);
    return ok;
  }

  // === База упражнений ===
  function getDB() {
    var s = storage();
    if (!s) return [];
    var db = s.get(KEYS.db);
    return Array.isArray(db) ? db : [];
  }

  function setDB(db) {
    var s = storage();
    if (!s) return false;
    var ok = s.set(KEYS.db, db || []);
    emit('db:changed', db);
    return ok;
  }

  // === Категории ===
  function getCategories() {
    var s = storage();
    if (!s) return [];
    var c = s.get(KEYS.categories);
    return Array.isArray(c) ? c : [];
  }

  function setCategories(cats) {
    var s = storage();
    if (!s) return false;
    return s.set(KEYS.categories, cats || []);
  }

  // === Конфиг опросов ===
  function getSurveyConfig() {
    var s = storage();
    if (!s) return null;
    return s.get(KEYS.surveyConfig);
  }

  function setSurveyConfig(config) {
    var s = storage();
    if (!s) return false;
    return s.set(KEYS.surveyConfig, config);
  }

  // === Настройки ===
  function getSettings() {
    var s = storage();
    if (!s) return {};
    return s.get(KEYS.settings) || {};
  }

  function setSettings(settings) {
    var s = storage();
    if (!s) return false;
    return s.set(KEYS.settings, settings || {});
  }

  // === Пересчёт производных полей статистики ===
  // Пересчитывает streak и yes из истории. Один источник правды — история.
  function recomputeStatsFromHistory() {
    var history = getHistory();
    var stats = getStats();

    // yes — сколько уникальных дней с хотя бы одним упражнением
    var yes = 0;
    for (var i = 0; i < history.length; i++) {
      var r = history[i];
      if (!r.skipped && r.exercises && r.exercises.length > 0) yes++;
    }
    stats.yes = yes;

    // streak — сколько последних дней подряд (по датам) были тренировки
    var sorted = history.slice().sort(function(a, b) {
      return (a.date < b.date) ? -1 : (a.date > b.date) ? 1 : 0;
    });
    var streak = 0;
    for (var i = sorted.length - 1; i >= 0; i--) {
      var rec = sorted[i];
      if (!rec.skipped && rec.exercises && rec.exercises.length > 0) streak++;
      else break;
    }
    stats.streak = streak;

    setStats(stats);
    return stats;
  }

  // Публичный API
  window.CoreData = {
    getHistory: getHistory,
    setHistory: setHistory,
    upsertDayRecord: upsertDayRecord,
    getDayRecord: getDayRecord,

    getStats: getStats,
    setStats: setStats,
    recomputeStatsFromHistory: recomputeStatsFromHistory,

    getPlan: getPlan,
    setPlan: setPlan,

    getDB: getDB,
    setDB: setDB,

    getCategories: getCategories,
    setCategories: setCategories,

    getSurveyConfig: getSurveyConfig,
    setSurveyConfig: setSurveyConfig,

    getSettings: getSettings,
    setSettings: setSettings,
		    // === Лог XP ===
    getXpLog: function() {
      var s = storage();
      if (!s) return [];
      var log = s.get('xp_log');
      return Array.isArray(log) ? log : [];
    },

    logXP: function(amount, reason, meta) {
      if (!amount || amount === 0) return;
      var s = storage();
      if (!s) return;
      var log = this.getXpLog();
      log.push({
        timestamp: Date.now(),
        date: (window.Core && window.Core.utils && window.Core.utils.formatLocalDate)
          ? window.Core.utils.formatLocalDate(new Date())
          : new Date().toISOString().slice(0, 10),
        amount: amount,
        reason: reason || '',
        meta: meta || null
      });
      // Храним последние 200 записей
      if (log.length > 200) log = log.slice(-200);
      s.set('xp_log', log);
      emit('xp:logged', { amount: amount, reason: reason });
    },

    clearXpLog: function() {
      var s = storage();
      if (!s) return;
      s.remove('xp_log');
      emit('xp:logged', { amount: 0, reason: 'clear' });
    },
  };
})();