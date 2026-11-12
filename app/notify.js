// app/notify.js
// Красивые всплывашки вместо alert(). Не блокируют экран.

(function() {
  'use strict';

  var CONTAINER_ID = 'notifyContainer';
  var DEFAULT_DURATION = 3500;

  function ensureContainer() {
    var el = document.getElementById(CONTAINER_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = CONTAINER_ID;
    el.style.cssText = [
      'position:fixed',
      'top:80px',
      'right:16px',
      'z-index:99999',
      'display:flex',
      'flex-direction:column',
      'align-items:flex-end',
      'gap:10px',
      'pointer-events:none',
      'max-width:calc(100vw - 32px)'
    ].join(';');
    document.body.appendChild(el);
    return el;
  }

  var COLORS = {
    success: { bg: 'linear-gradient(135deg, #16a34a, #22c55e)', fg: '#fff', icon: '✓' },
    warn:    { bg: 'linear-gradient(135deg, #d97706, #f59e0b)', fg: '#fff', icon: '!' },
    error:   { bg: 'linear-gradient(135deg, #dc2626, #ef4444)', fg: '#fff', icon: '×' },
    info:    { bg: 'linear-gradient(135deg, #0284c7, #0ea5e9)', fg: '#fff', icon: 'i' }
  };

  function show(message, type, duration) {
    type = COLORS[type] ? type : 'info';
    duration = duration || DEFAULT_DURATION;

    var container = ensureContainer();
    var style = COLORS[type];

    var toast = document.createElement('div');
    toast.style.cssText = [
      'pointer-events:auto',
      'display:flex',
      'align-items:center',
      'gap:10px',
      'min-width:200px',
      'max-width:380px',
      'padding:12px 16px',
      'border-radius:12px',
      'background:' + style.bg,
      'color:' + style.fg,
      'box-shadow:0 8px 24px rgba(0,0,0,0.35)',
      'font-family:Inter, sans-serif',
      'font-size:0.92em',
      'font-weight:500',
      'line-height:1.35',
      'opacity:0',
      'transform:translateX(20px)',
      'transition:opacity 0.25s ease, transform 0.25s ease',
      'cursor:pointer',
      'word-break:break-word'
    ].join(';');

    var icon = document.createElement('span');
    icon.textContent = style.icon;
    icon.style.cssText = [
      'flex-shrink:0',
      'width:22px',
      'height:22px',
      'border-radius:50%',
      'background:rgba(255,255,255,0.25)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'font-weight:700',
      'font-size:0.9em'
    ].join(';');
    toast.appendChild(icon);

    var text = document.createElement('span');
    text.textContent = String(message == null ? '' : message);
    text.style.flex = '1';
    toast.appendChild(text);

    container.appendChild(toast);

    requestAnimationFrame(function() {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    });

    var timer = setTimeout(remove, duration);

    function remove() {
      clearTimeout(timer);
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    }

    toast.addEventListener('click', remove);
  }

  window.Notify = {
    success: function(m, d) { show(m, 'success', d); },
    warn:    function(m, d) { show(m, 'warn', d); },
    error:   function(m, d) { show(m, 'error', d); },
    info:    function(m, d) { show(m, 'info', d); }
  };
})();