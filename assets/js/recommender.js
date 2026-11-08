/* Content-based recommender: TF-IDF over description + genres, cosine similarity, genre overlap boost */
(function () {
  'use strict';
  var STOP = new Set('a,an,and,are,as,at,be,by,for,from,has,he,her,his,in,into,is,it,its,of,on,or,she,that,the,their,them,to,was,were,when,where,while,who,with,must,after,over,across,becomes,become'.split(','));
  function tokens(s) { return s.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2 && !STOP.has(w); }); }

  function build(movies) {
    var docs = movies.map(function (m) {
      var t = tokens(m.desc); var g = m.genres.map(function (x) { return x.toLowerCase().replace('-', ''); });
      return t.concat(g, g); // genres weighted double
    });
    var df = {}; docs.forEach(function (d) { new Set(d).forEach(function (w) { df[w] = (df[w] || 0) + 1; }); });
    var N = docs.length, vecs = docs.map(function (d) {
      var tf = {}; d.forEach(function (w) { tf[w] = (tf[w] || 0) + 1; });
      var v = {}, norm = 0;
      for (var w in tf) { var x = tf[w] * (Math.log((1 + N) / (1 + df[w])) + 1); v[w] = x; norm += x * x; }
      norm = Math.sqrt(norm) || 1; for (var k in v) v[k] /= norm; return v;
    });
    return vecs;
  }
  function cosine(a, b) { var s = 0; for (var k in a) if (b[k]) s += a[k] * b[k]; return s; }
  function jaccard(a, b) { var A = new Set(a), i = 0; b.forEach(function (x) { if (A.has(x)) i++; }); var u = A.size + b.length - i; return u ? i / u : 0; }

  function recommend(movies, vecs, idx, opts) {
    opts = opts || {}; var n = opts.n || 6, base = movies[idx];
    return movies.map(function (m, i) {
      if (i === idx) return null;
      if (opts.filter && !opts.filter(m)) return null;
      var s = 0.7 * cosine(vecs[idx], vecs[i]) + 0.3 * jaccard(base.genres, m.genres);
      return { movie: m, score: s };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; }).slice(0, n);
  }
  var api = { build: build, recommend: recommend, tokens: tokens };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  /* ---------- UI ---------- */
  var $ = function (id) { return document.getElementById(id); };
  if (!$('genres')) return;
  var movies = Array.isArray(window.MOVIES) ? window.MOVIES : [];
  if (!movies.length) { $('empty').textContent = 'The movie data could not be loaded. Please refresh the page.'; $('empty').classList.remove('hidden'); return; }
  var vecs = build(movies);
  var state = { genres: new Set(), era: 'any', q: '', sel: null };
  var allGenres = Array.from(new Set([].concat.apply([], movies.map(function (m) { return m.genres; })))).sort();
  var HUES = [250, 330, 20, 160, 200, 280, 45, 0];

  function poster(m) {
    var h = HUES[m.id % HUES.length], d = document.createElement('div'); d.className = 'poster';
    d.style.background = 'linear-gradient(135deg,hsl(' + h + ' 70% 45%),hsl(' + ((h + 50) % 360) + ' 70% 30%))';
    d.textContent = m.title.replace(/^(The|A|An)\s+/i, '').split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
    d.setAttribute('aria-hidden', 'true'); return d;
  }
  function eraOK(m) { return state.era === 'any' || (state.era === 'old' ? m.year < 2000 : m.year >= 2000); }
  function genreOK(m) { return !state.genres.size || m.genres.some(function (g) { return state.genres.has(g); }); }
  function filtered() {
    var q = state.q.trim().toLowerCase();
    return movies.filter(function (m) { return eraOK(m) && genreOK(m) && (!q || m.title.toLowerCase().indexOf(q) > -1); });
  }

  function renderGenres() {
    $('genres').innerHTML = '';
    allGenres.forEach(function (g) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (state.genres.has(g) ? ' on' : ''); b.textContent = g;
      b.setAttribute('aria-pressed', state.genres.has(g));
      b.onclick = function () { state.genres.has(g) ? state.genres.delete(g) : state.genres.add(g); renderGenres(); renderList(); };
      $('genres').appendChild(b);
    });
  }
  function renderList() {
    var list = filtered(), box = $('list'); box.innerHTML = '';
    $('count').textContent = list.length + ' movie' + (list.length === 1 ? '' : 's');
    $('empty').classList.toggle('hidden', list.length > 0);
    list.forEach(function (m, i) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'movie' + (state.sel === m.id ? ' sel' : ''); b.style.animationDelay = Math.min(i * 25, 400) + 'ms';
      b.appendChild(poster(m));
      var h = document.createElement('h4'); h.textContent = m.title; b.appendChild(h);
      var meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = m.year + ' · ' + m.genres.join(', '); b.appendChild(meta);
      b.onclick = function () { select(m.id); };
      box.appendChild(b);
    });
  }
  function select(id) {
    state.sel = id; renderList();
    var recs = recommend(movies, vecs, id, { n: 6, filter: function (m) { return eraOK(m); } });
    var out = $('recs'); out.innerHTML = ''; $('recidle').classList.add('hidden'); $('surprise').classList.remove('hidden');
    var head = document.createElement('p'); head.className = 'small muted'; head.style.marginBottom = '12px';
    head.textContent = 'Because you picked “' + movies[id].title + '”'; out.appendChild(head);
    recs.forEach(function (r, i) {
      var row = document.createElement('div'); row.className = 'rec'; row.style.animationDelay = i * 80 + 'ms';
      var pct = Math.round(Math.min(1, r.score / 0.55) * 100);
      row.innerHTML = '<div class="rank"></div><div><b class="t"></b><div class="small muted m"></div><div class="bar" style="margin-top:8px"><span></span></div></div>';
      row.querySelector('.rank').textContent = i + 1; row.querySelector('.t').textContent = r.movie.title;
      row.querySelector('.m').textContent = r.movie.year + ' · ' + r.movie.genres.join(', ') + ' · ' + pct + '% match';
      out.appendChild(row);
      requestAnimationFrame(function () { setTimeout(function () { row.querySelector('.bar span').style.width = pct + '%'; }, 120 + i * 80); });
    });
    if (window.innerWidth < 900) $('recbox').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  document.querySelectorAll('#era button').forEach(function (b) {
    b.onclick = function () { state.era = b.dataset.v; document.querySelectorAll('#era button').forEach(function (x) { x.classList.toggle('on', x === b); }); renderList(); if (state.sel !== null) select(state.sel); };
  });
  var t; $('q').addEventListener('input', function (e) { clearTimeout(t); t = setTimeout(function () { state.q = e.target.value; renderList(); }, 120); });
  $('surprise').onclick = function () { var l = filtered(); if (l.length) select(l[Math.floor(Math.random() * l.length)].id); };
  renderGenres(); renderList();
})();
