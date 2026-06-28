// ============================================================
//  AyurSmart — user_dashboard.js
//  Fetch API with credentials:'include' for session auth
// ============================================================

const BACKEND_API = 'http://127.0.0.1:5100';   // Flask backend

// ── Helpers ──────────────────────────────────────────────────

function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.borderLeftColor = isError ? '#e53935' : '#D4AF37';
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

function unlockPage() {
    const overlay = document.getElementById('authOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
        setTimeout(() => overlay.style.display = 'none', 450);
    }
}

async function apiFetch(path, options = {}) {
    try {
        const res = await fetch(BACKEND_API + path, {
            credentials: 'include',   // send session cookie
            headers: { 'Content-Type': 'application/json' },
            ...options
        });

        // Auth guard: if server returns 401, go back to login
        if (res.status === 401) {
            window.location.href = 'index.html';
            return null;
        }

        return res;
    } catch (e) {
        console.error('Fetch error:', e);
        showToast('Connection to server failed. Please ensure the backend is running.', true);
        return null;
    }
}

// ── Dosha helpers ─────────────────────────────────────────────

const DOSHA_META = {
    'Vata': { emoji: '🌬️', letters: 'VATA', color: '#6b8fd6' },
    'Pitta': { emoji: '🔥', letters: 'PITTA', color: '#D4AF37' },
    'Kapha': { emoji: '💧', letters: 'KAPHA', color: '#5aaa7e' },
    'Pitta-Kapha': { emoji: '🔥', letters: 'PITTA-KAPHA', color: '#D4AF37' },
    'Vata-Pitta': { emoji: '🌬️', letters: 'VATA-PITTA', color: '#a07bd6' },
    'Vata-Kapha': { emoji: '🌬️', letters: 'VATA-KAPHA', color: '#6baaa0' },
};

function getDoshaMeta(dosha) {
    return DOSHA_META[dosha] || { emoji: '🌿', letters: dosha, color: '#D4AF37' };
}

// ── Load Profile ──────────────────────────────────────────────

async function loadProfile() {
    const res = await apiFetch('/api/dashboard/profile');
    if (!res) return;

    if (!res.ok) { showToast('Could not load profile', true); return; }

    const data = await res.json();

    document.getElementById('welcomeName').textContent = `Welcome, ${data.name}!`;
    document.getElementById('joinedDate').textContent = `(Joined ${data.joined})`;
    document.getElementById('avatarInitials').textContent = data.initials;
}

// ── Load Prakriti ─────────────────────────────────────────────

async function loadPrakriti() {
    const res = await apiFetch('/api/dashboard/prakriti');
    if (!res) return;

    if (!res.ok) {
        document.getElementById('doshaName').textContent = 'Take the quiz to discover your Dosha';
        return;
    }

    const data = await res.json();

    if (!data.dosha) {
        document.getElementById('doshaName').textContent = 'No quiz result yet';
        document.getElementById('doshaLetters').textContent = '? ?';
        return;
    }

    const meta = getDoshaMeta(data.dosha);
    document.getElementById('doshaEmoji').textContent = meta.emoji;
    document.getElementById('doshaLetters').textContent = meta.letters;
    document.getElementById('doshaLetters').style.color = meta.color;
    document.getElementById('doshaName').textContent = data.dosha;
    document.getElementById('doshaPct').textContent = data.percentage ? `(${data.percentage})` : '';
    if (data.description) {
        document.getElementById('doshaDesc').textContent = data.description;
    }
}

// ── Load Remedies ─────────────────────────────────────────────

async function loadRemedies() {
    const res = await apiFetch('/api/dashboard/remedies');
    if (!res) return;

    if (!res.ok) {
        document.getElementById('recommendedList').innerHTML =
            '<li style="color:#9a9a88">Take the Prakriti quiz first to see your remedies.</li>';
        document.getElementById('prohibitedList').innerHTML = '';
        return;
    }

    const data = await res.json();

    // Recommended foods
    const recList = document.getElementById('recommendedList');
    recList.innerHTML = data.recommended_foods.length
        ? data.recommended_foods.map(f => `<li>${f}</li>`).join('')
        : '<li style="color:#9a9a88">No data available.</li>';

    // Prohibited foods
    const proList = document.getElementById('prohibitedList');
    proList.innerHTML = data.prohibited_foods.length
        ? data.prohibited_foods.map(f => `<li>${f}</li>`).join('')
        : '<li style="color:#9a9a88">No data available.</li>';
}

// ── Toggle remedy section ─────────────────────────────────────

window.toggleSection = function (which) {
    const listId = which === 'recommended' ? 'recommendedList' : 'prohibitedList';
    const list = document.getElementById(listId);
    list.classList.toggle('collapsed');
};

// ── Load Appointments ─────────────────────────────────────────

async function loadAppointments() {
    const res = await apiFetch('/api/dashboard/appointments');
    if (!res) return;

    const container = document.getElementById('apptList');

    if (!res.ok) {
        container.innerHTML = '<p style="color:#9a9a88;font-size:13px">No appointments yet.</p>';
        return;
    }

    const appts = await res.json();

    if (!appts.length) {
        container.innerHTML = '<p style="color:#9a9a88;font-size:13px">No appointments yet. Book one below!</p>';
        return;
    }

    container.innerHTML = appts.slice(0, 6).map(a => {
        const isVerified = a.utr_verified;
        const isPending = a.status === 'Pending Approval';
        const isCancelled = a.status === 'Cancelled';

        const dotClass = isVerified ? 'verified' : isPending ? 'pending' : 'cancelled';
        const badge = isVerified
            ? '<span class="badge-verified">Booked</span>'
            : isPending
                ? '<span class="badge-pending">Pending</span>'
                : '<span class="badge-cancelled">Cancelled</span>';

        // Call button logic
        let callBtnHtml = '';
        if (a.meeting_link) {
            if (a.call_ready) {
                callBtnHtml = `<a href="${a.meeting_link}" target="_blank" class="btn-join-call pulse-glow">📞 Join Call Now</a>`;
            } else if (a.appt_datetime) {
                callBtnHtml = `<div class="call-scheduled" data-appt-time="${a.appt_datetime}" data-link="${a.meeting_link}">
                    <span class="call-icon">📞</span>
                    <span class="call-timer-text">Call link activates 5 min before ${a.time}</span>
                </div>`;
            }
        }

        // Cancel button logic
        let cancelBtnHtml = '';
        if (a.status !== 'Cancelled') {
            cancelBtnHtml = `<button class="btn-cancel-appt" onclick="confirmCancel(${a.id})">Cancel</button>`;
        }

        return `
      <div class="appt-item">
        <div class="appt-dot ${dotClass}"></div>
        <div class="appt-content">
          <div class="appt-title">
            ${badge}
            ${a.type} - ${a.date}, ${a.time}
            ${cancelBtnHtml}
          </div>
          <div class="appt-meta">(${a.doctor})</div>
          ${callBtnHtml}
          ${!callBtnHtml && a.meeting_link && a.status !== 'Cancelled' ? `<div class="call-scheduled"><span class="call-icon">📞</span> <span class="call-timer-text">Call link activates 5 min before ${a.time}</span></div>` : ''}
        </div>
      </div>`;
    }).join('');

    // Start timer to check if any call becomes ready
    startCallReadyChecker();
}

// ── Call Ready Checker (runs every 30s) ───────────────────────

let callCheckerInterval = null;

function startCallReadyChecker() {
    if (callCheckerInterval) clearInterval(callCheckerInterval);

    callCheckerInterval = setInterval(() => {
        const scheduledCalls = document.querySelectorAll('.call-scheduled');
        const now = new Date();

        scheduledCalls.forEach(el => {
            const apptTime = new Date(el.dataset.apptTime);
            const link = el.dataset.link;
            const diffMin = (apptTime - now) / 60000;

            // Activate 5 minutes before, keep active until 30 min after
            if (diffMin <= 5 && diffMin >= -30 && link) {
                const btn = document.createElement('a');
                btn.href = link;
                btn.target = '_blank';
                btn.className = 'btn-join-call pulse-glow';
                btn.textContent = '📞 Join Call Now';
                el.replaceWith(btn);
            }
        });

        // Stop checking if no more scheduled calls
        if (!document.querySelectorAll('.call-scheduled').length) {
            clearInterval(callCheckerInterval);
            callCheckerInterval = null;
        }
    }, 30000); // Check every 30 seconds
}

// ── Load Doctors for Booking ──────────────────────────────────

async function loadDoctors() {
    const res = await apiFetch('/api/doctors');
    if (!res || !res.ok) return;

    const doctors = await res.json();
    const sel = document.getElementById('b-doctor');
    sel.innerHTML = '<option value="">Select doctor…</option>' +
        doctors.map(d => `<option value="${d.id}">${d.name}${d.specialty ? ' — ' + d.specialty : ''}</option>`).join('');
}

// ── Book Appointment ──────────────────────────────────────────

window.openBookModal = function () {
    document.getElementById('bookModal').classList.add('open');
    loadDoctors();
    
    // Set current date and time as defaults (default to 1 hour in the future)
    const now = new Date();
    now.setHours(now.getHours() + 1);
    document.getElementById('b-date').value = now.toISOString().split('T')[0];
    document.getElementById('b-time').value = now.toTimeString().substring(0,5);

    // Add change listeners for immediate validation
    ['b-date', 'b-time'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.dataset.hasListener) {
            el.addEventListener('change', validateSelectedSlot);
            el.dataset.hasListener = "true";
        }
    });

    // Reset phone group
    document.getElementById('b-mode').value = 'Offline';
    document.getElementById('b-phone-group').style.display = 'none';
};

// Handle mode change to show/hide phone number
document.getElementById('b-mode').addEventListener('change', function() {
    const phoneGroup = document.getElementById('b-phone-group');
    if (this.value === 'Call') {
        phoneGroup.style.display = 'block';
        // Prefill phone if available
        const navName = document.getElementById('navProfileName');
        // We can get phone from a global variable if we store it
    } else {
        phoneGroup.style.display = 'none';
    }
});

window.closeBookModal = function () {
    document.getElementById('bookModal').classList.remove('open');
};

window.closeSuccessModal = function() {
    document.getElementById('successModal').classList.remove('open');
};

window.copyModalLink = function() {
    const link = document.getElementById('s-link').textContent;
    navigator.clipboard.writeText(link).then(() => {
        showToast('✅ Link copied to clipboard!');
    });
};

function validateSelectedSlot() {
    const dateInput = document.getElementById('b-date').value;
    const timeInput = document.getElementById('b-time').value;
    if (!dateInput || !timeInput) return true;

    const [y, m, d_] = dateInput.split('-').map(Number);
    const [hh, mm] = timeInput.split(':').map(Number);
    const selectedDateObj = new Date(y, m - 1, d_, hh, mm);
    const now = new Date();

    if (selectedDateObj < now) {
        showToast('⚠️ This time slot has already passed.', true);
        return false;
    }
    return true;
}

window.submitBooking = async function () {
    const dateInput = document.getElementById('b-date').value;
    const timeInput = document.getElementById('b-time').value;
    const doctor = document.getElementById('b-doctor').value;
    const mode = document.getElementById('b-mode').value;
    const phone = document.getElementById('b-phone').value.trim();

    if (!dateInput || !timeInput) { showToast('Please select date and time', true); return; }

    if (!validateSelectedSlot()) {
        alert('❌ This time slot has already passed. Please select a future time.');
        return;
    }

    if (mode === 'Call') {
        if (!phone || phone.length < 10) {
            showToast('Please enter a valid 10-digit phone number for Call Consultation', true);
            return;
        }
    }

    const payload = {
        date: dateInput,
        time: timeInput,
        doctor_id: doctor || null,
        mode: mode,
        type: document.getElementById('b-type').value,
        utr_number: document.getElementById('b-utr').value.trim(),
        notes: document.getElementById('b-notes').value.trim(),
        phone: phone || null
    };

    const res = await apiFetch('/api/appointments/book', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    if (!res) return;

    if (res.ok) {
        const data = await res.json();
        closeBookModal();
        
        // Show Success Modal
        document.getElementById('s-date').textContent = data.appointment.appt_date;
        document.getElementById('s-time').textContent = data.appointment.appt_time;
        document.getElementById('s-type').textContent = data.appointment.consult_mode;
        
        const callBox = document.getElementById('s-call-box');
        if (data.appointment.meeting_link) {
            callBox.style.display = 'block';
            document.getElementById('s-link').textContent = data.appointment.meeting_link;
            document.getElementById('s-join-btn').href = data.appointment.meeting_link;
            
            // Add the 5-min message
            const noteEl = callBox.querySelector('.call-note');
            if (noteEl) {
                noteEl.innerHTML = `<strong>Note:</strong> You will get the join link 5 minutes before the call. <br>Please save this link.`;
            }
        } else {
            callBox.style.display = 'none';
        }
        
        document.getElementById('successModal').classList.add('open');
        loadAppointments();
    } else {
        const err = await res.json();
        showToast(err.error || 'Booking failed', true);
    }
};

// ── Cancel Appointment ────────────────────────────────────────

window.confirmCancel = function(aid) {
    const modal = document.getElementById('cancelModal');
    const btn = document.getElementById('confirmCancelBtn');
    
    btn.onclick = () => {
        cancelAppointment(aid);
        closeCancelModal();
    };
    
    modal.classList.add('open');
};

window.closeCancelModal = function() {
    document.getElementById('cancelModal').classList.remove('open');
};

async function cancelAppointment(aid) {
    const res = await apiFetch(`/api/appointments/cancel/${aid}`, {
        method: 'POST'
    });
    if (!res) return;

    if (res.ok) {
        showToast('✅ Appointment cancelled successfully.');
        loadAppointments();
    } else {
        const err = await res.json();
        showToast(err.message || 'Cancellation failed', true);
    }
}

// ── Health Journal ────────────────────────────────────────────

async function loadJournal() {
    const res = await apiFetch('/api/dashboard/journal');
    if (!res) return;

    const container = document.getElementById('journalList');

    if (!res.ok) {
        container.innerHTML = '<p style="color:#9a9a88;font-size:13px">No journal entries yet.</p>';
        return;
    }

    const entries = await res.json();

    if (!entries.length) {
        container.innerHTML = '<p style="color:#9a9a88;font-size:13px">No entries yet. Add your first note!</p>';
        return;
    }

    container.innerHTML = entries.map(e =>
        `<div class="journal-entry">
       <span class="j-date">${e.date}:</span>
       <span class="j-text"> ${e.note}</span>
     </div>`
    ).join('');
}

window.addJournalEntry = async function () {
    const input = document.getElementById('journalInput');
    const note = input.value.trim();
    if (!note) { showToast('Please enter a note', true); return; }

    const res = await apiFetch('/api/dashboard/journal', {
        method: 'POST',
        body: JSON.stringify({ note })
    });
    if (!res) return;

    if (res.ok) {
        input.value = '';
        showToast('📓 Note added!');
        loadJournal();
    } else {
        showToast('Failed to save note', true);
    }
};

// ── Logout ────────────────────────────────────────────────────

document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    await apiFetch('/api/logout', { method: 'POST' });
    window.location.href = 'index.html';
});

// ── Nav highlight on scroll ───────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function () {
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
    });
});

// ── Modal backdrop close ──────────────────────────────────────
document.getElementById('bookModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeBookModal();
});
document.getElementById('successModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeSuccessModal();
});
document.getElementById('cancelModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCancelModal();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        closeBookModal();
        closeSuccessModal();
        closeCancelModal();
    }
});

// ── Init ──────────────────────────────────────────────────────

async function init() {
    // Only run if we are on the dashboard page
    if (!document.getElementById('prakritiCard')) return;

    // Auth guard: profile fetch will redirect on 401
    const profileRes = await apiFetch('/api/dashboard/profile');
    
    if (!profileRes) {
        // If fetch failed completely (network error), still unlock so user sees something
        // but maybe show an error toast
        unlockPage();
        showToast("Error loading profile. Please check your connection.", true);
        return;
    }

    if (!profileRes.ok) {
        window.location.href = 'index.html';
        return;
    }

    const profileData = await profileRes.json();
    const welcomeEl = document.getElementById('welcomeName');
    if (welcomeEl) welcomeEl.textContent = `Welcome, ${profileData.name}!`;
    
    const joinedEl = document.getElementById('joinedDate');
    if (joinedEl) joinedEl.textContent = `(Joined ${profileData.joined})`;
    
    const initialEl = document.getElementById('avatarInitials');
    if (initialEl) initialEl.textContent = profileData.initials;

    // Populate sidebar profile card
    const navName = document.getElementById('navProfileName');
    const navAvatar = document.getElementById('navProfileAvatar');
    if (navName) navName.textContent = profileData.name || 'My Profile';
    if (navAvatar) navAvatar.textContent = profileData.initials || '👤';

    // Clicking the profile card scrolls to the profile section
    const navCard = document.getElementById('navProfileCard');
    if (navCard) {
        navCard.addEventListener('click', () => {
            document.getElementById('prakritiCard')?.scrollIntoView({ behavior: 'smooth' });
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        });
    }

    // Unlock the page
    unlockPage();

    // Load all sections in parallel
    await Promise.allSettled([
        loadPrakriti(),
        loadRemedies(),
        loadAppointments(),
        loadJournal(),
    ]);
}

// Safety net: unlock after 5s even if something fails
window.addEventListener('load', () => {
    setTimeout(() => {
        const o = document.getElementById('authOverlay');
        if (o && !o.classList.contains('hidden')) {
            unlockPage();
        }
    }, 5000);
});

// removed redundant updateHomeNavbar

init();

// ── Smart Slot Grid Logic ────────────────────────────────────

let selectedSlot = null;

const MORNING_SLOTS = ['10:00', '10:30', '11:00', '11:30', '12:00', '12:30'];
const EVENING_SLOTS = ['17:00', '17:30', '18:00', '18:30', '19:00', '19:30'];

window.loadBookedSlots = async function() {
    const doctorId = document.getElementById('b-doctor').value;
    const dateVal = document.getElementById('b-date').value;
    const grid = document.getElementById('slotGrid');

    if (!doctorId || !dateVal) {
        grid.innerHTML = '<p style="color:#9a9a88;font-size:13px">Select a date and doctor to see available slots</p>';
        return;
    }

    grid.innerHTML = '<p style="color:#9a9a88;font-size:13px">Loading slots…</p>';

    const res = await apiFetch(`/api/appointments/booked-slots?doctor_id=${doctorId}&date=${dateVal}`);
    if (!res || !res.ok) {
        grid.innerHTML = '<p style="color:#e53935;font-size:13px">Failed to load slots. Please try again.</p>';
        return;
    }

    const data = await res.json();
    renderSlotGrid(data.booked, dateVal);
};

function renderSlotGrid(booked, selectedDate) {
    const grid = document.getElementById('slotGrid');
    grid.innerHTML = '';
    selectedSlot = null;
    const bTimeInput = document.getElementById('b-time');
    if (bTimeInput) bTimeInput.value = '';

    const now = new Date();
    const isToday = selectedDate === now.toISOString().split('T')[0];

    const createSection = (title, slots, icon) => {
        const header = document.createElement('div');
        header.className = 'slot-session-title';
        header.innerHTML = `${icon} ${title}`;
        grid.appendChild(header);

        const container = document.createElement('div');
        container.className = 'slot-grid';

        slots.forEach(time => {
            const btn = document.createElement('button');
            btn.className = 'slot-btn';
            btn.textContent = time;
            btn.type = 'button';

            // Check if past
            let state = 'available';
            if (isToday) {
                const [h, m] = time.split(':').map(Number);
                const slotTime = new Date();
                slotTime.setHours(h, m, 0, 0);
                if (slotTime < now) state = 'past';
            }

            // Check if booked
            if (state !== 'past' && booked.includes(time)) {
                state = 'booked';
            }

            if (state === 'past') btn.classList.add('past');
            if (state === 'booked') btn.classList.add('booked');

            btn.onclick = (e) => handleSlotClick(time, state, e.currentTarget);
            container.appendChild(btn);
        });

        grid.appendChild(container);
    };

    createSection('Morning Session', MORNING_SLOTS, '🌅');
    createSection('Evening Session', EVENING_SLOTS, '🌆');
}

function handleSlotClick(time, state, btn) {
    if (state === 'past') {
        showSlotPopup(btn, 'past');
        return;
    }
    if (state === 'booked') {
        showSlotPopup(btn, 'booked');
        return;
    }

    // Select slot
    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedSlot = time;
    document.getElementById('b-time').value = time;
}

function showSlotPopup(btn, type) {
    // Remove existing popups
    document.querySelectorAll('.slot-popup').forEach(p => p.remove());

    const popup = document.createElement('div');
    popup.className = `slot-popup ${type === 'past' ? 'past-popup' : ''}`;
    
    if (type === 'booked') {
        popup.innerHTML = `<strong>🚫 Already Booked</strong><br>This slot is taken by another patient.<br>Please select a different time.`;
    } else {
        popup.innerHTML = `<strong>⛔ Time Passed</strong><br>This slot is no longer available today.<br>Please select a future time.`;
    }

    document.body.appendChild(popup);

    const rect = btn.getBoundingClientRect();
    popup.style.left = `${rect.left + (rect.width / 2) - 90}px`;
    popup.style.top = `${rect.bottom + window.scrollY + 8}px`;

    setTimeout(() => {
        popup.style.opacity = '0';
        popup.style.transform = 'translateY(5px) scale(0.95)';
        setTimeout(() => popup.remove(), 200);
    }, 2000);
}

// Attach listeners to date and doctor inputs
if (document.getElementById('b-date')) {
    document.getElementById('b-date').addEventListener('change', window.loadBookedSlots);
    document.getElementById('b-doctor').addEventListener('change', window.loadBookedSlots);
}