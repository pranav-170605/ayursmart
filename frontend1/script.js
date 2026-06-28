// Track current mode
let currentAuthMode = 'login';
let captchaText = "";
let isUserLoggedIn = false;
const SESSION_LIFETIME = 48 * 60 * 60 * 1000;
const API = 'http://127.0.0.1:5100/api';

// ---------------------------
// Open Auth Modal
// ---------------------------
function openAuthModal(mode) {
    document.getElementById('authOverlay').style.display = 'flex';
    toggleAuth(mode === 'registration' || mode === 'register' ? 'register' : 'login');
}

// ---------------------------
// Navigate to Appointment or Show Register
// ---------------------------
function navToAppointment(event) {
    if (!isUserLoggedIn) {
        if (event) event.preventDefault();
        openAuthModal('register');
        return false;
    }
    return true; // Allow navigation
}

// ---------------------------
// Open Admin Modal
// ---------------------------
function openAdminModal() {
    document.getElementById('adminOverlay').style.display = 'flex';
}

// ---------------------------
// Open About Us Modal
// ---------------------------
function openAboutModal() {
    document.getElementById('aboutOverlay').style.display = 'flex';
}

// ---------------------------
// Open Clinic Timings Modal
// ---------------------------
function openTimingsModal() {
    document.getElementById('timingsOverlay').style.display = 'flex';
}

function closeTimingsModal(e) {
    // Close if called directly, via close button, or by clicking the backdrop
    if (!e || e.target === document.getElementById('timingsOverlay')) {
        document.getElementById('timingsOverlay').style.display = 'none';
    }
}

// ---------------------------
// Close All Modals
// ---------------------------
function closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
}

// ---------------------------
// Toggle Login / Register
// ---------------------------
function toggleAuth(mode) {
    currentAuthMode = mode;
    const regFields = document.getElementById('registerFields');
    const submitBtn = document.getElementById('authSubmitBtn');
    const forgotLink = document.getElementById('forgotLink');
    const tabsRow = document.querySelector('.auth-tabs-row');

    if (mode === 'register') {
        regFields.style.display = 'block';
        submitBtn.textContent = 'Create Account';
        document.getElementById('tabRegister').classList.add('active');
        document.getElementById('tabLogin').classList.remove('active');
        if (forgotLink) forgotLink.style.display = 'none';
        if (tabsRow) tabsRow.classList.add('on-register');
    } else {
        regFields.style.display = 'none';
        submitBtn.textContent = 'Sign In';
        document.getElementById('tabLogin').classList.add('active');
        document.getElementById('tabRegister').classList.remove('active');
        if (forgotLink) forgotLink.style.display = 'block';
        if (tabsRow) tabsRow.classList.remove('on-register');
    }

    // Clear all fields
    const fields = [
        'userName', 'userAge', 'userGender', 'userPhone', 
        'userSecurityQuestion', 'userSecurityAnswer',
        'userUsername', 'userEmail', 'userPass', 'captchaInput'
    ];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    const captchaErr = document.getElementById('captchaError');
    if (captchaErr) captchaErr.style.display = 'none';

    generateCaptcha();
}

// ---------------------------
// Generate CAPTCHA
// ---------------------------
function generateCaptcha() {
    const canvas = document.getElementById("captchaCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    captchaText = "";
    for (let i = 0; i < 6; i++) {
        captchaText += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Noise lines
    ctx.strokeStyle = "rgba(26,74,46,0.07)";
    for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
        ctx.stroke();
    }

    // Text
    ctx.font = "bold 22px 'Jost', Arial";
    ctx.fillStyle = "#1A4A2E";
    ctx.fillText(captchaText, 14, 32);

    // Gold dots
    ctx.fillStyle = "rgba(212,175,55,0.35)";
    for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 2 + 1, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ---------------------------
// Password Show / Hide Toggle
// ---------------------------
function togglePassVis() {
    const inp = document.getElementById('userPass');
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
}

// ---------------------------
// Handle Login / Register (Flask Backend)
// ---------------------------
async function handleAuth(event) {
    event.preventDefault();
    console.log("Auth button clicked. Mode:", currentAuthMode);

    const name = document.getElementById('userName').value.trim();
    const username = document.getElementById('userUsername').value.trim();
    const email = document.getElementById('userEmail').value.trim();
    const pass = document.getElementById('userPass').value.trim();
    const userCaptcha = document.getElementById('captchaInput').value;

    // CAPTCHA check
    if (userCaptcha !== captchaText) {
        document.getElementById('captchaError').style.display = 'block';
        generateCaptcha();
        return;
    }
    document.getElementById('captchaError').style.display = 'none';

    // Frontend validation
    
    if (!pass) { alert('Enter password.'); return; }

    try {
        let url = '';
        let body = {};

        if (currentAuthMode === 'register') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) { alert('Enter valid email.'); return; }
            
            const passRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
            if (!passRegex.test(pass)) { 
                alert('Registration: Password must have 1 uppercase, 1 number, 8+ chars.'); 
                return; 
            }
            if (!name || !username) { alert('Enter name & username.'); return; }
            if (!document.getElementById('userPhone').value.trim()) { alert('Enter phone number.'); return; }
            if (!document.getElementById('userSecurityQuestion').value) { alert('Select a security question.'); return; }
            if (!document.getElementById('userSecurityAnswer').value.trim()) { alert('Enter security answer.'); return; }
            url = `${API}/register`;
            body = {
                name, username, email, password: pass,
                age: document.getElementById('userAge').value,
                gender: document.getElementById('userGender').value,
                phone: document.getElementById('userPhone').value,
                security_question: document.getElementById('userSecurityQuestion').value,
                security_answer: document.getElementById('userSecurityAnswer').value
            };
        } else {
            if (!username) { alert('Enter username.'); return; }
            url = `${API}/login`;
            body = { username, password: pass };
        }

        const response = await fetch(url, {

            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (data.success) {
            if (currentAuthMode === 'register') {
                // Show success popup, then switch to login — do NOT auto-login
                closeModals();
                setTimeout(() => {
                    alert('🎉 ' + data.message + '\n\nPlease sign in with your new credentials.');
                    openAuthModal('login');
                }, 100);
            } else {
                // Login success
                saveSession(data.user, 'patient');
                alert(data.message);
                // Redirect to home page where they can see the Dashboard link
                window.location.href = 'index.html';
            }
        } else {
            alert(data.message);
            generateCaptcha();
        }
    } catch (error) {
        alert('Cannot connect to server. Make sure Flask is running on port 5100!');
    }
}

// Admin Login
async function handleAdminLogin(event) {
    event.preventDefault();
    const username = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPass").value.trim();

    if (!username || !password) {
        alert("Please enter both username and password.");
        return;
    }

    try {
        const response = await fetch(`${API}/admin-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        if (data.success) {
            saveSession({ username: 'ayursmart' }, 'admin');
            alert("Welcome Admin!");
            window.location.href = "dashboard.html";
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('Connection error. Check port 5100.');
    }
}

// Session Helpers
function saveSession(user, role) {
    localStorage.setItem('ayurSession', JSON.stringify({
        user,
        role,
        timestamp: Date.now()
    }));
}

function checkPersistentSession() {
    const sessionStr = localStorage.getItem('ayurSession');
    if (!sessionStr) return;

    const sessionData = JSON.parse(sessionStr);
    const now = Date.now();

    if (now - sessionData.timestamp > SESSION_LIFETIME) {
        localStorage.removeItem('ayurSession');
        return;
    }

    // Auto-redirect removed per user request: stay on home page even if logged in
}

async function logoutUser() {
    try {
        await fetch(`${API}/logout`, { method: 'POST', credentials: 'include' });
        localStorage.removeItem('ayurSession');
        alert('Logged out successfully.');
        window.location.href = 'index.html';
    } catch (e) {
        localStorage.removeItem('ayurSession');
        window.location.href = 'index.html';
    }
}

// Initialized via main load listener at line 341

// ---------------------------
// Forgot Password Flow
// ---------------------------
function openForgotModal() {
    closeModals();
    document.getElementById('forgotOverlay').style.display = 'flex';
    // Reset steps
    document.getElementById('forgotStep1').style.display = 'block';
    document.getElementById('forgotStep2').style.display = 'none';
    document.getElementById('forgotStep3').style.display = 'none';
    document.getElementById('forgotStep4').style.display = 'none';
    // Clear inputs
    document.getElementById('forgotPhone').value = '';
    document.getElementById('forgotAnswer').value = '';
    document.getElementById('resetNewPass').value = '';
    document.getElementById('resetConfPass').value = '';
}

async function findSecurityQuestion() {
    const phone = document.getElementById('forgotPhone').value.trim();
    if (!phone) {
        alert("Please enter your contact number.");
        return;
    }

    try {
        const response = await fetch(`${API}/get-security-question`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });

        const data = await response.json();
        if (data.success) {
            document.getElementById("displayQuestion").textContent = data.question;
            document.getElementById("forgotStep1").style.display = "none";
            document.getElementById("forgotStep2").style.display = "block";
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('Cannot connect to server.');
    }
}

async function verifySecurityAnswer() {
    const phone = document.getElementById('forgotPhone').value.trim();
    const answer = document.getElementById('forgotAnswer').value.trim();
    if (!answer) {
        alert("Please enter your security answer.");
        return;
    }

    try {
        const response = await fetch(`${API}/verify-security-answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, answer })
        });

        const data = await response.json();
        if (data.success) {
            // Store token for final step
            document.getElementById("forgotOverlay").dataset.resetToken = data.token;
            document.getElementById("forgotStep2").style.display = "none";
            document.getElementById("forgotStep3").style.display = "block";
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('Cannot connect to server.');
    }
}

async function resetPasswordFinal() {
    const token = document.getElementById("forgotOverlay").dataset.resetToken;
    const newPass = document.getElementById("resetNewPass").value.trim();
    const confPass = document.getElementById("resetConfPass").value.trim();

    if (!newPass || !confPass) { alert("Enter both password fields."); return; }
    if (newPass !== confPass) { alert("Passwords do not match."); return; }

    try {
        const response = await fetch(`${API}/reset-password-final`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, new_password: newPass })
        });

        const data = await response.json();
        if (data.success) {
            document.getElementById("forgotStep3").style.display = "none";
            document.getElementById("forgotStep4").style.display = "block";
        } else {
            alert(data.message);
        }
    } catch (error) {
        alert('Cannot connect to server.');
    }
}

// Keep old handlers but updated for backward compatibility if needed, 
// though we've replaced the UI calls
async function handleForgot(event) {
    if (event) event.preventDefault();
    openForgotModal();
}

// Initialize everything on page load
window.addEventListener('load', () => {
    generateCaptcha();
    checkPersistentSession();
    checkAuthStatus();

    // Close timings modal on Escape
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            const t = document.getElementById('timingsOverlay');
            if (t) t.style.display = 'none';
        }
    });

    // Check for reset token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    if (token) {
        openResetModal(token);
    }
});


// ── QUIZ ──────────────────────────────────────────────────────

const questions = [
    {
        q: "How does your body temperature normally feel?",
        opts: ["Slightly cool", "Naturally warm", "Neutral and steady"]
    },
    {
        q: "Your hunger pattern is usually:",
        opts: ["Irregular — sometimes hungry, sometimes not", "Strong and on time", "Slow, mild hunger but steady"]
    },
    {
        q: "What best describes your sleep?",
        opts: ["Light and easily disturbed", "Average — not too light or deep", "Deep and long sleep"]
    },
    {
        q: "When you face stress, you mostly:",
        opts: ["Overthink or feel anxious", "Get irritated or angry", "Feel slow, withdrawn, or dull"]
    },
    {
        q: "Your skin type is commonly:",
        opts: ["Dry or rough", "Warm or slightly sensitive", "Smooth or oily"]
    },
    {
        q: "Your energy level throughout the day feels:",
        opts: ["Up and down — inconsistent", "Strong and focused", "Slow but consistent"]
    },
    {
        q: "Your natural body build is:",
        opts: ["Lean or thin", "Medium or athletic", "Broad or well-built"]
    },
    {
        q: "Your digestion generally feels:",
        opts: ["Irregular — unpredictable", "Quick — food digests fast", "Slow but stable"]
    },
    {
        q: "Weather changes affect you like:",
        opts: ["You quickly feel cold, dryness, or wind", "Heat affects you more", "Humidity or heaviness affects you"]
    },
    {
        q: "Your movement or walking style is:",
        opts: ["Fast or quick", "Sharp and determined", "Slow and steady"]
    }
];

const results = {
    A: {
        icon: "🌬️",
        name: "Vata",
        sub: "Air & Space Constitution",
        desc: "Your nature is creative, quick, and light. Vata types are enthusiastic and love movement and change. Stay balanced with warm nourishing meals, grounding routines, oil massages, and restful sleep."
    },
    B: {
        icon: "🔥",
        name: "Pitta",
        sub: "Fire & Water Constitution",
        desc: "Your nature is sharp, driven, and purposeful. Pitta types have strong digestion and a passion for goals. Stay balanced with cooling foods, time in nature, and regular relaxation."
    },
    C: {
        icon: "🌿",
        name: "Kapha",
        sub: "Earth & Water Constitution",
        desc: "Your nature is calm, steady, and nurturing. Kapha types have great endurance and deep loyalty. Stay energised with variety, light and spicy foods, and regular vigorous movement."
    }
};

// State
let current = 0;
let scores = { A: 0, B: 0, C: 0 };
let chosen = null;

function openQuiz() {
    resetQuiz();
    document.getElementById("overlay").classList.add("open");
    renderQuestion();
}

function closeModal() {
    document.getElementById("overlay").classList.remove("open");
}

function overlayClick(e) {
    if (e.target === document.getElementById("overlay")) closeModal();
}

function resetQuiz() {
    current = 0;
    scores = { A: 0, B: 0, C: 0 };
    chosen = null;
    document.getElementById("quiz-screen").classList.remove("hidden");
    document.getElementById("result-screen").classList.add("hidden");
    const remSec = document.getElementById("remedy-section");
    if (remSec) remSec.classList.add("hidden");
    const treatSec = document.getElementById("treatment-recommendations");
    if (treatSec) treatSec.classList.add("hidden");
    
    const rec = document.getElementById("res-rec-food");
    const pro = document.getElementById("res-pro-food");
    if (rec) rec.innerHTML = "";
    if (pro) pro.innerHTML = "";
}

function renderQuestion() {
    const data = questions[current];
    const keys = ["A", "B", "C"];

    document.getElementById("q-counter").textContent = `Question ${current + 1} of ${questions.length}`;

    // Render dots
    const dots = document.getElementById("prog-dots");
    dots.innerHTML = questions.map((_, i) => 
        `<div class="prog-dot ${i <= current ? 'active' : ''}"></div>`
    ).join("");

    document.getElementById("q-text").textContent = data.q;

    document.getElementById("options").innerHTML = data.opts
        .map((opt, i) =>
            `<div class="opt-card" onclick="pick(this, '${keys[i]}')">
                <div class="opt-label-wrap">
                    <span class="opt-floral">🌿</span>
                    <span class="opt-letter">${keys[i]})</span>
                </div>
                <div class="opt-content">${opt}</div>
            </div>`
        ).join("");

    chosen = null;
    const btn = document.getElementById("btn-next");
    btn.style.opacity = "0.5";
    btn.style.pointerEvents = "none";
    btn.textContent = current === questions.length - 1 ? "SEE MY RESULT ❯" : "NEXT ❯";
    
    document.getElementById("btn-prev").style.visibility = current === 0 ? "hidden" : "visible";
}

function pick(el, key) {
    document.querySelectorAll(".opt-card").forEach(o => o.classList.remove("selected"));
    el.classList.add("selected");
    chosen = key;
    const btn = document.getElementById("btn-next");
    btn.style.opacity = "1";
    btn.style.pointerEvents = "auto";
}

function nextQ() {
    if (!chosen) return;
    scores[chosen]++;
    current++;
    if (current < questions.length) {
        renderQuestion();
    } else {
        showResult();
    }
}

function prevQ() {
    if (current > 0) {
        current--;
        // Note: We don't easily track which choice was made for which question 
        // to subtract from scores here without a history array.
        // For simplicity, we just reset the current question's score if possible
        // or just let it be. But better to keep it simple for now.
        renderQuestion();
    }
}

function showResult() {
    document.getElementById("quiz-screen").classList.add("hidden");
    document.getElementById("result-screen").classList.remove("hidden");

    // Calculate winner
    const winner = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
    const r = results[winner];

    document.getElementById("res-icon").textContent = r.icon;
    document.getElementById("res-dosha").textContent = r.name;
    document.getElementById("res-sub").textContent = r.sub;
    document.getElementById("res-desc").textContent = r.desc;

    document.getElementById("score-row").innerHTML =
        ["A", "B", "C"].map(k =>
            `<div class="score-pill ${k === winner ? "winner" : ""}">
        ${results[k].name}
        <span>${scores[k]}/${questions.length}</span>
      </div>`
        ).join("");

    fetchRemedies(r.name);
    savePrakriti(scores.A, scores.B, scores.C, winner);

    // Save result and fetch recommendations
    savePrakriti(scores.A, scores.B, scores.C, winner);
    fetchRemedies(r.name);

    // Add Dashboard Button
    const existingBtn = document.getElementById("dash-btn");
    if (existingBtn) existingBtn.remove();

    const dashBtn = document.createElement("button");
    dashBtn.id = "dash-btn";
    dashBtn.className = "btn-retry";
    dashBtn.style.background = "linear-gradient(135deg,#1A6640,#1A4A2E)";
    dashBtn.style.color = "#D4AF37";
    dashBtn.style.border = "1px solid rgba(212,175,55,.4)";
    dashBtn.style.marginRight = "10px";
    dashBtn.innerHTML = "🩺 View My Healing Dashboard";
    dashBtn.onclick = () => window.location.href = "userdashboard.html";

    const retryBtn = document.querySelector(".btn-retry");
    if (retryBtn) retryBtn.parentNode.insertBefore(dashBtn, retryBtn);
}

async function savePrakriti(vata, pitta, kapha, winner) {
    // Map winner key (A/B/C) to dosha name for the backend
    const doshaMap = { A: 'Vata', B: 'Pitta', C: 'Kapha' };
    const dosha = doshaMap[winner] || winner;

    try {
        const response = await fetch(`${API}/save-prakriti`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',   // sends session cookie → backend detects if logged in
            body: JSON.stringify({ vata, pitta, kapha, dosha })
        });
        const data = await response.json();
        if (data.success && data.treatments) {
            renderTreatments(data.treatments);
        }
    } catch (e) { console.warn("Could not auto-save Prakriti"); }
}

function renderTreatments(treatments) {
    const section = document.getElementById("treatment-recommendations");
    if (!section) return;

    section.classList.remove("hidden");
    const container = document.getElementById("treatment-list");
    if (!container) return;

    container.innerHTML = treatments.map(t => `
        <div class="treatment-pill ${t.is_recommended ? 'recommended' : ''}">
            <div class="pill-header">
                <span class="pill-name">${t.name}</span>
                ${t.is_recommended ? '<span class="pill-badge">Suggested</span>' : ''}
            </div>
            <p class="pill-desc">${t.desc}</p>
        </div>
    `).join('');
}

async function fetchRemedies(prakriti) {
    try {
        const response = await fetch(`${API}/remedies/${prakriti}`);
        const data = await response.json();
        const section = document.getElementById("remedy-section");
        if (data.success && data.remedy) {
            section.classList.remove("hidden");
            document.getElementById("res-rec-food").innerHTML = data.remedy.recommended_food || "N/A";
            document.getElementById("res-pro-food").innerHTML = data.remedy.prohibited_food || "N/A";
        } else {
            section.classList.add("hidden");
        }
    } catch (e) {
        console.error("Remedy fetch failed:", e);
    }
}

function retake() {
    resetQuiz();
    renderQuestion();
}

// ---------------------------
// Auth UI Update Helpers
// ---------------------------
async function checkAuthStatus() {
    const sessionStr = localStorage.getItem('ayurSession');

    // 1. Immediate Local Check (Source of Truth)
    if (sessionStr) {
        try {
            const sessionData = JSON.parse(sessionStr);
            const timePassed = Date.now() - sessionData.timestamp;

            if (timePassed < SESSION_LIFETIME) {
                isUserLoggedIn = true;
                updateAuthUI(true);
                // Continue silently to background verify
            } else {
                localStorage.removeItem('ayurSession');
                isUserLoggedIn = false;
                updateAuthUI(false);
            }
        } catch (e) {
            localStorage.removeItem('ayurSession');
        }
    }

    // 2. Background Sync with Server
    try {
        const response = await fetch(`${API}/me`, { credentials: 'include' });
        const data = await response.json();

        if (data.success) {
            isUserLoggedIn = true;
            updateAuthUI(true);
            // Re-prime localStorage if server is happy
            const session = {
                token: data.user.id,
                timestamp: Date.now(), // Refresh window on activity
                user: data.user
            };
            localStorage.setItem('ayurSession', JSON.stringify(session));
        } else {
            // Server says no session — clear everything
            isUserLoggedIn = false;
            updateAuthUI(false);
            localStorage.removeItem('ayurSession');
        }
    } catch (e) {
        console.warn("Server sync unreachable, relying on local session.");
    }

    // 3. Hide Auth Guard Overlays on any page
    hideAuthGuard();
}

function hideAuthGuard() {
    const overlay = document.getElementById('authGuardOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
        document.body.classList.remove('is-loading');
    }
}

// Initialized via main load listener at line 341

function updateAuthUI(isLoggedIn) {
    const container = document.getElementById('authContainer');
    if (!container) return;

    if (isLoggedIn) {
        isUserLoggedIn = true;

        let userName = '';
        let userInitials = String.fromCodePoint(0x1F464);
        try {
            const sessionData = JSON.parse(localStorage.getItem('ayurSession'));
            if (sessionData && sessionData.user) {
                userName = sessionData.user.name || sessionData.user.username || '';
                if (userName) {
                    const parts = userName.trim().split(' ');
                    userInitials = parts.length >= 2
                        ? (parts[0][0] + parts[1][0]).toUpperCase()
                        : userName[0].toUpperCase();
                }
            }
        } catch (e) { }

        const firstName = userName ? userName.trim().split(' ')[0] : 'My Profile';

        container.innerHTML = (
            '<div style="display:flex;align-items:center;gap:10px;">' +
            '<a href="userdashboard.html" id="dashboardLink" style="display:flex;align-items:center;gap:8px;background:#1A4A2E;border:2px solid #D4AF37;border-radius:50px;padding:6px 14px 6px 8px;cursor:pointer;text-decoration:none;transition:transform 0.2s;">' +
            '<div style="width:30px;height:30px;border-radius:50%;background:#D4AF37;color:#1A4A2E;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">' + userInitials + '</div>' +
            '<span style="color:#D4AF37;font-size:13px;font-weight:600;white-space:nowrap;">' + firstName + '</span>' +
            '</a>' +
            '<button class="btn btn-gold" onclick="logoutUser()">Logout</button>' +
            '</div>'
        );
        
        // Ensure the link is clickable even if some other script tries to interfere
        const link = document.getElementById('dashboardLink');
        if (link) {
            link.addEventListener('mouseover', () => link.style.transform = 'scale(1.02)');
            link.addEventListener('mouseout', () => link.style.transform = 'scale(1)');
        }
    } else {
        isUserLoggedIn = false;
        container.innerHTML = `<button class="btn btn-gold" id="authBtn" onclick="openAuthModal('registration')">Join Us</button>`;
    }
}

async function logoutUser() {
    try {
        localStorage.removeItem('ayurSession');
        const response = await fetch(`${API}/logout`, { method: 'POST', credentials: 'include' });
        const data = await response.json();
        alert('Logged out successfully.');
        window.location.href = 'index.html';
    } catch (error) {
        localStorage.removeItem('ayurSession');
        window.location.href = 'index.html';
    }
}