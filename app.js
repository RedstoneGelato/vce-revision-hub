import { firebaseConfig, tutorUids } from "./config.js";

/* ---------- subjects ---------- */
const SUBJECTS = [
  { key: "chem", name: "Chemistry", cls: "c-chem" },
  { key: "eng", name: "English Language", cls: "c-eng" },
  { key: "acc", name: "Accounting", cls: "c-acc" },
  { key: "meth", name: "Mathematical Methods", cls: "c-meth" },
  { key: "gen", name: "General Mathematics", cls: "c-gen" },
];
const UNITS = [{ key: "12", name: "Units 1 & 2" }, { key: "34", name: "Units 3 & 4" }];
const UNIT_KEYS = SUBJECTS.flatMap((s) => UNITS.map((u) => s.key + u.key));
const content = {}; // uk -> parsed content file
const QS = {};      // qid -> {uk, topic, q}

/* ---------- small helpers ---------- */
const app = document.getElementById("app");
const show = (...nodes) => app.replaceChildren(...nodes.flat().filter(Boolean));

/* ---------- maths: render \( inline \) and \[ display \] LaTeX with KaTeX whenever the page changes ---------- */
// $ is not a delimiter, so dollar amounts in Accounting stay plain text.
const MATH_OPTS = { delimiters: [{ left: "\\[", right: "\\]", display: true }, { left: "\\(", right: "\\)", display: false }], throwOnError: false };
let mathFrame = 0;
const mathObserver = new MutationObserver(() => { if (!mathFrame) mathFrame = requestAnimationFrame(typeset); });
function typeset() {
  mathFrame = 0;
  if (!window.renderMathInElement) return; // CDN blocked: the raw LaTeX stays readable
  mathObserver.disconnect();
  window.renderMathInElement(app, MATH_OPTS);
  mathObserver.observe(app, { childList: true, subtree: true });
}
mathObserver.observe(app, { childList: true, subtree: true });
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "style") n.setAttribute("style", v);
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : String(c));
  return n;
}
const subjOf = (uk) => SUBJECTS.find((s) => uk.startsWith(s.key));
const unitName = (uk) => UNITS.find((u) => uk.endsWith(u.key)).name;
const ukLabel = (uk) => `${subjOf(uk).name} ${unitName(uk).replace("Units ", "")}`;
const today = () => { const d = new Date(); return Math.floor((d - d.getTimezoneOffset() * 6e4) / 864e5); };
const isoDay = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function toast(msg) {
  const t = el("div", { class: "toast", role: "status" }, msg);
  document.body.append(t); setTimeout(() => t.remove(), 2200);
}

/* ---------- progress state ---------- */
const LS = "vcehub.v1";
const IV = [0, 1, 2, 4, 7, 15, 30]; // days until next review for each box
const fresh = () => ({ v: 1, cards: {}, errors: {}, log: {}, updated: 0 });
function loadLocal() { try { const s = JSON.parse(localStorage.getItem(LS)); return s && s.v === 1 ? s : null; } catch { return null; } }
let state = loadLocal() || fresh();
let saveTimer = null;
function save() {
  state.updated = Date.now();
  try { localStorage.setItem(LS, JSON.stringify(state)); } catch { /* storage blocked: keep in memory */ }
  if (cloud && user) { clearTimeout(saveTimer); saveTimer = setTimeout(pushCloud, 1500); }
  updateBadge();
}
function grade(qid, ok) {
  const c = state.cards[qid] || { b: 0, r: 0, w: 0 };
  if (ok) { c.b = Math.min(c.b + 1, IV.length - 1); c.r++; c.due = today() + IV[c.b]; }
  else {
    c.b = 0; c.w++; c.due = today() + 1;
    const id = "e" + qid; const prev = state.errors[id];
    state.errors[id] = { qid, t: Date.now(), note: prev?.note || "", done: false, n: (prev?.n || 0) + 1 };
  }
  c.t = Date.now();
  state.cards[qid] = c;
  const day = isoDay(today());
  state.log[day] = (state.log[day] || 0) + 1;
  save();
}
function merge(a, b) {
  const out = fresh();
  for (const src of [a, b]) {
    for (const [k, v] of Object.entries(src.cards || {})) if (!out.cards[k] || (v.t || 0) > (out.cards[k].t || 0)) out.cards[k] = v;
    for (const [k, v] of Object.entries(src.errors || {})) if (!out.errors[k] || (v.t || 0) > (out.errors[k].t || 0)) out.errors[k] = v;
    for (const [k, v] of Object.entries(src.log || {})) out.log[k] = Math.max(out.log[k] || 0, v);
  }
  out.updated = Math.max(a.updated || 0, b.updated || 0);
  return out;
}
const dueList = () => Object.entries(state.cards).filter(([qid, c]) => QS[qid] && c.due <= today()).map(([qid]) => qid);
const openErrors = () => Object.entries(state.errors).filter(([, e]) => !e.done && QS[e.qid]);
function unitStats(uk) {
  const ids = Object.keys(QS).filter((q) => QS[q].uk === uk);
  let seen = 0, mastered = 0, r = 0, w = 0, due = 0;
  for (const id of ids) {
    const c = state.cards[id]; if (!c) continue;
    seen++; r += c.r; w += c.w; if (c.b >= 3) mastered++; if (c.due <= today()) due++;
  }
  return { total: ids.length, seen, mastered, due, acc: r + w ? Math.round((100 * r) / (r + w)) : null };
}
function summary() {
  const s = {};
  for (const uk of UNIT_KEYS) if (content[uk]) s[uk] = unitStats(uk);
  s.openErrors = openErrors().length;
  s.lastActive = Object.keys(state.log).sort().pop() || null;
  return s;
}

/* ---------- cloud sync (optional) ---------- */
let cloud = null, user = null;
async function pushCloud() {
  if (!cloud || !user) return;
  try { await cloud.save(user.uid, state, user, summary()); setSync("Saved to your account"); }
  catch (e) { setSync("Could not save to your account. Progress is still saved on this device."); console.error(e); }
}
let syncMsg = "";
function setSync(m) { syncMsg = m; const n = document.getElementById("sync-msg"); if (n) n.textContent = m; }
async function startCloud() {
  if (!firebaseConfig) return renderAccount();
  try {
    const { initSync } = await import("./sync.js");
    cloud = await initSync(firebaseConfig, async (u) => {
      user = u;
      if (u) {
        try {
          const remote = await cloud.load(u.uid);
          if (remote) state = merge(state, remote);
          try { localStorage.setItem(LS, JSON.stringify(state)); } catch {}
          await pushCloud();
        } catch (e) { setSync("Signed in, but your saved progress could not be loaded."); console.error(e); }
      }
      renderAccount(); route();
    });
  } catch (e) { console.error(e); cloud = null; }
  renderAccount();
}
const isTutor = () => !!(user && tutorUids.includes(user.uid));
function renderAccount() {
  const box = document.getElementById("account"); box.replaceChildren();
  document.getElementById("tutor-link").hidden = !isTutor();
  if (!firebaseConfig || !cloud) {
    box.append(el("span", { class: "muted small" }, "Progress saved on this device"));
  } else if (user) {
    if (user.photo) box.append(el("img", { src: user.photo, alt: "" }));
    box.append(el("span", {}, user.name), el("button", { class: "btn small", onclick: () => cloud.signOut() }, "Sign out"));
  } else {
    box.append(el("button", { class: "btn small primary", onclick: async () => {
      try { await cloud.signIn(); } catch (e) { toast("Sign-in was cancelled or blocked. Allow pop-ups and try again."); }
    } }, "Sign in with GitHub"));
  }
}

/* ---------- content loading ---------- */
async function loadContent() {
  await Promise.all(UNIT_KEYS.map(async (uk) => {
    try {
      const r = await fetch(`content/${uk}.json`, { cache: "no-cache" });
      if (!r.ok) return;
      const data = await r.json();
      content[uk] = data;
      for (const a of data.aos) for (const t of a.topics) t.qs.forEach((q, i) => { QS[`${uk}.${t.id}.${i}`] = { uk, topic: t, q }; });
    } catch (e) { console.error("Content file failed:", uk, e); }
  }));
}
const topicQids = (uk, t) => t.qs.map((_, i) => `${uk}.${t.id}.${i}`);

/* ---------- quiz engine ---------- */
function runQuiz(qids, title, back) {
  if (!qids.length) { show(el("div", { class: "panel" }, el("p", {}, "No questions to show."), back && el("a", { class: "btn", href: back }, "Back"))); return; }
  let i = 0, right = 0; const missed = [];
  const box = el("section", { class: "quiz", "aria-live": "polite" });
  show(el("div", { class: "crumbs" }, back ? el("a", { href: back }, "← Back") : null), el("h1", {}, title), box);
  function showQ() {
    const qid = qids[i], { uk, topic, q } = QS[qid], s = subjOf(uk);
    box.className = "quiz " + s.cls;
    const bar = el("div", { class: "progress-line" }, el("i", { style: `width:${(100 * i) / qids.length}%` }));
    const head = el("div", { class: "qhead" }, el("span", {}, el("span", { class: "qtag" }, ukLabel(uk)), " · ", topic.title), el("span", {}, `${i + 1} of ${qids.length}`));
    const qtext = el("p", { class: "qtext" }, q.q);
    const area = el("div", { class: "opts" });
    const after = el("div", { class: "row" });
    const next = () => { i++; i < qids.length ? showQ() : done(); };
    const nextBtn = el("button", { class: "btn primary", onclick: next }, i + 1 < qids.length ? "Next question" : "See results");
    if (q.t === "m") {
      const order = shuffle([...q.o.keys()]); // options shuffled each time so the answer letter can't be memorised
      const correctPos = order.indexOf(q.a);
      order.forEach((k, pos) => area.append(el("button", { class: "opt", onclick: (ev) => {
        const ok = k === q.a;
        [...area.children].forEach((b, j) => { b.disabled = true; if (j === correctPos) b.classList.add("right"); });
        if (!ok) { ev.currentTarget.classList.add("wrong"); missed.push(qid); } else right++;
        grade(qid, ok);
        area.after(el("div", { class: "feedback " + (ok ? "ok" : "no") }, el("b", {}, ok ? "Correct." : `Not quite. The answer is ${"ABCDEF"[correctPos]}: ${q.o[q.a]}`), q.e || ""));
        after.append(nextBtn); nextBtn.focus();
      } }, el("span", { class: "k" }, "ABCDEF"[pos]), el("span", {}, q.o[k]))));
    } else {
      const reveal = el("button", { class: "btn primary", onclick: () => {
        reveal.remove();
        area.append(el("div", { class: "answer" }, el("b", {}, "Answer: "), q.a, q.e ? "\n\n" + q.e : ""));
        const rate = (ok) => () => { ok ? right++ : missed.push(qid); grade(qid, ok); next(); };
        after.append(el("span", { class: "muted small" }, "Did you get it?"),
          el("button", { class: "btn", onclick: rate(false) }, "Not yet"),
          el("button", { class: "btn primary", onclick: rate(true) }, "Got it"));
        after.querySelector(".btn.primary").focus();
      } }, "Show answer");
      area.append(el("p", { class: "muted small" }, "Answer in your head or on paper first."));
      after.append(reveal);
    }
    box.replaceChildren(bar, head, qtext, area, after);
  }
  function done() {
    const pct = Math.round((100 * right) / qids.length);
    box.className = "quiz";
    box.replaceChildren(
      el("h2", {}, `${right} of ${qids.length} correct (${pct}%)`),
      el("p", { class: "muted" }, missed.length ? `${missed.length} question${missed.length > 1 ? "s" : ""} went to your error log and will come back in review tomorrow.` : "Clean sweep. These questions will come back later so they stick."),
      el("div", { class: "row" },
        missed.length ? el("button", { class: "btn primary", onclick: () => runQuiz(shuffle([...missed]), "Retry missed questions", back) }, "Retry the ones I missed") : null,
        el("a", { class: "btn", href: "#errors" }, "Open error log"),
        back ? el("a", { class: "btn", href: back }, "Back") : el("a", { class: "btn", href: "#home" }, "Home")));
  }
  showQ();
}

/* ---------- views ---------- */
const pbar = (tried, mastered, total) => el("span", { class: "bar", "aria-hidden": "true" },
  el("i", { class: "tried", style: `width:${total ? (100 * tried) / total : 0}%` }), el("i", { style: `width:${total ? (100 * mastered) / total : 0}%` }));
function viewHome() {
  const due = dueList().length, errs = openErrors().length;
  const week = Object.entries(state.log).filter(([d]) => d >= isoDay(today() - 6)).reduce((a, [, n]) => a + n, 0);
  const mastered = Object.values(state.cards).filter((c) => c.b >= 3).length;
  const grid = el("div", { class: "grid" }, SUBJECTS.map((s) => el("article", { class: "subj " + s.cls },
    el("h2", {}, s.name),
    el("div", { class: "units" }, UNITS.map((u) => {
      const uk = s.key + u.key; if (!content[uk]) return el("p", { class: "muted small" }, `${u.name}: content not loaded`);
      const st = unitStats(uk);
      return el("a", { class: "unit", href: `#u-${uk}` },
        el("span", {}, el("strong", {}, u.name), el("br"), el("span", { class: "muted small" }, `${st.seen}/${st.total} tried · ${st.mastered} mastered${st.due ? ` · ${st.due} due` : ""}`)),
        pbar(st.seen, st.mastered, st.total));
    })))));
  show(
    el("section", { class: "hello" },
      el("div", {}, el("h1", {}, "What are we studying today?"), el("p", { class: "muted" }, "Learn a topic, then test yourself. Anything you miss comes back in Review until it sticks.")),
      el("div", { class: "stats" },
        el("div", { class: "stat" }, el("b", {}, due), el("span", {}, "Due today")),
        el("div", { class: "stat" }, el("b", {}, week), el("span", {}, "Answered this week")),
        el("div", { class: "stat" }, el("b", {}, Object.keys(state.cards).length), el("span", {}, "Questions tried")),
        el("div", { class: "stat" }, el("b", {}, mastered), el("span", {}, "Mastered")),
        el("div", { class: "stat" }, el("b", {}, errs), el("span", {}, "Open errors")))),
    due ? el("div", { class: "panel" }, el("p", {}, `You have ${due} question${due > 1 ? "s" : ""} due for review. Start there: it is the fastest way to remember more.`), el("div", { class: "row" }, el("a", { class: "btn primary", href: "#review" }, "Start review"))) : null,
    grid,
    el("div", { class: "notice" }, "How to use this: 1. Read a topic’s key points and explain them out loud. 2. Practise its questions without notes. 3. Do Review every day (5–10 minutes). 4. Before an exam, use Mixed quiz across topics and redo your error log."));
}
function viewUnit(uk) {
  const c = content[uk]; if (!c) return notFound();
  const s = subjOf(uk), st = unitStats(uk);
  const all = c.aos.flatMap((a) => a.topics.flatMap((t) => topicQids(uk, t)));
  show(
    el("div", { class: "crumbs" }, el("a", { href: "#home" }, "Subjects"), " / ", s.name),
    el("section", { class: "hello " + s.cls },
      el("div", {}, el("h1", {}, `${s.name} ${unitName(uk)}`), el("p", { class: "muted" }, `${st.total} questions · ${st.seen} tried · ${st.mastered} mastered${st.acc != null ? ` · ${st.acc}% correct so far` : ""}`)),
      el("div", { class: "row" }, el("button", { class: "btn primary", onclick: () => runQuiz(shuffle([...all]).slice(0, 20), `${s.name} ${unitName(uk)}: mixed 20`, `#u-${uk}`) }, "Quiz 20 from this unit"))),
    ...c.aos.map((a) => el("section", { class: "aos " + s.cls }, el("h3", {}, a.name),
      el("div", { class: "topics" }, a.topics.map((t) => {
        const ids = topicQids(uk, t), n = ids.filter((q) => state.cards[q]).length, m = ids.filter((q) => state.cards[q]?.b >= 3).length, d = ids.filter((q) => state.cards[q] && state.cards[q].due <= today()).length;
        return el("a", { class: "topic", href: `#t-${uk}-${t.id}` }, el("h3", {}, t.title),
          el("div", { class: "meta" }, el("span", {}, `${n}/${ids.length} tried · ${m} mastered${d ? ` · ${d} due` : ""}`), pbar(n, m, ids.length)));
      })))));
}
function viewTopic(uk, tid) {
  const c = content[uk]; const t = c && c.aos.flatMap((a) => a.topics).find((x) => x.id === tid); if (!t) return notFound();
  const s = subjOf(uk), ids = topicQids(uk, t);
  show(
    el("div", { class: "crumbs" }, el("a", { href: "#home" }, "Subjects"), " / ", el("a", { href: `#u-${uk}` }, `${s.name} ${unitName(uk)}`), " / ", t.title),
    el("h1", {}, t.title),
    el("section", { class: "learn " + s.cls }, el("h2", {}, "Key points"), el("ul", {}, t.points.map((p) => el("li", {}, p))),
      t.explain ? el("p", { class: "explain" }, el("b", {}, "Explain it back: "), t.explain) : null),
    el("div", { class: "row" },
      el("button", { class: "btn primary", onclick: () => runQuiz(shuffle([...ids]), t.title, `#t-${uk}-${tid}`) }, `Practise ${ids.length} questions`),
      el("a", { class: "btn", href: `#u-${uk}` }, "All topics")));
}
function viewReview() {
  const due = shuffle(dueList());
  if (!due.length) {
    const seen = Object.keys(state.cards).length;
    show(el("h1", {}, "Review"), el("div", { class: "panel" },
      el("p", {}, seen ? "Nothing is due today. Nice work." : "Nothing to review yet. Practise a topic first; questions come back here on a schedule."),
      el("p", { class: "muted small" }, "Questions you get right come back after 1, 2, 4, 7, 15 then 30 days. Questions you miss come back tomorrow."),
      el("div", { class: "row" }, el("a", { class: "btn primary", href: "#mix" }, "Do a mixed quiz"), el("a", { class: "btn", href: "#home" }, "Pick a topic"))));
    return;
  }
  runQuiz(due.slice(0, 30), `Review: ${Math.min(due.length, 30)} due question${due.length > 1 ? "s" : ""}`, "#home");
}
function viewMix() {
  const loaded = UNIT_KEYS.filter((uk) => content[uk]);
  const boxes = el("div", { class: "check" }, loaded.map((uk) => el("label", {}, el("input", { type: "checkbox", value: uk, id: "mix-" + uk }), ukLabel(uk))));
  const num = el("select", { id: "mix-n" }, [10, 20, 30, 50].map((n) => el("option", { value: n, selected: n === 20 }, `${n} questions`)));
  const only = el("input", { type: "checkbox", id: "mix-missed" });
  const go = () => {
    const pick = [...boxes.querySelectorAll("input:checked")].map((b) => b.value);
    if (!pick.length) return toast("Tick at least one subject.");
    let ids = Object.keys(QS).filter((q) => pick.includes(QS[q].uk));
    if (only.checked) ids = ids.filter((q) => state.cards[q]?.w > 0);
    if (!ids.length) return toast("No questions match. Untick “only ones I’ve missed”.");
    runQuiz(shuffle(ids).slice(0, +num.value), "Mixed quiz", "#mix");
  };
  show(el("h1", {}, "Mixed quiz"),
    el("p", { class: "muted" }, "Mixing topics makes you choose the method yourself, just like the exam."),
    el("div", { class: "panel" }, el("h3", {}, "Subjects"), boxes,
      el("div", { class: "row" }, num, el("label", { class: "row small" }, only, "Only questions I’ve missed before")),
      el("div", { class: "row" }, el("button", { class: "btn primary", onclick: go }, "Start"))));
}
function viewErrors() {
  const showDone = location.hash === "#errors-all";
  const list = Object.entries(state.errors).filter(([, e]) => QS[e.qid] && (showDone || !e.done)).sort((a, b) => b[1].t - a[1].t);
  const items = list.map(([id, e]) => {
    const { uk, topic, q } = QS[e.qid], s = subjOf(uk);
    const note = el("textarea", { id: "note-" + id, placeholder: "Why did I get this wrong? What will I do differently?", "aria-label": "Note" });
    note.value = e.note || "";
    let t; note.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { state.errors[id].note = note.value; save(); }, 600); });
    const ans = q.t === "m" ? q.o[q.a] : q.a;
    return el("article", { class: "panel err " + s.cls },
      el("div", { class: "qhead" }, el("span", {}, el("span", { class: "qtag" }, ukLabel(uk)), " · ", topic.title), el("span", {}, `Missed ${e.n}×${e.done ? " · fixed" : ""}`)),
      el("p", { class: "qtext" }, q.q),
      el("details", {}, el("summary", {}, "Show answer"), el("p", { class: "answer" }, ans + (q.e ? "\n\n" + q.e : ""))),
      note,
      el("div", { class: "row" },
        el("button", { class: "btn small primary", onclick: () => runQuiz([e.qid], "Redo one question", "#errors") }, "Redo it"),
        el("button", { class: "btn small", onclick: () => { state.errors[id].done = !e.done; save(); viewErrors(); } }, e.done ? "Reopen" : "Mark fixed")));
  });
  show(el("h1", {}, "Error log"),
    el("p", { class: "muted" }, "Every question you miss lands here. Write why you missed it, redo it, then mark it fixed. Before exams, redo the whole list."),
    el("div", { class: "row" }, el("a", { class: "btn small", href: showDone ? "#errors" : "#errors-all" }, showDone ? "Hide fixed" : "Show fixed too"),
      list.length ? el("button", { class: "btn small primary", onclick: () => runQuiz(shuffle(list.map(([, e]) => e.qid)), "Redo error log", "#errors") }, `Redo all ${list.length}`) : null),
    ...(items.length ? items : [el("div", { class: "panel" }, el("p", {}, "No open errors. Questions you get wrong will appear here."))]));
}
function viewProgress() {
  const rows = UNIT_KEYS.filter((uk) => content[uk]).map((uk) => {
    const st = unitStats(uk);
    return el("tr", {}, el("td", {}, ukLabel(uk)), el("td", {}, st.total), el("td", {}, st.seen), el("td", {}, st.mastered), el("td", {}, st.acc == null ? "–" : st.acc + "%"), el("td", {}, st.due));
  });
  const days = [...Array(14)].map((_, k) => today() - 13 + k);
  const max = Math.max(1, ...days.map((d) => state.log[isoDay(d)] || 0));
  const code = el("textarea", { id: "import-code", placeholder: "Paste a progress code here", "aria-label": "Progress code" });
  show(el("h1", {}, "Progress"),
    el("section", { class: "panel" }, el("h3", {}, "By subject"),
      el("div", { class: "tablewrap" }, el("table", {}, el("thead", {}, el("tr", {}, ["Subject", "Questions", "Tried", "Mastered", "Correct", "Due"].map((h) => el("th", {}, h)))), el("tbody", {}, rows))),
      el("p", { class: "muted small" }, "Mastered means answered correctly at least 3 times in a row on schedule.")),
    el("section", { class: "panel" }, el("h3", {}, "Questions answered, last 14 days"),
      el("div", { class: "chart", role: "img", "aria-label": "Daily questions answered" }, days.map((d) => { const n = state.log[isoDay(d)] || 0; return el("div", { style: `height:${(100 * n) / max}%`, title: `${isoDay(d)}: ${n}` }); })),
      el("div", { class: "chart-labels" }, days.map((d) => el("span", {}, new Date(d * 864e5).getUTCDate())))),
    el("section", { class: "panel" }, el("h3", {}, "Account and backup"),
      el("p", { id: "sync-msg", class: "muted" }, user ? (syncMsg || "Signed in. Progress saves to your GitHub account.") : firebaseConfig ? "Not signed in. Progress is saved on this device only. Sign in with GitHub to keep it across devices." : "Progress is saved in this browser. Use a progress code to move it or send it to your tutor."),
      user ? el("p", { class: "small" }, "Your account ID: ", el("code", {}, user.uid)) : null,
      el("div", { class: "row" },
        el("button", { class: "btn small", onclick: async () => {
          const s = btoa(unescape(encodeURIComponent(JSON.stringify(state))));
          try { await navigator.clipboard.writeText(s); toast("Progress code copied"); } catch { code.value = s; code.select(); toast("Copy the code from the box"); }
        } }, "Copy progress code")),
      code,
      el("div", { class: "row" }, el("button", { class: "btn small", onclick: () => {
        try { const s = JSON.parse(decodeURIComponent(escape(atob(code.value.trim())))); if (s.v !== 1) throw 0; state = merge(state, s); save(); toast("Progress merged"); viewProgress(); }
        catch { toast("That code didn’t work. Copy it again in full."); }
      } }, "Merge a progress code"))));
}
async function viewTutor() {
  if (!isTutor()) return notFound();
  show(el("h1", {}, "Tutor view"), el("p", { class: "muted" }, "Loading students…"));
  let users = [];
  try { users = await cloud.listAll(); } catch (e) { app.append(el("p", {}, "Could not load students. Check firestore.rules includes your account ID.")); return; }
  show(el("h1", {}, "Tutor view"), el("p", { class: "muted" }, `${users.length} account${users.length === 1 ? "" : "s"} with saved progress.`),
    ...users.map((u) => {
      const s = u.summary || {};
      return el("section", { class: "panel" }, el("h3", {}, u.name || u.uid),
        el("p", { class: "muted small" }, `Last active ${s.lastActive || "never"} · ${s.openErrors ?? 0} open errors`),
        el("div", { class: "tablewrap" }, el("table", {}, el("thead", {}, el("tr", {}, ["Subject", "Tried", "Mastered", "Correct", "Due"].map((h) => el("th", {}, h)))),
          el("tbody", {}, UNIT_KEYS.filter((uk) => s[uk]).map((uk) => el("tr", {}, el("td", {}, ukLabel(uk)), el("td", {}, `${s[uk].seen}/${s[uk].total}`), el("td", {}, s[uk].mastered), el("td", {}, s[uk].acc == null ? "–" : s[uk].acc + "%"), el("td", {}, s[uk].due)))))));
    }));
}
function notFound() { show(el("h1", {}, "Page not found"), el("a", { class: "btn", href: "#home" }, "Go to subjects")); }

/* ---------- router ---------- */
function updateBadge() { const n = dueList().length, b = document.getElementById("due-badge"); b.hidden = !n; b.textContent = n; }
function route() {
  const h = (location.hash || "#home").slice(1);
  const navKey = h.startsWith("errors") ? "errors" : (h.startsWith("u-") || h.startsWith("t-")) ? "home" : h;
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("on", a.dataset.nav === navKey));
  let m;
  if (h === "home") viewHome();
  else if ((m = h.match(/^u-(\w+?\d\d)$/))) viewUnit(m[1]);
  else if ((m = h.match(/^t-(\w+?\d\d)-(.+)$/))) viewTopic(m[1], m[2]);
  else if (h === "review") viewReview();
  else if (h === "mix") viewMix();
  else if (h === "errors" || h === "errors-all") viewErrors();
  else if (h === "progress") viewProgress();
  else if (h === "tutor") viewTutor();
  else notFound();
  updateBadge();
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", route);
// A link to the page you are already on fires no hashchange (e.g. Back after a quiz), so re-render by hand.
document.addEventListener("click", (e) => { const a = e.target.closest?.("a[href^='#']"); if (a && a.getAttribute("href") === (location.hash || "#home")) route(); });
window.addEventListener("storage", (e) => { if (e.key === LS) { state = loadLocal() || state; updateBadge(); } });

await loadContent();
route();
startCloud();
