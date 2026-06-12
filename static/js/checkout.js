/* ============================================
   Frosted Dreams — CHECKOUT.JS
   Multi-step form: Cart → Address → Payment → Confirm
   ============================================ */

const DELIVERY_FEE = 40;

// ===== STEP NAVIGATION =====
let currentStep = 1;

function goToStep(step) {
  // Hide current panel
  const curr = document.getElementById(`panel-${currentStep}`);
  if (curr) {
    curr.classList.remove('active');
    curr.style.display = 'none';
  }

  // Update stepper dots
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById(`step-dot-${i}`);
    if (!dot) continue;
    dot.classList.remove('active', 'done');
    if (i < step)  dot.classList.add('done');
    if (i === step) dot.classList.add('active');
  }

  // Update step lines
  document.querySelectorAll('.step-line').forEach((line, idx) => {
    line.classList.toggle('done', idx < step - 1);
  });

  // Show new panel with animation
  const next = document.getElementById(`panel-${step}`);
  if (next) {
    next.style.display = 'block';
    next.style.animation = 'none';
    void next.offsetWidth;
    next.style.animation = 'panelIn .5s cubic-bezier(.22,.61,.36,1) forwards';
    next.classList.add('active');
  }

  currentStep = step;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== STEP 1: RENDER ORDER REVIEW =====
function renderOrderReview() {
  const cart = JSON.parse(localStorage.getItem('lafarine_cart') || '[]');
  const container  = document.getElementById('orderReview');
  const subtotalEl = document.getElementById('reviewSubtotal');
  const totalEl    = document.getElementById('reviewTotal');
  const toStep2Btn = document.getElementById('toStep2');

  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = '<p class="empty-cart">No items yet. <a href="products.html">Browse our menu →</a></p>';
    if (toStep2Btn) toStep2Btn.disabled = true;
    return;
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const total    = subtotal + DELIVERY_FEE;

  container.innerHTML = cart.map((item, idx) => `
    <div class="review-item">
      <span class="review-item-name">${item.name} <span style="color:var(--muted);font-weight:400">× ${item.qty}</span></span>
      <span>
        <span class="review-item-price">₹${item.price * item.qty}</span>
        <button class="remove-item-btn" onclick="removeReviewItem(${idx})" title="Remove">✕</button>
      </span>
    </div>
  `).join('');

  if (subtotalEl) subtotalEl.textContent = subtotal;
  if (totalEl)    totalEl.textContent    = total;
  if (toStep2Btn) toStep2Btn.disabled = cart.length === 0;

  // Sync GPay/final total
  const gpayAmt = document.getElementById('gpayAmount');
  const finalT  = document.getElementById('finalTotal');
  if (gpayAmt) gpayAmt.textContent = total;
  if (finalT)  finalT.textContent  = total;
}

function removeReviewItem(idx) {
  let cart = JSON.parse(localStorage.getItem('lafarine_cart') || '[]');
  cart.splice(idx, 1);
  localStorage.setItem('lafarine_cart', JSON.stringify(cart));
  renderOrderReview();
  // Update nav count
  const countEls = document.querySelectorAll('#cart-count');
  const newTotal = cart.reduce((s, i) => s + i.qty, 0);
  countEls.forEach(el => el.textContent = newTotal);
}

// ===== STEP 2: ADDRESS VALIDATION =====
function validateAddress() {
  const fields = [
    { id: 'fullName', label: 'Full Name' },
    { id: 'phone',    label: 'Phone Number' },
    { id: 'email',    label: 'Email Address' },
    { id: 'street',   label: 'Street Address' },
    { id: 'area',     label: 'Area / Locality' },
    { id: 'city',     label: 'City' },
    { id: 'state',    label: 'State' },
    { id: 'pin',      label: 'PIN Code' },
  ];

  let valid = true;

  fields.forEach(f => {
    const el = document.getElementById(f.id);
    if (!el) return;
    el.classList.remove('error');
    if (!el.value.trim()) {
      el.classList.add('error');
      valid = false;
    }
  });

  // Phone validation
  const phone = document.getElementById('phone');
  if (phone && phone.value.trim()) {
    const digits = phone.value.replace(/\D/g, '');
    if (digits.length < 10) {
      phone.classList.add('error');
      valid = false;
      showToast('Please enter a valid phone number (10 digits).');
    }
  }

  // PIN validation
  const pin = document.getElementById('pin');
  if (pin && pin.value.trim()) {
    if (!/^\d{6}$/.test(pin.value.trim())) {
      pin.classList.add('error');
      valid = false;
      showToast('PIN code must be exactly 6 digits.');
    }
  }

  // Email validation
  const email = document.getElementById('email');
  if (email && email.value.trim()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
      email.classList.add('error');
      valid = false;
      showToast('Please enter a valid email address.');
    }
  }

  if (!valid) {
    if (!document.querySelector('.error[id]')) showToast('Please fill all required fields.');
    shakePanelErrors();
    return;
  }

  goToStep(3);
}

function shakePanelErrors() {
  document.querySelectorAll('input.error, textarea.error').forEach(el => {
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = 'shake .35s ease';
  });
  if (!document.getElementById('shake-style')) {
    const s = document.createElement('style');
    s.id = 'shake-style';
    s.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}`;
    document.head.appendChild(s);
  }
}

// ===== STEP 3: PAYMENT SWITCHING =====
function initPaymentOptions() {
  const options = document.querySelectorAll('.payment-card');
  const panels  = {
    gpay: document.getElementById('gpayPanel'),
    upi:  document.getElementById('upiPanel'),
    card: document.getElementById('cardPanel'),
    cod:  document.getElementById('codPanel'),
  };

  options.forEach(opt => {
    opt.addEventListener('click', function () {
      options.forEach(o => o.classList.remove('selected'));
      this.classList.add('selected');
      const val = this.querySelector('input[type="radio"]').value;
      Object.keys(panels).forEach(k => {
        if (panels[k]) panels[k].style.display = k === val ? 'block' : 'none';
      });
      // Animate panel in
      if (panels[val]) {
        panels[val].style.animation = 'none';
        void panels[val].offsetWidth;
        panels[val].style.animation = 'panelIn .4s ease forwards';
      }
    });
  });

  // Card number formatting
  const cardNum = document.getElementById('cardNumber');
  if (cardNum) {
    cardNum.addEventListener('input', function () {
      let v = this.value.replace(/\D/g, '').slice(0, 16);
      this.value = v.replace(/(.{4})/g, '$1 ').trim();
    });
  }

  // Expiry formatting
  const exp = document.getElementById('expiry');
  if (exp) {
    exp.addEventListener('input', function () {
      let v = this.value.replace(/\D/g, '').slice(0, 4);
      if (v.length >= 3) v = v.slice(0,2) + '/' + v.slice(2);
      this.value = v;
    });
  }
}

// ===== PLACE ORDER =====
function placeOrder() {
  const cart       = JSON.parse(localStorage.getItem('lafarine_cart') || '[]');
  const payMethod  = document.querySelector('input[name="payment"]:checked')?.value || 'gpay';

  if (cart.length === 0) {
    showToast('Your cart is empty!');
    return;
  }

  // Validate payment fields
  if (payMethod === 'gpay' || payMethod === 'upi') {
    const upiInput = document.getElementById('upiId');
    if (upiInput && !upiInput.value.trim()) {
      upiInput.classList.add('error');
      showToast('Please enter your UPI ID or phone number.');
      return;
    }
  }
  if (payMethod === 'card') {
    const cn = document.getElementById('cardNumber');
    const ex = document.getElementById('expiry');
    const cv = document.getElementById('cvv');
    const nm = document.getElementById('cardName');
    let ok = true;
    [cn, ex, cv, nm].forEach(el => {
      if (el && !el.value.trim()) { el.classList.add('error'); ok = false; }
    });
    if (!ok) { showToast('Please fill all card details.'); shakePanelErrors(); return; }
  }

  // Build order payload
  const address = {
    name:         document.getElementById('fullName')?.value.trim(),
    phone:        document.getElementById('phone')?.value.trim(),
    email:        document.getElementById('email')?.value.trim(),
    street:       document.getElementById('street')?.value.trim(),
    area:         document.getElementById('area')?.value.trim(),
    city:         document.getElementById('city')?.value.trim(),
    state:        document.getElementById('state')?.value.trim(),
    pin:          document.getElementById('pin')?.value.trim(),
    instructions: document.getElementById('instructions')?.value.trim(),
    deliveryTime: document.getElementById('deliveryTime')?.value,
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const payload  = {
    items:       cart,
    address,
    payment:     payMethod,
    subtotal,
    delivery:    DELIVERY_FEE,
    total:       subtotal + DELIVERY_FEE,
  };

  // Show loading state
  const placeBtn = document.querySelector('#panel-3 .btn-primary:last-child');
  if (placeBtn) {
    placeBtn.textContent = 'Processing…';
    placeBtn.disabled    = true;
  }

  // POST to Python backend
  fetch('/api/place-order', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        // Clear cart
        localStorage.removeItem('lafarine_cart');
        document.querySelectorAll('#cart-count').forEach(el => el.textContent = '0');

        // Populate confirmation
        document.getElementById('orderId').textContent = data.order_id;
        const details = document.getElementById('confirmDetails');
        if (details) {
          details.innerHTML = `
            <strong>📦 Items:</strong> ${cart.map(i => `${i.name} ×${i.qty}`).join(', ')}<br>
            <strong>🏠 Deliver to:</strong> ${address.name}, ${address.street}, ${address.area}, ${address.city} — ${address.pin}<br>
            <strong>💳 Payment:</strong> ${payMethodLabel(payMethod)}<br>
            <strong>⏰ Slot:</strong> ${address.deliveryTime}<br>
            <strong>💰 Total:</strong> ₹${subtotal + DELIVERY_FEE} (incl. ₹${DELIVERY_FEE} delivery)
          `;
        }
        goToStep(4);
      } else {
        showToast(data.message || 'Something went wrong. Please try again.');
        if (placeBtn) { placeBtn.textContent = 'Place Order 🎉'; placeBtn.disabled = false; }
      }
    })
    .catch(() => {
      // Offline / server not running — still show confirmation for demo
      localStorage.removeItem('lafarine_cart');
      const orderId = 'LF-' + Math.random().toString(36).slice(2,8).toUpperCase();
      document.getElementById('orderId').textContent = orderId;
      const details = document.getElementById('confirmDetails');
      if (details) {
        details.innerHTML = `
          <strong>📦 Items:</strong> ${cart.map(i => `${i.name} ×${i.qty}`).join(', ')}<br>
          <strong>🏠 Deliver to:</strong> ${address.name}, ${address.street}, ${address.area}, ${address.city} — ${address.pin}<br>
          <strong>💳 Payment:</strong> ${payMethodLabel(payMethod)}<br>
          <strong>⏰ Slot:</strong> ${address.deliveryTime}<br>
          <strong>💰 Total:</strong> ₹${subtotal + DELIVERY_FEE} (incl. ₹${DELIVERY_FEE} delivery)
        `;
      }
      goToStep(4);
    });
}

function payMethodLabel(val) {
  return { gpay: 'Google Pay (UPI)', upi: 'UPI', card: 'Credit/Debit Card', cod: 'Cash on Delivery' }[val] || val;
}

// ===== TOAST NOTIFICATION =====
function showToast(msg) {
  let toast = document.getElementById('lf-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'lf-toast';
    const style = document.createElement('style');
    style.textContent = `
      #lf-toast{
        position:fixed;bottom:2rem;left:50%;transform:translateX(-50%) translateY(80px);
        background:var(--brown);color:var(--cream);
        padding:.85rem 1.8rem;border-radius:50px;
        font-size:.9rem;font-weight:500;
        box-shadow:0 8px 32px rgba(0,0,0,.2);
        z-index:9999;transition:transform .35s cubic-bezier(.34,1.56,.64,1),opacity .25s;
        opacity:0;pointer-events:none;white-space:nowrap;
      }
      #lf-toast.show{transform:translateX(-50%) translateY(0);opacity:1;}
    `;
    document.head.appendChild(style);
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  renderOrderReview();
  initPaymentOptions();
});