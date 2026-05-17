// ════════════════════════════════════════════════════
//  Hausaufgaben-App  ·  Vanilla JS + Supabase
// ════════════════════════════════════════════════════

const { createClient } = supabase;
const db = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

// ── DOM refs ──────────────────────────────────────────
const loginScreen  = document.getElementById('login-screen');
const appScreen    = document.getElementById('app-screen');
const emailInput   = document.getElementById('email-input');
const magicLinkBtn = document.getElementById('magic-link-btn');
const loginMsg     = document.getElementById('login-msg');
const logoutBtn    = document.getElementById('logout-btn');
const prevDayBtn   = document.getElementById('prev-day');
const nextDayBtn   = document.getElementById('next-day');
const todayBtn     = document.getElementById('today-btn');
const dateDisplay  = document.getElementById('date-display');
const addHwBtn     = document.getElementById('add-hw-btn');
const overlay      = document.getElementById('overlay');
const closeOverlay = document.getElementById('close-overlay');
const subjectInput = document.getElementById('subject-input');
const descInput    = document.getElementById('desc-input');
const addBtn       = document.getElementById('add-btn');
const addMsg       = document.getElementById('add-msg');
const hwList       = document.getElementById('hw-list');

let currentUser = null;
let currentDate = todayStr();

// ── Date helpers ──────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function offsetDate(str, days) {
  const d = new Date(str + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateLong(str) {
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function subjectColor(subject) {
  const colors = {
    'Mathematik': '#f0c060', 'Deutsch': '#f06090', 'Englisch': '#60c8f0',
    'Physik': '#c060f0', 'Chemie': '#f09060', 'Biologie': '#60f090',
    'Geschichte': '#f06060', 'Geographie': '#60f0c0', 'Informatik': '#c8f060',
  };
  return colors[subject] || '#c8f060';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function shortEmail(email) {
  return email ? email.split('@')[0] : '';
}

// ── Screens ───────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(name + '-screen').classList.add('active');
}

// ── Auth ──────────────────────────────────────────────
async function sendMagicLink() {
  const email = emailInput.value.trim().toLowerCase();
  if (!email) { loginMsg.textContent = 'Bitte E-Mail-Adresse eingeben.'; return; }

  if (CONFIG.allowedEmailDomain && !email.endsWith(CONFIG.allowedEmailDomain)) {
    loginMsg.textContent = `Nur ${CONFIG.allowedEmailDomain} Adressen erlaubt.`;
    return;
  }

  magicLinkBtn.disabled = true;
  loginMsg.textContent = 'Sende Link…';

  const { error } = await db.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href },
  });

  magicLinkBtn.disabled = false;
  loginMsg.textContent = error
    ? 'Fehler: ' + error.message
    : '✓ Link gesendet! Schau in dein Postfach (auch Spam).';
}

db.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    currentUser = session.user;
    showScreen('app');
    updateDateDisplay();
    loadHomework();
  } else {
    currentUser = null;
    showScreen('login');
  }
});

logoutBtn.addEventListener('click', () => db.auth.signOut());
magicLinkBtn.addEventListener('click', sendMagicLink);
emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMagicLink(); });

// ── Date navigation ───────────────────────────────────
function updateDateDisplay() {
  dateDisplay.textContent = formatDateLong(currentDate);
  todayBtn.classList.toggle('hidden', currentDate === todayStr());
}

prevDayBtn.addEventListener('click', () => {
  currentDate = offsetDate(currentDate, -1);
  updateDateDisplay();
  loadHomework();
});

nextDayBtn.addEventListener('click', () => {
  currentDate = offsetDate(currentDate, +1);
  updateDateDisplay();
  loadHomework();
});

todayBtn.addEventListener('click', () => {
  currentDate = todayStr();
  updateDateDisplay();
  loadHomework();
});

// ── Overlay ───────────────────────────────────────────
function openOverlay() {
  overlay.classList.add('active');
  subjectInput.value = '';
  descInput.value = '';
  addMsg.textContent = '';
  addMsg.className = 'add-msg';
  setTimeout(() => descInput.focus(), 50);
}

function closeOverlayFn() {
  overlay.classList.remove('active');
}

addHwBtn.addEventListener('click', openOverlay);
closeOverlay.addEventListener('click', closeOverlayFn);
overlay.addEventListener('click', e => { if (e.target === overlay) closeOverlayFn(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOverlayFn(); });

// ── Add homework ──────────────────────────────────────
addBtn.addEventListener('click', async () => {
  const subject = subjectInput.value;
  const desc    = descInput.value.trim();

  if (!subject) { showMsg(addMsg, 'Bitte ein Fach wählen.', 'err'); return; }
  if (!desc)    { showMsg(addMsg, 'Bitte eine Beschreibung eingeben.', 'err'); return; }

  addBtn.disabled = true;
  showMsg(addMsg, 'Speichern…');

  const { error } = await db.from('homework').insert({
    subject,
    description: desc,
    created_by:  currentUser.email,
    // Store the currently viewed date as the "day" for this entry
    entry_date:  currentDate,
  });

  addBtn.disabled = false;

  if (error) {
    showMsg(addMsg, 'Fehler: ' + error.message, 'err');
  } else {
    showMsg(addMsg, '✓ Eingetragen!', 'ok');
    setTimeout(() => {
      closeOverlayFn();
      loadHomework();
    }, 800);
  }
});

function showMsg(el, text, type = '') {
  el.textContent = text;
  el.className = 'add-msg' + (type ? ' ' + type : '');
}

// ── Load homework for current day ─────────────────────
async function loadHomework() {
  hwList.innerHTML = '<div class="loading">Lade…</div>';

  const { data, error } = await db
    .from('homework')
    .select('*, solutions(*)')
    .eq('entry_date', currentDate)
    .order('created_at', { ascending: true });

  if (error) {
    hwList.innerHTML = `<div class="loading">Fehler: ${escapeHtml(error.message)}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    hwList.innerHTML = `
      <div class="empty-day">
        <span class="empty-icon">📭</span>
        <p>Keine Hausaufgaben für diesen Tag.</p>
      </div>`;
    return;
  }

  hwList.innerHTML = '';
  data.forEach(hw => hwList.appendChild(renderCard(hw)));
}

// ── Render card ───────────────────────────────────────
function renderCard(hw) {
  const card = document.createElement('div');
  card.className = 'hw-card';
  card.dataset.id = hw.id;

  const color = subjectColor(hw.subject);
  const solutions = hw.solutions || [];

  card.innerHTML = `
    <div class="hw-card-top">
      <span class="hw-subject" style="background:${color}22;color:${color}">${escapeHtml(hw.subject)}</span>
      <button class="btn-delete" data-id="${hw.id}">✕</button>
    </div>
    <p class="hw-desc">${escapeHtml(hw.description)}</p>
    <div class="hw-meta">eingetragen von ${escapeHtml(shortEmail(hw.created_by))}</div>
    <div class="solutions-section">
      <div class="solutions-title">Lösungen</div>
      <div class="solutions-list" id="sol-list-${hw.id}">
        ${solutions.length === 0 ? '<span style="font-family:var(--mono);font-size:.78rem;color:var(--muted)">Noch keine Lösungen.</span>' : ''}
        ${solutions.map(sol => renderSolutionItem(sol)).join('')}
      </div>
      <label class="btn-upload-solution">
        ➕ Lösung hochladen
        <input type="file" class="solution-upload-input" data-hwid="${hw.id}" />
      </label>
    </div>
  `;

  card.querySelector('.btn-delete').addEventListener('click', () => deleteHomework(hw.id, card));

  card.querySelector('.solution-upload-input').addEventListener('change', e => {
    uploadSolution(hw.id, e.target.files[0], card);
  });

  card.querySelectorAll('.btn-delete-solution').forEach(btn => {
    btn.addEventListener('click', () => deleteSolution(btn.dataset.solid, hw.id, card));
  });

  return card;
}

function renderSolutionItem(sol) {
  const name = sol.file_name || 'Datei';
  return `
    <div class="solution-item" data-solid="${sol.id}">
      <a class="solution-link" href="${escapeHtml(sol.file_url)}" target="_blank" rel="noopener">
        📎 ${escapeHtml(name)}
      </a>
      <span class="solution-by">${escapeHtml(shortEmail(sol.uploaded_by))}</span>
      <button class="btn-delete-solution" data-solid="${sol.id}">✕</button>
    </div>`;
}

// ── Upload solution ───────────────────────────────────
async function uploadSolution(hwId, file, card) {
  if (!file) return;

  const uploadBtn = card.querySelector('.btn-upload-solution');
  uploadBtn.style.opacity = '.5';
  uploadBtn.style.pointerEvents = 'none';

  const ext  = file.name.split('.').pop();
  const path = `solutions/${hwId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;

  const { error: upErr } = await db.storage.from('hausaufgaben').upload(path, file);
  if (upErr) {
    alert('Upload fehlgeschlagen: ' + upErr.message);
    uploadBtn.style.opacity = '';
    uploadBtn.style.pointerEvents = '';
    return;
  }

  const { data: urlData } = db.storage.from('hausaufgaben').getPublicUrl(path);

  const { data: sol, error } = await db.from('solutions').insert({
    homework_id:  hwId,
    file_url:     urlData.publicUrl,
    file_name:    file.name,
    uploaded_by:  currentUser.email,
  }).select().single();

  uploadBtn.style.opacity = '';
  uploadBtn.style.pointerEvents = '';

  if (error) { alert('Fehler: ' + error.message); return; }

  // Inject new solution into DOM without full reload
  const list = card.querySelector(`#sol-list-${hwId}`);
  const empty = list.querySelector('span');
  if (empty) empty.remove();
  list.insertAdjacentHTML('beforeend', renderSolutionItem(sol));
  list.querySelector(`[data-solid="${sol.id}"] .btn-delete-solution`)
    .addEventListener('click', () => deleteSolution(sol.id, hwId, card));
}

// ── Delete solution ───────────────────────────────────
async function deleteSolution(solId, hwId, card) {
  if (!confirm('Lösung löschen?')) return;
  const { error } = await db.from('solutions').delete().eq('id', solId);
  if (error) { alert('Fehler: ' + error.message); return; }

  const item = card.querySelector(`.solution-item[data-solid="${solId}"]`);
  if (item) item.remove();

  const list = card.querySelector(`#sol-list-${hwId}`);
  if (list && list.children.length === 0) {
    list.innerHTML = '<span style="font-family:var(--mono);font-size:.78rem;color:var(--muted)">Noch keine Lösungen.</span>';
  }
}

// ── Delete homework ───────────────────────────────────
async function deleteHomework(hwId, card) {
  if (!confirm('Hausaufgabe wirklich löschen?')) return;
  card.style.opacity = '.4';
  const { error } = await db.from('homework').delete().eq('id', hwId);
  if (error) { alert('Fehler: ' + error.message); card.style.opacity = '1'; return; }
  card.remove();
  if (hwList.children.length === 0) {
    hwList.innerHTML = `<div class="empty-day"><span class="empty-icon">📭</span><p>Keine Hausaufgaben für diesen Tag.</p></div>`;
  }
}