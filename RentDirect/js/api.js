/**
 * ==============================================================================
 * RentDirect - Centralized API Service (api.js)
 * ==============================================================================
 * ALL network communication, Flask backend endpoints, and mock fallbacks
 * are consolidated exclusively in this file. 
 * NO backend URLs or HTTP fetch calls exist anywhere in the HTML files.
 * ==============================================================================
 */

// Centralized Backend Endpoint Routes (Relative to CONFIG.API_BASE_URL)
const API_ROUTES = {
  PROPERTIES: '/properties',
  PROPERTY_BY_ID: (id) => `/properties/${id}`,
  STUDENT_REGISTER: '/students/register',
  OWNER_REGISTER: '/owners/register',
  CREATE_PROPERTY: '/properties',
  SEND_OTP: '/auth/send-otp',
  VERIFY_OTP: '/auth/verify-otp',
  SUBMIT_INQUIRY: '/inquiries',
  ADMIN_NOTIFICATIONS: '/admin/notifications',
  ADMIN_VERIFY_PROPERTY: (id) => `/admin/properties/${id}/verify`
};

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
  // 1. PROPERTY LISTINGS
  // ----------------------------------------------------------------------------

  // Fetch all properties (with optional filter object)
  async getProperties(filters = {}) {
    if (!this.isMockMode()) {
      try {
        const query = new URLSearchParams(filters).toString();
        const endpoint = query ? `${API_ROUTES.PROPERTIES}?${query}` : API_ROUTES.PROPERTIES;
        return await this.request(endpoint, { method: 'GET' });
      } catch (err) {
        console.warn('Flask backend unreachable. Falling back to local mock data.', err);
      }
    }

    // Mock Mode / Offline Fallback
    let list = window.RENTDIRECT_MOCK ? window.RENTDIRECT_MOCK.properties : [];

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

    const item = (window.RENTDIRECT_MOCK ? window.RENTDIRECT_MOCK.properties : []).find(p => p.id === id);
    if (!item) throw new Error(`Property with id "${id}" not found.`);
    return item;
  },

  // ----------------------------------------------------------------------------
  // 2. AUTHENTICATION & OTP VERIFICATION
  // ----------------------------------------------------------------------------

  // Request a 6-digit OTP to be sent to the given email
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

    // Mock demo fallback: always succeeds for user demonstration
    return {
      success: true,
      message: 'OTP sent successfully',
      demoOtp: '123456',
      email: email
    };
  },

  // Verify the OTP entered by user (Always expects "123456" in demo mode)
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

    // Mock verification rule: demo OTP is always 123456
    if (otp === '123456') {
      return { success: true, verified: true, message: 'OTP verified successfully' };
    } else {
      return { success: false, verified: false, message: 'Invalid OTP code. Please enter 123456.' };
    }
  },

  // ----------------------------------------------------------------------------
  // 3. STUDENT REGISTRATION
  // ----------------------------------------------------------------------------

  // Register a new student profile
  async registerStudent(studentData) {
    if (!this.isMockMode()) {
      try {
        return await this.request(API_ROUTES.STUDENT_REGISTER, {
          method: 'POST',
          body: JSON.stringify(studentData)
        });
      } catch (err) {
        console.warn('Flask student registration unreachable. Saving locally.', err);
      }
    }

    // Save in local storage for demo persistence
    const students = JSON.parse(localStorage.getItem('rentdirect_students') || '[]');
    const record = {
      ...studentData,
      id: 'std-' + Date.now(),
      registeredAt: new Date().toISOString()
    };
    students.push(record);
    localStorage.setItem('rentdirect_students', JSON.stringify(students));

    return {
      success: true,
      message: 'Student registered successfully',
      student: record
    };
  },

  // ----------------------------------------------------------------------------
  // 4. OWNER REGISTRATION & PROPERTY CREATION
  // ----------------------------------------------------------------------------

  // Register a PG Owner
  async registerOwner(ownerData) {
    if (!this.isMockMode()) {
      try {
        return await this.request(API_ROUTES.OWNER_REGISTER, {
          method: 'POST',
          body: JSON.stringify(ownerData)
        });
      } catch (err) {
        console.warn('Flask owner registration unreachable. Saving locally.', err);
      }
    }

    const owners = JSON.parse(localStorage.getItem('rentdirect_owners') || '[]');
    const record = {
      ...ownerData,
      id: 'own-' + Date.now(),
      registeredAt: new Date().toISOString()
    };
    owners.push(record);
    localStorage.setItem('rentdirect_owners', JSON.stringify(owners));

    return {
      success: true,
      message: 'Owner registered successfully',
      owner: record
    };
  },

  // Publish a new property listing (by Owner)
  // When an owner registers a property, it does NOT get verified automatically.
  // It enters the backend verification queue with verificationStatus: 'pending'.
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
      verified: false, // NOT verified automatically upon owner registration!
      verificationStatus: 'pending', // 'pending' | 'verified' | 'rejected'
      submittedAt: new Date().toISOString(),
      price: parseInt(propertyData.price, 10) || 7500,
      priceMax: (parseInt(propertyData.price, 10) || 7500) + 4000,
      images: (propertyData.images && propertyData.images.length > 0)
        ? propertyData.images
        : ['https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80']
    };

    if (window.RENTDIRECT_MOCK && window.RENTDIRECT_MOCK.saveCustomProperty) {
      window.RENTDIRECT_MOCK.saveCustomProperty(newProperty);
    }

    // Create an Admin Verification Notification in queue
    const notifications = JSON.parse(localStorage.getItem('rentdirect_admin_notifications') || '[]');
    const notif = {
      id: 'notif-' + Date.now(),
      propertyId: newProperty.id,
      propertyTitle: newProperty.title,
      collegeName: newProperty.collegeName,
      ownerName: newProperty.owner?.name || 'PG Owner',
      ownerPhone: newProperty.owner?.phone || '',
      price: newProperty.price,
      distance: newProperty.distanceToCollege || '',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    notifications.unshift(notif);
    localStorage.setItem('rentdirect_admin_notifications', JSON.stringify(notifications));

    // Dispatch event so UI notification badges immediately update
    window.dispatchEvent(new CustomEvent('rentdirect:notification-updated', { detail: notif }));

    return {
      success: true,
      message: 'Property submitted for verification review!',
      property: newProperty,
      verificationStatus: 'pending'
    };
  },

  // ----------------------------------------------------------------------------
  // 5. ADMIN VERIFICATION & NOTIFICATIONS
  // ----------------------------------------------------------------------------

  // Get all admin verification notifications
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

  // Approve or Reject an owner's property
  async verifyProperty(propertyId, approve = true) {
    if (!this.isMockMode()) {
      try {
        return await this.request(API_ROUTES.ADMIN_VERIFY_PROPERTY(propertyId), {
          method: 'POST',
          body: JSON.stringify({ approved: approve })
        });
      } catch (err) {
        console.warn('Flask verify endpoint unreachable. Updating locally.', err);
      }
    }

    const newStatus = approve ? 'verified' : 'rejected';
    const isVerified = approve;

    // 1. Update property in mock storage
    if (window.RENTDIRECT_MOCK && window.RENTDIRECT_MOCK.updatePropertyStatus) {
      window.RENTDIRECT_MOCK.updatePropertyStatus(propertyId, isVerified, newStatus);
    }

    // 2. Update notification item
    const notifications = JSON.parse(localStorage.getItem('rentdirect_admin_notifications') || '[]');
    const notifIndex = notifications.findIndex(n => n.propertyId === propertyId);
    if (notifIndex !== -1) {
      notifications[notifIndex].status = newStatus;
      localStorage.setItem('rentdirect_admin_notifications', JSON.stringify(notifications));
    }

    // 3. Notify listeners
    window.dispatchEvent(new CustomEvent('rentdirect:notification-updated', { 
      detail: { propertyId, status: newStatus, verified: isVerified } 
    }));

    return {
      success: true,
      propertyId: propertyId,
      verified: isVerified,
      status: newStatus,
      message: approve ? 'Property successfully verified!' : 'Property listing rejected.'
    };
  },

  // ----------------------------------------------------------------------------
  // 5. ROOM VISIT REQUEST / INQUIRY
  // ----------------------------------------------------------------------------

  // Submit a visit request to the owner
  async submitVisitInquiry(inquiryData) {
    if (!this.isMockMode()) {
      try {
        return await this.request(API_ROUTES.SUBMIT_INQUIRY, {
          method: 'POST',
          body: JSON.stringify(inquiryData)
        });
      } catch (err) {
        console.warn('Flask inquiry endpoint unreachable. Saving locally.', err);
      }
    }

    const inquiries = JSON.parse(localStorage.getItem('rentdirect_inquiries') || '[]');
    const record = {
      ...inquiryData,
      id: 'inq-' + Date.now(),
      submittedAt: new Date().toISOString()
    };
    inquiries.push(record);
    localStorage.setItem('rentdirect_inquiries', JSON.stringify(inquiries));

    return {
      success: true,
      message: 'Visit request submitted successfully',
      inquiry: record
    };
  }
};

// Export to window object for access across HTML pages
window.RentDirectAPI = RentDirectAPI;
