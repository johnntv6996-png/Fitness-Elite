// modules/survey.js
const SurveyModule = {
  _currentQ: 0,
  _answers: {},
  _surveyCallback: null,
  _isTestMode: false,
  init: function() {
    if (typeof Logger !== 'undefined') Logger.log('Модуль опросов инициализирован', 'info');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { SurveyModule.setup(); });
    } else { this.setup(); }
  },
  setup: function() {
    this.createSurveyScreen();
    if (typeof Core !== 'undefined') {
      Core.addNavButton('Опросы', 'survey', '<i class="ph ph-clipboard-text"></i>');
      Core.registerScreen('survey', function() { SurveyModule.createSurveyScreen(); });
    }
  },
  getSurveyConfig: function() {
    if (typeof CoreData !== 'undefined') return CoreData.getSurveyConfig();
    return (typeof FTStorage !== 'undefined' ? FTStorage.get('survey_config') : null) || null;
  },
  saveSurveyConfig: function(c) {
    if (typeof CoreData !== 'undefined') { CoreData.setSurveyConfig(c); return; }
    if (typeof FTStorage !== 'undefined') FTStorage.set('survey_config', c);
  },
  getDefaultSurvey: function() {
    return {
      questions: [
        { id: 'q1', type: 'rating', text: 'Как ты себя чувствуешь?', min: 1, max: 10 },
        { id: 'q2', type: 'rating', text: 'Насколько сложной была тренировка?', min: 1, max: 10 },
        { id: 'q3', type: 'rating', text: 'Насколько доволен результатом?', min: 1, max: 10 },
        { id: 'q4', type: 'text', text: 'Что понравилось больше всего?' },
        { id: 'q5', type: 'text', text: 'Что можно улучшить?' }
      ]
    };
  },
  createSurveyScreen: function() {
    var esc = Core.utils.escapeHtml;
    var screen = document.getElementById('screen-survey');
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'screen-survey';
      screen.className = 'screen';
      document.getElementById('userInterface').appendChild(screen);
    }
    var config = this.getSurveyConfig() || this.getDefaultSurvey();
    var hintsEnabled = typeof shouldShowHints === 'function' ? shouldShowHints() : true;
    var css = '<style>' +
      '.survey-q { background:var(--bg-card); border-radius:12px; padding:16px; margin-bottom:12px; border:1px solid var(--border-subtle); transition:all 0.2s; }' +
      '.survey-q:hover { border-color:var(--border-gold); }' +
      '.hint { font-size:0.75em; opacity:0.6; margin-top:3px; color:var(--text-secondary); }' +
      '.type-badge { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:10px; font-size:0.75em; font-weight:600; }' +
      '.type-badge.rating { background:rgba(212,175,55,0.2); color:var(--accent-gold); }' +
      '.type-badge.emoji { background:rgba(244,114,182,0.2); color:#f472b6; }' +
      '.type-badge.range { background:rgba(96,165,250,0.2); color:#60a5fa; }' +
      '.type-badge.number { background:rgba(74,222,128,0.2); color:#4ade80; }' +
      '.type-badge.text { background:rgba(160,160,176,0.2); color:var(--text-secondary); }' +
      '.type-badge.yesno { background:rgba(167,139,250,0.2); color:#a78bfa; }' +
      '.metric-chip { display:flex; align-items:center; gap:6px; padding:6px 10px; background:var(--bg-secondary); border:1px solid var(--border-subtle); border-radius:16px; cursor:pointer; transition:all 0.2s; user-select:none; white-space:nowrap; flex-shrink:0; font-size:0.85em; }' +
      '.metric-chip:hover { border-color:var(--border-gold); }' +
      '.metric-chip.active { border-color:var(--accent-gold); background:var(--accent-gold-dim); }' +
      '@media (prefers-reduced-motion: reduce) { .survey-q, .metric-chip { transition: none !important; } }' +
    '</style>';
    var html = css + '<div style="padding:8px;max-width:700px;margin:0 auto">';
    html += '<h2 style="font-family:var(--font-display);font-size:2em;margin-bottom:10px;color:var(--accent-gold);display:flex;align-items:center;gap:12px"><i class="ph ph-clipboard-text"></i> Конструктор опросов</h2>';
    if (hintsEnabled) html += '<div class="hint" style="margin-bottom:18px;display:flex;align-items:center;gap:6px"><i class="ph ph-info"></i> Числовые вопросы автоматически появятся на графике в статистике.</div>';
    html += '<div style="background:var(--accent-gold-dim);border:1px solid var(--border-gold);border-radius:10px;padding:12px 16px;margin-bottom:18px;font-size:0.9em;display:flex;align-items:start;gap:10px">';
    html += '<i class="ph ph-chart-line-up" style="color:var(--accent-gold);font-size:1.2em;margin-top:2px"></i>';
    html += '<div><strong style="color:var(--accent-gold)">Связь со статистикой:</strong><div style="margin-top:4px;opacity:0.8">Числовые вопросы автоматически становятся метриками на графике.</div></div>';
    html += '</div>';
    html += '<button class="btn btn-primary" style="width:100%;padding:14px;font-size:1em;font-weight:600;margin-bottom:18px" onclick="SurveyModule.openAddQuestionModal()"><i class="ph ph-plus-circle"></i> Добавить вопрос</button>';
    html += '<button class="btn btn-secondary" style="width:100%;padding:12px;font-size:0.95em;margin-bottom:18px" onclick="SurveyModule.resetToDefault()"><i class="ph ph-arrows-counter-clockwise"></i> Сбросить к стандартным</button>';
    for (var i = 0; i < config.questions.length; i++) {
      var q = config.questions[i];
      var typeClass = q.type || 'text';
      var typeLabel = { rating: 'Оценка', emoji: 'Эмодзи', range: 'Диапазон', number: 'Число', text: 'Текст', yesno: 'Да/Нет' }[q.type] || q.type;
      var isNumeric = ['rating', 'emoji', 'range', 'number'].indexOf(q.type) !== -1;
      html += '<div class="survey-q">';
      html += '<div style="display:flex;justify-content:space-between;align-items:start;gap:10px">';
      html += '<div style="flex:1">';
      html += '<div style="font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="color:var(--accent-gold);font-weight:700">' + (i + 1) + '.</span> ' + esc(q.text);
      if (isNumeric) html += ' <i class="ph ph-chart-line-up" style="color:var(--accent-gold);font-size:0.9em" title="Появится на графике"></i>';
      html += '</div>';
      html += '<div style="font-size:0.85em;opacity:0.7;display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
      html += '<span class="type-badge ' + typeClass + '">' + typeLabel + '</span>';
      if (q.type === 'rating') html += '<span>· ' + q.min + '–' + q.max + '</span>';
      else if (q.type === 'range') html += '<span>· ' + q.min + '–' + q.max + '</span>';
      else if (q.type === 'emoji') html += '<span>· ' + (q.emojiSet ? Object.keys(q.emojiSet).length : 0) + ' вариантов</span>';
      html += '</div>';
      html += '</div>';
      html += '<div style="display:flex;gap:6px">';
      html += '<button class="btn btn-secondary" style="padding:6px 10px;font-size:0.85em" onclick="SurveyModule.editQuestion(' + i + ')" aria-label="Редактировать"><i class="ph ph-pencil-simple"></i></button>';
      html += '<button class="btn btn-danger" style="padding:6px 10px;font-size:0.85em" onclick="SurveyModule.deleteQuestion(' + i + ')" aria-label="Удалить"><i class="ph ph-trash"></i></button>';
      html += '</div></div></div>';
    }
    html += '<button class="btn btn-success" style="width:100%;padding:14px;font-size:1em;font-weight:600;margin-top:16px" onclick="SurveyModule.testSurvey()"><i class="ph ph-play-circle"></i> Тестовый запуск</button>';
    html += '</div>';
    screen.innerHTML = html;
  },
  resetToDefault: function() {
    if (!confirm('Сбросить опрос к стандартным вопросам?')) return;
    this.saveSurveyConfig(this.getDefaultSurvey());
    this.createSurveyScreen();
  },
  openAddQuestionModal: function(editIdx) {
    var esc = Core.utils.escapeHtml;
    var config = this.getSurveyConfig() || this.getDefaultSurvey();
    var q = (editIdx !== undefined && editIdx !== null) ? config.questions[editIdx] : null;
    var isEdit = q !== null;
    var oldModal = document.getElementById('questionModal');
    if (oldModal) oldModal.remove();
    var modal = document.createElement('div');
    modal.className = 'ex-modal';
    modal.id = 'questionModal';
    modal.style.zIndex = '2100';
    var content = document.createElement('div');
    content.className = 'ex-modal-content';
    content.style.maxWidth = '500px';
    content.innerHTML =
      '<button style="float:right;background:transparent;border:none;color:var(--text-secondary);font-size:1.5em;cursor:pointer" onclick="document.getElementById(\'questionModal\').remove()" aria-label="Закрыть"><i class="ph ph-x"></i></button>' +
      '<h2 style="font-family:var(--font-display);color:var(--accent-gold);margin-top:0;display:flex;align-items:center;gap:10px"><i class="ph ph-plus-circle"></i> ' + (isEdit ? 'Редактировать вопрос' : 'Новый вопрос') + '</h2>' +
      '<div style="margin-bottom:14px">' +
        '<label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em">Текст вопроса:</label>' +
        '<input type="text" id="qText" value="' + esc(q ? q.text : '') + '" placeholder="Например: Как ты себя чувствуешь?" style="width:100%;padding:10px;background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:1em">' +
      '</div>' +
      '<div style="margin-bottom:14px">' +
        '<label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em">Тип вопроса:</label>' +
        '<div id="typeSelector" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px"></div>' +
      '</div>' +
      '<div id="typeSettings"></div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">' +
        '<button class="btn btn-secondary" onclick="document.getElementById(\'questionModal\').remove()">Отмена</button>' +
        '<button class="btn btn-primary" onclick="SurveyModule.saveQuestion(' + (isEdit ? editIdx : 'null') + ')"><i class="ph ph-floppy-disk"></i> Сохранить</button>' +
      '</div>';
    modal.appendChild(content);
    document.body.appendChild(modal);
    var types = [
      { id: 'rating', label: 'Оценка', icon: 'ph-star', desc: '1–10' },
      { id: 'emoji', label: 'Эмодзи', icon: 'ph-smiley', desc: 'Свои эмодзи' },
      { id: 'range', label: 'Диапазон', icon: 'ph-slider', desc: 'Слайдер' },
      { id: 'number', label: 'Число', icon: 'ph-hash', desc: 'Ввод числа' },
      { id: 'yesno', label: 'Да / Нет', icon: 'ph-check-circle', desc: 'Два варианта' },
      { id: 'text', label: 'Текст', icon: 'ph-text-t', desc: 'Свободный ответ' }
    ];
    var currentType = q ? q.type : 'rating';
    var typeSelector = document.getElementById('typeSelector');
    types.forEach(function(t) {
      var btn = document.createElement('div');
      btn.className = 'metric-chip' + (currentType === t.id ? ' active' : '');
      btn.style.cssText = 'flex-direction:column;padding:10px;gap:4px;text-align:center;flex:1;min-width:0';
      btn.innerHTML = '<i class="ph ' + t.icon + '" style="font-size:1.3em"></i><div style="font-size:0.85em;font-weight:600">' + t.label + '</div><div style="font-size:0.7em;opacity:0.6">' + t.desc + '</div>';
      btn.onclick = function() {
        currentType = t.id;
        typeSelector.querySelectorAll('.metric-chip').forEach(function(c) { c.classList.remove('active'); });
        btn.classList.add('active');
        SurveyModule.renderTypeSettings(t.id, q);
      };
      typeSelector.appendChild(btn);
    });
    this.renderTypeSettings(currentType, q);
  },
  renderTypeSettings: function(type, q) {
    var esc = Core.utils.escapeHtml;
    var container = document.getElementById('typeSettings');
    if (!container) return;
    q = q || {};
    var html = '';
    if (type === 'rating') {
      html = '<div style="background:var(--bg-primary);padding:14px;border-radius:10px;border:1px solid var(--border-subtle)">' +
        '<label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em"><i class="ph ph-star" style="color:var(--accent-gold)"></i> Диапазон оценки:</label>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
          '<div><label style="font-size:0.8em;opacity:0.7">Мин:</label><input type="number" id="qMin" value="' + (q.min || 1) + '" min="0" max="100" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:6px;color:var(--text-primary)"></div>' +
          '<div><label style="font-size:0.8em;opacity:0.7">Макс:</label><input type="number" id="qMax" value="' + (q.max || 10) + '" min="1" max="100" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:6px;color:var(--text-primary)"></div>' +
        '</div>' +
      '</div>';
    } else if (type === 'emoji') {
      var existingEmojiList = '';
      if (q.emojiSet) {
        var vals = Object.values(q.emojiSet);
        existingEmojiList = vals.join(', ');
      } else if (q.emojiList) {
        existingEmojiList = q.emojiList;
      }
      html = '<div style="background:var(--bg-primary);padding:14px;border-radius:10px;border:1px solid var(--border-subtle)">' +
        '<label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em"><i class="ph ph-smiley" style="color:#f472b6"></i> Свои эмодзи:</label>' +
        '<label style="font-size:0.8em;opacity:0.7;display:block;margin-bottom:6px">Введи эмодзи через запятую, от худшего к лучшему. Например: 😢, 😟, 😐, 🙂, 😊</label>' +
        '<input type="text" id="qEmojiCustom" value="' + esc(existingEmojiList) + '" placeholder="😢, 😟, 😐, 🙂, 😊" style="width:100%;padding:10px;background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:6px;color:var(--text-primary);font-size:1.1em">' +
        '<div class="hint" style="display:flex;align-items:center;gap:4px;margin-top:6px"><i class="ph ph-info"></i> Минимум 2 эмодзи. Каждый станет отдельной кнопкой ответа.</div>' +
      '</div>';
    } else if (type === 'range') {
      html = '<div style="background:var(--bg-primary);padding:14px;border-radius:10px;border:1px solid var(--border-subtle)">' +
        '<label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em"><i class="ph ph-slider" style="color:#60a5fa"></i> Диапазон:</label>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
          '<div><label style="font-size:0.8em;opacity:0.7">От:</label><input type="number" id="qMin" value="' + (q.min || 0) + '" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:6px;color:var(--text-primary)"></div>' +
          '<div><label style="font-size:0.8em;opacity:0.7">До:</label><input type="number" id="qMax" value="' + (q.max || 10) + '" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:6px;color:var(--text-primary)"></div>' +
        '</div>' +
      '</div>';
    } else if (type === 'number') {
      html = '<div style="background:var(--bg-primary);padding:14px;border-radius:10px;border:1px solid var(--border-subtle)">' +
        '<label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em"><i class="ph ph-hash" style="color:#4ade80"></i> Числовое поле:</label>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
          '<div><label style="font-size:0.8em;opacity:0.7">Мин (опц.):</label><input type="number" id="qMin" value="' + (q.min !== undefined ? q.min : '') + '" placeholder="—" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:6px;color:var(--text-primary)"></div>' +
          '<div><label style="font-size:0.8em;opacity:0.7">Макс (опц.):</label><input type="number" id="qMax" value="' + (q.max !== undefined ? q.max : '') + '" placeholder="—" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:6px;color:var(--text-primary)"></div>' +
        '</div>' +
        '<div style="margin-top:10px"><label style="font-size:0.8em;opacity:0.7">Единица измерения (опц.):</label><input type="text" id="qUnit" value="' + esc(q.unit || '') + '" placeholder="кг, см, мин..." style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:6px;color:var(--text-primary);margin-top:4px"></div>' +
      '</div>';
    } else if (type === 'yesno') {
      html = '<div style="background:var(--bg-primary);padding:14px;border-radius:10px;border:1px solid var(--border-subtle)">' +
        '<label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em"><i class="ph ph-check-circle" style="color:#a78bfa"></i> Да или Нет:</label>' +
      '</div>';
    } else if (type === 'text') {
      html = '<div style="background:var(--bg-primary);padding:14px;border-radius:10px;border:1px solid var(--border-subtle)">' +
        '<label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em"><i class="ph ph-text-t" style="color:var(--text-secondary)"></i> Текстовый ответ:</label>' +
      '</div>';
    }
    container.innerHTML = html;
  },
  saveQuestion: function(editIdx) {
    var text = document.getElementById('qText').value.trim();
    if (!text) {
      if (typeof Notify !== 'undefined') Notify.warn('Введи текст вопроса'); else alert('Введи текст вопроса');
      return;
    }
    var typeSelector = document.getElementById('typeSelector');
    var activeType = typeSelector.querySelector('.metric-chip.active');
    var type = 'rating';
    if (activeType) {
      var icon = activeType.querySelector('i');
      if (icon) {
        if (icon.classList.contains('ph-smiley')) type = 'emoji';
        else if (icon.classList.contains('ph-slider')) type = 'range';
        else if (icon.classList.contains('ph-hash')) type = 'number';
        else if (icon.classList.contains('ph-check-circle')) type = 'yesno';
        else if (icon.classList.contains('ph-text-t')) type = 'text';
        else type = 'rating';
      }
    }
    var config = this.getSurveyConfig() || this.getDefaultSurvey();
    var isEdit = editIdx !== null && editIdx !== undefined && config.questions[editIdx];
    var q = {
      id: isEdit ? config.questions[editIdx].id : Core.utils.generateId('q'),
      type: type, text: text
    };
    if (type === 'rating' || type === 'range') {
      var minEl = document.getElementById('qMin');
      var maxEl = document.getElementById('qMax');
      q.min = minEl ? parseInt(minEl.value) || 1 : 1;
      q.max = maxEl ? parseInt(maxEl.value) || 10 : 10;
      if (q.min >= q.max) {
        if (typeof Notify !== 'undefined') Notify.warn('Мин должен быть меньше макс'); else alert('Мин должен быть меньше макс');
        return;
      }
    } else if (type === 'number') {
      var minEl = document.getElementById('qMin');
      var maxEl = document.getElementById('qMax');
      var unitEl = document.getElementById('qUnit');
      if (minEl && minEl.value) q.min = parseInt(minEl.value);
      if (maxEl && maxEl.value) q.max = parseInt(maxEl.value);
      if (unitEl) q.unit = unitEl.value.trim();
    } else if (type === 'emoji') {
      var customEl = document.getElementById('qEmojiCustom');
      var emojiList = customEl ? customEl.value.split(',').map(function(e) { return e.trim(); }).filter(function(e) { return e; }) : [];
      if (emojiList.length < 2) {
        if (typeof Notify !== 'undefined') Notify.warn('Укажи хотя бы 2 эмодзи через запятую'); else alert('Укажи хотя бы 2 эмодзи через запятую');
        return;
      }
      q.emojiList = emojiList.join(', ');
      q.emojiSet = {};
      emojiList.forEach(function(e, i) { q.emojiSet[i + 1] = e; });
      q.min = 1;
      q.max = emojiList.length;
    }
    if (isEdit) {
      config.questions[editIdx] = q;
    } else {
      config.questions.push(q);
    }
    this.saveSurveyConfig(config);
    var modal = document.getElementById('questionModal');
    if (modal) modal.remove();
    this.createSurveyScreen();
  },
  editQuestion: function(idx) { this.openAddQuestionModal(idx); },
  deleteQuestion: function(idx) {
    if (!confirm('Удалить вопрос? Он также исчезнет с графика в статистике.')) return;
    var config = this.getSurveyConfig() || this.getDefaultSurvey();
    config.questions.splice(idx, 1);
    this.saveSurveyConfig(config);
    this.createSurveyScreen();
  },
  testSurvey: function() {
    var config = this.getSurveyConfig() || this.getDefaultSurvey();
    if (config.questions.length === 0) {
      if (typeof Notify !== 'undefined') Notify.warn('Нет вопросов'); else alert('Нет вопросов');
      return;
    }
    this._isTestMode = true;
    this.runSurvey(config, function(answers) {
      var modal = document.createElement('div');
      modal.className = 'ex-modal';
      modal.id = 'testResultModal';
      modal.style.zIndex = '2300';
      var content = document.createElement('div');
      content.className = 'ex-modal-content';
      content.style.maxWidth = '500px';
      var pretty = JSON.stringify(answers, null, 2);
      content.innerHTML =
        '<button style="float:right;background:transparent;border:none;color:var(--text-secondary);font-size:1.5em;cursor:pointer" onclick="document.getElementById(\'testResultModal\').remove()" aria-label="Закрыть"><i class="ph ph-x"></i></button>' +
        '<h2 style="font-family:var(--font-display);color:var(--accent-gold);margin-top:0">Результат теста</h2>' +
        '<pre style="background:var(--bg-primary);padding:14px;border-radius:10px;overflow:auto;max-height:400px;font-size:0.85em;white-space:pre-wrap">' + Core.utils.escapeHtml(pretty) + '</pre>' +
        '<div style="display:flex;gap:10px;margin-top:16px">' +
          '<button class="btn btn-secondary" style="flex:1" onclick="document.getElementById(\'testResultModal\').remove()">Закрыть</button>' +
          '<button class="btn btn-primary" style="flex:1" id="copyTestResult"><i class="ph ph-copy"></i> Скопировать</button>' +
        '</div>';
      modal.appendChild(content);
      document.body.appendChild(modal);
      var copyBtn = document.getElementById('copyTestResult');
      if (copyBtn) {
        copyBtn.onclick = function() {
          if (navigator.clipboard) {
            navigator.clipboard.writeText(pretty).then(function() {
              if (typeof Notify !== 'undefined') Notify.success('Скопировано'); else alert('Скопировано');
            });
          }
        };
      }
    });
  },
  runSurvey: function(config, callback) {
    this._currentQ = 0;
    this._answers = {};
    this._surveyCallback = callback;
    var oldModal = document.getElementById('finalSurveyModal');
    if (oldModal) oldModal.remove();
    var modal = document.createElement('div');
    modal.className = 'workout-modal';
    modal.id = 'finalSurveyModal';
    modal.style.zIndex = '2200';
    document.body.appendChild(modal);
    this._renderQuestion();
  },
  _renderQuestion: function() {
    var config = SurveyModule.getSurveyConfig() || SurveyModule.getDefaultSurvey();
    var modal = document.getElementById('finalSurveyModal');
    if (!modal) return;
    var currentQ = SurveyModule._currentQ || 0;
    if (currentQ >= config.questions.length) {
      modal.remove();
      if (!SurveyModule._isTestMode) SurveyModule._saveSurveyAnswers();
      if (SurveyModule._surveyCallback) SurveyModule._surveyCallback(SurveyModule._answers);
      SurveyModule._isTestMode = false;
      return;
    }
    var q = config.questions[currentQ];
    var content = document.createElement('div');
    content.className = 'workout-modal-content';
    content.style.maxWidth = '450px';
    var progress = document.createElement('div');
    progress.style.cssText = 'font-size:0.8em;opacity:0.7;margin-bottom:12px;display:flex;align-items:center;gap:6px';
    progress.innerHTML = '<i class="ph ph-clipboard-text"></i> Вопрос ' + (currentQ + 1) + ' из ' + config.questions.length;
    content.appendChild(progress);
    var title = document.createElement('h2');
    title.style.cssText = 'font-family:var(--font-display);color:var(--accent-gold);margin-top:0;text-align:center;font-size:1.3em';
    title.textContent = q.text;
    content.appendChild(title);
    var answerArea = document.createElement('div');
    answerArea.style.cssText = 'margin:20px 0';
    if (q.type === 'rating') {
      var buttonsDiv = document.createElement('div');
      buttonsDiv.style.cssText = 'display:flex;gap:6px;justify-content:center;flex-wrap:wrap';
      for (var v = q.min || 1; v <= (q.max || 10); v++) {
        (function(val) {
          var btn = document.createElement('button');
          btn.className = 'btn btn-secondary';
          btn.textContent = val;
          btn.style.cssText = 'width:44px;height:44px;font-size:1.1em';
          btn.onclick = function() { SurveyModule._surveyAnswer(val); };
          buttonsDiv.appendChild(btn);
        })(v);
      }
      answerArea.appendChild(buttonsDiv);
    } else if (q.type === 'emoji') {
      var emojiSet = q.emojiSet || {};
      var buttonsDiv = document.createElement('div');
      buttonsDiv.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap';
      for (var key in emojiSet) {
        (function(val) {
          var btn = document.createElement('button');
          btn.className = 'btn btn-secondary';
          btn.textContent = emojiSet[key];
          btn.title = 'Вариант ' + key;
          btn.style.cssText = 'width:50px;height:50px;font-size:1.5em';
          btn.onclick = function() { SurveyModule._surveyAnswer(val); };
          buttonsDiv.appendChild(btn);
        })(parseInt(key));
      }
      answerArea.appendChild(buttonsDiv);
    } else if (q.type === 'range') {
      var slider = document.createElement('input');
      slider.type = 'range';
      slider.min = q.min || 0;
      slider.max = q.max || 10;
      slider.value = Math.floor((q.min + q.max) / 2);
      slider.style.cssText = 'width:100%;accent-color:var(--accent-gold)';
      var valDisplay = document.createElement('div');
      valDisplay.style.cssText = 'text-align:center;font-size:1.5em;font-weight:bold;color:var(--accent-gold);margin-top:10px';
      valDisplay.textContent = slider.value;
      slider.oninput = function() { valDisplay.textContent = this.value; };
      answerArea.appendChild(slider);
      answerArea.appendChild(valDisplay);
      var submitBtn = document.createElement('button');
      submitBtn.className = 'btn btn-primary';
      submitBtn.innerHTML = '<i class="ph ph-check"></i> Подтвердить';
      submitBtn.style.cssText = 'width:100%;margin-top:12px';
      submitBtn.onclick = function() { SurveyModule._surveyAnswer(parseInt(slider.value)); };
      answerArea.appendChild(submitBtn);
    } else if (q.type === 'number') {
      var input = document.createElement('input');
      input.type = 'number';
      input.placeholder = 'Введи число' + (q.unit ? ' (' + q.unit + ')' : '');
      if (q.min !== undefined) input.min = q.min;
      if (q.max !== undefined) input.max = q.max;
      input.style.cssText = 'width:100%;padding:12px;background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:10px;color:var(--text-primary);font-size:1.1em;text-align:center';
      answerArea.appendChild(input);
      var submitBtn = document.createElement('button');
      submitBtn.className = 'btn btn-primary';
      submitBtn.innerHTML = '<i class="ph ph-check"></i> Подтвердить';
      submitBtn.style.cssText = 'width:100%;margin-top:12px';
      submitBtn.onclick = function() {
        var val = parseFloat(input.value);
        if (isNaN(val)) {
          if (typeof Notify !== 'undefined') Notify.warn('Введи число'); else alert('Введи число');
          return;
        }
        SurveyModule._surveyAnswer(val);
      };
      answerArea.appendChild(submitBtn);
    } else if (q.type === 'yesno') {
      var buttonsDiv = document.createElement('div');
      buttonsDiv.style.cssText = 'display:flex;gap:12px;justify-content:center';
      var yesBtn = document.createElement('button');
      yesBtn.className = 'btn btn-success';
      yesBtn.innerHTML = '<i class="ph ph-check"></i> Да';
      yesBtn.style.cssText = 'flex:1;padding:14px;font-size:1.1em';
      yesBtn.onclick = function() { SurveyModule._surveyAnswer(1); };
      var noBtn = document.createElement('button');
      noBtn.className = 'btn btn-danger';
      noBtn.innerHTML = '<i class="ph ph-x"></i> Нет';
      noBtn.style.cssText = 'flex:1;padding:14px;font-size:1.1em';
      noBtn.onclick = function() { SurveyModule._surveyAnswer(0); };
      buttonsDiv.appendChild(yesBtn);
      buttonsDiv.appendChild(noBtn);
      answerArea.appendChild(buttonsDiv);
    } else {
      var textarea = document.createElement('textarea');
      textarea.id = 'surveyTextAnswer';
      textarea.rows = 4;
      textarea.placeholder = 'Твой ответ...';
      textarea.style.cssText = 'width:100%;padding:12px;background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:10px;color:var(--text-primary);font-size:1em;resize:vertical;margin:0;font-family:var(--font-primary)';
      answerArea.appendChild(textarea);
      var submitBtn = document.createElement('button');
      submitBtn.className = 'btn btn-primary';
      submitBtn.innerHTML = '<i class="ph ph-check"></i> Ответить';
      submitBtn.style.cssText = 'width:100%;padding:14px;margin-top:12px';
      submitBtn.onclick = function() { SurveyModule._surveyTextAnswer(); };
      answerArea.appendChild(submitBtn);
    }
    content.appendChild(answerArea);
    var skipBtn = document.createElement('button');
    skipBtn.className = 'btn btn-secondary';
    skipBtn.innerHTML = '<i class="ph ph-skip-forward"></i> Пропустить';
    skipBtn.style.cssText = 'width:100%;padding:12px';
    skipBtn.onclick = function() { SurveyModule._surveySkip(); };
    content.appendChild(skipBtn);
    modal.innerHTML = '';
    modal.appendChild(content);
  },
  _surveyAnswer: function(value) {
    var config = SurveyModule.getSurveyConfig() || SurveyModule.getDefaultSurvey();
    var q = config.questions[SurveyModule._currentQ || 0];
    if (!q) return;
    SurveyModule._answers = SurveyModule._answers || {};
    SurveyModule._answers[q.id] = value;
    SurveyModule._currentQ = (SurveyModule._currentQ || 0) + 1;
    SurveyModule._renderQuestion();
  },
  _surveyTextAnswer: function() {
    var textarea = document.getElementById('surveyTextAnswer');
    if (!textarea) return;
    var value = textarea.value.trim();
    var config = SurveyModule.getSurveyConfig() || SurveyModule.getDefaultSurvey();
    var q = config.questions[SurveyModule._currentQ || 0];
    if (!q) return;
    SurveyModule._answers = SurveyModule._answers || {};
    SurveyModule._answers[q.id] = value;
    SurveyModule._currentQ = (SurveyModule._currentQ || 0) + 1;
    SurveyModule._renderQuestion();
  },
  _surveySkip: function() {
    var config = SurveyModule.getSurveyConfig() || SurveyModule.getDefaultSurvey();
    var q = config.questions[SurveyModule._currentQ || 0];
    if (!q) return;
    SurveyModule._answers = SurveyModule._answers || {};
    SurveyModule._answers[q.id] = null;
    SurveyModule._currentQ = (SurveyModule._currentQ || 0) + 1;
    SurveyModule._renderQuestion();
  },
  _saveSurveyAnswers: function() {
    var todayStr = Core.utils.formatLocalDate(new Date());
    var history = (typeof CoreData !== 'undefined') ? CoreData.getHistory() : ((typeof FTStorage !== 'undefined' ? FTStorage.get('history') : null) || []);
    var dayRecord = null;
    for (var i = 0; i < history.length; i++) {
      if (history[i].date === todayStr) { dayRecord = history[i]; break; }
    }
    if (!dayRecord) {
      dayRecord = {
        date: todayStr,
        dayName: Core.utils.getDayName(Core.utils.getTodayIndex()),
        muscleGroup: '', exercises: [], details: [], duration: 0,
        timestamp: Date.now(), survey: {}
      };
      history.push(dayRecord);
    }
    if (!dayRecord.survey) dayRecord.survey = {};
    var alreadyHadSurvey = Object.keys(dayRecord.survey).length > 0;
    for (var key in SurveyModule._answers) {
      dayRecord.survey[key] = SurveyModule._answers[key];
    }
    if (typeof CoreData !== 'undefined') CoreData.setHistory(history);
    else if (typeof FTStorage !== 'undefined') FTStorage.set('history', history);
    if (typeof Core !== 'undefined') Core._historyMapCache = null;
    if (typeof StatsModule !== 'undefined') {
      var statsScreen = document.getElementById('screen-stats');
      if (statsScreen && statsScreen.classList.contains('active') && typeof StatsModule.drawChart === 'function') {
        StatsModule.drawChart();
      }
    }
    if (!alreadyHadSurvey) {
      var stats = (typeof FTStorage !== 'undefined' ? FTStorage.get('stats') : null) || {yes:0, later:0, no:0, xp:0, level:1, streak:0};
      stats.xp = (stats.xp || 0) + 10;
      if (typeof CoreData !== 'undefined' && CoreData.logXP) {
        CoreData.logXP(10, 'Опрос', null);
      }
      var xpNeeded = (typeof Core !== 'undefined' && Core.utils && Core.utils.xpForLevel)
        ? Core.utils.xpForLevel(stats.level)
        : Math.floor(100 * Math.pow(1.2, stats.level - 1));
      while (stats.xp >= xpNeeded) {
        stats.xp -= xpNeeded;
        stats.level++;
        xpNeeded = (typeof Core !== 'undefined' && Core.utils && Core.utils.xpForLevel)
          ? Core.utils.xpForLevel(stats.level)
          : Math.floor(100 * Math.pow(1.2, stats.level - 1));
      }
      if (typeof CoreData !== 'undefined') CoreData.setStats(stats);
      else if (typeof FTStorage !== 'undefined') FTStorage.set('stats', stats);
      if (typeof refreshHeaderAfterXP === 'function') refreshHeaderAfterXP();
      if (typeof AchievementsModule !== 'undefined' && AchievementsModule.checkAchievements) {
        AchievementsModule.checkAchievements();
      }
      if (typeof Notify !== 'undefined') Notify.success('Опрос сохранён! +10 XP'); else alert('✅ Опрос сохранён! +10 XP.');
    } else {
      if (typeof Notify !== 'undefined') Notify.success('Опрос обновлён'); else alert('✅ Опрос обновлён.');
    }
    if (typeof refreshHeaderAfterXP === 'function') refreshHeaderAfterXP();
  }
};
window.SurveyModule = SurveyModule;
module.exports = SurveyModule;