// app/profile.js
// Профиль пользователя: имя, аватар, модалка редактирования.
// Использует localStorage (ft_user_name, ft_user_avatar).
// Требует: Logger, Notify.

(function() {
  'use strict';

  var NAME_KEY = 'ft_user_name';
  var AVATAR_KEY = 'ft_user_avatar';

  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
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

  function getUserName() { return readJSON(NAME_KEY) || ''; }
  function getUserAvatar() { return readJSON(AVATAR_KEY); }

  function isImageAvatar(a) {
    return typeof a === 'string' && a.indexOf('data:image') === 0;
  }
  function isIconAvatar(a) {
    return typeof a === 'string' && /^ph-[a-z0-9-]+$/.test(a);
  }

  function renderAvatarHTML(avatar, sizePx, borderPx) {
    sizePx = sizePx || 52;
    borderPx = borderPx || 2;
    if (isImageAvatar(avatar)) {
      return '<img src="' + esc(avatar) + '" style="width:100%;height:100%;object-fit:cover" alt="avatar">';
    }
    if (isIconAvatar(avatar)) {
      return '<i class="ph ' + esc(avatar) + '" style="font-size:' + Math.round(sizePx * 0.55) + 'px;color:var(--accent-gold)"></i>';
    }
    return '<i class="ph ph-user-circle" style="font-size:' + Math.round(sizePx * 0.55) + 'px;color:var(--accent-gold)"></i>';
  }

  // ==== Сайдбар ====
  function updateSidebarProfile() {
    var nameEl = document.getElementById('sidebarName');
    var avatarEl = document.getElementById('sidebarAvatar');
    if (!nameEl || !avatarEl) return;

    var name = getUserName();
    var avatar = getUserAvatar();

    nameEl.innerHTML = '<span>' + esc(name || 'Гость') + '</span><i class="ph ph-pencil-simple"></i>';
    avatarEl.innerHTML = renderAvatarHTML(avatar, 52, 2);
  }

  // ==== Модалка профиля ====
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
          renderAvatarHTML(avatar, 100, 3) +
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
  }

  function closeModal() {
    var m = document.getElementById('profileModal');
    if (m) m.remove();
  }

  function updateModalPreview() {
    var preview = document.getElementById('profileAvatarPreview');
    if (!preview) return;
    var avatar = getUserAvatar();
    preview.innerHTML = renderAvatarHTML(avatar, 100, 3);

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
    writeJSON(NAME_KEY, name);
    closeModal();
    updateSidebarProfile();
    if (window.Notify) window.Notify.success('Профиль сохранён!');
  }

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
          var canvas = document.createElement('canvas');
          var size = 200;
          canvas.width = size;
          canvas.height = size;
          var ctx = canvas.getContext('2d');
          var minDim = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - minDim) / 2, (img.height - minDim) / 2, minDim, minDim, 0, 0, size, size);
          try {
            writeJSON(AVATAR_KEY, canvas.toDataURL('image/jpeg', 0.85));
            updateModalPreview();
            updateSidebarProfile();
            if (window.Notify) window.Notify.success('Аватар обновлён!');
          } catch (err) {
            if (window.Notify) window.Notify.error('Ошибка сохранения');
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
    try { localStorage.removeItem(AVATAR_KEY); } catch (e) {}
    updateModalPreview();
    updateSidebarProfile();
  }

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
      html += '<button onclick="Profile.setIcon(\'' + ic.id + '\')" style="padding:16px;background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:10px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;color:var(--text-secondary);transition:all 0.2s" onmouseover="this.style.borderColor=\'var(--border-gold)\'" onmouseout="this.style.borderColor=\'var(--border-subtle)\'"><i class="ph ' + ic.id + '" style="font-size:2em;color:var(--accent-gold)"></i><span style="font-size:0.75em">' + esc(ic.label) + '</span></button>';
    }
    html += '</div>';

    content.innerHTML = html;
    modal.appendChild(content);
    document.body.appendChild(modal);
  }

  function setIcon(iconId) {
    writeJSON(AVATAR_KEY, iconId);
    var m = document.getElementById('iconPickerModal');
    if (m) m.remove();
    updateModalPreview();
    updateSidebarProfile();
  }

  // Публичный API
  window.Profile = {
    getUserName: getUserName,
    getUserAvatar: getUserAvatar,
    updateSidebar: updateSidebarProfile,
    openModal: openProfileModal,
    closeModal: closeModal,
    saveProfile: saveProfile,
    uploadAvatar: uploadAvatar,
    removeAvatar: removeAvatar,
    chooseIcon: chooseIcon,
    setIcon: setIcon
  };
})();