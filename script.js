/* ===================================================================
   QuizMaster – script.js
   Frontend logic: navigation, registration, quiz flow, timer, scoring
   =================================================================== */

const API = "";          // Same origin (Flask serves index.html at /)
const TIMER_SECONDS = 30;
const CIRCUMFERENCE = 2 * Math.PI * 18;  // r=18 from SVG

/* ── State ─────────────────────────────────────────────────────────────── */
let state = {
  student: null,          // { id, name, email }
  quizId: null,
  quizTitle: "",
  questions: [],          // raw from API (no correct_option)
  current: 0,             // current question index
  answers: {},            // { question_id: "A" | "B" | "C" | "D" }
  timerInterval: null,
  secondsLeft: TIMER_SECONDS,
  locked: false,          // disable options after answer/timeout
};

/* ── DOM shortcuts ─────────────────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const pages = {
  home:     $("page-home"),
  register: $("page-register"),
  select:   $("page-select"),
  quiz:     $("page-quiz"),
  results:  $("page-results"),
  history:  $("page-history"),
};

function showPage(name) {
  Object.values(pages).forEach(p => p.classList.remove("active"));
  pages[name].classList.add("active");
  window.scrollTo(0, 0);
}

/* ── Toast ─────────────────────────────────────────────────────────────── */
let toastTimer;
function toast(msg, duration = 2800) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), duration);
}

/* ── API helpers ────────────────────────────────────────────────────────── */
async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/* ═══════════════════════════════════════════════════════════════════════
   HOME PAGE
   ═══════════════════════════════════════════════════════════════════════ */
$("btn-start-home").addEventListener("click", () => showPage("register"));

/* ═══════════════════════════════════════════════════════════════════════
   REGISTRATION
   ═══════════════════════════════════════════════════════════════════════ */
$("form-register").addEventListener("submit", async e => {
  e.preventDefault();
  clearRegisterErrors();

  const name  = $("inp-name").value.trim();
  const email = $("inp-email").value.trim();
  let valid = true;

  if (!name) { showFieldError("err-name", "Name is required"); valid = false; }
  if (!email) { showFieldError("err-email", "Email is required"); valid = false; }
  else if (!isValidEmail(email)) { showFieldError("err-email", "Enter a valid email"); valid = false; }
  if (!valid) return;

  const btn  = $("btn-register");
  const btxt = $("btn-register-text");
  btn.disabled = true;
  btxt.textContent = "Registering…";

  try {
    state.student = await apiFetch("/api/register", {
      method: "POST",
      body: JSON.stringify({ name, email }),
    });
    toast(`Welcome, ${state.student.name}! 🎉`);
    await loadQuizzes();
    showPage("select");
  } catch (err) {
    $("register-error").textContent = err.message;
  } finally {
    btn.disabled = false;
    btxt.textContent = "Continue to Quiz Selection →";
  }
});

function showFieldError(id, msg) { $(id).textContent = msg; }
function clearRegisterErrors() {
  $("err-name").textContent = "";
  $("err-email").textContent = "";
  $("register-error").textContent = "";
}
function isValidEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

/* ═══════════════════════════════════════════════════════════════════════
   QUIZ SELECTION
   ═══════════════════════════════════════════════════════════════════════ */
async function loadQuizzes() {
  const list = $("quiz-list");
  list.innerHTML = '<p class="empty">Loading quizzes…</p>';
  try {
    const quizzes = await apiFetch("/api/quizzes");
    if (!quizzes.length) {
      list.innerHTML = '<p class="empty">No quizzes available.</p>';
      return;
    }
    list.innerHTML = "";
    quizzes.forEach(q => {
      const card = document.createElement("div");
      card.className = "quiz-card";
      card.innerHTML = `
        <div class="quiz-card-info">
          <h3>${escapeHtml(q.title)}</h3>
          <p>${escapeHtml(q.description || "")}</p>
        </div>
        <span class="quiz-card-arrow">→</span>`;
      card.addEventListener("click", () => startQuiz(q.id, q.title));
      list.appendChild(card);
    });
  } catch (err) {
    list.innerHTML = "";
    $("quiz-list-error").textContent = "Could not load quizzes: " + err.message;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   QUIZ FLOW
   ═══════════════════════════════════════════════════════════════════════ */
async function startQuiz(quizId, title) {
  try {
    const questions = await apiFetch(`/api/quizzes/${quizId}/questions`);
    if (!questions.length) { toast("No questions in this quiz!"); return; }

    // Reset state
    state.quizId    = quizId;
    state.quizTitle = title;
    state.questions = questions;
    state.current   = 0;
    state.answers   = {};
    state.locked    = false;

    $("quiz-title-bar").textContent = title;
    showPage("quiz");
    renderQuestion();
  } catch (err) {
    toast("Failed to load quiz: " + err.message);
  }
}

function renderQuestion() {
  const q   = state.questions[state.current];
  const idx = state.current;
  const tot = state.questions.length;
  state.locked = false;

  // Progress + counter
  $("question-counter").textContent = `Question ${idx + 1} of ${tot}`;
  $("progress-fill").style.width = `${((idx + 1) / tot) * 100}%`;

  // Question text
  $("question-text").textContent = q.question_text;

  // Options
  const opts = $("options-list");
  opts.innerHTML = "";
  const labels = ["A", "B", "C", "D"];
  const values = [q.option_a, q.option_b, q.option_c, q.option_d];

  values.forEach((text, i) => {
    const li = document.createElement("li");
    li.className = "option-item";
    li.dataset.option = labels[i];
    li.innerHTML = `<span class="option-label">${labels[i]}</span><span>${escapeHtml(text)}</span>`;
    li.addEventListener("click", () => selectOption(li, labels[i]));
    opts.appendChild(li);
  });

  // Re-apply previous selection if navigating back
  const prev = state.answers[q.id];
  if (prev) {
    const prevLi = opts.querySelector(`[data-option="${prev}"]`);
    if (prevLi) prevLi.classList.add("selected");
  }

  // Next button
  $("btn-next").disabled = !state.answers[q.id];

  // Timer
  startTimer();
}

function selectOption(el, option) {
  if (state.locked) return;
  const q = state.questions[state.current];

  // Deselect all, select chosen
  document.querySelectorAll(".option-item").forEach(o => o.classList.remove("selected"));
  el.classList.add("selected");
  state.answers[q.id] = option;
  $("btn-next").disabled = false;
}

/* ── Timer ─────────────────────────────────────────────────────────────── */
function startTimer() {
  clearInterval(state.timerInterval);
  state.secondsLeft = TIMER_SECONDS;
  updateTimerUI(TIMER_SECONDS);

  state.timerInterval = setInterval(() => {
    state.secondsLeft--;
    updateTimerUI(state.secondsLeft);
    if (state.secondsLeft <= 0) {
      clearInterval(state.timerInterval);
      autoAdvance();
    }
  }, 1000);
}

function stopTimer() { clearInterval(state.timerInterval); }

function updateTimerUI(sec) {
  $("timer-display").textContent = sec;
  const ring = $("ring-fg");
  const offset = CIRCUMFERENCE * (1 - sec / TIMER_SECONDS);
  ring.style.strokeDashoffset = offset;

  ring.classList.remove("warning", "danger");
  if (sec <= 5)       ring.classList.add("danger");
  else if (sec <= 10) ring.classList.add("warning");
}

function autoAdvance() {
  // Lock options and briefly show time-out, then advance
  state.locked = true;
  document.querySelectorAll(".option-item").forEach(o => o.classList.add("disabled"));
  toast("⏰ Time's up!");
  setTimeout(() => advanceQuestion(), 1200);
}

/* ── Navigation ─────────────────────────────────────────────────────────── */
$("btn-next").addEventListener("click", () => {
  stopTimer();
  advanceQuestion();
});

$("btn-skip").addEventListener("click", () => {
  stopTimer();
  // Record skipped as no answer (already absent from state.answers)
  advanceQuestion();
});

function advanceQuestion() {
  const next = state.current + 1;
  if (next < state.questions.length) {
    state.current = next;
    renderQuestion();
  } else {
    submitQuiz();
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   SUBMIT & RESULTS
   ═══════════════════════════════════════════════════════════════════════ */
async function submitQuiz() {
  stopTimer();
  showPage("results");
  // Show loading state while waiting for backend
  $("results-badge").textContent   = "⏳";
  $("results-heading").textContent = "Calculating…";
  $("results-feedback").textContent = "";
  $("breakdown-list").innerHTML    = "";
  $("res-score").textContent  = "–";
  $("res-total").textContent  = "–";
  $("res-pct").textContent    = "–";
  $("res-correct").textContent = "–";

  try {
    // Convert question IDs to strings for the API
    const answersPayload = {};
    Object.entries(state.answers).forEach(([k, v]) => { answersPayload[k] = v; });

    const result = await apiFetch(`/api/quizzes/${state.quizId}/submit`, {
      method: "POST",
      body: JSON.stringify({
        student_id: state.student.id,
        answers: answersPayload,
      }),
    });

    renderResults(result);
  } catch (err) {
    $("results-heading").textContent = "Submission failed";
    $("results-feedback").textContent = err.message;
    toast("Error: " + err.message);
  }
}

function renderResults(result) {
  const { score, total, percentage, breakdown } = result;

  // Badge + heading
  let badge, heading, feedback;
  if (percentage === 100) {
    badge = "🏆"; heading = "Perfect Score!";
    feedback = "Outstanding! You answered every question correctly. You're a champion!";
  } else if (percentage >= 80) {
    badge = "🎉"; heading = "Excellent Work!";
    feedback = `You scored ${percentage}%. Fantastic performance – keep it up!`;
  } else if (percentage >= 60) {
    badge = "👍"; heading = "Good Job!";
    feedback = `You scored ${percentage}%. A solid effort. Review the questions you missed.`;
  } else if (percentage >= 40) {
    badge = "📚"; heading = "Keep Practicing!";
    feedback = `You scored ${percentage}%. Don't give up – review the topics and try again.`;
  } else {
    badge = "💪"; heading = "Don't Give Up!";
    feedback = `You scored ${percentage}%. With more practice you'll improve significantly!`;
  }

  $("results-badge").textContent   = badge;
  $("results-heading").textContent = heading;
  $("results-feedback").textContent = feedback;
  $("res-score").textContent   = score;
  $("res-total").textContent   = total;
  $("res-pct").textContent     = `${percentage}%`;
  $("res-correct").textContent = score;

  // Breakdown
  const bl = $("breakdown-list");
  bl.innerHTML = "";

  // Map question id → question text
  const qMap = {};
  state.questions.forEach(q => { qMap[q.id] = q.question_text; });

  breakdown.forEach((item, i) => {
    const div = document.createElement("div");
    div.className = `breakdown-item ${item.is_correct ? "ok" : "fail"}`;
    const icon = item.is_correct ? "✅" : "❌";
    const givenText = item.given
      ? `Your answer: <strong>${item.given}</strong>`
      : `Your answer: <strong>Skipped</strong>`;
    div.innerHTML = `
      <span class="breakdown-icon">${icon}</span>
      <div class="breakdown-text">
        <strong>Q${i + 1}. ${escapeHtml(qMap[item.question_id] || "Question")}</strong>
        <small>${givenText} &nbsp;·&nbsp; Correct: <strong>${item.correct}</strong></small>
      </div>`;
    bl.appendChild(div);
  });
}

/* ─── Results button handlers ───────────────────────────────────────────── */
$("btn-restart").addEventListener("click", () => startQuiz(state.quizId, state.quizTitle));
$("btn-new-quiz").addEventListener("click", () => showPage("select"));
$("btn-history").addEventListener("click", loadHistory);

/* ═══════════════════════════════════════════════════════════════════════
   HISTORY
   ═══════════════════════════════════════════════════════════════════════ */
async function loadHistory() {
  showPage("history");
  const wrap = $("history-table-wrap");
  wrap.innerHTML = '<p class="empty">Loading…</p>';

  try {
    const results = await apiFetch(`/api/students/${state.student.id}/results`);
    if (!results.length) {
      wrap.innerHTML = '<p class="empty">No results yet. Take a quiz first!</p>';
      return;
    }
    let html = `
      <table class="history-table">
        <thead><tr>
          <th>#</th><th>Date</th><th>Quiz</th><th>Score</th><th>%</th><th>Grade</th>
        </tr></thead>
        <tbody>`;
    results.forEach((r, i) => {
      const badge = r.percentage >= 80 ? "badge-green"
                  : r.percentage >= 50 ? "badge-yellow"
                  : "badge-red";
      const grade = r.percentage >= 80 ? "Pass" : r.percentage >= 50 ? "Average" : "Fail";
      html += `
        <tr>
          <td>${i + 1}</td>
          <td>${formatDate(r.taken_at)}</td>
          <td>${escapeHtml(r.title)}</td>
          <td>${r.score} / ${r.total}</td>
          <td>${r.percentage}%</td>
          <td><span class="badge ${badge}">${grade}</span></td>
        </tr>`;
    });
    html += `</tbody></table>`;
    wrap.innerHTML = html;
  } catch (err) {
    wrap.innerHTML = `<p class="empty">Error: ${err.message}</p>`;
  }
}

$("btn-back-results").addEventListener("click", () => showPage("results"));
$("btn-home-from-history").addEventListener("click", () => showPage("home"));

/* ═══════════════════════════════════════════════════════════════════════
   UTILS
   ═══════════════════════════════════════════════════════════════════════ */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso) {
  if (!iso) return "–";
  try {
    const d = new Date(iso.replace(" ", "T") + "Z");
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}
