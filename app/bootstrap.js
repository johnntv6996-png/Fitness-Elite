// app/bootstrap.js
// Точка входа. Создаёт разметку приложения, запускает ModuleManager.
// Требует: Logger, Notify, Profile, BugReport, ModuleManager, StyleManager (опционально).

(function() {
  'use strict';

  function buildLayout() {
    var app = document.getElementById('app');
    if (!app) {
      console.error('bootstrap: #app не найден в index.html');
      return;
    }

    app.innerHTML =
      // === Контейнеры для всплывашек и частиц ===
      '<div id="achievementContainer"></div>' +
      '<div class="achievement-particles" id="achievementParticles"></div>' +

      // === Оверлей сайдбара ===
      '<div class="sidebar-overlay" id="sidebarOverlay" onclick="toggleSidebar()"></div>' +

      // === Сайдбар ===
      '<aside class="sidebar" id="sidebar">' +
        '<div class="sidebar-header" onclick="goHome()" style="cursor:pointer">' +
          '<h2><i class="ph ph-barbell"></i> FITNESS ELITE</h2>' +
        '</div>' +
        '<div class="sidebar-profile" id="sidebarProfile" onclick="Profile.openModal()">' +
          '<div class="sidebar-profile-top">' +
            '<div class="sidebar-profile-avatar" id="sidebarAvatar"><i class="ph ph-user-circle"></i></div>' +
            '<div class="sidebar-profile-info">' +
              '<div class="sidebar-profile-name" id="sidebarName"><span>Гость</span><i class="ph ph-pencil-simple"></i></div>' +
              '<div class="sidebar-profile-sub">Нажми для редактирования</div>' +
            '</div>' +
          '</div>' +
          '<div class="profile-level-block">' +
            '<div class="profile-level-top">' +
              '<div class="profile-level-left">' +
                '<i class="ph ph-star profile-level-icon" id="headerLevelIcon"></i>' +
                '<div class="profile-level-num"><span id="headerLevelNum">1</span><span class="profile-level-label">уровень</span></div>' +
              '</div>' +
              '<div class="profile-xp-block">' +
                '<div class="profile-xp-text"><span>XP</span><span><strong id="headerXpCurrent">0</strong> / <span id="headerXpNeeded">100</span></span></div>' +
                '<div class="profile-xp-bar"><div class="profile-xp-fill" id="headerXpFill" style="width:0%"></div></div>' +
                '<div class="profile-ach-hint"><i class="ph ph-trophy"></i><span id="headerAchText">до ур. 5: 400 XP</span></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="sidebar-section" id="sidebarMenu">' +
          '<div class="sidebar-section-title">Навигация</div>' +
        '</div>' +
        '<div class="sidebar-divider"></div>' +
        '<div class="sidebar-section">' +
          '<div class="sidebar-item" onclick="BugReport.openModal()"><i class="ph ph-bug"></i> Баг-репорт</div>' +
          '<div class="sidebar-item" onclick="toggleSidebar(); switchMode(\'dev\')"><i class="ph ph-code"></i> Панель разработчика</div>' +
        '</div>' +
      '</aside>' +

      // === Шапка ===
      '<div class="header-wrapper">' +
        '<div class="header" id="mainHeader" onclick="goHome()">' +
          '<div class="header-left">' +
            '<button class="hamburger" id="hamburgerBtn" onclick="event.stopPropagation(); toggleSidebar()"><span></span><span></span><span></span></button>' +
            '<h1><i class="ph ph-barbell"></i> FITNESS ELITE</h1>' +
          '</div>' +
          '<div class="header-right">' +
            '<button class="theme-btn" id="styleBtn" title="Стиль (правый клик — все стили)">' +
              '<i class="ph ph-palette"></i>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // === Основной контент ===
      '<div class="main-content">' +
        '<div id="userInterface">' +
          '<div id="screen-welcome" class="screen active">' +
            '<div class="loading"><i class="ph ph-barbell icon-large"></i><h2>Добро пожаловать</h2><p class="text-small">Загрузка модулей...</p></div>' +
          '</div>' +
        '</div>' +
        '<div id="devInterface" style="display:none">' +
          '<div class="dev-panel">' +
            '<h3 style="font-family:var(--font-display);font-size:1.6em;margin-bottom:20px;color:var(--accent-gold);display:flex;align-items:center;gap:10px"><i class="ph ph-cube"></i> Управление модулями</h3>' +
            '<div id="moduleList"></div>' +
            '<div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap">' +
              '<button class="btn btn-primary" onclick="moduleManager.checkAllModules()"><i class="ph ph-arrows-clockwise"></i> Проверить обновления</button>' +
              '<button class="btn btn-danger" onclick="moduleManager.clearAllCache()"><i class="ph ph-trash"></i> Очистить кэш</button>' +
            '</div>' +
          '</div>' +
          '<div class="dev-panel">' +
            '<h3 style="font-family:var(--font-display);font-size:1.6em;margin-bottom:20px;color:var(--accent-gold);display:flex;align-items:center;gap:10px"><i class="ph ph-scroll"></i> Системные логи</h3>' +
            '<div class="console-log" id="consoleLog"></div>' +
            '<button class="btn btn-secondary" onclick="Logger.clear()" style="margin-top:16px"><i class="ph ph-eraser"></i> Очистить логи</button>' +
          '</div>' +
          '<div class="dev-panel">' +
            '<h3 style="font-family:var(--font-display);font-size:1.6em;margin-bottom:20px;color:var(--accent-gold);display:flex;align-items:center;gap:10px"><i class="ph ph-bug"></i> Баг-репорты</h3>' +
            '<div id="bugReportsList"></div>' +
            '<button class="btn btn-danger" onclick="BugReport.clearAll()" style="margin-top:16px"><i class="ph ph-trash"></i> Очистить все репорты</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Рисуем сохранённый Logger, если он что-то накопил до появления #consoleLog
    if (window.Logger && window.Logger.renderConsole) window.Logger.renderConsole();
    // Обновляем профиль в сайдбаре
    if (window.Profile && window.Profile.updateSidebar) window.Profile.updateSidebar();
  }

  // === Глобальные функции, которые дергают кнопки в разметке ===

  window.toggleSidebar = function() {
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');
    var hamburger = document.getElementById('hamburgerBtn');
    if (!sidebar || !overlay || !hamburger) return;
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    hamburger.classList.toggle('active');
    document.body.classList.toggle('sidebar-open', sidebar.classList.contains('active'));
  };

  window.goHome = function() {
    if (window.Core && typeof window.Core.navigate === 'function') {
      window.Core.navigate('welcome');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    var sb = document.getElementById('sidebar');
    if (sb && sb.classList.contains('active')) window.toggleSidebar();
  };

  window.switchMode = function(mode) {
    var user = document.getElementById('userInterface');
    var dev = document.getElementById('devInterface');
    if (user) user.style.display = mode === 'user' ? 'block' : 'none';
    if (dev) dev.style.display = mode === 'dev' ? 'block' : 'none';
    if (mode === 'dev' && window.BugReport && window.BugReport.renderReportsList) {
      window.BugReport.renderReportsList();
    }
  };

  // === Обновление шапки (уровень/XP) ===
  window.refreshHeaderAfterXP = function() {
    var stats = null;
    try { stats = JSON.parse(localStorage.getItem('ft_stats')); } catch (e) { stats = null; }
    if (!stats) stats = { xp: 0, level: 1, streak: 0, yes: 0 };

    var level = stats.level || 1;
    var xp = stats.xp || 0;

    var xpForLevel = function(lv) {
      if (window.Core && window.Core.utils && window.Core.utils.xpForLevel) {
        return window.Core.utils.xpForLevel(lv);
      }
      return Math.floor(100 * Math.pow(1.2, Math.max(0, (lv || 1) - 1)));
    };
    var cumulativeXpForLevel = function(lv) {
      if (window.Core && window.Core.utils && window.Core.utils.cumulativeXpForLevel) {
        return window.Core.utils.cumulativeXpForLevel(lv);
      }
      var total = 0;
      for (var i = 1; i < (lv || 1); i++) total += Math.floor(100 * Math.pow(1.2, i - 1));
      return total;
    };

    var xpNeeded = xpForLevel(level);
    var xpPercent = xpNeeded > 0 ? Math.min(100, Math.round((xp / xpNeeded) * 100)) : 0;

    var iconEl = document.getElementById('headerLevelIcon');
    if (iconEl) {
      var icon = 'ph-star';
      if (window.Core && window.Core.utils && window.Core.utils.getLevelIcon) icon = window.Core.utils.getLevelIcon(level);
      else if (level >= 50) icon = 'ph-diamond';
      else if (level >= 20) icon = 'ph-crown';
      else if (level >= 10) icon = 'ph-trophy';
      else if (level >= 5) icon = 'ph-star-four';
      iconEl.className = 'ph ' + icon + ' profile-level-icon';
    }

    var numEl = document.getElementById('headerLevelNum');
    if (numEl) numEl.textContent = level;
    var xpCurEl = document.getElementById('headerXpCurrent');
    if (xpCurEl) xpCurEl.textContent = xp;
    var xpNeedEl = document.getElementById('headerXpNeeded');
    if (xpNeedEl) xpNeedEl.textContent = xpNeeded;
    var fillEl = document.getElementById('headerXpFill');
    if (fillEl) fillEl.style.width = xpPercent + '%';

    var thresholds = [5, 10, 20, 50, 100];
    var nextAch = null;
    for (var i = 0; i < thresholds.length; i++) {
      if (level < thresholds[i]) { nextAch = thresholds[i]; break; }
    }
    var achText = document.getElementById('headerAchText');
    if (achText) {
      if (nextAch) {
        var totalXp = cumulativeXpForLevel(level) + xp;
        var nextTotalXp = cumulativeXpForLevel(nextAch);
        var xpToNext = Math.max(0, nextTotalXp - totalXp);
        achText.textContent = 'до ур. ' + nextAch + ': ' + xpToNext + ' XP';
      } else {
        achText.textContent = 'Максимальный уровень!';
      }
    }
  };

  // === Тост достижения ===
  window.showAchievementToast = function(name, description, icon) {
    icon = icon || 'ph-trophy';
    var container = document.getElementById('achievementContainer');
    if (!container) return;
    if (container.children.length >= 3) container.firstChild.remove();

    var toast = document.createElement('div');
    toast.className = 'achievement-toast';
    toast.innerHTML =
      '<i class="ph-fill ' + icon + ' ach-icon"></i>' +
      '<div class="ach-text">' +
        '<div class="ach-title">🏆 Достижение разблокировано!</div>' +
        '<div class="ach-desc"><strong>' + (name || '') + '</strong> — ' + (description || '') + '</div>' +
      '</div>';
    container.appendChild(toast);
    setTimeout(function() { toast.classList.add('show'); }, 50);
    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() { toast.remove(); }, 600);
    }, 4000);
  };

  // === Попап стилей (bottom sheet) ===
  window.openStyleQuickPicker = function() {
    var old = document.getElementById('styleQuickPicker');
    if (old) { old.remove(); return; }

    var overlay = document.createElement('div');
    overlay.id = 'styleQuickPicker';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:2000;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.2s ease-out';
		
    var sheet = document.createElement('div');
    sheet.style.cssText = 'background:var(--bg-secondary);border-radius:20px 20px 0 0;border-top:1px solid var(--border-gold);width:100%;max-width:500px;max-height:70vh;overflow-y:auto;padding:16px 16px 24px;animation:slideUp 0.3s ease-out;box-shadow:0 -10px 40px rgba(0,0,0,0.5);';
		
    var all = (typeof StyleManager !== 'undefined') ? StyleManager.getAllStyles() : [];
    var current = (typeof StyleManager !== 'undefined') ? StyleManager.getCurrentStyle() : '';

    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
    html += '<div style="font-family:var(--font-display);color:var(--accent-gold);font-size:1.2em;font-weight:700"><i class="ph ph-palette"></i> Стиль</div>';
    html += '<button style="background:transparent;border:none;color:var(--text-secondary);font-size:1.4em;cursor:pointer" onclick="document.getElementById(\'styleQuickPicker\').remove()"><i class="ph ph-x"></i></button>';
    html += '</div>';

    for (var i = 0; i < all.length; i++) {
      var s = all[i];
      var active = s.id === current;
      html += '<div onclick="selectStyle(\'' + s.id + '\')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;margin-bottom:4px;border:1px solid ' + (active ? 'var(--accent-gold)' : 'transparent') + ';background:' + (active ? 'var(--accent-gold-dim)' : 'transparent') + '">';
      html += '<div style="display:flex;gap:3px;flex-shrink:0">';
      for (var k = 0; k < s.colors.length; k++) {
        html += '<div style="width:10px;height:10px;border-radius:50%;background:' + s.colors[k] + '"></div>';
      }
      html += '</div>';
      html += '<div style="flex:1;min-width:0">';
      html += '<div style="font-weight:600;font-size:0.9em">' + s.name + '</div>';
      html += '<div style="font-size:0.72em;opacity:0.6">' + (s.description || '') + '</div>';
      html += '</div>';
      if (active) html += '<i class="ph ph-check-circle" style="color:var(--accent-gold);font-size:1.1em"></i>';
      html += '</div>';
    }

    html += '<button onclick="openStylesPage()" style="width:100%;margin-top:10px;padding:12px;border-radius:10px;border:1px solid var(--border-subtle);background:transparent;color:var(--text-secondary);font-weight:600;font-size:0.85em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px"><i class="ph ph-sliders"></i> Все стили</button>';

    sheet.innerHTML = html;
    overlay.appendChild(sheet);
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    document.body.appendChild(overlay);
  };

  window.selectStyle = function(id) {
    if (typeof StyleManager !== 'undefined') StyleManager.applyStyle(id);
    var picker = document.getElementById('styleQuickPicker');
    if (picker) picker.remove();
    if (typeof Notify !== 'undefined') Notify.success('Стиль применён');
  };

  window.openStylesPage = function() {
    var picker = document.getElementById('styleQuickPicker');
    if (picker) picker.remove();
    if (window.Core && typeof window.Core.navigate === 'function') {
      window.Core.navigate('styles');
    }
  };

  // === Запуск ===
  function start() {
    buildLayout();
		window.updateModeIndicator();
    if (window.Profile && window.Profile.updateSidebar) window.Profile.updateSidebar();
    window.refreshHeaderAfterXP();

    // Кнопка «Стиль» в шапке
    var styleBtn = document.getElementById('styleBtn');
    if (styleBtn) {
      styleBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        window.openStyleQuickPicker();
      });
      styleBtn.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        window.openStylesPage();
      });

      var longTapTimer = null;
      styleBtn.addEventListener('touchstart', function() {
        longTapTimer = setTimeout(function() {
          window.openStylesPage();
          longTapTimer = null;
        }, 600);
      }, { passive: true });
      styleBtn.addEventListener('touchend', function() {
        if (longTapTimer) { clearTimeout(longTapTimer); longTapTimer = null; }
      });
      styleBtn.addEventListener('touchmove', function() {
        if (longTapTimer) { clearTimeout(longTapTimer); longTapTimer = null; }
      });
    }

    if (window.moduleManager && typeof window.moduleManager.init === 'function') {
      window.moduleManager.init();
    } else {
      console.error('bootstrap: moduleManager не найден');
    }
  }
	
  // === Переключатель режима модулей (local / github) ===
  window.switchModuleMode = function() {
    var current = moduleManager.getMode ? moduleManager.getMode() : 'local';
    var next = current === 'local' ? 'github' : 'local';
    try { localStorage.setItem('ft_force_mode', next); } catch (e) {}
    if (typeof Notify !== 'undefined') Notify.info('Режим: ' + (next === 'local' ? 'локальный' : 'GitHub') + '. Перезагрузка...');
    setTimeout(function() { location.reload(); }, 800);
  };

  window.updateModeIndicator = function() {
    var el = document.getElementById('modeIndicator');
    if (!el) return;
    var mode = moduleManager.getMode ? moduleManager.getMode() : 'local';
    el.textContent = mode === 'local' ? 'Локально (./modules/)' : 'GitHub';
    el.style.color = mode === 'local' ? 'var(--accent-success)' : 'var(--accent-gold)';
  };
	
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();