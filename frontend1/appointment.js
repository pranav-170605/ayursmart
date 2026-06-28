/* ============================================================
   MediCare Clinic — Appointment Booking · script.js
   ============================================================ */

// ─── STATE ───────────────────────────────────────────────────
const state = {
  selectedDate: null,
  selectedTime: null,
  consultMode: null,
  phoneNumber: '',
  paymentMethod: 'upi',
  paymentPaid: false,
  transactionId: '',
  user: null, // Logged in user info
  apiBase: 'http://127.0.0.1:5100/api'
};

// ─── AUTH CHECK ──────────────────────────────────────────────
async function checkAuth() {
  const sessionStr = localStorage.getItem('ayurSession');
  const SESSION_LIFETIME = 48 * 60 * 60 * 1000;

  // 1. Immediate Local Check (primary source of truth for file:// usage)
  if (sessionStr) {
    try {
      const sessionData = JSON.parse(sessionStr);
      if (Date.now() - sessionData.timestamp < SESSION_LIFETIME) {
        state.user = sessionData.user;
        renderUserSession();
        hideAuthGuard();
        return; // Local session is valid — no need for network call
      }
    } catch (e) {
      console.warn("Invalid local session format");
    }
  }

  // 2. Network Verify (fallback)
  try {
    const res = await fetch(`${state.apiBase}/me`, { credentials: 'include' });
    const data = await res.json();
    if (data.success) {
      state.user = data.user;
      renderUserSession();
      localStorage.setItem('ayurSession', JSON.stringify({
        token: data.user.id,
        timestamp: Date.now(),
        user: data.user
      }));
    } else if (!state.user) {
      window.location.href = 'index.html?login=required';
    }
  } catch (err) {
    console.error("Auth sync failed:", err);
    if (!state.user) {
      window.location.href = 'index.html';
    }
  } finally {
    hideAuthGuard();
  }
}

function renderUserSession() {
  const authContainer = document.getElementById('authContainer');
  if (authContainer) {
    authContainer.innerHTML = `<button class="btn btn-gold" onclick="logoutUser()">Logout</button>`;
  }
  updateSummary();
  if (state.user && state.user.phone) {
    const phoneInp = document.getElementById('phoneInput');
    if (phoneInp) phoneInp.value = state.user.phone;
    state.phoneNumber = state.user.phone;
  }
}

function hideAuthGuard() {
  const overlay = document.getElementById('authGuardOverlay');
  if (overlay) {
    overlay.classList.add('hidden');
    document.body.classList.remove('is-loading');
  }
}

// ─── CALENDAR ────────────────────────────────────────────────
let calYear, calMonth;
const today = new Date();

function initCalendar() {
  calYear = today.getFullYear();
  calMonth = today.getMonth();
  renderCalendar();
}

function renderCalendar() {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  document.getElementById('calMonthYear').textContent =
    `${monthNames[calMonth]} ${calYear}`;

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  // Empty cells before the 1st
  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.classList.add('cal-day', 'empty');
    grid.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement('div');
    cell.classList.add('cal-day');
    cell.textContent = d;

    const cellDate = new Date(calYear, calMonth, d);
    const isPast = cellDate < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const isSunday = cellDate.getDay() === 0;
    const isToday =
      d === today.getDate() &&
      calMonth === today.getMonth() &&
      calYear === today.getFullYear();

    if (isPast) cell.classList.add('past');
    if (isSunday) {
      cell.classList.add('sunday');
      const holidayTag = document.createElement('span');
      holidayTag.classList.add('holiday-tag');
      holidayTag.textContent = 'Holiday';
      cell.appendChild(holidayTag);
    }
    if (isToday) cell.classList.add('today');

    if (
      state.selectedDate &&
      state.selectedDate.d === d &&
      state.selectedDate.m === calMonth &&
      state.selectedDate.y === calYear
    ) {
      cell.classList.add('selected');
    }

    if (!isPast && !isSunday) {
      cell.addEventListener('click', () => selectDate(d, calMonth, calYear, cellDate));
    }
    if (isSunday) {
      cell.addEventListener('click', () => showToast('🚫 Sundays are holidays. Please select another day.', 'error'));
    }

    grid.appendChild(cell);
  }
}

function selectDate(d, m, y, dateObj) {
  state.selectedDate = { d, m, y, dateObj };
  renderCalendar();

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const label = `${dayNames[dateObj.getDay()]}, ${d} ${monthNames[m]} ${y}`;
  document.getElementById('selectedDateDisplay').textContent = label;
  updateSummary();
  updateSlotAvailability();
}

document.getElementById('prevMonth').addEventListener('click', () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
});

// Helper to check if the currently selected date is today
function isSelectedDateToday() {
  if (!state.selectedDate || !state.selectedDate.dateObj) return false;
  const now = new Date();
  const d = state.selectedDate.dateObj;
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

// Parse slot time (e.g. "10:30 AM") into hours and minutes
function parseSlotTime(timeStr) {
  const match = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return { hours: 0, minutes: 0 };
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hours < 12) {
    hours += 12;
  } else if (ampm === 'AM' && hours === 12) {
    hours = 0;
  }
  return { hours, minutes };
}

// Dynamically check and block/disable slots in the past or within 30-min buffer
function updateSlotAvailability() {
  const container = document.getElementById('timeSlots');
  if (!container) return;
  const buttons = container.querySelectorAll('.slot-btn');
  const now = new Date();
  const isToday = isSelectedDateToday();
  let selectedSlotInvalidated = false;

  buttons.forEach(btn => {
    const slot = btn.textContent;
    if (isToday) {
      const { hours, minutes } = parseSlotTime(slot);
      const slotTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
      const bufferMs = 30 * 60 * 1000; // 30 minutes in milliseconds
      
      // Disable slot if it's at/before current time + buffer
      if (slotTime.getTime() <= now.getTime() + bufferMs) {
        btn.disabled = true;
        if (state.selectedTime === slot) {
          btn.classList.remove('active');
          state.selectedTime = null;
          selectedSlotInvalidated = true;
        }
      } else {
        btn.disabled = false;
      }
    } else {
      btn.disabled = false;
    }
  });

  if (selectedSlotInvalidated) {
    updateSummary();
  }
}

// ─── TIME SLOTS ──────────────────────────────────────────────
function initTimeSlots() {
  const container = document.getElementById('timeSlots');
  container.innerHTML = '';

  const slots = [];

  // Helper to format time as AM/PM
  const formatTime = (hour, min) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    const m = min < 10 ? '0' + min : min;
    return `${h}:${m} ${ampm}`;
  };

  // Morning Shift: 10:00 AM to 1:00 PM (13:00)
  for (let h = 10; h < 13; h++) {
    slots.push(formatTime(h, 0));
    slots.push(formatTime(h, 30));
  }

  // Evening Shift: 5:00 PM (17:00) to 8:00 PM (20:00)
  for (let h = 17; h < 20; h++) {
    slots.push(formatTime(h, 0));
    slots.push(formatTime(h, 30));
  }

  slots.forEach(slot => {
    const btn = document.createElement('button');
    btn.classList.add('slot-btn');
    btn.textContent = slot;
    btn.addEventListener('click', () => selectSlot(btn, slot));
    container.appendChild(btn);
  });

  updateSlotAvailability();
}

function selectSlot(btn, slot) {
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.selectedTime = slot;
  updateSummary();
}

// ─── CONSULTATION MODE ───────────────────────────────────────
function selectMode(mode) {
  state.consultMode = mode;

  document.getElementById('btnCall').classList.toggle('active', mode === 'call');
  document.getElementById('btnOffline').classList.toggle('active', mode === 'offline');

  const phoneWrap = document.getElementById('phoneWrap');
  if (mode === 'call') {
    phoneWrap.classList.remove('hidden');
  } else {
    phoneWrap.classList.add('hidden');
    document.getElementById('phoneInput').value = '';
    state.phoneNumber = '';
  }
  updateSummary();
}

document.getElementById('phoneInput').addEventListener('input', function () {
  state.phoneNumber = this.value.trim();
});

// ─── PAYMENT ─────────────────────────────────────────────────
function onPaymentMethodChange() {
  const method = document.getElementById('paymentMethod').value;
  state.paymentMethod = method;
  state.paymentPaid = false;

  // Reset confirm button
  const btn = document.getElementById('confirmPaymentBtn');
  btn.textContent = '✓  Confirm Payment';
  btn.classList.remove('paid');

  // Reset payment status
  setPaymentStatus(false);

  // Show/hide UPI section
  document.getElementById('upiSection').classList.toggle('hidden', method !== 'upi');
  document.getElementById('genericNotice').classList.toggle('hidden', method === '' || method === 'upi');

  updateSummary();
}

function confirmPayment() {
  if (!state.paymentMethod) {
    showToast('Please select a payment method first.', 'error');
    return;
  }
  if (state.paymentMethod === 'upi') {
    const transId = document.getElementById('transactionId').value.trim();
    if (!transId) {
      showToast('Please enter your Transaction ID to confirm payment.', 'error');
      return;
    }
    // Simple validation: check if it's at least 6 digits
    if (transId.length < 6) {
      showToast('Please enter a valid Transaction ID.', 'error');
      return;
    }
    state.transactionId = transId;
  }

  state.paymentPaid = true;
  const btn = document.getElementById('confirmPaymentBtn');
  btn.innerHTML = '✓  Payment Confirmed';
  btn.classList.add('paid');

  setPaymentStatus(true);
  updateSummary();
  showToast('Payment confirmed successfully!', 'success');
}

function setPaymentStatus(paid) {
  const el = document.getElementById('paymentStatus');
  const dot = el.querySelector('.status-dot');
  const text = el.querySelector('.status-text');

  if (paid) {
    el.classList.add('is-paid');
    dot.className = 'status-dot paid';
    text.textContent = 'Payment Paid ✓';
  } else {
    el.classList.remove('is-paid');
    dot.className = 'status-dot unpaid';
    text.textContent = 'Payment Pending';
  }
}

// ─── SUMMARY ─────────────────────────────────────────────────
function updateSummary() {
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const methodLabels = {
    upi: 'UPI',
    card: 'Debit/Credit Card',
    netbanking: 'Net Banking',
  };

  document.getElementById('sumDate').textContent = state.selectedDate
    ? `${state.selectedDate.d} ${monthNames[state.selectedDate.m]} ${state.selectedDate.y}` : '—';

  document.getElementById('sumTime').textContent = state.selectedTime || '—';

  document.getElementById('sumMode').textContent = state.consultMode
    ? (state.consultMode === 'call' ? '📞 Call' : '🏥 Offline Visit') : '—';

  document.getElementById('sumPayment').textContent = state.paymentMethod
    ? methodLabels[state.paymentMethod] || '—' : '—';
}

// ─── BOOK APPOINTMENT ────────────────────────────────────────
async function bookAppointment() {
  clearToast();

  if (!state.selectedDate) {
    showToast('⚠️ Please select an appointment date.', 'error'); return;
  }
  if (!state.selectedTime) {
    showToast('⚠️ Please select a time slot.', 'error'); return;
  }
  if (!state.consultMode) {
    showToast('⚠️ Please select a consultation mode.', 'error'); return;
  }

  let finalPhone = state.phoneNumber;
  if (state.consultMode === 'call') {
    const phoneInp = document.getElementById('phoneInput').value.trim();
    if (!phoneInp || phoneInp.length < 10) {
      showToast('⚠️ Please enter a valid 10-digit phone number.', 'error'); return;
    }
    finalPhone = phoneInp;
  } else {
    // For offline, we still want a phone if possible
    finalPhone = state.phoneNumber || (state.user ? state.user.phone : '');
  }

  // PAYMENT CHECK
  if (!state.paymentMethod) {
    showToast('⚠️ Please select a payment method.', 'error'); return;
  }
  if (!state.paymentPaid) {
    showToast('⚠️ Please complete payment before booking.', 'error'); return;
  }

  // Prepare payload
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formattedDate = `${state.selectedDate.d} ${monthNamesShort[state.selectedDate.m]} ${state.selectedDate.y}`;

  const payload = {
    name: state.user ? state.user.name : 'Guest User',
    phone: finalPhone,
    email: state.user ? state.user.email : '',
    appt_date: formattedDate,
    appt_time: state.selectedTime,
    consult_mode: state.consultMode === 'call' ? 'Call Consultation' : 'Offline Visit',
    payment_method: state.paymentMethod || 'Free',
    transaction_id: state.transactionId,
    amount: 50
  };

  try {
    const btn = document.getElementById('bookBtn');
    btn.disabled = true;
    btn.textContent = 'Booking...';

    const response = await fetch(`${state.apiBase}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Server returned ${response.status}`);
    }

    const data = await response.json();

    if (data.success) {
      // Update Summary UI
      const modeStr = state.consultMode === 'call' ? 'Call Consultation' : 'Offline Visit';
      
      if (document.getElementById('sumDate')) document.getElementById('sumDate').textContent = formattedDate;
      if (document.getElementById('sumTime')) document.getElementById('sumTime').textContent = state.selectedTime;
      if (document.getElementById('sumMode')) document.getElementById('sumMode').textContent = modeStr;

      // Populate Success Modal
      if (document.getElementById('modalDate')) document.getElementById('modalDate').textContent = formattedDate;
      if (document.getElementById('modalTime')) document.getElementById('modalTime').textContent = state.selectedTime;
      if (document.getElementById('modalMode')) document.getElementById('modalMode').textContent = modeStr;
      if (document.getElementById('modalTransId')) document.getElementById('modalTransId').textContent = state.transactionId || 'N/A';
      if (document.getElementById('modalAmount')) document.getElementById('modalAmount').textContent = '₹50';

      // Handle Meeting Link
      const meetingInfo = document.getElementById('modalMeetingInfo');
      if (meetingInfo) {
        if (data.appointment && data.appointment.meeting_link) {
          meetingInfo.classList.remove('hidden');
          document.getElementById('meetingLinkText').textContent = data.appointment.meeting_link;
          document.getElementById('joinNowBtn').href = data.appointment.meeting_link;
        } else {
          meetingInfo.classList.add('hidden');
        }
      }

      // Show the popup
      const modal = document.getElementById('successModal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.style.display = 'flex'; // Ensure it's visible if using flex
      } else {
        alert('🎉 Appointment Booked Successfully!\n\nDate: ' + formattedDate + '\nTime: ' + state.selectedTime);
      }
    } else {
      showToast('❌ ' + (data.message || 'Booking failed'), 'error');
    }
  } catch (error) {
    console.error("Booking error:", error);
    showToast('❌ ' + error.message, 'error');
  } finally {
    const btn = document.getElementById('bookBtn');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Book Appointment →';
    }
  }
}

function copyMeetingLink() {
  const link = document.getElementById('meetingLinkText').textContent;
  navigator.clipboard.writeText(link).then(() => {
    alert('Link copied to clipboard!');
  });
}

function closeModal() {
  window.location.reload();
}// ─── TOAST ───────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = 'toast hidden';
  }, 4000);
}
function clearToast() {
  const toast = document.getElementById('toast');
  toast.className = 'toast hidden';
}

initCalendar();
initTimeSlots();
checkAuth();

// Periodically block slots as time passes (every 15 seconds)
setInterval(updateSlotAvailability, 15000);

function closeSuccessModal() {
  const modal = document.getElementById('successModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
  // Redirect to home page
  window.location.href = 'index.html';
}

async function logoutUser() {
  try {
    const res = await fetch(`${state.apiBase}/logout`, { method: 'POST', credentials: 'include' });
    const data = await res.json();
    if (data.success) {
      localStorage.removeItem('ayurSession');
      alert('Logged out successfully.');
      window.location.href = 'index.html';
    }
  } catch (err) {
    localStorage.removeItem('ayurSession');
    window.location.href = 'index.html';
  }
}