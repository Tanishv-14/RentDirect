/**
 * RentDirect - Main UI Controller
 * Handles interactions, dynamic rendering, navigation, and Admin Verification Center.
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initCollegeDropdowns();
  initAdminNotificationCenter();
});

// Mobile menu toggle
function initMobileNav() {
  const toggleBtn = document.querySelector('.mobile-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (toggleBtn && navLinks) {
    toggleBtn.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });
  }
}

// Populate any college select dropdowns across pages from CONFIG
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

// Helper: Generate HTML markup for a Property Card
// Notice: If property.verified is false, it clearly shows "Pending Verification"
function createPropertyCardHTML(property) {
  const genderClass = property.gender === 'boys' ? 'boys' : (property.gender === 'girls' ? 'girls' : 'unisex');
  const genderLabel = property.gender.toUpperCase() + ' PG';

  const amenitiesBadges = (property.amenities || [])
    .slice(0, 4)
    .map(a => `<span class="amenity-chip">${a}</span>`)
    .join('');

  // Status Badge Logic
  let verificationBadgeMarkup = '';
  if (property.verified) {
    verificationBadgeMarkup = '<span class="badge-verified">✓ Verified</span>';
  } else if (property.verificationStatus === 'rejected') {
    verificationBadgeMarkup = '<span class="badge-verified" style="background: var(--status-danger); color: #fff;">✕ Rejected</span>';
  } else {
    // New owner listings enter with pending verification
    verificationBadgeMarkup = '<span class="badge-verified" style="background: #f59e0b; color: #fff;">⏳ Pending Verification</span>';
  }

  return `
    <article class="property-card" data-id="${property.id}">
      <div class="property-image-box">
        <img class="property-img" src="${property.images[0]}" alt="${property.title}" loading="lazy" />
        <span class="badge-gender ${genderClass}">${genderLabel}</span>
        ${verificationBadgeMarkup}
      </div>
      <div class="property-body">
        <div class="property-college-tag">${property.collegeName}</div>
        <h3 class="property-title">${property.title}</h3>
        <p class="property-address">
          <span>📍</span> ${property.distanceToCollege || property.address}
        </p>
        <div class="amenities-pills">
          ${amenitiesBadges}
        </div>
        <div class="property-footer">
          <div class="price-container">
            <span class="price-label">Starts from</span>
            <span class="price-value">₹${property.price.toLocaleString('en-IN')} <span>/month</span></span>
          </div>
          <a href="property-details.html?id=${property.id}" class="btn btn-outline btn-sm">View Details</a>
        </div>
      </div>
    </article>
  `;
}

// ==============================================================================
// ADMIN NOTIFICATION & VERIFICATION CENTER
// Allows backend/admin team to receive notifications of new owner listings,
// review campus proximity & owner identity, and approve or reject verification.
// ==============================================================================
function initAdminNotificationCenter() {
  const navActions = document.querySelector('.nav-actions');
  if (!navActions) return;

  // 1. Inject Admin Notification Bell Button into nav if not present
  if (!document.getElementById('admin-notif-btn')) {
    const notifBtn = document.createElement('button');
    notifBtn.id = 'admin-notif-btn';
    notifBtn.className = 'admin-notif-btn';
    notifBtn.title = 'Admin Property Verification Queue';
    notifBtn.innerHTML = `🔔<span class="notif-count-badge empty" id="admin-notif-count">0</span>`;
    notifBtn.addEventListener('click', () => toggleAdminModal(true));
    navActions.insertBefore(notifBtn, navActions.firstChild);
  }

  // 2. Inject Modal Overlay into DOM if not present
  if (!document.getElementById('admin-verify-modal')) {
    const modalMarkup = `
      <div class="admin-modal-overlay" id="admin-verify-modal">
        <div class="admin-modal-card">
          <div class="admin-modal-header">
            <div>
              <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--brand-neutral);">
                🔔 Admin Verification Center
              </h3>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.2rem;">
                Review new owner properties before issuing the "Verified" badge.
              </p>
            </div>
            <button onclick="RentDirectUI.toggleAdminModal(false)" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted);">&times;</button>
          </div>
          <div class="admin-modal-body" id="admin-queue-list">
            <!-- Dynamically populated -->
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalMarkup);
  }

  // Initial update
  updateAdminNotificationCount();

  // Listen for real-time notification events
  window.addEventListener('rentdirect:notification-updated', () => {
    updateAdminNotificationCount();
    renderAdminQueue();
  });
}

// Update the badge counter on the notification bell
async function updateAdminNotificationCount() {
  const countEl = document.getElementById('admin-notif-count');
  if (!countEl || !window.RentDirectAPI) return;

  try {
    const notifications = await RentDirectAPI.getAdminNotifications();
    const pendingCount = notifications.filter(n => n.status === 'pending').length;

    countEl.textContent = pendingCount;
    if (pendingCount > 0) {
      countEl.classList.remove('empty');
    } else {
      countEl.classList.add('empty');
    }
  } catch (e) {
    console.warn('Could not update notification count', e);
  }
}

// Toggle Admin Verification Modal Open/Close
function toggleAdminModal(open) {
  const modal = document.getElementById('admin-verify-modal');
  if (!modal) return;

  if (open) {
    modal.classList.add('open');
    renderAdminQueue();
  } else {
    modal.classList.remove('open');
  }
}

// Render the list of pending owner submissions inside the review modal
async function renderAdminQueue() {
  const container = document.getElementById('admin-queue-list');
  if (!container || !window.RentDirectAPI) return;

  try {
    const notifications = await RentDirectAPI.getAdminNotifications();
    const pendingList = notifications.filter(n => n.status === 'pending');

    if (pendingList.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">✅</div>
          <h4 style="font-size: 1.1rem; font-weight: 700; color: var(--brand-neutral);">All Listings Verified</h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.35rem;">
            There are no pending owner properties awaiting review at this time.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = pendingList.map(item => `
      <div class="admin-queue-item" data-id="${item.propertyId}">
        <div class="queue-item-header">
          <div>
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--brand-secondary); text-transform: uppercase;">
              ${item.collegeName}
            </div>
            <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--brand-neutral); margin: 0.15rem 0;">
              ${item.propertyTitle}
            </h4>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">
              Owner: <strong>${item.ownerName}</strong> (${item.ownerPhone})
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1rem; font-weight: 800; color: var(--brand-primary);">₹${item.price.toLocaleString('en-IN')}/mo</div>
            <span style="font-size: 0.75rem; background: #fef3c7; color: #92400e; padding: 0.15rem 0.5rem; border-radius: var(--radius-full); font-weight: 600;">
              ⏳ Awaiting Verification
            </span>
          </div>
        </div>
        
        <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">
          Distance: ${item.distance || 'Near Campus'} • Submitted: ${new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>

        <div class="queue-item-actions">
          <button class="btn-approve" onclick="RentDirectUI.handleAdminVerify('${item.propertyId}', true)">
            ✓ Approve & Verify
          </button>
          <button class="btn-reject" onclick="RentDirectUI.handleAdminVerify('${item.propertyId}', false)">
            ✕ Reject
          </button>
        </div>
      </div>
    `).join('');

  } catch (e) {
    console.error('Error rendering admin queue', e);
  }
}

// Action handler when admin approves or rejects
async function handleAdminVerify(propertyId, approve) {
  try {
    const res = await RentDirectAPI.verifyProperty(propertyId, approve);
    showToast(approve ? '✓ Property Verified & Published with Verified Badge!' : 'Listing rejected.', approve ? 'success' : 'danger');

    // Re-render modal queue
    renderAdminQueue();
    updateAdminNotificationCount();

    // If currently on listings page or homepage, refresh property cards in view
    if (typeof loadProperties === 'function') {
      loadProperties();
    }
  } catch (e) {
    console.error('Error during property verification', e);
    showToast('Failed to update verification status', 'danger');
  }
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
  showToast,
  toggleAdminModal,
  handleAdminVerify
};
