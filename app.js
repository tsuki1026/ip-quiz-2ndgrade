'use strict';

// ===== State =====
let allQuestions = [];
let sessionQuestions = [];
let currentIndex = 0;
let score = 0;
let wrongQuestions = [];
let selectedCategory = 'all';
let reviewQuestions = [];
let reviewIndex = 0;
let hasAnswered = false;
let hasReviewAnswered = false;

// ===== Constants =====
const CATEGORY_ORDER = [
  { key: 'all', label: 'すべて' },
  { key: '特許法', label: '特許法' },
  { key: '実用新案法', label: '実用新案法' },
  { key: '意匠法', label: '意匠法' },
  { key: '商標法', label: '商標法' },
  { key: '著作権法', label: '著作権法' },
  { key: '条約・国際動向', label: '条約・国際' },
  { key: 'その他関連法規', label: 'その他関連法規' },
  { key: '実技試験対策（事例・計算）', label: '実技・計算' },
];

const OPTION_LABELS = ['ア', 'イ', 'ウ', 'エ'];

// ===== DOM helpers =====
const $ = id => document.getElementById(id);

function requiredEl(id) {
  const el = $(id);
  if (!el) {
    throw new Error(`Required element not found: #${id}`);
  }
  return el;
}

function show(id) {
  requiredEl('screen-' + id).classList.add('active');
}

function hide(id) {
  requiredEl('screen-' + id).classList.remove('active');
}

function hideAll() {
  ['top', 'quiz', 'result', 'review'].forEach(hide);
}

// ===== Boot =====
function boot() {
  if (typeof QUESTIONS_DATA === 'undefined') {
    alert('問題データの読み込みに失敗しました。questions.js が app.js より前に読み込まれているか確認してください。');
    throw new Error('QUESTIONS_DATA is not defined');
  }

  if (!Array.isArray(QUESTIONS_DATA)) {
    alert('問題データの形式が不正です。QUESTIONS_DATA は配列である必要があります。');
    throw new Error('QUESTIONS_DATA must be an array');
  }

  allQuestions = QUESTIONS_DATA;
  buildCategoryButtons();
  bindEvents();
  goTop();
}

// ===== Category Buttons =====
function buildCategoryButtons() {
  const grid = requiredEl('category-buttons');
  grid.innerHTML = '';

  const countMap = {};
  allQuestions.forEach(q => {
    if (!q || !q.category) return;
    countMap[q.category] = (countMap[q.category] || 0) + 1;
  });

  CATEGORY_ORDER.forEach(({ key, label }) => {
    const count = key === 'all' ? allQuestions.length : (countMap[key] || 0);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cat-btn' + (key === selectedCategory ? ' selected' : '');
    btn.dataset.key = key;
    btn.innerHTML = `${escapeHtml(label)}<span class="cat-count">${count}問</span>`;
    btn.addEventListener('click', () => {
      selectedCategory = key;
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
    grid.appendChild(btn);
  });
}

// ===== Events =====
function bindEvents() {
  requiredEl('btn-start').addEventListener('click', startQuiz);
  requiredEl('btn-abort').addEventListener('click', confirmAbort);
  requiredEl('btn-review-abort').addEventListener('click', confirmAbort);
  requiredEl('btn-next').addEventListener('click', nextQuestion);
  requiredEl('btn-review-next').addEventListener('click', nextReview);
  requiredEl('btn-review').addEventListener('click', startReview);
  requiredEl('btn-top').addEventListener('click', goTop);
}

function confirmAbort() {
  if (confirm('クイズを中断してトップへ戻りますか？\n（現在の進捗は保存されません）')) {
    goTop();
  }
}

// ===== Start Quiz =====
function startQuiz() {
  const modeInput = document.querySelector('input[name="mode"]:checked');
  const countInput = document.querySelector('input[name="count"]:checked');

  if (!modeInput || !countInput) {
    alert('出題モードと問題数を選択してください。');
    return;
  }

  const mode = modeInput.value;
  const count = countInput.value;

  let pool = selectedCategory === 'all'
    ? [...allQuestions]
    : allQuestions.filter(q => q.category === selectedCategory);

  pool = pool.filter(isValidQuestion);

  if (pool.length === 0) {
    alert('選択したカテゴリーに有効な問題がありません。');
    return;
  }

  if (mode === 'random') shuffle(pool);

  const n = count === 'all' ? pool.length : Math.min(parseInt(count, 10), pool.length);
  sessionQuestions = pool.slice(0, n);
  currentIndex = 0;
  score = 0;
  wrongQuestions = [];
  hasAnswered = false;

  hideAll();
  show('quiz');
  renderQuestion();
}

// ===== Render Question =====
function renderQuestion() {
  const q = sessionQuestions[currentIndex];
  const total = sessionQuestions.length;
  hasAnswered = false;

  if (!isValidQuestion(q)) {
    console.error('Invalid question data:', q);
    alert('問題データに不備があります。コンソールを確認してください。');
    goTop();
    return;
  }

  requiredEl('progress-text').textContent = `${currentIndex + 1} / ${total}`;
  requiredEl('category-badge').textContent = q.category;
  requiredEl('score-count').textContent = score;
  requiredEl('progress-bar').style.width = `${(currentIndex / total) * 100}%`;

  requiredEl('question-title').textContent = q.title;
  requiredEl('question-text').textContent = q.question;

  const list = requiredEl('options-list');
  list.innerHTML = '';

  q.options.forEach((opt, i) => {
    const li = document.createElement('li');
    li.className = 'option-item';
    const label = OPTION_LABELS[i] || String(i + 1);
    li.dataset.label = label;
    li.textContent = opt;
    li.addEventListener('click', () => handleAnswer(label, q));
    list.appendChild(li);
  });

  requiredEl('explanation-box').classList.add('hidden');
}

// ===== Handle Answer =====
function handleAnswer(chosen, q) {
  if (hasAnswered) return;
  hasAnswered = true;

  const items = requiredEl('options-list').querySelectorAll('.option-item');
  items.forEach(li => li.classList.add('disabled'));

  const correct = q.answer;
  const isCorrect = chosen === correct;

  items.forEach(li => {
    const lbl = li.dataset.label;
    if (lbl === correct) li.classList.add('correct');
    else if (lbl === chosen && !isCorrect) li.classList.add('incorrect');
  });

  if (isCorrect) {
    score++;
    requiredEl('score-count').textContent = score;
  } else {
    wrongQuestions.push({ ...q, chosen });
  }

  requiredEl('explanation-box').classList.remove('hidden');

  const resultLabel = requiredEl('result-label');
  resultLabel.textContent = isCorrect ? '✅ 正解！' : `❌ 不正解（正解：${correct}）`;
  resultLabel.className = 'result-label ' + (isCorrect ? 'correct' : 'incorrect');

  requiredEl('explanation-text').textContent = q.explanation;
}

// ===== Next Question =====
function nextQuestion() {
  if (!hasAnswered) return;

  currentIndex++;
  if (currentIndex >= sessionQuestions.length) {
    showResult();
  } else {
    renderQuestion();
  }
}

// ===== Result =====
function showResult() {
  const total = sessionQuestions.length;
  const pct = total === 0 ? 0 : Math.round((score / total) * 100);

  requiredEl('final-score').textContent = score;
  requiredEl('final-total').textContent = total;
  requiredEl('progress-bar').style.width = '100%';

  let rank;
  let rankColor;
  if (pct >= 90) {
    rank = '🏆 完璧！素晴らしい！';
    rankColor = '#16a34a';
  } else if (pct >= 75) {
    rank = '🌟 合格ライン突破！';
    rankColor = '#2563eb';
  } else if (pct >= 60) {
    rank = '📈 もう少し！';
    rankColor = '#d97706';
  } else {
    rank = '📚 要復習';
    rankColor = '#dc2626';
  }

  const rankEl = requiredEl('result-rank');
  rankEl.textContent = `${pct}% ― ${rank}`;
  rankEl.style.color = rankColor;

  renderBreakdown();
  updateReviewButton();

  hideAll();
  show('result');
}

function renderBreakdown() {
  const catMap = {};

  sessionQuestions.forEach(q => {
    if (!catMap[q.category]) catMap[q.category] = { total: 0, wrong: 0 };
    catMap[q.category].total++;
  });

  wrongQuestions.forEach(q => {
    if (!catMap[q.category]) catMap[q.category] = { total: 0, wrong: 0 };
    catMap[q.category].wrong++;
  });

  const breakdown = requiredEl('result-breakdown');
  breakdown.innerHTML = '<strong style="display:block;margin-bottom:8px">カテゴリー別</strong>';

  Object.entries(catMap).forEach(([cat, { total, wrong }]) => {
    const row = document.createElement('div');
    row.className = 'breakdown-row';

    const catSpan = document.createElement('span');
    catSpan.textContent = cat;

    const scoreSpan = document.createElement('span');
    scoreSpan.innerHTML = `<b>${total - wrong}</b> / ${total}`;

    row.appendChild(catSpan);
    row.appendChild(scoreSpan);
    breakdown.appendChild(row);
  });
}

function updateReviewButton() {
  const btnReview = requiredEl('btn-review');

  if (wrongQuestions.length === 0) {
    btnReview.disabled = true;
    btnReview.textContent = '間違いなし 🎉';
    btnReview.style.opacity = '0.5';
    btnReview.style.cursor = 'default';
  } else {
    btnReview.disabled = false;
    btnReview.textContent = `間違えた問題を復習 (${wrongQuestions.length}問)`;
    btnReview.style.opacity = '1';
    btnReview.style.cursor = 'pointer';
  }
}

// ===== Review =====
function startReview() {
  if (wrongQuestions.length === 0) return;

  reviewQuestions = [...wrongQuestions];
  reviewIndex = 0;
  hasReviewAnswered = false;

  hideAll();
  show('review');
  renderReview();
}

function renderReview() {
  const q = reviewQuestions[reviewIndex];
  const total = reviewQuestions.length;
  hasReviewAnswered = false;

  if (!isValidQuestion(q)) {
    console.error('Invalid review question data:', q);
    alert('復習問題データに不備があります。コンソールを確認してください。');
    goTop();
    return;
  }

  requiredEl('review-progress-text').textContent = `${reviewIndex + 1} / ${total}`;
  requiredEl('review-progress-bar').style.width = `${(reviewIndex / total) * 100}%`;
  requiredEl('review-title').textContent = q.title;
  requiredEl('review-text').textContent = q.question;

  const list = requiredEl('review-options');
  list.innerHTML = '';

  q.options.forEach((opt, i) => {
    const li = document.createElement('li');
    li.className = 'option-item';
    const label = OPTION_LABELS[i] || String(i + 1);
    li.dataset.label = label;
    li.textContent = opt;
    li.addEventListener('click', () => handleReviewAnswer(label, q));
    list.appendChild(li);
  });

  requiredEl('review-explanation-box').classList.add('hidden');
}

function handleReviewAnswer(chosen, q) {
  if (hasReviewAnswered) return;
  hasReviewAnswered = true;

  const items = requiredEl('review-options').querySelectorAll('.option-item');
  items.forEach(li => li.classList.add('disabled'));

  const correct = q.answer;
  const isCorrect = chosen === correct;

  items.forEach(li => {
    const lbl = li.dataset.label;
    if (lbl === correct) li.classList.add('correct');
    else if (lbl === chosen && !isCorrect) li.classList.add('incorrect');
  });

  requiredEl('review-explanation-box').classList.remove('hidden');

  const label = requiredEl('review-result-label');
  label.textContent = isCorrect ? '✅ 正解！' : `❌ 不正解（正解：${correct}）`;
  label.className = 'result-label ' + (isCorrect ? 'correct' : 'incorrect');

  requiredEl('review-explanation-text').textContent = q.explanation;
}

function nextReview() {
  if (!hasReviewAnswered) return;

  reviewIndex++;
  if (reviewIndex >= reviewQuestions.length) {
    goTop();
  } else {
    renderReview();
  }
}

// ===== Go Top =====
function goTop() {
  hideAll();
  show('top');
}

// ===== Utils =====
function isValidQuestion(q) {
  return Boolean(
    q &&
    typeof q.category === 'string' &&
    typeof q.title === 'string' &&
    typeof q.question === 'string' &&
    Array.isArray(q.options) &&
    q.options.length > 0 &&
    q.options.every(opt => typeof opt === 'string') &&
    typeof q.answer === 'string' &&
    typeof q.explanation === 'string'
  );
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  })[char]);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

boot();