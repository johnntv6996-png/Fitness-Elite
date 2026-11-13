// modules/anatomy.js

const AnatomyModule = {
  _state: {
    expandedParts: {},
    cachePrefix: 'ft_anatomy_img_'
  },

  init: function() {
    if (typeof Logger !== 'undefined') Logger.log('Модуль анатомии инициализирован', 'info');
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { AnatomyModule.setup(); });
    } else {
      this.setup();
    }
  },

  setup: function() {
    this.createAnatomyScreen();
    if (typeof Core !== 'undefined') {
      Core.addNavButton('Анатомия', 'anatomy', '<i class="ph ph-person"></i>');
      Core.registerScreen('anatomy', function() { AnatomyModule.createAnatomyScreen(); });
    }
  },

  /* ---------- ДАННЫЕ: ЧАСТИ ТЕЛА ---------- */
  getBodyParts: function() {
    return [
      { id: 'head_neck', name: 'Голова и шея', icon: 'ph-head' },
      { id: 'chest', name: 'Грудь', icon: 'ph-heart' },
      { id: 'back', name: 'Спина', icon: 'ph-align-center-vertical' },
      { id: 'shoulders', name: 'Плечи', icon: 'ph-shield' },
      { id: 'arms', name: 'Руки', icon: 'ph-hand-fist' },
      { id: 'core', name: 'Пресс и кор', icon: 'ph-align-center-horizontal' },
      { id: 'hips', name: 'Таз и ягодицы', icon: 'ph-circle' },
      { id: 'thighs', name: 'Бёдра', icon: 'ph-person-simple' },
      { id: 'calves', name: 'Голени', icon: 'ph-person-simple-run' },
      { id: 'feet', name: 'Стопы', icon: 'ph-footprints' }
    ];
  },

  /* ---------- ДАННЫЕ: МЫШЦЫ ---------- */
  getMusclesSeed: function() {
    return [
      // ========== ГОЛОВА И ШЕЯ ==========
      { id: 'scm', name: 'Грудино-ключично-сосцевидная', latin: 'm. sternocleidomastoideus', bodyPartId: 'head_neck',
        functions: ['Наклоняет голову в сторону', 'Поворачивает голову', 'Сгибает шею'],
        antagonists: ['splenius_capitis', 'semispinalis_capitis'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Sternocleidomastoideus.png/320px-Sternocleidomastoideus.png' },
      { id: 'splenius_capitis', name: 'Ременная мышца головы', latin: 'm. splenius capitis', bodyPartId: 'head_neck',
        functions: ['Разгибает шею', 'Поворачивает голову'],
        antagonists: ['scm'],
        imageUrl: '' },
      { id: 'semispinalis_capitis', name: 'Полуостистая мышца головы', latin: 'm. semispinalis capitis', bodyPartId: 'head_neck',
        functions: ['Разгибает голову', 'Стабилизирует шею'],
        antagonists: ['scm'],
        imageUrl: '' },
      { id: 'scalenes', name: 'Лестничные мышцы', latin: 'mm. scaleni', bodyPartId: 'head_neck',
        functions: ['Наклоняют шею в сторону', 'Поднимают первое ребро при дыхании'],
        antagonists: [],
        imageUrl: '' },

      // ========== ГРУДЬ ==========
      { id: 'pec_major_clavicular', name: 'Большая грудная (ключичная часть)', latin: 'Pars clavicularis m. pectoralis major', bodyPartId: 'chest',
        functions: ['Приводит плечо вперёд', 'Сгибает плечо', 'Вращает плечо внутрь'],
        antagonists: ['rhomboids', 'trapezius_middle'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Pectoralis_major.png/320px-Pectoralis_major.png' },
      { id: 'pec_major_sternal', name: 'Большая грудная (грудинная часть)', latin: 'Pars sternocostalis m. pectoralis major', bodyPartId: 'chest',
        functions: ['Приводит плечо', 'Вращает плечо внутрь'],
        antagonists: ['rhomboids', 'trapezius_middle'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Pectoralis_major.png/320px-Pectoralis_major.png' },
      { id: 'pec_major_abdominal', name: 'Большая грудная (брюшная часть)', latin: 'Pars abdominalis m. pectoralis major', bodyPartId: 'chest',
        functions: ['Приводит плечо вниз', 'Вращает плечо внутрь'],
        antagonists: ['rhomboids'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Pectoralis_major.png/320px-Pectoralis_major.png' },
      { id: 'pec_minor', name: 'Малая грудная', latin: 'm. pectoralis minor', bodyPartId: 'chest',
        functions: ['Тянет лопатку вперёд и вниз', 'Поднимает рёбра при вдохе'],
        antagonists: ['rhomboids', 'trapezius_middle'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Pectoralis_minor.png/320px-Pectoralis_minor.png' },
      { id: 'serratus_anterior', name: 'Передняя зубчатая', latin: 'm. serratus anterior', bodyPartId: 'chest',
        functions: ['Тянет лопатку вперёд', 'Вращает лопатку вверх'],
        antagonists: ['rhomboids', 'trapezius_middle'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Serratus_anterior.png/320px-Serratus_anterior.png' },

      // ========== СПИНА ==========
      { id: 'latissimus', name: 'Широчайшая мышца спины', latin: 'm. latissimus dorsi', bodyPartId: 'back',
        functions: ['Тянет плечо вниз', 'Приводит плечо', 'Разгибает плечо', 'Вращает плечо внутрь'],
        antagonists: ['ant_deltoid', 'pec_major_clavicular'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Latissimus_dorsi.png/320px-Latissimus_dorsi.png' },
      { id: 'trapezius_upper', name: 'Трапеция (верхняя часть)', latin: 'Pars descendens m. trapezii', bodyPartId: 'back',
        functions: ['Поднимает лопатку', 'Разгибает шею'],
        antagonists: ['levator_scapulae', 'rhomboids'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Trapezius_muscle.png/320px-Trapezius_muscle.png' },
      { id: 'trapezius_middle', name: 'Трапеция (средняя часть)', latin: 'Pars transversa m. trapezii', bodyPartId: 'back',
        functions: ['Сводит лопатки', 'Стабилизирует лопатку'],
        antagonists: ['pec_major_sternal', 'serratus_anterior'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Trapezius_muscle.png/320px-Trapezius_muscle.png' },
      { id: 'trapezius_lower', name: 'Трапеция (нижняя часть)', latin: 'Pars ascendens m. trapezii', bodyPartId: 'back',
        functions: ['Опускает лопатку', 'Вращает лопатку вверх'],
        antagonists: ['trapezius_upper', 'levator_scapulae'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Trapezius_muscle.png/320px-Trapezius_muscle.png' },
      { id: 'rhomboids', name: 'Ромбовидные', latin: 'mm. rhomboidei', bodyPartId: 'back',
        functions: ['Сводит лопатки', 'Поднимает лопатку', 'Вращает лопатку вниз'],
        antagonists: ['pec_minor', 'serratus_anterior'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Rhomboideus_muscles.png/320px-Rhomboideus_muscles.png' },
      { id: 'erector_spinae', name: 'Разгибатели спины', latin: 'mm. erector spinae', bodyPartId: 'back',
        functions: ['Разгибает позвоночник', 'Стабилизирует корпус'],
        antagonists: ['rectus_abdominis'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Erector_spinae.png/320px-Erector_spinae.png' },
      { id: 'ql', name: 'Квадратная мышца поясницы', latin: 'm. quadratus lumborum', bodyPartId: 'back',
        functions: ['Наклоняет таз в сторону', 'Разгибает поясницу'],
        antagonists: [],
        imageUrl: '' },

      // ========== ПЛЕЧИ ==========
      { id: 'ant_deltoid', name: 'Передняя дельта', latin: 'Pars clavicularis m. deltoidei', bodyPartId: 'shoulders',
        functions: ['Сгибает плечо', 'Приводит плечо', 'Вращает плечо внутрь'],
        antagonists: ['post_deltoid', 'latissimus'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Deltoid_muscle.png/320px-Deltoid_muscle.png' },
      { id: 'mid_deltoid', name: 'Средняя дельта', latin: 'Pars acromialis m. deltoidei', bodyPartId: 'shoulders',
        functions: ['Отводит плечо в сторону'],
        antagonists: ['latissimus', 'pec_major_sternal'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Deltoid_muscle.png/320px-Deltoid_muscle.png' },
      { id: 'post_deltoid', name: 'Задняя дельта', latin: 'Pars spinalis m. deltoidei', bodyPartId: 'shoulders',
        functions: ['Разгибает плечо', 'Отводит плечо назад', 'Вращает плечо наружу'],
        antagonists: ['ant_deltoid', 'pec_major_clavicular'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Deltoid_muscle.png/320px-Deltoid_muscle.png' },
      { id: 'supraspinatus', name: 'Надостная', latin: 'm. supraspinatus', bodyPartId: 'shoulders',
        functions: ['Отводит плечо', 'Стабилизирует плечевой сустав'],
        antagonists: [],
        imageUrl: '' },
      { id: 'infraspinatus', name: 'Подостная', latin: 'm. infraspinatus', bodyPartId: 'shoulders',
        functions: ['Вращает плечо наружу', 'Стабилизирует плечо'],
        antagonists: ['subscapularis'],
        imageUrl: '' },
      { id: 'teres_major', name: 'Большая круглая', latin: 'm. teres major', bodyPartId: 'shoulders',
        functions: ['Приводит плечо', 'Вращает плечо внутрь', 'Разгибает плечо'],
        antagonists: ['post_deltoid'],
        imageUrl: '' },
      { id: 'teres_minor', name: 'Малая круглая', latin: 'm. teres minor', bodyPartId: 'shoulders',
        functions: ['Вращает плечо наружу'],
        antagonists: ['subscapularis'],
        imageUrl: '' },
      { id: 'subscapularis', name: 'Подлопаточная', latin: 'm. subscapularis', bodyPartId: 'shoulders',
        functions: ['Вращает плечо внутрь', 'Стабилизирует плечо'],
        antagonists: ['infraspinatus', 'teres_minor'],
        imageUrl: '' },

      // ========== РУКИ ==========
      { id: 'biceps_long', name: 'Бицепс (длинная головка)', latin: 'Caput longum m. bicipitis brachii', bodyPartId: 'arms',
        functions: ['Сгибает локоть', 'Супинирует предплечье', 'Сгибает плечо'],
        antagonists: ['triceps_long'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Biceps_brachii.png/320px-Biceps_brachii.png' },
      { id: 'biceps_short', name: 'Бицепс (короткая головка)', latin: 'Caput breve m. bicipitis brachii', bodyPartId: 'arms',
        functions: ['Сгибает локоть', 'Супинирует предплечье', 'Сгибает плечо'],
        antagonists: ['triceps_long'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Biceps_brachii.png/320px-Biceps_brachii.png' },
      { id: 'brachialis', name: 'Плечевая мышца', latin: 'm. brachialis', bodyPartId: 'arms',
        functions: ['Сгибает локоть'],
        antagonists: ['triceps_lateral'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Brachialis.png/320px-Brachialis.png' },
      { id: 'triceps_long', name: 'Трицепс (длинная головка)', latin: 'Caput longum m. tricipitis brachii', bodyPartId: 'arms',
        functions: ['Разгибает локоть', 'Разгибает плечо'],
        antagonists: ['biceps_long', 'biceps_short'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Triceps_brachii.png/320px-Triceps_brachii.png' },
      { id: 'triceps_lateral', name: 'Трицепс (латеральная головка)', latin: 'Caput laterale m. tricipitis brachii', bodyPartId: 'arms',
        functions: ['Разгибает локоть'],
        antagonists: ['biceps_short'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Triceps_brachii.png/320px-Triceps_brachii.png' },
      { id: 'triceps_medial', name: 'Трицепс (медиальная головка)', latin: 'Caput mediale m. tricipitis brachii', bodyPartId: 'arms',
        functions: ['Разгибает локоть'],
        antagonists: ['biceps_long'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Triceps_brachii.png/320px-Triceps_brachii.png' },
      { id: 'brachioradialis', name: 'Плечелучевая', latin: 'm. brachioradialis', bodyPartId: 'arms',
        functions: ['Сгибает локоть', 'Стабилизирует запястье'],
        antagonists: ['triceps_lateral'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3b/Brachioradialis.png/320px-Brachioradialis.png' },
      { id: 'forearm_flexors', name: 'Сгибатели предплечья', latin: 'mm. flexores antebrachii', bodyPartId: 'arms',
        functions: ['Сгибают кисть', 'Сгибают пальцы', 'Вращают предплечье'],
        antagonists: ['forearm_extensors'],
        imageUrl: '' },
      { id: 'forearm_extensors', name: 'Разгибатели предплечья', latin: 'mm. extensores antebrachii', bodyPartId: 'arms',
        functions: ['Разгибают кисть', 'Разгибают пальцы'],
        antagonists: ['forearm_flexors'],
        imageUrl: '' },

      // ========== ПРЕСС И КОР ==========
      { id: 'rectus_upper', name: 'Прямая мышца живота (верхняя)', latin: 'm. rectus abdominis (pars superior)', bodyPartId: 'core',
        functions: ['Сгибает корпус', 'Сгибает таз к груди'],
        antagonists: ['erector_spinae'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Rectus_abdominis.png/320px-Rectus_abdominis.png' },
      { id: 'rectus_lower', name: 'Прямая мышца живота (нижняя)', latin: 'm. rectus abdominis (pars inferior)', bodyPartId: 'core',
        functions: ['Поднимает таз', 'Сгибает корпус'],
        antagonists: ['erector_spinae'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Rectus_abdominis.png/320px-Rectus_abdominis.png' },
      { id: 'obliques_external', name: 'Косые (внешние)', latin: 'm. obliquus externus abdominis', bodyPartId: 'core',
        functions: ['Вращает корпус', 'Наклоняет корпус в сторону'],
        antagonists: ['obliques_internal'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2c/Obliquus_externus_abdominis.png/320px-Obliquus_externus_abdominis.png' },
      { id: 'obliques_internal', name: 'Косые (внутренние)', latin: 'm. obliquus internus abdominis', bodyPartId: 'core',
        functions: ['Вращает корпус', 'Наклоняет корпус в сторону'],
        antagonists: ['obliques_external'],
        imageUrl: '' },
      { id: 'transverse_abdominis', name: 'Поперечная мышца', latin: 'm. transversus abdominis', bodyPartId: 'core',
        functions: ['Стабилизирует корпус', 'Втягивает живот'],
        antagonists: [],
        imageUrl: '' },

      // ========== ТАЗ И ЯГОДИЦЫ ==========
      { id: 'glute_max', name: 'Большая ягодичная', latin: 'm. gluteus maximus', bodyPartId: 'hips',
        functions: ['Разгибает бедро', 'Вращает бедро наружу', 'Стабилизирует таз'],
        antagonists: ['iliopsoas'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Gluteus_maximus.png/320px-Gluteus_maximus.png' },
      { id: 'glute_med', name: 'Средняя ягодичная', latin: 'm. gluteus medius', bodyPartId: 'hips',
        functions: ['Отводит бедро', 'Стабилизирует таз при ходьбе'],
        antagonists: ['adductors'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Gluteus_medius.png/320px-Gluteus_medius.png' },
      { id: 'glute_min', name: 'Малая ягодичная', latin: 'm. gluteus minimus', bodyPartId: 'hips',
        functions: ['Отводит бедро', 'Вращает бедро внутрь'],
        antagonists: ['glute_max'],
        imageUrl: '' },
      { id: 'piriformis', name: 'Грушевидная', latin: 'm. piriformis', bodyPartId: 'hips',
        functions: ['Вращает бедро наружу', 'Стабилизирует таз'],
        antagonists: [],
        imageUrl: '' },
      { id: 'iliopsoas', name: 'Подвздошно-поясничная', latin: 'm. iliopsoas', bodyPartId: 'hips',
        functions: ['Сгибает бедро', 'Сгибает корпус'],
        antagonists: ['glute_max'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Iliopsoas_muscle.png/320px-Iliopsoas_muscle.png' },
      { id: 'adductors', name: 'Приводящие (аддукторы)', latin: 'mm. adductores femoris', bodyPartId: 'hips',
        functions: ['Приводит бедро', 'Стабилизирует таз'],
        antagonists: ['glute_med'],
        imageUrl: '' },

      // ========== БЁДРА ==========
      { id: 'quad_rectus', name: 'Квадрицепс (прямая)', latin: 'm. rectus femoris', bodyPartId: 'thighs',
        functions: ['Разгибает колено', 'Сгибает бедро'],
        antagonists: ['biceps_femoris_long'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Quadriceps_muscle.png/320px-Quadriceps_muscle.png' },
      { id: 'quad_lateral', name: 'Квадрицепс (латеральная)', latin: 'm. vastus lateralis', bodyPartId: 'thighs',
        functions: ['Разгибает колено'],
        antagonists: ['biceps_femoris_long'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Quadriceps_muscle.png/320px-Quadriceps_muscle.png' },
      { id: 'quad_medial', name: 'Квадрицепс (медиальная)', latin: 'm. vastus medialis', bodyPartId: 'thighs',
        functions: ['Разгибает колено', 'Стабилизирует колено'],
        antagonists: [],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Quadriceps_muscle.png/320px-Quadriceps_muscle.png' },
      { id: 'biceps_femoris_long', name: 'Бицепс бедра (длинная головка)', latin: 'Caput longum m. bicipitis femoris', bodyPartId: 'thighs',
        functions: ['Сгибает колено', 'Разгибает бедро'],
        antagonists: ['quad_rectus'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Biceps_femoris.png/320px-Biceps_femoris.png' },
      { id: 'biceps_femoris_short', name: 'Бицепс бедра (короткая головка)', latin: 'Caput breve m. bicipitis femoris', bodyPartId: 'thighs',
        functions: ['Сгибает колено'],
        antagonists: ['quad_lateral'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Biceps_femoris.png/320px-Biceps_femoris.png' },
      { id: 'semimembranosus', name: 'Полуперепончатая', latin: 'm. semimembranosus', bodyPartId: 'thighs',
        functions: ['Сгибает колено', 'Разгибает бедро', 'Вращает голень внутрь'],
        antagonists: ['quad_rectus'],
        imageUrl: '' },
      { id: 'semitendinosus', name: 'Полусухожильная', latin: 'm. semitendinosus', bodyPartId: 'thighs',
        functions: ['Сгибает колено', 'Разгибает бедро', 'Вращает голень внутрь'],
        antagonists: ['quad_rectus'],
        imageUrl: '' },
      { id: 'tfl', name: 'Напрягатель широкой фасции', latin: 'm. tensor fasciae latae', bodyPartId: 'thighs',
        functions: ['Отводит бедро', 'Сгибает бедро', 'Стабилизирует колено'],
        antagonists: [],
        imageUrl: '' },

      // ========== ГОЛЕНИ ==========
      { id: 'gastrocnemius', name: 'Икроножная', latin: 'm. gastrocnemius', bodyPartId: 'calves',
        functions: ['Сгибает стопу', 'Сгибает колено'],
        antagonists: ['tibialis_anterior'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Gastrocnemius_muscle.png/320px-Gastrocnemius_muscle.png' },
      { id: 'soleus', name: 'Камбаловидная', latin: 'm. soleus', bodyPartId: 'calves',
        functions: ['Сгибает стопу', 'Стабилизирует голеностоп'],
        antagonists: ['tibialis_anterior'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Soleus_muscle.png/320px-Soleus_muscle.png' },
      { id: 'tibialis_anterior', name: 'Передняя большеберцовая', latin: 'm. tibialis anterior', bodyPartId: 'calves',
        functions: ['Разгибает стопу', 'Поднимает носок'],
        antagonists: ['gastrocnemius'],
        imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Tibialis_anterior.png/320px-Tibialis_anterior.png' },
      { id: 'fibularis_longus', name: 'Длинная малоберцовая', latin: 'm. fibularis longus', bodyPartId: 'calves',
        functions: ['Отводит стопу', 'Опускает стопу'],
        antagonists: ['tibialis_anterior'],
        imageUrl: '' },

      // ========== СТОПЫ ==========
      { id: 'foot_flexors', name: 'Сгибатели пальцев стопы', latin: 'mm. flexores digitorum pedis', bodyPartId: 'feet',
        functions: ['Сгибают пальцы стопы', 'Стабилизируют стопу'],
        antagonists: ['foot_extensors'],
        imageUrl: '' },
      { id: 'foot_extensors', name: 'Разгибатели пальцев стопы', latin: 'mm. extensores digitorum pedis', bodyPartId: 'feet',
        functions: ['Разгибают пальцы стопы'],
        antagonists: ['foot_flexors'],
        imageUrl: '' },
      { id: 'plantar_muscles', name: 'Мышцы подошвы', latin: 'mm. plantae pedis', bodyPartId: 'feet',
        functions: ['Поддерживают свод стопы', 'Стабилизируют стопу'],
        antagonists: [],
        imageUrl: '' }
    ];
  },

  getMuscles: function() {
    return this.getMusclesSeed();
  },

  getMusclesByPart: function(partId) {
    var all = this.getMusclesSeed();
    var self = this;
    return all.filter(function(m) { return m.bodyPartId === partId; }).map(function(m) {
      var copy = Object.assign({}, m);
      copy.imageUrl = self.getEffectiveImageUrl(m.id);
      return copy;
    });
  },

  getMuscleById: function(id) {
    var all = this.getMusclesSeed();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) {
        var m = Object.assign({}, all[i]);
        m.imageUrl = this.getEffectiveImageUrl(id);
        return m;
      }
    }
    return null;
  },

  getBodyPartById: function(id) {
    var parts = this.getBodyParts();
    for (var i = 0; i < parts.length; i++) if (parts[i].id === id) return parts[i];
    return null;
  },

  /* ---------- СВЯЗЬ С УПРАЖНЕНИЯМИ ---------- */
  getExercisesForMuscle: function(muscleId) {
    if (typeof ExercisesModule === 'undefined' || !ExercisesModule.getExercisesByMuscle) return [];
    return ExercisesModule.getExercisesByMuscle(muscleId);
  },

  /* ---------- КЭШ КАРТИНОК ---------- */
  getCachedImage: function(muscleId) {
    try {
      return localStorage.getItem(this._state.cachePrefix + muscleId) || null;
    } catch (e) { return null; }
  },

  saveImageToCache: function(muscleId, imageUrl, callback) {
    var self = this;
    if (!imageUrl) { callback && callback(false, 'Нет ссылки'); return; }

    function tryLoad(url, useCors, onSuccess, onFail) {
      var img = new Image();
      if (useCors) img.crossOrigin = 'anonymous';
      img.onload = function() { onSuccess(img); };
      img.onerror = function() { onFail(); };
      img.src = url;
    }

    function compress(img) {
      try {
        var size = 320;
        var canvas = document.createElement('canvas');
        var ratio = Math.min(size / img.width, size / img.height);
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.85);
      } catch (e) { return null; }
    }

    function save(dataUrl) {
      if (!dataUrl) return false;
      try { localStorage.setItem(self._state.cachePrefix + muscleId, dataUrl); return true; }
      catch (e) { return false; }
    }

    tryLoad(imageUrl, true, function(img) {
      if (save(compress(img))) { callback && callback(true); return; }
      callback && callback(false, 'Нет места');
    }, function() {
      var proxied = 'https://images.weserv.nl/?url=' + encodeURIComponent(imageUrl);
      tryLoad(proxied, false, function(img) {
        if (save(compress(img))) { callback && callback(true); return; }
        callback && callback(false, 'Нет места');
      }, function() {
        callback && callback(false, 'CORS');
      });
    });
  },

  removeImageFromCache: function(muscleId) {
    try { localStorage.removeItem(this._state.cachePrefix + muscleId); } catch (e) {}
  },

  _saveCustomImageUrl: function(muscleId, url) {
    try {
      var map = JSON.parse(localStorage.getItem('ft_anatomy_custom_urls') || '{}');
      map[muscleId] = url;
      localStorage.setItem('ft_anatomy_custom_urls', JSON.stringify(map));
    } catch (e) {}
  },

  getEffectiveImageUrl: function(muscleId) {
    try {
      var map = JSON.parse(localStorage.getItem('ft_anatomy_custom_urls') || '{}');
      if (map[muscleId]) return map[muscleId];
    } catch (e) {}
    var all = this.getMusclesSeed();
    for (var i = 0; i < all.length; i++) if (all[i].id === muscleId) return all[i].imageUrl;
    return '';
  },

  /* ---------- РЕНДЕР ЭКРАНА ---------- */
  createAnatomyScreen: function() {
    var esc = (typeof Core !== 'undefined' && Core.utils && Core.utils.escapeHtml) ? Core.utils.escapeHtml : function(t){return t;};
    var screen = document.getElementById('screen-anatomy');
    if (!screen) {
      screen = document.createElement('div');
      screen.id = 'screen-anatomy';
      screen.className = 'screen';
      document.getElementById('userInterface').appendChild(screen);
    }

    var parts = this.getBodyParts();

    var html =
      '<style>' +
        '.anatomy-part { background:var(--bg-card); border-radius:14px; margin-bottom:12px; border:1px solid var(--border-subtle); overflow:hidden; }' +
        '.anatomy-part-header { padding:14px 18px; cursor:pointer; display:flex; align-items:center; gap:12px; transition:background 0.2s; }' +
        '.anatomy-part-header:hover { background:var(--accent-gold-dim); }' +
        '.anatomy-part-header.open { background:var(--accent-gold-dim); border-bottom:1px solid var(--border-subtle); }' +
        '.anatomy-part-header .icon { width:36px; height:36px; border-radius:50%; background:var(--bg-primary); display:flex; align-items:center; justify-content:center; color:var(--accent-gold); font-size:1.2em; flex-shrink:0; }' +
        '.anatomy-part-header .name { font-weight:600; font-size:1.05em; flex:1; }' +
        '.anatomy-part-header .count { font-size:0.8em; opacity:0.6; }' +
        '.anatomy-muscles { padding:8px 12px 12px; }' +
        '.anatomy-muscle { display:flex; align-items:center; gap:12px; padding:12px 14px; background:var(--bg-primary); border-radius:10px; margin-bottom:6px; cursor:pointer; border:1px solid var(--border-subtle); transition:all 0.2s; }' +
        '.anatomy-muscle:hover { border-color:var(--border-gold); transform:translateX(3px); }' +
        '.anatomy-muscle .m-name { font-weight:600; font-size:0.95em; color:var(--text-primary); }' +
        '.anatomy-muscle .m-latin { font-size:0.8em; opacity:0.6; font-style:italic; margin-top:2px; }' +
        '.anatomy-muscle .m-arrow { color:var(--accent-gold); font-size:1.1em; }' +
        '.anatomy-muscle-img { width:60px; height:60px; border-radius:8px; background:var(--bg-secondary); object-fit:cover; flex-shrink:0; display:flex; align-items:center; justify-content:center; color:var(--text-muted); font-size:1.5em; }' +

        '.muscle-modal { position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); backdrop-filter:blur(15px); z-index:2000; display:flex; justify-content:center; align-items:center; padding:15px; }' +
        'body.light-theme .muscle-modal { background:rgba(245,242,235,0.9); }' +
        '.muscle-modal-content { background:var(--bg-secondary); border-radius:20px; padding:24px; width:100%; max-width:560px; max-height:90vh; overflow-y:auto; border:1px solid var(--border-gold); box-shadow:0 0 40px rgba(212,175,55,0.2); position:relative; }' +
        '.muscle-modal-img-wrap { position:relative; margin-bottom:12px; border-radius:12px; overflow:hidden; background:var(--bg-primary); display:flex; align-items:center; justify-content:center; min-height:200px; }' +
        '.muscle-modal-img-wrap img { max-width:100%; max-height:280px; display:block; }' +
        '.muscle-modal-img-wrap .no-img { color:var(--text-muted); font-size:3em; padding:40px; }' +
        '.img-actions-block { position:absolute; top:10px; right:10px; z-index:5; }' +
        '.img-actions-block .cat-actions-toggle { width:34px; height:34px; background:rgba(10,10,15,0.65); backdrop-filter:blur(6px); border:1px solid rgba(212,175,55,0.4); border-radius:50%; color:var(--accent-gold); opacity:0.85; font-size:1.1em; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; transition:all 0.2s; }' +
        '.img-actions-block .cat-actions-toggle:hover { opacity:1; background:rgba(10,10,15,0.9); }' +
        '.img-actions-block .cat-actions-panel { display:none; position:absolute; top:100%; right:0; margin-top:6px; background:var(--bg-secondary); border:1px solid var(--border-gold); border-radius:10px; padding:6px; z-index:30; box-shadow:0 8px 24px rgba(0,0,0,0.5); flex-direction:column; gap:4px; min-width:190px; }' +
        '.img-actions-block .cat-actions-panel.open { display:flex; }' +
        '.img-actions-block .cat-actions-panel button { display:flex; align-items:center; gap:10px; padding:10px 12px; background:transparent; border:none; border-radius:8px; cursor:pointer; color:var(--text-primary); font-size:0.9em; text-align:left; transition:background 0.2s; white-space:nowrap; font-family:var(--font-primary); }' +
        '.img-actions-block .cat-actions-panel button:hover { background:var(--accent-gold-dim); }' +
        '.img-actions-block .cat-actions-panel button.danger { color:var(--accent-error); }' +
        '.img-actions-block .cat-actions-panel button.danger:hover { background:rgba(248,113,113,0.15); }' +
        '.img-actions-block .cat-actions-panel button i { font-size:1.1em; color:var(--accent-gold); width:20px; text-align:center; }' +
        '.img-actions-block .cat-actions-panel button.danger i { color:var(--accent-error); }' +

        '.muscle-functions { list-style:none; padding:0; margin:0; }' +
        '.muscle-functions li { padding:6px 0; border-bottom:1px dashed var(--border-subtle); font-size:0.9em; }' +
        '.muscle-functions li:last-child { border-bottom:none; }' +
        '.muscle-antagonist-chip { display:inline-block; padding:6px 12px; background:var(--bg-primary); border:1px solid var(--border-subtle); border-radius:16px; margin:0 6px 6px 0; font-size:0.85em; cursor:pointer; }' +
        '.muscle-antagonist-chip:hover { border-color:var(--border-gold); color:var(--accent-gold); }' +

        /* NEW: упражнения в карточке мышцы */
        '.muscle-ex-list { display:flex; flex-direction:column; gap:6px; }' +
        '.muscle-ex-item { display:flex; align-items:center; gap:10px; padding:10px 12px; background:var(--bg-primary); border:1px solid var(--border-subtle); border-radius:10px; cursor:pointer; transition:all 0.15s; }' +
        '.muscle-ex-item:hover { border-color:var(--border-gold); transform:translateX(3px); }' +
        '.muscle-ex-item .ex-icon { width:32px; height:32px; border-radius:8px; background:var(--accent-gold-dim); border:1px solid var(--border-gold); display:flex; align-items:center; justify-content:center; color:var(--accent-gold); font-size:1.05em; flex-shrink:0; }' +
        '.muscle-ex-item .ex-info { flex:1; min-width:0; }' +
        '.muscle-ex-item .ex-name { font-weight:600; font-size:0.9em; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }' +
        '.muscle-ex-item .ex-cat { font-size:0.75em; opacity:0.6; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }' +
        '.muscle-ex-item .ex-arrow { color:var(--accent-gold); font-size:1em; flex-shrink:0; }' +
        '.muscle-ex-empty { text-align:center; padding:16px; opacity:0.6; font-size:0.85em; background:var(--bg-primary); border-radius:10px; border:1px dashed var(--border-subtle); }' +
        '.muscle-ex-show-all { width:100%; margin-top:8px; padding:10px 14px; background:var(--accent-gold-dim); border:1px solid var(--border-gold); border-radius:10px; color:var(--accent-gold); font-weight:600; font-size:0.85em; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.15s; font-family:var(--font-primary); }' +
        '.muscle-ex-show-all:hover { background:var(--accent-gold); color:var(--text-on-accent); }' +

        '@media (max-width: 600px) { .muscle-modal-content { padding:18px; } }' +
      '</style>' +
      '<div style="padding:8px;max-width:700px;margin:0 auto">' +
        '<h2 style="font-family:var(--font-display);font-size:1.8em;margin-bottom:10px;color:var(--accent-gold);display:flex;align-items:center;gap:12px"><i class="ph ph-person"></i> Анатомия</h2>' +
        '<div class="hint" style="margin-bottom:18px;display:flex;align-items:center;gap:6px;font-size:0.8em;opacity:0.7"><i class="ph ph-info"></i> Тапни на часть тела, чтобы увидеть мышцы. Тапни на мышцу — откроется карточка.</div>';

    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      var muscles = this.getMusclesByPart(part.id);
      var isOpen = !!this._state.expandedParts[part.id];

      html += '<div class="anatomy-part">';
      html += '<div class="anatomy-part-header ' + (isOpen ? 'open' : '') + '" data-part="' + esc(part.id) + '">';
      html += '<div class="icon"><i class="ph ' + esc(part.icon) + '"></i></div>';
      html += '<div class="name">' + esc(part.name) + '</div>';
      html += '<div class="count">' + muscles.length + ' мышц</div>';
      html += '<i class="ph ' + (isOpen ? 'ph-caret-up' : 'ph-caret-down') + '" style="color:var(--accent-gold);font-size:1.1em"></i>';
      html += '</div>';

      if (isOpen) {
        html += '<div class="anatomy-muscles">';
        for (var k = 0; k < muscles.length; k++) {
          var m = muscles[k];
          var cachedImg = this.getCachedImage(m.id);
          var imgHtml;
          if (cachedImg) {
            imgHtml = '<img class="anatomy-muscle-img" src="' + cachedImg + '" alt="">';
          } else if (m.imageUrl) {
            imgHtml = '<img class="anatomy-muscle-img" src="' + esc(m.imageUrl) + '" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="anatomy-muscle-img" style="display:none"><i class="ph ph-image"></i></div>';
          } else {
            imgHtml = '<div class="anatomy-muscle-img"><i class="ph ph-image"></i></div>';
          }
          html += '<div class="anatomy-muscle" data-muscle="' + esc(m.id) + '">';
          html += imgHtml;
          html += '<div style="flex:1;min-width:0">';
          html += '<div class="m-name">' + esc(m.name) + '</div>';
          html += '<div class="m-latin">' + esc(m.latin) + '</div>';
          html += '</div>';
          html += '<i class="ph ph-caret-right m-arrow"></i>';
          html += '</div>';
        }
        html += '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    screen.innerHTML = html;

    var self = this;
    screen.querySelectorAll('.anatomy-part-header').forEach(function(h) {
      h.onclick = function() {
        var partId = h.getAttribute('data-part');
        self._state.expandedParts[partId] = !self._state.expandedParts[partId];
        self.createAnatomyScreen();
      };
    });
    screen.querySelectorAll('.anatomy-muscle').forEach(function(el) {
      el.onclick = function() {
        var muscleId = el.getAttribute('data-muscle');
        self.openMuscleCard(muscleId);
      };
    });
  },

  /* ---------- МОДАЛКА МЫШЦЫ ---------- */
  openMuscleCard: function(muscleId) {
    var esc = (typeof Core !== 'undefined' && Core.utils && Core.utils.escapeHtml) ? Core.utils.escapeHtml : function(t){return t;};
    var m = this.getMuscleById(muscleId);
    if (!m) return;

    var old = document.getElementById('muscleModal');
    if (old) old.remove();

    var self = this;
    var part = this.getBodyPartById(m.bodyPartId);
    var cachedImg = this.getCachedImage(m.id);
    var effectiveUrl = this.getEffectiveImageUrl(m.id) || '';
    var imgSrc = cachedImg || effectiveUrl;

    var modal = document.createElement('div');
    modal.className = 'muscle-modal';
    modal.id = 'muscleModal';

    var menuItems = '';
    if (cachedImg) {
      menuItems += '<button data-act="refresh"><i class="ph ph-arrows-clockwise"></i> Обновить</button>';
      menuItems += '<button data-act="uncache" class="danger"><i class="ph ph-trash"></i> Очистить кэш</button>';
    } else if (effectiveUrl) {
      menuItems += '<button data-act="cache"><i class="ph ph-download-simple"></i> Сохранить в кэш</button>';
    }
    menuItems += '<button data-act="custom-url"><i class="ph ph-link"></i> Указать URL</button>';
    menuItems += '<button data-act="upload-file"><i class="ph ph-upload-simple"></i> Загрузить файл</button>';

    var antagonistsHtml = '';
    if (m.antagonists && m.antagonists.length > 0) {
      antagonistsHtml = '<div style="margin-top:14px"><div style="font-weight:600;font-size:0.9em;margin-bottom:8px;color:var(--accent-gold)"><i class="ph ph-arrows-left-right"></i> Антагонисты</div>';
      for (var i = 0; i < m.antagonists.length; i++) {
        var a = this.getMuscleById(m.antagonists[i]);
        if (!a) continue;
        antagonistsHtml += '<span class="muscle-antagonist-chip" data-muscle="' + esc(a.id) + '">' + esc(a.name) + '</span>';
      }
      antagonistsHtml += '</div>';
    }

    var functionsHtml = '';
    if (m.functions && m.functions.length > 0) {
      functionsHtml = '<div style="margin-top:14px"><div style="font-weight:600;font-size:0.9em;margin-bottom:8px;color:var(--accent-gold)"><i class="ph ph-check-circle"></i> Функции</div><ul class="muscle-functions">';
      for (var i = 0; i < m.functions.length; i++) {
        functionsHtml += '<li>' + esc(m.functions[i]) + '</li>';
      }
      functionsHtml += '</ul></div>';
    }

    /* NEW: блок упражнений */
    var exercises = this.getExercisesForMuscle(m.id);
    var exercisesHtml = '<div style="margin-top:16px"><div style="font-weight:600;font-size:0.9em;margin-bottom:8px;color:var(--accent-gold);display:flex;align-items:center;gap:6px"><i class="ph ph-barbell"></i> Упражнения <span style="opacity:0.6;font-weight:500;font-size:0.9em">(' + exercises.length + ')</span></div>';
    if (exercises.length === 0) {
      exercisesHtml += '<div class="muscle-ex-empty"><i class="ph ph-info" style="font-size:1.4em;display:block;margin-bottom:4px;color:var(--accent-gold)"></i>Пока нет упражнений с этой мышцей.<br><span style="font-size:0.9em;opacity:0.8">Добавь мышцу в упражнение в базе.</span></div>';
    } else {
      exercisesHtml += '<div class="muscle-ex-list">';
      for (var ei = 0; ei < exercises.length; ei++) {
        var ex = exercises[ei];
        var catPath = '';
        if (typeof ExercisesModule !== 'undefined' && ExercisesModule.getCategoryPath) {
          catPath = ExercisesModule.getCategoryPath(ex.muscleGroup).join(' / ');
        }
        exercisesHtml += '<div class="muscle-ex-item" data-ex="' + esc(ex.id) + '">' +
          '<div class="ex-icon"><i class="ph ph-barbell"></i></div>' +
          '<div class="ex-info">' +
            '<div class="ex-name">' + esc(ex.name) + '</div>' +
            '<div class="ex-cat">' + esc(catPath || 'Без категории') + '</div>' +
          '</div>' +
          '<i class="ph ph-caret-right ex-arrow"></i>' +
        '</div>';
      }
      exercisesHtml += '</div>';
      exercisesHtml += '<button class="muscle-ex-show-all" data-act="show-all-ex"><i class="ph ph-list-magnifying-glass"></i> Показать все упражнения с этой мышцей</button>';
    }
    exercisesHtml += '</div>';

    var cacheStatusHtml = '';
    if (cachedImg) {
      cacheStatusHtml = '<div style="font-size:0.75em;opacity:0.6;margin-bottom:12px;display:flex;align-items:center;gap:4px"><i class="ph ph-check-circle" style="color:var(--accent-success)"></i> Картинка в кэше — доступна офлайн</div>';
    } else if (effectiveUrl) {
      cacheStatusHtml = '<div style="font-size:0.75em;opacity:0.6;margin-bottom:12px;display:flex;align-items:center;gap:4px"><i class="ph ph-cloud" style="color:var(--accent-warning)"></i> Картинка загружается из сети (не в кэше)</div>';
    } else {
      cacheStatusHtml = '<div style="font-size:0.75em;opacity:0.6;margin-bottom:12px;display:flex;align-items:center;gap:4px"><i class="ph ph-image" style="color:var(--text-muted)"></i> Картинка не задана</div>';
    }

    modal.innerHTML =
      '<div class="muscle-modal-content">' +
        '<button style="position:absolute;top:12px;right:12px;background:transparent;border:none;color:var(--text-secondary);font-size:1.5em;cursor:pointer;z-index:6" data-act="close" aria-label="Закрыть"><i class="ph ph-x"></i></button>' +
        '<div class="muscle-modal-img-wrap" id="muscleImgWrap">' +
          (imgSrc
            ? '<img src="' + esc(imgSrc) + '" alt="" onerror="this.style.display=\'none\';this.parentElement.querySelector(\'.no-img\').style.display=\'flex\'"><div class="no-img" style="display:none"><i class="ph ph-image-broken"></i></div>'
            : '<div class="no-img"><i class="ph ph-image"></i></div>') +
          '<div class="img-actions-block">' +
            '<button class="cat-actions-toggle" data-act="menu-toggle" title="Действия с картинкой"><i class="ph ph-gear"></i></button>' +
            '<div class="cat-actions-panel">' + menuItems + '</div>' +
          '</div>' +
        '</div>' +
        cacheStatusHtml +
        '<div id="muscleCustomUrlBlock" style="display:none; margin-bottom:16px; padding:12px; background:var(--bg-primary); border-radius:10px; border:1px solid var(--border-subtle)">' +
          '<label style="display:block;margin-bottom:6px;font-weight:600;font-size:0.9em">URL картинки:</label>' +
          '<input type="text" id="muscleCustomUrl" value="' + esc(effectiveUrl) + '" placeholder="https://..." style="width:100%;padding:10px;background:var(--bg-secondary);border:1px solid var(--border-subtle);border-radius:8px;color:var(--text-primary);font-size:1em">' +
          '<div style="display:flex;gap:8px;margin-top:8px;justify-content:flex-end">' +
            '<button class="btn btn-secondary" data-act="custom-cancel" style="padding:8px 12px;font-size:0.85em">Отмена</button>' +
            '<button class="btn btn-primary" data-act="custom-save" style="padding:8px 12px;font-size:0.85em"><i class="ph ph-check"></i> Сохранить</button>' +
          '</div>' +
        '</div>' +
        '<h2 style="font-family:var(--font-display);color:var(--accent-gold);margin:0 0 4px 0">' + esc(m.name) + '</h2>' +
        '<div style="font-style:italic;opacity:0.6;font-size:0.9em;margin-bottom:4px">' + esc(m.latin) + '</div>' +
        '<div style="font-size:0.85em;opacity:0.7;margin-bottom:16px"><i class="ph ph-map-pin"></i> ' + esc(part ? part.name : '') + '</div>' +
        functionsHtml +
        antagonistsHtml +
        exercisesHtml +
      '</div>';

    document.body.appendChild(modal);

    modal.addEventListener('click', function(e) {
      if (e.target === modal) modal.remove();
    });
    modal.querySelectorAll('[data-act="close"]').forEach(function(b) {
      b.onclick = function() { modal.remove(); };
    });
    modal.querySelectorAll('.muscle-antagonist-chip').forEach(function(chip) {
      chip.onclick = function() {
        var id = chip.getAttribute('data-muscle');
        modal.remove();
        self.openMuscleCard(id);
      };
    });

    /* NEW: клик по упражнению → открыть карточку упражнения */
    modal.querySelectorAll('.muscle-ex-item').forEach(function(item) {
      item.onclick = function() {
        var exId = item.getAttribute('data-ex');
        modal.remove();
        if (typeof ExercisesModule !== 'undefined' && ExercisesModule.viewExercise) {
          Core.navigate('exercises');
          setTimeout(function() {
            ExercisesModule.viewExercise(exId);
          }, 100);
        }
      };
    });

    /* NEW: показать все упражнения с этой мышцей */
    modal.querySelectorAll('[data-act="show-all-ex"]').forEach(function(btn) {
      btn.onclick = function() {
        modal.remove();
        if (typeof ExercisesModule !== 'undefined' && ExercisesModule.setMuscleFilter) {
          if (typeof Core !== 'undefined' && Core.navigate) Core.navigate('exercises');
          setTimeout(function() {
            ExercisesModule.setMuscleFilter(m.id);
          }, 100);
        }
      };
    });

    var toggleBtn = modal.querySelector('[data-act="menu-toggle"]');
    var panel = modal.querySelector('.img-actions-block .cat-actions-panel');
    if (toggleBtn && panel) {
      toggleBtn.onclick = function(e) {
        e.stopPropagation();
        panel.classList.toggle('open');
      };
      modal.addEventListener('click', function(e) {
        if (!e.target.closest('.img-actions-block')) panel.classList.remove('open');
      });
    }

    var customBlock = modal.querySelector('#muscleCustomUrlBlock');
    var customInput = modal.querySelector('#muscleCustomUrl');

    modal.querySelectorAll('[data-act="custom-url"]').forEach(function(b) {
      b.onclick = function() {
        if (panel) panel.classList.remove('open');
        customBlock.style.display = 'block';
        setTimeout(function() { customInput.focus(); customInput.select(); }, 50);
      };
    });
    modal.querySelectorAll('[data-act="custom-cancel"]').forEach(function(b) {
      b.onclick = function() { customBlock.style.display = 'none'; };
    });
    modal.querySelectorAll('[data-act="custom-save"]').forEach(function(b) {
      b.onclick = function() {
        var url = customInput.value.trim();
        if (!url) return;
        self._saveCustomImageUrl(m.id, url);
        modal.remove();
        self.openMuscleCard(m.id);
        self.saveImageToCache(m.id, url, function(ok, err) {
          if (ok) {
            if (typeof Notify !== 'undefined') Notify.success('Картинка сохранена в кэш (доступна офлайн)');
          } else {
            if (typeof Notify !== 'undefined') Notify.warn('URL сохранён, но в кэш не попал (только онлайн)');
          }
        });
      };
    });

    modal.querySelectorAll('[data-act="cache"]').forEach(function(btn) {
      btn.onclick = function() {
        if (panel) panel.classList.remove('open');
        var urlToUse = self.getEffectiveImageUrl(m.id) || m.imageUrl;
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner"></i> Загрузка...';
        self.saveImageToCache(m.id, urlToUse, function(ok, err) {
          btn.disabled = false;
          btn.innerHTML = '<i class="ph ph-download-simple"></i> Сохранить в кэш';
          if (ok) {
            modal.remove();
            self.openMuscleCard(m.id);
            if (typeof Notify !== 'undefined') Notify.success('Картинка сохранена в кэш');
          } else {
            if (typeof Notify !== 'undefined') Notify.warn('Не удалось сохранить: ' + (err || '') + '. Будет грузиться из сети.');
          }
        });
      };
    });

    modal.querySelectorAll('[data-act="refresh"]').forEach(function(btn) {
      btn.onclick = function() {
        if (panel) panel.classList.remove('open');
        var urlToUse = self.getEffectiveImageUrl(m.id) || m.imageUrl;
        btn.disabled = true;
        btn.innerHTML = '<i class="ph ph-spinner"></i>';
        self.saveImageToCache(m.id, urlToUse, function(ok, err) {
          btn.disabled = false;
          btn.innerHTML = '<i class="ph ph-arrows-clockwise"></i> Обновить';
          if (ok) {
            modal.remove();
            self.openMuscleCard(m.id);
            if (typeof Notify !== 'undefined') Notify.success('Картинка обновлена');
          } else {
            if (typeof Notify !== 'undefined') Notify.warn('Не удалось обновить кэш: ' + (err || ''));
          }
        });
      };
    });

    modal.querySelectorAll('[data-act="uncache"]').forEach(function(btn) {
      btn.onclick = function() {
        if (panel) panel.classList.remove('open');
        if (!confirm('Удалить картинку из кэша?')) return;
        self.removeImageFromCache(m.id);
        modal.remove();
        self.openMuscleCard(m.id);
      };
    });

    modal.querySelectorAll('[data-act="upload-file"]').forEach(function(btn) {
      btn.onclick = function() {
        if (panel) panel.classList.remove('open');
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = function(e) {
          var file = e.target.files[0];
          if (!file) return;
          if (file.size > 2 * 1024 * 1024) {
            if (typeof Notify !== 'undefined') Notify.warn('Файл больше 2 МБ');
            return;
          }
          var reader = new FileReader();
          reader.onload = function(ev) {
            var img = new Image();
            img.onload = function() {
              try {
                var size = 320;
                var canvas = document.createElement('canvas');
                var ratio = Math.min(size / img.width, size / img.height);
                canvas.width = Math.round(img.width * ratio);
                canvas.height = Math.round(img.height * ratio);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                try {
                  localStorage.setItem(self._state.cachePrefix + m.id, dataUrl);
                  modal.remove();
                  self.openMuscleCard(m.id);
                  if (typeof Notify !== 'undefined') Notify.success('Картинка сохранена из файла');
                } catch (e) {
                  if (typeof Notify !== 'undefined') Notify.error('Нет места в localStorage');
                }
              } catch (e) {
                if (typeof Notify !== 'undefined') Notify.error('Ошибка обработки');
              }
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        };
        input.click();
      };
    });
  }
};

window.AnatomyModule = AnatomyModule;
module.exports = AnatomyModule;