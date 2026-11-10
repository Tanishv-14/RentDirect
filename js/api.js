/**
 * ==============================================================================
 * RentDirect - Centralized API Service (api.js)
 * ==============================================================================
 * ALL network communication, Flask backend endpoints, authentication,
 * and mock fallbacks are consolidated exclusively in this file. 
 * NO backend URLs or HTTP fetch calls exist anywhere in the HTML files.
 * ==============================================================================
 */

// Centralized Backend Endpoint Routes (Relative to CONFIG.API_BASE_URL)
const API_ROUTES = {
  // Public Properties
  PROPERTIES: '/properties',
  PROPERTY_BY_ID: (id) => `/properties/${id}`,

  // Auth & Roles
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  SEND_OTP: '/auth/send-otp',
  VERIFY_OTP: '/auth/verify-otp',

  // Registrations
  STUDENT_REGISTER: '/students/register',
  OWNER_REGISTER: '/owners/register',
  CREATE_PROPERTY: '/properties',
  SUBMIT_INQUIRY: '/inquiries',

  // Backend / Verification Team Only
  ADMIN_NOTIFICATIONS: '/admin/notifications',
  ADMIN_SCHEDULE_INSPECTION: (id) => `/admin/properties/${id}/schedule-inspection`,
  ADMIN_VERIFY_PROPERTY: (id) => `/admin/properties/${id}/verify`,
  ADMIN_REVIEW_STATUS: (id) => `/admin/properties/${id}/review-status`
};

const INSPECTOR_COLLECTIONS = ['students', 'owners', 'inquiries'];

function readInspectorRecords(collection) {
  try {
    const stored = JSON.parse(localStorage.getItem(`rentdirect_${collection}`) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch (error) {
    console.warn(`Unable to read local ${collection} records.`, error);
    return [];
  }
}

function writeInspectorRecords(collection, records) {
  localStorage.setItem(`rentdirect_${collection}`, JSON.stringify(records));
}

function notifyInspectorDataChanged() {
  window.dispatchEvent(new Event('rentdirect:database-changed'));
}

function isNetworkUnavailable(error) {
  return error instanceof TypeError;
}

function mergeInspectorRecords(serverRecords, localRecords) {
  const records = new Map();
  [...localRecords, ...serverRecords].forEach((record, index) => {
    const key = record.id || [
      record.email,
      record.name,
      record.phone,
      record.propertyTitle,
      record.date,
      index
    ].filter(Boolean).join('|');
    records.set(String(key), record);
  });
  return Array.from(records.values());
}

const RentDirectAPI = {
  // Base URL getter from config
  getBaseUrl() {
    return (window.RENTDIRECT_CONFIG && window.RENTDIRECT_CONFIG.API_BASE_URL) 
      ? window.RENTDIRECT_CONFIG.API_BASE_URL 
      : 'http://127.0.0.1:5000/api';
  },

  // Whether mock mode is active
  isMockMode() {
    return !window.RENTDIRECT_CONFIG || window.RENTDIRECT_CONFIG.USE_MOCK_DATA === true;
  },

  // Central HTTP request helper with unified headers & error handling
  async request(endpoint, options = {}) {
    const url = `${this.getBaseUrl()}${endpoint}`;
    const defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    };

    const response = await fetch(url, config);
    if (!response.ok) {
      throw new Error(`API Error [${response.status}]: ${response.statusText}`);
    }
    return await response.json();
  },

  // ----------------------------------------------------------------------------
  // 1. AUTHENTICATION & SESSION MANAGEMENT
  // ----------------------------------------------------------------------------

  getCurrentUser() {
    try {
      const stored = localStorage.getItem('rentdirect_current_user');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  },

  isBackendTeam() {
    const user = this.getCurrentUser();
    return !!(user && (user.role === 'backend_team' || user.role === 'admin'));
  },

  isOwner() {
    const user = this.getCurrentUser();
    return !!(user && user.role === 'owner');
  },

  isStudent() {
    const user = this.getCurrentUser();
    return !!(user && user.role === 'student');
  },

  // Login with email, password, and chosen role
  async login(email, password, preferredRole) {
    if (!this.isMockMode()) {
      try {
        const res = await this.request(API_ROUTES.LOGIN, {
          method: 'POST',
          body: JSON.stringify({ email, password, role: preferredRole })
        });
        if (res.user) {
          localStorage.setItem('rentdirect_current_user', JSON.stringify(res.user));
          window.dispatchEvent(new CustomEvent('rentdirect:auth-changed', { detail: res.user }));
        }
        return res;
      } catch (err) {
        console.warn('Flask login failed, trying demo offline login...', err);
      }
    }

    // Mock Login fallback for demo purposes
    let user;
    const cleanEmail = (email || '').toLowerCase().trim();

    if (cleanEmail === 'admin@rentdirect.com' || preferredRole === 'backend_team') {
      user = {
        id: 'usr-admin-01',
        email: 'admin@rentdirect.com',
        name: 'RentDirect Verification Team',
        role: 'backend_team',
        phone: '+91 98000 00001'
      };
    } else if (cleanEmail === 'ramesh@rentdirect.com' || preferredRole === 'owner') {
      user = {
        id: 'usr-owner-01',
        email: cleanEmail || 'ramesh@rentdirect.com',
        name: cleanEmail === 'ramesh@rentdirect.com' ? 'Ramesh Chawla' : cleanEmail.split('@')[0],
        role: 'owner',
        phone: '+91 98101 23456'
      };
    } else {
      user = {
        id: 'usr-student-01',
        email: cleanEmail || 'ananya@rentdirect.com',
        name: cleanEmail === 'ananya@rentdirect.com' ? 'Ananya Sharma' : cleanEmail.split('@')[0],
        role: 'student',
        phone: '+91 98112 23344'
      };
    }

    localStorage.setItem('rentdirect_current_user', JSON.stringify(user));
    window.dispatchEvent(new CustomEvent('rentdirect:auth-changed', { detail: user }));

    return {
      success: true,
      message: `Signed in as ${user.name}`,
      user: user
    };
  },

  // Logout current user
  async logout() {
    if (!this.isMockMode()) {
      try {
        await this.request(API_ROUTES.LOGOUT, { method: 'POST' });
      } catch (err) {
        console.warn('Flask logout request ignored in offline mode.');
      }
    }

    localStorage.removeItem('rentdirect_current_user');
    window.dispatchEvent(new CustomEvent('rentdirect:auth-changed', { detail: null }));
    return { success: true };
  },

  // ----------------------------------------------------------------------------
  // 2. PROPERTY LISTINGS
  // ----------------------------------------------------------------------------

  // Fetch all properties (with optional filter object)
  async getProperties(filters = {}) {
    if (!this.isMockMode()) {
      try {
        const query = new URLSearchParams(filters).toString();
        const endpoint = query ? `${API_ROUTES.PROPERTIES}?${query}` : API_ROUTES.PROPERTIES;
        const properties = await this.request(endpoint, { method: 'GET' });
        return window.RentDirectUI?.computePropertyFlags(properties) || properties;
      } catch (err) {
        console.warn('Flask backend unreachable. Falling back to local mock data.', err);
      }
    }

    // Mock Mode / Offline Fallback
    let list = window.RENTDIRECT_MOCK ? [...window.RENTDIRECT_MOCK.properties] : [];
    try {
      const reviewStatuses = JSON.parse(localStorage.getItem('rentdirect_property_review_statuses') || '{}');
      list = list.map(property => ({
        ...property,
        ...(reviewStatuses[property.id] ? { reviewStatus: reviewStatuses[property.id] } : {})
      }));
    } catch (error) {
      console.warn('Unable to read local property review statuses.', error);
    }
    list = window.RentDirectUI?.computePropertyFlags(list) || list;

    if (filters.college && filters.college !== 'all') {
      list = list.filter(p => p.collegeId === filters.college);
    }
    if (filters.gender && filters.gender !== 'all') {
      list = list.filter(p => p.gender === filters.gender || p.gender === 'unisex');
    }
    if (filters.maxPrice) {
      list = list.filter(p => p.price <= parseInt(filters.maxPrice, 10));
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      list = list.filter(p => 
        p.title.toLowerCase().includes(q) || 
        p.collegeName.toLowerCase().includes(q) || 
        p.address.toLowerCase().includes(q)
      );
    }
    if (filters.status) {
      list = list.filter(p => p.verificationStatus === filters.status);
    }

    return list;
  },

  // Fetch a single property by its unique ID
  async getPropertyById(id) {
    if (!this.isMockMode()) {
      try {
        return await this.request(API_ROUTES.PROPERTY_BY_ID(id), { method: 'GET' });
      } catch (err) {
        console.warn('Flask backend unreachable. Falling back to local data.', err);
      }
    }

    const item = (await this.getProperties()).find(p => p.id === id);
    if (!item) throw new Error(`Property with id "${id}" not found.`);
    return item;
  },

  // ----------------------------------------------------------------------------
  // 3. AUTHENTICATION & OTP VERIFICATION
  // ----------------------------------------------------------------------------

  async sendOtp(email, role = 'student') {
    if (!this.isMockMode()) {
      try {
        return await this.request(API_ROUTES.SEND_OTP, {
          method: 'POST',
          body: JSON.stringify({ email, role })
        });
      } catch (err) {
        console.warn('Flask OTP service unreachable. Using local demo OTP.', err);
      }
    }

    return {
      success: true,
      message: 'OTP sent successfully',
      demoOtp: '123456',
      email: email
    };
  },

  async verifyOtp(email, otp) {
    if (!this.isMockMode()) {
      try {
        return await this.request(API_ROUTES.VERIFY_OTP, {
          method: 'POST',
          body: JSON.stringify({ email, otp })
        });
      } catch (err) {
        console.warn('Flask OTP verify unreachable. Checking against demo OTP.', err);
      }
    }

    if (otp === '123456') {
      return { success: true, verified: true, message: 'OTP verified successfully' };
    } else {
      return { success: false, verified: false, message: 'Invalid OTP code. Please enter 123456.' };
    }
  },

  // ----------------------------------------------------------------------------
  // 4. STUDENT REGISTRATION
  // ----------------------------------------------------------------------------

  async registerStudent(studentData) {
    try {
      const response = await this.request(API_ROUTES.STUDENT_REGISTER, {
        method: 'POST',
        body: JSON.stringify(studentData)
      });
      if (response.student) {
        const students = readInspectorRecords('students');
        students.push(response.student);
        writeInspectorRecords('students', students);
        notifyInspectorDataChanged();
      }
      return response;
    } catch (err) {
      if (!isNetworkUnavailable(err)) throw err;
      console.warn('Flask student registration unreachable. Saving locally.', err);
    }

    const students = readInspectorRecords('students');
    const record = {
      ...studentData,
      id: 'std-' + Date.now(),
      registeredAt: new Date().toISOString()
    };
    students.push(record);
    writeInspectorRecords('students', students);
    notifyInspectorDataChanged();

    return {
      success: true,
      message: 'Student registered successfully',
      student: record
    };
  },

  // Get all registered students for database inspection
  async getStudents() {
    return (await this.getInspectorData()).students;
  },

  async getInspectorData() {
    const data = Object.fromEntries(INSPECTOR_COLLECTIONS.map(collection => [
      collection,
      readInspectorRecords(collection)
    ]));

    try {
      const serverData = await this.request('/admin/database/inspector', { method: 'GET', cache: 'no-store' });
      INSPECTOR_COLLECTIONS.forEach(collection => {
        data[collection] = mergeInspectorRecords(
          Array.isArray(serverData[collection]) ? serverData[collection] : [],
          data[collection]
        );
        writeInspectorRecords(collection, data[collection]);
      });
    } catch (err) {
      if (!isNetworkUnavailable(err)) throw err;
      console.warn('Flask database unavailable. Using local inspector data.', err);
    }

    return data;
  },

  async deleteInspectorRecord(collection, recordId) {
    if (!INSPECTOR_COLLECTIONS.includes(collection)) {
      throw new Error(`Unsupported inspector collection: ${collection}`);
    }

    try {
      await this.request(`/admin/database/${collection}/${encodeURIComponent(recordId)}`, {
        method: 'DELETE'
      });
    } catch (err) {
      if (!isNetworkUnavailable(err) && !/API Error \[404\]/.test(err.message)) throw err;
      console.warn(`Unable to delete ${collection} record from Flask. Removing local copy.`, err);
    }

    const records = readInspectorRecords(collection)
      .filter(record => String(record.id) !== String(recordId));
    writeInspectorRecords(collection, records);
    notifyInspectorDataChanged();
    return this.getInspectorData();
  },

  async resetInspectorData() {
    try {
      await this.request('/admin/database/test-data', { method: 'DELETE' });
    } catch (err) {
      if (!isNetworkUnavailable(err)) throw err;
      console.warn('Unable to clear Flask inspector data. Clearing local copies.', err);
    }

    INSPECTOR_COLLECTIONS.forEach(collection => writeInspectorRecords(collection, []));
    notifyInspectorDataChanged();
    return this.getInspectorData();
  },

  // ----------------------------------------------------------------------------
  // 5. OWNER REGISTRATION & PROPERTY SUBMISSION
  // ----------------------------------------------------------------------------

  async registerOwner(ownerData) {
    try {
      const response = await this.request(API_ROUTES.OWNER_REGISTER, {
        method: 'POST',
        body: JSON.stringify(ownerData)
      });
      if (response.owner) {
        const owners = readInspectorRecords('owners');
        const existingIndex = owners.findIndex(owner =>
          owner.email?.toLowerCase() === response.owner.email?.toLowerCase()
        );
        if (existingIndex >= 0) owners[existingIndex] = response.owner;
        else owners.push(response.owner);
        writeInspectorRecords('owners', owners);
        notifyInspectorDataChanged();
      }
      return response;
    } catch (err) {
      if (!isNetworkUnavailable(err)) throw err;
      console.warn('Flask owner registration unreachable. Saving locally.', err);
    }

    const owners = readInspectorRecords('owners');
    const existingIndex = owners.findIndex(owner =>
      owner.email?.toLowerCase() === ownerData.email?.toLowerCase()
    );
    const record = existingIndex >= 0
      ? { ...owners[existingIndex], ...ownerData }
      : {
          ...ownerData,
          id: 'own-' + Date.now(),
          registeredAt: new Date().toISOString()
        };
    if (existingIndex >= 0) owners[existingIndex] = record;
    else owners.push(record);
    writeInspectorRecords('owners', owners);
    notifyInspectorDataChanged();

    return {
      success: true,
      message: 'Owner registered successfully',
      owner: record
    };
  },

  // Owner submits new property:
  // Starts with verified: false and verificationStatus: 'pending'.
  // Owner CANNOT self-approve.
  async createProperty(propertyData) {
    if (!this.isMockMode()) {
      try {
        return await this.request(API_ROUTES.CREATE_PROPERTY, {
          method: 'POST',
          body: JSON.stringify(propertyData)
        });
      } catch (err) {
        console.warn('Flask property creation unreachable. Saving locally.', err);
      }
    }

    const newProperty = {
      ...propertyData,
      id: 'rd-' + Date.now(),
      rating: 5.0,
      reviewsCount: 1,
      verified: false,
      verificationStatus: 'pending',
      inspectionWindow: null,
      facilityChecklist: [],
      submittedAt: new Date().toISOString(),
      price: parseInt(propertyData.price, 10) || 7500,
      priceMax: (parseInt(propertyData.price, 10) || 7500) + 4000,
      images: (propertyData.images && propertyData.images.length > 0)
        ? propertyData.images
        : ['https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80']
    };

    const existingProperties = window.RENTDIRECT_MOCK ? window.RENTDIRECT_MOCK.properties : [];
    Object.assign(newProperty, (window.RentDirectUI?.computePropertyFlags([newProperty, ...existingProperties]) || [newProperty])[0]);

    if (window.RENTDIRECT_MOCK && window.RENTDIRECT_MOCK.saveCustomProperty) {
      window.RENTDIRECT_MOCK.saveCustomProperty(newProperty);
    }

    // Add to backend verification queue
    const notifications = JSON.parse(localStorage.getItem('rentdirect_admin_notifications') || '[]');
    const notif = {
      id: 'notif-' + Date.now(),
      propertyId: newProperty.id,
      propertyTitle: newProperty.title,
      collegeName: newProperty.collegeName,
      ownerName: newProperty.owner?.name || 'PG Owner',
      ownerPhone: newProperty.owner?.phone || '',
      price: newProperty.price,
      price_flag: newProperty.price_flag,
      duplicate_flag: newProperty.duplicate_flag,
      duplicate_matches: newProperty.duplicate_matches,
      distance: newProperty.distanceToCollege || '',
      amenities: newProperty.amenities || [],
      status: 'pending',
      inspectionWindow: null,
      createdAt: new Date().toISOString()
    };
    notifications.unshift(notif);
    localStorage.setItem('rentdirect_admin_notifications', JSON.stringify(notifications));

    window.dispatchEvent(new CustomEvent('rentdirect:notification-updated', { detail: notif }));

    return {
      success: true,
      message: 'Property submitted for backend verification review.',
      property: newProperty,
      verificationStatus: 'pending'
    };
  },

  // ----------------------------------------------------------------------------
  // 6. BACKEND / VERIFICATION TEAM ONLY (RBAC PROTECTED)
  // ----------------------------------------------------------------------------

  // Fetch pending verification queue
  async getAdminNotifications() {
    if (!this.isMockMode()) {
      try {
        return await this.request(API_ROUTES.ADMIN_NOTIFICATIONS, { method: 'GET' });
      } catch (err) {
        console.warn('Flask notifications unreachable. Using local notifications.', err);
      }
    }

    return JSON.parse(localStorage.getItem('rentdirect_admin_notifications') || '[]');
  },

  // Step 1 of Verification: Backend Team sends a DATE RANGE to the owner for physical campus check
  async scheduleInspection(propertyId, inspectionData) {
    if (!this.isMockMode()) {
      try {
        return await this.request(API_ROUTES.ADMIN_SCHEDULE_INSPECTION(propertyId), {
          method: 'POST',
          body: JSON.stringify(inspectionData)
        });
      } catch (err) {
        console.warn('Flask schedule endpoint unreachable. Updating locally.', err);
      }
    }

    const windowData = {
      startDate: inspectionData.startDate,
      endDate: inspectionData.endDate,
      notes: inspectionData.notes || 'Campus and facilities physical inspection window',
      scheduledAt: new Date().toISOString()
    };

    // Update property in mock storage
    if (window.RENTDIRECT_MOCK && window.RENTDIRECT_MOCK.updatePropertyStatus) {
      window.RENTDIRECT_MOCK.updatePropertyStatus(propertyId, false, 'inspection_scheduled');
    }

    // Update notification
    const notifications = JSON.parse(localStorage.getItem('rentdirect_admin_notifications') || '[]');
    const notif = notifications.find(n => n.propertyId === propertyId);
    if (notif) {
      notif.status = 'inspection_scheduled';
      notif.inspectionWindow = windowData;
      localStorage.setItem('rentdirect_admin_notifications', JSON.stringify(notifications));
    }

    window.dispatchEvent(new CustomEvent('rentdirect:notification-updated', { 
      detail: { propertyId, status: 'inspection_scheduled', inspectionWindow: windowData } 
    }));

    return {
      success: true,
      message: `Inspection date range (${inspectionData.startDate} to ${inspectionData.endDate}) dispatched to owner.`,
      propertyId,
      inspectionWindow: windowData
    };
  },

  // Step 2 of Verification: Backend Team verifies facilities in person and grants verified badge
  async verifyProperty(propertyId, options = {}) {
    const approve = options.approved !== false;
    const checklist = options.checklist || [];
    const notes = options.notes || '';

    if (!this.isMockMode()) {
      try {
        return await this.request(API_ROUTES.ADMIN_VERIFY_PROPERTY(propertyId), {
          method: 'POST',
          body: JSON.stringify({ approved: approve, checklist, notes })
        });
      } catch (err) {
        console.warn('Flask verify endpoint unreachable. Updating locally.', err);
      }
    }

    const newStatus = approve ? 'verified' : 'rejected';
    const isVerified = approve;

    if (window.RENTDIRECT_MOCK && window.RENTDIRECT_MOCK.updatePropertyStatus) {
      window.RENTDIRECT_MOCK.updatePropertyStatus(propertyId, isVerified, newStatus);
    }

    const notifications = JSON.parse(localStorage.getItem('rentdirect_admin_notifications') || '[]');
    const notifIndex = notifications.findIndex(n => n.propertyId === propertyId);
    if (notifIndex !== -1) {
      notifications[notifIndex].status = newStatus;
      notifications[notifIndex].facilityChecklist = checklist;
      notifications[notifIndex].verificationNotes = notes;
      localStorage.setItem('rentdirect_admin_notifications', JSON.stringify(notifications));
    }

    window.dispatchEvent(new CustomEvent('rentdirect:notification-updated', { 
      detail: { propertyId, status: newStatus, verified: isVerified } 
    }));

    return {
      success: true,
      propertyId: propertyId,
      verified: isVerified,
      status: newStatus,
      message: approve ? '✓ Facilities verified & Verified Badge granted!' : 'Listing verification rejected.'
    };
  },

  async setPropertyReviewStatus(propertyId, reviewStatus) {
    if (!this.isBackendTeam()) {
      throw new Error('Only the Backend Team can update property review status.');
    }
    if (!['reviewed', 'pending', 'unverified'].includes(reviewStatus)) {
      throw new Error(`Unsupported property review status: ${reviewStatus}`);
    }

    const currentUser = this.getCurrentUser();
    let property;
    if (!this.isMockMode()) {
      try {
        const response = await this.request(API_ROUTES.ADMIN_REVIEW_STATUS(propertyId), {
          method: 'POST',
          body: JSON.stringify({ adminEmail: currentUser.email, reviewStatus })
        });
        property = response.property;
      } catch (error) {
        if (!isNetworkUnavailable(error)) throw error;
        console.warn('Flask review-status endpoint unreachable. Saving status locally.', error);
      }
    }

    const reviewStatuses = JSON.parse(localStorage.getItem('rentdirect_property_review_statuses') || '{}');
    reviewStatuses[propertyId] = reviewStatus;
    localStorage.setItem('rentdirect_property_review_statuses', JSON.stringify(reviewStatuses));

    if (window.RENTDIRECT_MOCK?.properties) {
      const mockProperty = window.RENTDIRECT_MOCK.properties.find(item => item.id === propertyId);
      if (mockProperty) mockProperty.reviewStatus = reviewStatus;
      const customProperties = JSON.parse(localStorage.getItem('rentdirect_custom_properties') || '[]');
      const customProperty = customProperties.find(item => item.id === propertyId);
      if (customProperty) {
        customProperty.reviewStatus = reviewStatus;
        localStorage.setItem('rentdirect_custom_properties', JSON.stringify(customProperties));
      }
    }

    window.dispatchEvent(new CustomEvent('rentdirect:property-review-updated', {
      detail: { propertyId, reviewStatus }
    }));
    return property || { id: propertyId, reviewStatus };
  },

  // ----------------------------------------------------------------------------
  // 7. ROOM VISIT REQUEST / INQUIRY
  // ----------------------------------------------------------------------------

  async submitVisitInquiry(inquiryData) {
    try {
      const response = await this.request(API_ROUTES.SUBMIT_INQUIRY, {
        method: 'POST',
        body: JSON.stringify(inquiryData)
      });
      if (response.inquiry) {
        const inquiries = readInspectorRecords('inquiries');
        const existingIndex = inquiries.findIndex(inquiry => inquiry.id === response.inquiry.id);
        if (existingIndex >= 0) inquiries[existingIndex] = response.inquiry;
        else inquiries.push(response.inquiry);
        writeInspectorRecords('inquiries', inquiries);
        notifyInspectorDataChanged();
      }
      return response;
    } catch (err) {
      if (!isNetworkUnavailable(err)) throw err;
      console.warn('Flask inquiry endpoint unreachable. Saving locally.', err);
    }

    const inquiries = readInspectorRecords('inquiries');
    const record = {
      ...inquiryData,
      id: 'inq-' + Date.now(),
      status: 'pending',
      submittedAt: new Date().toISOString()
    };
    inquiries.push(record);
    writeInspectorRecords('inquiries', inquiries);
    notifyInspectorDataChanged();

    return {
      success: true,
      message: 'Visit request submitted successfully',
      inquiry: record
    };
  },

  async getOwnerInquiries(ownerEmail) {
    try {
      const response = await this.request(
        `/owner/inquiries?email=${encodeURIComponent(ownerEmail)}`,
        { method: 'GET', cache: 'no-store' }
      );
      return Array.isArray(response.inquiries) ? response.inquiries : [];
    } catch (err) {
      if (!isNetworkUnavailable(err)) throw err;
      console.warn('Flask owner inquiry endpoint unreachable. Using local inquiry records.', err);
    }

    const data = await this.getInspectorData();
    return data.inquiries.filter(inquiry =>
      inquiry.ownerEmail?.toLowerCase() === ownerEmail.toLowerCase()
    );
  },

  async updateInquiryStatus(inquiryId, status, ownerEmail) {
    let updatedInquiry;
    try {
      const response = await this.request(`/owner/inquiries/${encodeURIComponent(inquiryId)}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, ownerEmail })
      });
      updatedInquiry = response.inquiry;
    } catch (err) {
      if (!isNetworkUnavailable(err)) throw err;
      console.warn('Flask inquiry status endpoint unreachable. Updating locally.', err);
    }

    const inquiries = readInspectorRecords('inquiries');
    const index = inquiries.findIndex(inquiry => String(inquiry.id) === String(inquiryId));
    if (index < 0 && !updatedInquiry) {
      throw new Error('Inquiry record not found in local storage.');
    }
    if (index >= 0) {
      inquiries[index] = {
        ...inquiries[index],
        ...(updatedInquiry || {}),
        status,
        updatedAt: updatedInquiry?.updatedAt || new Date().toISOString()
      };
    } else {
      inquiries.push(updatedInquiry);
    }
    writeInspectorRecords('inquiries', inquiries);
    notifyInspectorDataChanged();
    return updatedInquiry || inquiries[index];
  }
};

// Export to window object for access across HTML pages
window.RentDirectAPI = RentDirectAPI;
