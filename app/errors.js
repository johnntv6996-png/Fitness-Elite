// app/errors.js
// Ловит непойманные ошибки и промисы, пишет в Logger и localStorage.

(function() {
  'use strict';

  var STORAGE_KEY = 'ft_error_log';
  var MAX_ERRORS = 50;

  function safeLog(message, type) {
    try {
      if (typeof window.Logger !== 'undefined' && window.Logger.log) {
        window.Logger.log(message, type || 'error');
      } else {
        // Logger ещё не загружен — хотя бы в консоль
        console.error(message);
      }
    } catch (e) {
      // Ничего не делаем — мы внутри обработчика ошибок
    }
  }

  function saveError(entry) {
    try {
      var list = [];
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try { list = JSON.parse(raw) || []; } catch (e) { list = []; }
      }
      list.push(entry);
      if (list.length > MAX_ERRORS) list = list.slice(-MAX_ERRORS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      // localStorage может быть недоступен — игнорируем
    }
  }

  function makeEntry(source, message, extra) {
    return {
      timestamp: Date.now(),
      time: new Date().toISOString(),
      source: source,
      message: String(message == null ? '' : message),
      extra: extra || null,
      url: location.href,
      userAgent: navigator.userAgent
    };
  }

  window.addEventListener('error', function(event) {
    // Ошибки загрузки ресурсов (картинки, скрипты) приходят сюда же,
    // но у них event.message пустой, а event.target — элемент.
    var target = event.target;
    if (target && target !== window && (target.tagName === 'SCRIPT' || target.tagName === 'LINK' || target.tagName === 'IMG')) {
      var src = target.src || target.href || '(unknown)';
      var msg = 'Не удалось загрузить ресурс: ' + src;
      safeLog(msg, 'warn');
      saveError(makeEntry('resource', msg, { tag: target.tagName }));
      return;
    }

    var message = event.message || 'Неизвестная ошибка';
    var where = (event.filename || '') + (event.lineno ? ':' + event.lineno : '') + (event.colno ? ':' + event.colno : '');
    var full = message + (where ? ' (' + where + ')' : '');
    safeLog(full, 'error');
    saveError(makeEntry('error', full, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error && event.error.stack ? event.error.stack : null
    }));
  });

  window.addEventListener('unhandledrejection', function(event) {
    var reason = event.reason;
    var message = 'Необработанный промис: ' + (reason && reason.message ? reason.message : String(reason));
    safeLog(message, 'error');
    saveError(makeEntry('unhandledrejection', message, {
      stack: reason && reason.stack ? reason.stack : null
    }));
  });

  // Публичный API: получить и очистить сохранённые ошибки
  window.ErrorLog = {
    getAll: function() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) { return []; }
    },
    clear: function() {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    }
  };
})();