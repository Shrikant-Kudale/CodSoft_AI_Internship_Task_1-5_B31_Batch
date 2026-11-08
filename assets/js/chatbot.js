/* Rule-based chatbot: intent matching with word boundaries, safe calculator, session memory */
(function () {
  'use strict';

  /* ---------- Safe math evaluator (no eval) ---------- */
  function calc(expr) {
    var tokens = expr.match(/\d+\.?\d*|\.\d+|[-+*\/%^()]/g);
    if (!tokens) throw new Error('empty');
    var pos = 0;
    function peek() { return tokens[pos]; }
    function next() { return tokens[pos++]; }
    function primary() {
      var t = next();
      if (t === undefined) throw new Error('syntax');
      if (t === '(') { var v = add(); if (next() !== ')') throw new Error('paren'); return v; }
      if (t === '-') return -power();
      if (t === '+') return power();
      var n = parseFloat(t); if (isNaN(n)) throw new Error('syntax'); return n;
    }
    function power() { var b = primary(); if (peek() === '^') { next(); return Math.pow(b, power()); } return b; }
    function mul() {
      var v = power();
      while (peek() === '*' || peek() === '/' || peek() === '%') {
        var op = next(), r = power();
        if (op === '*') v *= r; else if (op === '/') { if (r === 0) throw new Error('div0'); v /= r; } else { if (r === 0) throw new Error('div0'); v %= r; }
      }
      return v;
    }
    function add() {
      var v = mul();
      while (peek() === '+' || peek() === '-') { var op = next(), r = mul(); v = op === '+' ? v + r : v - r; }
      return v;
    }
    var out = add();
    if (pos !== tokens.length) throw new Error('syntax');
    if (!isFinite(out)) throw new Error('range');
    return out;
  }

  function extractMath(text) {
    var s = text.toLowerCase()
      .replace(/(\d)\s*x\s*(?=\d)/g, '$1*')
      .replace(/multiplied by|times|×/g, '*').replace(/divided by|over|÷/g, '/')
      .replace(/\bplus\b/g, '+').replace(/\bminus\b/g, '-').replace(/\bmod(ulo)?\b/g, '%')
      .replace(/to the power of|power/g, '^').replace(/\*\*/g, '^').replace(/,/g, '');
    var m = s.match(/[\d.()+\-*\/%^\s]{3,}/g);
    if (!m) return null;
    var best = m.map(function (x) { return x.trim(); }).filter(function (x) { return /\d/.test(x) && /[+\-*\/%^]/.test(x.replace(/^[-+]/, '')); }).sort(function (a, b) { return b.length - a.length; })[0];
    return best || null;
  }

  /* ---------- Knowledge ---------- */
  var JOKES = [
    'Why do programmers prefer dark mode? Because light attracts bugs.',
    'I would tell you a UDP joke, but you might not get it.',
    'There are 10 kinds of people: those who understand binary and those who do not.',
    'A SQL query walks into a bar, sees two tables and asks: "Can I join you?"',
    'Why did the neural network go to therapy? Too many unresolved layers.'
  ];
  var FACTS = [
    'The term "artificial intelligence" was coined in 1956 at the Dartmouth workshop.',
    'Minimax, the algorithm in the Tic-Tac-Toe page, dates back to game theory work in the 1920s.',
    'Honey never spoils: archaeologists have found edible honey in ancient Egyptian tombs.',
    'The first computer bug was a real moth found in a Harvard Mark II relay in 1947.'
  ];
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  var state = { name: null, lastJoke: -1 };

  function fmtTime() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  function fmtDate() { return new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); }
  function who() { return state.name ? ', ' + state.name : ''; }

  // Each intent: regex (tested on lower-cased, word-bounded text) and a reply function. Order = priority.
  var INTENTS = [
    { id: 'name-set', re: /\b(?:my name is|i am called|call me|i'm called)\s+([a-z][a-z' -]{0,24})/i, reply: function (m) {
      var n = m[1].trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
      state.name = n; return 'Nice to meet you, ' + n + '! I will remember that for this conversation.'; } },
    { id: 'name-get', re: /\b(?:what(?:'?s| is) my name|do you know my name|who am i)\b/, reply: function () { return state.name ? 'You told me your name is ' + state.name + '.' : 'I do not know your name yet. Tell me with "my name is ...".'; } },
    { id: 'bye', re: /\b(?:bye|goodbye|see you|exit|quit|good night|cya)\b/, reply: function () { return 'It was nice chatting with you' + who() + '. Have a great day! 👋'; } },
    { id: 'thanks', re: /\b(?:thanks|thank you|thx|appreciate)\b/, reply: function () { return pick(['You are most welcome! 😊', 'Happy to help!', 'Anytime' + who() + '!']); } },
    { id: 'how', re: /\bhow (?:are|r) (?:you|u)\b|\bhow(?:'s| is) it going\b|\bwhat'?s up\b/, reply: function () { return 'I am running smoothly, thanks for asking! How can I help you today?'; } },
    { id: 'name-bot', re: /\b(?:your name|who are you|what are you|introduce yourself)\b/, reply: function () { return 'I am a rule-based assistant. I match your message against a set of intents and reply with hand-written answers, which is one of the simplest forms of conversational AI.'; } },
    { id: 'help', re: /\b(?:help|what can you do|capabilities|features|commands)\b/, reply: function () { return 'Here is what I can do:\n• Tell the time and date\n• Solve maths, e.g. "12 * (3 + 4)"\n• Remember your name\n• Tell jokes and fun facts\n• Point you to the other tools on this site'; } },
    { id: 'time', re: /\b(?:time|clock)\b/, reply: function () { return 'The current time is ' + fmtTime() + '.'; } },
    { id: 'date', re: /\b(?:date|today|day is it|what day)\b/, reply: function () { return 'Today is ' + fmtDate() + '.'; } },
    { id: 'joke', re: /\b(?:joke|funny|make me laugh|laugh)\b/, reply: function () { var i; do { i = Math.floor(Math.random() * JOKES.length); } while (i === state.lastJoke && JOKES.length > 1); state.lastJoke = i; return JOKES[i]; } },
    { id: 'fact', re: /\b(?:fact|trivia|something interesting|tell me something)\b/, reply: function () { return pick(FACTS); } },
    { id: 'weather', re: /\b(?:weather|temperature|rain|forecast)\b/, reply: function () { return 'I cannot fetch live weather, since I work offline in your browser. A weather app or site will give you an accurate forecast.'; } },
    { id: 'game', re: /\b(?:game|play|tic.?tac.?toe|bored)\b/, reply: function () { return 'Fancy a challenge? Try the <a href="/tic-tac-toe">Tic-Tac-Toe</a> page and see if you can beat the Minimax AI.'; }, html: true },
    { id: 'image', re: /\b(?:image|photo|picture|recogni[sz]e)\b/, reply: function () { return 'Head to <a href="/image-recognition">Image Recognition</a> to see what a neural network makes of your photo.'; }, html: true },
    { id: 'movie', re: /\b(?:movie|film|recommend|watch)\b/, reply: function () { return 'I can point you to <a href="/recommendations">Recommendations</a>. Pick a film you like and it finds similar ones.'; }, html: true },
    { id: 'face', re: /\b(?:face|faces|webcam|camera)\b/, reply: function () { return 'The <a href="/face-detection">Face Detection</a> page can find faces in photos, videos and your live webcam.'; }, html: true },
    { id: 'ai', re: /\b(?:artificial intelligence|machine learning|\bai\b|neural network|chatbot)\b/, reply: function () { return 'AI is the field of building systems that perform tasks that normally need human intelligence. Chatbots like me use anything from simple rules to large language models. I am the simple-rules kind.'; } },
    { id: 'compliment', re: /\b(?:you are|you're|youre)\s+(?:great|awesome|smart|amazing|cool|good|nice)\b/, reply: function () { return 'That is kind of you to say! 😊'; } },
    { id: 'greet', re: /\b(?:hi|hello|hey|hola|namaste|howdy|good (?:morning|afternoon|evening))\b/, reply: function () {
      var h = new Date().getHours(); var g = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
      return pick(['Hello there' + who() + '! How can I help you today? 😊', g + who() + '! What can I do for you?']); } }
  ];

  function respond(input) {
    var text = (input || '').trim();
    if (!text) return { text: 'Say something and I will do my best to answer.' };
    if (text.length > 500) text = text.slice(0, 500);
    var low = text.toLowerCase();

    // Maths first so "2 x 3" is not misread
    var expr = extractMath(low);
    if (expr && (/^[\d\s.()+\-*\/%^]+$/.test(low.replace(/[a-z?!=]|\bwhat\b|\bis\b/g, '')) || /\b(?:calculate|compute|solve|what is|what's|equals?)\b/.test(low) || /^[\d\s.()+\-*\/%^x×÷=?]+$/.test(low))) {
      try {
        var v = calc(expr); var shown = Math.abs(v) < 1e15 ? +v.toPrecision(12) : v;
        return { text: expr.replace(/\s+/g, ' ') + ' = ' + shown };
      } catch (e) {
        var pure = /^[\d\s.()+\-*\/%^x×÷=?]+$/.test(low);
        if (e.message !== 'div0' && !pure) expr = null; else
        return { text: e.message === 'div0' ? 'Division by zero is undefined, so I cannot do that one.' : 'I could not read that calculation. Try something like "12 * (3 + 4)".' };
      }
    }
    for (var i = 0; i < INTENTS.length; i++) {
      var it = INTENTS[i]; var m = (it.id === 'name-set' ? text : low).match(it.re);
      if (m) return { text: it.reply(m), html: !!it.html, intent: it.id };
    }
    return { text: pick(['I am not sure I understood that. Could you rephrase it?', 'Hmm, that one is outside my rules. Try asking for help to see what I can do.', 'I did not catch that. Ask me about the time, maths, jokes or the other tools here.']), intent: 'fallback' };
  }

  var api = { respond: respond, calc: calc, extractMath: extractMath };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  /* ---------- UI ---------- */
  var msgs = document.getElementById('msgs'), input = document.getElementById('input'), send = document.getElementById('send');
  var suggest = document.getElementById('suggest'), clear = document.getElementById('clear');
  if (!msgs) return;
  var KEY = 'ailab.chat.v1', history = (window.UI && UI.store.get(KEY, [])) || [];
  if (!Array.isArray(history)) history = [];
  var busy = false;

  function save() { if (window.UI) UI.store.set(KEY, history.slice(-60)); }
  function bubble(role, text, html, time) {
    var d = document.createElement('div'); d.className = 'msg ' + role;
    var span = document.createElement('span');
    if (html) span.innerHTML = text; else span.textContent = text;
    var t = document.createElement('time'); t.textContent = time || fmtTime();
    d.appendChild(span); d.appendChild(t); msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d;
  }
  function welcome() {
    bubble('bot', 'Hello! 👋 I am your assistant. Ask me anything, or tap a suggestion below.');
  }
  function render() {
    msgs.innerHTML = '';
    if (!history.length) { welcome(); return; }
    history.forEach(function (h) { bubble(h.r, h.t, h.h, h.ts); });
  }
  function say(text) {
    if (busy) return; text = text.trim(); if (!text) return;
    busy = true; send.disabled = true;
    var ts = fmtTime(); bubble('user', text, false, ts); history.push({ r: 'user', t: text, ts: ts });
    input.value = '';
    var typing = document.createElement('div'); typing.className = 'msg bot typing'; typing.innerHTML = '<i></i><i></i><i></i>';
    msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight;
    var res; try { res = respond(text); } catch (e) { res = { text: 'Oops, something went wrong on my side. Please try again.' }; }
    setTimeout(function () {
      typing.remove(); var ts2 = fmtTime();
      bubble('bot', res.text, res.html, ts2); history.push({ r: 'bot', t: res.text, h: !!res.html, ts: ts2 }); save();
      busy = false; send.disabled = false; input.focus();
    }, 380 + Math.min(res.text.length * 6, 700));
  }

  ['What can you do?', 'What time is it?', 'Tell me a joke', '12 * (3 + 4)', 'Play a game', 'My name is Alex'].forEach(function (s) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = s;
    b.addEventListener('click', function () { say(s); }); suggest.appendChild(b);
  });
  send.addEventListener('click', function () { say(input.value); });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); say(input.value); } });
  clear.addEventListener('click', function () { history = []; state.name = null; save(); render(); UI.toast('Chat cleared'); });
  render(); input.focus();
})();
