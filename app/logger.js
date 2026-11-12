// app/logger.js
// Журнал событий. Пишет в консоль браузера и хранит последние записи в памяти.

(function() {
  'use strict';

  var MAX_LOGS = 500;

  var Logger = {
    logs: [],

    log: function(message, type) {
      type = type || 'info';
      var timestamp = new Date().toLocaleTimeString();
      var entry = { timestamp: timestamp, message: String(message), type: type };

      this.logs.push(entry);
      if (this.logs.length > MAX_LOGS) this.logs.shift();

      // Дублируем в консоль браузера (F12)
      if (type === 'error') console.error('[' + timestamp + '] ' + message);
      else if (type === 'warn') console.warn('[' + timestamp + '] ' + message);
      else console.log('[' + timestamp + '] ' + message);

      // Если на странице есть блок логов — обновляем его
      this.renderConsole();
    },

    renderConsole: function() {
      var container = document.getElementById('consoleLog');
      if (!container) return;
      var html = '';
      for (var i = 0; i < this.logs.length; i++) {
        var log = this.logs[i];
        html += '<div class="' + log.type + '">[' + log.timestamp + '] ' + this._esc(log.message) + '</div>';
      }
      container.innerHTML = html;
      container.scrollTop = container.scrollHeight;
    },

    clear: function() {
      this.logs = [];
      this.renderConsole();
    },

    _esc: function(text) {
      if (text == null) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  };

  window.Logger = Logger;
})();