/* ==========================================================================
   THE PIQUANT PATISSERIE V2 — PREMIUM INTERACTIONS
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  initNavigation();
  initScrollAnimations();
  await initMenuLoader();
  initShoppingCart();
  initTruckTracker();
  initContactForm();
  init3DCardEffect();
});

/* ==========================================================================
   1. NAVIGATION — Scroll Effects + Mobile Hamburger
   ========================================================================== */
function initNavigation() {
  const nav = document.querySelector('.nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 30);
  });

  // Mobile hamburger
  const hamburger = document.getElementById('hamburger-btn');
  const backdrop = document.getElementById('mobile-nav-backdrop');
  const drawer = document.getElementById('mobile-nav-drawer');
  const closeBtn = document.getElementById('mobile-nav-close');

  function openMobileNav() { backdrop.classList.add('open'); drawer.classList.add('open'); }
  function closeMobileNav() { backdrop.classList.remove('open'); drawer.classList.remove('open'); }

  if (hamburger) hamburger.addEventListener('click', openMobileNav);
  if (closeBtn) closeBtn.addEventListener('click', closeMobileNav);
  if (backdrop) backdrop.addEventListener('click', closeMobileNav);

  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', closeMobileNav);
  });
}

/* ==========================================================================
   2. SCROLL REVEAL ANIMATIONS
   ========================================================================== */
function initScrollAnimations() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('revealed'), i * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
}

/* ==========================================================================
   3. DYNAMIC MENU LOADER — Fetches from /api/menu
   ========================================================================== */
async function initMenuLoader() {
  const grid = document.getElementById('menu-grid');
  const loading = document.getElementById('menu-loading');
  const tabsContainer = document.getElementById('cat-tabs');

  try {
    const response = await fetch('/api/menu');
    const data = await response.json();
    const { items, categories } = data;

    // Build category tabs
    tabsContainer.innerHTML = '';
    const allTab = document.createElement('button');
    allTab.className = 'cat-tab active';
    allTab.setAttribute('role', 'tab');
    allTab.setAttribute('aria-selected', 'true');
    allTab.setAttribute('data-category', 'all');
    allTab.textContent = 'All Items';
    tabsContainer.appendChild(allTab);

    categories.forEach(cat => {
      const tab = document.createElement('button');
      tab.className = 'cat-tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', 'false');
      tab.setAttribute('data-category', cat.slug);
      tab.textContent = cat.name;
      tabsContainer.appendChild(tab);
    });

    // Build category name map
    const catMap = {};
    categories.forEach(c => { catMap[c.slug] = c.name; });

    // Remove loading state
    if (loading) loading.remove();

    // Build menu cards
    items.forEach((item, index) => {
      const card = document.createElement('article');
      card.className = 'menu-card fade-in';
      card.setAttribute('data-category', item.category_slug);
      card.style.animationDelay = `${index * 0.06}s`;

      const bulkText = item.bulk_qty > 0 ? `${item.bulk_qty} for $${item.bulk_price}` : '';

      card.innerHTML = `
        <div class="menu-card-img" style="background-image: url('${escapeAttr(item.image_url)}')">
          <span class="category-badge">${escapeHtml(catMap[item.category_slug] || item.category_slug)}</span>
        </div>
        <div class="menu-card-body">
          <h3 class="menu-card-name">${escapeHtml(item.name)}</h3>
          <p class="menu-card-desc">${escapeHtml(item.description)}</p>
          <div class="menu-card-footer">
            <div class="price-container">
              <span class="price">$${Number(item.price).toFixed(2)}</span>
              ${bulkText ? `<span class="bulk-badge">${bulkText}</span>` : ''}
            </div>
            <button class="add-to-cart-btn"
              data-id="item-${item.id}"
              data-name="${escapeAttr(item.name)}"
              data-price="${item.price}"
              data-bulk-qty="${item.bulk_qty}"
              data-bulk-price="${item.bulk_price}">
              Add <i class="ti ti-plus"></i>
            </button>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });

    // Init category filter
    initCategoryFilters();

  } catch (err) {
    console.error('[Menu] Failed to load:', err);
    if (loading) {
      loading.innerHTML = '<p style="color:#d32f2f;">Failed to load menu. Please refresh the page.</p>';
    }
  }
}

/* ==========================================================================
   4. CATEGORY TAB FILTERING
   ========================================================================== */
function initCategoryFilters() {
  const tabsContainer = document.getElementById('cat-tabs');
  if (!tabsContainer) return;

  tabsContainer.addEventListener('click', (e) => {
    const tab = e.target.closest('.cat-tab');
    if (!tab) return;

    tabsContainer.querySelectorAll('.cat-tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');

    const category = tab.getAttribute('data-category');
    const cards = document.querySelectorAll('.menu-card');

    cards.forEach(card => {
      card.classList.remove('fade-in');
      if (category === 'all' || card.getAttribute('data-category') === category) {
        card.classList.remove('filtered-out');
        void card.offsetWidth;
        card.classList.add('fade-in');
      } else {
        card.classList.add('filtered-out');
      }
    });
  });
}

/* ==========================================================================
   5. SHOPPING CART ENGINE
   ========================================================================== */
function initShoppingCart() {
  let cart = [];

  const cartDrawer = document.getElementById('cart-drawer');
  const cartBackdrop = document.getElementById('cart-backdrop');
  const openCartBtn = document.getElementById('open-cart-btn');
  const closeCartBtn = document.getElementById('close-cart-btn');
  const cartEmptyMsg = document.getElementById('cart-empty-message');
  const cartItemsContainer = document.getElementById('cart-items-container');
  const cartSummaryFooter = document.getElementById('cart-summary-footer');
  const cartCountBadge = document.getElementById('cart-count');
  const cartSubtotalEl = document.getElementById('cart-subtotal');
  const cartDiscountEl = document.getElementById('cart-discount');
  const cartDiscountRow = document.getElementById('cart-discount-row');
  const cartTotalEl = document.getElementById('cart-total');
  const activePromoBanner = document.getElementById('active-promo-banner');
  const promoBannerText = document.getElementById('promo-banner-text');
  const checkoutBtn = document.getElementById('cart-checkout-btn');

  function openCart() { cartDrawer.classList.add('open'); cartBackdrop.classList.add('open'); document.body.style.overflow = 'hidden'; }
  function closeCart() { cartDrawer.classList.remove('open'); cartBackdrop.classList.remove('open'); document.body.style.overflow = ''; }

  openCartBtn.addEventListener('click', openCart);
  closeCartBtn.addEventListener('click', closeCart);
  cartBackdrop.addEventListener('click', closeCart);

  // Event delegation for dynamically rendered Add to Cart buttons
  document.getElementById('menu-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('.add-to-cart-btn');
    if (!btn) return;

    const id = btn.getAttribute('data-id');
    const name = btn.getAttribute('data-name');
    const price = parseFloat(btn.getAttribute('data-price'));
    const bulkQty = parseInt(btn.getAttribute('data-bulk-qty')) || 0;
    const bulkPrice = parseFloat(btn.getAttribute('data-bulk-price')) || 0;

    addToCart(id, name, price, bulkQty, bulkPrice);

    const originalHTML = btn.innerHTML;
    btn.style.background = '#4A7C6F';
    btn.style.color = 'white';
    btn.innerHTML = 'Added <i class="ti ti-check"></i>';
    btn.disabled = true;
    setTimeout(() => { btn.style.background = ''; btn.style.color = ''; btn.innerHTML = originalHTML; btn.disabled = false; }, 1000);

    openCartBtn.style.transform = 'scale(1.2)';
    setTimeout(() => { openCartBtn.style.transform = ''; }, 300);
  });

  function addToCart(id, name, price, bulkQty, bulkPrice) {
    const existing = cart.find(i => i.id === id);
    if (existing) { existing.qty++; } else { cart.push({ id, name, price, qty: 1, bulkQty, bulkPrice }); }
    updateCartUI();
  }

  function changeQty(id, delta) {
    const item = cart.find(i => i.id === id);
    if (item) { item.qty += delta; if (item.qty <= 0) { cart = cart.filter(i => i.id !== id); } }
    updateCartUI();
  }

  function removeFromCart(id) { cart = cart.filter(i => i.id !== id); updateCartUI(); }

  function calculateTotal() {
    let subtotal = 0, finalTotal = 0, totalDiscount = 0, itemsCount = 0;
    cart.forEach(item => {
      const reg = item.qty * item.price;
      subtotal += reg;
      itemsCount += item.qty;
      let cost = reg;
      if (item.bulkQty && item.qty >= item.bulkQty) {
        const packs = Math.floor(item.qty / item.bulkQty);
        const rem = item.qty % item.bulkQty;
        cost = (packs * item.bulkPrice) + (rem * item.price);
      }
      finalTotal += cost;
      totalDiscount += (reg - cost);
    });
    return { subtotal, discount: totalDiscount, total: finalTotal, itemsCount };
  }

  function updateCartUI() {
    const totals = calculateTotal();
    cartCountBadge.textContent = totals.itemsCount;
    cartCountBadge.style.display = totals.itemsCount > 0 ? 'flex' : 'none';

    if (cart.length === 0) {
      cartEmptyMsg.style.display = 'flex';
      cartItemsContainer.style.display = 'none';
      cartSummaryFooter.style.display = 'none';
    } else {
      cartEmptyMsg.style.display = 'none';
      cartItemsContainer.style.display = 'flex';
      cartSummaryFooter.style.display = 'flex';
      cartItemsContainer.innerHTML = '';

      cart.forEach(item => {
        let originalCost = item.qty * item.price;
        let finalCost = originalCost;
        let isDiscounted = false;
        if (item.bulkQty && item.qty >= item.bulkQty) {
          const packs = Math.floor(item.qty / item.bulkQty);
          const rem = item.qty % item.bulkQty;
          finalCost = (packs * item.bulkPrice) + (rem * item.price);
          isDiscounted = true;
        }
        const el = document.createElement('div');
        el.className = 'cart-item';
        el.innerHTML = `
          <div class="cart-item-info">
            <h4 class="cart-item-name">${escapeHtml(item.name)}</h4>
            <div class="cart-item-price-desc">
              <span>Qty: ${item.qty} × $${item.price.toFixed(2)}</span>
              ${isDiscounted ? `<span class="discounted">$${finalCost.toFixed(2)} (Bulk rate)</span>` : `<span class="actual-price">$${originalCost.toFixed(2)}</span>`}
            </div>
          </div>
          <div class="cart-item-controls">
            <button aria-label="Decrease" class="dec-qty-btn" data-id="${item.id}"><i class="ti ti-minus"></i></button>
            <span class="cart-item-qty">${item.qty}</span>
            <button aria-label="Increase" class="inc-qty-btn" data-id="${item.id}"><i class="ti ti-plus"></i></button>
          </div>
          <button aria-label="Remove" class="cart-item-remove" data-id="${item.id}"><i class="ti ti-trash"></i></button>
        `;
        cartItemsContainer.appendChild(el);
      });

      cartItemsContainer.querySelectorAll('.dec-qty-btn').forEach(b => b.addEventListener('click', () => changeQty(b.dataset.id, -1)));
      cartItemsContainer.querySelectorAll('.inc-qty-btn').forEach(b => b.addEventListener('click', () => changeQty(b.dataset.id, 1)));
      cartItemsContainer.querySelectorAll('.cart-item-remove').forEach(b => b.addEventListener('click', () => removeFromCart(b.dataset.id)));

      cartSubtotalEl.textContent = `$${totals.subtotal.toFixed(2)}`;
      if (totals.discount > 0) {
        cartDiscountEl.textContent = `-$${totals.discount.toFixed(2)}`;
        cartDiscountRow.style.display = 'flex';
        activePromoBanner.classList.add('glow');
        promoBannerText.textContent = `Sweet! You saved $${totals.discount.toFixed(2)} on bulk pricing.`;
      } else {
        cartDiscountRow.style.display = 'none';
        activePromoBanner.classList.remove('glow');
        promoBannerText.textContent = 'Add 4+ of the same item for bulk discounts!';
      }
      cartTotalEl.textContent = `$${totals.total.toFixed(2)}`;
    }
  }

  // Checkout
  checkoutBtn.addEventListener('click', async () => {
    closeCart();
    const totals = calculateTotal();
    try {
      const resp = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart, customer: { name: 'Customer', email: '' } })
      });
      const result = await resp.json();
      if (result.url && !result.url.includes('mock')) {
        window.location.href = result.url;
        return;
      }
    } catch (e) { console.log('[Checkout] API unavailable, showing mock.'); }

    // Mock checkout success
    showSuccessModal('Order Submitted!',
      'Your mock order has been processed. In production, this redirects to Stripe Checkout.',
      `<div><strong>Items:</strong> ${totals.itemsCount} pastries</div>
       <div><strong>Subtotal:</strong> $${totals.subtotal.toFixed(2)}</div>
       ${totals.discount > 0 ? `<div><strong>Bulk Discount:</strong> -$${totals.discount.toFixed(2)}</div>` : ''}
       <div style="margin-top:8px;border-top:1px dashed var(--color-border-medium);padding-top:8px;font-weight:700;color:var(--color-sage);">
         <strong>Total:</strong> $${totals.total.toFixed(2)}
       </div>`
    );
    cart = [];
    updateCartUI();
  });
}

/* ==========================================================================
   6. TRUCK TRACKER
   ========================================================================== */
function initTruckTracker() {
  const schedule = [
    { day: 'Monday', text: 'Kitchen Prep Day', location: 'No service (Baking fresh batches)', hours: 'Closed' },
    { day: 'Tuesday', text: 'Kyle City Square', location: 'Kyle City Square Park', hours: '11:00 AM - 3:00 PM' },
    { day: 'Wednesday', text: 'Plum Creek Market', location: 'Plum Creek neighborhood', hours: '11:00 AM - 4:00 PM' },
    { day: 'Thursday', text: 'HEB Plus Kyle', location: 'HEB Plus off I-35', hours: '11:00 AM - 3:00 PM' },
    { day: 'Friday', text: 'San Marcos Night Pop-up', location: 'San Marcos Premium Outlets', hours: '5:30 PM - 9:30 PM' },
    { day: 'Saturday', text: 'Buda City Park', location: 'Buda City Park', hours: '12:00 PM - 6:00 PM' },
    { day: 'Sunday', text: 'Private Event Bookings', location: 'Reserved for private celebrations', hours: 'By Booking Only' }
  ];

  const LOCATION_COORDINATES = {
    'Kyle City Square Park': [29.9875, -97.8778],
    'Plum Creek neighborhood': [29.9972, -97.8597],
    'Plum Creek Neighborhood': [29.9972, -97.8597],
    'HEB Plus off I-35': [30.0094, -97.8631],
    'HEB Plus Kyle (off I-35)': [30.0094, -97.8631],
    'Buda City Park': [30.0825, -97.8444],
    'San Marcos Premium Outlets': [29.8286, -97.9818],
    'Austin — South Congress Ave': [30.2241, -97.7562],
    'Kyle Town Center': [29.9890, -97.8680]
  };

  const scheduleList = document.getElementById('schedule-list');
  const liveMapStatus = document.getElementById('live-map-status');
  const mapAddress = document.getElementById('map-address');

  const todayIndex = new Date().getDay();
  const alignedIndex = todayIndex === 0 ? 6 : todayIndex - 1;

  scheduleList.innerHTML = '';
  schedule.forEach((item, index) => {
    const isToday = index === alignedIndex;
    const li = document.createElement('li');
    li.className = `schedule-day ${isToday ? 'today' : ''}`;

    let badge = '';
    if (isToday) {
      if (todayIndex === 0) badge = '<span class="schedule-status-pill" style="background:#C4973B">Private</span>';
      else if (todayIndex === 1) badge = '<span class="schedule-status-pill" style="background:#5e5e5e">Prep Day</span>';
      else badge = '<span class="schedule-status-pill">Active Today</span>';
    }
    li.innerHTML = `
      <div class="schedule-day-name"><strong>${item.day}</strong> ${badge}</div>
      <div class="schedule-day-location">${item.text} — ${item.location}</div>
      <div class="schedule-day-time">${item.hours}</div>
    `;
    scheduleList.appendChild(li);
  });

  // --- Initialize Leaflet Map ---
  let map, marker;
  const defaultCoords = [29.9875, -97.8778]; // Kyle City Square Park as default center

  try {
    map = L.map('map', {
      zoomControl: true,
      attributionControl: true
    }).setView(defaultCoords, 13);

    // Elegant CartoDB Positron tiles for a premium aesthetic
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    // Custom gold div marker with pulsing radar animation
    const goldIcon = L.divIcon({
      className: 'custom-map-marker',
      html: `
        <div class="marker-pin-wrapper">
          <div class="marker-pulse"></div>
          <div class="marker-core"><i class="ti ti-truck" style="color: white; font-size: 14px;"></i></div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    marker = L.marker(defaultCoords, { icon: goldIcon }).addTo(map);
  } catch (err) {
    console.error('[Map] Leaflet initialization error:', err);
  }

  function updateMapLocation(locationName) {
    if (!map || !marker) return;
    
    let coords = defaultCoords;
    let found = false;
    
    for (const [key, value] of Object.entries(LOCATION_COORDINATES)) {
      if (locationName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(locationName.toLowerCase())) {
        coords = value;
        found = true;
        break;
      }
    }
    
    marker.setLatLng(coords);
    map.setView(coords, 14);
    
    if (found) {
      marker.bindPopup(`<strong>The Piquant Patisserie</strong><br>${locationName}`).openPopup();
    } else {
      marker.bindPopup(`<strong>The Piquant Patisserie</strong><br>Pastry Truck active around Kyle!`).openPopup();
    }
  }

  // Fetch live truck status from API
  fetch('/api/truck-status')
    .then(r => r.json())
    .then(data => {
      if (data.status === 'active') {
        liveMapStatus.innerHTML = `<span class="schedule-status-pill">Live Now</span> ${escapeHtml(data.location)}`;
        mapAddress.textContent = data.message || data.location;
        updateMapLocation(data.location);
      } else if (data.status === 'closed') {
        liveMapStatus.textContent = 'Truck is currently closed';
        mapAddress.textContent = data.message || 'Check back soon!';
        updateMapLocation('Kyle City Square Park');
      } else {
        liveMapStatus.textContent = data.status === 'prep' ? 'Kitchen Prep Day' : 'Private Event';
        mapAddress.textContent = data.message || '';
        updateMapLocation(data.location || 'Kyle City Square Park');
      }
    })
    .catch(() => {
      const todayItem = schedule[alignedIndex];
      liveMapStatus.textContent = todayItem ? todayItem.text : 'Check schedule';
      mapAddress.textContent = todayItem ? todayItem.location : 'Kyle, TX';
      if (todayItem && todayItem.location) {
        updateMapLocation(todayItem.location);
      }
    });
}

/* ==========================================================================
   7. CONTACT FORM
   ========================================================================== */
function initContactForm() {
  const form = document.getElementById('client-form');
  const enquirySelect = document.getElementById('form-enquiry');
  const cateringDetails = document.getElementById('catering-details-group');

  enquirySelect.addEventListener('change', () => {
    cateringDetails.classList.toggle('show', enquirySelect.value === 'catering');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let isValid = true;

    const name = document.getElementById('form-name');
    const email = document.getElementById('form-email');
    const enquiry = document.getElementById('form-enquiry');
    const message = document.getElementById('form-message');

    if (!name.value.trim()) { setError(name); isValid = false; } else { clearError(name); }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { setError(email); isValid = false; } else { clearError(email); }
    if (!enquiry.value) { setError(enquiry); isValid = false; } else { clearError(enquiry); }
    if (!message.value.trim()) { setError(message); isValid = false; } else { clearError(message); }

    if (isValid) {
      const payload = {
        name: name.value.trim(),
        email: email.value.trim(),
        enquiry: enquiry.value,
        message: message.value.trim(),
        eventDate: document.getElementById('form-event-date')?.value || '',
        guests: document.getElementById('form-guests')?.value || ''
      };

      try { await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); } catch (e) { /* mock ok */ }

      const enquiryText = enquiry.options[enquiry.selectedIndex].text;
      let extra = '';
      if (enquiry.value === 'catering') {
        extra = `<div><strong>Event Date:</strong> ${payload.eventDate || 'TBD'}</div><div><strong>Guests:</strong> ${payload.guests || 'TBD'}</div>`;
      }
      showSuccessModal('Quote Request Submitted!',
        `Thank you, ${payload.name}! Our pastry coordinator will email you at ${payload.email} shortly.`,
        `<div><strong>Enquiry:</strong> ${enquiryText}</div>${extra}<div style="margin-top:4px;font-size:11px;color:var(--color-text-secondary);"><strong>Message:</strong> "${payload.message.substring(0, 60)}..."</div>`
      );
      form.reset();
      cateringDetails.classList.remove('show');
    }
  });

  // Success modal close
  document.getElementById('success-modal-close').addEventListener('click', closeSuccessModal);
  document.getElementById('success-backdrop').addEventListener('click', closeSuccessModal);

  // Newsletter
  const nlBtn = document.getElementById('newsletter-btn');
  const nlEmail = document.getElementById('newsletter-email');
  const nlSuccess = document.getElementById('newsletter-success');

  nlBtn.addEventListener('click', () => {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nlEmail.value.trim())) {
      nlSuccess.style.display = 'block';
      nlEmail.value = '';
      setTimeout(() => { nlSuccess.style.display = 'none'; }, 5000);
    }
  });

  function setError(input) { input.parentElement.classList.add('error'); }
  function clearError(input) { input.parentElement.classList.remove('error'); }
}

/* ==========================================================================
   8. 3D CARD TILT EFFECT
   ========================================================================== */
function init3DCardEffect() {
  const grid = document.getElementById('menu-grid');
  grid.addEventListener('mousemove', (e) => {
    const card = e.target.closest('.menu-card');
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -3;
    const rotateY = ((x - centerX) / centerX) * 3;
    card.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
  });
  grid.addEventListener('mouseleave', (e) => {
    const card = e.target.closest('.menu-card');
    if (card) card.style.transform = '';
  }, true);
  // Reset on mouseout from individual cards
  grid.addEventListener('mouseout', (e) => {
    const card = e.target.closest('.menu-card');
    if (card && !card.contains(e.relatedTarget)) {
      card.style.transform = '';
    }
  });
}

/* ==========================================================================
   UTILITIES
   ========================================================================== */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showSuccessModal(title, description, summaryHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-description').textContent = description;
  document.getElementById('modal-summary-details').innerHTML = summaryHtml;
  document.getElementById('success-backdrop').classList.add('open');
  document.getElementById('success-modal').classList.add('open');
}

function closeSuccessModal() {
  document.getElementById('success-backdrop').classList.remove('open');
  document.getElementById('success-modal').classList.remove('open');
}
