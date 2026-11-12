// app/theme.js
// Управление тёмной/светлой темой. Хранит выбор в localStorage (ft_settings.theme).

(function() {
  'use strict';

  var SETTINGS_KEY = 'ft_settings';
  var DEFAULT_THEME = 'dark';

  function readSettings() {
    try {
      var raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? (JSON.parse(raw) || {}) : {};
    } catch (e) {
      return {};
    }
  }

  function writeSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings || {}));
    } catch (e) {}
  }

  function getTheme() {
    var s = readSettings();
    return s.theme === 'light' ? 'light' : DEFAULT_THEME;
  }

  function applyThemeToBody(theme) {
    if (theme === 'light') document.body.classList.add('light-theme');
    else document.body.classList.remove('light-theme');
  }

  function updateButtons(theme) {
    var dark = document.getElementById('themeDarkBtn');
    var light = document.getElementById('themeLightBtn');
    if (dark) dark.classList.toggle('active', theme === 'dark');
    if (light) light.classList.toggle('active', theme === 'light');
  }

  function setTheme(theme) {
    theme = theme === 'light' ? 'light' : 'dark';
    var s = readSettings();
    s.theme = theme;
    writeSettings(s);

    applyThemeToBody(theme);
    updateButtons(theme);

    if (window.Logger && window.Logger.log) {
      window.Logger.log('Тема изменена: ' + theme, 'info');
    }
  }

  function applyTheme() {
    var theme = getTheme();
    applyThemeToBody(theme);
    updateButtons(theme);
  }

  window.Theme = {
    get: getTheme,
    set: setTheme,
    apply: applyTheme
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTheme);
  } else {
    applyTheme();
  }
})();