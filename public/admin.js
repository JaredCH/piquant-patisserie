/* ==========================================================================
   ADMIN PANEL — COMPLETE LOGIC
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  checkSession();
});

/* ==========================================================================
   AUTH
   ========================================================================== */
async function checkSession() {
  try {
    const resp = await fetch('/api/admin/session');
    const data = await resp.json();
    if (data.authenticated) {
      showDashboard();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';
  initLoginForm();
}

function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'flex';
  initNavigation();
  loadAllData();
}

function initLoginForm() {
  const form = document.getElementById('login-form');
  const errorEl = document.getElementById('login-error');

  form.onsubmit = async (e) => {
    e.preventDefault();
    errorEl.textContent = '';
    const username = document.getElementById('login-user').value.trim();
    const password = document.getElementById('login-pass').value;

    if (!username || !password) { errorEl.textContent = 'Both fields are required.'; return; }

    try {
      const resp = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await resp.json();
      if (data.success) {
        showDashboard();
      } else {
        errorEl.textContent = data.error || 'Invalid credentials.';
      }
    } catch {
      errorEl.textContent = 'Server error. Please try again.';
    }
  };
}

/* ==========================================================================
   NAVIGATION
   ========================================================================== */
function initNavigation() {
  const links = document.querySelectorAll('.sidebar-link');
  const sectionTitle = document.getElementById('section-title');

  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.getAttribute('data-section');
      links.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
      document.getElementById(`section-${section}`).classList.add('active');
      sectionTitle.textContent = link.textContent.trim();
    });
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    showLogin();
  });
}

/* ==========================================================================
   LOAD ALL DATA
   ========================================================================== */
async function loadAllData() {
  await Promise.all([
    loadDashboardStats(),
    loadMenuItems(),
    loadTruckStatus(),
    loadSettings(),
    loadOrders()
  ]);

  document.getElementById('dashboard-date').textContent =
    new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  initMenuActions();
  initTruckForm();
  initStripeForm();
  initEmailForm();
}

/* ==========================================================================
   DASHBOARD STATS
   ========================================================================== */
let menuItemsCache = [];

async function loadDashboardStats() {
  try {
    const [menuResp, ordersResp] = await Promise.all([
      fetch('/api/admin/menu'),
      fetch('/api/admin/orders')
    ]);
    const menuData = await menuResp.json();
    const ordersData = await ordersResp.json();

    menuItemsCache = menuData.items || [];

    document.getElementById('stat-total').textContent = menuItemsCache.length;
    document.getElementById('stat-active').textContent = menuItemsCache.filter(i => i.is_active).length;
    document.getElementById('stat-orders').textContent = (ordersData.orders || []).length;

    const revenue = (ordersData.orders || []).reduce((sum, o) => sum + (o.total || 0), 0);
    document.getElementById('stat-revenue').textContent = formatCurrency(revenue);
  } catch (err) {
    console.error('[Admin] Stats load error:', err);
  }
}

/* ==========================================================================
   MENU MANAGER
   ========================================================================== */
async function loadMenuItems() {
  try {
    const resp = await fetch('/api/admin/menu');
    const data = await resp.json();
    menuItemsCache = data.items || [];
    renderMenuTable();
  } catch (err) {
    console.error('[Admin] Menu load error:', err);
  }
}

function renderMenuTable() {
  const tbody = document.getElementById('menu-tbody');
  if (!menuItemsCache.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No menu items found.</td></tr>';
    return;
  }

  const catNames = { 'cake-jars': 'Cake Jars', 'brownies': 'Brownies', 'macarons': 'Macarons', 'creme-brulee': 'Crème Brûlée', 'cookies': 'Cookies' };

  tbody.innerHTML = menuItemsCache.map(item => `
    <tr>
      <td><div class="thumb" style="background-image:url('${escapeAttr(item.image_url)}')"></div></td>
      <td><strong>${escapeHtml(item.name)}</strong></td>
      <td>${escapeHtml(catNames[item.category_slug] || item.category_slug)}</td>
      <td>${formatCurrency(item.price)}</td>
      <td>${item.bulk_qty ? `${item.bulk_qty} for ${formatCurrency(item.bulk_price)}` : '—'}</td>
      <td>
        <label class="toggle">
          <input type="checkbox" ${item.is_active ? 'checked' : ''} data-id="${item.id}" class="toggle-active">
          <span class="toggle-slider"></span>
        </label>
      </td>
      <td>
        <button class="btn-gold btn-sm edit-item-btn" data-id="${item.id}"><i class="ti ti-pencil"></i></button>
        <button class="btn-danger btn-sm delete-item-btn" data-id="${item.id}"><i class="ti ti-trash"></i></button>
      </td>
    </tr>
  `).join('');
}

function initMenuActions() {
  const overlay = document.getElementById('item-modal-overlay');
  const closeBtn = document.getElementById('modal-close-btn');
  const form = document.getElementById('item-form');
  const addBtn = document.getElementById('add-item-btn');
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('item-file');
  const previewEl = document.getElementById('upload-preview');
  const previewImg = document.getElementById('preview-img');

  let pendingFile = null;

  function openModal(title) {
    document.getElementById('modal-title-text').textContent = title;
    overlay.classList.add('open');
    pendingFile = null;
    previewEl.style.display = 'none';
  }
  function closeModal() { overlay.classList.remove('open'); form.reset(); pendingFile = null; previewEl.style.display = 'none'; }

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  addBtn.addEventListener('click', () => {
    document.getElementById('item-id').value = '';
    form.reset();
    openModal('Add Menu Item');
  });

  // Edit/Delete/Toggle from table
  document.getElementById('menu-tbody').addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.edit-item-btn');
    const deleteBtn = e.target.closest('.delete-item-btn');
    const toggleInput = e.target.closest('.toggle-active');

    if (editBtn) {
      const id = parseInt(editBtn.dataset.id);
      const item = menuItemsCache.find(i => i.id === id);
      if (!item) return;
      document.getElementById('item-id').value = item.id;
      document.getElementById('item-name').value = item.name;
      document.getElementById('item-desc').value = item.description || '';
      document.getElementById('item-price').value = item.price;
      document.getElementById('item-category').value = item.category_slug;
      document.getElementById('item-bulk-qty').value = item.bulk_qty || 0;
      document.getElementById('item-bulk-price').value = item.bulk_price || 0;
      document.getElementById('item-image').value = item.image_url || '';
      openModal('Edit Menu Item');
    }

    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      if (!confirm('Delete this menu item? This cannot be undone.')) return;
      try {
        await fetch(`/api/admin/menu/${id}`, { method: 'DELETE' });
        showToast('Item deleted.', 'success');
        await loadMenuItems();
        await loadDashboardStats();
      } catch { showToast('Failed to delete item.', 'error'); }
    }

    if (toggleInput) {
      const id = toggleInput.dataset.id;
      const isActive = toggleInput.checked ? 1 : 0;
      try {
        await fetch(`/api/admin/menu/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: isActive })
        });
        showToast(`Item ${isActive ? 'activated' : 'deactivated'}.`, 'success');
        await loadMenuItems();
        await loadDashboardStats();
      } catch { showToast('Failed to toggle status.', 'error'); }
    }
  });

  // Save (Create or Update)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('item-id').value;
    const payload = {
      name: document.getElementById('item-name').value.trim(),
      description: document.getElementById('item-desc').value.trim(),
      price: parseFloat(document.getElementById('item-price').value),
      category_slug: document.getElementById('item-category').value,
      bulk_qty: parseInt(document.getElementById('item-bulk-qty').value) || 0,
      bulk_price: parseFloat(document.getElementById('item-bulk-price').value) || 0,
      image_url: document.getElementById('item-image').value.trim()
    };

    if (!payload.name || !payload.price) { showToast('Name and price are required.', 'error'); return; }

    try {
      const url = id ? `/api/admin/menu/${id}` : '/api/admin/menu';
      const method = id ? 'PUT' : 'POST';
      const resp = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const savedItem = await resp.json();

      // Upload image if file is pending
      if (pendingFile && savedItem.id) {
        const formData = new FormData();
        formData.append('image', pendingFile);
        await fetch(`/api/admin/menu/${savedItem.id}/image`, { method: 'POST', body: formData });
      }

      showToast(id ? 'Item updated!' : 'Item created!', 'success');
      closeModal();
      await loadMenuItems();
      await loadDashboardStats();
    } catch { showToast('Failed to save item.', 'error'); }
  });

  // Image upload zone
  uploadZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => { if (e.target.files[0]) handleImageFile(e.target.files[0]); });
  uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault(); uploadZone.classList.remove('drag-over');
    if (e.dataTransfer.files[0]) handleImageFile(e.dataTransfer.files[0]);
  });

  function handleImageFile(file) {
    pendingFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target.result;
      previewEl.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
}

/* ==========================================================================
   TRUCK TRACKER
   ========================================================================== */
async function loadTruckStatus() {
  try {
    const resp = await fetch('/api/admin/settings');
    const settings = await resp.json();

    document.getElementById('truck-current-status').textContent = settings.truck_status || '—';
    document.getElementById('truck-current-location').textContent = settings.truck_location || '—';
    document.getElementById('truck-current-hours').textContent = settings.truck_hours || '—';
    document.getElementById('truck-current-message').textContent = settings.truck_message || '—';

    document.getElementById('truck-status').value = settings.truck_status || 'closed';
    document.getElementById('truck-hours').value = settings.truck_hours || '';
    document.getElementById('truck-message').value = settings.truck_message || '';

    const locSelect = document.getElementById('truck-location');
    const currentLoc = settings.truck_location || '';
    const presets = Array.from(locSelect.options).map(o => o.value);
    if (presets.includes(currentLoc)) {
      locSelect.value = currentLoc;
    } else if (currentLoc) {
      locSelect.value = 'custom';
      document.getElementById('custom-location-field').style.display = 'block';
      document.getElementById('truck-custom-location').value = currentLoc;
    }
  } catch (err) { console.error('[Admin] Truck load error:', err); }
}

function initTruckForm() {
  const locSelect = document.getElementById('truck-location');
  const customField = document.getElementById('custom-location-field');

  locSelect.addEventListener('change', () => {
    customField.style.display = locSelect.value === 'custom' ? 'block' : 'none';
  });

  document.getElementById('truck-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const location = locSelect.value === 'custom'
      ? document.getElementById('truck-custom-location').value.trim()
      : locSelect.value;

    try {
      await fetch('/api/admin/truck', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: document.getElementById('truck-status').value,
          location,
          hours: document.getElementById('truck-hours').value.trim(),
          message: document.getElementById('truck-message').value.trim()
        })
      });
      showToast('Truck status updated!', 'success');
      await loadTruckStatus();
    } catch { showToast('Failed to update truck status.', 'error'); }
  });
}

/* ==========================================================================
   SETTINGS (STRIPE & EMAIL)
   ========================================================================== */
let settingsCache = {};

async function loadSettings() {
  try {
    const resp = await fetch('/api/admin/settings');
    settingsCache = await resp.json();

    document.getElementById('stripe-pk').value = settingsCache.stripe_publishable_key || '';
    document.getElementById('stripe-sk').value = settingsCache.stripe_secret_key || '';
    updateStripeMode();

    document.getElementById('smtp-host').value = settingsCache.smtp_host || '';
    document.getElementById('smtp-port').value = settingsCache.smtp_port || '';
    document.getElementById('smtp-user').value = settingsCache.smtp_user || '';
    document.getElementById('smtp-pass').value = settingsCache.smtp_pass || '';
    document.getElementById('smtp-from').value = settingsCache.smtp_from || '';
  } catch (err) { console.error('[Admin] Settings load error:', err); }
}

function updateStripeMode() {
  const sk = document.getElementById('stripe-sk').value;
  const modeEl = document.getElementById('stripe-mode');
  if (sk.startsWith('sk_live_')) {
    modeEl.innerHTML = 'Mode: <span style="color:var(--admin-green)">Live</span>';
  } else if (sk.startsWith('sk_test_')) {
    modeEl.innerHTML = 'Mode: <span>Test</span>';
  } else {
    modeEl.innerHTML = 'Mode: <span style="color:var(--admin-text-muted)">Not Configured</span>';
  }
}

function initStripeForm() {
  document.getElementById('stripe-sk').addEventListener('input', updateStripeMode);

  document.getElementById('stripe-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stripe_publishable_key: document.getElementById('stripe-pk').value.trim(),
          stripe_secret_key: document.getElementById('stripe-sk').value.trim()
        })
      });
      showToast('Stripe settings saved!', 'success');
    } catch { showToast('Failed to save Stripe settings.', 'error'); }
  });
}

function initEmailForm() {
  document.getElementById('email-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtp_host: document.getElementById('smtp-host').value.trim(),
          smtp_port: document.getElementById('smtp-port').value.trim(),
          smtp_user: document.getElementById('smtp-user').value.trim(),
          smtp_pass: document.getElementById('smtp-pass').value.trim(),
          smtp_from: document.getElementById('smtp-from').value.trim()
        })
      });
      showToast('Email settings saved!', 'success');
    } catch { showToast('Failed to save email settings.', 'error'); }
  });

  document.getElementById('test-email-btn').addEventListener('click', async () => {
    try {
      showToast('Sending test email...', 'info');
      const resp = await fetch('/api/admin/settings/test-email', { method: 'POST' });
      const data = await resp.json();
      if (data.success) { showToast('Test email sent!', 'success'); }
      else { showToast(data.error || 'Test email failed.', 'error'); }
    } catch { showToast('Failed to send test email.', 'error'); }
  });
}

/* ==========================================================================
   ORDERS
   ========================================================================== */
async function loadOrders() {
  try {
    const resp = await fetch('/api/admin/orders');
    const data = await resp.json();
    const orders = data.orders || [];
    const tbody = document.getElementById('orders-tbody');

    if (!orders.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No orders yet.</td></tr>';
      return;
    }

    tbody.innerHTML = orders.map(order => {
      let itemsSummary = '';
      try {
        const items = JSON.parse(order.items_json || '[]');
        itemsSummary = items.map(i => `${i.name} ×${i.qty}`).join(', ');
      } catch { itemsSummary = 'Parse error'; }

      return `<tr>
        <td>#${order.id}</td>
        <td>${formatDate(order.created_at)}</td>
        <td>${escapeHtml(order.customer_name)}</td>
        <td>${escapeHtml(order.customer_email)}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeAttr(itemsSummary)}">${escapeHtml(itemsSummary)}</td>
        <td>${formatCurrency(order.total)}</td>
        <td><span style="color:${order.status === 'pending' ? 'var(--admin-gold)' : order.status === 'mock' ? 'var(--admin-blue)' : 'var(--admin-green)'}">${order.status}</span></td>
      </tr>`;
    }).join('');
  } catch (err) { console.error('[Admin] Orders load error:', err); }
}

/* ==========================================================================
   TOAST SYSTEM
   ========================================================================== */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const icons = { success: 'ti-circle-check', error: 'ti-circle-x', info: 'ti-info-circle' };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="ti ${icons[type] || icons.info}"></i> ${escapeHtml(message)}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* ==========================================================================
   UTILITIES
   ========================================================================== */
function formatCurrency(amount) {
  return '$' + (Number(amount) || 0).toFixed(2);
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

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
