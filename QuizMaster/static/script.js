/* ===================================================================
   QuizMaster – static/script.js
   Full quiz engine: registration, selection, timer, live score,
   submit, results, history.  Talks to Flask REST API.
   =================================================================== */

"use strict";

/* ── Constants ─────────────────────────────────────────────────────────── */
const TIMER_MAX = 30;
const CIRCUMFERENCE = 2 * Math.PI * 20;   // r=20 in SVG

/* ── App State ──────────────────────────────────────────────────────────── */
const S = {
  student:    null,   // { id, name, email }
  quizId:     null,
  quizTitle:  "",
  questions:  [],     // array from API
  current:    0,      // 0-based index
  answers:    {},     // { question_id: "A"|"B"|"C"|"D" }
  liveScore:  0,      // incremented immediately on correct selection
  locked:     false,  // prevent re-selection after answer
  timerId:    null,
  secsLeft:   TIMER_MAX,
};

/* ── Tiny helpers ───────────────────────────────────────────────────────── */
const el = id => document.getElementById(id);
const esc = s => String(s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;")
  .replace(/>/g,"&gt;").replace(/"/g,"&quot;");

/* ── Page router ────────────────────────────────────────────────────────── */
const PAGES = ["home","register","select","quiz","results","history"];
function show(name) {
  PAGES.forEach(p => {
    const node = el("page-" + p);
    if (node) node.classList.toggle("active", p === name);
  });
  window.scrollTo(0, 0);
}

/* ── Toast ──────────────────────────────────────────────────────────────── */
let _toastT;
function toast(msg, ms = 2800) {
  const t = el("toast");
  t.textContent = msg;
  t.classList.add("visible");
  clearTimeout(_toastT);
  _toastT = setTimeout(() => t.classList.remove("visible"), ms);
}

/* ── API ────────────────────────────────────────────────────────────────── */
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/* ══════════════════════════════════════════════════════════════════════════
   HOME
   ══════════════════════════════════════════════════════════════════════════ */
el("btn-start-home").addEventListener("click", () => show("register"));
el("nav-logo").addEventListener("click", e => { e.preventDefault(); show("home"); });

/* ══════════════════════════════════════════════════════════════════════════
   REGISTRATION
   ══════════════════════════════════════════════════════════════════════════ */
el("form-register").addEventListener("submit", async e => {
  e.preventDefault();
  clearRegErr();

  const name  = el("inp-name").value.trim();
  const email = el("inp-email").value.trim();
  let ok = true;

  if (!name)            { setRegErr("err-name",  "Name is required"); ok = false; }
  if (!email)           { setRegErr("err-email", "Email is required"); ok = false; }
  else if (!validEmail(email)) { setRegErr("err-email", "Enter a valid email address"); ok = false; }
  if (!ok) return;

  const btn  = el("btn-register");
  const btxt = el("btn-register-text");
  btn.disabled = true;
  btxt.textContent = "Registering…";

  try {
    S.student = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({ name, email }),
    });
    el("nav-student-name").textContent = "Hi, " + S.student.name;
    toast("Welcome, " + S.student.name + "!");
    await loadQuizzes();
    el("select-welcome").textContent = "Hello " + S.student.name + " — pick a quiz to begin.";
    show("select");
  } catch (err) {
    el("register-api-error").textContent = err.message;
  } finally {
    btn.disabled = false;
    btxt.textContent = "Continue to Quiz Selection →";
  }
});

function setRegErr(id, msg) { el(id).textContent = msg; }
function clearRegErr() {
  ["err-name","err-email","register-api-error"].forEach(id => el(id).textContent = "");
}
function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

/* ══════════════════════════════════════════════════════════════════════════
   QUIZ SELECTION
   ══════════════════════════════════════════════════════════════════════════ */
async function loadQuizzes() {
  const grid = el("quiz-grid");
  grid.innerHTML = '<p class="empty-state">Loading quizzes…</p>';
  el("quiz-grid-error").textContent = "";

  try {
    const quizzes = await api("/api/quizzes");
    if (!quizzes.length) {
      grid.innerHTML = '<p class="empty-state">No quizzes available.</p>';
      return;
    }
    grid.innerHTML = "";
    quizzes.forEach(q => {
      const card = document.createElement("div");
      card.className = "quiz-card";
      card.innerHTML = `
        <div class="quiz-card-icon">📝</div>
        <div class="quiz-card-body">
          <h3>${esc(q.title)}</h3>
          <p>${esc(q.description || "")}</p>
        </div>
        <span class="quiz-card-arrow">→</span>`;
      card.addEventListener("click", () => startQuiz(q.id, q.title));
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = "";
    el("quiz-grid-error").textContent = "Could not load quizzes: " + err.message;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   START QUIZ
   ══════════════════════════════════════════════════════════════════════════ */
async function startQuiz(quizId, title) {
  try {
    const questions = await api("/api/quizzes/" + quizId + "/questions");
    if (!questions.length) { toast("This quiz has no questions!"); return; }

    S.quizId    = quizId;
    S.quizTitle = title;
    S.questions = questions;
    S.current   = 0;
    S.answers   = {};
    S.liveScore = 0;
    S.locked    = false;

    el("qh-quiz-name").textContent = title;
    show("quiz");
    renderQuestion();
  } catch (err) {
    toast("Failed to load quiz: " + err.message);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   RENDER QUESTION
   ══════════════════════════════════════════════════════════════════════════ */
function renderQuestion() {
  const q   = S.questions[S.current];
  const idx = S.current;
  const tot = S.questions.length;
  S.locked = false;

  // Header
  el("qh-counter").textContent = "Question " + (idx + 1) + " of " + tot;

  // Progress bar
  el("q-progress-fill").style.width = ((idx + 1) / tot * 100) + "%";

  // Live score
  el("live-score").textContent = S.liveScore;

  // Question text
  el("q-text").textContent = q.question_text;

  // Options
  const ul = el("q-options");
  ul.innerHTML = "";
  const labels = ["A","B","C","D"];
  const texts  = [q.option_a, q.option_b, q.option_c, q.option_d];

  texts.forEach((txt, i) => {
    const li = document.createElement("li");
    li.className = "q-opt";
    li.dataset.opt = labels[i];
    li.innerHTML = `<span class="opt-badge">${labels[i]}</span><span>${esc(txt)}</span>`;
    li.addEventListener("click", () => pickOption(li, labels[i]));
    ul.appendChild(li);
  });

  // Restore prior selection (if navigated back — not possible currently,
  // but keeps state correct)
  const prev = S.answers[q.id];
  if (prev) {
    const prLi = ul.querySelector('[data-opt="' + prev + '"]');
    if (prLi) prLi.classList.add("selected");
  }

  // Next / Submit buttons
  const isLast = idx === tot - 1;
  el("btn-next").style.display   = isLast ? "none" : "";
  el("btn-submit").style.display = isLast ? "" : "none";
  el("btn-next").disabled   = !S.answers[q.id];
  el("btn-submit").disabled = !S.answers[q.id];

  // Timer
  startTimer();
}

/* ══════════════════════════════════════════════════════════════════════════
   OPTION SELECTION
   ══════════════════════════════════════════════════════════════════════════ */
function pickOption(li, opt) {
  if (S.locked) return;

  // Prevent changing answer once selected (one attempt per question)
  const q = S.questions[S.current];
  if (S.answers[q.id]) return;  // already answered

  // Mark selected
  document.querySelectorAll(".q-opt").forEach(o => o.classList.remove("selected"));
  li.classList.add("selected");

  // Store answer
  S.answers[q.id] = opt;

  // Enable Next / Submit
  el("btn-next").disabled   = false;
  el("btn-submit").disabled = false;

  // Lock options — one attempt only
  lockOptions();
}

function lockOptions() {
  S.locked = true;
  document.querySelectorAll(".q-opt").forEach(o => o.classList.add("locked"));
}

/* ══════════════════════════════════════════════════════════════════════════
   TIMER
   ══════════════════════════════════════════════════════════════════════════ */
function startTimer() {
  stopTimer();
  S.secsLeft = TIMER_MAX;
  updateTimerUI(TIMER_MAX);

  S.timerId = setInterval(() => {
    S.secsLeft--;
    updateTimerUI(S.secsLeft);
    if (S.secsLeft <= 0) {
      stopTimer();
      onTimeOut();
    }
  }, 1000);
}

function stopTimer() { clearInterval(S.timerId); S.timerId = null; }

function updateTimerUI(s) {
  el("t-num").textContent = s;
  const offset = CIRCUMFERENCE * (1 - s / TIMER_MAX);
  const fg = el("t-fg");
  fg.style.strokeDashoffset = offset;
  fg.classList.remove("warn","danger");
  if      (s <= 5)  fg.classList.add("danger");
  else if (s <= 10) fg.classList.add("warn");
}

function onTimeOut() {
  lockOptions();
  toast("Time's up! Moving on…");
  setTimeout(advance, 1300);
}

/* ══════════════════════════════════════════════════════════════════════════
   NAVIGATION
   ══════════════════════════════════════════════════════════════════════════ */
el("btn-next").addEventListener("click", () => { stopTimer(); advance(); });
el("btn-submit").addEventListener("click", () => { stopTimer(); submitQuiz(); });
el("btn-skip").addEventListener("click", () => {
  stopTimer();
  // No answer recorded for this question → skip
  advance();
});

function advance() {
  const next = S.current + 1;
  if (next < S.questions.length) {
    S.current = next;
    renderQuestion();
  } else {
    submitQuiz();
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   SUBMIT QUIZ
   ══════════════════════════════════════════════════════════════════════════ */
async function submitQuiz() {
  stopTimer();
  show("results");

  // Loading state
  el("results-trophy").textContent   = "⏳";
  el("results-title").textContent    = "Calculating your score…";
  el("results-feedback").textContent = "";
  el("breakdown").innerHTML          = "";
  ["rc-score","rc-total","rc-pct","rc-correct"].forEach(id => el(id).textContent = "–");

  try {
    const result = await api("/api/quizzes/" + S.quizId + "/submit", {
      method: "POST",
      body: JSON.stringify({
        student_id: S.student.id,
        answers: S.answers,
      }),
    });
    renderResults(result);
  } catch (err) {
    el("results-title").textContent    = "Submission failed";
    el("results-feedback").textContent = err.message;
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   RENDER RESULTS
   ══════════════════════════════════════════════════════════════════════════ */
function renderResults(r) {
  const { score, total, percentage, breakdown } = r;

  // Trophy + feedback
  let trophy, title, feedback;
  if (percentage === 100) {
    trophy = "🏆"; title = "Perfect Score!";
    feedback = "Incredible! You answered every question correctly. You are a QuizMaster!";
  } else if (percentage >= 80) {
    trophy = "🎉"; title = "Excellent Work!";
    feedback = `You scored ${percentage}% — a fantastic result. Keep up the great work!`;
  } else if (percentage >= 60) {
    trophy = "👍"; title = "Good Job!";
    feedback = `You scored ${percentage}%. A solid performance. Review the questions you missed.`;
  } else if (percentage >= 40) {
    trophy = "📚"; title = "Keep Practicing!";
    feedback = `You scored ${percentage}%. Don't give up — revisit the topics and try again!`;
  } else {
    trophy = "💪"; title = "Don't Give Up!";
    feedback = `You scored ${percentage}%. Every expert was once a beginner. Keep studying!`;
  }

  el("results-trophy").textContent   = trophy;
  el("results-title").textContent    = title;
  el("results-feedback").textContent = feedback;
  el("rc-score").textContent   = score;
  el("rc-total").textContent   = total;
  el("rc-pct").textContent     = percentage + "%";
  el("rc-correct").textContent = score;

  // Build question → text map
  const qMap = {};
  S.questions.forEach(q => { qMap[q.id] = q.question_text; });

  // Breakdown
  const bd = el("breakdown");
  bd.innerHTML = "";
  breakdown.forEach((item, i) => {
    const div = document.createElement("div");
    div.className = "bd-item " + (item.is_correct ? "ok" : "fail");
    const givenLabel = item.given ? "Your answer: <strong>" + item.given + "</strong>"
                                  : "Your answer: <strong>Skipped</strong>";
    div.innerHTML = `
      <span class="bd-icon">${item.is_correct ? "✅" : "❌"}</span>
      <div class="bd-body">
        <strong>Q${i+1}. ${esc(qMap[item.question_id] || "Question")}</strong>
        <small>${givenLabel} &nbsp;·&nbsp; Correct: <strong>${item.correct}</strong></small>
      </div>`;
    bd.appendChild(div);
  });
}

/* ── Results button handlers ─────────────────────────────────────────────── */
el("btn-restart").addEventListener("click", () => startQuiz(S.quizId, S.quizTitle));
el("btn-new-quiz").addEventListener("click", () => show("select"));
el("btn-history").addEventListener("click", loadHistory);

/* ══════════════════════════════════════════════════════════════════════════
   HISTORY
   ══════════════════════════════════════════════════════════════════════════ */
async function loadHistory() {
  show("history");
  const wrap = el("history-wrap");
  wrap.innerHTML = '<p class="empty-state">Loading…</p>';

  try {
    const rows = await api("/api/students/" + S.student.id + "/results");
    if (!rows.length) {
      wrap.innerHTML = '<p class="empty-state">No results yet. Complete a quiz first!</p>';
      return;
    }
    let html = `
      <table class="hist-table">
        <thead><tr>
          <th>#</th><th>Date</th><th>Quiz</th>
          <th>Score</th><th>Percentage</th><th>Grade</th>
        </tr></thead><tbody>`;
    rows.forEach((r, i) => {
      const cls = r.percentage >= 80 ? "badge-pass"
                : r.percentage >= 50 ? "badge-avg"
                : "badge-fail";
      const grade = r.percentage >= 80 ? "Pass"
                  : r.percentage >= 50 ? "Average"
                  : "Fail";
      html += `
        <tr>
          <td>${i+1}</td>
          <td>${fmtDate(r.taken_at)}</td>
          <td>${esc(r.title)}</td>
          <td>${r.score} / ${r.total}</td>
          <td>${r.percentage}%</td>
          <td><span class="badge ${cls}">${grade}</span></td>
        </tr>`;
    });
    html += `</tbody></table>`;
    wrap.innerHTML = html;
  } catch (err) {
    wrap.innerHTML = `<p class="empty-state">Error: ${esc(err.message)}</p>`;
  }
}

el("btn-back-from-history").addEventListener("click", () => show("results"));
el("btn-home-from-history").addEventListener("click", () => show("home"));

/* ══════════════════════════════════════════════════════════════════════════
   UTILS
   ══════════════════════════════════════════════════════════════════════════ */
function fmtDate(iso) {
  if (!iso) return "–";
  try {
    return new Date(iso.replace(" ","T") + "Z")
      .toLocaleDateString(undefined, { day:"2-digit", month:"short", year:"numeric" });
  } catch { return iso; }
}
