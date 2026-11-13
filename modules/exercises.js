// modules/exercises.js

const ExercisesModule = {
  _state: {
    filter: 'all',
    search: '',
    sortBy: 'default',
    sortDir: 'asc',
    editingId: null,
    muscleFilter: null,
    _searchDebounce: null
  },

  _actionsCloseBound: false,

  init: function() {
    if (typeof Logger !== 'undefined') Logger.log('Модуль базы упражнений инициализирован', 'info');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { ExercisesModule.setup(); });
    } else {
      this.setup();
    }
  },

  setup: function() {
    this._migrateCategories();
    this.createExercisesScreen();
    this._bindGlobalActionsClose();
    if (typeof Core !== 'undefined') {
      Core.addNavButton('База упражнений', 'exercises', '<i class="ph ph-books"></i>');
      Core.registerScreen('exercises', function() { ExercisesModule.createExercisesScreen(); });
    }
  },

  _bindGlobalActionsClose: function() {
    if (this._actionsCloseBound) return;
    this._actionsCloseBound = true;
    document.addEventListener('click', function(e) {
      if (e.target.closest('.cat-actions-panel')) return;
      if (e.target.closest('.cat-actions-toggle')) return;
      document.querySelectorAll('.cat-actions-panel.open').forEach(function(p) {
        p.classList.remove('open');
      });
    });
  },

  _closeAllActionPanels: function() {
    document.querySelectorAll('.cat-actions-panel.open').forEach(function(p) {
      p.classList.remove('open');
    });
  },

  _migrateCategories: function() {
    var cats = this.getCategories();
    var validIds = {};
    for (var i = 0; i < cats.length; i++) validIds[cats[i].id] = true;
    var changed = false;
    for (var i = 0; i < cats.length; i++) {
      if (cats[i].parentId && !validIds[cats[i].parentId]) {
        cats[i].parentId = null;
        changed = true;
      }
    }
    if (changed) {
      this.saveCategories(cats);
      if (typeof Logger !== 'undefined') Logger.log('Миграция категорий: очищены битые parentId', 'info');
    }
  },

  _esc: function(t) {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.escapeHtml) return Core.utils.escapeHtml(t);
    if (t == null) return '';
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
  _uid: function(prefix) {
    if (typeof Core !== 'undefined' && Core.utils && Core.utils.generateId) return Core.utils.generateId(prefix || 'ex');
    return (prefix || 'ex') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  },

  _normalize: function(raw) {
    raw = raw || {};
    return {
      id: raw.id || this._uid('ex'),
      name: raw.name || '',
      muscleGroup: raw.muscleGroup || '',
      muscles: Array.isArray(raw.muscles) ? raw.muscles.slice() : [],
      description: raw.description || '',
      videoUrl: raw.videoUrl || '',
      imageUrl: raw.imageUrl || '',
      notes: raw.notes || '',
      inventory: raw.inventory || '',
      difficulty: raw.difficulty || 3,
      effectiveness: raw.effectiveness || 3,
      timer: Math.max(0, parseInt(raw.timer, 10) || 0),        // NEW
      restTimer: Math.max(0, parseInt(raw.restTimer, 10) || 0), // NEW
      favorite: !!raw.favorite,
      createdAt: raw.createdAt || Date.now(),
      updatedAt: raw.updatedAt || Date.now()
    };
  },

  getDB: function() {
    if (typeof CoreData !== 'undefined' && CoreData.getDB) return CoreData.getDB();
    return (typeof FTStorage !== 'undefined' ? FTStorage.get('db') : null) || [];
  },
  saveDB: function(db) {
    if (typeof CoreData !== 'undefined') { CoreData.setDB(db); return; }
    if (typeof FTStorage !== 'undefined') FTStorage.set('db', db);
  },
  getDefaultExercise: function() { return this._normalize({}); },
  getExerciseById: function(id) {
    if (!id) return null;
    var db = this.getDB();
    for (var i = 0; i < db.length; i++) if (db[i].id === id) return db[i];
    return null;
  },

  getExercisesByMuscle: function(muscleId) {
    if (!muscleId) return [];
    var db = this.getDB();
    var result = [];
    for (var i = 0; i < db.length; i++) {
      if (db[i].muscles && db[i].muscles.indexOf(muscleId) !== -1) result.push(db[i]);
    }
    return result;
  },

  getMusclesForExercise: function(ex) {
    if (!ex || !ex.muscles || !ex.muscles.length) return [];
    if (typeof AnatomyModule === 'undefined' || !AnatomyModule.getMuscleById) return [];
    var result = [];
    for (var i = 0; i < ex.muscles.length; i++) {
      var m = AnatomyModule.getMuscleById(ex.muscles[i]);
      if (m) result.push(m);
    }
    return result;
  },

  getCategories: function() {
    if (typeof CoreData !== 'undefined') return CoreData.getCategories();
    return (typeof FTStorage !== 'undefined' ? FTStorage.get('categories') : null) || [];
  },
  saveCategories: function(c) {
    if (typeof CoreData !== 'undefined') { CoreData.setCategories(c); return; }
    if (typeof FTStorage !== 'undefined') FTStorage.set('categories', c);
  },
  getCategoryById: function(id) {
    if (!id) return null;
    var cats = this.getCategories();
    for (var i = 0; i < cats.length; i++) if (cats[i].id === id) return cats[i];
    return null;
  },
  getCategoryByName: function(name) {
    if (!name) return null;
    var cats = this.getCategories();
    for (var i = 0; i < cats.length; i++) if (cats[i].name === name) return cats[i];
    return null;
  },
  getCategoryAndDescendants: function(catId) {
    if (!catId) return [];
    var cats = this.getCategories();
    var childrenMap = {};
    for (var i = 0; i < cats.length; i++) {
      var pid = cats[i].parentId || '__root__';
      if (!childrenMap[pid]) childrenMap[pid] = [];
      childrenMap[pid].push(cats[i]);
    }
    var result = [];
    var stack = [catId];
    var visited = {};
    while (stack.length) {
      var cur = stack.pop();
      if (visited[cur]) continue;
      visited[cur] = true;
      result.push(cur);
      var kids = childrenMap[cur] || [];
      for (var k = 0; k < kids.length; k++) stack.push(kids[k].id);
    }
    return result;
  },
  getChildren: function(catId) {
    if (!catId) return [];
    var cats = this.getCategories();
    var result = [];
    for (var i = 0; i < cats.length; i++) if (cats[i].parentId === catId) result.push(cats[i]);
    return result;
  },
  _hasChildren: function(catId) { return this.getChildren(catId).length > 0; },
  _isAncestorOf: function(ancestorId, catId) {
    if (!ancestorId || !catId) return false;
    if (ancestorId === catId) return false;
    var cats = this.getCategories();
    var byId = {};
    for (var i = 0; i < cats.length; i++) byId[cats[i].id] = cats[i];
    var cur = catId;
    var guard = 0;
    while (cur && guard < 100) {
      var cat = byId[cur];
      if (!cat) break;
      if (cat.parentId === ancestorId) return true;
      cur = cat.parentId || null;
      guard++;
    }
    return false;
  },
  _totalPerCatWithDescendants: function(counts) {
    var flat = counts.flatTree;
    var total = {};
    for (var i = 0; i < flat.length; i++) {
      var id = flat[i].id;
      var ids = this.getCategoryAndDescendants(id);
      var sum = 0;
      for (var k = 0; k < ids.length; k++) sum += (counts.perCategory[ids[k]] || 0);
      total[id] = sum;
    }
    return total;
  },
  getCategoryPath: function(catId) {
    var path = [];
    var curId = catId;
    var guard = 0;
    var cats = this.getCategories();
    var byId = {};
    for (var i = 0; i < cats.length; i++) byId[cats[i].id] = cats[i];
    while (curId && guard < 100) {
      var cat = byId[curId];
      if (!cat) break;
      path.unshift(cat.name);
      curId = cat.parentId || null;
      guard++;
    }
    return path;
  },
  _getCategoryPathIds: function(catId) {
    var path = [];
    var curId = catId;
    var guard = 0;
    var cats = this.getCategories();
    var byId = {};
    for (var i = 0; i < cats.length; i++) byId[cats[i].id] = cats[i];
    while (curId && guard < 100) {
      var cat = byId[curId];
      if (!cat) break;
      path.unshift(cat.id);
      curId = cat.parentId || null;
      guard++;
    }
    return path;
  },
  _flatCategoryTree: function() {
    var cats = this.getCategories();
    var childrenMap = {};
    for (var i = 0; i < cats.length; i++) {
      var pid = cats[i].parentId || '__root__';
      if (!childrenMap[pid]) childrenMap[pid] = [];
      childrenMap[pid].push(cats[i]);
    }
    var result = [];
    var walk = function(parentId, depth) {
      var list = childrenMap[parentId] || [];
      for (var i = 0; i < list.length; i++) {
        var cat = list[i];
        result.push({ id: cat.id, name: cat.name, parentId: cat.parentId || null, depth: depth });
        walk(cat.id, depth + 1);
      }
    };
    walk('__root__', 0);
    return result;
  },
  _wouldCreateCycle: function(catId, parentId) {
    if (!parentId) return false;
    if (catId === parentId) return true;
    var descendants = this.getCategoryAndDescendants(catId);
    return descendants.indexOf(parentId) !== -1;
  },
  _counts: function() {
    var db = this.getDB();
    var flat = this._flatCategoryTree();
    var favorites = 0, uncategorized = 0;
    var perCat = {};
    for (var i = 0; i < db.length; i++) {
      if (db[i].favorite) favorites++;
      if (!db[i].muscleGroup) uncategorized++;
      else perCat[db[i].muscleGroup] = (perCat[db[i].muscleGroup] || 0) + 1;
    }
    return { total: db.length, favorites: favorites, uncategorized: uncategorized, perCategory: perCat, flatTree: flat };
  },
  _filtered: function() {
    var db = this.getDB();
    var filter = this._state.filter;
    var search = (this._state.search || '').trim().toLowerCase();
    var sortBy = this._state.sortBy;
    var sortDir = this._state.sortDir;
    var muscleFilter = this._state.muscleFilter;
    var filtered = db;

    if (filter === 'favorites') filtered = filtered.filter(function(e) { return e.favorite; });
    else if (filter === 'uncategorized') filtered = filtered.filter(function(e) { return !e.muscleGroup; });
    else if (filter !== 'all') {
      var ids = this.getCategoryAndDescendants(filter);
      filtered = filtered.filter(function(e) { return ids.indexOf(e.muscleGroup) !== -1; });
    }

    if (muscleFilter) filtered = filtered.filter(function(e) { return e.muscles && e.muscles.indexOf(muscleFilter) !== -1; });
    if (search) {
      filtered = filtered.filter(function(e) {
        return (e.name || '').toLowerCase().indexOf(search) !== -1 ||
               (e.description || '').toLowerCase().indexOf(search) !== -1;
      });
    }

    var dir = sortDir === 'desc' ? -1 : 1;
    if (sortBy === 'name') filtered = filtered.slice().sort(function(a, b) { return dir * (a.name || '').localeCompare(b.name || ''); });
    else if (sortBy === 'difficulty') filtered = filtered.slice().sort(function(a, b) { return dir * ((a.difficulty || 0) - (b.difficulty || 0)); });
    else if (sortBy === 'effectiveness') filtered = filtered.slice().sort(function(a, b) { return dir * ((a.effectiveness || 0) - (b.effectiveness || 0)); });
    else if (sortBy === 'favorite') filtered = filtered.slice().sort(function(a, b) { return dir * ((a.favorite ? 0 : 1) - (b.favorite ? 0 : 1)); });

    return filtered;
  },

  createExercisesScreen: function() {
    var screen = document.getElementById('screen-exercises');
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'screen-exercises';
      screen.className = 'screen';
      document.getElementById('userInterface').appendChild(screen);
    }
    screen.innerHTML =
      this._css() +
      '<div style="padding:4px;max-width:700px;margin:0 auto">' +
        '<h2 style="font-family:var(--font-display);font-size:1.8em;margin-bottom:16px;color:var(--accent-gold);display:flex;align-items:center;gap:12px"><i class="ph ph-books"></i> База упражнений</h2>' +
        '<div id="exToolbar"></div>' +
        '<div id="exAddBtnWrap"></div>' +
        '<div id="exList"></div>' +
      '</div>';
    this.renderToolbar();
    this.renderAddButton();
    this.renderExList();
    var self = this;
    setTimeout(function() { self.initDragScroll(); }, 50);
  },

  _css: function() {
    return '<style>' +
      '.ex-card { background:var(--bg-card); border-radius:12px; padding:16px; margin-bottom:12px; border:1px solid var(--border-subtle); cursor:pointer; transition:all 0.2s; position:relative; }' +
      '.ex-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.3); border-color:var(--border-gold); }' +
      '.ex-card.favorite { border-left:3px solid var(--accent-gold); }' +
      '.ex-modal { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); backdrop-filter:blur(15px); z-index:1000; display:flex; justify-content:center; align-items:center; padding:15px; }' +
      '.ex-modal-content { background:var(--modal-bg, var(--bg-secondary)); padding:28px; border-radius:24px; width:100%; max-width:600px; max-height:90vh; overflow-y:auto; border:1px solid var(--border-gold); box-shadow:var(--modal-shadow, 0 10px 40px rgba(0,0,0,0.5)); }' +
      '.hint { font-size:0.75em; opacity:0.6; margin-top:3px; }' +
      '.cat-row { display:flex; gap:8px; overflow-x:auto; overflow-y:hidden; padding:8px 4px; scrollbar-width:none; flex:1; min-width:0; }' +
      '.cat-row::-webkit-scrollbar { height:6px; display:none; }' +
      '.cat-row:hover::-webkit-scrollbar { display:block; }' +
      '.cat-row::-webkit-scrollbar-thumb { background:var(--accent-gold); border-radius:3px; }' +
      '.root-row { position:relative; display:flex; align-items:center; gap:0; }' +
      '.level-row { position:relative; display:flex; align-items:center; gap:0; padding:0; border-top:1px dashed var(--border-subtle); margin-top:4px; }' +
      '.level-row .cat-row { padding-left:16px; }' +
      '.level-actions, .root-actions { display:flex; align-items:center; padding:0; border:none; background:transparent; position:relative; flex-shrink:0; align-self:center; }' +
      '.cat-actions-toggle { display:inline-flex; width:36px; min-width:36px; height:36px; padding:0; margin:0; background:transparent !important; border:none !important; outline:none; border-radius:0 !important; box-shadow:none !important; color:var(--text-secondary); cursor:pointer; align-items:center; justify-content:center; font-size:1.5em; transition:color 0.2s, filter 0.2s; flex-shrink:0; box-sizing:border-box; }' +
      '.cat-actions-toggle:hover { color:var(--accent-gold); filter:drop-shadow(0 0 4px rgba(212,175,55,0.6)); }' +
      '.cat-actions-toggle:active { color:var(--accent-gold-light); filter:drop-shadow(0 0 6px rgba(244,208,63,0.8)); }' +
      '.cat-actions-panel { display:none; position:absolute; top:100%; right:0; margin-top:6px; background:var(--modal-bg, var(--bg-secondary)); border:1px solid var(--border-gold); border-radius:10px; padding:6px; z-index:30; box-shadow:0 8px 24px rgba(0,0,0,0.5); flex-direction:column; gap:4px; min-width:200px; }' +
      '.cat-actions-panel.open { display:flex; }' +
      '.cat-actions-panel button { display:flex; align-items:center; gap:10px; padding:10px 12px; background:transparent; border:none; border-radius:8px; cursor:pointer; color:var(--text-primary); font-size:0.9em; text-align:left; transition:background 0.2s; white-space:nowrap; font-family:var(--font-primary); }' +
      '.cat-actions-panel button:hover { background:var(--accent-gold-dim); }' +
      '.cat-actions-panel button.danger:hover { background:rgba(248,113,113,0.15); color:var(--accent-error); }' +
      '.cat-actions-panel button:disabled { opacity:0.35; cursor:not-allowed; }' +
      '.cat-actions-panel button i { font-size:1.1em; color:var(--accent-gold); width:20px; text-align:center; }' +
      '.cat-actions-panel button.danger i { color:var(--accent-error); }' +
      '.cat-btn { padding:8px 14px; font-size:0.85em; border:1px solid var(--border-subtle); border-radius:20px; cursor:pointer; transition:all 0.2s; background:var(--bg-card); color:var(--text-secondary); display:inline-flex; align-items:center; gap:6px; white-space:nowrap; flex-shrink:0; height:36px; box-sizing:border-box; }' +
      '.cat-btn.active { background:linear-gradient(135deg, var(--accent-gold), var(--accent-gold-light)); color:var(--text-on-accent); border-color:var(--accent-gold); font-weight:600; }' +
      '.cat-btn.ancestor { background:var(--accent-gold-dim); border-color:var(--border-gold); color:var(--accent-gold); }' +
      '.cat-btn:not(.active):not(.ancestor):hover { background:var(--bg-hover); color:var(--text-primary); }' +
      '.cat-btn.child { border-style:dashed; }' +
      '.cat-action-btn { width:28px; height:28px; border-radius:50%; background:var(--bg-primary); border:1px solid var(--border-subtle); color:var(--text-secondary); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; font-size:0.85em; transition:all 0.2s; flex-shrink:0; }' +
      '.cat-action-btn:hover:not(:disabled) { background:var(--accent-gold-dim); border-color:var(--border-gold); color:var(--accent-gold); }' +
      '.cat-action-btn:disabled { opacity:0.3; cursor:not-allowed; }' +
      '.cat-action-btn.danger:hover:not(:disabled) { background:rgba(248,113,113,0.15); border-color:var(--accent-error); color:var(--accent-error); }' +
      '.fav-btn { background:transparent; border:none; cursor:pointer; font-size:1.3em; padding:4px 8px; transition:all 0.2s; }' +
      '.fav-btn:hover { transform:scale(1.2); }' +
      '.fav-btn.active { color:var(--accent-gold); }' +
      '.fav-btn:not(.active) { color:var(--text-muted); opacity:0.5; }' +
      '.ex-view-section { background:var(--bg-primary); padding:14px; border-radius:10px; margin-bottom:12px; }' +
      '.ex-view-section h3 { color:var(--accent-gold); margin:0 0 10px 0; display:flex; align-items:center; gap:8px; font-family:var(--font-display); font-size:1.1em; }' +
      '.ex-view-actions { display:flex; gap:10px; margin-top:20px; }' +
      '.ex-search { flex:1; min-width:140px; padding:8px 10px; background:var(--bg-input); border:1px solid var(--border-subtle); border-radius:8px; color:var(--text-primary); font-size:0.9em; }' +
      '.ex-sort { padding:8px 10px; background:var(--bg-input); border:1px solid var(--border-subtle); border-radius:8px; color:var(--text-primary); font-size:0.9em; }' +
      '.ex-muscle-chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }' +
      '.ex-muscle-chip { display:inline-flex; align-items:center; gap:4px; padding:4px 10px; background:var(--accent-gold-dim); border:1px solid var(--border-gold); border-radius:14px; font-size:0.78em; color:var(--accent-gold); cursor:pointer; transition:all 0.15s; }' +
      '.ex-muscle-chip:hover { background:var(--accent-gold); color:var(--text-on-accent); }' +
      '.ex-muscle-chip i { font-size:0.95em; }' +
      '.muscle-selector { background:var(--bg-primary); border:1px solid var(--border-subtle); border-radius:10px; padding:10px; max-height:320px; overflow-y:auto; }' +
      '.muscle-part-acc { border-bottom:1px solid var(--border-subtle); }' +
      '.muscle-part-acc:last-child { border-bottom:none; }' +
      '.muscle-part-header { display:flex; align-items:center; gap:8px; padding:8px 6px; cursor:pointer; font-size:0.85em; font-weight:600; color:var(--text-primary); transition:background 0.15s; border-radius:6px; }' +
      '.muscle-part-header:hover { background:var(--accent-gold-dim); }' +
      '.muscle-part-header .part-icon { color:var(--accent-gold); font-size:1.1em; }' +
      '.muscle-part-header .part-name { flex:1; }' +
      '.muscle-part-header .part-count { font-size:0.75em; opacity:0.6; font-weight:500; }' +
      '.muscle-part-header .chevron { font-size:0.9em; opacity:0.6; transition:transform 0.2s; }' +
      '.muscle-part-acc.open .muscle-part-header .chevron { transform:rotate(180deg); }' +
      '.muscle-part-body { display:none; padding:4px 6px 8px; }' +
      '.muscle-part-acc.open .muscle-part-body { display:block; }' +
      '.muscle-check-row { display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:6px; cursor:pointer; font-size:0.82em; transition:background 0.15s; }' +
      '.muscle-check-row:hover { background:var(--bg-hover); }' +
      '.muscle-check-row input { accent-color:var(--accent-gold); width:16px; height:16px; flex-shrink:0; cursor:pointer; }' +
      '.muscle-check-row .m-latin { font-style:italic; opacity:0.55; font-size:0.85em; margin-left:4px; }' +
      '.muscle-search { width:100%; padding:8px 10px; background:var(--bg-secondary); border:1px solid var(--border-subtle); border-radius:8px; color:var(--text-primary); font-size:0.85em; margin-bottom:8px; }' +
      '.muscle-selected-summary { font-size:0.8em; color:var(--accent-gold); margin-bottom:6px; display:flex; align-items:center; gap:4px; }' +
      '@media (prefers-reduced-motion: reduce) { .ex-card, .cat-btn, .fav-btn, .cat-actions-toggle, .ex-muscle-chip, .muscle-part-header .chevron { transition: none !important; } .cat-actions-toggle:hover { filter: none; } }' +
    '</style>';
  },

  renderToolbar: function() {
    var esc = this._esc;
    var host = document.getElementById('exToolbar');
    if (!host) return;
    var searchValue = esc(this._state.search || '');
    var sortValue = this._state.sortBy;
    var sortDir = this._state.sortDir;
    var sortOptions = [
      { id: 'default', label: 'По умолчанию' },
      { id: 'name', label: 'По названию' },
      { id: 'difficulty', label: 'По сложности' },
      { id: 'effectiveness', label: 'По эффективности' },
      { id: 'favorite', label: 'Сначала избранные' }
    ];
    var sortHtml = '';
    for (var i = 0; i < sortOptions.length; i++) {
      var sel = (sortValue === sortOptions[i].id);
      sortHtml += '<option value="' + sortOptions[i].id + '" ' + (sel ? 'selected' : '') + '>' + sortOptions[i].label + '</option>';
    }
    var sortDirHtml = '';
    if (sortValue !== 'default') {
      sortDirHtml = '<button class="cat-action-btn" onclick="ExercisesModule.toggleSortDir()" title="' + (sortDir === 'asc' ? 'По возрастанию' : 'По убыванию') + '" style="margin-left:4px">' +
        '<i class="ph ' + (sortDir === 'asc' ? 'ph-sort-ascending' : 'ph-sort-descending') + '"></i></button>';
    }
    var muscleFilterHtml = '';
    if (this._state.muscleFilter) {
      var mLabel = this._state.muscleFilter;
      if (typeof AnatomyModule !== 'undefined' && AnatomyModule.getMuscleById) {
        var mm = AnatomyModule.getMuscleById(this._state.muscleFilter);
        if (mm) mLabel = mm.name;
      }
      muscleFilterHtml =
        '<div style="margin-top:10px;padding:8px 12px;background:var(--accent-gold-dim);border:1px solid var(--border-gold);border-radius:10px;display:flex;align-items:center;gap:8px;font-size:0.85em">' +
          '<i class="ph ph-funnel" style="color:var(--accent-gold)"></i>' +
          '<span>Фильтр по мышце: <strong>' + esc(mLabel) + '</strong></span>' +
          '<button onclick="ExercisesModule.clearMuscleFilter()" style="margin-left:auto;background:transparent;border:none;color:var(--accent-error);cursor:pointer;font-size:1.1em;padding:2px 6px" title="Сбросить фильтр"><i class="ph ph-x"></i></button>' +
        '</div>';
    }
    host.innerHTML =
      '<div style="background:var(--bg-card);border-radius:14px;padding:16px;margin-bottom:16px;border:1px solid var(--border-subtle)">' +
        '<div style="font-weight:600;font-size:0.95em;display:flex;align-items:center;gap:8px;margin-bottom:8px"><i class="ph ph-folder" style="color:var(--accent-gold)"></i> Категории</div>' +
        '<div class="root-row">' +
          '<div class="cat-row" id="catScrollContainer"></div>' +
          this._renderRootActions() +
        '</div>' +
        '<div id="catLevelsContainer" style="display:flex;flex-direction:column"></div>' +
        '<div class="hint" style="margin-top:10px;display:flex;align-items:center;gap:6px"><i class="ph ph-info"></i> Скролль мышкой или пальцем. Кликни на категорию.</div>' +
        muscleFilterHtml +
        '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center">' +
          '<input id="exSearchInput" class="ex-search" type="text" placeholder="Поиск по названию, описанию..." value="' + searchValue + '" oninput="ExercisesModule.onSearchInput(this.value)">' +
          '<select id="exSortSelect" class="ex-sort" onchange="ExercisesModule.setSort(this.value)">' + sortHtml + '</select>' +
          sortDirHtml +
        '</div>' +
      '</div>';
    this.renderCatStrip();
    this.renderLevels();
    this.initDragScroll();
  },

  _renderRootActions: function() {
    var activeId = this._state.filter;
    var isSystem = ['all', 'uncategorized', 'favorites'].indexOf(activeId) !== -1;
    var activeCat = !isSystem ? this.getCategoryById(activeId) : null;
    var activeRootId = (activeCat && !activeCat.parentId) ? activeId : '';
    return this._renderActionsBlock({ ownerId: null, activeId: activeRootId, isRootBlock: true });
  },

  _renderLevelActions: function(activeInLevel, ownerId) {
    return this._renderActionsBlock({ ownerId: ownerId, activeId: activeInLevel || '', isRootBlock: false });
  },

  _renderActionsBlock: function(opts) {
    var ownerId = opts.ownerId || '';
    var activeId = opts.activeId || '';
    var disable = !activeId;
    var ownerStr = ownerId ? this._esc(ownerId).replace(/'/g, "\\'") : '';
    var activeStr = activeId ? this._esc(activeId).replace(/'/g, "\\'") : '';
    var addSiblingOnclick = ownerId ? "ExercisesModule.openCategoryForm(null, '" + ownerStr + "')" : "ExercisesModule.openCategoryForm()";
    var addSiblingTitle = ownerId ? 'Создать категорию на этом уровне' : 'Создать корневую категорию';
    var addSubOnclick = "ExercisesModule.openCategoryForm(null, '" + activeStr + "')";
    var editOnclick = "ExercisesModule.openCategoryForm('" + activeStr + "')";
    var delOnclick = "ExercisesModule.deleteCategory('" + activeStr + "')";
    var disabledAttr = disable ? 'disabled' : '';
    var blockClass = opts.isRootBlock ? 'root-actions' : 'level-actions';
    return '<div class="' + blockClass + '">' +
      '<button class="cat-actions-toggle" title="Действия" onclick="event.stopPropagation(); ExercisesModule.toggleActionsPanel(this)"><i class="ph ph-gear"></i></button>' +
      '<div class="cat-actions-panel">' +
        '<button onclick="' + addSiblingOnclick + '"><i class="ph ph-plus"></i> ' + addSiblingTitle + '</button>' +
        '<button ' + disabledAttr + ' onclick="' + addSubOnclick + '"><i class="ph ph-folder-plus"></i> Создать подкатегорию</button>' +
        '<button ' + disabledAttr + ' onclick="' + editOnclick + '"><i class="ph ph-pencil-simple"></i> Редактировать</button>' +
        '<button class="danger" ' + disabledAttr + ' onclick="' + delOnclick + '"><i class="ph ph-trash"></i> Удалить</button>' +
      '</div>' +
    '</div>';
  },

  toggleActionsPanel: function(btn) {
    var block = btn.closest('.level-actions, .root-actions');
    if (!block) return;
    var panel = block.querySelector('.cat-actions-panel');
    if (!panel) return;
    var isOpen = panel.classList.contains('open');
    this._closeAllActionPanels();
    if (!isOpen) panel.classList.add('open');
  },

  renderCatStrip: function() {
    var esc = this._esc;
    var container = document.getElementById('catScrollContainer');
    if (!container) return;
    var counts = this._counts();
    var filter = this._state.filter;
    var roots = counts.flatTree.filter(function(c) { return !c.parentId; });
    var html = '';
    html += '<button class="cat-btn ' + (filter === 'all' ? 'active' : '') + '" data-cat="all" onclick="ExercisesModule.setFilter(\'all\')"><i class="ph ph-squares-four"></i> Все (' + counts.total + ')</button>';
    if (counts.favorites > 0) {
      html += '<button class="cat-btn ' + (filter === 'favorites' ? 'active' : '') + '" data-cat="favorites" onclick="ExercisesModule.setFilter(\'favorites\')"><i class="ph-fill ph-star"></i> Избранное (' + counts.favorites + ')</button>';
    }
    html += '<button class="cat-btn ' + (filter === 'uncategorized' ? 'active' : '') + '" data-cat="uncategorized" onclick="ExercisesModule.setFilter(\'uncategorized\')"><i class="ph ph-question"></i> Без категории (' + counts.uncategorized + ')</button>';
    var totalForCat = this._totalPerCatWithDescendants(counts);
    for (var i = 0; i < roots.length; i++) {
      var cat = roots[i];
      var safeId = esc(cat.id).replace(/'/g, "\\'");
      var hasKids = this._hasChildren(cat.id);
      var arrow = hasKids ? '<i class="ph ph-caret-down" style="font-size:0.85em;opacity:0.7"></i>' : '';
      var isActive = filter === cat.id;
      var isAncestor = this._isAncestorOf(cat.id, filter);
      var cls = 'cat-btn';
      if (isActive) cls += ' active';
      else if (isAncestor) cls += ' ancestor';
      html += '<button class="' + cls + '" data-cat="' + safeId + '" onclick="ExercisesModule.setFilter(\'' + safeId + '\')">' +
              arrow + '<i class="ph ph-tag"></i> ' + esc(cat.name) + ' (' + (totalForCat[cat.id] || 0) + ')</button>';
    }
    var prevScroll = container.scrollLeft;
    container.innerHTML = html;
    container.scrollLeft = prevScroll;
    container.dataset.dragInited = '';
    this._bindDragScroll(container);
  },

  renderLevels: function() {
    var esc = this._esc;
    var host = document.getElementById('catLevelsContainer');
    if (!host) return;
    var activeId = this._state.filter;
    if (['all', 'favorites', 'uncategorized'].indexOf(activeId) !== -1) { host.innerHTML = ''; return; }
    var pathIds = this._getCategoryPathIds(activeId);
    if (pathIds.length === 0) { host.innerHTML = ''; return; }
    var counts = this._counts();
    var totalForCat = this._totalPerCatWithDescendants(counts);
    var html = '';
    for (var level = 1; level <= pathIds.length; level++) {
      var ownerId = pathIds[level - 1];
      var children = this.getChildren(ownerId);
      if (children.length === 0) continue;
      var activeInLevel = '';
      for (var k = 0; k < children.length; k++) {
        if (children[k].id === activeId) { activeInLevel = activeId; break; }
      }
      html += '<div class="level-row">';
      html += '<div class="cat-row" id="catLevel' + level + '">';
      for (var k = 0; k < children.length; k++) {
        var child = children[k];
        var safeChild = esc(child.id).replace(/'/g, "\\'");
        var hasKids = this._hasChildren(child.id);
        var arrow = hasKids ? '<i class="ph ph-caret-down" style="font-size:0.85em;opacity:0.7"></i>' : '';
        var isActive = (child.id === activeId);
        var cls = 'cat-btn child';
        if (isActive) cls += ' active';
        else if (this._isAncestorOf(child.id, activeId)) cls += ' ancestor';
        html += '<button class="' + cls + '" onclick="ExercisesModule.setFilter(\'' + safeChild + '\')">' +
                arrow + '<i class="ph ph-tag"></i> ' + esc(child.name) + ' (' + (totalForCat[child.id] || 0) + ')</button>';
      }
      html += '</div>';
      html += this._renderLevelActions(activeInLevel, ownerId);
      html += '</div>';
    }
    host.innerHTML = html;
    for (var lvl = 1; lvl <= pathIds.length; lvl++) {
      var row = document.getElementById('catLevel' + lvl);
      if (row) this._bindDragScroll(row);
    }
  },

  renderExList: function() {
    var esc = this._esc;
    var host = document.getElementById('exList');
    if (!host) return;
    var filtered = this._filtered();
    if (filtered.length === 0) {
      var icon = this._state.filter === 'favorites' ? 'ph-star' : 'ph-books';
      var text;
      if (this._state.search) text = 'Ничего не найдено по запросу «' + esc(this._state.search) + '»';
      else if (this._state.muscleFilter) text = 'Нет упражнений с этой мышцей. Добавь мышцу в упражнение!';
      else if (this._state.filter === 'favorites') text = 'Нет избранных упражнений. Нажми ☆ на упражнении.';
      else text = 'Ничего не найдено. Добавь первое упражнение!';
      host.innerHTML = '<div style="text-align:center;padding:40px;opacity:0.6"><i class="ph ' + icon + '" style="font-size:3em;color:var(--accent-gold);margin-bottom:10px;display:block"></i><p>' + text + '</p></div>';
      return;
    }
    var html = '';
    for (var i = 0; i < filtered.length; i++) {
      var ex = filtered[i];
      var diff = ex.difficulty || 3;
      var eff = ex.effectiveness || 3;
      var isFav = ex.favorite ? 'favorite' : '';
      var catPath = '';
      if (ex.muscleGroup) {
        var path = this.getCategoryPath(ex.muscleGroup);
        catPath = path.length ? path.join(' / ') : '';
      }
      html += '<div class="ex-card ' + isFav + '" onclick="ExercisesModule.viewExercise(\'' + esc(ex.id) + '\')">';
      html += '<div style="display:flex;justify-content:space-between;align-items:start">';
      html += '<div style="flex:1">';
      html += '<h4 style="margin:0 0 6px 0;color:var(--accent-gold);font-size:1.05em;display:flex;align-items:center;gap:8px;flex-wrap:wrap">' + esc(ex.name);
      if (ex.videoUrl) html += ' <i class="ph ph-video-camera" style="color:var(--accent-neon)"></i>';
      if (ex.imageUrl) html += ' <i class="ph ph-image" style="color:var(--accent-neon)"></i>';
      if (ex.timer > 0) html += ' <i class="ph ph-timer" style="color:var(--accent-gold)" title="Таймер ' + ex.timer + 'с"></i>';  // NEW
      html += '</h4>';
      html += '<div style="font-size:0.85em;opacity:0.7;margin-bottom:6px;display:flex;align-items:center;gap:6px"><i class="ph ph-tag"></i> ' + esc(catPath || 'Без категории') + '</div>';
      if (ex.muscles && ex.muscles.length > 0) {
        var muscleNames = this.getMusclesForExercise(ex).map(function(m) { return m.name; });
        if (muscleNames.length > 0) {
          html += '<div style="font-size:0.78em;opacity:0.7;margin-bottom:6px;display:flex;align-items:center;gap:6px"><i class="ph ph-person" style="color:var(--accent-gold)"></i> ' + esc(muscleNames.join(', ')) + '</div>';
        }
      }
      html += '<div style="font-size:0.8em;opacity:0.7;display:flex;gap:16px;flex-wrap:wrap">';
      html += '<span style="display:flex;align-items:center;gap:4px"><i class="ph ph-fire" style="color:var(--accent-warning)"></i> ' + Core.utils.renderStars(diff) + '</span>';
      html += '<span style="display:flex;align-items:center;gap:4px"><i class="ph ph-target" style="color:var(--accent-success)"></i> ' + Core.utils.renderStars(eff) + '</span>';
      html += '</div></div>';
      html += '<div style="display:flex;gap:6px;margin-left:10px;align-items:center">';
      html += '<button class="fav-btn ' + (ex.favorite ? 'active' : '') + '" onclick="event.stopPropagation();ExercisesModule.toggleFavorite(\'' + esc(ex.id) + '\')" title="В избранное"><i class="' + (ex.favorite ? 'ph-fill' : 'ph') + ' ph-star"></i></button>';
      html += '<button class="btn btn-secondary" style="padding:6px 10px;font-size:0.85em" onclick="event.stopPropagation();ExercisesModule.editExercise(\'' + esc(ex.id) + '\')"><i class="ph ph-pencil-simple"></i></button>';
      html += '<button class="btn btn-danger" style="padding:6px 10px;font-size:0.85em" onclick="event.stopPropagation();ExercisesModule.deleteExercise(\'' + esc(ex.id) + '\')"><i class="ph ph-trash"></i></button>';
      html += '</div></div></div>';
    }
    host.innerHTML = html;
  },

  renderAddButton: function() {
    var esc = this._esc;
    var host = document.getElementById('exAddBtnWrap');
    if (!host) return;
    var filter = this._state.filter;
    var isCustomCat = filter !== 'all' && filter !== 'uncategorized' && filter !== 'favorites';
    var catName = isCustomCat ? (this.getCategoryById(filter) || {}).name || '' : '';
    var addBtnText = isCustomCat ? 'Добавить в «' + esc(catName) + '»' : 'Добавить упражнение';
    var defaultCat = isCustomCat ? filter : '';
    host.innerHTML =
      '<button id="addExerciseBtn" class="btn btn-primary" style="width:100%;padding:14px;font-size:1em;font-weight:600;margin-bottom:16px" onclick="ExercisesModule.openExForm(null, \'' + esc(defaultCat).replace(/'/g, "\\'") + '\')"><i class="ph ph-plus-circle"></i> ' + addBtnText + '</button>';
  },

  _centerActiveCategory: function(smooth) {
    var active = document.querySelector('#catLevelsContainer .cat-btn.active, #catScrollContainer .cat-btn.active');
    if (!active) return;
    var scroller = active.closest('.cat-row');
    if (!scroller) return;
    var cRect = scroller.getBoundingClientRect();
    var aRect = active.getBoundingClientRect();
    var aLeft = (aRect.left - cRect.left) + scroller.scrollLeft;
    var aWidth = active.offsetWidth;
    var cWidth = scroller.clientWidth;
    var maxScroll = scroller.scrollWidth - cWidth;
    if (maxScroll <= 0) return;
    var desired = aLeft + aWidth / 2 - cWidth / 2;
    if (desired < 0) desired = 0;
    if (desired > maxScroll) desired = maxScroll;
    if (Math.abs(desired - scroller.scrollLeft) < 1) return;
    scroller.scrollTo({ left: desired, behavior: smooth ? 'smooth' : 'auto' });
  },

  _bindDragScroll: function(container) {
    if (!container) return;
    if (container._dragAbort) container._dragAbort.abort();
    var ac = new AbortController();
    container._dragAbort = ac;
    var opts = { signal: ac.signal };
    var optsPassive = { signal: ac.signal, passive: true };
    var optsActive = { signal: ac.signal, passive: false };
    var isDown = false, startX, scrollLeft;
    container.addEventListener('mousedown', function(e) { isDown = true; startX = e.pageX - container.offsetLeft; scrollLeft = container.scrollLeft; }, opts);
    container.addEventListener('mouseleave', function() { isDown = false; }, opts);
    container.addEventListener('mouseup', function() { isDown = false; }, opts);
    container.addEventListener('mousemove', function(e) {
      if (!isDown) return;
      e.preventDefault();
      var x = e.pageX - container.offsetLeft;
      container.scrollLeft = scrollLeft - (x - startX) * 2;
    }, opts);
    var touchStartX = 0, touchScrollLeft = 0;
    container.addEventListener('touchstart', function(e) { touchStartX = e.touches[0].pageX - container.offsetLeft; touchScrollLeft = container.scrollLeft; }, optsPassive);
    container.addEventListener('touchmove', function(e) {
      var x = e.touches[0].pageX - container.offsetLeft;
      container.scrollLeft = touchScrollLeft - (x - touchStartX) * 2;
    }, optsPassive);
    container.addEventListener('wheel', function(e) {
      if (container.scrollWidth <= container.clientWidth) return;
      e.preventDefault();
      var delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16;
      else if (e.deltaMode === 2) delta *= 400;
      container.scrollLeft += delta * 1.5;
    }, optsActive);
  },

  initDragScroll: function() {
    var root = document.getElementById('catScrollContainer');
    if (root) this._bindDragScroll(root);
    var levels = document.querySelectorAll('#catLevelsContainer .cat-row');
    for (var i = 0; i < levels.length; i++) this._bindDragScroll(levels[i]);
  },

  setFilter: function(f) {
    if (this._state.filter === f) { this._centerActiveCategory(true); this.renderLevels(); return; }
    this._state.filter = f;
    this._closeAllActionPanels();
    var container = document.getElementById('catScrollContainer');
    if (container) {
      var btns = container.querySelectorAll('.cat-btn');
      for (var i = 0; i < btns.length; i++) {
        var catId = btns[i].getAttribute('data-cat');
        btns[i].classList.toggle('active', catId === f);
        btns[i].classList.toggle('ancestor', this._isAncestorOf(catId, f));
      }
    }
    this.renderAddButton();
    this.renderExList();
    this.renderLevels();
    var rootActions = document.querySelector('.root-actions');
    if (rootActions) {
      var tmp = document.createElement('div');
      tmp.innerHTML = this._renderRootActions();
      rootActions.parentNode.replaceChild(tmp.firstChild, rootActions);
    }
    var self = this;
    requestAnimationFrame(function() { self._centerActiveCategory(true); });
  },

  setMuscleFilter: function(muscleId) {
    this._state.muscleFilter = muscleId || null;
    this.renderToolbar();
    this.renderExList();
    var self = this;
    requestAnimationFrame(function() { self._centerActiveCategory(true); });
  },

  clearMuscleFilter: function() {
    this._state.muscleFilter = null;
    this.renderToolbar();
    this.renderExList();
  },

  onSearchInput: function(value) {
    this._state.search = value || '';
    var self = this;
    if (this._state._searchDebounce) clearTimeout(this._state._searchDebounce);
    this._state._searchDebounce = setTimeout(function() { self.renderExList(); }, 150);
  },

  setSort: function(sortBy) {
    if (this._state.sortBy === sortBy && sortBy !== 'default') {
      this._state.sortDir = this._state.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this._state.sortBy = sortBy || 'default';
      this._state.sortDir = 'asc';
    }
    this.renderToolbar();
    this.renderExList();
  },

  toggleSortDir: function() {
    this._state.sortDir = this._state.sortDir === 'asc' ? 'desc' : 'asc';
    this.renderToolbar();
    this.renderExList();
  },

  openCategoryForm: function(oldId, presetParentId) {
    this._closeAllActionPanels();
    var esc = this._esc;
    var isEdit = !!oldId;
    var current = oldId ? this.getCategoryById(oldId) : null;
    var parentId = null;
    if (isEdit) parentId = current ? current.parentId : null;
    else if (presetParentId) parentId = presetParentId;
    var parentName = '';
    if (parentId) {
      var parent = this.getCategoryById(parentId);
      parentName = parent ? this.getCategoryPath(parentId).join(' / ') : '';
    }
    var old = document.getElementById('catFormModal');
    if (old) old.remove();
    var modal = document.createElement('div');
    modal.className = 'ex-modal';
    modal.id = 'catFormModal';
    var parentBlock = '';
    if (parentId) parentBlock = '<div style="margin-bottom:14px;padding:10px 12px;background:var(--bg-primary);border-radius:8px;border:1px solid var(--border-subtle);font-size:0.85em;opacity:0.8"><i class="ph ph-arrow-elbow-down-right"></i> Родитель: <strong>' + esc(parentName) + '</strong></div>';
    modal.innerHTML =
      '<div class="ex-modal-content" style="max-width:450px">' +
        '<button style="float:right;background:transparent;border:none;color:var(--text-secondary);font-size:1.5em;cursor:pointer" onclick="document.getElementById(\'catFormModal\').remove()" aria-label="Закрыть"><i class="ph ph-x"></i></button>' +
        '<h2 style="font-family:var(--font-display);color:var(--accent-gold);margin-top:0;display:flex;align-items:center;gap:10px">' +
          (isEdit ? '<i class="ph ph-pencil-simple"></i> Редактировать' : (parentId ? '<i class="ph ph-folder-plus"></i> Новая подкатегория' : '<i class="ph ph-plus-circle"></i> Новая категория')) +
        '</h2>' +
        parentBlock +
        '<div style="margin-bottom:14px">' +
          '<label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em">Название:</label>' +
          '<input type="text" id="catName" value="' + esc(current ? current.name : '') + '" placeholder="Например: Грудь" style="width:100%;padding:10px;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:1em">' +
        '</div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">' +
          '<button class="btn btn-secondary" onclick="document.getElementById(\'catFormModal\').remove()">Отмена</button>' +
          '<button class="btn btn-primary" onclick="ExercisesModule.saveCategory(\'' + esc(oldId || '').replace(/'/g, "\\'") + '\', \'' + esc(parentId || '').replace(/'/g, "\\'") + '\')"><i class="ph ph-floppy-disk"></i> Сохранить</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
  },

  saveCategory: function(oldId, parentId) {
    var esc = this._esc;
    var nameInput = document.getElementById('catName');
    if (!nameInput) return;
    var newName = nameInput.value.trim();
    parentId = parentId || '';
    if (!newName) { if (typeof Notify !== 'undefined') Notify.warn('Введи название'); else alert('Введи название'); return; }
    var cats = this.getCategories();
    for (var i = 0; i < cats.length; i++) {
      if (cats[i].id === oldId) continue;
      if (cats[i].name === newName && (cats[i].parentId || '') === parentId) {
        if (typeof Notify !== 'undefined') Notify.warn('Такая категория уже существует на этом уровне');
        return;
      }
    }
    if (oldId && parentId && this._wouldCreateCycle(oldId, parentId)) {
      if (typeof Notify !== 'undefined') Notify.warn('Нельзя выбрать потомка в качестве родителя');
      return;
    }
    if (oldId) {
      for (var i = 0; i < cats.length; i++) {
        if (cats[i].id === oldId) { cats[i].name = newName; cats[i].parentId = parentId || null; break; }
      }
    } else {
      var newCat = { id: this._uid('cat'), name: newName, parentId: parentId || null };
      cats.push(newCat);
      if (parentId) this._state.filter = parentId;
      else this._state.filter = newCat.id;
    }
    this.saveCategories(cats);
    var modal = document.getElementById('catFormModal');
    if (modal) modal.remove();
    var self = this;
    var container = document.getElementById('catScrollContainer');
    var prevScroll = container ? container.scrollLeft : 0;
    this.renderToolbar();
    this.renderAddButton();
    this.renderExList();
    container = document.getElementById('catScrollContainer');
    if (container) container.scrollLeft = prevScroll;
    requestAnimationFrame(function() { self._centerActiveCategory(true); });
  },

  deleteCategory: function(id) {
    this._closeAllActionPanels();
    if (!id) return;
    var cat = this.getCategoryById(id);
    if (!cat) return;
    var descendants = this.getCategoryAndDescendants(id);
    var hasChildren = descendants.length > 1;
    var db = this.getDB();
    var affectedExercises = 0;
    for (var i = 0; i < db.length; i++) if (descendants.indexOf(db[i].muscleGroup) !== -1) affectedExercises++;
    var msg = 'Удалить категорию «' + cat.name + '»?';
    if (hasChildren) msg += '\n\nВложенные категории (' + (descendants.length - 1) + ') тоже будут удалены.';
    if (affectedExercises > 0) msg += '\n\nУпражнений перейдёт в «Без категории»: ' + affectedExercises;
    if (!confirm(msg)) return;
    var cats = this.getCategories().filter(function(c) { return descendants.indexOf(c.id) === -1; });
    this.saveCategories(cats);
    for (var i = 0; i < db.length; i++) if (descendants.indexOf(db[i].muscleGroup) !== -1) db[i].muscleGroup = '';
    this.saveDB(db);
    if (descendants.indexOf(this._state.filter) !== -1) {
      var newFilter = 'all';
      var curParentId = cat.parentId;
      var guard = 0;
      while (curParentId && guard < 100) {
        if (descendants.indexOf(curParentId) === -1) { newFilter = curParentId; break; }
        var curCat = this.getCategoryById(curParentId);
        curParentId = curCat ? curCat.parentId : null;
        guard++;
      }
      var remainingSiblings;
      if (newFilter === 'all') {
        var catsNow = this.getCategories();
        remainingSiblings = catsNow.filter(function(c) { return !c.parentId; });
      } else {
        remainingSiblings = this.getChildren(newFilter);
      }
      this._state.filter = remainingSiblings.length > 0 ? remainingSiblings[0].id : newFilter;
    }
    var self = this;
    var container = document.getElementById('catScrollContainer');
    var prevScroll = container ? container.scrollLeft : 0;
    this.renderToolbar();
    this.renderAddButton();
    this.renderExList();
    container = document.getElementById('catScrollContainer');
    if (container) container.scrollLeft = prevScroll;
    requestAnimationFrame(function() { self._centerActiveCategory(true); });
  },

  /* ============================================================
     ФОРМА УПРАЖНЕНИЯ (добавлены timer / restTimer)
     ============================================================ */
  openExForm: function(id, defaultCategory) {
    var esc = this._esc;
    this._state.editingId = id || null;
    var ex = id ? (this.getExerciseById(id) || this.getDefaultExercise()) : this.getDefaultExercise();
    var flat = this._flatCategoryTree();
    var optionsHtml = '<option value="">Без категории</option>';
    var foundSelected = false;
    for (var i = 0; i < flat.length; i++) {
      var cat = flat[i];
      var isSelected = false;
      if (id && ex.muscleGroup === cat.id) isSelected = true;
      if (!id && defaultCategory && cat.id === defaultCategory) isSelected = true;
      if (isSelected) foundSelected = true;
      var prefix = '';
      for (var d = 0; d < cat.depth; d++) prefix += '— ';
      if (cat.depth > 0) prefix = prefix + '↳ ';
      optionsHtml += '<option value="' + esc(cat.id) + '" ' + (isSelected ? 'selected' : '') + '>' + prefix + esc(cat.name) + '</option>';
    }
    if (id && ex.muscleGroup && !foundSelected) {
      optionsHtml += '<option value="' + esc(ex.muscleGroup) + '" selected>(удалённая категория)</option>';
    }
    var old = document.getElementById('exFormModal');
    if (old) old.remove();
    var modal = document.createElement('div');
    modal.className = 'ex-modal';
    modal.id = 'exFormModal';
    modal.innerHTML =
      '<div class="ex-modal-content">' +
        '<button style="float:right;background:transparent;border:none;color:var(--text-secondary);font-size:1.5em;cursor:pointer" onclick="document.getElementById(\'exFormModal\').remove()" aria-label="Закрыть"><i class="ph ph-x"></i></button>' +
        '<h2 style="font-family:var(--font-display);color:var(--accent-gold);margin-top:0;display:flex;align-items:center;gap:10px">' + (id ? '<i class="ph ph-pencil-simple"></i> Редактирование' : '<i class="ph ph-plus-circle"></i> Новое упражнение') + '</h2>' +
        '<div style="margin-bottom:14px"><label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em">Название: <span style="color:var(--accent-error)">*</span></label>' +
          '<input type="text" id="exName" value="' + esc(ex.name) + '" placeholder="Например: Отжимания" style="width:100%;padding:10px;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:1em"></div>' +
        '<div style="margin-bottom:14px"><label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em">Категория:</label>' +
          '<select id="exMuscleGroup" style="width:100%;padding:10px;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:1em">' + optionsHtml + '</select></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">' +
          '<div><label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em"><i class="ph ph-fire" style="color:var(--accent-warning)"></i> Сложность:</label>' +
            '<select id="exDifficulty" style="width:100%;padding:10px;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:1em">' +
            '<option value="1" ' + (ex.difficulty==1?'selected':'') + '>1 — Очень легко</option>' +
            '<option value="2" ' + (ex.difficulty==2?'selected':'') + '>2 — Легко</option>' +
            '<option value="3" ' + (ex.difficulty==3?'selected':'') + '>3 — Средне</option>' +
            '<option value="4" ' + (ex.difficulty==4?'selected':'') + '>4 — Сложно</option>' +
            '<option value="5" ' + (ex.difficulty==5?'selected':'') + '>5 — Очень сложно</option></select></div>' +
          '<div><label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em"><i class="ph ph-target" style="color:var(--accent-success)"></i> Эффективность:</label>' +
            '<select id="exEffectiveness" style="width:100%;padding:10px;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:1em">' +
            '<option value="1" ' + (ex.effectiveness==1?'selected':'') + '>1 — Низкая</option>' +
            '<option value="2" ' + (ex.effectiveness==2?'selected':'') + '>2 — Ниже среднего</option>' +
            '<option value="3" ' + (ex.effectiveness==3?'selected':'') + '>3 — Средний</option>' +
            '<option value="4" ' + (ex.effectiveness==4?'selected':'') + '>4 — Высокая</option>' +
            '<option value="5" ' + (ex.effectiveness==5?'selected':'') + '>5 — Максимальная</option></select></div>' +
        '</div>' +

        /* NEW: таймеры */
        '<div style="background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:10px;padding:12px;margin-bottom:14px">' +
          '<div style="font-weight:600;font-size:0.85em;color:var(--accent-gold);margin-bottom:8px;display:flex;align-items:center;gap:6px"><i class="ph ph-timer"></i> Таймеры (для пошагового режима)</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
            '<div><label style="display:block;margin-bottom:4px;font-weight:600;font-size:0.8em">Выполнение подхода (сек)</label>' +
              '<input type="number" id="exTimer" min="0" max="3600" step="5" value="' + (ex.timer || 0) + '" placeholder="0 = без таймера" style="width:100%;padding:8px 10px;background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:6px;color:var(--text-primary);font-size:0.95em">' +
              '<div class="hint" style="font-size:0.7em;margin-top:2px">0 — без таймера выполнения</div></div>' +
            '<div><label style="display:block;margin-bottom:4px;font-weight:600;font-size:0.8em">Отдых после подхода (сек)</label>' +
              '<input type="number" id="exRestTimer" min="0" max="3600" step="5" value="' + (ex.restTimer || 0) + '" placeholder="0 = без отдыха" style="width:100%;padding:8px 10px;background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:6px;color:var(--text-primary);font-size:0.95em">' +
              '<div class="hint" style="font-size:0.7em;margin-top:2px">0 — без таймера отдыха</div></div>' +
          '</div>' +
        '</div>' +

        '<div style="margin-bottom:14px"><label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em"><i class="ph ph-text-t"></i> Описание:</label>' +
          '<textarea id="exDescription" rows="3" placeholder="Техника выполнения..." style="width:100%;padding:10px;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:1em;resize:vertical">' + esc(ex.description) + '</textarea></div>' +
        '<div style="margin-bottom:14px">' +
          '<label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em"><i class="ph ph-person" style="color:var(--accent-gold)"></i> Задействованные мышцы:</label>' +
          '<div class="hint" style="margin-bottom:6px;display:flex;align-items:center;gap:4px"><i class="ph ph-info"></i> Отметь мышцы — они появятся в карточке упражнения и в анатомии</div>' +
          '<div id="exMuscleSelectorWrap"></div>' +
        '</div>' +
        '<div style="margin-bottom:14px"><label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em"><i class="ph ph-image"></i> Картинка (URL):</label>' +
          '<input type="text" id="exImage" value="' + esc(ex.imageUrl) + '" placeholder="https://example.com/image.jpg" style="width:100%;padding:10px;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:1em"></div>' +
        '<div style="margin-bottom:14px"><label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em"><i class="ph ph-video-camera"></i> Видео (URL):</label>' +
          '<input type="text" id="exVideo" value="' + esc(ex.videoUrl) + '" placeholder="YouTube, VK, Rutube..." style="width:100%;padding:10px;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:1em"></div>' +
        '<div style="margin-bottom:14px"><label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em"><i class="ph ph-backpack"></i> Инвентарь:</label>' +
          '<input type="text" id="exInventory" value="' + esc(ex.inventory) + '" placeholder="гантели 10кг, коврик..." style="width:100%;padding:10px;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:1em"></div>' +
        '<div style="margin-bottom:14px"><label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em"><i class="ph ph-push-pin"></i> Заметки:</label>' +
          '<textarea id="exNotes" rows="2" placeholder="Личные заметки..." style="width:100%;padding:10px;background:var(--bg-input);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:1em;resize:vertical">' + esc(ex.notes) + '</textarea></div>' +
        '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px">' +
          '<button class="btn btn-secondary" onclick="document.getElementById(\'exFormModal\').remove()">Отмена</button>' +
          '<button class="btn btn-primary" onclick="ExercisesModule.saveExercise()"><i class="ph ph-floppy-disk"></i> Сохранить</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    this._renderMuscleSelector(ex.muscles || []);
  },

  _renderMuscleSelector: function(selectedIds) {
    var host = document.getElementById('exMuscleSelectorWrap');
    if (!host) return;
    if (typeof AnatomyModule === 'undefined' || !AnatomyModule.getBodyParts) {
      host.innerHTML = '<div style="padding:12px;background:var(--bg-primary);border-radius:8px;font-size:0.85em;opacity:0.6"><i class="ph ph-warning"></i> Модуль анатомии не загружен — выбор мышц недоступен</div>';
      return;
    }
    var parts = AnatomyModule.getBodyParts();
    var selected = {};
    for (var i = 0; i < selectedIds.length; i++) selected[selectedIds[i]] = true;
    this._pendingMuscles = selectedIds.slice();
    var html = '';
    html += '<div class="muscle-selected-summary" id="muscleSelectedSummary">' +
      '<i class="ph ph-check-circle"></i> Выбрано мышц: <strong id="muscleSelectedCount">' + selectedIds.length + '</strong>' +
      '</div>';
    html += '<input type="text" class="muscle-search" id="muscleSearch" placeholder="Поиск мышцы..." oninput="ExercisesModule._filterMuscleList(this.value)">';
    html += '<div class="muscle-selector" id="muscleSelector">';
    for (var p = 0; p < parts.length; p++) {
      var part = parts[p];
      var muscles = AnatomyModule.getMusclesByPart(part.id);
      if (muscles.length === 0) continue;
      var hasSelectedInPart = false;
      for (var k = 0; k < muscles.length; k++) if (selected[muscles[k].id]) { hasSelectedInPart = true; break; }
      html += '<div class="muscle-part-acc' + (hasSelectedInPart ? ' open' : '') + '" data-part="' + this._esc(part.id) + '">';
      html += '<div class="muscle-part-header" onclick="ExercisesModule._toggleMusclePart(this)">';
      html += '<i class="ph ' + this._esc(part.icon) + ' part-icon"></i>';
      html += '<span class="part-name">' + this._esc(part.name) + '</span>';
      html += '<span class="part-count">' + muscles.length + '</span>';
      html += '<i class="ph ph-caret-down chevron"></i>';
      html += '</div>';
      html += '<div class="muscle-part-body">';
      for (var m = 0; m < muscles.length; m++) {
        var muscle = muscles[m];
        var isChecked = !!selected[muscle.id];
        html += '<label class="muscle-check-row" data-muscle-name="' + this._esc((muscle.name + ' ' + muscle.latin).toLowerCase()) + '">';
        html += '<input type="checkbox" value="' + this._esc(muscle.id) + '" ' + (isChecked ? 'checked' : '') + ' onchange="ExercisesModule._onMuscleCheck(this)">';
        html += '<span>' + this._esc(muscle.name) + '<span class="m-latin">' + this._esc(muscle.latin) + '</span></span>';
        html += '</label>';
      }
      html += '</div></div>';
    }
    html += '</div>';
    host.innerHTML = html;
  },

  _toggleMusclePart: function(headerEl) {
    var acc = headerEl.closest('.muscle-part-acc');
    if (!acc) return;
    acc.classList.toggle('open');
  },

  _onMuscleCheck: function(cb) {
    if (!this._pendingMuscles) this._pendingMuscles = [];
    var id = cb.value;
    var idx = this._pendingMuscles.indexOf(id);
    if (cb.checked && idx === -1) this._pendingMuscles.push(id);
    else if (!cb.checked && idx !== -1) this._pendingMuscles.splice(idx, 1);
    var countEl = document.getElementById('muscleSelectedCount');
    if (countEl) countEl.textContent = this._pendingMuscles.length;
  },

  _filterMuscleList: function(query) {
    query = (query || '').trim().toLowerCase();
    var rows = document.querySelectorAll('#muscleSelector .muscle-check-row');
    for (var i = 0; i < rows.length; i++) {
      var name = rows[i].getAttribute('data-muscle-name') || '';
      rows[i].style.display = (!query || name.indexOf(query) !== -1) ? '' : 'none';
    }
    if (query) document.querySelectorAll('#muscleSelector .muscle-part-acc').forEach(function(a) { a.classList.add('open'); });
  },

  saveExercise: function() {
    var name = document.getElementById('exName').value.trim();
    if (!name) { if (typeof Notify !== 'undefined') Notify.warn('Укажи название'); return; }

    var timerEl = document.getElementById('exTimer');
    var restEl = document.getElementById('exRestTimer');

    var db = this.getDB();
    var data = {
      name: name,
      muscleGroup: document.getElementById('exMuscleGroup').value,
      muscles: (this._pendingMuscles || []).slice(),
      difficulty: parseInt(document.getElementById('exDifficulty').value) || 3,
      effectiveness: parseInt(document.getElementById('exEffectiveness').value) || 3,
      timer: timerEl ? Math.max(0, parseInt(timerEl.value, 10) || 0) : 0,
      restTimer: restEl ? Math.max(0, parseInt(restEl.value, 10) || 0) : 0,
      description: document.getElementById('exDescription').value.trim(),
      imageUrl: document.getElementById('exImage').value.trim(),
      videoUrl: document.getElementById('exVideo').value.trim(),
      inventory: document.getElementById('exInventory').value.trim(),
      notes: document.getElementById('exNotes').value.trim(),
      updatedAt: Date.now()
    };
    var editingId = this._state.editingId;
    if (editingId) {
      var found = false;
      for (var i = 0; i < db.length; i++) {
        if (db[i].id === editingId) { db[i] = Object.assign({}, db[i], data); found = true; break; }
      }
      if (!found) { data.id = editingId; db.push(data); }
    } else {
      data.id = this._uid('ex');
      data.createdAt = Date.now();
      data.favorite = false;
      db.push(data);
    }
    this.saveDB(db);
    this._state.editingId = null;
    this._pendingMuscles = null;
    var modal = document.getElementById('exFormModal');
    if (modal) modal.remove();
    var self = this;
    var container = document.getElementById('catScrollContainer');
    var prevScroll = container ? container.scrollLeft : 0;
    this.renderCatStrip();
    this.renderAddButton();
    this.renderExList();
    this.renderLevels();
    container = document.getElementById('catScrollContainer');
    if (container) container.scrollLeft = prevScroll;
    requestAnimationFrame(function() { self._centerActiveCategory(true); });
    if (typeof AchievementsModule !== 'undefined' && AchievementsModule.checkAchievements) AchievementsModule.checkAchievements();
  },

  editExercise: function(id) { this.openExForm(id); },

  deleteExercise: function(id) {
    if (!confirm('Удалить упражнение?')) return;
    var db = this.getDB();
    this.saveDB(db.filter(function(e) { return e.id !== id; }));
    var self = this;
    var container = document.getElementById('catScrollContainer');
    var prevScroll = container ? container.scrollLeft : 0;
    this.renderCatStrip();
    this.renderExList();
    this.renderLevels();
    container = document.getElementById('catScrollContainer');
    if (container) container.scrollLeft = prevScroll;
    requestAnimationFrame(function() { self._centerActiveCategory(true); });
  },

  toggleFavorite: function(id) {
    var db = this.getDB();
    for (var i = 0; i < db.length; i++) if (db[i].id === id) { db[i].favorite = !db[i].favorite; break; }
    this.saveDB(db);
    var self = this;
    var container = document.getElementById('catScrollContainer');
    var prevScroll = container ? container.scrollLeft : 0;
    this.renderCatStrip();
    this.renderExList();
    this.renderLevels();
    container = document.getElementById('catScrollContainer');
    if (container) container.scrollLeft = prevScroll;
    requestAnimationFrame(function() { self._centerActiveCategory(true); });
  },

  viewExercise: function(id) {
    var esc = this._esc;
    var ex = this.getExerciseById(id);
    if (!ex) return;
    var self = this;
    var old = document.getElementById('exViewModal');
    if (old) old.remove();
    var modal = document.createElement('div');
    modal.className = 'ex-modal';
    modal.id = 'exViewModal';
    var content = document.createElement('div');
    content.className = 'ex-modal-content';
    var closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'float:right;background:transparent;border:none;color:var(--text-secondary);font-size:1.5em;cursor:pointer';
    closeBtn.innerHTML = '<i class="ph ph-x"></i>';
    closeBtn.setAttribute('aria-label', 'Закрыть');
    closeBtn.onclick = function() { modal.remove(); };
    content.appendChild(closeBtn);
    var titleRow = document.createElement('div');
    titleRow.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:12px';
    var title = document.createElement('h2');
    title.style.cssText = 'font-family:var(--font-display);color:var(--accent-gold);margin:0;flex:1';
    title.textContent = ex.name;
    titleRow.appendChild(title);
    var favBtn = document.createElement('button');
    favBtn.className = 'fav-btn ' + (ex.favorite ? 'active' : '');
    favBtn.title = 'В избранное';
    favBtn.innerHTML = '<i class="' + (ex.favorite ? 'ph-fill' : 'ph') + ' ph-star"></i>';
    favBtn.onclick = function() { self.toggleFavorite(ex.id); modal.remove(); };
    titleRow.appendChild(favBtn);
    content.appendChild(titleRow);

    /* NEW: таймеры в просмотре */
    if (ex.timer > 0 || ex.restTimer > 0) {
      var timerDiv = document.createElement('div');
      timerDiv.style.cssText = 'display:flex;gap:14px;margin-bottom:12px;flex-wrap:wrap;font-size:0.9em';
      if (ex.timer > 0) timerDiv.innerHTML += '<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:var(--accent-gold-dim);border:1px solid var(--border-gold);border-radius:10px;color:var(--accent-gold)"><i class="ph ph-timer"></i> ' + ex.timer + ' с</span>';
      if (ex.restTimer > 0) timerDiv.innerHTML += '<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;background:var(--bg-primary);border:1px solid var(--border-subtle);border-radius:10px;color:var(--text-secondary)"><i class="ph ph-pause-circle"></i> отдых ' + ex.restTimer + ' с</span>';
      content.appendChild(timerDiv);
    }

    var catPath = '';
    if (ex.muscleGroup) catPath = this.getCategoryPath(ex.muscleGroup).join(' / ');
    var catDiv = document.createElement('div');
    catDiv.style.cssText = 'font-size:0.9em;opacity:0.7;margin-bottom:12px;display:flex;align-items:center;gap:6px';
    catDiv.innerHTML = '<i class="ph ph-tag"></i> ' + esc(catPath || 'Без категории');
    content.appendChild(catDiv);

    var muscles = this.getMusclesForExercise(ex);
    if (muscles.length > 0) {
      var musclesDiv = document.createElement('div');
      musclesDiv.className = 'ex-view-section';
      var chipsHtml = '';
      for (var mi = 0; mi < muscles.length; mi++) {
        var m = muscles[mi];
        var mid = esc(m.id).replace(/'/g, "\\'");
        chipsHtml += '<span class="ex-muscle-chip" onclick="ExercisesModule._openMuscleFromExercise(\'' + mid + '\')" title="Открыть в анатомии">' +
          '<i class="ph ph-person"></i> ' + esc(m.name) + '</span>';
      }
      musclesDiv.innerHTML = '<h3><i class="ph ph-person"></i> Задействованные мышцы</h3><div class="ex-muscle-chips">' + chipsHtml + '</div>';
      content.appendChild(musclesDiv);
    }

    var starsDiv = document.createElement('div');
    starsDiv.style.cssText = 'display:flex;gap:20px;margin-bottom:16px;font-size:0.9em;flex-wrap:wrap';
    starsDiv.innerHTML =
      '<div style="display:flex;align-items:center;gap:6px"><i class="ph ph-fire" style="color:var(--accent-warning)"></i> Сложность: ' + Core.utils.renderStars(ex.difficulty || 3) + '</div>' +
      '<div style="display:flex;align-items:center;gap:6px"><i class="ph ph-target" style="color:var(--accent-success)"></i> Эффективность: ' + Core.utils.renderStars(ex.effectiveness || 3) + '</div>';
    content.appendChild(starsDiv);

    if (ex.inventory) {
      var invDiv = document.createElement('div');
      invDiv.className = 'ex-view-section';
      invDiv.style.cssText = 'display:flex;align-items:start;gap:8px';
      invDiv.innerHTML = '<i class="ph ph-backpack" style="color:var(--accent-gold);font-size:1.1em;margin-top:2px"></i><div><strong style="color:var(--accent-gold)">Инвентарь:</strong> ' + esc(ex.inventory) + '</div>';
      content.appendChild(invDiv);
    }
    if (ex.description) {
      var descDiv = document.createElement('div');
      descDiv.className = 'ex-view-section';
      descDiv.innerHTML = '<h3><i class="ph ph-text-t"></i> Описание</h3><p style="white-space:pre-wrap;margin:0;line-height:1.6">' + esc(ex.description) + '</p>';
      content.appendChild(descDiv);
    }
    if (ex.imageUrl) {
      var imgDiv = document.createElement('div');
      imgDiv.className = 'ex-view-section';
      imgDiv.innerHTML = '<h3><i class="ph ph-image"></i> Изображение</h3>';
      if (typeof Media !== 'undefined') {
        var imgEl = Media.renderImage(ex.imageUrl, { maxHeight: 300, marginTop: 0 });
        if (imgEl) imgDiv.appendChild(imgEl);
      }
      content.appendChild(imgDiv);
    }
    if (ex.videoUrl) {
      var videoDiv = document.createElement('div');
      videoDiv.className = 'ex-view-section';
      videoDiv.innerHTML = '<h3><i class="ph ph-video-camera"></i> Видео</h3>';
      if (typeof Media !== 'undefined') {
        var videoEl = Media.renderVideo(ex.videoUrl, { maxHeight: 300, marginTop: 0 });
        if (videoEl) videoDiv.appendChild(videoEl);
      }
      content.appendChild(videoDiv);
    }
    if (ex.notes) {
      var notesDiv = document.createElement('div');
      notesDiv.className = 'ex-view-section';
      notesDiv.style.cssText = 'border-left:3px solid var(--accent-gold)';
      notesDiv.innerHTML = '<h3><i class="ph ph-push-pin"></i> Заметки</h3><p style="white-space:pre-wrap;margin:0;line-height:1.6">' + esc(ex.notes) + '</p>';
      content.appendChild(notesDiv);
    }

    var actions = document.createElement('div');
    actions.className = 'ex-view-actions';
    var closeBtn2 = document.createElement('button');
    closeBtn2.className = 'btn btn-secondary';
    closeBtn2.innerHTML = '<i class="ph ph-x"></i> Закрыть';
    closeBtn2.onclick = function() { modal.remove(); };
    actions.appendChild(closeBtn2);
    var editBtn = document.createElement('button');
    editBtn.className = 'btn btn-primary';
    editBtn.innerHTML = '<i class="ph ph-pencil-simple"></i> Редактировать';
    editBtn.onclick = function() { modal.remove(); self.editExercise(ex.id); };
    actions.appendChild(editBtn);
    content.appendChild(actions);
    modal.appendChild(content);
    document.body.appendChild(modal);
  },

  _openMuscleFromExercise: function(muscleId) {
    var modal = document.getElementById('exViewModal');
    if (modal) modal.remove();
    if (typeof Core !== 'undefined' && Core.navigate) {
      Core.navigate('anatomy');
      setTimeout(function() {
        if (typeof AnatomyModule !== 'undefined' && AnatomyModule.openMuscleCard) AnatomyModule.openMuscleCard(muscleId);
      }, 100);
    }
  }
};

window.ExercisesModule = ExercisesModule;
module.exports = ExercisesModule;