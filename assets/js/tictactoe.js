/* Tic-Tac-Toe: Minimax with alpha-beta pruning, three difficulty levels */
(function () {
  'use strict';
  var LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  var nodes = 0;

  function winner(b) {
    for (var i = 0; i < LINES.length; i++) {
      var l = LINES[i];
      if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[1]] === b[l[2]]) return { p: b[l[0]], line: l };
    }
    return null;
  }
  function empties(b) { var e = []; for (var i = 0; i < 9; i++) if (!b[i]) e.push(i); return e; }

  // Score from the AI's perspective; depth bonus makes it win fast and lose slowly
  function minimax(b, depth, isMax, ai, hu, alpha, beta) {
    nodes++;
    var w = winner(b);
    if (w) return w.p === ai ? 10 - depth : depth - 10;
    var em = empties(b); if (!em.length) return 0;
    var best, i, s;
    if (isMax) {
      best = -Infinity;
      for (i = 0; i < em.length; i++) {
        b[em[i]] = ai; s = minimax(b, depth + 1, false, ai, hu, alpha, beta); b[em[i]] = null;
        if (s > best) best = s; if (best > alpha) alpha = best; if (beta <= alpha) break;
      }
    } else {
      best = Infinity;
      for (i = 0; i < em.length; i++) {
        b[em[i]] = hu; s = minimax(b, depth + 1, true, ai, hu, alpha, beta); b[em[i]] = null;
        if (s < best) best = s; if (best < beta) beta = best; if (beta <= alpha) break;
      }
    }
    return best;
  }
  function bestMove(b, ai) {
    var hu = ai === 'X' ? 'O' : 'X', em = empties(b), best = -Infinity, moves = [];
    nodes = 0;
    for (var i = 0; i < em.length; i++) {
      b[em[i]] = ai; var s = minimax(b, 1, false, ai, hu, -Infinity, Infinity); b[em[i]] = null;
      if (s > best) { best = s; moves = [em[i]]; } else if (s === best) moves.push(em[i]);
    }
    return moves[Math.floor(Math.random() * moves.length)];
  }
  function chooseMove(b, ai, level) {
    var em = empties(b); if (!em.length) return -1;
    var optimal = level === 'hard' || (level === 'medium' && Math.random() < 0.6);
    if (!optimal) { nodes = 0; return em[Math.floor(Math.random() * em.length)]; }
    return bestMove(b, ai);
  }

  var api = { winner: winner, bestMove: bestMove, chooseMove: chooseMove, minimax: minimax };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  /* ---------- UI ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var boardEl = $('board'), statusEl = $('status');
  if (!boardEl) return;
  var KEY = 'ailab.ttt.v1';
  var saved = UI.store.get(KEY, {});
  var cfg = { diff: saved.diff || 'hard', side: saved.side || 'X' };
  var score = saved.score || { w: 0, d: 0, l: 0 };
  var board, human, ai, turn, over, history, timer, cells = [];

  for (var i = 0; i < 9; i++) {
    var c = document.createElement('button');
    c.type = 'button'; c.className = 'cell'; c.setAttribute('role', 'gridcell'); c.setAttribute('aria-label', 'Cell ' + (i + 1));
    (function (idx) { c.addEventListener('click', function () { play(idx); }); })(i);
    boardEl.appendChild(c); cells.push(c);
  }

  function persist() { UI.store.set(KEY, { diff: cfg.diff, side: cfg.side, score: score }); }
  function drawScore() { $('sw').textContent = score.w; $('sd').textContent = score.d; $('sl').textContent = score.l; }
  function setSeg(id, val) { document.querySelectorAll('#' + id + ' button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === val); }); }

  function draw() {
    var w = winner(board);
    cells.forEach(function (c, i) {
      var v = board[i]; c.textContent = v || ''; c.className = 'cell' + (v ? ' ' + v.toLowerCase() : '');
      c.disabled = over || !!v || turn !== human;
      if (w && w.line.indexOf(i) > -1) c.classList.add('win');
    });
  }
  function end(msg, key) {
    over = true; statusEl.textContent = msg; if (key) { score[key]++; persist(); drawScore(); } draw();
  }
  function check() {
    var w = winner(board);
    if (w) { if (w.p === human) end('You win! 🎉', 'w'); else end('AI wins 🤖', 'l'); return true; }
    if (!empties(board).length) { end("It's a draw 🤝", 'd'); return true; }
    return false;
  }
  function aiTurn() {
    turn = ai; statusEl.innerHTML = 'AI is thinking <span class="spinner" style="width:14px;height:14px;vertical-align:-2px"></span>'; draw();
    timer = setTimeout(function () {
      var t0 = performance.now(), m;
      try { m = chooseMove(board, ai, cfg.diff); } catch (e) { var em = empties(board); m = em[0]; nodes = 0; }
      $('nodes').textContent = nodes.toLocaleString(); $('ms').textContent = (performance.now() - t0).toFixed(1) + ' ms';
      if (m >= 0) { board[m] = ai; history.push(m); }
      turn = human; if (!check()) { statusEl.textContent = 'Your turn (' + human + ')'; draw(); }
    }, 420);
  }
  function play(i) {
    if (over || turn !== human || board[i]) return;
    board[i] = human; history.push(i);
    if (check()) return; aiTurn();
  }
  function reset() {
    clearTimeout(timer); board = Array(9).fill(null); human = cfg.side; ai = human === 'X' ? 'O' : 'X';
    over = false; history = []; turn = 'X'; $('nodes').textContent = '0'; $('ms').textContent = '0 ms';
    if (human === 'X') { turn = human; statusEl.textContent = 'Your turn (X)'; draw(); } else aiTurn();
  }
  function undo() {
    if (over || turn !== human || history.length < (human === 'X' ? 2 : 3)) { UI.toast('Nothing to undo'); return; }
    board[history.pop()] = null; board[history.pop()] = null; draw(); statusEl.textContent = 'Your turn (' + human + ')';
  }
  function hint() {
    if (over || turn !== human) return;
    var copy = board.slice(), m = bestMove(copy, human);
    if (m >= 0) { cells[m].classList.add('hint'); setTimeout(function () { cells[m].classList.remove('hint'); }, 1500); }
  }

  document.querySelectorAll('#diff button').forEach(function (b) { b.addEventListener('click', function () { cfg.diff = b.dataset.v; setSeg('diff', cfg.diff); persist(); reset(); }); });
  document.querySelectorAll('#side button').forEach(function (b) { b.addEventListener('click', function () { cfg.side = b.dataset.v; setSeg('side', cfg.side); persist(); reset(); }); });
  $('new').addEventListener('click', reset); $('undo').addEventListener('click', undo); $('hint').addEventListener('click', hint);
  $('reset').addEventListener('click', function () { score = { w: 0, d: 0, l: 0 }; persist(); drawScore(); UI.toast('Scores reset'); });
  document.addEventListener('keydown', function (e) {
    if (/^[1-9]$/.test(e.key) && !e.metaKey && !e.ctrlKey && !/input|textarea/i.test(document.activeElement.tagName)) play(+e.key - 1);
    else if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey) reset();
  });
  setSeg('diff', cfg.diff); setSeg('side', cfg.side); drawScore(); reset();
})();
