// app/profile.js
// Профиль пользователя: имя, аватар, модалка редактирования.
// Единый источник: ft_user_name, ft_user_avatar.
// Требует: Logger, Notify (опционально).

(function() {
  'use strict';

  var NAME_KEY = 'ft_user_name';
  var AVATAR_KEY = 'ft_user_avatar';
  var SETTINGS_KEY = 'ft_settings';

  var _listeners = [];   // колбэки onChange

  /* ---------- ХРАНИЛИЩЕ ---------- */
  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  function removeKey(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  function esc(text) {
    if (text == null) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------- АВАТАР ---------- */
  function isImageAvatar(a) {
    return typeof a === 'string' && a.indexOf('data:image') === 0;
  }
  function isIconAvatar(a) {
    return typeof a === 'string' && /^ph-[a-z0-9-]+$/.test(a);
  }

  function renderAvatarHTML(avatar, sizePx) {
    sizePx = sizePx || 52;
    if (isImageAvatar(avatar)) {
      return '<img src="' + esc(avatar) + '" style="width:100%;height:100%;object-fit:cover" alt="avatar">';
    }
    if (isIconAvatar(avatar)) {
      return '<i class="ph ' + esc(avatar) + '" style="font-size:' + Math.round(sizePx * 0.55) + 'px;color:var(--accent-gold)"></i>';
    }
    return '<i class="ph ph-user-circle" style="font-size:' + Math.round(sizePx * 0.55) + 'px;color:var(--accent-gold)"></i>';
  }

  /* ---------- ПОДПИСКА НА ИЗМЕНЕНИЯ ---------- */
  function notifyChange() {
    for (var i = 0; i < _listeners.length; i++) {
      try { _listeners[i](); } catch (e) {}
    }
  }
  function onChange(fn) {
    if (typeof fn !== 'function') return function() {};
    _listeners.push(fn);
    return function off() {
      var idx = _listeners.indexOf(fn);
      if (idx !== -1) _listeners.splice(idx, 1);
    };
  }

  /* ---------- ГЕТТЕРЫ ---------- */
  function getUserName() {
    var n = readJSON(NAME_KEY);
    if (n != null) return typeof n === 'string' ? n : '';
    // Fallback: если имя лежит в ft_settings.userName (старый формат)
    var s = readJSON(SETTINGS_KEY);
    if (s && typeof s.userName === 'string') return s.userName;
    return '';
  }

  function getUserAvatar() {
    return readJSON(AVATAR_KEY);
  }

  /* ---------- СЕТТЕРЫ (единая точка записи) ---------- */
  function setName(name) {
    name = name == null ? '' : String(name);
    writeJSON(NAME_KEY, name);

    // Синхронизируем ft_settings.userName, если он там был (обратная совместимость)
    var s = readJSON(SETTINGS_KEY);
    if (s && typeof s === 'object' && 'userName' in s) {
      s.userName = name;
      writeJSON(SETTINGS_KEY, s);
    }

    updateSidebarProfile();
    notifyChange();
  }

  function setAvatar(avatar) {
    if (avatar == null) removeKey(AVATAR_KEY);
    else writeJSON(AVATAR_KEY, avatar);

    updateSidebarProfile();
    notifyChange();
  }

  /* ---------- СТАТИСТИКА (для консистентности) ---------- */
  function getStats() {
    var defaults = { yes: 0, later: 0, no: 0, xp: 0, level: 1, streak: 0 };
    if (typeof CoreData !== 'undefined' && CoreData.getStats) {
      var s1 = CoreData.getStats();
      for (var k1 in defaults) if (s1[k1] === undefined) s1[k1] = defaults[k1];
      return s1;
    }
    try {
      var s = readJSON('ft_stats') || {};
      for (var k in defaults) if (s[k] === undefined) s[k] = defaults[k];
      return s;
    } catch (e) { return defaults; }
  }

  /* ---------- САЙДБАР ---------- */
  function updateSidebarProfile() {
    var nameEl = document.getElementById('sidebarName');
    var avatarEl = document.getElementById('sidebarAvatar');
    if (!nameEl && !avatarEl) return;

    var name = getUserName();
    var avatar = getUserAvatar();

    if (nameEl) {
      nameEl.innerHTML = '<span>' + esc(name || 'Гость') + '</span><i class="ph ph-pencil-simple"></i>';
    }
    if (avatarEl) {
      avatarEl.innerHTML = renderAvatarHTML(avatar, 52);
    }
  }

  /* ---------- МОДАЛКА ---------- */
  function openProfileModal() {
    var name = getUserName();
    var avatar = getUserAvatar();
    var hasAvatar = isImageAvatar(avatar) || isIconAvatar(avatar);

    var old = document.getElementById('profileModal');
    if (old) old.remove();

    var modal = document.createElement('div');
    modal.className = 'ex-modal';
    modal.id = 'profileModal';
    modal.style.zIndex = '2100';

    var content = document.createElement('div');
    content.className = 'ex-modal-content';
    content.style.maxWidth = '450px';
    content.innerHTML =
      '<button style="float:right;background:transparent;border:none;color:var(--text-secondary);font-size:1.5em;cursor:pointer" onclick="Profile.closeModal()" aria-label="Закрыть"><i class="ph ph-x"></i></button>' +
      '<h2 style="font-family:var(--font-display);color:var(--accent-gold);margin-top:0;display:flex;align-items:center;gap:10px"><i class="ph ph-user-circle"></i> Профиль</h2>' +
      '<div style="text-align:center;margin:20px 0">' +
        '<div id="profileAvatarPreview" style="width:100px;height:100px;border-radius:50%;border:3px solid var(--border-gold);overflow:hidden;background:var(--bg-primary);display:inline-flex;align-items:center;justify-content:center">' +
          renderAvatarHTML(avatar, 100) +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;justify-content:center;margin-bottom:20px;flex-wrap:wrap">' +
        '<button class="btn btn-primary" onclick="Profile.uploadAvatar()" style="padding:10px 16px;font-size:0.9em"><i class="ph ph-upload-simple"></i> Фото</button>' +
        '<button class="btn btn-secondary" onclick="Profile.chooseIcon()" style="padding:10px 16px;font-size:0.9em"><i class="ph ph-smiley"></i> Иконка</button>' +
        '<button class="btn btn-danger" onclick="Profile.removeAvatar()" style="padding:10px 16px;font-size:0.9em" ' + (hasAvatar ? '' : 'disabled') + '><i class="ph ph-trash"></i> Удалить</button>' +
      '</div>' +
      '<div style="margin-bottom:16px">' +
        '<label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em">Имя:</label>' +
        '<input type="text" id="profileNameInput" value="' + esc(name) + '" placeholder="Введи своё имя" style="width:100%;padding:10px;background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:1em">' +
      '</div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end">' +
        '<button class="btn btn-secondary" onclick="Profile.closeModal()">Отмена</button>' +
        '<button class="btn btn-primary" onclick="Profile.saveProfile()"><i class="ph ph-floppy-disk"></i> Сохранить</button>' +
      '</div>';

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Enter — сохранить
    var input = document.getElementById('profileNameInput');
    if (input) {
      input.onkeydown = function(e) {
        if (e.key === 'Enter') { e.preventDefault(); saveProfile(); }
      };
      setTimeout(function() { input.focus(); input.select(); }, 50);
    }
  }

  function closeModal() {
    var m = document.getElementById('profileModal');
    if (m) m.remove();
  }

  function updateModalPreview() {
    var preview = document.getElementById('profileAvatarPreview');
    if (!preview) return;
    var avatar = getUserAvatar();
    preview.innerHTML = renderAvatarHTML(avatar, 100);

    var hasAvatar = isImageAvatar(avatar) || isIconAvatar(avatar);
    var modal = document.getElementById('profileModal');
    if (modal) {
      var delBtn = modal.querySelector('.btn-danger');
      if (delBtn) delBtn.disabled = !hasAvatar;
    }
  }

  function saveProfile() {
    var input = document.getElementById('profileNameInput');
    if (!input) return;
    var name = input.value.trim();
    setName(name);
    closeModal();
    if (window.Notify) window.Notify.success('Профиль сохранён!');
  }

  /* ---------- АВАТАР: ЗАГРУЗКА ---------- */
  function uploadAvatar() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        if (window.Notify) window.Notify.warn('Файл слишком большой. Максимум 2 МБ.');
        return;
      }
      var reader = new FileReader();
      reader.onload = function(ev) {
        var img = new Image();
        img.onload = function() {
          try {
            var canvas = document.createElement('canvas');
            var size = 160;
            canvas.width = size;
            canvas.height = size;
            var ctx = canvas.getContext('2d');
            var minDim = Math.min(img.width, img.height);
            ctx.drawImage(img, (img.width - minDim) / 2, (img.height - minDim) / 2, minDim, minDim, 0, 0, size, size);

            // Пробуем webp (меньше размер), иначе jpeg
            var dataUrl = null;
            try {
              dataUrl = canvas.toDataURL('image/webp', 0.85);
              if (!dataUrl || dataUrl.indexOf('data:image/webp') !== 0) dataUrl = null;
            } catch (e) {}
            if (!dataUrl) dataUrl = canvas.toDataURL('image/jpeg', 0.85);

            if (setAvatar(dataUrl)) {
              updateModalPreview();
              if (window.Notify) window.Notify.success('Аватар обновлён!');
            } else {
              if (window.Notify) window.Notify.error('Не удалось сохранить аватар (нет места)');
            }
          } catch (err) {
            if (window.Notify) window.Notify.error('Ошибка обработки изображения');
          }
        };
        img.onerror = function() {
          if (window.Notify) window.Notify.error('Не удалось прочитать изображение');
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function removeAvatar() {
    if (!confirm('Удалить аватар?')) return;
    setAvatar(null);
    updateModalPreview();
  }

  /* ---------- АВАТАР: ИКОНКИ ---------- */
  var ICONS = [
    { id: 'ph-user-circle', label: 'Пользователь' },
    { id: 'ph-barbell', label: 'Штанга' },
    { id: 'ph-sword', label: 'Меч' },
    { id: 'ph-person-simple-run', label: 'Бег' },
    { id: 'ph-person-simple-bike', label: 'Велосипед' },
    { id: 'ph-person-simple-swim', label: 'Плавание' },
    { id: 'ph-flame', label: 'Огонь' },
    { id: 'ph-lightning', label: 'Молния' },
    { id: 'ph-star', label: 'Звезда' },
    { id: 'ph-crown', label: 'Корона' },
    { id: 'ph-diamond', label: 'Алмаз' },
    { id: 'ph-trophy', label: 'Трофей' },
    { id: 'ph-rocket', label: 'Ракета' }
  ];

  function chooseIcon() {
    var old = document.getElementById('iconPickerModal');
    if (old) old.remove();

    var currentAvatar = getUserAvatar();

    var modal = document.createElement('div');
    modal.className = 'ex-modal';
    modal.id = 'iconPickerModal';
    modal.style.zIndex = '2200';

    var content = document.createElement('div');
    content.className = 'ex-modal-content';
    content.style.maxWidth = '450px';

    var html = '<button style="float:right;background:transparent;border:none;color:var(--text-secondary);font-size:1.5em;cursor:pointer" onclick="document.getElementById(\'iconPickerModal\').remove()" aria-label="Закрыть"><i class="ph ph-x"></i></button>';
    html += '<h2 style="font-family:var(--font-display);color:var(--accent-gold);margin-top:0">Выбери иконку</h2>';
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px">';
    for (var i = 0; i < ICONS.length; i++) {
      var ic = ICONS[i];
      var active = (currentAvatar === ic.id);
      var borderColor = active ? 'var(--accent-gold)' : 'var(--border-subtle)';
      var bg = active ? 'var(--accent-gold-dim)' : 'var(--bg-primary)';
      html += '<button onclick="Profile.setIcon(\'' + ic.id + '\')" style="padding:16px;background:' + bg + ';border:2px solid ' + borderColor + ';border-radius:10px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--text-secondary);transition:all 0.2s;position:relative" onmouseover="this.style.borderColor=\'var(--accent-gold)\'" onmouseout="this.style.borderColor=\'' + borderColor + '\'">' +
        '<i class="ph ' + ic.id + '" style="font-size:2em;color:var(--accent-gold)"></i>' +
        '<span style="font-size:0.75em">' + esc(ic.label) + '</span>' +
        (active ? '<i class="ph-fill ph-check-circle" style="position:absolute;top:6px;right:6px;color:var(--accent-gold);font-size:1.1em"></i>' : '') +
      '</button>';
    }
    html += '</div>';

    content.innerHTML = html;
    modal.appendChild(content);
    document.body.appendChild(modal);
  }

  function setIcon(iconId) {
    setAvatar(iconId);
    var m = document.getElementById('iconPickerModal');
    if (m) m.remove();
    updateModalPreview();
  }

  /* ---------- ПУБЛИЧНЫЙ API ---------- */
  window.Profile = {
    // Геттеры
    getUserName: getUserName,
    getUserAvatar: getUserAvatar,
    getStats: getStats,

    // Сеттеры (единая точка записи)
    setName: setName,
    setAvatar: setAvatar,

    // Утилиты
    isImageAvatar: isImageAvatar,
    isIconAvatar: isIconAvatar,
    renderAvatarHTML: renderAvatarHTML,

    // Сайдбар
    updateSidebar: updateSidebarProfile,

    // Модалка
    openModal: openProfileModal,
    closeModal: closeModal,
    saveProfile: saveProfile,

    // Аватар
    uploadAvatar: uploadAvatar,
    removeAvatar: removeAvatar,
    chooseIcon: chooseIcon,
    setIcon: setIcon,

    // Подписка
    onChange: onChange
  };
})();