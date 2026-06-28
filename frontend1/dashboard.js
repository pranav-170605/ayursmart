// ===== AyurSmart — dashboard.js =====
// Works with Python Flask Backend

const API_BASE = 'http://127.0.0.1:5100/api';

// ── Default visual metadata ──
const defaultVisuals = {
  vata:  { label: "VATA",  icon: "🌿" },
  pitta: { label: "PITTA", icon: "🔥" },
  kapha: { label: "KAPHA", icon: "💧" }
};

let currentRemedies = {};

// ── Unlock overlay ──
function unlockDashboard() {
  const overlay = document.getElementById('authGuardOverlay');
  const body    = document.body;
  if (!body.classList.contains('is-loading')) return;
  body.classList.remove('is-loading');
  if (overlay) {
    overlay.classList.add('hidden');
    setTimeout(() => { overlay.style.display = 'none'; }, 450);
  }
}

// ── Show toast ──
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

// ── Set status badge ──
function setStatus(online) {
  const badge = document.getElementById('statusBadge');
  if (!badge) return;
  badge.textContent = online ? '🟢 Connected' : '🔴 Offline';
  badge.classList.toggle('offline', !online);
}

// ── Build a single remedy card ──
function buildCard(doshaKey, data) {
  const vis = defaultVisuals[doshaKey.toLowerCase()] || { label: doshaKey.toUpperCase(), icon: '✨' };
  const card = document.createElement('div');
  card.className = 'remedy-card';
  card.innerHTML = `
    <div class="card-dosha-header">
      <span class="dosha-icon">${vis.icon}</span>
      <h3>${vis.label}</h3>
    </div>
    <div class="card-field">
      <strong>Summary:</strong>
      <span>${(data.summary || '—').replace(/\n/g, '<br>')}</span>
    </div>
    <div class="card-field">
      <strong>Recommended Food:</strong>
      <span>${data.recommended_food || '—'}</span>
    </div>
    <div class="card-field">
      <strong>Prohibited Food:</strong>
      <span>${data.prohibited_food || '—'}</span>
    </div>
    <button class="card-edit-btn" onclick="openEdit('${doshaKey}')">Edit</button>
  `;
  return card;
}

// ── Render all cards ──
function renderCards(remediesArray) {
  const container = document.getElementById('remedyCards');
  if (!container) return;
  container.innerHTML = '';
  
  currentRemedies = {};
  remediesArray.forEach(r => {
    const k = (r.body_type || '').toLowerCase();
    currentRemedies[k] = r;
  });

  // Ensure standard doshas are always dynamically shown, even if backend gave empty initially
  ['vata', 'pitta', 'kapha'].forEach(key => {
    if (!currentRemedies[key]) {
      currentRemedies[key] = { body_type: key, summary: '', recommended_food: '', prohibited_food: '' };
    }
    container.appendChild(buildCard(key, currentRemedies[key]));
  });
}

// ── Load remedies from MySQL via HTTP ──
async function loadRemedies() {
  try {
    const res = await fetch(`${API_BASE}/remedies`, { credentials: 'omit' });
    if (!res.ok) throw new Error('Fetch failed');
    const data = await res.json();
    if (data.success) {
      renderCards(data.remedies || []);
      setStatus(true);
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    console.error('MySQL error:', err);
    renderCards([]);
    setStatus(false);
  }
}

// ── Open edit popup ──
window.openEdit = function (doshaKey) {
  const d = currentRemedies[doshaKey];
  if (!d) return;
  const vis = defaultVisuals[doshaKey.toLowerCase()] || { label: doshaKey.toUpperCase() };
  document.getElementById('editDoshaType').value   = doshaKey;
  document.getElementById('doshaTitle').textContent = `Edit Remedy — ${vis.label}`;
  document.getElementById('editSummary').value      = d.summary || '';
  document.getElementById('editRecommended').value  = d.recommended_food || '';
  document.getElementById('editProhibited').value   = d.prohibited_food || '';
  document.getElementById('editPopup').classList.add('open');
};

// ── Close popup ──
window.closePopup = function () {
  document.getElementById('editPopup').classList.remove('open');
};

// ── Save changes to MySQL via HTTP ──
window.saveChanges = async function () {
  const key = document.getElementById('editDoshaType').value;
  if (!key || !currentRemedies[key]) return;

  const summary = document.getElementById('editSummary').value.trim();
  const recommended_food = document.getElementById('editRecommended').value.trim();
  const prohibited_food = document.getElementById('editProhibited').value.trim();

  try {
    const res = await fetch(`${API_BASE}/remedies/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary, recommended_food, prohibited_food }),
      credentials: 'include' // needed for admin session verification
    });
    
    const data = await res.json();
    if (data.success) {
      showToast('✅ Remedy updated successfully');
      setStatus(true);
      // Update local and re-render
      currentRemedies[key].summary = summary;
      currentRemedies[key].recommended_food = recommended_food;
      currentRemedies[key].prohibited_food = prohibited_food;
      renderCards(Object.values(currentRemedies));
    } else {
      throw new Error(data.message);
    }
  } catch (err) {
    console.error('Save error:', err);
    showToast('⚠️ Save failed: ' + err.message);
    setStatus(false);
  }
  closePopup();
};

// ── Logout ──
window.logoutUser = async function () {
  try {
    await fetch(`${API_BASE}/logout`, { method: 'POST', credentials: 'include' });
  } catch (err) {
    console.error('Logout error:', err);
  }
  localStorage.removeItem('ayurSession');
  window.location.href = 'index.html';
};

// ── Auth guard ──
function checkAuth() {
  const sessionStr = localStorage.getItem('ayurSession');
  if (sessionStr) {
    try {
      const sess = JSON.parse(sessionStr);
      if (sess.role === 'admin') {
        unlockDashboard();
        loadRemedies();
        return;
      }
    } catch(e) {}
  }
  window.location.href = 'index.html';
}

// Run auth check on load
checkAuth();