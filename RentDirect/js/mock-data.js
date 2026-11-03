/**
 * RentDirect - Mock Data for Faridabad Student Accommodations
 * Focus on Manav Rachna (Sector 43 / Surajkund), JC Bose YMCA, Lingaya's & more.
 */
const MOCK_PROPERTIES = [
  {
    id: 'rd-mriirs-01',
    title: 'Aravali Heights Student Living',
    collegeId: 'mriirs',
    collegeName: 'Manav Rachna (MRIIRS / MRU)',
    distanceToCollege: '350m from MRIIRS Gate 2',
    gender: 'boys',
    roomTypes: ['Single', 'Double Sharing', 'Triple Sharing'],
    price: 7500,
    priceMax: 13000,
    securityDeposit: 7500,
    address: 'Plot 82, Sector 43, Surajkund Road, Faridabad',
    images: [
      'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80'
    ],
    amenities: ['Wi-Fi', '3 Times Meals', 'Air Conditioner (AC)', 'Attached Washroom', 'Power Backup', 'RO Water', 'Study Table', 'CCTV Security'],
    verified: true,
    rating: 4.8,
    reviewsCount: 34,
    owner: {
      name: 'Ramesh Chawla',
      phone: '+91 98101 23456',
      email: 'ramesh.chawla@example.com',
      verified: true
    },
    description: 'Premier student residency specifically tailored for Manav Rachna students. Located just 4 minutes on foot from campus gate. Includes 3 wholesome home-style vegetarian & egg meals, high-speed fiber internet, and dedicated study desks.',
    rules: 'Gate closes at 10:00 PM. Visitors allowed in common reception room only. No smoking on premises.'
  },
  {
    id: 'rd-mriirs-02',
    title: 'Saraswati Girls Executive PG',
    collegeId: 'mriirs',
    collegeName: 'Manav Rachna (MRIIRS / MRU)',
    distanceToCollege: '500m from Manav Rachna Campus',
    gender: 'girls',
    roomTypes: ['Single', 'Double Sharing'],
    price: 8500,
    priceMax: 14500,
    securityDeposit: 8500,
    address: 'H.No 120, Charmwood Village / Sector 43 Link, Faridabad',
    images: [
      'https://images.unsplash.com/photo-1540518614846-7ede433c4ef0?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=800&q=80'
    ],
    amenities: ['Wi-Fi', '3 Times Meals', 'Air Conditioner (AC)', 'Attached Washroom', 'Biometric Entry', 'CCTV Security', 'Power Backup', 'Washing Machine'],
    verified: true,
    rating: 4.9,
    reviewsCount: 42,
    owner: {
      name: 'Sunita Mehra (Warden on-site)',
      phone: '+91 98188 76543',
      email: 'saraswati.girls.pg@example.com',
      verified: true
    },
    description: 'Safe, premium girls student accommodation with 24/7 female warden presence and biometric access. Hygienic North & South Indian meals prepared fresh in-house. Close proximity to Manav Rachna main campus.',
    rules: 'Entry timing 9:30 PM. Prior leave intimation to warden required for outstation travel.'
  },
  {
    id: 'rd-ymca-01',
    title: 'Metro View Co-Living Hub',
    collegeId: 'ymca',
    collegeName: 'J.C. Bose UST (YMCA)',
    distanceToCollege: '600m from JC Bose YMCA Gate',
    gender: 'boys',
    roomTypes: ['Double Sharing', 'Triple Sharing'],
    price: 6000,
    priceMax: 9500,
    securityDeposit: 6000,
    address: 'Street 4, Sector 7 near Escorts Metro, Faridabad',
    images: [
      'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=800&q=80'
    ],
    amenities: ['Wi-Fi', '3 Times Meals', 'Air Conditioner (AC)', 'Attached Washroom', 'Power Backup', 'RO Water', 'Study Table'],
    verified: true,
    rating: 4.6,
    reviewsCount: 29,
    owner: {
      name: 'Kuldeep Rawat',
      phone: '+91 97110 54321',
      email: 'kuldeep.metro@example.com',
      verified: true
    },
    description: 'Budget-friendly, highly popular PG among JC Bose (YMCA) engineering students. Quick walking distance to Escorts Mujesar Metro station and the college main gate. Unlimited fast Wi-Fi and power backup for late-night study sessions.',
    rules: 'No loud music after 11 PM. Cleanliness in shared spaces expected.'
  },
  {
    id: 'rd-mriirs-03',
    title: 'Greenfields Scholar Residency',
    collegeId: 'mriirs',
    collegeName: 'Manav Rachna (MRIIRS / MRU)',
    distanceToCollege: '1.2 km from MRIIRS (Free Shuttle Available)',
    gender: 'unisex',
    roomTypes: ['Single', 'Double Sharing'],
    price: 9000,
    priceMax: 16000,
    securityDeposit: 9000,
    address: 'Block B, Greenfields Colony, Near Surajkund, Faridabad',
    images: [
      'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80'
    ],
    amenities: ['Wi-Fi', '3 Times Meals', 'Air Conditioner (AC)', 'Attached Washroom', 'Power Backup', 'Washing Machine', 'RO Water', 'CCTV Security'],
    verified: true,
    rating: 4.7,
    reviewsCount: 18,
    owner: {
      name: 'Vikram Batra',
      phone: '+91 99990 11223',
      email: 'vikram.batra@example.com',
      verified: true
    },
    description: 'Modern studio and sharing rooms in a peaceful, lush green colony adjacent to Manav Rachna. Includes morning and evening shuttle drops to campus. Fully serviced with daily housekeeping.',
    rules: 'Late entry allowed with student ID registration. Separate wings for boys and girls.'
  },
  {
    id: 'rd-lingayas-01',
    title: 'Nachauli Campus Haven PG',
    collegeId: 'lingayas',
    collegeName: "Lingaya's Vidyapeeth",
    distanceToCollege: '400m from Lingayas Main Gate',
    gender: 'boys',
    roomTypes: ['Single', 'Double Sharing', 'Triple Sharing'],
    price: 5500,
    priceMax: 8500,
    securityDeposit: 5500,
    address: 'Main Jasana Road, Nachauli, Faridabad',
    images: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80'
    ],
    amenities: ['Wi-Fi', '3 Times Meals', 'Attached Washroom', 'Power Backup', 'RO Water', 'Study Table'],
    verified: true,
    rating: 4.5,
    reviewsCount: 15,
    owner: {
      name: 'Anand Singh',
      phone: '+91 98730 44556',
      email: 'anand.haven@example.com',
      verified: true
    },
    description: 'The closest student accommodation to Lingayas Vidyapeeth campus. Ideal for tech and management students looking for an affordable, hassle-free stay with all meals included.',
    rules: 'Quiet hours after 10:30 PM. Keep rooms and common corridor tidy.'
  },
  {
    id: 'rd-davim-01',
    title: 'NIT Prime Student Hostel',
    collegeId: 'davim',
    collegeName: 'DAV Institute of Management',
    distanceToCollege: '700m from DAVIM Campus',
    gender: 'girls',
    roomTypes: ['Double Sharing', 'Triple Sharing'],
    price: 6500,
    priceMax: 10500,
    securityDeposit: 6500,
    address: 'Near BK Chowk, NH-3, NIT Faridabad',
    images: [
      'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80'
    ],
    amenities: ['Wi-Fi', '3 Times Meals', 'Air Conditioner (AC)', 'Attached Washroom', 'CCTV Security', 'RO Water'],
    verified: true,
    rating: 4.6,
    reviewsCount: 22,
    owner: {
      name: 'Neeta Arora',
      phone: '+91 98115 88990',
      email: 'neeta.davim@example.com',
      verified: true
    },
    description: 'Safe girls accommodation in central NIT Faridabad. Walkable from DAV Institute, markets, and metro connection. Balanced nutritional home food provided 3 times a day.',
    rules: 'Gate closes at 9:00 PM. Visitors allowed in lounge only.'
  }
];

// Provide stored properties or fallback to default mock array
function getLocalProperties() {
  const custom = localStorage.getItem('rentdirect_custom_properties');
  if (custom) {
    try {
      const parsed = JSON.parse(custom);
      return [...parsed, ...MOCK_PROPERTIES];
    } catch (e) {
      console.warn('Failed to parse local stored properties', e);
    }
  }
  return MOCK_PROPERTIES;
}

window.RENTDIRECT_MOCK = {
  properties: getLocalProperties(),
  saveCustomProperty: function(property) {
    const existing = JSON.parse(localStorage.getItem('rentdirect_custom_properties') || '[]');
    existing.unshift(property);
    localStorage.setItem('rentdirect_custom_properties', JSON.stringify(existing));
    window.RENTDIRECT_MOCK.properties = getLocalProperties();
  },
  updatePropertyStatus: function(propertyId, verified, status) {
    const existing = JSON.parse(localStorage.getItem('rentdirect_custom_properties') || '[]');
    const index = existing.findIndex(p => p.id === propertyId);
    if (index !== -1) {
      existing[index].verified = verified;
      existing[index].verificationStatus = status;
      localStorage.setItem('rentdirect_custom_properties', JSON.stringify(existing));
    }
    const mockItem = MOCK_PROPERTIES.find(p => p.id === propertyId);
    if (mockItem) {
      mockItem.verified = verified;
      mockItem.verificationStatus = status;
    }
    window.RENTDIRECT_MOCK.properties = getLocalProperties();
  }
};
