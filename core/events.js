// core/events.js
// Простая шина событий. Позволяет модулям общаться, не зная друг о друге.
// Пример:
//   Events.on('history:changed', function() { ... });
//   Events.emit('history:changed', { date: '2026-11-10' });

(function() {
  'use strict';

  var listeners = {};   // { eventName: [fn, fn, ...] }
  var debug = false;

  function on(eventName, fn) {
    if (typeof fn !== 'function') return function() {};
    if (!listeners[eventName]) listeners[eventName] = [];
    listeners[eventName].push(fn);

    // Возвращаем функцию отписки — удобно для уборки
    return function off() {
      offEvent(eventName, fn);
    };
  }

  function once(eventName, fn) {
    var off = on(eventName, function handler(payload) {
      off();
      fn(payload);
    });
    return off;
  }

  function offEvent(eventName, fn) {
    var arr = listeners[eventName];
    if (!arr) return;
    var idx = arr.indexOf(fn);
    if (idx !== -1) arr.splice(idx, 1);
    if (arr.length === 0) delete listeners[eventName];
  }

  function emit(eventName, payload) {
    var arr = listeners[eventName];
    if (debug) {
      console.log('[Events] ' + eventName, payload, arr ? '(' + arr.length + ' listeners)' : '(no listeners)');
    }
    if (!arr || arr.length === 0) return;

    // Копируем, чтобы слушатель мог отписаться во время обработки
    var snapshot = arr.slice();
    for (var i = 0; i < snapshot.length; i++) {
      try {
        snapshot[i](payload);
      } catch (e) {
        if (window.Logger && window.Logger.log) {
          window.Logger.log('Events: ошибка в обработчике "' + eventName + '": ' + e.message, 'error');
        } else {
          console.error('Events: ошибка в обработчике "' + eventName + '":', e);
        }
      }
    }
  }

  function clear(eventName) {
    if (eventName) delete listeners[eventName];
    else listeners = {};
  }

  function count(eventName) {
    if (eventName) return (listeners[eventName] || []).length;
    var total = 0;
    for (var k in listeners) total += listeners[k].length;
    return total;
  }

  window.Events = {
    on: on,
    once: once,
    off: offEvent,
    emit: emit,
    clear: clear,
    count: count,
    // Включает/выключает отладочный вывод в консоль
    setDebug: function(v) { debug = !!v; }
  };
})();