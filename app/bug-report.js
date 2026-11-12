// app/bug-report.js
// Баг-репорты: пользователь описывает проблему, она сохраняется в localStorage.
// Требует: Logger, Notify.

(function() {
  'use strict';

  var STORAGE_KEY = 'ft_bug_reports';

  function esc(text) {
    if (text == null) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getReports() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) || []) : [];
    } catch (e) { return []; }
  }

  function saveReports(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list || [])); } catch (e) {}
  }

  function severityColor(sev) {
    if (sev === 'high') return 'var(--accent-error)';
    if (sev === 'medium') return 'var(--accent-warning)';
    return 'var(--accent-success)';
  }

  function severityLabel(sev) {
    if (sev === 'high') return 'Высокая';
    if (sev === 'medium') return 'Средняя';
    return 'Низкая';
  }

  function renderReportsInModal(reports) {
    if (!reports.length) return '';
    var html = '<div style="margin-top:20px;border-top:1px solid var(--border-subtle);padding-top:16px">';
    html += '<h3 style="color:var(--accent-gold);font-family:var(--font-display);margin-bottom:12px;display:flex;align-items:center;gap:8px"><i class="ph ph-list"></i> Мои репорты (' + reports.length + ')</h3>';
    for (var i = 0; i < reports.length; i++) {
      var r = reports[i];
      var color = severityColor(r.severity);
      html += '<div style="background:var(--bg-card);border-radius:10px;padding:12px;margin-bottom:8px;border-left:3px solid ' + color + '">';
      html += '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:6px">';
      html += '<div style="font-weight:600;color:var(--text-primary);flex:1">' + esc(r.title) + '</div>';
      html += '<button class="btn btn-danger" style="padding:4px 8px;font-size:0.75em;margin-left:8px" onclick="BugReport._deleteFromModal(' + i + ')"><i class="ph ph-trash"></i></button>';
      html += '</div>';
      html += '<div style="font-size:0.8em;opacity:0.7;margin-bottom:6px">' + esc(r.description) + '</div>';
      html += '<div style="font-size:0.75em;opacity:0.6;display:flex;justify-content:space-between">';
      html += '<span style="color:' + color + ';font-weight:600">' + severityLabel(r.severity) + '</span>';
      html += '<span>' + new Date(r.timestamp).toLocaleString('ru-RU') + '</span>';
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  }

  function openModal() {
    // Закрываем сайдбар, если открыт
    if (typeof window.toggleSidebar === 'function') {
      var sb = document.getElementById('sidebar');
      if (sb && sb.classList.contains('active')) window.toggleSidebar();
    }

    var old = document.getElementById('bugReportModal');
    if (old) old.remove();

    var reports = getReports();

    var modal = document.createElement('div');
    modal.className = 'ex-modal';
    modal.id = 'bugReportModal';
    modal.style.zIndex = '2100';

    var content = document.createElement('div');
    content.className = 'ex-modal-content';
    content.style.maxWidth = '500px';
    content.innerHTML =
      '<button style="float:right;background:transparent;border:none;color:var(--text-secondary);font-size:1.5em;cursor:pointer" onclick="BugReport.closeModal()" aria-label="Закрыть"><i class="ph ph-x"></i></button>' +
      '<h2 style="font-family:var(--font-display);color:var(--accent-gold);margin-top:0;display:flex;align-items:center;gap:10px"><i class="ph ph-bug"></i> Баг-репорт</h2>' +
      '<div style="background:var(--accent-gold-dim);border:1px solid var(--border-gold);border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:0.9em;display:flex;align-items:start;gap:10px">' +
        '<i class="ph ph-info" style="color:var(--accent-gold);font-size:1.2em;margin-top:2px"></i>' +
        '<div>Нашёл баг? Опиши его — мы исправим!</div>' +
      '</div>' +
      '<div style="margin-bottom:12px"><label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em">Заголовок:</label>' +
        '<input type="text" id="bugTitle" placeholder="Короткое описание проблемы" style="width:100%;padding:10px;background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:1em"></div>' +
      '<div style="margin-bottom:12px"><label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em">Описание:</label>' +
        '<textarea id="bugDescription" rows="4" placeholder="Что произошло?" style="width:100%;padding:10px;background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:1em;resize:vertical;font-family:var(--font-primary)"></textarea></div>' +
      '<div style="margin-bottom:16px"><label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em">Серьёзность:</label>' +
        '<select id="bugSeverity" style="width:100%;padding:10px;background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:1em">' +
          '<option value="low">🟢 Низкая</option>' +
          '<option value="medium" selected>🟡 Средняя</option>' +
          '<option value="high">🔴 Высокая</option>' +
        '</select></div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end">' +
        '<button class="btn btn-secondary" onclick="BugReport.closeModal()">Отмена</button>' +
        '<button class="btn btn-primary" onclick="BugReport.submit()"><i class="ph ph-paper-plane-tilt"></i> Отправить</button>' +
      '</div>' +
      renderReportsInModal(reports);

    modal.appendChild(content);
    document.body.appendChild(modal);
  }

  function closeModal() {
    var m = document.getElementById('bugReportModal');
    if (m) m.remove();
  }

  function submit() {
    var titleEl = document.getElementById('bugTitle');
    var descEl = document.getElementById('bugDescription');
    var sevEl = document.getElementById('bugSeverity');
    if (!titleEl || !descEl || !sevEl) return;

    var title = titleEl.value.trim();
    var description = descEl.value.trim();
    var severity = sevEl.value;

    if (!title || !description) {
      if (window.Notify) window.Notify.warn('Заполни заголовок и описание');
      return;
    }

    var reports = getReports();
    reports.unshift({
      id: 'bug_' + Date.now(),
      title: title,
      description: description,
      severity: severity,
      timestamp: Date.now(),
      status: 'new'
    });
    saveReports(reports);

    closeModal();
    if (window.Notify) window.Notify.success('Баг-репорт сохранён! Спасибо!');
    if (window.Logger && window.Logger.log) window.Logger.log('Баг-репорт: ' + title, 'warn');
  }

  function deleteFromModal(idx) {
    if (!confirm('Удалить этот репорт?')) return;
    var reports = getReports();
    reports.splice(idx, 1);
    saveReports(reports);
    closeModal();
    openModal();
  }

  function deleteFromDev(idx) {
    if (!confirm('Удалить этот репорт?')) return;
    var reports = getReports();
    reports.splice(idx, 1);
    saveReports(reports);
    renderReportsList();
  }

  function renderReportsList() {
    var container = document.getElementById('bugReportsList');
    if (!container) return;

    var reports = getReports();
    if (!reports.length) {
      container.innerHTML = '<div style="text-align:center;padding:30px;opacity:0.6"><i class="ph ph-bug" style="font-size:2em;color:var(--accent-gold);margin-bottom:10px;display:block"></i>Баг-репортов пока нет</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < reports.length; i++) {
      var r = reports[i];
      var color = severityColor(r.severity);
      var desc = r.description || '';
      var short = desc.length > 100 ? desc.substring(0, 100) + '...' : desc;
      html += '<div class="module-item" style="border-left:3px solid ' + color + '">';
      html += '<div style="flex:1"><div style="font-weight:600;font-size:1.05em">' + esc(r.title) + '</div>';
      html += '<div class="text-small" style="margin-top:4px">' + esc(short) + '</div>';
      html += '<div class="text-small" style="margin-top:4px"><span style="color:' + color + ';font-weight:600">' + severityLabel(r.severity) + '</span> · ' + new Date(r.timestamp).toLocaleString('ru-RU') + '</div></div>';
      html += '<button class="btn btn-danger" onclick="BugReport.deleteFromDev(' + i + ')" style="padding:8px 14px"><i class="ph ph-trash"></i></button></div>';
    }
    container.innerHTML = html;
  }

  function clearAll() {
    if (!confirm('Удалить ВСЕ баг-репорты?')) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    renderReportsList();
    if (window.Notify) window.Notify.info('Все репорты удалены');
  }

  window.BugReport = {
    openModal: openModal,
    closeModal: closeModal,
    submit: submit,
    renderReportsList: renderReportsList,
    deleteFromDev: deleteFromDev,
    _deleteFromModal: deleteFromModal,
    clearAll: clearAll,
    getAll: getReports
  };
})();