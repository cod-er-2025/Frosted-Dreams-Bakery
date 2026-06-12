/* ============================================
   Frosted Dreams — MAIN.JS
   Cart, Filters, Navbar, Animations
   ============================================ */

// ===== CART STATE =====
let cart = JSON.parse(localStorage.getItem('lafarine_cart') || '[]');

function saveCart() {
  localStorage.setItem('lafarine_cart', JSON.stringify(cart));
}

function updateCartCount() {
  const total = cart.reduce((sum, item) => sum + item.qty, 0);
  document.querySelectorAll('#cart-count').forEach(el => el.textContent = total);
}

function getCartTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.qty, 0);
}

// ===== ADD TO CART =====
function initAddToCart() {
  document.querySelectorAll('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', function () {
      const name  = this.dataset.name;
      const price = parseInt(this.dataset.price);
      const existing = cart.find(i => i.name === name);

      if (existing) {
        existing.qty++;
      } else {
        cart.push({ name, price, qty: 1 });
      }

      saveCart();
      updateCartCount();
      animateAddBtn(this);
      renderCartSidebar();

      // Briefly open cart
      const sidebar = document.getElementById('cartSidebar');
      const overlay = document.getElementById('cartOverlay');
      if (sidebar) {
        sidebar.classList.add('open');
        overlay && overlay.classList.add('open');
        setTimeout(() => {
          sidebar.classList.remove('open');
          overlay && overlay.classList.remove('open');
        }, 1800);
      }
    });
  });
}

function animateAddBtn(btn) {
  const orig = btn.textContent;
  btn.textContent = '✓ Added!';
  btn.classList.add('added');
  btn.disabled = true;
  setTimeout(() => {
    btn.textContent = orig;
    btn.classList.remove('added');
    btn.disabled = false;
  }, 1400);
}

// ===== CART SIDEBAR =====
function toggleCart() {
  const sidebar = document.getElementById('cartSidebar');
  const overlay = document.getElementById('cartOverlay');
  if (!sidebar) return;
  sidebar.classList.toggle('open');
  overlay && overlay.classList.toggle('open');
  renderCartSidebar();
}

function renderCartSidebar() {
  const container = document.getElementById('cartItems');
  const totalEl   = document.getElementById('cartTotal');
  const checkBtn  = document.getElementById('checkoutBtn');
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = '<p class="cart-empty">Your cart is empty 🧺</p>';
    if (totalEl)  totalEl.textContent  = '0';
    if (checkBtn) checkBtn.style.display = 'none';
    return;
  }

  container.innerHTML = cart.map((item, idx) => `
    <div class="cart-item">
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <p>₹${item.price} × ${item.qty} = <strong>₹${item.price * item.qty}</strong></p>
      </div>
      <div style="display:flex;gap:.5rem;align-items:center;">
        <button class="qty-btn" onclick="changeQty(${idx}, -1)">−</button>
        <span style="font-weight:600;min-width:1.2rem;text-align:center">${item.qty}</span>
        <button class="qty-btn" onclick="changeQty(${idx}, 1)">+</button>
        <button class="cart-item-remove" onclick="removeCartItem(${idx})">🗑</button>
      </div>
    </div>
  `).join('');

  const tot = getCartTotal();
  if (totalEl)  totalEl.textContent  = tot;
  if (checkBtn) checkBtn.style.display = 'block';

  // Inject qty-btn style if not present
  if (!document.getElementById('qtybtn-style')) {
    const s = document.createElement('style');
    s.id = 'qtybtn-style';
    s.textContent = `.qty-btn{background:var(--border);border:none;width:1.6rem;height:1.6rem;border-radius:50%;cursor:pointer;font-size:1rem;font-weight:700;color:var(--brown);transition:background .15s}.qty-btn:hover{background:var(--caramel);color:#fff}`;
    document.head.appendChild(s);
  }
}

function changeQty(idx, delta) {
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  saveCart();
  updateCartCount();
  renderCartSidebar();
}

function removeCartItem(idx) {
  cart.splice(idx, 1);
  saveCart();
  updateCartCount();
  renderCartSidebar();
}

// ===== PRODUCT FILTER =====
function initFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const cat = this.dataset.cat;
      let delay = 0;
      document.querySelectorAll('.product-card').forEach(card => {
        if (cat === 'all' || card.dataset.cat === cat) {
          card.classList.remove('hidden');
          card.style.animationDelay = `${delay}s`;
          card.style.animation = 'none';
          void card.offsetWidth; // reflow
          card.style.animation = 'cardIn .4s ease forwards';
          delay += 0.06;
        } else {
          card.classList.add('hidden');
        }
      });
    });
  });
}

// ===== NAVBAR SCROLL =====
function initNavbar() {
  window.addEventListener('scroll', () => {
    const nav = document.querySelector('.navbar');
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 60);
  });
}

// ===== SCROLL REVEAL =====
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.feature, .about-card, .testi-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity .55s ease, transform .55s ease';
    observer.observe(el);
  });

  if (!document.getElementById('reveal-style')) {
    const s = document.createElement('style');
    s.id = 'reveal-style';
    s.textContent = `.visible{opacity:1!important;transform:translateY(0)!important}`;
    document.head.appendChild(s);
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  updateCartCount();
  initAddToCart();
  renderCartSidebar();
  initFilters();
  initNavbar();
  initScrollReveal();
});