// modules/plan.js
const PlanModule = {
  pickingForDay: null,
  expandedDay: null,

  init: function() {
    if (typeof Logger !== 'undefined') Logger.log('Модуль плана инициализирован', 'info');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { PlanModule.setup(); });
    } else { this.setup(); }
  },

  setup: function() {
    this.createPlanScreen();
    if (typeof Core !== 'undefined') {
      Core.addNavButton('План тренировок', 'plan', '<i class="ph ph-calendar"></i>');
      Core.registerScreen('plan', function() { PlanModule.createPlanScreen(); });
    }
  },

  getPlan: function() {
    if (typeof CoreData !== 'undefined') return CoreData.getPlan();
    return (typeof FTStorage !== 'undefined' ? FTStorage.get('plan') : null) || [];
  },
  savePlan: function(p) {
    if (typeof CoreData !== 'undefined') { CoreData.setPlan(p); return; }
    if (typeof FTStorage !== 'undefined') FTStorage.set('plan', p);
  },

  _normalizePlan: function(plan) {
    var DAYS = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
    if (!Array.isArray(plan)) plan = [];
    if (plan.length === 0) {
      var fresh = [];
      for (var i = 0; i < 7; i++) fresh.push({ dayName: DAYS[i], muscleGroup: '', exercises: [] });
      this.savePlan(fresh);
      return fresh;
    }
    for (var i = 0; i < plan.length; i++) {
      if (!plan[i] || typeof plan[i] !== 'object') {
        plan[i] = { dayName: DAYS[i] || ('День ' + (i + 1)), muscleGroup: '', exercises: [] };
      }
      if (!Array.isArray(plan[i].exercises)) plan[i].exercises = [];
      if (!plan[i].dayName) plan[i].dayName = DAYS[i] || ('День ' + (i + 1));
      if (typeof plan[i].muscleGroup !== 'string') plan[i].muscleGroup = '';
    }
    return plan;
  },

  createPlanScreen: function() {
    var esc = Core.utils.escapeHtml;
    var screen = document.getElementById('screen-plan');
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'screen-plan';
      screen.className = 'screen';
      document.getElementById('userInterface').appendChild(screen);
    }

    var DAYS = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
    var DAYS_SHORT = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
    var plan = this._normalizePlan(this.getPlan());
    var db = typeof ExercisesModule !== 'undefined' ? ExercisesModule.getDB() : [];
    var todayIdx = Core.utils.getTodayIndex();

    var css = '<style>' +
      '.plan-day-card { background:var(--bg-card); border-radius:14px; margin-bottom:12px; border:1px solid var(--border-subtle); overflow:hidden; transition:all 0.3s; }' +
      '.plan-day-card:hover { border-color:var(--border-gold); }' +
      '.plan-day-card.today { border-color:var(--accent-gold); box-shadow:0 0 20px rgba(212,175,55,0.15); }' +
      '.plan-day-header { padding:16px 20px; cursor:pointer; display:flex; justify-content:space-between; align-items:center; transition:all 0.2s; }' +
      '.plan-day-header:hover { background:rgba(255,255,255,0.03); }' +
      '.plan-day-header.active { background:rgba(212,175,55,0.08); border-bottom:1px solid var(--border-subtle); }' +
      '.plan-day-body { padding:20px; display:none; }' +
      '.plan-day-body.active { display:block; animation:fadeIn 0.3s ease-out; }' +
      '.plan-ex { background:var(--bg-primary); padding:12px 14px; border-radius:10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; border-left:3px solid var(--accent-gold); }' +
      '.today-dot { width:8px; height:8px; background:var(--accent-success); border-radius:50%; display:inline-block; margin-left:8px; box-shadow:0 0 8px var(--accent-success); }' +
      '.hint { font-size:0.75em; opacity:0.6; margin-top:3px; }' +
      '@media (prefers-reduced-motion: reduce) { .plan-day-card { transition: none !important; } .plan-day-body.active { animation: none !important; } }' +
    '</style>';

    var html = css + '<div style="padding:4px;max-width:700px;margin:0 auto">';
    html += '<h2 style="font-family:var(--font-display);font-size:1.8em;margin-bottom:10px;color:var(--accent-gold);display:flex;align-items:center;gap:12px"><i class="ph ph-calendar"></i> План тренировок</h2>';
    html += '<div class="hint" style="margin-bottom:18px;display:flex;align-items:center;gap:6px"><i class="ph ph-info"></i> Нажми на день, чтобы раскрыть и настроить упражнения</div>';

    for (var dayIdx = 0; dayIdx < 7; dayIdx++) {
      var day = plan[dayIdx];
      var isToday = dayIdx === todayIdx;
      var isExpanded = this.expandedDay === dayIdx;
      var exCount = day.exercises.length;

      html += '<div class="plan-day-card ' + (isToday ? 'today' : '') + '">';
      html += '<div class="plan-day-header ' + (isExpanded ? 'active' : '') + '" onclick="PlanModule.toggleDay(' + dayIdx + ')">';
      html += '<div style="display:flex;align-items:center;gap:12px;flex:1">';
      html += '<div style="width:44px;height:44px;border-radius:10px;background:' + (isToday ? 'linear-gradient(135deg, var(--accent-gold), var(--accent-gold-light))' : 'var(--bg-primary)') + ';color:' + (isToday ? '#000' : 'var(--accent-gold)') + ';display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.9em;border:1px solid ' + (isToday ? 'var(--accent-gold)' : 'var(--border-subtle)') + '">' + DAYS_SHORT[dayIdx] + '</div>';
      html += '<div style="flex:1">';
      html += '<div style="font-weight:600;font-size:1em;display:flex;align-items:center;gap:6px">' + esc(day.dayName);
      if (isToday) html += '<span class="today-dot" title="Сегодня"></span>';
      html += '</div>';
      html += '<div style="font-size:0.8em;opacity:0.7;margin-top:2px;display:flex;align-items:center;gap:6px">';
      if (day.muscleGroup) html += '<i class="ph ph-tag"></i> ' + esc(day.muscleGroup);
      if (exCount > 0) html += ' · <i class="ph ph-list-dashes"></i> ' + exCount + ' упр.';
      if (!day.muscleGroup && exCount === 0) html += '<i class="ph ph-info"></i> Не настроено';
      html += '</div></div></div>';
      html += '<i class="ph ' + (isExpanded ? 'ph-caret-up' : 'ph-caret-down') + '" style="font-size:1.3em;color:var(--accent-gold)"></i>';
      html += '</div>';

      if (isExpanded) {
        html += '<div class="plan-day-body active">';
        html += '<div style="margin-bottom:16px">';
        html += '<label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em;display:flex;align-items:center;gap:6px"><i class="ph ph-target" style="color:var(--accent-gold)"></i> Группа мышц:</label>';
        html += '<input type="text" id="muscleGroupInput' + dayIdx + '" value="' + esc(day.muscleGroup || '') + '" placeholder="Например: Грудь + Трицепс" style="width:100%;padding:10px;background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:0.95em" oninput="PlanModule.onMuscleInput(' + dayIdx + ', this.value)">';
        html += '<div class="hint" style="display:flex;align-items:center;gap:4px;margin-top:4px"><i class="ph ph-info"></i> Какая группа мышц тренируется</div>';
        html += '</div>';

        html += '<div><label style="display:block;margin-bottom:10px;font-weight:600;font-size:0.9em;display:flex;align-items:center;gap:6px"><i class="ph ph-barbell" style="color:var(--accent-gold)"></i> Упражнения:</label>';
        if (day.exercises.length === 0) {
          html += '<div style="text-align:center;padding:24px;opacity:0.6;font-style:italic;display:flex;flex-direction:column;align-items:center;gap:8px"><i class="ph ph-dumbbell" style="font-size:2em;color:var(--accent-gold)"></i>Нет упражнений. Добавь первое!</div>';
        } else {
          for (var exIdx = 0; exIdx < day.exercises.length; exIdx++) {
            var exRef = day.exercises[exIdx] || {};
            var ex = null;
            for (var i = 0; i < db.length; i++) if (db[i].id === exRef.id) { ex = db[i]; break; }
            var name = ex ? ex.name : '(удалено из базы)';
            var category = ex && ex.muscleGroup ? ex.muscleGroup : 'Без категории';

            html += '<div class="plan-ex">';
            html += '<div style="flex:1;min-width:150px">';
            html += '<div style="font-weight:600;font-size:0.95em;margin-bottom:4px;display:flex;align-items:center;gap:6px"><span style="color:var(--accent-gold);font-weight:700">' + (exIdx + 1) + '.</span> ' + esc(name) + '</div>';
            html += '<div style="font-size:0.75em;opacity:0.6;margin-bottom:6px;display:flex;align-items:center;gap:4px"><i class="ph ph-tag"></i> ' + esc(category) + '</div>';
            html += '<input type="text" id="setsInput' + dayIdx + '_' + exIdx + '" value="' + esc(exRef.sets || '') + '" placeholder="3×10 или 4×8" style="width:100%;padding:8px;background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:6px;color:var(--text-primary);font-size:0.85em" oninput="PlanModule.onSetsInput(' + dayIdx + ',' + exIdx + ',this.value)">';
            html += '<div class="hint" style="display:flex;align-items:center;gap:4px;margin-top:4px"><i class="ph ph-info"></i> Подходы × Повторы</div>';
            html += '</div>';
            html += '<div style="display:flex;gap:6px">';
            html += '<button class="btn btn-secondary" style="padding:6px 10px;font-size:0.85em" ' + (exIdx === 0 ? 'disabled style="opacity:0.3"' : '') + ' onclick="PlanModule.movePlanEx(' + dayIdx + ',' + exIdx + ',-1)" aria-label="Выше"><i class="ph ph-arrow-up"></i></button>';
            html += '<button class="btn btn-secondary" style="padding:6px 10px;font-size:0.85em" ' + (exIdx === day.exercises.length - 1 ? 'disabled style="opacity:0.3"' : '') + ' onclick="PlanModule.movePlanEx(' + dayIdx + ',' + exIdx + ',1)" aria-label="Ниже"><i class="ph ph-arrow-down"></i></button>';
            html += '<button class="btn btn-danger" style="padding:6px 10px;font-size:0.85em" onclick="PlanModule.removePlanEx(' + dayIdx + ',' + exIdx + ')" aria-label="Удалить"><i class="ph ph-trash"></i></button>';
            html += '</div></div>';
          }
        }
        html += '</div>';

        html += '<div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">';
        html += '<button class="btn btn-primary" style="flex:1;padding:12px;font-size:0.95em" onclick="PlanModule.openPickEx(' + dayIdx + ')"><i class="ph ph-plus-circle"></i> Добавить из базы</button>';
        if (day.exercises.length > 0) {
          html += '<button class="btn btn-secondary" style="padding:12px 16px;font-size:0.95em" onclick="PlanModule.clearDay(' + dayIdx + ')"><i class="ph ph-trash"></i> Очистить день</button>';
        }
        html += '</div>';
        html += '<button class="btn btn-success" style="width:100%;padding:12px;font-size:0.95em;font-weight:600;margin-top:10px" onclick="PlanModule.saveFromInputs()"><i class="ph ph-floppy-disk"></i> Сохранить план</button>';
        html += '</div>';
				
      }
      html += '</div>';
    }

    html += '<div class="hint" style="text-align:center;margin-top:16px;display:flex;align-items:center;justify-content:center;gap:6px"><i class="ph ph-check-circle" style="color:var(--accent-success)"></i> Изменения сохраняются автоматически при вводе</div>';
    html += '</div>';

    screen.innerHTML = html;
  },

  onSetsInput: function(dayIdx, exIdx, value) {
    var p = this.getPlan();
    if (p[dayIdx] && p[dayIdx].exercises && p[dayIdx].exercises[exIdx]) {
      p[dayIdx].exercises[exIdx].sets = value;
      this.savePlan(p);
    }
  },

  onMuscleInput: function(dayIdx, value) {
    var p = this.getPlan();
    if (p[dayIdx]) {
      p[dayIdx].muscleGroup = value;
      this.savePlan(p);
    }
  },

  saveFromInputs: function() {
    var p = this.getPlan();
    for (var dayIdx = 0; dayIdx < p.length; dayIdx++) {
      var muscleEl = document.getElementById('muscleGroupInput' + dayIdx);
      if (muscleEl) p[dayIdx].muscleGroup = muscleEl.value;

      var exs = p[dayIdx].exercises || [];
      for (var exIdx = 0; exIdx < exs.length; exIdx++) {
        var setsEl = document.getElementById('setsInput' + dayIdx + '_' + exIdx);
        if (setsEl) exs[exIdx].sets = setsEl.value;
      }
    }
    this.savePlan(p);
    if (typeof Notify !== 'undefined') Notify.success('План сохранён!');
  },

  toggleDay: function(dayIdx) {
    this.expandedDay = this.expandedDay === dayIdx ? null : dayIdx;
    this.createPlanScreen();
  },

  movePlanEx: function(d, e, dir) {
    var p = this.getPlan();
    if (!p[d] || !p[d].exercises) return;
    var a = p[d].exercises;
    var n = e + dir;
    if (n < 0 || n >= a.length) return;
    var t = a[e]; a[e] = a[n]; a[n] = t;
    this.savePlan(p);
    this.createPlanScreen();
  },

  removePlanEx: function(d, e) {
    var p = this.getPlan();
    if (!p[d] || !p[d].exercises) return;
    p[d].exercises.splice(e, 1);
    this.savePlan(p);
    this.createPlanScreen();
  },

  clearDay: function(d) {
    if (!confirm('Удалить все упражнения из этого дня?')) return;
    var p = this.getPlan();
    if (!p[d]) return;
    p[d].exercises = [];
    p[d].muscleGroup = '';
    this.savePlan(p);
    this.createPlanScreen();
  },

  openPickEx: function(dayIdx) {
    var esc = Core.utils.escapeHtml;
    this.pickingForDay = dayIdx;
    var oldModal = document.getElementById('pickExModal');
    if (oldModal) oldModal.remove();
    var modal = document.createElement('div');
    modal.className = 'ex-modal';
    modal.id = 'pickExModal';
    modal.innerHTML =
      '<div class="ex-modal-content">' +
        '<button style="float:right;background:transparent;border:none;color:var(--text-secondary);font-size:1.5em;cursor:pointer" onclick="document.getElementById(\'pickExModal\').remove()" aria-label="Закрыть"><i class="ph ph-x"></i></button>' +
        '<h2 style="font-family:var(--font-display);color:var(--accent-gold);margin-top:0;display:flex;align-items:center;gap:10px"><i class="ph ph-magnifying-glass"></i> Выбери упражнение</h2>' +
        '<div class="hint" style="margin-bottom:12px;display:flex;align-items:center;gap:6px"><i class="ph ph-info"></i> Начни вводить название или категорию</div>' +
        '<input type="text" id="pickSearch" placeholder="Поиск..." oninput="PlanModule.renderPickList()" style="width:100%;padding:10px;background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);margin-bottom:12px;font-size:1em">' +
        '<div id="pickList" style="max-height:400px;overflow-y:auto"></div>' +
      '</div>';
    document.body.appendChild(modal);
    this.renderPickList();
  },

  renderPickList: function() {
    var esc = Core.utils.escapeHtml;
    var searchEl = document.getElementById('pickSearch');
    var search = searchEl ? searchEl.value.toLowerCase() : '';
    var db = typeof ExercisesModule !== 'undefined' ? ExercisesModule.getDB() : [];
    var filtered = db.filter(function(e) {
      return e.name.toLowerCase().indexOf(search) !== -1 ||
        (e.muscleGroup || '').toLowerCase().indexOf(search) !== -1;
    });
    var list = document.getElementById('pickList');
    if (!list) return;
    if (filtered.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:30px;opacity:0.6">' +
        '<i class="ph ph-magnifying-glass" style="font-size:2em;color:var(--accent-gold);margin-bottom:8px;display:block"></i>' +
        '<div style="margin-bottom:16px">Ничего не найдено</div>' +
        '<button class="btn btn-primary" onclick="document.getElementById(\'pickExModal\').remove();Core.navigate(\'exercises\')" style="padding:10px 20px;font-size:0.9em">' +
          '<i class="ph ph-arrow-right"></i> Перейти в базу упражнений' +
        '</button>' +
        '<div style="font-size:0.75em;opacity:0.5;margin-top:10px">Добавь упражнения, чтобы использовать их в плане</div>' +
      '</div>';
    } else {
      var html = '';
      for (var i = 0; i < filtered.length; i++) {
        var ex = filtered[i];
        html += '<div onclick="PlanModule.addExToPlan(\'' + esc(ex.id) + '\')" style="background:var(--bg-card);border-radius:10px;padding:14px;margin-bottom:10px;border:1px solid var(--border-subtle);cursor:pointer;transition:all 0.2s" onmouseover="this.style.borderColor=\'var(--border-gold)\'" onmouseout="this.style.borderColor=\'var(--border-subtle)\'">' +
          '<h4 style="margin:0 0 6px 0;color:var(--accent-gold);display:flex;align-items:center;gap:8px"><i class="ph ph-barbell"></i> ' + esc(ex.name) + '</h4>' +
          '<div style="font-size:0.85em;opacity:0.7;display:flex;align-items:center;gap:4px"><i class="ph ph-tag"></i> ' + esc(ex.muscleGroup || 'Без категории') + '</div></div>';
      }
      list.innerHTML = html;
    }
  },

  addExToPlan: function(exId) {
    if (this.pickingForDay === null) return;
    var p = this.getPlan();
    if (!p[this.pickingForDay]) return;
    if (!Array.isArray(p[this.pickingForDay].exercises)) p[this.pickingForDay].exercises = [];
    p[this.pickingForDay].exercises.push({ id: exId, sets: '' });
    this.savePlan(p);
    var modal = document.getElementById('pickExModal');
    if (modal) modal.remove();
    this.createPlanScreen();
  }
};

window.PlanModule = PlanModule;
module.exports = PlanModule;