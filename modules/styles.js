// modules/styles.js
const StylesModule = {
  _expandedBuiltin: true,
  _expandedCustom: true,

  init: function() {
    if (typeof Logger !== 'undefined') Logger.log('Модуль стилей инициализирован', 'info');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { StylesModule.setup(); });
    } else { this.setup(); }
  },

  setup: function() {
    this.createStylesScreen();
    if (typeof Core !== 'undefined') {
      Core.addNavButton('Стили', 'styles', '<i class="ph ph-palette"></i>');
      Core.registerScreen('styles', function() { StylesModule.createStylesScreen(); });
    }
  },

  createStylesScreen: function() {
    var esc = (typeof Core !== 'undefined' && Core.utils && Core.utils.escapeHtml)
      ? Core.utils.escapeHtml
      : function(t) { return t == null ? '' : String(t); };

    var screen = document.getElementById('screen-styles');
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'screen-styles';
      screen.className = 'screen';
      document.getElementById('userInterface').appendChild(screen);
    }

    var all = (typeof StyleManager !== 'undefined') ? StyleManager.getAllStyles() : [];
    var current = (typeof StyleManager !== 'undefined') ? StyleManager.getCurrentStyle() : '';
    var builtin = all.filter(function(s) { return s.builtin; });
    var custom = all.filter(function(s) { return !s.builtin; });

    var css = '<style>' +
      '.styles-page { padding: 8px; max-width: 600px; margin: 0 auto; }' +
      '.styles-acc { background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 14px; margin-bottom: 12px; overflow: hidden; }' +
      '.styles-acc-header { padding: 14px 18px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-weight: 600; color: var(--accent-gold); transition: background 0.2s; }' +
      '.styles-acc-header:active { background: var(--accent-gold-dim); }' +
      '.styles-acc-header .count { font-size: 0.8em; opacity: 0.6; font-weight: 500; margin-left: 6px; }' +
      '.styles-acc-header .chevron { transition: transform 0.3s; }' +
      '.styles-acc.open .styles-acc-header .chevron { transform: rotate(180deg); }' +
      '.styles-acc-body { max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; }' +
      '.styles-acc.open .styles-acc-body { max-height: 2000px; }' +
      '.styles-acc-content { padding: 0 12px 12px; display: flex; flex-direction: column; gap: 6px; }' +

      /* Компактная строка стиля */
      '.style-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 10px; cursor: pointer; transition: all 0.15s; border: 1px solid transparent; }' +
      '.style-row:hover { background: rgba(128,128,128,0.06); }' +
      '.style-row.active { border-color: var(--accent-gold); background: var(--accent-gold-dim); }' +
      '.style-row .dots { display: flex; gap: 3px; flex-shrink: 0; }' +
      '.style-row .dot { width: 10px; height: 10px; border-radius: 50%; }' +
      '.style-row .info { flex: 1; min-width: 0; }' +
      '.style-row .name { font-weight: 600; font-size: 0.9em; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
      '.style-row .desc { font-size: 0.72em; opacity: 0.6; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
      '.style-row .active-mark { color: var(--accent-gold); font-size: 1.1em; flex-shrink: 0; }' +
      '.style-row .actions { display: flex; gap: 4px; flex-shrink: 0; }' +
      '.style-row .icon-btn { width: 30px; height: 30px; border-radius: 50%; background: transparent; border: 1px solid var(--border-subtle); color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.9em; transition: all 0.15s; }' +
      '.style-row .icon-btn:hover { border-color: var(--accent-gold); color: var(--accent-gold); }' +
      '.style-row .icon-btn:active { transform: scale(0.9); }' +

      /* Загрузка */
      '.styles-import { border: 2px dashed var(--border-subtle); border-radius: 12px; padding: 18px; text-align: center; cursor: pointer; transition: all 0.2s; margin-bottom: 12px; }' +
      '.styles-import:hover { border-color: var(--accent-gold); background: var(--accent-gold-dim); }' +
      '.styles-import i { font-size: 1.8em; color: var(--accent-gold); display: block; margin-bottom: 6px; }' +
      '.styles-import .title { font-weight: 600; font-size: 0.9em; }' +
      '.styles-import .hint { font-size: 0.72em; opacity: 0.6; margin-top: 2px; }' +

      /* Пусто */
      '.styles-empty { text-align: center; padding: 20px 10px; opacity: 0.6; font-size: 0.85em; }' +
      '.styles-empty i { font-size: 2em; color: var(--accent-gold); display: block; margin-bottom: 8px; opacity: 0.5; }' +
    '</style>';

    var html = css + '<div class="styles-page">';
    html += '<h2 style="font-family:var(--font-display);font-size:1.8em;margin-bottom:16px;color:var(--accent-gold);display:flex;align-items:center;gap:12px"><i class="ph ph-palette"></i> Стили</h2>';

    // === Встроенные ===
    html += '<div class="styles-acc ' + (this._expandedBuiltin ? 'open' : '') + '" id="styles-acc-builtin">';
    html += '<div class="styles-acc-header" onclick="StylesModule.toggleAcc(\'builtin\')">';
    html += '<span><i class="ph ph-package"></i> Встроенные <span class="count">(' + builtin.length + ')</span></span>';
    html += '<i class="ph ph-caret-down chevron"></i>';
    html += '</div>';
    html += '<div class="styles-acc-body"><div class="styles-acc-content">';
    for (var i = 0; i < builtin.length; i++) {
      html += this._renderStyleRow(builtin[i], current);
    }
    html += '</div></div></div>';

    // === Мои стили ===
    html += '<div class="styles-acc ' + (this._expandedCustom ? 'open' : '') + '" id="styles-acc-custom">';
    html += '<div class="styles-acc-header" onclick="StylesModule.toggleAcc(\'custom\')">';
    html += '<span><i class="ph ph-user"></i> Мои стили <span class="count">(' + custom.length + ')</span></span>';
    html += '<i class="ph ph-caret-down chevron"></i>';
    html += '</div>';
    html += '<div class="styles-acc-body"><div class="styles-acc-content">';
    if (custom.length === 0) {
      html += '<div class="styles-empty"><i class="ph ph-folder-open"></i>Нет пользовательских стилей.<br>Загрузи стиль из файла ниже.</div>';
    } else {
      for (var j = 0; j < custom.length; j++) {
        html += this._renderStyleRow(custom[j], current, true);
      }
    }
    html += '</div></div></div>';

    // === Загрузка ===
    html += '<div class="styles-import" onclick="document.getElementById(\'styleFileInput\').click()">';
    html += '<i class="ph ph-upload-simple"></i>';
    html += '<div class="title">Загрузить стиль из файла</div>';
    html += '<div class="hint">JSON с полями id, name, css</div>';
    html += '</div>';
    html += '<input type="file" id="styleFileInput" accept=".json,application/json" style="display:none" onchange="StylesModule.onFileSelected(event)">';

    // === Предпросмотр ===
    html += '<div style="margin-top:20px">';
    html += '<div style="font-size:0.72em;text-transform:uppercase;letter-spacing:1.5px;color:var(--text-secondary);opacity:0.6;margin-bottom:10px;font-weight:600">Предпросмотр</div>';
    html += '<div style="background:var(--bg-primary);border-radius:14px;padding:16px;border:1px solid var(--border-subtle)">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
    html += '<div style="display:flex;align-items:center;gap:10px">';
    html += '<i class="ph ph-star" style="font-size:1.5em;color:var(--accent-gold)"></i>';
    html += '<div style="font-size:1.5em;font-weight:700;color:var(--accent-gold);line-height:1">15</div>';
    html += '<div style="font-size:0.7em;opacity:0.6;text-transform:uppercase;letter-spacing:1px">уровень</div>';
    html += '</div>';
    html += '<div style="text-align:right;font-size:0.8em"><span style="opacity:0.6">XP </span><strong style="color:var(--accent-gold)">80</strong><span style="opacity:0.5"> / 120</span></div>';
    html += '</div>';
    html += '<div style="height:5px;background:rgba(0,0,0,0.3);border-radius:3px;overflow:hidden;border:1px solid var(--border-subtle);margin-top:6px"><div style="height:100%;width:67%;background:linear-gradient(90deg,var(--accent-gold),var(--accent-gold-light));border-radius:3px"></div></div>';
    html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px">';
    html += '<div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:8px;padding:8px 4px;text-align:center"><div style="font-size:1.1em;font-weight:700;color:var(--accent-gold);line-height:1">5</div><div style="font-size:0.6em;opacity:0.6;margin-top:2px">🔥 стрик</div></div>';
    html += '<div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:8px;padding:8px 4px;text-align:center"><div style="font-size:1.1em;font-weight:700;color:var(--accent-gold);line-height:1">29</div><div style="font-size:0.6em;opacity:0.6;margin-top:2px">💪 трен.</div></div>';
    html += '<div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:8px;padding:8px 4px;text-align:center"><div style="font-size:1.1em;font-weight:700;color:var(--accent-gold);line-height:1">1200</div><div style="font-size:0.6em;opacity:0.6;margin-top:2px">⚡ XP</div></div>';
    html += '<div style="background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:8px;padding:8px 4px;text-align:center"><div style="font-size:1.1em;font-weight:700;color:var(--accent-gold);line-height:1">15</div><div style="font-size:0.6em;opacity:0.6;margin-top:2px">⭐ ур.</div></div>';
    html += '</div>';
    html += '</div></div>';

    html += '</div>';
    screen.innerHTML = html;
  },

  _renderStyleRow: function(s, current, isCustom) {
    var esc = (typeof Core !== 'undefined' && Core.utils && Core.utils.escapeHtml)
      ? Core.utils.escapeHtml
      : function(t) { return t == null ? '' : String(t); };
    var active = s.id === current;
    var html = '<div class="style-row ' + (active ? 'active' : '') + '" onclick="StylesModule.applyStyle(\'' + esc(s.id) + '\')">';
    html += '<div class="dots">';
    for (var i = 0; i < s.colors.length; i++) {
      html += '<div class="dot" style="background:' + esc(s.colors[i]) + '"></div>';
    }
    html += '</div>';
    html += '<div class="info">';
    html += '<div class="name">' + esc(s.name) + '</div>';
    html += '<div class="desc">' + esc(s.description || '') + '</div>';
    html += '</div>';
    if (active) {
      html += '<i class="ph ph-check-circle active-mark"></i>';
    } else if (isCustom) {
      html += '<div class="actions">';
      html += '<button class="icon-btn" onclick="event.stopPropagation(); StylesModule.exportStyle(\'' + esc(s.id) + '\')" title="Экспорт"><i class="ph ph-download-simple"></i></button>';
      html += '<button class="icon-btn" onclick="event.stopPropagation(); StylesModule.deleteStyle(\'' + esc(s.id) + '\')" title="Удалить"><i class="ph ph-trash"></i></button>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  },

  toggleAcc: function(name) {
    if (name === 'builtin') {
      this._expandedBuiltin = !this._expandedBuiltin;
      var el = document.getElementById('styles-acc-builtin');
      if (el) el.classList.toggle('open', this._expandedBuiltin);
    } else if (name === 'custom') {
      this._expandedCustom = !this._expandedCustom;
      var el2 = document.getElementById('styles-acc-custom');
      if (el2) el2.classList.toggle('open', this._expandedCustom);
    }
  },

  applyStyle: function(id) {
    if (typeof StyleManager === 'undefined') return;
    StyleManager.applyStyle(id);
    this.createStylesScreen();
    if (typeof Notify !== 'undefined') Notify.success('Стиль применён');
  },

  onFileSelected: function(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var self = this;
    StyleManager.importStyleFromFile(file, function(result) {
      if (result.ok) {
        if (typeof Notify !== 'undefined') Notify.success('Импортировано стилей: ' + result.imported);
        self.createStylesScreen();
        if (result.errors.length > 0) {
          setTimeout(function() {
            if (typeof Notify !== 'undefined') Notify.warn('Ошибки: ' + result.errors.join('; '));
          }, 500);
        }
      } else {
        if (typeof Notify !== 'undefined') Notify.error('Ошибка: ' + (result.error || result.errors.join('; ')));
      }
      e.target.value = '';
    });
  },

  exportStyle: function(id) {
    if (typeof StyleManager === 'undefined') return;
    var json = StyleManager.exportStyle(id);
    if (!json) return;
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'style-' + id + '.json';
    a.click();
    URL.revokeObjectURL(url);
    if (typeof Notify !== 'undefined') Notify.success('Стиль экспортирован');
  },

  deleteStyle: function(id) {
    if (!confirm('Удалить стиль "' + id + '"?')) return;
    if (typeof StyleManager !== 'undefined') {
      StyleManager.deleteCustomStyle(id);
      this.createStylesScreen();
      if (typeof Notify !== 'undefined') Notify.success('Стиль удалён');
    }
  }
};

window.StylesModule = StylesModule;
module.exports = StylesModule;