/**
 * RentDirect - Frontend Configuration
 * Easily connect to your teammate's Flask Backend or toggle Mock Mode.
 */
const CONFIG = {
  // Toggle this to false once your teammate's Flask server is running!
  // When false, the frontend will call your teammate's REST API.
  // When true, it uses realistic local mock data so you can demo without a server.
  USE_MOCK_DATA: true,

  // Teammate's Flask API base URL
  API_BASE_URL: 'http://127.0.0.1:5000/api',

  TRUE_COST: {
    messCharge: 2500,
    maintenanceCharge: 500,
    utilitiesBase: 700,
    applianceMonthly: {
      ac: 1400,
      geyser: 350,
      cooler: 250
    },
    commuteMonthly: {
      walk: 0,
      autoMetro: 1800
    }
  },

  // Faridabad Colleges supported on RentDirect
  COLLEGES: [
    {
      id: 'mriirs',
      name: 'Manav Rachna (MRIIRS / MRU)',
      shortName: 'Manav Rachna',
      location: 'Sector 43, Surajkund Road, Faridabad',
      landmark: 'Near Aravali Hills',
      pgCount: 42,
      featured: true
    },
    {
      id: 'ymca',
      name: 'J.C. Bose UST (YMCA)',
      shortName: 'JC Bose YMCA',
      location: 'Sector 6, Mathura Road, Faridabad',
      landmark: 'Escorts Mujesar Metro Station',
      pgCount: 38,
      featured: true
    },
    {
      id: 'lingayas',
      name: "Lingaya's Vidyapeeth",
      shortName: "Lingaya's",
      location: 'Nachauli, Jasana Road, Faridabad',
      landmark: 'Old Faridabad Zone',
      pgCount: 24,
      featured: true
    },
    {
      id: 'echelon',
      name: 'Echelon Institute of Technology',
      shortName: 'Echelon Tech',
      location: 'Kabulpur, Kheri-Manjhawali Road, Faridabad',
      landmark: 'Greater Faridabad',
      pgCount: 16,
      featured: false
    },
    {
      id: 'alfalah',
      name: 'Al-Falah University',
      shortName: 'Al-Falah',
      location: 'Dhauj, Faridabad',
      landmark: 'Sohna Road link',
      pgCount: 12,
      featured: false
    },
    {
      id: 'davim',
      name: 'DAV Institute of Management',
      shortName: 'DAVIM',
      location: 'NH-3, NIT Faridabad',
      landmark: 'Near BK Chowk',
      pgCount: 19,
      featured: false
    }
  ],

  // Common PG Amenities for filters and listing forms
  AMENITIES: [
    'Wi-Fi',
    '3 Times Meals',
    'Air Conditioner (AC)',
    'Attached Washroom',
    'Power Backup',
    'RO Water',
    'Washing Machine',
    'CCTV Security',
    'Biometric Entry',
    'Study Table'
  ]
};

// Export to window object for zero-build vanilla JS access
window.RENTDIRECT_CONFIG = CONFIG;
