// Shared engine for every unit page. Each unit only provides data.js (window.UNIT).
(function () {
  const SPEAKER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  const MODES = [
    { id: "list", label: "Words", ic: "📖" },
    { id: "flash", label: "Flashcards", ic: "🃏" },
    { id: "quiz", label: "Quiz", ic: "✅" },
    { id: "spell", label: "Spelling", ic: "⌨️" },
    { id: "listen", label: "Listening", ic: "🔊" }
  ];

  let words = [];
  let view;
  let state = {};

  // ---------- helpers ----------
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const norm = s => String(s).replace(/[\s.,!?~()'"·-]/g, "").trim();
  const bar = (i, n) => `<div class="bar"><i style="width:${Math.round((i / n) * 100)}%"></i></div>`;
  const koLine = w => `<span class="k">${esc(w.ko)}</span>${w.note ? `<span class="note">${esc(w.note)}</span>` : ""}`;

  function options(word) {
    const pool = shuffle(words.filter(w => w !== word)).slice(0, 3);
    return shuffle([word, ...pool]);
  }

  // ---------- speech (browser Korean voice) ----------
  let koVoice = null;
  function pickVoice() {
    if (!("speechSynthesis" in window)) return;
    const vs = speechSynthesis.getVoices();
    koVoice = vs.find(v => v.lang && v.lang.toLowerCase().startsWith("ko")) || null;
  }
  if ("speechSynthesis" in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR"; u.rate = 0.85;
    if (koVoice) u.voice = koVoice;
    speechSynthesis.speak(u);
  }
  window.speakWord = speak;

  // ---------- layout ----------
  function header(u) {
    const S = window.SITE || {};
    return `
      <a class="back" href="../../index.html">← All units</a>
      <div class="header">
        <div class="avatar">${esc(S.initials || "?")}</div>
        <div class="who"><b>${esc(S.author || "")}</b><span>${esc(S.subtitle || "")}</span></div>
        <div class="unit-tag"><b>${esc(u.name)}</b>${esc(u.level)}</div>
      </div>
      <nav class="tabs">${MODES.map(m => `<button class="tab" data-mode="${m.id}"><span class="ic">${m.ic}</span>${m.label}</button>`).join("")}</nav>
      <main id="view"></main>`;
  }

  function switchMode(mode) {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.mode === mode));
    ({ list: renderList, flash: startFlash, quiz: () => startQuiz(), spell: () => startSpell(), listen: () => startListen() })[mode]();
    window.scrollTo({ top: 0 });
  }

  // ---------- 1. word list ----------
  function renderList() {
    view.innerHTML = words.map((w, i) => `
      <div class="row">
        <div class="n">${i + 1}.</div>
        <div class="body"><div>${koLine(w)}</div><div class="m">${esc(w.en)} · ${esc(w.uz)}</div></div>
        <button class="speak" data-say="${esc(w.ko)}" aria-label="Pronounce">${SPEAKER}</button>
      </div>`).join("");
  }

  // ---------- 2. flashcards ----------
  function startFlash() { state = { order: words.slice(), i: 0, flipped: false }; renderFlash(); }
  function renderFlash() {
    const { order, i, flipped } = state, w = order[i], n = order.length;
    view.innerHTML = `
      <div class="meta"><span>${i + 1} / ${n}</span><button class="btn ghost small" id="shuf">🔀 Shuffle</button></div>
      ${bar(i + 1, n)}
      <div class="card flash" id="card">
        ${flipped
          ? `<div class="en">${esc(w.en)}</div><div class="uz">${esc(w.uz)}</div><div class="hint ko">${esc(w.ko)}</div>`
          : `<div class="big">${esc(w.ko)}</div>${w.note ? `<div class="hint ko">${esc(w.note)}</div>` : ""}
             <button class="btn ghost small" data-say="${esc(w.ko)}">🔊 Pronounce</button>
             <div class="hint">Tap the card to see the meaning</div>`}
      </div>
      <div class="btn-row">
        <button class="btn ghost" id="prev">← Prev</button>
        <button class="btn" id="next">Next →</button>
      </div>`;
    view.querySelector("#card").onclick = e => { if (e.target.closest("[data-say]")) return; state.flipped = !state.flipped; renderFlash(); };
    view.querySelector("#prev").onclick = () => { state.i = (i - 1 + n) % n; state.flipped = false; renderFlash(); };
    view.querySelector("#next").onclick = () => { state.i = (i + 1) % n; state.flipped = false; renderFlash(); };
    view.querySelector("#shuf").onclick = () => { state.order = shuffle(words); state.i = 0; state.flipped = false; renderFlash(); };
  }

  // ---------- shared multiple-choice engine (quiz + listening) ----------
  function startMC(kind, list = words) { state = { kind, order: shuffle(list), i: 0, right: 0, missed: [] }; renderMC(); }
  function renderMC() {
    const { kind, order, i, right } = state, w = order[i], n = order.length;
    const opts = options(w);
    const prompt = kind === "quiz"
      ? `<div class="prompt"><div class="big">${esc(w.ko)}</div></div>`
      : `<button class="big-speak" data-say="${esc(w.ko)}" aria-label="Play">${SPEAKER}</button>`;
    view.innerHTML = `
      <div class="meta"><span>Question ${i + 1}/${n}</span><span>Correct: ${right}</span></div>
      ${bar(i, n)}
      <div class="card">
        ${prompt}
        <div class="opts">${opts.map((o, k) => `<button class="opt" data-k="${k}">${esc(o.en)}<span class="uz">${esc(o.uz)}</span></button>`).join("")}</div>
      </div>`;
    if (kind === "listen") setTimeout(() => speak(w.ko), 250);
    view.querySelectorAll(".opt").forEach(b => b.onclick = () => {
      const chosen = opts[+b.dataset.k];
      view.querySelectorAll(".opt").forEach((x, k) => { x.disabled = true; if (opts[k] === w) x.classList.add("right"); });
      if (chosen === w) state.right++; else { b.classList.add("wrong"); state.missed.push(w); }
      if (kind === "quiz") speak(w.ko);
      setTimeout(() => { state.i++; state.i < n ? renderMC() : showResult(); }, chosen === w ? 700 : 1400);
    });
  }

  // ---------- 3. quiz / 5. listening ----------
  function startQuiz(list) { startMC("quiz", list); }
  function startListen(list) {
    startMC("listen", list);
    if (!("speechSynthesis" in window)) view.insertAdjacentHTML("beforeend", `<p class="voice-warn">This browser has no speech support. Try Chrome or Safari.</p>`);
  }

  // ---------- 4. spelling ----------
  function startSpell(list = words) { state = { kind: "spell", order: shuffle(list), i: 0, right: 0, missed: [], checked: false }; renderSpell(); }
  function renderSpell() {
    const { order, i, right } = state, w = order[i], n = order.length;
    state.checked = false;
    view.innerHTML = `
      <div class="meta"><span>Word ${i + 1}/${n}</span><span>Correct: ${right}</span></div>
      ${bar(i, n)}
      <div class="card">
        <div class="prompt"><div class="en">${esc(w.en)}</div><div class="uz">${esc(w.uz)}</div>${w.note ? `<div class="uz ko">${esc(w.note)}</div>` : ""}</div>
        <input class="spell-in" id="ans" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="한국어로 쓰세요" lang="ko">
        <div class="feedback" id="fb"></div>
        <div class="btn-row"><button class="btn" id="chk">Check</button></div>
      </div>`;
    const input = view.querySelector("#ans"), fb = view.querySelector("#fb"), btn = view.querySelector("#chk");
    input.focus();
    const go = () => {
      if (state.checked) { state.i++; return state.i < n ? renderSpell() : showResult(); }
      if (!input.value.trim()) return;
      state.checked = true; input.disabled = true;
      if (norm(input.value) === norm(w.ko)) { state.right++; fb.className = "feedback ok"; fb.textContent = "✓ Correct!"; }
      else { state.missed.push(w); fb.className = "feedback bad"; fb.innerHTML = `✗ Answer: <span class="ko">${esc(w.ko)}</span>`; }
      speak(w.ko);
      btn.textContent = state.i + 1 < n ? "Next →" : "See result";
      btn.focus();
    };
    btn.onclick = go;
    input.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing) go(); });
  }

  // ---------- result ----------
  function showResult() {
    const { kind, order, right, missed } = state, n = order.length, pct = Math.round((right / n) * 100);
    const msg = pct === 100 ? "Perfect! 🎉" : pct >= 80 ? "Great job!" : pct >= 50 ? "Good, keep practicing" : "Keep going, you'll get there";
    view.innerHTML = `
      <div class="card result">
        <div class="score">${right}/${n}</div>
        <h2>${msg}</h2>
        <div style="color:var(--muted)">${pct}% correct</div>
        <div class="btn-row">
          <button class="btn" id="again">Try again</button>
          ${missed.length ? `<button class="btn ghost" id="retry">Practice missed (${missed.length})</button>` : ""}
        </div>
      </div>
      ${missed.length ? `<div class="missed"><h3>Words to review</h3>${missed.map((w, i) => `
        <div class="row"><div class="n">${i + 1}.</div>
          <div class="body"><div>${koLine(w)}</div><div class="m">${esc(w.en)} · ${esc(w.uz)}</div></div>
          <button class="speak" data-say="${esc(w.ko)}">${SPEAKER}</button></div>`).join("")}</div>` : ""}`;
    const restart = list => ({ quiz: startQuiz, listen: startListen, spell: startSpell })[kind](list);
    view.querySelector("#again").onclick = () => restart(words);
    const r = view.querySelector("#retry"); if (r) r.onclick = () => restart(missed.slice());
  }

  // ---------- boot ----------
  window.loadUnit = function () {
    const u = window.UNIT;
    words = (u && u.words) || [];
    const S = window.SITE || {};
    document.title = `${u.level} · ${S.title || "Korean Vocab"}`;
    const root = document.getElementById("app");
    root.innerHTML = header(u);
    view = document.getElementById("view");
    if (!words.length) { view.innerHTML = `<div class="empty">No words yet. Add them to data.js.</div>`; return; }
    root.querySelector(".tabs").onclick = e => { const t = e.target.closest(".tab"); if (t) switchMode(t.dataset.mode); };
    root.addEventListener("click", e => { const s = e.target.closest("[data-say]"); if (s) { e.stopPropagation(); speak(s.dataset.say); } });
    switchMode("list");
  };
})();
