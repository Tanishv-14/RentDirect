/**
 * RentDirect - Main UI Controller
 * Handles:
 * - Authentication (Login / Logout panel with role-based demo accounts)
 * - Access Control (ONLY Backend Team can view & approve verification)
 * - Inspection Scheduling (Sends DATE RANGE to owner)
 * - Facility Checklist & Final Approval
 * - Property Rendering & Interactive Navigation
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initCollegeDropdowns();
  initAuthPanel();
  initAdminVerificationCenter();
});

window.addEventListener('rentdirect:database-changed', () => {
  const modal = document.getElementById('db-inspector-modal');
  if (modal?.classList.contains('open')) switchDbTab(activeDbTab);
  const ownerModal = document.getElementById('owner-inquiries-modal');
  if (ownerModal?.classList.contains('open')) renderOwnerInquiries();
});

window.addEventListener('storage', event => {
  if (!event.key || ['rentdirect_students', 'rentdirect_owners', 'rentdirect_inquiries'].includes(event.key)) {
    const modal = document.getElementById('db-inspector-modal');
    if (modal?.classList.contains('open')) switchDbTab(activeDbTab);
    const ownerModal = document.getElementById('owner-inquiries-modal');
    if (ownerModal?.classList.contains('open')) renderOwnerInquiries();
  }
});

window.addEventListener('rentdirect:property-review-updated', () => {
  refreshVisiblePropertyCards();
  const modal = document.getElementById('admin-verify-modal');
  if (modal?.classList.contains('open')) renderAdminQueue();
});

async function refreshVisiblePropertyCards() {
  if (!document.querySelector('.property-card') || !window.RentDirectAPI) return;
  try {
    const properties = await RentDirectAPI.getProperties();
    const byId = new Map(properties.map(property => [String(property.id), property]));
    document.querySelectorAll('.property-card[data-id]').forEach(card => {
      const property = byId.get(String(card.dataset.id));
      if (property) card.outerHTML = createPropertyCardHTML(property);
    });
  } catch (error) {
    console.error('Unable to refresh property review badges', error);
  }
}

// -----------------------------------------------------------------------------
// 1. MOBILE MENU TOGGLE
// -----------------------------------------------------------------------------
function initMobileNav() {
  const toggleBtn = document.querySelector('.mobile-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (toggleBtn && navLinks) {
    toggleBtn.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
  }
}

// -----------------------------------------------------------------------------
// 2. COLLEGE DROPDOWNS
// -----------------------------------------------------------------------------
function initCollegeDropdowns() {
  const dropdowns = document.querySelectorAll('.select-college');
  if (!dropdowns.length || !window.RENTDIRECT_CONFIG) return;

  dropdowns.forEach(select => {
    const initialText = select.getAttribute('data-placeholder') || 'All Nearby Colleges';
    select.innerHTML = `<option value="all">${initialText}</option>`;
    
    window.RENTDIRECT_CONFIG.COLLEGES.forEach(college => {
      const opt = document.createElement('option');
      opt.value = college.id;
      opt.textContent = `${college.name} - ${college.location.split(',')[0]}`;
      select.appendChild(opt);
    });
  });
}

// -----------------------------------------------------------------------------
// 3. PROPERTY CARD MARKUP GENERATOR
// -----------------------------------------------------------------------------
function createPropertyCardHTML(property) {
  const genderClass = property.gender === 'boys' ? 'boys' : (property.gender === 'girls' ? 'girls' : 'unisex');
  const genderLabel = property.gender.toUpperCase() + ' PG';
  const cost = getTrueCostBreakdown(property);
  const chargesReviewed = isPropertyReviewed(property);
  const fixedChargeBadge = chargesReviewed ? '[CONFIRMED]' : '[OWNER STATED]';
  const fixedChargeClass = chargesReviewed ? 'confirmed' : 'owner-stated';
  const review = getPropertyReviewBadge(property);

  const amenitiesBadges = (property.amenities || [])
    .slice(0, 4)
    .map(a => `<span class="amenity-chip">${a}</span>`)
    .join('');

  return `
    <article class="property-card" data-id="${property.id}">
      <div class="property-image-box">
        <img class="property-img" src="${property.images[0]}" alt="${property.title}" loading="lazy" />
        <span class="badge-gender ${genderClass}">${genderLabel}</span>
        <span class="review-status-badge ${review.className}">${review.label}</span>
      </div>
      <div class="property-body">
        <div class="property-college-tag">${property.collegeName}</div>
        <h3 class="property-title">${property.title}</h3>
        <p class="review-note">A review is a check, not a guarantee</p>
        <p class="property-address">
          <span>📍</span> ${property.distanceToCollege || property.address}
        </p>
        <div class="amenities-pills">
          ${amenitiesBadges}
        </div>
        <div class="property-footer">
          <div class="price-container">
            <span class="price-label">True-Cost View · monthly</span>
            <span class="price-value">₹${cost.monthlyTotal.toLocaleString('en-IN')} <span>/month</span></span>
            <div class="listing-cost-breakdown">
              <div><span>Base Rent</span><span>₹${cost.baseRent.toLocaleString('en-IN')} <b class="cost-badge ${fixedChargeClass}">${fixedChargeBadge}</b></span></div>
              <div><span>Mess</span><span>₹${cost.messCharge.toLocaleString('en-IN')} <b class="cost-badge ${fixedChargeClass}">${fixedChargeBadge}</b></span></div>
              <div><span>Maintenance</span><span>₹${cost.maintenanceCharge.toLocaleString('en-IN')} <b class="cost-badge ${fixedChargeClass}">${fixedChargeBadge}</b></span></div>
              <div><span>Utilities · baseline</span><span>₹${cost.utilities.toLocaleString('en-IN')} <b class="cost-badge estimated">[ESTIMATED]</b></span></div>
            </div>
          </div>
          <a href="property-details.html?id=${property.id}" class="btn btn-outline btn-sm">View Details</a>
        </div>
      </div>
    </article>
  `;
}

function getPropertyReviewBadge(property) {
  const status = String(
    property.reviewStatus ||
    (property.verified || property.verificationStatus === 'verified'
      ? 'reviewed'
      : ['rejected', 'unverified'].includes(property.verificationStatus)
        ? 'unverified'
        : 'pending')
  ).toLowerCase();
  if (status === 'reviewed') return { label: '✓ Reviewed', className: 'reviewed' };
  if (status === 'unverified') return { label: '⚠ Unverified', className: 'unverified' };
  return { label: '⏳ Pending', className: 'pending' };
}

function computePropertyFlags(properties) {
  const normalize = value => String(value || '').trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  const normalizePhone = value => String(value || '').replace(/\D/g, '');

  return properties.map(property => {
    const phone = normalizePhone(property.owner?.phone);
    const address = normalize(property.address);
    const title = normalize(property.title);
    const duplicateMatches = properties
      .filter(other => other !== property)
      .map(other => {
        const reasons = [];
        if (phone && phone === normalizePhone(other.owner?.phone)) reasons.push('owner phone');
        if (address && address === normalize(other.address)) reasons.push('address');
        if (title && title === normalize(other.title)) reasons.push('title');
        return reasons.length ? { id: other.id, title: other.title, reasons } : null;
      })
      .filter(Boolean);

    return {
      ...property,
      price_flag: Number(property.price) < 3000,
      duplicate_flag: duplicateMatches.length > 0,
      duplicate_matches: duplicateMatches
    };
  });
}

function getTrueCostBreakdown(property, options = {}) {
  const rates = window.RENTDIRECT_CONFIG?.TRUE_COST || {};
  const applianceRates = rates.applianceMonthly || {};
  const commuteRates = rates.commuteMonthly || {};
  const appliances = options.appliances || {};
  const applianceEstimate =
    (appliances.ac ? applianceRates.ac || 0 : 0) +
    (appliances.geyser ? applianceRates.geyser || 0 : 0) +
    (appliances.cooler ? applianceRates.cooler || 0 : 0);
  const utilities = (property.utilitiesEstimate ?? rates.utilitiesBase ?? 0) + applianceEstimate;
  const baseRent = Number(property.price) || 0;
  const messCharge = Number(property.messCharge ?? rates.messCharge) || 0;
  const maintenanceCharge = Number(property.maintenanceCharge ?? rates.maintenanceCharge) || 0;
  const commute = commuteRates[options.commuteMode || 'walk'] || 0;

  return {
    baseRent,
    messCharge,
    maintenanceCharge,
    utilities,
    commute,
    monthlyTotal: baseRent + messCharge + maintenanceCharge + utilities + commute,
    deposit: Number(property.securityDeposit) || baseRent
  };
}

function isPropertyReviewed(property) {
  if (property.reviewStatus) return String(property.reviewStatus).toLowerCase() === 'reviewed';
  const status = String(property.verificationStatus || property.status || '').toLowerCase();
  return property.verified === true || status === 'verified' || status === 'reviewed';
}

// -----------------------------------------------------------------------------
// 4. AUTHENTICATION PANEL (LOGIN & LOGOUT)
// -----------------------------------------------------------------------------
function initAuthPanel() {
  const navActions = document.querySelector('.nav-actions');
  if (!navActions) return;

  // Render Login/User Slot in navbar if not present
  let authSlot = document.getElementById('navbar-auth-slot');
  if (!authSlot) {
    authSlot = document.createElement('div');
    authSlot.id = 'navbar-auth-slot';
    navActions.insertBefore(authSlot, navActions.firstChild);
  }

  renderAuthSlot();

  // Create Auth Modal in document if not present
  if (!document.getElementById('auth-login-modal')) {
    const modalMarkup = `
      <div class="auth-modal-overlay" id="auth-login-modal">
        <div class="auth-modal-card">
          <div class="auth-modal-header">
            <div>
              <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--brand-neutral);">Sign In to RentDirect</h3>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">
                Select your role to access your portal.
              </p>
            </div>
            <button onclick="RentDirectUI.toggleLoginModal(false)" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted);">&times;</button>
          </div>

          <div class="auth-modal-body">
            <!-- Role Selector Tabs -->
            <div class="auth-role-tabs">
              <button class="auth-role-tab active" data-role="student" onclick="RentDirectUI.switchAuthTab('student')">🎓 Student</button>
              <button class="auth-role-tab" data-role="owner" onclick="RentDirectUI.switchAuthTab('owner')">🏠 PG Owner</button>
              <button class="auth-role-tab" data-role="backend_team" onclick="RentDirectUI.switchAuthTab('backend_team')">🛡️ Backend Team</button>
            </div>

            <!-- Demo Quick Login Helper -->
            <div class="demo-account-box" id="demo-account-box">
              <div class="demo-account-header">
                <span id="demo-role-badge">Demo Account: Student</span>
                <button type="button" class="btn-demo-fill" onclick="RentDirectUI.fillDemoCredentials()">⚡ One-Click Fill</button>
              </div>
              <div style="font-size: 0.85rem; color: var(--brand-neutral);">
                Email: <strong id="demo-email-display">ananya@rentdirect.com</strong> • Pass: <strong id="demo-password-display">student123</strong>
              </div>
            </div>

            <!-- Login Form -->
            <form id="auth-login-form" onsubmit="RentDirectUI.handleLoginSubmit(event)">
              <div class="form-field" style="margin-bottom: 0.85rem;">
                <label for="login-email" style="font-size: 0.85rem;">Email Address</label>
                <input type="email" id="login-email" class="form-control" placeholder="name@example.com" required />
              </div>
              <div class="form-field" style="margin-bottom: 1.25rem;">
                <label for="login-password" style="font-size: 0.85rem;">Password</label>
                <input type="password" id="login-password" class="form-control" placeholder="••••••••" required />
              </div>
              <button type="submit" id="btn-login-submit" class="btn btn-primary btn-block btn-lg">
                Log In
              </button>
            </form>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalMarkup);
  }

  // Listen for auth change events
  window.addEventListener('rentdirect:auth-changed', () => {
    renderAuthSlot();
    initAdminVerificationCenter(); // re-evaluate permissions (only Backend Team can view bell)
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    const menu = document.getElementById('user-dropdown');
    const btn = document.querySelector('.user-pill-btn');
    if (menu && btn && !btn.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove('open');
    }
  });
}

// Render either Log In button or User Pill dropdown
function renderAuthSlot() {
  const slot = document.getElementById('navbar-auth-slot');
  if (!slot || !window.RentDirectAPI) return;

  const user = RentDirectAPI.getCurrentUser();

  if (!user) {
    slot.innerHTML = `
      <button class="btn btn-outline btn-sm" onclick="RentDirectUI.toggleLoginModal(true)">
        🔑 Log In
      </button>
    `;
  } else {
    let roleClass = 'student';
    let roleLabel = 'Student';
    let roleIcon = '🎓';

    if (user.role === 'backend_team' || user.role === 'admin') {
      roleClass = 'admin';
      roleLabel = 'Backend Team';
      roleIcon = '🛡️';
    } else if (user.role === 'owner') {
      roleClass = 'owner';
      roleLabel = 'Owner';
      roleIcon = '🏠';
    }

    slot.innerHTML = `
      <div class="user-profile-menu">
        <button class="user-pill-btn" onclick="RentDirectUI.toggleUserDropdown()">
          <span>${roleIcon}</span>
          <span>${user.name}</span>
          <span class="user-role-tag ${roleClass}">${roleLabel}</span>
          <span style="font-size: 0.7rem; color: var(--text-muted);">▼</span>
        </button>

        <div class="user-dropdown-menu" id="user-dropdown">
          <div class="user-dropdown-header">
            Signed in as<br>
            <strong style="color: var(--brand-neutral);">${user.email}</strong>
          </div>
          ${user.role === 'backend_team' ? `
            <button class="user-dropdown-link" onclick="RentDirectUI.toggleAdminModal(true)">
              ⚠️ Admin Review: Flags & Status
            </button>
            <button class="user-dropdown-link" onclick="RentDirectUI.toggleAdminModal(true)">
              🛡️ Verification Queue & Inspections
            </button>
            <button class="user-dropdown-link" onclick="RentDirectUI.openDbInspector()">
              📊 Live Database Inspector
            </button>
          ` : ''}
          ${user.role === 'owner' ? `
            <button class="user-dropdown-link" onclick="RentDirectUI.openOwnerInquiries()">
              📩 Student Inquiries
            </button>
            <a href="owner-register.html" class="user-dropdown-link">
              ➕ List a New Property
            </a>
          ` : ''}
          <button class="user-dropdown-link logout-btn" onclick="RentDirectUI.handleLogout()">
            🚪 Log Out
          </button>
        </div>
      </div>
    `;
  }
}

// -----------------------------------------------------------------------------
// PG OWNER INQUIRIES
// -----------------------------------------------------------------------------
function ensureOwnerInquiriesModal() {
  if (document.getElementById('owner-inquiries-modal')) return;

  document.body.insertAdjacentHTML('beforeend', `
    <div class="admin-modal-overlay" id="owner-inquiries-modal">
      <div class="admin-modal-card" style="max-width: 860px;">
        <div class="admin-modal-header">
          <div>
            <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--brand-neutral);">📩 Student Inquiries</h3>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">
              Review visit requests and confirm student move-ins.
            </p>
          </div>
          <button onclick="RentDirectUI.toggleOwnerInquiries(false)" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted);">&times;</button>
        </div>
        <div class="admin-modal-body">
          <div style="display: flex; justify-content: flex-end; margin-bottom: 0.75rem;">
            <button class="btn btn-outline btn-sm" onclick="RentDirectUI.renderOwnerInquiries()">↻ Refresh</button>
          </div>
          <div id="owner-inquiries-content" style="overflow-x: auto; min-height: 180px;"></div>
        </div>
      </div>
    </div>
  `);

  document.getElementById('owner-inquiries-content').addEventListener('click', event => {
    const button = event.target.closest('[data-inquiry-status]');
    if (button) updateOwnerInquiryStatus(button.dataset.inquiryId, button.dataset.inquiryStatus);
  });
}

function openOwnerInquiries() {
  ensureOwnerInquiriesModal();
  toggleOwnerInquiries(true);
}

function toggleOwnerInquiries(open) {
  const modal = document.getElementById('owner-inquiries-modal');
  if (modal) modal.classList.toggle('open', open);
  if (open) renderOwnerInquiries();
}

async function renderOwnerInquiries() {
  const content = document.getElementById('owner-inquiries-content');
  const owner = RentDirectAPI.getCurrentUser();
  if (!content || !owner || owner.role !== 'owner') return;

  content.innerHTML = '<p style="text-align:center; padding: 2rem;">Loading student inquiries...</p>';
  try {
    const inquiries = await RentDirectAPI.getOwnerInquiries(owner.email);
    if (!inquiries.length) {
      content.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--text-secondary);">No student inquiries yet.</p>';
      return;
    }

    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
    const formatDate = value => {
      const date = value ? new Date(value) : null;
      return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : '—';
    };

    content.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
        <thead>
          <tr style="background: var(--bg-surface-alt); border-bottom: 2px solid var(--border-color);">
            ${['Student', 'Phone', 'College', 'Property', 'Move-in Date', 'Requested', 'Status', 'Action'].map(label => `<th style="padding: 0.6rem;">${label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${inquiries.map(inquiry => {
            const status = inquiry.status || 'pending';
            const action = status === 'pending'
              ? { label: 'Approve Visit', next: 'visit_approved' }
              : status === 'visit_approved'
                ? { label: 'Confirm Move-In', next: 'move_in_confirmed' }
                : null;
            const statusLabel = {
              pending: 'Awaiting response',
              visit_approved: 'Visit approved',
              move_in_confirmed: 'Move-in confirmed'
            }[status] || status;
            return `
              <tr style="border-bottom: 1px solid var(--border-light);">
                <td style="padding: 0.6rem;">${escapeHtml(inquiry.name)}</td>
                <td style="padding: 0.6rem;">${escapeHtml(inquiry.phone)}</td>
                <td style="padding: 0.6rem;">${escapeHtml(inquiry.college)}</td>
                <td style="padding: 0.6rem;">${escapeHtml(inquiry.propertyTitle)}</td>
                <td style="padding: 0.6rem;">${escapeHtml(inquiry.date)}</td>
                <td style="padding: 0.6rem;">${escapeHtml(formatDate(inquiry.submittedAt))}</td>
                <td style="padding: 0.6rem; white-space: nowrap;">${escapeHtml(statusLabel)}</td>
                <td style="padding: 0.6rem; white-space: nowrap;">
                  ${action ? `<button class="btn btn-primary btn-sm" data-inquiry-status="${action.next}" data-inquiry-id="${escapeHtml(inquiry.id)}">${action.label}</button>` : '<span>Complete</span>'}
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    console.error('Unable to load owner inquiries', error);
    content.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--danger);">Unable to load student inquiries. Please refresh.</p>';
  }
}

async function updateOwnerInquiryStatus(inquiryId, status) {
  const owner = RentDirectAPI.getCurrentUser();
  if (!owner || owner.role !== 'owner') return;

  try {
    await RentDirectAPI.updateInquiryStatus(inquiryId, status, owner.email);
    showToast(status === 'visit_approved' ? 'Visit approved.' : 'Move-in confirmed.', 'success');
    await renderOwnerInquiries();
  } catch (error) {
    console.error('Unable to update inquiry status', error);
    showToast('Unable to update inquiry status. Please refresh and try again.', 'danger');
  }
}

// Auth modal role switcher helper
let selectedAuthRole = 'student';
const demoAccounts = {
  student: {
    label: 'Student Account',
    email: 'ananya@rentdirect.com',
    password: 'student123'
  },
  owner: {
    label: 'PG Owner Account',
    email: 'ramesh@rentdirect.com',
    password: 'owner123'
  },
  backend_team: {
    label: 'Backend Team (Exclusive Approval Access)',
    email: 'admin@rentdirect.com',
    password: 'admin123'
  }
};

function switchAuthTab(role) {
  selectedAuthRole = demoAccounts[role] ? role : 'student';
  document.querySelectorAll('.auth-role-tab').forEach(t => {
    t.classList.toggle('active', t.getAttribute('data-role') === selectedAuthRole);
  });

  const badgeEl = document.getElementById('demo-role-badge');
  const emailEl = document.getElementById('demo-email-display');
  const demoPasswordEl = document.getElementById('demo-password-display');
  const account = demoAccounts[selectedAuthRole];
  badgeEl.textContent = account.label;
  emailEl.textContent = account.email;
  demoPasswordEl.textContent = account.password;
  fillDemoCredentials();
}

function fillDemoCredentials() {
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  const account = demoAccounts[selectedAuthRole];
  emailInput.value = account.email;
  passInput.value = account.password;
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const btn = document.getElementById('btn-login-submit');

  btn.disabled = true;
  btn.textContent = 'Signing in...';

  try {
    const res = await RentDirectAPI.login(email, password, selectedAuthRole);
    showToast(`✓ Welcome ${res.user.name}! Signed in as ${res.user.role.replace('_', ' ')}.`, 'success');
    toggleLoginModal(false);
  } catch (err) {
    showToast('Login failed. Please check credentials.', 'danger');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Log In';
  }
}

async function handleLogout() {
  await RentDirectAPI.logout();
  showToast('You have been logged out.', 'info');
}

function toggleUserDropdown() {
  const menu = document.getElementById('user-dropdown');
  if (menu) menu.classList.toggle('open');
}

function toggleLoginModal(open) {
  const modal = document.getElementById('auth-login-modal');
  if (!modal) return;
  modal.classList.toggle('open', open);
  if (open) {
    switchAuthTab('student');
    fillDemoCredentials();
  }
}

// -----------------------------------------------------------------------------
// 5. BACKEND TEAM VERIFICATION & DATE-RANGE INSPECTION CENTER
// STRICT ACCESS CONTROL: ONLY Backend Team can view & approve!
// -----------------------------------------------------------------------------
function initAdminVerificationCenter() {
  const navActions = document.querySelector('.nav-actions');
  if (!navActions) return;

  const isBackend = RentDirectAPI.isBackendTeam();
  let notifBtn = document.getElementById('admin-notif-btn');

  // If user is NOT backend team, hide the bell completely!
  if (!isBackend) {
    if (notifBtn) notifBtn.style.display = 'none';
    return;
  }

  // If user IS backend team, show the bell!
  if (!notifBtn) {
    notifBtn = document.createElement('button');
    notifBtn.id = 'admin-notif-btn';
    notifBtn.className = 'admin-notif-btn';
    notifBtn.title = 'Backend Team: Verification & Inspection Queue';
    notifBtn.innerHTML = `🔔<span class="notif-count-badge empty" id="admin-notif-count">0</span>`;
    notifBtn.addEventListener('click', () => toggleAdminModal(true));
    navActions.insertBefore(notifBtn, navActions.firstChild);
  } else {
    notifBtn.style.display = 'inline-flex';
  }

  // Inject Verification Modal into DOM if missing
  if (!document.getElementById('admin-verify-modal')) {
    const modalMarkup = `
      <div class="admin-modal-overlay" id="admin-verify-modal">
        <div class="admin-modal-card" style="max-width: 680px;">
          <div class="admin-modal-header">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--brand-neutral);">
                  🛡️ Backend Team: Verification & Inspection Center
                </h3>
                <span class="user-role-tag admin">Authorized Only</span>
              </div>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">
                Verify facilities on site. Send date ranges to owners and grant Verified Badges.
              </p>
            </div>
            <button onclick="RentDirectUI.toggleAdminModal(false)" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted);">&times;</button>
          </div>
          <div class="admin-modal-body">
            <section id="admin-review-panel" style="border: 1px solid var(--border-color); border-radius: var(--radius-md); margin-bottom: 1rem; overflow: hidden;">
              <div style="padding: 0.9rem 1rem; background: var(--bg-surface-alt);">
                <h4 style="font-size: 1rem; font-weight: 800; color: var(--brand-neutral);">⚠️ Admin Review: Automated Flags & Status</h4>
                <p style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.25rem;">Price flag: rent below ₹3,000. Duplicate flag: matching owner phone, property address, or title.</p>
              </div>
              <div id="admin-review-properties" style="padding: 0.75rem; overflow-x: auto;"></div>
            </section>
            <div id="admin-queue-list">
            <!-- Dynamically populated -->
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalMarkup);
    document.getElementById('admin-review-panel').addEventListener('click', event => {
      const button = event.target.closest('[data-review-save]');
      if (!button) return;
      const propertyId = button.dataset.propertyId;
      const status = Array.from(document.querySelectorAll('[data-review-status]'))
        .find(select => select.dataset.reviewStatus === propertyId)?.value;
      updatePropertyReviewStatus(propertyId, status);
    });
  }

  updateAdminNotificationCount();

  window.addEventListener('rentdirect:notification-updated', () => {
    updateAdminNotificationCount();
    renderAdminQueue();
  });
}

// Update the badge counter on the notification bell
async function updateAdminNotificationCount() {
  const countEl = document.getElementById('admin-notif-count');
  if (!countEl || !window.RentDirectAPI || !RentDirectAPI.isBackendTeam()) return;

  try {
    const notifications = await RentDirectAPI.getAdminNotifications();
    const activeQueue = notifications.filter(n => n.status === 'pending' || n.status === 'inspection_scheduled');

    countEl.textContent = activeQueue.length;
    if (activeQueue.length > 0) {
      countEl.classList.remove('empty');
    } else {
      countEl.classList.add('empty');
    }
  } catch (e) {
    console.warn('Could not update notification count', e);
  }
}

function toggleAdminModal(open) {
  // Guard: Only Backend Team can open this modal
  if (open && !RentDirectAPI.isBackendTeam()) {
    showToast('Access Denied: Only RentDirect Backend Team can approve listings.', 'danger');
    toggleLoginModal(true);
    switchAuthTab('backend_team');
    return;
  }

  const modal = document.getElementById('admin-verify-modal');
  if (!modal) return;

  modal.classList.toggle('open', open);
  if (open) {
    renderAdminQueue();
  }
}

// Helper: Format default date range (Tomorrow to +3 days)
function getDefaultDateRange() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const plusThree = new Date();
  plusThree.setDate(plusThree.getDate() + 4);

  const format = (d) => d.toISOString().split('T')[0];
  return { start: format(tomorrow), end: format(plusThree) };
}

// Render queue items inside the Backend Team modal
async function renderAdminQueue() {
  const container = document.getElementById('admin-queue-list');
  if (!container || !window.RentDirectAPI) return;

  try {
    await renderAdminReviewPanel();
    const notifications = await RentDirectAPI.getAdminNotifications();
    const pendingList = notifications.filter(n => n.status === 'pending' || n.status === 'inspection_scheduled');

    if (pendingList.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem;">
          <div style="font-size: 2.8rem; margin-bottom: 0.5rem;">✅</div>
          <h4 style="font-size: 1.15rem; font-weight: 700; color: var(--brand-neutral);">Verification Queue Clear</h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.35rem;">
            All submitted owner accommodations have been inspected and reviewed.
          </p>
        </div>
      `;
      return;
    }

    const defaultDates = getDefaultDateRange();

    container.innerHTML = pendingList.map(item => {
      const isScheduled = item.status === 'inspection_scheduled';

      return `
        <div class="admin-queue-item" data-id="${item.propertyId}">
          <div class="queue-item-header">
            <div>
              <div style="font-size: 0.75rem; font-weight: 700; color: var(--brand-secondary); text-transform: uppercase;">
                🎓 ${item.collegeName}
              </div>
              <h4 style="font-size: 1.1rem; font-weight: 800; color: var(--brand-neutral); margin: 0.2rem 0;">
                ${item.propertyTitle}
              </h4>
              <div style="font-size: 0.85rem; color: var(--text-secondary);">
                Owner: <strong>${item.ownerName}</strong> (${item.ownerPhone})
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 1rem; font-weight: 800; color: var(--brand-primary);">₹${item.price.toLocaleString('en-IN')}/mo</div>
              <span style="font-size: 0.75rem; background: ${isScheduled ? '#e0f2fe' : '#fef3c7'}; color: ${isScheduled ? '#0369a1' : '#92400e'}; padding: 0.2rem 0.6rem; border-radius: var(--radius-full); font-weight: 700;">
                ${isScheduled ? '📅 Inspection Dispatched' : '⏳ Pending Inspection Setup'}
              </span>
            </div>
          </div>

          <!-- Claimed Amenities -->
          <div style="font-size: 0.8rem; color: var(--text-muted);">
            Claimed Facilities: ${(item.amenities || []).join(' • ')}
          </div>

          <!-- STAGE 1: SEND DATE RANGE TO OWNER -->
          ${!isScheduled ? `
            <div class="inspection-scheduler-box">
              <div style="font-size: 0.85rem; font-weight: 700; color: var(--brand-neutral);">
                📅 Step 1: Send Campus Inspection Date Range to Owner
              </div>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0;">
                Provide an approximate date range (not an exact day) when our verification agent will visit campus to physically inspect rooms and Wi-Fi.
              </p>

              <div class="date-range-row">
                <div>
                  <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Earliest Visit</label>
                  <input type="date" id="inspect-start-${item.propertyId}" class="form-control" value="${defaultDates.start}" style="padding: 0.4rem 0.6rem; font-size: 0.85rem;" />
                </div>
                <div>
                  <label style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Latest Visit</label>
                  <input type="date" id="inspect-end-${item.propertyId}" class="form-control" value="${defaultDates.end}" style="padding: 0.4rem 0.6rem; font-size: 0.85rem;" />
                </div>
              </div>

              <button class="btn btn-primary btn-sm" onclick="RentDirectUI.handleSendDateRange('${item.propertyId}')">
                📅 Send Inspection Date Range to Owner
              </button>
            </div>
          ` : `
            <!-- STAGE 2: PHYSICAL FACILITY CHECKLIST & APPROVAL -->
            <div class="inspection-scheduler-box" style="border-color: #7dd3fc; background: #f0f9ff;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="font-size: 0.85rem; font-weight: 700; color: #0369a1;">
                  🔍 Step 2: Physical Facility Checklist (Inspected On Site)
                </div>
                <span style="font-size: 0.75rem; color: #0284c7; font-weight: 600;">
                  Window: ${item.inspectionWindow?.startDate} to ${item.inspectionWindow?.endDate}
                </span>
              </div>
              
              <div class="facility-checklist">
                <label class="checklist-label">
                  <input type="checkbox" id="check-wifi-${item.propertyId}" checked>
                  ✓ High-speed Wi-Fi tested on site (fiber speeds confirmed)
                </label>
                <label class="checklist-label">
                  <input type="checkbox" id="check-mess-${item.propertyId}" checked>
                  ✓ 3 Times Meals / Kitchen hygiene verified
                </label>
                <label class="checklist-label">
                  <input type="checkbox" id="check-ac-${item.propertyId}" checked>
                  ✓ AC & 24x7 generator power backup operational
                </label>
                <label class="checklist-label">
                  <input type="checkbox" id="check-cctv-${item.propertyId}" checked>
                  ✓ CCTV security & campus walking distance accurate
                </label>
              </div>

              <div class="queue-item-actions">
                <button class="btn-approve" onclick="RentDirectUI.handleConfirmApproval('${item.propertyId}', true)">
                  ✓ Facilities Confirmed - Grant Verified Badge
                </button>
                <button class="btn-reject" onclick="RentDirectUI.handleConfirmApproval('${item.propertyId}', false)">
                  ✕ Reject - Facilities Did Not Match
                </button>
              </div>
            </div>
          `}
        </div>
      `;
    }).join('');

  } catch (e) {
    console.error('Error rendering admin queue', e);
  }
}

async function renderAdminReviewPanel() {
  const container = document.getElementById('admin-review-properties');
  if (!container) return;
  if (!RentDirectAPI.isBackendTeam()) return;

  container.innerHTML = '<p style="text-align:center; padding: 1.5rem;">Loading properties and automated flags...</p>';
  try {
    const properties = await RentDirectAPI.getProperties();
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);

    if (!properties.length) {
      container.innerHTML = '<p style="text-align:center; padding: 1.5rem; color: var(--text-secondary);">No properties found.</p>';
      return;
    }

    container.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
        <thead><tr style="border-bottom: 2px solid var(--border-color);">
          <th style="padding: 0.55rem;">Property / Owner</th>
          <th style="padding: 0.55rem;">Automated Flags</th>
          <th style="padding: 0.55rem;">Review Status</th>
          <th style="padding: 0.55rem;">Action</th>
        </tr></thead>
        <tbody>${properties.map(property => {
          const flags = [];
          if (property.price_flag) flags.push('<span style="color:#b91c1c;font-weight:700;">⚑ Price below ₹3,000</span>');
          if (property.duplicate_flag) {
            const matches = (property.duplicate_matches || []).map(match =>
              `${escapeHtml(match.title || match.id)} (${escapeHtml((match.reasons || []).join(', '))})`
            ).join('; ');
            flags.push(`<span style="color:#b45309;font-weight:700;">⚑ Possible duplicate${matches ? `: ${matches}` : ''}</span>`);
          }
          if (!flags.length) flags.push('<span style="color:#166534;">No automated flags</span>');
          const status = ['reviewed', 'pending', 'unverified'].includes(property.reviewStatus)
            ? property.reviewStatus
            : getPropertyReviewBadge(property).className;
          return `
            <tr style="border-bottom: 1px solid var(--border-light);">
              <td style="padding: 0.55rem; min-width: 180px;">
                <strong>${escapeHtml(property.title)}</strong><br>
                <span style="color:var(--text-muted);">${escapeHtml(property.owner?.name || 'Owner')} · ${escapeHtml(property.owner?.phone || 'No phone')}</span>
              </td>
              <td style="padding: 0.55rem; min-width: 200px;">${flags.join('<br>')}</td>
              <td style="padding: 0.55rem;">
                <select class="form-control" data-review-status="${escapeHtml(property.id)}" style="min-width: 125px; padding: 0.35rem;">
                  <option value="reviewed" ${status === 'reviewed' ? 'selected' : ''}>✓ Reviewed</option>
                  <option value="pending" ${status === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                  <option value="unverified" ${status === 'unverified' ? 'selected' : ''}>⚠ Unverified</option>
                </select>
              </td>
              <td style="padding: 0.55rem; white-space: nowrap;">
                <button class="btn btn-primary btn-sm" data-review-save data-property-id="${escapeHtml(property.id)}">Save</button>
              </td>
            </tr>`;
        }).join('')}</tbody>
      </table>
    `;
  } catch (error) {
    console.error('Unable to load automated property review flags', error);
    container.innerHTML = '<p style="text-align:center; padding: 1.5rem; color: var(--danger);">Unable to load properties for review.</p>';
  }
}

async function updatePropertyReviewStatus(propertyId, status) {
  if (!RentDirectAPI.isBackendTeam()) {
    showToast('Access denied: Backend Team only.', 'danger');
    return;
  }
  try {
    await RentDirectAPI.setPropertyReviewStatus(propertyId, status);
    showToast('Property review status updated.', 'success');
    await renderAdminReviewPanel();
  } catch (error) {
    console.error('Unable to update property review status', error);
    showToast('Unable to update property review status.', 'danger');
  }
}

// Handler: Backend Team dispatches date range to owner
async function handleSendDateRange(propertyId) {
  const start = document.getElementById(`inspect-start-${propertyId}`)?.value;
  const end = document.getElementById(`inspect-end-${propertyId}`)?.value;

  if (!start || !end) {
    showToast('Please specify both start and end dates for the inspection range.', 'danger');
    return;
  }

  try {
    await RentDirectAPI.scheduleInspection(propertyId, {
      startDate: start,
      endDate: end,
      notes: 'Physical campus and facility verification window'
    });

    showToast(`✓ Inspection Date Range (${start} to ${end}) dispatched to owner!`, 'success');
    renderAdminQueue();
    updateAdminNotificationCount();

    if (typeof loadProperties === 'function') {
      loadProperties();
    }
  } catch (e) {
    showToast('Failed to schedule inspection', 'danger');
  }
}

// Handler: Backend Team confirms physical checklist and issues Verified Badge
async function handleConfirmApproval(propertyId, approve) {
  try {
    const checklist = [];
    if (document.getElementById(`check-wifi-${propertyId}`)?.checked) checklist.push('Wi-Fi Speed Verified');
    if (document.getElementById(`check-mess-${propertyId}`)?.checked) checklist.push('3 Meals Kitchen Hygiene Verified');
    if (document.getElementById(`check-ac-${propertyId}`)?.checked) checklist.push('AC & Power Backup Verified');
    if (document.getElementById(`check-cctv-${propertyId}`)?.checked) checklist.push('CCTV & Security Confirmed');

    await RentDirectAPI.verifyProperty(propertyId, {
      approved: approve,
      checklist: checklist,
      notes: approve ? 'Inspected in person. All facilities confirmed accurate.' : 'Facilities did not match claims.'
    });

    showToast(approve ? '✓ Listing Verified! Green Verified Badge granted.' : 'Listing verification rejected.', approve ? 'success' : 'danger');

    renderAdminQueue();
    updateAdminNotificationCount();

    if (typeof loadProperties === 'function') {
      loadProperties();
    }
  } catch (e) {
    showToast('Verification update failed', 'danger');
  }
}

// -----------------------------------------------------------------------------
// 6. LIVE DATABASE & STUDENT RECORDS INSPECTOR (FOR HACKATHON JUDGES)
// -----------------------------------------------------------------------------
function ensureDbInspectorModal() {
  if (document.getElementById('db-inspector-modal')) return;

  const modalHtml = `
    <div class="admin-modal-overlay" id="db-inspector-modal">
      <div class="admin-modal-card" style="max-width: 820px;">
        <div class="admin-modal-header">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <h3 style="font-size: 1.2rem; font-weight: 800; color: var(--brand-neutral);">
                📊 Live Database Inspector
              </h3>
              <span class="user-role-tag admin">Server & Storage View</span>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">
              Direct view of student registrations, owner records, and JSON storage.
            </p>
          </div>
          <button onclick="RentDirectUI.toggleDbModal(false)" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted);">&times;</button>
        </div>

        <div class="admin-modal-body">
          <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
            <button class="btn btn-outline btn-sm" onclick="RentDirectUI.refreshDbInspector()">↻ Refresh</button>
            <button class="btn btn-outline btn-sm" onclick="RentDirectUI.resetInspectorData()">🗑️ Reset / Clear Test Data</button>
          </div>

          <!-- DB Tabs -->
          <div style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem;">
            <button class="btn btn-outline btn-sm active-db-tab" id="tab-btn-students" onclick="RentDirectUI.switchDbTab('students')">
              🎓 Students (<span id="db-count-students">0</span>)
            </button>
            <button class="btn btn-outline btn-sm" id="tab-btn-owners" onclick="RentDirectUI.switchDbTab('owners')">
              🏠 PG Owners (<span id="db-count-owners">0</span>)
            </button>
            <button class="btn btn-outline btn-sm" id="tab-btn-inquiries" onclick="RentDirectUI.switchDbTab('inquiries')">
              📩 Inquiries (<span id="db-count-inquiries">0</span>)
            </button>
            <button class="btn btn-outline btn-sm" id="tab-btn-raw" onclick="RentDirectUI.switchDbTab('raw')">
              💾 Raw JSON Store
            </button>
          </div>

          <!-- Tab Content Display Area -->
          <div id="db-tab-content" style="overflow-x: auto; min-height: 220px;">
            <!-- Rendered by JS -->
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

let activeDbTab = 'students';
async function openDbInspector() {
  ensureDbInspectorModal();
  toggleDbModal(true);
}

function toggleDbModal(open) {
  if (open) ensureDbInspectorModal();
  const modal = document.getElementById('db-inspector-modal');
  if (modal) modal.classList.toggle('open', open);
  if (open) switchDbTab(activeDbTab);
}

async function switchDbTab(tabName) {
  activeDbTab = tabName;
  ['students', 'owners', 'inquiries', 'raw'].forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    if (btn) {
      if (t === tabName) {
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-outline');
      } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline');
      }
    }
  });

  const content = document.getElementById('db-tab-content');
  if (!content) return;

  content.onclick = event => {
    const deleteButton = event.target.closest('[data-db-delete]');
    if (deleteButton) {
      deleteInspectorRecord(deleteButton.dataset.collection, deleteButton.dataset.recordId);
    }
  };

  content.innerHTML = '<p style="text-align:center; padding: 2rem;">Loading database records...</p>';
  try {
    const data = await RentDirectAPI.getInspectorData();
    const { students, owners, inquiries } = data;
    document.getElementById('db-count-students').textContent = students.length;
    document.getElementById('db-count-owners').textContent = owners.length;
    document.getElementById('db-count-inquiries').textContent = inquiries.length;

    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
    const formatDate = value => {
      const date = value ? new Date(value) : null;
      return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : '—';
    };
    const renderTable = (collection, records, columns, getValues) => {
      if (!records.length) {
        return `<p style="text-align:center; padding: 2rem; color: var(--text-secondary);">No ${collection} records found.</p>`;
      }
      return `
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
          <thead><tr style="background: var(--bg-surface-alt); border-bottom: 2px solid var(--border-color);">
            ${columns.map(column => `<th style="padding: 0.6rem;">${escapeHtml(column)}</th>`).join('')}
            <th style="padding: 0.6rem;">Action</th>
          </tr></thead>
          <tbody>${records.map(record => `
            <tr style="border-bottom: 1px solid var(--border-light);">
              ${getValues(record).map(value => `<td style="padding: 0.6rem;">${escapeHtml(value || '—')}</td>`).join('')}
              <td style="padding: 0.6rem; white-space: nowrap;">
                <button class="btn btn-outline btn-sm" data-db-delete
                  data-collection="${escapeHtml(collection)}"
                  data-record-id="${escapeHtml(record.id)}" aria-label="Delete ${escapeHtml(collection)} record">🗑️ Delete</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>`;
    };

    if (tabName === 'students') {
      content.innerHTML = renderTable('students', students,
        ['Student Name', 'Email', 'Phone', 'College', 'Course & Year', 'Budget', 'Registered'],
        student => [
          student.name,
          student.email,
          student.phone,
          student.collegeName || student.collegeId,
          `${student.course || 'B.Tech'} (${student.year || '1st Year'})`,
          student.budget && `₹${student.budget}`,
          formatDate(student.registeredAt)
        ]);
    } else if (tabName === 'owners') {
      content.innerHTML = renderTable('owners', owners,
        ['Owner Name', 'Phone', 'Email', 'Registered At'],
        owner => [owner.name, owner.phone, owner.email, formatDate(owner.registeredAt)]);
    } else if (tabName === 'inquiries') {
      content.innerHTML = renderTable('inquiries', inquiries,
        ['Name', 'Phone', 'College', 'Property', 'Visit Date', 'Submitted'],
        inquiry => [
          inquiry.name,
          inquiry.phone,
          inquiry.college,
          inquiry.propertyTitle,
          inquiry.date,
          formatDate(inquiry.submittedAt)
        ]);
    } else {
      const fullStore = { students, owners, inquiries };
      content.innerHTML = `
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">Backend API + localStorage records</span>
            <button class="btn btn-outline btn-sm" onclick="navigator.clipboard.writeText(document.getElementById('raw-json-box').innerText); RentDirectUI.showToast('Copied JSON to clipboard!', 'success');">📋 Copy JSON</button>
          </div>
          <pre id="raw-json-box" style="background: #0f172a; color: #38bdf8; padding: 1rem; border-radius: var(--radius-md); font-size: 0.75rem; max-height: 280px; overflow-y: auto; font-family: monospace;">${escapeHtml(JSON.stringify(fullStore, null, 2))}</pre>
        </div>
      `;
    }
  } catch (error) {
    console.error('Unable to refresh Live Database Inspector', error);
    content.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--danger);">Unable to load database records. Please refresh.</p>';
  }
}

async function deleteInspectorRecord(collection, recordId) {
  if (!window.confirm('Delete this record from the database and local storage?')) return;
  try {
    await RentDirectAPI.deleteInspectorRecord(collection, recordId);
    showToast('Record deleted.', 'success');
    await switchDbTab(activeDbTab);
  } catch (error) {
    console.error('Unable to delete database record', error);
    showToast('Record could not be deleted.', 'danger');
  }
}

async function resetInspectorData() {
  if (!window.confirm('Clear all student, PG owner, and inquiry test records from the backend and local storage? This cannot be undone.')) return;
  try {
    await RentDirectAPI.resetInspectorData();
    showToast('Student, owner, and inquiry test data cleared.', 'success');
    await switchDbTab(activeDbTab);
  } catch (error) {
    console.error('Unable to clear database test data', error);
    showToast('Test data could not be cleared.', 'danger');
  }
}

function refreshDbInspector() {
  return switchDbTab(activeDbTab);
}

// Toast Alert notification helper
function showToast(message, type = 'success') {
  let toast = document.getElementById('rd-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'rd-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 14px 22px;
      background: #1e293b;
      color: #fff;
      border-radius: 8px;
      box-shadow: 0 10px 15px -3px rgba(0,0,0,0.2);
      font-weight: 500;
      font-size: 0.95rem;
      z-index: 10000;
      transition: all 0.3s ease;
      opacity: 0;
      transform: translateY(20px);
    `;
    document.body.appendChild(toast);
  }

  if (type === 'success') {
    toast.style.backgroundColor = '#065f46';
  } else if (type === 'danger') {
    toast.style.backgroundColor = '#991b1b';
  } else {
    toast.style.backgroundColor = '#1e293b';
  }

  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
  }, 3500);
}

window.RentDirectUI = {
  createPropertyCardHTML,
  computePropertyFlags,
  getPropertyReviewBadge,
  getTrueCostBreakdown,
  isPropertyReviewed,
  showToast,
  toggleAdminModal,
  toggleLoginModal,
  switchAuthTab,
  fillDemoCredentials,
  handleLoginSubmit,
  handleLogout,
  toggleUserDropdown,
  openOwnerInquiries,
  toggleOwnerInquiries,
  renderOwnerInquiries,
  handleSendDateRange,
  handleConfirmApproval,
  openDbInspector,
  toggleDbModal,
  switchDbTab,
  refreshDbInspector,
  resetInspectorData
};
