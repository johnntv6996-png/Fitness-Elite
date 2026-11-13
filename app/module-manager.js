// app/module-manager.js
// Загрузчик модулей. Грузит с GitHub (PROD) или локально из ./modules/ (DEV).
// Требует: Logger, Notify (опционально).

(function() {
  'use strict';

  // ============ НАСТРОЙКИ ============
  var GITHUB_BASE = 'https://raw.githubusercontent.com/johnntv6996-png/Fitness-Elite/main/modules/';
  var LOCAL_BASE = 'modules/';

  // Авто-определение режима:
  // - localhost / 127.0.0.1 / file:// → локально (из ./modules/)
  // - всё остальное (реальный домен) → с GitHub
  // Можно переопределить вручную через localStorage: ft_force_mode = 'local' | 'github'
  function detectMode() {
    try {
      var forced = localStorage.getItem('ft_force_mode');
      if (forced === 'local' || forced === 'github') return forced;
    } catch (e) {}
    var host = location.hostname;
    var proto = location.protocol;
    if (proto === 'file:') return 'local';
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '[::1]') return 'local';
    if (/^192\.168\./.test(host) || /^10\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(host)) return 'local';
    return 'github';
  }

  var MODE = detectMode();
  var DEV_MODE = (MODE === 'local');

  var STORAGE_PREFIX = 'ft_module_';

  // ============ РЕЕСТР МОДУЛЕЙ ============
	var MODULE_REGISTRY = {
		'core':         { name: 'Ядро системы',       version: '5.0.0',  file: '../core/core.js', required: true,  description: 'Базовый функционал' },
		'welcome':      { name: 'Главная',            version: '7.0.1',  file: 'welcome.js',      required: false, description: 'Экран приветствия' },
		'exercises':    { name: 'База упражнений',    version: '6.0.1',  file: 'exercises.js',    required: false, description: 'CRUD упражнений' },
		'plan':         { name: 'План тренировок',    version: '5.0.1',  file: 'plan.js',         required: false, description: 'Настройка плана' },
		'workout':      { name: 'Тренировка',         version: '4.0.2',  file: 'workout.js',      required: false, description: 'Экран тренировки' },
		'workout-flow': { name: 'Пошаговый режим', 		version: '1.0.0',  file: 'workout-flow.js', required: false, description: 'Пошаговая тренировка' },
		'stats':        { name: 'Статистика',         version: '5.0.2',  file: 'stats.js',        required: false, description: 'Графики и аналитика' },
		'survey':       { name: 'Опросы',             version: '4.0.2',  file: 'survey.js',       required: false, description: 'Конструктор опросов' },
		'achievements': { name: 'Достижения',         version: '2.0.2',  file: 'achievements.js', required: false, description: 'Система достижений' },
		'measurements': { name: 'Замеры тела',        version: '1.0.0',  file: 'measurements.js', required: false, description: 'Вес, обхваты, % жира' },
		'nutrition': 		{ name: 'Питание', 						version: '1.0.0',  file:  'nutrition.js', 	required: false, description: 'Дневник питания и БЖУ' },
		'anatomy':      { name: 'Анатомия',           version: '1.0.0',  file: 'anatomy.js',      required: false, description: 'Мышцы и упражнения' },
		'settings':     { name: 'Настройки',          version: '4.0.1',  file: 'settings.js',     required: false, description: 'Параметры и данные' },
		'styles':       { name: 'Стили',              version: '1.0.0',  file: 'styles.js',       required: false, description: 'Выбор и загрузка стилей' }
	};

  function log(msg, type) {
    if (window.Logger && window.Logger.log) window.Logger.log(msg, type || 'info');
    else console.log(msg);
  }

  function moduleUrl(id, config) {
    if (DEV_MODE) return LOCAL_BASE + config.file;
    return GITHUB_BASE + config.file;
  }

  function ModuleManager() {
    this.loadedModules = new Map();  // id -> exports
    this.moduleStatus = new Map();   // id -> 'loading' | 'loaded' | 'error'
    this.registry = MODULE_REGISTRY;
  }

  ModuleManager.prototype.init = async function() {
    log('Инициализация менеджера модулей (DEV_MODE=' + DEV_MODE + ')...', 'info');

    var self = this;
    var coreId = 'core';
    await this.loadModule(coreId, MODULE_REGISTRY[coreId]);

    if (this.moduleStatus.get(coreId) === 'error') {
      log('Критическая ошибка: ядро не загружено', 'error');
      alert('Критическая ошибка: не удалось загрузить ядро системы.');
      return;
    }

    var ids = Object.keys(MODULE_REGISTRY).filter(function(id) { return id !== coreId; });
    await Promise.all(ids.map(function(id) {
      return self.loadModule(id, MODULE_REGISTRY[id]);
    }));

    this.renderModuleList();

    var self2 = this;
    setTimeout(function() {
      self2.initializeUserInterface();
    }, 100);
  };

  ModuleManager.prototype.loadModule = async function(id, config) {
    var self = this;
    var storageKey = STORAGE_PREFIX + id;

    // В PROD-режиме пробуем взять из кэша (если версия совпадает)
    if (!DEV_MODE) {
      var cached = null;
      try { cached = localStorage.getItem(storageKey); } catch (e) {}
      if (cached) {
        try {
          var parsed = JSON.parse(cached);
          if (parsed.version === config.version && parsed.code) {
            log('Модуль ' + id + ' актуален (v' + parsed.version + ', из кэша)', 'info');
            this.executeModule(id, parsed.code);
            if (this.moduleStatus.get(id) !== 'error') this.moduleStatus.set(id, 'loaded');
            return;
          }
        } catch (e) {
          log('Ошибка чтения кэша ' + id, 'warn');
        }
      }
    }

    log('Загрузка модуля ' + id + ' (v' + config.version + ')...', 'info');
    this.moduleStatus.set(id, 'loading');
    this.renderModuleList();

    var url = moduleUrl(id, config);

    try {
      var controller = new AbortController();
      var timeout = setTimeout(function() { controller.abort(); }, 10000);
      var response = await fetch(url, { signal: controller.signal, cache: DEV_MODE ? 'no-store' : 'default' });
      clearTimeout(timeout);

      if (!response.ok) throw new Error('HTTP ' + response.status + ' (' + url + ')');
      var code = await response.text();

      // В PROD-режиме кэшируем
      if (!DEV_MODE) {
        try {
          localStorage.setItem(storageKey, JSON.stringify({
            version: config.version,
            code: code,
            loadedAt: Date.now()
          }));
        } catch (e) { log('Не удалось закэшировать ' + id, 'warn'); }
      }

      log('Модуль ' + id + ' загружен (v' + config.version + ')', 'info');
      this.executeModule(id, code);
      if (this.moduleStatus.get(id) !== 'error') this.moduleStatus.set(id, 'loaded');
    } catch (error) {
      log('Ошибка загрузки ' + id + ': ' + error.message, 'error');
      this.moduleStatus.set(id, 'error');
      if (config.required) {
        alert('Критическая ошибка: не удалось загрузить модуль "' + config.name + '"');
      }
    }

    this.renderModuleList();
  };

  ModuleManager.prototype.executeModule = function(id, code) {
    try {
      var moduleExports = {};
      var moduleContext = { exports: moduleExports, module: { exports: moduleExports } };
      var func = new Function('module', 'exports', 'require', 'Logger', code + '\n//# sourceURL=' + id + '.js');
      func.call(moduleContext, moduleContext.module, moduleContext.exports, this.require.bind(this), window.Logger);
      this.loadedModules.set(id, moduleContext.module.exports || moduleExports);
      log('Модуль ' + id + ' выполнен', 'info');
    } catch (error) {
      log('Ошибка выполнения ' + id + ': ' + error.message, 'error');
      this.moduleStatus.set(id, 'error');
    }
  };

  ModuleManager.prototype.require = function(moduleId) {
    if (!this.loadedModules.has(moduleId)) throw new Error('Модуль ' + moduleId + ' не загружен');
    return this.loadedModules.get(moduleId);
  };

  ModuleManager.prototype.initializeUserInterface = function() {
    log('Инициализация пользовательского интерфейса...', 'info');
    this.loadedModules.forEach(function(mod, id) {
      if (mod && typeof mod.init === 'function') {
        try {
          log('Вызов init() для модуля ' + id + '...', 'info');
          mod.init();
          log('Модуль ' + id + ' инициализирован', 'info');
        } catch (error) {
          log('Ошибка инициализации ' + id + ': ' + error.message, 'error');
          console.error('Error in module ' + id + ':', error);
        }
      }
    });
    if (window.Profile && window.Profile.updateSidebar) window.Profile.updateSidebar();
    if (typeof window.refreshHeaderAfterXP === 'function') window.refreshHeaderAfterXP();
  };

  ModuleManager.prototype.renderModuleList = function() {
    var container = document.getElementById('moduleList');
    if (!container) return;
    var html = '';
    for (var id in MODULE_REGISTRY) {
      var config = MODULE_REGISTRY[id];
      var status = this.moduleStatus.get(id) || 'loading';
      var statusText = { 'loaded': 'Загружен', 'loading': 'Загрузка...', 'error': 'Ошибка' }[status] || status;
      html += '<div class="module-item ' + status + '">';
      html += '<div style="flex:1;min-width:200px"><div style="font-weight:600;font-size:1.05em">' + config.name + '</div>';
      html += '<div class="text-small" style="margin-top:4px">' + config.description + '</div>';
      html += '<div class="text-small" style="margin-top:4px">v' + config.version + ' · ' + statusText + '</div></div>';
      html += '<div style="display:flex;gap:8px">';
      if (status === 'error') html += '<button class="btn btn-secondary" onclick="moduleManager.retryModule(\'' + id + '\')" style="padding:8px 14px"><i class="ph ph-arrows-clockwise"></i></button>';
      html += '<button class="btn btn-danger" onclick="moduleManager.clearModule(\'' + id + '\')" style="padding:8px 14px"><i class="ph ph-trash"></i></button>';
      html += '</div></div>';
    }
    container.innerHTML = html;
  };

  ModuleManager.prototype.retryModule = async function(id) {
    var config = MODULE_REGISTRY[id];
    if (!config) return;
    try { localStorage.removeItem(STORAGE_PREFIX + id); } catch (e) {}
    await this.loadModule(id, config);
  };

  ModuleManager.prototype.clearModule = function(id) {
    if (!confirm('Удалить модуль "' + MODULE_REGISTRY[id].name + '" из кэша?')) return;
    try { localStorage.removeItem(STORAGE_PREFIX + id); } catch (e) {}
    this.loadedModules.delete(id);
    this.moduleStatus.delete(id);
    this.renderModuleList();
    log('Модуль ' + id + ' удалён из кэша', 'info');
  };

  ModuleManager.prototype.checkAllModules = async function() {
    log('Проверка обновлений...', 'info');
    var self = this;
    var ids = Object.keys(MODULE_REGISTRY);
    // Сбрасываем кэш для всех (в PROD), чтобы реально перезагрузить
    if (!DEV_MODE) {
      ids.forEach(function(id) {
        try { localStorage.removeItem(STORAGE_PREFIX + id); } catch (e) {}
      });
    }
    await Promise.all(ids.map(function(id) {
      return self.loadModule(id, MODULE_REGISTRY[id]);
    }));
    this.initializeUserInterface();
    if (window.Notify) window.Notify.success('Все модули проверены!');
  };

  ModuleManager.prototype.clearAllCache = function() {
    if (!confirm('Удалить все модули из кэша?')) return;
    Object.keys(localStorage).forEach(function(key) {
      if (key.indexOf(STORAGE_PREFIX) === 0) localStorage.removeItem(key);
    });
    this.loadedModules.clear();
    this.moduleStatus.clear();
    this.renderModuleList();
    location.reload();
  };
	
	ModuleManager.prototype.getMode = function() {
    return MODE;
  };
  ModuleManager.prototype.setMode = function(mode) {
    if (mode !== 'local' && mode !== 'github') return;
    try { localStorage.setItem('ft_force_mode', mode); } catch (e) {}
    location.reload();
  };
	
  // Публичный API
  window.ModuleManager = ModuleManager;
  window.MODULE_REGISTRY = MODULE_REGISTRY;
  window.moduleManager = new ModuleManager();
})();