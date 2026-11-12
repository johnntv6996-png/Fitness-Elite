// core/styles.js
(function() {
  'use strict';

  var STORAGE_KEY = 'ft_ui_style';
  var CUSTOM_KEY = 'ft_ui_custom_styles';
  var DEFAULT_STYLE = 'default';

  var BUILTIN_STYLES = [
    { id: 'default', name: 'Premium Dark', description: 'Тёмная, как была изначально', colors: ['#0a0a0f', '#d4af37', '#4ade80'] },
    { id: 'light-classic', name: 'Premium Light', description: 'Светлая, как была изначально', colors: ['#f5f2eb', '#a67c00', '#16a34a'] },
    { id: 'neon', name: 'Неон', description: 'Киберпанк, свечение', colors: ['#00e5ff', '#ff2bd6', '#b4ff39'] },
    { id: 'minimal', name: 'Минимализм', description: 'Чисто, много воздуха', colors: ['#1a1a1a', '#666', '#ccc'] },
    { id: 'cyber', name: 'Киберпанк', description: 'Жёлтый, резкие углы', colors: ['#f0ff00', '#ff2d55', '#00e5ff'] },
    { id: 'material', name: 'Материал', description: 'Мягкие тени, скругления', colors: ['#6750a4', '#7f67be', '#b0a0d0'] },
    { id: 'glass', name: 'Стекло', description: 'Полупрозрачность, blur', colors: ['#4a9eff', '#8a5cff', '#5ec8ff'] }
  ];

  var styleCache = {};

  function getCustomStyles() {
    try {
      var raw = localStorage.getItem(CUSTOM_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function saveCustomStyles(arr) {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(arr)); } catch (e) {}
  }

  function getAllStyles() {
    var custom = getCustomStyles();
    var all = [];
    for (var i = 0; i < BUILTIN_STYLES.length; i++) {
      var b = BUILTIN_STYLES[i];
      all.push({ id: b.id, name: b.name, description: b.description, colors: b.colors, builtin: true });
    }
    for (var j = 0; j < custom.length; j++) {
      var c = custom[j];
      all.push({ id: c.id, name: c.name, description: c.description || 'Пользовательский стиль', colors: c.colors || ['#888','#666','#444'], builtin: false });
    }
    return all;
  }

  function getCustomCss(id) {
    if (styleCache[id]) return styleCache[id];
    var custom = getCustomStyles();
    for (var j = 0; j < custom.length; j++) {
      if (custom[j].id === id) {
        styleCache[id] = custom[j].css;
        return custom[j].css;
      }
    }
    return null;
  }

  function applyStyle(id) {
    if (!id) id = DEFAULT_STYLE;
    document.body.setAttribute('data-style', id);

    // Поддержка старого body.light-theme для light-classic
    if (id === 'light-classic') document.body.classList.add('light-theme');
    else document.body.classList.remove('light-theme');

    var css = getCustomCss(id);
    var styleEl = document.getElementById('ft-custom-style');
    if (css) {
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'ft-custom-style';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = css;
    } else {
      if (styleEl) styleEl.textContent = '';
    }

    try { localStorage.setItem(STORAGE_KEY, id); } catch (e) {}
  }

  function getCurrentStyle() {
    try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_STYLE; } catch (e) { return DEFAULT_STYLE; }
  }

  function importStyleFromJSON(jsonText) {
    var data;
    try { data = JSON.parse(jsonText); }
    catch (e) { return { ok: false, error: 'Ошибка парсинга JSON: ' + e.message }; }

    var arr = Array.isArray(data) ? data : [data];
    var imported = 0;
    var errors = [];
    var custom = getCustomStyles();

    for (var i = 0; i < arr.length; i++) {
      var item = arr[i];
      if (!item || !item.id || !item.name || !item.css) {
        errors.push('Элемент ' + (i + 1) + ': нужны поля id, name, css');
        continue;
      }
      if (!/^[a-z0-9_-]+$/i.test(item.id)) {
        errors.push('Элемент ' + (i + 1) + ': id может содержать только латиницу, цифры, _, -');
        continue;
      }
      var isBuiltin = false;
      for (var k = 0; k < BUILTIN_STYLES.length; k++) {
        if (BUILTIN_STYLES[k].id === item.id) { isBuiltin = true; break; }
      }
      if (isBuiltin) {
        errors.push('Элемент ' + (i + 1) + ': id "' + item.id + '" совпадает со встроенным');
        continue;
      }

      var found = false;
      for (var j = 0; j < custom.length; j++) {
        if (custom[j].id === item.id) {
          custom[j] = {
            id: item.id, name: item.name,
            description: item.description || '',
            colors: item.colors || ['#888','#666','#444'],
            css: item.css, addedAt: Date.now()
          };
          found = true;
          break;
        }
      }
      if (!found) {
        custom.push({
          id: item.id, name: item.name,
          description: item.description || '',
          colors: item.colors || ['#888','#666','#444'],
          css: item.css, addedAt: Date.now()
        });
      }
      styleCache[item.id] = item.css;
      imported++;
    }

    saveCustomStyles(custom);
    return { ok: imported > 0, imported: imported, errors: errors };
  }

  function importStyleFromFile(file, callback) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var result = importStyleFromJSON(e.target.result);
      if (callback) callback(result);
    };
    reader.onerror = function() {
      if (callback) callback({ ok: false, error: 'Ошибка чтения файла' });
    };
    reader.readAsText(file);
  }

  function deleteCustomStyle(id) {
    var custom = getCustomStyles();
    var filtered = [];
    var found = false;
    for (var i = 0; i < custom.length; i++) {
      if (custom[i].id === id) { found = true; continue; }
      filtered.push(custom[i]);
    }
    if (!found) return false;
    saveCustomStyles(filtered);
    delete styleCache[id];
    if (getCurrentStyle() === id) applyStyle(DEFAULT_STYLE);
    return true;
  }

  function exportStyle(id) {
    var custom = getCustomStyles();
    for (var i = 0; i < custom.length; i++) {
      if (custom[i].id === id) {
        return JSON.stringify({
          id: custom[i].id, name: custom[i].name,
          description: custom[i].description,
          colors: custom[i].colors,
          css: custom[i].css
        }, null, 2);
      }
    }
    return null;
  }

  function init() {
    applyStyle(getCurrentStyle());
  }

  window.StyleManager = {
    getAllStyles: getAllStyles,
    getCurrentStyle: getCurrentStyle,
    applyStyle: applyStyle,
    importStyleFromJSON: importStyleFromJSON,
    importStyleFromFile: importStyleFromFile,
    deleteCustomStyle: deleteCustomStyle,
    exportStyle: exportStyle,
    getCustomStyles: getCustomStyles,
    BUILTIN_STYLES: BUILTIN_STYLES
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();