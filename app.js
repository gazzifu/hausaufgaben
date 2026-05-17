// ════════════════════════════════════════════════════
//  Hausaufgaben-App  ·  Vanilla JS + Supabase
// ════════════════════════════════════════════════════

const { createClient } = supabase;
const db = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);

// ── DOM refs ──────────────────────────────────────────
const loginScreen   = document.getElementById('login-screen');
const appScreen     = document.getElementById('app-screen');
const emailInput    = document.getElementById('email-input');
const magicLinkBtn  = document.getElementById('magic-link-btn');
const loginMsg      = document.getElementById('login-msg');
const userEmailDisp = document.getElementById('user-email-display');
const logoutBtn     = document.getElementById('logout-btn');
const subjectInput  = document.getElementById('subject-input');
const dueDateInput  = document.getElementById('due-date-input');
const descInput     = document.getElementById('desc-input');
const solutionFile  = document.getElementById('solution-file');
const fileLabel     = document.getElementById('file-label');
const fileDrop      = document.getElementById('file-drop');
const addBtn        = document.getElementById('add-btn');
const addMsg        = document.getElementById('add-msg');
const hwList        = document.getElementById('hw-list');
const filterSubject = document.getElementById('filter-subject');

let currentUser = null;

// ── Helpers ───────────────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(name + '-screen').classList.add('active');
}

function setMsg(el, text, type = '') {
  el.textContent = text;
  el.className = type ? `${el.className.split(' ')[0]} ${type}` : el.className.split(' ')[0];
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr + 'T00:00:00') < new Date(new Date().toDateString());
}

function subjectColor(subject) {
  const colors = {
    'Mathematik': '#f0c060', 'Deutsch': '#f06090', 'Englisch': '#60c8f0',
    'Physik': '#c060f0', 'Chemie': '#f09060', 'Biologie': '#60f090',
    'Geschichte': '#f06060', 'Geographie': '#60f0c0', 'Informatik': '#c8f060',
  };
  return colors[subject] || '#c8f060';
}

// ── Auth ──────────────────────────────────────────────
async function sendMagicLink() {
  const email = emailInput.value.trim().toLowerCase();
  if (!email) { setMsg(loginMsg, 'Bitte E-Mail-Adresse eingeben.'); return; }

  if (CONFIG.allowedEmailDomain && !email.endsWith(CONFIG.allowedEmailDomain)) {
    setMsg(loginMsg, `Nur ${CONFIG.allowedEmailDomain} Adressen erlaubt.`);
    return;
  }

  magicLinkBtn.disabled = true;
  setMsg(loginMsg, 'Sende Link…');

  const { error } = await db.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href },
  });

  magicLinkBtn.disabled = false;
  if (error) {
    setMsg(loginMsg, 'Fehler: ' + error.message);
  } else {
    setMsg(loginMsg, '✓ Link gesendet! Schau in dein Postfach (auch Spam).');
  }
}

async function logout() {
  await db.auth.signOut();
  currentUser = null;
  showScreen('login');
}

// ── Session handling ──────────────────────────────────
db.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    currentUser = session.user;
    userEmailDisp.textContent = currentUser.email;
    showScreen('app');
    loadHomework();
  } else {
    showScreen('login');
  }
});

// ── File picker label ─────────────────────────────────
solutionFile.addEventListener('change', () => {
  if (solutionFile.files[0]) {
    fileLabel.textContent = '📎 ' + solutionFile.files[0].name;
    fileDrop.classList.add('has-file');
  } else {
    fileLabel.textContent = 'PDF hier ablegen oder klicken';
    fileDrop.classList.remove('has-file');
  }
});

// ── Add homework ──────────────────────────────────────
addBtn.addEventListener('click', async () => {
  const subject  = subjectInput.value;
  const dueDate  = dueDateInput.value || null;
  const desc     = descInput.value.trim();
  const file     = solutionFile.files[0] || null;

  if (!subject) { setMsg(addMsg, 'Bitte ein Fach wählen.', 'err'); return; }
  if (!desc)    { setMsg(addMsg, 'Bitte eine Beschreibung eingeben.', 'err'); return; }

  addBtn.disabled = true;
  setMsg(addMsg, 'Speichern…');

  let solutionUrl = null;

  // Upload solution PDF if provided
  if (file) {
    const path = `solutions/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const { error: upErr } = await db.storage.from('hausaufgaben').upload(path, file);
    if (upErr) {
      setMsg(addMsg, 'PDF-Upload fehlgeschlagen: ' + upErr.message, 'err');
      addBtn.disabled = false;
      return;
    }
    const { data: urlData } = db.storage.from('hausaufgaben').getPublicUrl(path);
    solutionUrl = urlData.publicUrl;
  }

  const { error } = await db.from('homework').insert({
    subject,
    due_date:     dueDate,
    description:  desc,
    solution_url: solutionUrl,
    created_by:   currentUser.email,
  });

  addBtn.disabled = false;

  if (error) {
    setMsg(addMsg, 'Fehler: ' + error.message, 'err');
  } else {
    setMsg(addMsg, '✓ Eingetragen!', 'ok');
    subjectInput.value = '';
    dueDateInput.value = '';
    descInput.value = '';
    solutionFile.value = '';
    fileLabel.textContent = 'PDF hier ablegen oder klicken';
    fileDrop.classList.remove('has-file');
    loadHomework();
    setTimeout(() => setMsg(addMsg, ''), 3000);
  }
});

// ── Load & render homework ─────────────────────────────
async function loadHomework() {
  hwList.innerHTML = '<div class="loading">Lade Hausaufgaben…</div>';

  let query = db
    .from('homework')
    .select('*')
    .order('due_date', { ascending: true, nullsFirst: false });

  const subjectFilter = filterSubject.value;
  if (subjectFilter) query = query.eq('subject', subjectFilter);

  const { data, error } = await query;

  if (error) {
    hwList.innerHTML = `<div class="loading">Fehler: ${error.message}</div>`;
    return;
  }

  if (!data || data.length === 0) {
    hwList.innerHTML = '<div class="loading">Keine Hausaufgaben eingetragen.</div>';
    return;
  }

  hwList.innerHTML = '';
  data.forEach(hw => hwList.appendChild(renderCard(hw)));
}

function renderCard(hw) {
  const card = document.createElement('div');
  card.className = 'hw-card';
  card.dataset.id = hw.id;

  const color = subjectColor(hw.subject);
  const overdue = isOverdue(hw.due_date);
  const isOwner = currentUser && hw.created_by === currentUser.email;

  card.innerHTML = `
    <div class="hw-card-left">
      <span class="hw-subject" style="background:${color}22;color:${color}">${hw.subject}</span>
      <p class="hw-desc">${escapeHtml(hw.description)}</p>
      <div class="hw-meta">
        ${hw.due_date ? `<span class="due ${overdue ? 'overdue' : ''}">📅 ${formatDate(hw.due_date)}${overdue ? ' · überfällig' : ''}</span>` : ''}
        <span>von ${escapeHtml(hw.created_by)}</span>
        <span>${new Date(hw.created_at).toLocaleDateString('de-DE')}</span>
      </div>
    </div>
    <div class="hw-actions">
      ${hw.solution_url
        ? `<a class="btn-solution" href="${hw.solution_url}" target="_blank" rel="noopener">📄 Lösung</a>`
        : `<label class="btn-upload-solution">➕ Lösung hochladen<input type="file" accept="application/pdf" data-id="${hw.id}" class="solution-upload-input" /></label>`
      }
      ${isOwner ? `<button class="btn-delete" data-id="${hw.id}">✕ löschen</button>` : ''}
    </div>
  `;

  // Upload solution for existing entry
  const uploadInput = card.querySelector('.solution-upload-input');
  if (uploadInput) {
    uploadInput.addEventListener('change', (e) => uploadSolution(hw.id, e.target.files[0], card));
  }

  // Delete
  const deleteBtn = card.querySelector('.btn-delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => deleteHomework(hw.id, card));
  }

  return card;
}

// ── Upload solution to existing entry ─────────────────
async function uploadSolution(hwId, file, card) {
  if (!file) return;
  const label = card.querySelector('.btn-upload-solution');
  if (label) label.textContent = 'Hochladen…';

  const path = `solutions/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
  const { error: upErr } = await db.storage.from('hausaufgaben').upload(path, file);
  if (upErr) { alert('Upload fehlgeschlagen: ' + upErr.message); loadHomework(); return; }

  const { data: urlData } = db.storage.from('hausaufgaben').getPublicUrl(path);
  const { error } = await db.from('homework').update({ solution_url: urlData.publicUrl }).eq('id', hwId);
  if (error) { alert('Fehler beim Speichern der URL: ' + error.message); }
  loadHomework();
}

// ── Delete homework ───────────────────────────────────
async function deleteHomework(hwId, card) {
  if (!confirm('Hausaufgabe wirklich löschen?')) return;
  card.style.opacity = '.4';
  const { error } = await db.from('homework').delete().eq('id', hwId).eq('created_by', currentUser.email);
  if (error) { alert('Fehler: ' + error.message); card.style.opacity = '1'; return; }
  card.remove();
}

// ── Filter ────────────────────────────────────────────
filterSubject.addEventListener('change', loadHomework);

// ── Events ────────────────────────────────────────────
magicLinkBtn.addEventListener('click', sendMagicLink);
emailInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendMagicLink(); });
logoutBtn.addEventListener('click', logout);

// ── Security ──────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
