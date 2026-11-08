/* Shared helpers: nav, reveal animations, toast, safe storage */
(function () {
  'use strict';
  var nav = document.getElementById('nav');
  var burger = document.getElementById('burger');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function (e) { if (!nav.contains(e.target)) nav.classList.remove('open'); });
  }

  // Scroll reveal with fallback when IntersectionObserver is missing
  var items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
    setTimeout(function () { items.forEach(function (el) { el.classList.add('in'); }); }, 1800); // safety net
  } else items.forEach(function (el) { el.classList.add('in'); });

  // Card spotlight on home
  document.querySelectorAll('.card').forEach(function (c) {
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect();
      c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      c.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  window.UI = {
    toast: function (msg, ms) {
      var box = document.getElementById('toasts'); if (!box) return;
      var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; box.appendChild(t);
      setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(function () { t.remove(); }, 300); }, ms || 2400);
    },
    store: {
      get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
      set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
    },
    $: function (s, r) { return (r || document).querySelector(s); }
  };
})();
