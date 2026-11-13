// modules/settings.js

const SettingsModule = {
  // Ключи, которые НЕ экспортируются и НЕ импортируются (системные/локальные)
  _protectedKeys: [
    'ft_module_',          // кэш модулей (префикс)
    'ft_bug_reports',      // баг-репорты
    'ft_error_log',        // лог ошибок
    'ft_ui_style',         // выбранный стиль (привязан к устройству)
    'ft_ui_custom_styles', // кастомные стили (могут быть большими)
    'ft_force_mode'        // режим загрузки модулей
  ],

  init: function() {
    if (typeof Logger !== 'undefined') Logger.log('Модуль настроек инициализирован', 'info');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { SettingsModule.setup(); });
    } else {
      this.setup();
    }
  },

  setup: function() {
    this.createSettingsScreen();
    if (typeof Core !== 'undefined') {
      Core.addNavButton('Настройки', 'settings', '<i class="ph ph-gear"></i>');
      Core.registerScreen('settings', function() { SettingsModule.createSettingsScreen(); });
    }
  },

  /* ---------- НАСТРОЙКИ (ft_settings) ---------- */
  getSettings: function() {
    if (typeof CoreData !== 'undefined' && CoreData.getSettings) return CoreData.getSettings();
    try {
      if (typeof FTStorage !== 'undefined' && FTStorage.get) return FTStorage.get('settings') || {};
      var raw = localStorage.getItem('ft_settings');
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  },

  saveSettings: function(s) {
    // Не трогаем theme/style — они управляются своими менеджерами
    var current = this.getSettings();
    var next = Object.assign({}, current, s || {});
    if (typeof CoreData !== 'undefined' && CoreData.setSettings) {
      CoreData.setSettings(next);
      return;
    }
    try {
      if (typeof FTStorage !== 'undefined' && FTStorage.set) FTStorage.set('settings', next);
      else localStorage.setItem('ft_settings', JSON.stringify(next));
    } catch (e) {
      if (typeof Logger !== 'undefined') Logger.log('saveSettings error: ' + e.message, 'error');
    }
  },

  /* ---------- ПРОФИЛЬ (делегируем в Profile) ---------- */
  getUserName: function() {
    if (typeof Profile !== 'undefined' && Profile.getUserName) return Profile.getUserName();
    try {
      var raw = localStorage.getItem('ft_user_name');
      return raw ? JSON.parse(raw) : '';
    } catch (e) { return ''; }
  },

  saveUserName: function(n) {
    if (typeof Profile !== 'undefined' && Profile.setName) { Profile.setName(n); return; }
    try { localStorage.setItem('ft_user_name', JSON.stringify(n)); } catch (e) {}
    if (typeof Profile !== 'undefined' && Profile.updateSidebar) Profile.updateSidebar();
  },

  getUserAvatar: function() {
    if (typeof Profile !== 'undefined' && Profile.getUserAvatar) return Profile.getUserAvatar();
    try {
      var raw = localStorage.getItem('ft_user_avatar');
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },

  saveUserAvatar: function(a) {
    if (typeof Profile !== 'undefined' && Profile.setAvatar) { Profile.setAvatar(a); return; }
    try { localStorage.setItem('ft_user_avatar', JSON.stringify(a)); } catch (e) {}
    if (typeof Profile !== 'undefined' && Profile.updateSidebar) Profile.updateSidebar();
  },

  /* ---------- ЭКРАН ---------- */
  createSettingsScreen: function() {
    var screen = document.getElementById('screen-settings');
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'screen-settings';
      screen.className = 'screen';
      document.getElementById('userInterface').appendChild(screen);
    }

    var css = '<style>' +
      '.settings-section { background:var(--bg-card); border-radius:12px; margin-bottom:10px; border:1px solid var(--border-subtle); overflow:hidden; transition:all 0.2s; }' +
      '.settings-section:hover { border-color:var(--border-gold); }' +
      '.settings-header { padding:14px 18px; cursor:pointer; display:flex; align-items:center; justify-content:space-between; transition:background 0.2s; }' +
      '.settings-header:hover { background:var(--accent-gold-dim); }' +
      '.settings-header h3 { font-family:var(--font-display); color:var(--accent-gold); margin:0; display:flex; align-items:center; gap:10px; font-size:1.1em; }' +
      '.settings-header i.chevron { transition:transform 0.3s; color:var(--accent-gold); }' +
      '.settings-header.open i.chevron { transform:rotate(180deg); }' +
      '.settings-body { max-height:0; overflow:hidden; transition:max-height 0.3s ease-out; padding:0 18px; }' +
      '.settings-body.open { max-height:3000px; padding:0 18px 18px; }' +
      '.hint { font-size:0.75em; opacity:0.6; margin-top:3px; color:var(--text-secondary); }' +
      '.avatar-preview { width:90px; height:90px; border-radius:50%; border:3px solid var(--accent-gold); overflow:hidden; background:var(--bg-primary); display:flex; align-items:center; justify-content:center; margin:0 auto 14px; }' +
      '.avatar-preview img { width:100%; height:100%; object-fit:cover; }' +
      '.avatar-preview i { font-size:2.5em; color:var(--accent-gold); }' +
      '.settings-danger-zone { border:1px solid var(--accent-error); border-radius:10px; padding:12px; margin-top:10px; background:rgba(248,113,113,0.05); }' +
      '.settings-danger-zone .title { color:var(--accent-error); font-weight:600; font-size:0.9em; display:flex; align-items:center; gap:6px; margin-bottom:6px; }' +
      '@media (prefers-reduced-motion: reduce) { .settings-body, .settings-header i.chevron { transition: none !important; } }' +
    '</style>';

    var html = css + '<div style="padding:4px;max-width:500px;margin:0 auto">';
    html += '<h2 style="font-family:var(--font-display);font-size:1.8em;margin-bottom:16px;color:var(--accent-gold);display:flex;align-items:center;gap:12px"><i class="ph ph-gear"></i> Настройки</h2>';
    html += this.renderAccordion('profile', 'ph-user-circle', 'Профиль', true);
    html += this.renderAccordion('survey', 'ph-clipboard-text', 'Опросы', false);
    html += this.renderAccordion('interface', 'ph-eye-slash', 'Интерфейс', false);
    html += this.renderAccordion('data', 'ph-database', 'Данные', false);
    html += '</div>';
    screen.innerHTML = html;

    document.querySelectorAll('.settings-header').forEach(function(header) {
      header.onclick = function() {
        var body = this.nextElementSibling;
        var isOpen = body.classList.contains('open');
        document.querySelectorAll('.settings-body').forEach(function(b) { b.classList.remove('open'); });
        document.querySelectorAll('.settings-header').forEach(function(h) { h.classList.remove('open'); });
        if (!isOpen) {
          body.classList.add('open');
          this.classList.add('open');
        }
      };
    });
  },

  renderAccordion: function(id, icon, title, isOpen) {
    var settings = this.getSettings();
    var userName = this.getUserName();
    var userAvatar = this.getUserAvatar();
    var hintsEnabled = typeof shouldShowHints === 'function' ? shouldShowHints() : true;
    var esc = (typeof Core !== 'undefined' && Core.utils && Core.utils.escapeHtml)
      ? Core.utils.escapeHtml : function(t) { return t == null ? '' : String(t); };

    var html = '<div class="settings-section">';
    html += '<div class="settings-header ' + (isOpen ? 'open' : '') + '" data-section="' + id + '">';
    html += '<h3><i class="ph ' + icon + '"></i> ' + title + '</h3>';
    html += '<i class="ph ph-caret-down chevron"></i>';
    html += '</div>';
    html += '<div class="settings-body ' + (isOpen ? 'open' : '') + '">';

    if (id === 'profile') {
      html += '<div class="avatar-preview">';
      if (userAvatar && typeof userAvatar === 'string' && userAvatar.indexOf('data:image') === 0) {
        html += '<img src="' + esc(userAvatar) + '" alt="avatar">';
      } else if (userAvatar && typeof userAvatar === 'string' && /^ph-[a-z0-9-]+$/.test(userAvatar)) {
        html += '<i class="ph ' + esc(userAvatar) + '"></i>';
      } else {
        html += '<i class="ph ph-user-circle"></i>';
      }
      html += '</div>';
      html += '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:16px;flex-wrap:wrap">';
      html += '<button class="btn btn-primary" onclick="SettingsModule.uploadAvatar()" style="padding:8px 14px;font-size:0.85em"><i class="ph ph-upload-simple"></i> Фото</button>';
      if (userAvatar) {
        html += '<button class="btn btn-secondary" onclick="SettingsModule.chooseIconAvatar()" style="padding:8px 14px;font-size:0.85em"><i class="ph ph-smiley"></i> Иконка</button>';
        html += '<button class="btn btn-danger" onclick="SettingsModule.removeAvatar()" style="padding:8px 14px;font-size:0.85em"><i class="ph ph-trash"></i> Удалить</button>';
      }
      html += '</div>';
      html += '<div style="margin-bottom:14px">';
      html += '<label style="display:block;margin-bottom:5px;font-weight:600;font-size:0.88em">Имя:</label>';
      html += '<input type="text" id="settingUserName" value="' + esc(userName) + '" placeholder="Введи своё имя" style="width:100%;padding:9px;background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:0.95em">';
      if (hintsEnabled) html += '<div class="hint" style="display:flex;align-items:center;gap:4px;margin-top:3px"><i class="ph ph-info"></i> Отображается на главном экране и в профиле</div>';
      html += '</div>';
      html += '<button class="btn btn-primary" style="width:100%;padding:10px" onclick="SettingsModule.saveProfile()"><i class="ph ph-floppy-disk"></i> Сохранить профиль</button>';
    } else if (id === 'survey') {
      html += '<div style="margin-bottom:12px">';
      html += '<label style="display:flex;align-items:center;gap:10px;cursor:pointer">';
      html += '<input type="checkbox" id="settingDisableMini" ' + (settings.disableMiniSurvey ? 'checked' : '') + ' style="width:18px;height:18px;accent-color:var(--accent-gold)">';
      html += '<span style="font-size:0.92em">Отключить мини-опрос после подхода</span>';
      html += '</label>';
      if (hintsEnabled) html += '<div class="hint" style="display:flex;align-items:center;gap:4px;margin-top:3px"><i class="ph ph-info"></i> Подходы будут отмечаться сразу без вопросов</div>';
      html += '</div>';
      html += '<button class="btn btn-primary" style="width:100%;padding:10px" onclick="SettingsModule.saveSurveySettings()"><i class="ph ph-floppy-disk"></i> Сохранить</button>';
    } else if (id === 'interface') {
      html += '<div style="margin-bottom:12px">';
      html += '<label style="display:flex;align-items:center;gap:10px;cursor:pointer">';
      html += '<input type="checkbox" id="settingDisableHints" ' + (settings.disableHints ? 'checked' : '') + ' style="width:18px;height:18px;accent-color:var(--accent-gold)">';
      html += '<span style="font-size:0.92em">Отключить все подсказки (хинты)</span>';
      html += '</label>';
      if (hintsEnabled) html += '<div class="hint" style="display:flex;align-items:center;gap:4px;margin-top:3px"><i class="ph ph-info"></i> Уберёт информационные подсказки во всех разделах</div>';
      html += '</div>';
      html += '<button class="btn btn-primary" style="width:100%;padding:10px" onclick="SettingsModule.saveInterfaceSettings()"><i class="ph ph-floppy-disk"></i> Сохранить</button>';
    } else if (id === 'data') {
      html += '<button class="btn btn-secondary" style="width:100%;padding:10px;margin-bottom:8px" onclick="SettingsModule.exportData()"><i class="ph ph-export"></i> Экспорт данных</button>';
      html += '<button class="btn btn-secondary" style="width:100%;padding:10px;margin-bottom:8px" onclick="SettingsModule.importData()"><i class="ph ph-import"></i> Импорт данных</button>';
      html += '<div class="hint" style="display:flex;align-items:start;gap:4px;margin-bottom:12px"><i class="ph ph-info" style="margin-top:2px"></i><span>Импорт заменит текущие данные (кроме системных: кэш модулей, баг-репорты, выбранный стиль).</span></div>';
      html += '<div class="settings-danger-zone">';
      html += '<div class="title"><i class="ph ph-warning"></i> Опасная зона</div>';
      html += '<div class="hint" style="margin-bottom:8px;opacity:0.8">Сброс удалит все пользовательские данные без возможности восстановления.</div>';
      html += '<button class="btn btn-danger" style="width:100%;padding:10px;margin-bottom:6px" onclick="SettingsModule.resetUserData()"><i class="ph ph-user-minus"></i> Сбросить данные пользователя</button>';
      html += '<button class="btn btn-danger" style="width:100%;padding:10px" onclick="SettingsModule.resetAll()"><i class="ph ph-trash"></i> Полный сброс (всё)</button>';
      html += '</div>';
    }
    html += '</div></div>';
    return html;
  },

  /* ---------- ПРОФИЛЬ ---------- */
  uploadAvatar: function() {
    if (typeof Profile !== 'undefined' && Profile.uploadAvatar) {
      Profile.uploadAvatar();
      // После выбора — перерисуем экран настроек
      setTimeout(function() { SettingsModule.createSettingsScreen(); }, 300);
      return;
    }
    // Fallback (если Profile недоступен)
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
      var file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        if (typeof Notify !== 'undefined') Notify.warn('Файл слишком большой. Максимум 2 МБ.');
        return;
      }
      var reader = new FileReader();
      reader.onload = function(ev) {
        var img = new Image();
        img.onload = function() {
          var canvas = document.createElement('canvas');
          var size = 200;
          canvas.width = size; canvas.height = size;
          var ctx = canvas.getContext('2d');
          var minDim = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - minDim) / 2, (img.height - minDim) / 2, minDim, minDim, 0, 0, size, size);
          SettingsModule.saveUserAvatar(canvas.toDataURL('image/jpeg', 0.85));
          SettingsModule.createSettingsScreen();
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  },

  chooseIconAvatar: function() {
    if (typeof Profile !== 'undefined' && Profile.chooseIcon) {
      Profile.chooseIcon();
      setTimeout(function() { SettingsModule.createSettingsScreen(); }, 300);
      return;
    }
    // Fallback — простой prompt
    var icons = ['ph-user-circle', 'ph-barbell', 'ph-sword', 'ph-flame', 'ph-lightning', 'ph-star', 'ph-crown', 'ph-diamond', 'ph-trophy', 'ph-rocket'];
    var choice = prompt('Введи имя иконки:\n' + icons.join('\n'), icons[0]);
    if (choice && icons.indexOf(choice) !== -1) {
      this.saveUserAvatar(choice);
      this.createSettingsScreen();
    }
  },

  removeAvatar: function() {
    if (!confirm('Удалить аватар?')) return;
    if (typeof Profile !== 'undefined' && Profile.removeAvatar) {
      Profile.removeAvatar();
    } else {
      try { localStorage.removeItem('ft_user_avatar'); } catch (e) {}
    }
    this.createSettingsScreen();
  },

  saveProfile: function() {
    var nameEl = document.getElementById('settingUserName');
    if (!nameEl) return;
    var name = nameEl.value.trim();
    this.saveUserName(name);
    if (typeof Notify !== 'undefined') Notify.success('Профиль сохранён!');
    else alert('Профиль сохранён!');
  },

  /* ---------- ОПРОСЫ / ИНТЕРФЕЙС ---------- */
  saveSurveySettings: function() {
    var el = document.getElementById('settingDisableMini');
    if (!el) return;
    this.saveSettings({ disableMiniSurvey: el.checked });
    if (typeof Notify !== 'undefined') Notify.success('Настройки опросов сохранены!');
    else alert('Настройки опросов сохранены!');
  },

  saveInterfaceSettings: function() {
    var el = document.getElementById('settingDisableHints');
    if (!el) return;
    this.saveSettings({ disableHints: el.checked });
    if (typeof Notify !== 'undefined') Notify.success('Настройки интерфейса сохранены!');
    else alert('Настройки интерфейса сохранены!');
  },

  /* ---------- ЭКСПОРТ / ИМПОРТ ---------- */
  _isProtectedKey: function(key) {
    for (var i = 0; i < this._protectedKeys.length; i++) {
      var p = this._protectedKeys[i];
      if (p.endsWith('_')) {
        if (key.indexOf(p) === 0) return true;
      } else {
        if (key === p) return true;
      }
    }
    return false;
  },

  exportData: function() {
    var data = {};
    try {
      Object.keys(localStorage).forEach(function(key) {
        if (key.indexOf('ft_') !== 0) return;
        if (SettingsModule._isProtectedKey(key)) return;
        data[key] = localStorage.getItem(key);
      });
    } catch (e) {
      if (typeof Notify !== 'undefined') Notify.error('Ошибка чтения данных: ' + e.message);
      return;
    }

    var payload = {
      _meta: {
        app: 'FITNESS ELITE',
        version: 1,
        exportedAt: new Date().toISOString(),
        keys: Object.keys(data).length
      },
      data: data
    };

    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var dateStr = (typeof Core !== 'undefined' && Core.utils && Core.utils.formatLocalDate)
      ? Core.utils.formatLocalDate(new Date())
      : new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = 'fitness_backup_' + dateStr + '.json';
    a.click();
    URL.revokeObjectURL(url);
    if (typeof Notify !== 'undefined') Notify.success('Данные экспортированы (' + Object.keys(data).length + ' ключей)');
    else alert('Данные экспортированы');
  },

  importData: function() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = function(e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) {
        var parsed;
        try {
          parsed = JSON.parse(ev.target.result);
        } catch (err) {
          if (typeof Notify !== 'undefined') Notify.error('Ошибка парсинга JSON: ' + err.message);
          else alert('Ошибка парсинга JSON: ' + err.message);
          return;
        }

        // Поддержка двух форматов: {data: {...}} (новый) и плоский {...} (старый)
        var raw = (parsed && parsed.data && typeof parsed.data === 'object') ? parsed.data : parsed;
        if (!raw || typeof raw !== 'object') {
          if (typeof Notify !== 'undefined') Notify.error('Неверный формат файла');
          else alert('Неверный формат файла');
          return;
        }

        var imported = 0, skippedProtected = 0, skippedInvalid = 0;
        Object.keys(raw).forEach(function(key) {
          if (key.indexOf('ft_') !== 0) { skippedInvalid++; return; }
          if (SettingsModule._isProtectedKey(key)) { skippedProtected++; return; }
          var value = raw[key];
          var stringValue = (typeof value === 'string') ? value : JSON.stringify(value);
          try {
            JSON.parse(stringValue);
            localStorage.setItem(key, stringValue);
            imported++;
          } catch (err) {
            skippedInvalid++;
          }
        });

        var msg = 'Импортировано ключей: ' + imported;
        if (skippedProtected > 0) msg += '\nПропущено системных: ' + skippedProtected;
        if (skippedInvalid > 0) msg += '\nПропущено невалидных: ' + skippedInvalid;
        msg += '\n\nСтраница перезагрузится.';
        alert(msg);
        location.reload();
      };
      reader.onerror = function() {
        if (typeof Notify !== 'undefined') Notify.error('Ошибка чтения файла');
        else alert('Ошибка чтения файла');
      };
      reader.readAsText(file);
    };
    input.click();
  },

  /* ---------- СБРОС ---------- */
  resetUserData: function() {
    if (!confirm('Сбросить пользовательские данные?\n\nБудут удалены: история, статистика, план, упражнения, категории, опросы, профиль, достижения.\n\nКэш модулей, стиль и баг-репорты останутся.')) return;
    if (!confirm('Точно? Это нельзя отменить.')) return;

    var userKeys = [
      'ft_history', 'ft_stats', 'ft_plan', 'ft_db', 'ft_categories',
      'ft_survey_config', 'ft_settings', 'ft_user_name', 'ft_user_avatar',
      'ft_unlocked_achievements', 'ft_xp_log',
      'ft_anatomy_custom_urls'
    ];
    // Удаляем и кэш картинок анатомии
    try {
      Object.keys(localStorage).forEach(function(key) {
        if (key.indexOf('ft_anatomy_img_') === 0) userKeys.push(key);
      });
    } catch (e) {}

    userKeys.forEach(function(key) {
      try { localStorage.removeItem(key); } catch (e) {}
    });

    alert('Пользовательские данные сброшены.');
    location.reload();
  },

  resetAll: function() {
    if (!confirm('ПОЛНЫЙ СБРОС: удалить ВСЕ данные, включая кэш модулей, стили и баг-репорты?\n\nЭто нельзя отменить!')) return;
    if (!confirm('Ты точно уверен? Последнее предупреждение.')) return;

    try {
      Object.keys(localStorage).forEach(function(key) {
        if (key.indexOf('ft_') === 0) localStorage.removeItem(key);
      });
    } catch (e) {}
    alert('Все данные удалены.');
    location.reload();
  }
};

window.SettingsModule = SettingsModule;
module.exports = SettingsModule;