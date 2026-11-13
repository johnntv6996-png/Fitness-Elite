// modules/workout.js

const WorkoutModule = {
  currentExerciseId: null,
  modalElement: null,
  _miniSurveyContext: null,
  XP: { PER_SET: 5, PER_PARTIAL: 3, PER_MISS: 0, PER_EXERCISE: 15, PER_DAY: 20, PER_SURVEY: 10 },

  init: function() {
    if (typeof Logger !== 'undefined') Logger.log('Модуль тренировки инициализирован', 'info');
  },

  getPlan: function() {
    if (typeof CoreData !== 'undefined' && CoreData.getPlan) return CoreData.getPlan();
    if (typeof FTStorage !== 'undefined') return FTStorage.get('plan') || [];
    return [];
  },
  getDB: function() {
    if (typeof ExercisesModule !== 'undefined' && ExercisesModule.getDB) return ExercisesModule.getDB();
    if (typeof CoreData !== 'undefined' && CoreData.getDB) return CoreData.getDB();
    if (typeof FTStorage !== 'undefined') return FTStorage.get('db') || [];
    return [];
  },
  getHistory: function() {
    if (typeof CoreData !== 'undefined' && CoreData.getHistory) return CoreData.getHistory();
    if (typeof FTStorage !== 'undefined') return FTStorage.get('history') || [];
    return [];
  },
  saveHistory: function(h) {
    if (typeof CoreData !== 'undefined' && CoreData.setHistory) { CoreData.setHistory(h); return; }
    if (typeof FTStorage !== 'undefined') FTStorage.set('history', h);
    if (typeof Core !== 'undefined') Core._historyMapCache = null;
  },
  saveStats: function(s) {
    if (typeof CoreData !== 'undefined' && CoreData.setStats) { CoreData.setStats(s); return; }
    if (typeof FTStorage !== 'undefined') FTStorage.set('stats', s);
  },
  getStats: function() {
    var defaults = { yes: 0, later: 0, no: 0, xp: 0, level: 1, streak: 0, lastWorkoutDate: null };
    if (typeof CoreData !== 'undefined' && CoreData.getStats) {
      var s1 = CoreData.getStats();
      for (var k1 in defaults) if (s1[k1] === undefined) s1[k1] = defaults[k1];
      return s1;
    }
    if (typeof FTStorage !== 'undefined') {
      var s = FTStorage.get('stats') || {};
      for (var k in defaults) if (s[k] === undefined) s[k] = defaults[k];
      return s;
    }
    return defaults;
  },

  _xpForLevel: function(level) {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.xpForLevel) return Core.utils.xpForLevel(level);
    return Math.floor(100 * Math.pow(1.2, Math.max(0, (level || 1) - 1)));
  },

  _parseSetsReps: function(setsStr) {
    var m = (setsStr || '3×10').match(/(\d+)\s*[×xх*]\s*(\d+)/i);
    return { sets: m ? parseInt(m[1]) : 3, reps: m ? parseInt(m[2]) : 10 };
  },

  _getTodayRecord: function(history) {
    var todayStr = this._todayStr();
    for (var i = 0; i < history.length; i++) {
      if (history[i].date === todayStr) return history[i];
    }
    return null;
  },

  _todayStr: function() {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.formatLocalDate) return Core.utils.formatLocalDate(new Date());
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  },
  _todayIdx: function() {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.getTodayIndex) return Core.utils.getTodayIndex();
    return (new Date().getDay() + 6) % 7;
  },
  _todayName: function() {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.getDayName) return Core.utils.getDayName(this._todayIdx());
    return ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'][this._todayIdx()];
  },

  _isDayFullyAnswered: function(todayPlan, dayRecord) {
    if (!todayPlan || !todayPlan.exercises || todayPlan.exercises.length === 0) return false;
    if (!dayRecord || !dayRecord.details) return false;

    var hasAnyPositive = false;
    for (var i = 0; i < todayPlan.exercises.length; i++) {
      var exRef = todayPlan.exercises[i];
      var parsed = this._parseSetsReps(exRef.sets);
      var exDetail = null;
      for (var j = 0; j < dayRecord.details.length; j++) {
        if (dayRecord.details[j].exId === exRef.id) { exDetail = dayRecord.details[j]; break; }
      }
      if (!exDetail || !exDetail.sets) return false;
      for (var s = 0; s < parsed.sets; s++) {
        var st = exDetail.sets[s];
        if (!st) return false;
        if (st === 'done' || st === 'partial') hasAnyPositive = true;
      }
    }
    return hasAnyPositive;
  },

  openWorkoutModal: function() {
    if (typeof Core === 'undefined' || !Core.utils) {
      if (typeof Notify !== 'undefined') Notify.error('Ядро не загружено');
      return;
    }
    var self = this;
    var plan = this.getPlan();
    var db = this.getDB();
    var todayIdx = this._todayIdx();
    var todayPlan = plan[todayIdx] || { dayName: 'Сегодня', muscleGroup: '', exercises: [] };

    this.closeWorkoutModal();

    var modal = document.createElement('div');
    modal.className = 'workout-modal';
    modal.id = 'workoutModal';

    var content = document.createElement('div');
    content.className = 'workout-modal-content';
    content.style.cssText = 'max-width:640px;padding:0;overflow:hidden;display:flex;flex-direction:column;max-height:92vh';

    var header = document.createElement('div');
    header.style.cssText = 'padding:16px 18px 12px;border-bottom:1px solid var(--border-subtle);flex-shrink:0;background:var(--bg-secondary)';
    header.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:start;gap:10px">' +
        '<div style="flex:1;min-width:0">' +
          '<h2 style="font-family:var(--font-display);color:var(--accent-gold);margin:0 0 4px 0;font-size:1.3em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
            '<i class="ph ph-barbell"></i> ' + Core.utils.escapeHtml(todayPlan.dayName || 'Сегодня') +
          '</h2>' +
          '<div style="font-size:0.85em;opacity:0.7;display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
            '<span><i class="ph ph-tag"></i> ' + Core.utils.escapeHtml(todayPlan.muscleGroup || 'Тренировка') + '</span>' +
            '<span>·</span>' +
            '<span id="workoutProgressText"><i class="ph ph-list-dashes"></i> 0/' + (todayPlan.exercises ? todayPlan.exercises.length : 0) + ' упр.</span>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;align-items:center;flex-shrink:0">' +
          '<button id="workoutFlowBtn" aria-label="Пошаговый режим" title="Пошаговый режим с таймерами" style="background:linear-gradient(135deg,var(--accent-gold),var(--accent-gold-light));color:#000;border:none;height:36px;padding:0 12px;border-radius:18px;font-size:0.8em;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;font-family:var(--font-primary);white-space:nowrap">' +
            '<i class="ph ph-play-circle" style="font-size:1.1em"></i> Пошаговый' +
          '</button>' +
          '<button id="workoutCloseBtn" aria-label="Закрыть" style="background:var(--bg-card);border:1px solid var(--border-subtle);color:var(--text-secondary);width:36px;height:36px;border-radius:50%;font-size:1.2em;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
            '<i class="ph ph-x"></i>' +
          '</button>' +
        '</div>' +
      '</div>' +
      '<div style="margin-top:10px;height:6px;background:rgba(0,0,0,0.3);border-radius:3px;overflow:hidden;border:1px solid var(--border-subtle)">' +
        '<div id="workoutProgressBar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--accent-gold),var(--accent-gold-light));border-radius:3px;transition:width 0.3s"></div>' +
      '</div>';
    content.appendChild(header);

    header.querySelector('#workoutCloseBtn').onclick = function() { self.closeWorkoutModal(); };

    var flowBtn = header.querySelector('#workoutFlowBtn');
    if (flowBtn) {
      flowBtn.onclick = function() {
        self.closeWorkoutModal();
        if (typeof WorkoutFlow !== 'undefined' && WorkoutFlow.start) {
          WorkoutFlow.start();
        } else if (typeof Notify !== 'undefined') {
          Notify.error('Модуль пошаговой тренировки не загружен');
        }
      };
    }

    var body = document.createElement('div');
    body.style.cssText = 'padding:14px 18px 18px;overflow-y:auto;flex:1;-webkit-overflow-scrolling:touch';

    var history = this.getHistory();
    var dayRecord = this._getTodayRecord(history);
    var alreadyDone = dayRecord && dayRecord.xpDayAwarded;

    if (!todayPlan.exercises || todayPlan.exercises.length === 0) {
      body.innerHTML =
        '<div style="text-align:center;padding:40px 20px;opacity:0.6">' +
          '<i class="ph ph-calendar-x" style="font-size:3em;color:var(--accent-gold);margin-bottom:12px;display:block"></i>' +
          '<p>План на сегодня пуст</p>' +
          '<button class="btn btn-primary" style="margin-top:16px;padding:12px 20px" onclick="WorkoutModule.closeWorkoutModal();Core.navigate(\'plan\')"><i class="ph ph-calendar-plus"></i> Перейти к плану</button>' +
        '</div>';
    } else {
      if (alreadyDone) {
        var doneBanner = document.createElement('div');
        doneBanner.style.cssText = 'padding:12px 16px;background:rgba(74,222,128,0.12);border:1px solid var(--accent-success);border-radius:12px;margin-bottom:14px;display:flex;align-items:center;gap:10px;font-size:0.9em';
        doneBanner.innerHTML =
          '<i class="ph ph-check-circle" style="color:var(--accent-success);font-size:1.4em;flex-shrink:0"></i>' +
          '<div><strong style="color:var(--accent-success)">Тренировка завершена</strong>' +
          '<div style="font-size:0.85em;opacity:0.75;margin-top:2px">Все подходы отмечены. +' + this.XP.PER_DAY + ' XP начислено.</div></div>';
        body.appendChild(doneBanner);
      }

      for (var i = 0; i < todayPlan.exercises.length; i++) {
        body.appendChild(this._renderExerciseCard(todayPlan.exercises[i], i, db, todayPlan, alreadyDone));
      }
    }

    content.appendChild(body);
    modal.appendChild(content);
    document.body.appendChild(modal);
    this.modalElement = modal;

    setTimeout(function() { self._updateProgress(todayPlan); }, 50);
  },

  _renderExerciseCard: function(exRef, idx, db, todayPlan, dayLocked) {
    var self = this;
    var ex = null;
    for (var j = 0; j < db.length; j++) if (db[j].id === exRef.id) { ex = db[j]; break; }
    if (!ex) return document.createDocumentFragment();

    var parsed = this._parseSetsReps(exRef.sets);
    var history = this.getHistory();
    var dayRecord = this._getTodayRecord(history);
    var exDetail = null;
    if (dayRecord && dayRecord.details) {
      for (var d = 0; d < dayRecord.details.length; d++) {
        if (dayRecord.details[d].exId === exRef.id) { exDetail = dayRecord.details[d]; break; }
      }
    }

    var setsDone = 0;
    var setsPositive = 0;
    if (exDetail && exDetail.sets) {
      for (var s = 0; s < parsed.sets; s++) {
        var st = exDetail.sets[s];
        if (st === 'done' || st === 'partial') setsPositive++;
        if (st === 'done') setsDone++;
      }
    }
    var isComplete = setsPositive >= parsed.sets;

    var card = document.createElement('div');
    card.className = 'workout-ex-card';
    card.dataset.exId = exRef.id;
    card.style.cssText = 'background:var(--bg-card);border-radius:12px;margin-bottom:10px;border:1px solid var(--border-subtle);overflow:hidden;transition:border-color 0.2s';

    var header = document.createElement('div');
    header.style.cssText = 'padding:14px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:60px';
    var setsLabel = setsDone + (setsPositive > setsDone ? '·+' + (setsPositive - setsDone) + 'ч' : '') + '/' + parsed.sets;
    header.innerHTML =
      '<div style="flex:1;min-width:0">' +
        '<div style="font-weight:700;font-size:0.98em;color:' + (isComplete ? 'var(--accent-success)' : 'var(--accent-gold)') + ';display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
          '<span>' + (idx + 1) + '. ' + Core.utils.escapeHtml(ex.name) + '</span>' +
          (isComplete ? '<i class="ph ph-check-circle" style="color:var(--accent-success)"></i>' : '') +
        '</div>' +
        '<div style="font-size:0.78em;opacity:0.7;margin-top:3px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
          '<span><i class="ph ph-tag"></i> ' + Core.utils.escapeHtml(ex.muscleGroup || 'Без категории') + '</span>' +
          '<span><i class="ph ph-list-numbers"></i> ' + parsed.sets + '×' + parsed.reps + '</span>' +
          '<span style="color:' + (isComplete ? 'var(--accent-success)' : 'var(--accent-gold)') + ';font-weight:600">' + setsLabel + '</span>' +
        '</div>' +
      '</div>' +
      '<i class="ph ph-caret-down" style="font-size:1.2em;opacity:0.7;flex-shrink:0"></i>';

    var body = document.createElement('div');
    body.style.cssText = 'display:none;padding:0 16px 16px;border-top:1px solid var(--border-subtle)';

    if (typeof Media !== 'undefined') {
      var imgEl = Media.renderImage(ex.imageUrl);
      if (imgEl) body.appendChild(imgEl);

      var videoEl = Media.renderVideo(ex.videoUrl);
      if (videoEl) {
        body.appendChild(videoEl);
      } else if (!dayLocked) {
        var placeholder = Media.renderVideoPlaceholder({
          onAdd: function() {
            self.closeWorkoutModal();
            if (typeof ExercisesModule !== 'undefined' && ExercisesModule.editExercise) {
              ExercisesModule.editExercise(ex.id);
            }
          }
        });
        if (placeholder) body.appendChild(placeholder);
      }
    }

    if (ex.description || ex.inventory || ex.notes) {
      var infoDiv = document.createElement('div');
      infoDiv.style.cssText = 'margin-top:12px;font-size:0.85em;opacity:0.85;line-height:1.5';
      var infoHtml = '';
      if (ex.description) infoHtml += '<div style="white-space:pre-wrap;margin-bottom:8px">' + Core.utils.escapeHtml(ex.description) + '</div>';
      if (ex.inventory) infoHtml += '<div style="margin-bottom:4px"><i class="ph ph-backpack" style="color:var(--accent-gold)"></i> ' + Core.utils.escapeHtml(ex.inventory) + '</div>';
      if (ex.notes) infoHtml += '<div style="border-left:3px solid var(--accent-gold);padding-left:8px;margin-top:6px"><i class="ph ph-push-pin" style="color:var(--accent-gold)"></i> ' + Core.utils.escapeHtml(ex.notes) + '</div>';
      infoDiv.innerHTML = infoHtml;
      body.appendChild(infoDiv);
    }

    var setsTitle = document.createElement('div');
    setsTitle.style.cssText = 'margin-top:14px;font-weight:600;font-size:0.9em;margin-bottom:10px';
    setsTitle.innerHTML = '<i class="ph ph-barbell" style="color:var(--accent-gold)"></i> Подходы';
    body.appendChild(setsTitle);

    var setsGrid = document.createElement('div');
    setsGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:8px';
    setsGrid.id = 'sets-grid-' + exRef.id;

    for (var si = 0; si < parsed.sets; si++) {
      setsGrid.appendChild(this._renderSetButton(exRef.id, si, parsed.reps, exDetail, dayLocked));
    }
    body.appendChild(setsGrid);

    header.onclick = function() {
      var isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      var icon = header.querySelector('i.ph');
      if (icon) icon.className = isOpen ? 'ph ph-caret-down' : 'ph ph-caret-up';
      card.style.borderColor = isOpen ? 'var(--border-subtle)' : 'var(--border-gold)';
    };

    card.appendChild(header);
    card.appendChild(body);
    return card;
  },

  _renderSetButton: function(exId, setIdx, numReps, exDetail, dayLocked) {
    var self = this;
    var btn = document.createElement('button');
    btn.className = 'workout-set-btn';
    btn.dataset.exId = exId;
    btn.dataset.setIdx = setIdx;
    btn.style.cssText = 'min-height:56px;padding:8px 6px;border-radius:10px;border:1px solid var(--border-subtle);background:var(--bg-primary);color:var(--text-primary);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font-family:var(--font-primary);transition:all 0.15s;-webkit-tap-highlight-color:transparent';

    var status = exDetail && exDetail.sets && exDetail.sets[setIdx];
    var partialReps = exDetail && exDetail.partialReps && exDetail.partialReps[setIdx];

    var iconHtml, label, color, bg;
    if (status === 'done') {
      iconHtml = '<i class="ph ph-check-circle" style="font-size:1.3em"></i>';
      label = 'Готово';
      color = 'var(--accent-success)';
      bg = 'rgba(74,222,128,0.12)';
    } else if (status === 'partial') {
      iconHtml = '<i class="ph ph-warning-circle" style="font-size:1.3em"></i>';
      label = (partialReps || 0) + '/' + numReps;
      color = 'var(--accent-warning)';
      bg = 'rgba(251,191,36,0.12)';
    } else if (status === 'missed' || status === 'skipped') {
      iconHtml = '<i class="ph ph-x-circle" style="font-size:1.3em"></i>';
      label = 'Пропуск';
      color = 'var(--text-muted)';
      bg = 'rgba(160,160,176,0.1)';
    } else {
      iconHtml = '<span style="font-size:1.2em;font-weight:700">' + (setIdx + 1) + '</span>';
      label = numReps + ' повт.';
      color = 'var(--accent-gold)';
      bg = 'var(--bg-primary)';
    }

    btn.innerHTML =
      '<span style="color:' + color + ';line-height:1">' + iconHtml + '</span>' +
      '<span style="font-size:0.7em;opacity:0.8;line-height:1">' + label + '</span>';
    btn.style.color = color;
    if (bg !== 'var(--bg-primary)') btn.style.background = bg;
    btn.style.borderColor = (status === 'done') ? 'var(--accent-success)' :
                            (status === 'partial') ? 'var(--accent-warning)' :
                            (status === 'missed' || status === 'skipped') ? 'var(--accent-error)' :
                            'var(--border-subtle)';

    if (dayLocked) {
      btn.disabled = true;
      btn.style.opacity = '0.85';
      btn.style.cursor = 'default';
    } else if (!status || status === 'missed' || status === 'skipped') {
      btn.onclick = function() { self._openSetSurvey(exId, setIdx, numReps); };
    } else {
      btn.disabled = true;
      btn.style.opacity = '0.85';
      btn.style.cursor = 'default';
    }

    return btn;
  },

  _openSetSurvey: function(exId, setIdx, numReps) {
    var self = this;
    var existing = document.getElementById('setSurveyInline');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id = 'setSurveyInline';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);z-index:2300;display:flex;justify-content:center;align-items:center;padding:16px';

    var card = document.createElement('div');
    card.style.cssText = 'background:var(--bg-secondary);border-radius:16px;padding:20px;width:100%;max-width:400px;border:1px solid var(--border-gold);box-shadow:0 0 40px rgba(212,175,55,0.2)';
    card.innerHTML =
      '<h3 style="font-family:var(--font-display);color:var(--accent-gold);margin:0 0 4px 0;text-align:center;font-size:1.2em">Подход ' + (setIdx + 1) + '</h3>' +
      '<p style="text-align:center;margin:0 0 16px 0;font-size:0.9em;opacity:0.8">Выполнил ' + numReps + ' повторений?</p>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
        '<button id="ss-yes" style="padding:14px;border-radius:10px;border:none;background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff;font-weight:600;font-size:0.95em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph ph-check-circle"></i> Да, все ' + numReps + '</button>' +
        '<button id="ss-partial" style="padding:14px;border-radius:10px;border:none;background:linear-gradient(135deg,#d97706,#f59e0b);color:#fff;font-weight:600;font-size:0.95em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph ph-warning-circle"></i> Частично</button>' +
        '<button id="ss-no" style="padding:14px;border-radius:10px;border:none;background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;font-weight:600;font-size:0.95em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><i class="ph ph-x-circle"></i> Не выполнил</button>' +
        '<button id="ss-cancel" style="padding:12px;border-radius:10px;border:1px solid var(--border-subtle);background:var(--bg-card);color:var(--text-secondary);font-weight:600;font-size:0.9em;cursor:pointer;margin-top:4px">Отмена</button>' +
      '</div>';

    modal.appendChild(card);
    document.body.appendChild(modal);

    card.querySelector('#ss-cancel').onclick = function() { modal.remove(); };
    modal.onclick = function(e) { if (e.target === modal) modal.remove(); };

    card.querySelector('#ss-yes').onclick = function() {
      modal.remove();
      self._applySetAnswer(exId, setIdx, 'done', null);
    };
    card.querySelector('#ss-no').onclick = function() {
      modal.remove();
      self._applySetAnswer(exId, setIdx, 'missed', null);
    };
    card.querySelector('#ss-partial').onclick = function() {
      modal.remove();
      self._promptPartialReps(numReps, function(partialReps) {
        var status = partialReps > 0 ? 'partial' : 'missed';
        self._applySetAnswer(exId, setIdx, status, partialReps);
      });
    };
  },

  _promptPartialReps: function(numReps, callback) {
    var modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);z-index:2350;display:flex;justify-content:center;align-items:center;padding:16px';
    var content = document.createElement('div');
    content.style.cssText = 'background:var(--bg-secondary);border-radius:16px;padding:20px;width:100%;max-width:360px;border:1px solid var(--border-gold)';
    content.innerHTML =
      '<h3 style="font-family:var(--font-display);color:var(--accent-gold);margin:0 0 12px 0;text-align:center">Сколько повторений?</h3>' +
      '<div style="text-align:center;font-size:2.2em;font-weight:bold;color:var(--accent-gold);margin:8px 0" id="partialRepsValue">' + Math.floor(numReps * 0.7) + '</div>' +
      '<input type="range" min="0" max="' + numReps + '" value="' + Math.floor(numReps * 0.7) + '" id="partialRepsSlider" style="width:100%;accent-color:var(--accent-gold);height:32px">' +
      '<div style="display:flex;gap:10px;margin-top:16px">' +
        '<button id="pr-cancel" style="flex:1;padding:12px;border-radius:10px;border:1px solid var(--border-subtle);background:var(--bg-card);color:var(--text-secondary);font-weight:600;cursor:pointer">Отмена</button>' +
        '<button id="pr-ok" style="flex:1;padding:12px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--accent-gold),var(--accent-gold-light));color:#000;font-weight:600;cursor:pointer">Готово</button>' +
      '</div>';
    modal.appendChild(content);
    document.body.appendChild(modal);

    var slider = content.querySelector('#partialRepsSlider');
    var display = content.querySelector('#partialRepsValue');
    slider.oninput = function() { display.textContent = this.value; };
    content.querySelector('#pr-cancel').onclick = function() { modal.remove(); };
    content.querySelector('#pr-ok').onclick = function() {
      var val = parseInt(slider.value) || 0;
      modal.remove();
      callback(val);
    };
  },

  _applySetAnswer: function(exId, setIdx, setStatus, partialReps) {
    var history = this.getHistory();
    var todayStr = this._todayStr();
    var dayRecord = this._getTodayRecord(history);

    if (!dayRecord) {
      dayRecord = {
        date: todayStr,
        dayName: this._todayName(),
        muscleGroup: '',
        exercises: [],
        details: [],
        duration: 0,
        timestamp: Date.now()
      };
      history.push(dayRecord);
    }

    var hasEx = false;
    for (var i = 0; i < dayRecord.exercises.length; i++) {
      if (dayRecord.exercises[i].id === exId) { hasEx = true; break; }
    }
    if (!hasEx) dayRecord.exercises.push({ id: exId });

    if (!dayRecord.details) dayRecord.details = [];
    var exDetail = null;
    for (var d = 0; d < dayRecord.details.length; d++) {
      if (dayRecord.details[d].exId === exId) { exDetail = dayRecord.details[d]; break; }
    }
    if (!exDetail) {
      exDetail = { exId: exId, sets: [], partialReps: [] };
      dayRecord.details.push(exDetail);
    }
    if (!exDetail.sets) exDetail.sets = [];
    if (!exDetail.partialReps) exDetail.partialReps = [];

    while (exDetail.sets.length <= setIdx) exDetail.sets.push(null);
    while (exDetail.partialReps.length <= setIdx) exDetail.partialReps.push(null);
    exDetail.sets[setIdx] = setStatus;
    if (partialReps !== null) exDetail.partialReps[setIdx] = partialReps;

    this._recalculateAndAward(dayRecord, exDetail, history);
  },

  _recalculateAndAward: function(dayRecord, exDetail, history) {
    var stats = this.getStats();
    var todayStr = this._todayStr();
    var leveledUp = false;

    var exXpSets = 0;
    if (exDetail.sets) {
      for (var s = 0; s < exDetail.sets.length; s++) {
        var st = exDetail.sets[s];
        if (st === 'done') exXpSets += this.XP.PER_SET;
        else if (st === 'partial') exXpSets += this.XP.PER_PARTIAL;
      }
    }
    var prevExXpSets = exDetail._xpSets || 0;
    var deltaSets = exXpSets - prevExXpSets;
    if (deltaSets !== 0) {
      stats.xp = Math.max(0, (stats.xp || 0) + deltaSets);
      if (typeof CoreData !== 'undefined' && CoreData.logXP) {
        CoreData.logXP(deltaSets, 'Подход', { exId: exDetail.exId, total: exXpSets });
      }
      exDetail._xpSets = exXpSets;
    }

    var exAllAnswered = false;
    var plan = this.getPlan();
    var todayPlan = plan[this._todayIdx()];
    var exRef = null;
    if (todayPlan && todayPlan.exercises) {
      for (var i = 0; i < todayPlan.exercises.length; i++) {
        if (todayPlan.exercises[i].id === exDetail.exId) { exRef = todayPlan.exercises[i]; break; }
      }
    }
    if (exRef) {
      var parsed = this._parseSetsReps(exRef.sets);
      exAllAnswered = true;
      for (var s2 = 0; s2 < parsed.sets; s2++) {
        var st2 = exDetail.sets[s2];
        if (!st2) { exAllAnswered = false; break; }
      }
    }

    if (exAllAnswered && !exDetail.xpAwarded) {
      exDetail.xpAwarded = true;
      stats.xp += this.XP.PER_EXERCISE;
      if (typeof CoreData !== 'undefined' && CoreData.logXP) {
        CoreData.logXP(this.XP.PER_EXERCISE, 'Упражнение завершено', { exId: exDetail.exId });
      }
    }

    var dayFullyAnswered = this._isDayFullyAnswered(todayPlan, dayRecord);
    if (dayFullyAnswered && !dayRecord.xpDayAwarded) {
      dayRecord.xpDayAwarded = true;

      if (stats.lastWorkoutDate !== todayStr) {
        stats.yes = (stats.yes || 0) + 1;
        stats.streak = (stats.streak || 0) + 1;
        stats.lastWorkoutDate = todayStr;
      }
      stats.xp += this.XP.PER_DAY;
      if (typeof CoreData !== 'undefined' && CoreData.logXP) {
        CoreData.logXP(this.XP.PER_DAY, 'День завершён', null);
      }
    }

    var xpNeeded = this._xpForLevel(stats.level);
    while (stats.xp >= xpNeeded) {
      stats.xp -= xpNeeded;
      stats.level++;
      leveledUp = true;
      xpNeeded = this._xpForLevel(stats.level);
    }

    this.saveStats(stats);
    this.saveHistory(history);
    if (typeof refreshHeaderAfterXP === 'function') refreshHeaderAfterXP();

    if (leveledUp) {
      var lvl = stats.level;
      setTimeout(function() {
        if (typeof showAchievementToast === 'function') {
          showAchievementToast('Новый уровень ' + lvl + '!', 'Ты достиг уровня ' + lvl, 'ph-star');
        }
      }, 100);
    }

    if (typeof AchievementsModule !== 'undefined' && AchievementsModule.checkAchievements) {
      AchievementsModule.checkAchievements();
    }

    var self = this;
    if (dayFullyAnswered && !this._wasDayDoneBefore) {
      this._wasDayDoneBefore = true;
      setTimeout(function() {
        if (typeof showAchievementToast === 'function') {
          showAchievementToast('🏆 День пройден!', 'Все упражнения выполнены. +' + self.XP.PER_DAY + ' XP', 'ph-trophy');
        }
        self.closeWorkoutModal();
        self.openWorkoutModal();
      }, 300);
    } else {
      this._refreshExerciseCard(exDetail.exId);
      this._updateProgress(todayPlan);
    }
  },

  _refreshExerciseCard: function(exId) {
    var card = document.querySelector('.workout-ex-card[data-ex-id="' + exId + '"]');
    if (!card) return;
    var plan = this.getPlan();
    var todayPlan = plan[this._todayIdx()];
    if (!todayPlan || !todayPlan.exercises) return;
    var idx = -1;
    for (var i = 0; i < todayPlan.exercises.length; i++) {
      if (todayPlan.exercises[i].id === exId) { idx = i; break; }
    }
    if (idx === -1) return;
    var newCard = this._renderExerciseCard(todayPlan.exercises[idx], idx, this.getDB(), todayPlan, false);
    if (newCard && newCard.nodeType === 1) {
      card.parentNode.replaceChild(newCard, card);
    }
  },

  _updateProgress: function(todayPlan) {
    var textEl = document.getElementById('workoutProgressText');
    var barEl = document.getElementById('workoutProgressBar');
    if (!textEl || !barEl) return;
    if (!todayPlan || !todayPlan.exercises) return;

    var history = this.getHistory();
    var dayRecord = this._getTodayRecord(history);

    var totalSets = 0, positiveSets = 0;
    var exDone = 0;
    for (var i = 0; i < todayPlan.exercises.length; i++) {
      var exRef = todayPlan.exercises[i];
      var parsed = this._parseSetsReps(exRef.sets);
      totalSets += parsed.sets;
      var exDetail = null;
      if (dayRecord && dayRecord.details) {
        for (var d = 0; d < dayRecord.details.length; d++) {
          if (dayRecord.details[d].exId === exRef.id) { exDetail = dayRecord.details[d]; break; }
        }
      }
      var setsPos = 0;
      if (exDetail && exDetail.sets) {
        for (var s = 0; s < parsed.sets; s++) {
          var st = exDetail.sets[s];
          if (st === 'done' || st === 'partial') setsPos++;
        }
      }
      positiveSets += setsPos;
      if (setsPos >= parsed.sets) exDone++;
    }

    textEl.innerHTML = '<i class="ph ph-list-dashes"></i> ' + exDone + '/' + todayPlan.exercises.length + ' упр. · ' + positiveSets + '/' + totalSets + ' подх.';
    var percent = totalSets > 0 ? Math.round((positiveSets / totalSets) * 100) : 0;
    barEl.style.width = percent + '%';
  },

  closeWorkoutModal: function() {
    if (this.modalElement) { this.modalElement.remove(); this.modalElement = null; }
    var old = document.getElementById('workoutModal');
    if (old) old.remove();
    var survey = document.getElementById('setSurveyInline');
    if (survey) survey.remove();
    this.currentExerciseId = null;
    this._miniSurveyContext = null;
    this._wasDayDoneBefore = false;
  }
};

window.WorkoutModule = WorkoutModule;
module.exports = WorkoutModule;