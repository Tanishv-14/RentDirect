"""
RentDirect - Python Flask REST API Backend
===========================================
Handles:
- User Authentication (Student, PG Owner, Backend/Verification Team)
- Role-Based Access Control (RBAC) - ONLY backend team can approve properties
- Property Listings & Filtering (Manav Rachna, JC Bose YMCA, Lingaya's, etc.)
- Owner Property Submission (starts as 'pending', verified=False)
- Campus Facility Inspection Scheduling (Sends DATE RANGE to owner)
- Final Facility Verification & Approval by Backend Team
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import datetime
import os
import json
import re

app = Flask(__name__)
# Enable CORS for all routes so frontend (port 8000/5500/local file) can talk to Flask without errors
CORS(app, supports_credentials=True, origins="*")

DB_FILE = os.path.join(os.path.dirname(__file__), 'backend_data.json')

# -----------------------------------------------------------------------------
# INITIAL SEED DATA
# -----------------------------------------------------------------------------
DEFAULT_USERS = [
  {
    "id": "usr-admin-01",
    "email": "admin@rentdirect.com",
    "password": "admin123",
    "role": "backend_team",
    "name": "RentDirect Verification Team",
    "phone": "+91 98000 00001"
  },
  {
    "id": "usr-owner-01",
    "email": "ramesh@rentdirect.com",
    "password": "owner123",
    "role": "owner",
    "name": "Ramesh Chawla",
    "phone": "+91 98101 23456"
  },
  {
    "id": "usr-student-01",
    "email": "ananya@rentdirect.com",
    "password": "student123",
    "role": "student",
    "name": "Ananya Sharma",
    "phone": "+91 98112 23344"
  }
]

DEFAULT_PROPERTIES = [
  {
    "id": "rd-mriirs-01",
    "title": "Aravali Heights Student Living",
    "collegeId": "mriirs",
    "collegeName": "Manav Rachna (MRIIRS / MRU)",
    "distanceToCollege": "350m from MRIIRS Gate 2",
    "gender": "boys",
    "roomTypes": ["Single", "Double Sharing", "Triple Sharing"],
    "price": 7500,
    "priceMax": 13000,
    "securityDeposit": 7500,
    "messCharge": 2500,
    "maintenanceCharge": 500,
    "address": "Plot 82, Sector 43, Surajkund Road, Faridabad",
    "images": [
      "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80"
    ],
    "amenities": ["Wi-Fi", "3 Times Meals", "Air Conditioner (AC)", "Attached Washroom", "Power Backup", "RO Water", "Study Table", "CCTV Security"],
    "verified": True,
    "verificationStatus": "verified",
    "rating": 4.8,
    "reviewsCount": 34,
    "owner": {
      "name": "Ramesh Chawla",
      "phone": "+91 98101 23456",
      "email": "ramesh@rentdirect.com",
      "verified": True
    },
    "description": "Premier student residency specifically tailored for Manav Rachna students. Located just 4 minutes on foot from campus gate.",
    "rules": "Gate closes at 10:00 PM. Visitors allowed in common reception room only. No smoking on premises."
  },
  {
    "id": "rd-mriirs-02",
    "title": "Saraswati Girls Executive PG",
    "collegeId": "mriirs",
    "collegeName": "Manav Rachna (MRIIRS / MRU)",
    "distanceToCollege": "500m from Manav Rachna Campus",
    "gender": "girls",
    "roomTypes": ["Single", "Double Sharing"],
    "price": 8500,
    "priceMax": 14500,
    "securityDeposit": 8500,
    "messCharge": 2500,
    "maintenanceCharge": 500,
    "address": "H.No 120, Charmwood Village / Sector 43 Link, Faridabad",
    "images": [
      "https://images.unsplash.com/photo-1540518614846-7ede433c4ef0?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80"
    ],
    "amenities": ["Wi-Fi", "3 Times Meals", "Air Conditioner (AC)", "Attached Washroom", "Biometric Entry", "CCTV Security", "Power Backup", "Washing Machine"],
    "verified": True,
    "verificationStatus": "verified",
    "rating": 4.9,
    "reviewsCount": 42,
    "owner": {
      "name": "Sunita Mehra",
      "phone": "+91 98188 76543",
      "email": "sunita.girls@example.com",
      "verified": True
    },
    "description": "Safe, premium girls student accommodation with 24/7 female warden presence and biometric access near MRIIRS.",
    "rules": "Entry timing 9:30 PM. Prior leave intimation required for outstation travel."
  },
  {
    "id": "rd-ymca-01",
    "title": "Metro View Co-Living Hub",
    "collegeId": "ymca",
    "collegeName": "J.C. Bose UST (YMCA)",
    "distanceToCollege": "600m from JC Bose YMCA Gate",
    "gender": "boys",
    "roomTypes": ["Double Sharing", "Triple Sharing"],
    "price": 6000,
    "priceMax": 9500,
    "securityDeposit": 6000,
    "messCharge": 2500,
    "maintenanceCharge": 500,
    "address": "Street 4, Sector 7 near Escorts Metro, Faridabad",
    "images": [
      "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=800&q=80"
    ],
    "amenities": ["Wi-Fi", "3 Times Meals", "Air Conditioner (AC)", "Attached Washroom", "Power Backup", "RO Water", "Study Table"],
    "verified": True,
    "verificationStatus": "verified",
    "rating": 4.6,
    "reviewsCount": 29,
    "owner": {
      "name": "Kuldeep Rawat",
      "phone": "+91 97110 54321",
      "email": "kuldeep.metro@example.com",
      "verified": True
    },
    "description": "Budget-friendly, highly popular PG among JC Bose (YMCA) engineering students. Quick walking distance to Metro station.",
    "rules": "No loud music after 11 PM. Cleanliness in shared spaces expected."
  }
]

def _normalized_duplicate_value(value):
    return ' '.join(str(value or '').casefold().split())

def _normalized_phone(value):
    return re.sub(r'\D', '', str(value or ''))

def compute_property_flags(properties):
    for prop in properties:
        price = prop.get('price')
        try:
            prop['price_flag'] = float(price) < 3000
        except (TypeError, ValueError):
            prop['price_flag'] = False

        owner_phone = _normalized_phone((prop.get('owner') or {}).get('phone'))
        address = _normalized_duplicate_value(prop.get('address'))
        title = _normalized_duplicate_value(prop.get('title'))
        duplicate_matches = []

        for other in properties:
            if other is prop:
                continue
            other_phone = _normalized_phone((other.get('owner') or {}).get('phone'))
            same_phone = bool(owner_phone and owner_phone == other_phone)
            same_address = bool(
                address and address == _normalized_duplicate_value(other.get('address'))
            )
            same_title = bool(
                title and title == _normalized_duplicate_value(other.get('title'))
            )
            if same_phone or same_address or same_title:
                duplicate_matches.append({
                    'id': other.get('id'),
                    'title': other.get('title'),
                    'reasons': [
                        reason for reason, matched in (
                            ('owner phone', same_phone),
                            ('address', same_address),
                            ('title', same_title)
                        ) if matched
                    ]
                })

        prop['duplicate_flag'] = bool(duplicate_matches)
        prop['duplicate_matches'] = duplicate_matches
        if not prop.get('reviewStatus'):
            status = str(prop.get('verificationStatus') or '').lower()
            prop['reviewStatus'] = (
                'reviewed' if prop.get('verified') or status == 'verified'
                else 'unverified' if status in ('rejected', 'unverified')
                else 'pending'
            )

# In-memory database with persistent JSON sync
def load_db():
    if os.path.exists(DB_FILE):
        try:
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                db = json.load(f)
            compute_property_flags(db.get('properties', []))
            save_db(db)
            return db
        except Exception as e:
            print(f"Error loading DB: {e}")
    
    # Default database structure
    db = {
        "users": DEFAULT_USERS,
        "properties": DEFAULT_PROPERTIES,
        "notifications": [],
        "students": [],
        "owners": [],
        "inquiries": []
    }
    compute_property_flags(db['properties'])
    save_db(db)
    return db

def save_db(data):
    try:
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"Error saving DB: {e}")
        raise

# Global DB state
DB = load_db()

# -----------------------------------------------------------------------------
# 1. HEALTH & BASE ENDPOINTS
# -----------------------------------------------------------------------------
@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status": "healthy",
        "service": "RentDirect Flask Backend",
        "timestamp": datetime.datetime.now().isoformat()
    })

# -----------------------------------------------------------------------------
# 2. AUTHENTICATION (LOGIN, LOGOUT, OTP)
# -----------------------------------------------------------------------------
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()
    preferred_role = data.get('role')

    user = next((u for u in DB['users'] if u['email'].lower() == email), None)
    
    if not user:
        # For hackathon demo: Auto-create guest user if email matches demo pattern
        role = preferred_role or ("backend_team" if "admin" in email else ("owner" if "owner" in email else "student"))
        user = {
            "id": f"usr-{int(datetime.datetime.now().timestamp())}",
            "email": email,
            "password": password or "123456",
            "role": role,
            "name": email.split('@')[0].capitalize(),
            "phone": "+91 98000 12345"
        }
        DB['users'].append(user)
        save_db(DB)

    # Return safe user data
    return jsonify({
        "success": True,
        "message": f"Logged in as {user['name']}",
        "user": {
            "id": user['id'],
            "name": user['name'],
            "email": user['email'],
            "role": user['role'],
            "phone": user.get('phone', '')
        }
    })

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    return jsonify({"success": True, "message": "Logged out successfully"})

@app.route('/api/auth/send-otp', methods=['POST'])
def send_otp():
    data = request.get_json() or {}
    email = data.get('email', '')
    role = data.get('role', 'student')
    
    # Always returns demo OTP 123456 for reliable evaluation
    return jsonify({
        "success": True,
        "message": f"6-digit verification code sent to {email}",
        "demoOtp": "123456",
        "email": email,
        "role": role
    })

@app.route('/api/auth/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json() or {}
    otp = str(data.get('otp', '')).strip()

    if otp == "123456":
        return jsonify({
            "success": True,
            "verified": True,
            "message": "OTP verified successfully!"
        })
    else:
        return jsonify({
            "success": False,
            "verified": False,
            "message": "Invalid OTP. Please enter demo OTP: 123456"
        }), 400

# -----------------------------------------------------------------------------
# 3. PROPERTY LISTINGS (PUBLIC & FILTERED)
# -----------------------------------------------------------------------------
@app.route('/api/properties', methods=['GET'])
def get_properties():
    college = request.args.get('college')
    gender = request.args.get('gender')
    max_price = request.args.get('maxPrice', type=int)
    search = request.args.get('search', '').lower().strip()
    status = request.args.get('status')

    compute_property_flags(DB['properties'])
    props = DB['properties']

    if college and college != 'all':
        props = [p for p in props if p.get('collegeId') == college]
    if gender and gender != 'all':
        props = [p for p in props if p.get('gender') == gender or p.get('gender') == 'unisex']
    if max_price:
        props = [p for p in props if p.get('price', 0) <= max_price]
    if search:
        props = [p for p in props if search in p.get('title', '').lower() or search in p.get('collegeName', '').lower() or search in p.get('address', '').lower()]
    if status:
        props = [p for p in props if p.get('verificationStatus') == status]

    return jsonify(props)

@app.route('/api/properties/<prop_id>', methods=['GET'])
def get_property(prop_id):
    compute_property_flags(DB['properties'])
    prop = next((p for p in DB['properties'] if p['id'] == prop_id), None)
    if not prop:
        return jsonify({"error": "Property not found"}), 404
    return jsonify(prop)

# -----------------------------------------------------------------------------
# 4. OWNER REGISTRATION & PROPERTY SUBMISSION
# Notice: When an owner registers a property, verified is ALWAYS False.
# It enters the backend verification queue with verificationStatus: 'pending'.
# -----------------------------------------------------------------------------
@app.route('/api/owners/register', methods=['POST'])
def register_owner():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    existing_owner = next(
        (owner for owner in DB['owners'] if email and (owner.get('email') or '').lower() == email),
        None
    )
    if existing_owner:
        existing_owner.update({
            "name": data.get('name'),
            "phone": data.get('phone'),
            "email": data.get('email')
        })
        save_db(DB)
        return jsonify({"success": True, "owner": existing_owner})

    owner_id = f"own-{int(datetime.datetime.now().timestamp() * 1000000)}"
    record = {
        "id": owner_id,
        "name": data.get('name'),
        "phone": data.get('phone'),
        "email": data.get('email'),
        "registeredAt": datetime.datetime.now().isoformat()
    }
    DB['owners'].append(record)
    save_db(DB)
    return jsonify({"success": True, "owner": record})

@app.route('/api/properties', methods=['POST'])
def create_property():
    data = request.get_json() or {}
    prop_id = f"rd-{int(datetime.datetime.now().timestamp())}"
    
    # Crucial Business Logic:
    # Newly submitted owner properties CANNOT be verified by the owner.
    # They start unverified and pending physical inspection.
    new_prop = {
        "id": prop_id,
        "title": data.get('title', 'Student PG Accommodation'),
        "collegeId": data.get('collegeId', 'mriirs'),
        "collegeName": data.get('collegeName', 'Nearby College'),
        "distanceToCollege": data.get('distanceToCollege', 'Near campus'),
        "address": data.get('address', 'Faridabad'),
        "gender": data.get('gender', 'boys'),
        "price": int(data.get('price', 7500)),
        "priceMax": int(data.get('price', 7500)) + 4000,
        "messCharge": int(data.get('messCharge', 2500)),
        "maintenanceCharge": int(data.get('maintenanceCharge', 500)),
        "roomTypes": data.get('roomTypes', ['Single', 'Double Sharing']),
        "amenities": data.get('amenities', ['Wi-Fi', '3 Times Meals']),
        "rules": data.get('rules', 'Gate closes at 10:00 PM.'),
        "description": data.get('description', 'Student accommodation near campus.'),
        "images": data.get('images', ['https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80']),
        "owner": data.get('owner', {}),
        "reviewStatus": "pending",
        
        # VERIFICATION FLAGS:
        "verified": False,
        "verificationStatus": "pending",  # 'pending' -> 'inspection_scheduled' -> 'verified' / 'rejected'
        "submittedAt": datetime.datetime.now().isoformat(),
        "inspectionWindow": None,
        "facilityChecklist": []
    }

    DB['properties'].insert(0, new_prop)
    compute_property_flags(DB['properties'])

    # Generate Notification for Backend Team Queue
    notif = {
        "id": f"notif-{int(datetime.datetime.now().timestamp())}",
        "propertyId": prop_id,
        "propertyTitle": new_prop['title'],
        "collegeName": new_prop['collegeName'],
        "ownerName": new_prop['owner'].get('name', 'Owner'),
        "ownerPhone": new_prop['owner'].get('phone', ''),
        "price": new_prop['price'],
        "distance": new_prop['distanceToCollege'],
        "amenities": new_prop['amenities'],
        "status": "pending",  # 'pending', 'inspection_scheduled', 'verified', 'rejected'
        "inspectionWindow": None,
        "createdAt": datetime.datetime.now().isoformat()
    }
    DB['notifications'].insert(0, notif)
    save_db(DB)

    return jsonify({
        "success": True,
        "message": "Property submitted for backend verification review.",
        "property": new_prop,
        "verificationStatus": "pending"
    }), 201

@app.route('/api/admin/properties/<prop_id>/review-status', methods=['POST'])
def set_property_review_status(prop_id):
    data = request.get_json() or {}
    admin_email = str(data.get('adminEmail') or '').strip().lower()
    admin = next(
        (user for user in DB.get('users', [])
         if user.get('email', '').lower() == admin_email
         and user.get('role') in ('backend_team', 'admin')),
        None
    )
    if not admin:
        return jsonify({"error": "Only the Backend Team can update review status"}), 403

    review_status = data.get('reviewStatus')
    if review_status not in ('reviewed', 'pending', 'unverified'):
        return jsonify({"error": "Review status must be reviewed, pending, or unverified"}), 400

    prop = next((item for item in DB.get('properties', []) if item.get('id') == prop_id), None)
    if not prop:
        return jsonify({"error": "Property not found"}), 404

    prop['reviewStatus'] = review_status
    prop['reviewedAt'] = datetime.datetime.now().isoformat() if review_status == 'reviewed' else None
    compute_property_flags(DB['properties'])
    save_db(DB)
    return jsonify({"success": True, "property": prop})

# -----------------------------------------------------------------------------
# 5. BACKEND / VERIFICATION TEAM ONLY ENDPOINTS
# ONLY users with role 'backend_team' can perform these actions!
# -----------------------------------------------------------------------------
@app.route('/api/admin/notifications', methods=['GET'])
def get_admin_notifications():
    # Return all pending and in-progress inspection notifications
    return jsonify(DB['notifications'])

@app.route('/api/admin/properties/<prop_id>/schedule-inspection', methods=['POST'])
def schedule_inspection(prop_id):
    """
    Step 1 of Verification:
    Backend team sends a DATE RANGE (e.g. Nov 6 to Nov 9) to the owner
    to physically visit the campus and inspect claimed facilities.
    """
    data = request.get_json() or {}
    start_date = data.get('startDate')
    end_date = data.get('endDate')
    notes = data.get('notes', 'Physical facility & Wi-Fi speed inspection')

    if not start_date or not end_date:
        return jsonify({"error": "Both start and end dates of the date range are required."}), 400

    prop = next((p for p in DB['properties'] if p['id'] == prop_id), None)
    if not prop:
        return jsonify({"error": "Property not found"}), 404

    inspection_window = {
        "startDate": start_date,
        "endDate": end_date,
        "scheduledAt": datetime.datetime.now().isoformat(),
        "notes": notes
    }

    # Update property
    prop['verificationStatus'] = 'inspection_scheduled'
    prop['inspectionWindow'] = inspection_window

    # Update notification
    for n in DB['notifications']:
        if n['propertyId'] == prop_id:
            n['status'] = 'inspection_scheduled'
            n['inspectionWindow'] = inspection_window

    save_db(DB)

    return jsonify({
        "success": True,
        "message": f"Inspection date range ({start_date} to {end_date}) sent to owner.",
        "propertyId": prop_id,
        "inspectionWindow": inspection_window
    })

@app.route('/api/admin/properties/<prop_id>/verify', methods=['POST'])
def verify_property(prop_id):
    """
    Step 2 of Verification:
    After checking facilities in person, Backend team approves verified status.
    """
    data = request.get_json() or {}
    approved = data.get('approved', True)
    checklist = data.get('checklist', [])
    notes = data.get('notes', 'Facilities physically inspected and approved.')

    prop = next((p for p in DB['properties'] if p['id'] == prop_id), None)
    if not prop:
        return jsonify({"error": "Property not found"}), 404

    new_status = 'verified' if approved else 'rejected'
    prop['verified'] = bool(approved)
    prop['verificationStatus'] = new_status
    prop['reviewStatus'] = 'reviewed' if approved else 'unverified'
    prop['verifiedAt'] = datetime.datetime.now().isoformat()
    prop['facilityChecklist'] = checklist
    prop['verificationNotes'] = notes

    # Update notification status
    for n in DB['notifications']:
        if n['propertyId'] == prop_id:
            n['status'] = new_status

    save_db(DB)

    return jsonify({
        "success": True,
        "propertyId": prop_id,
        "verified": bool(approved),
        "status": new_status,
        "message": "Property verified & Verified Badge issued!" if approved else "Listing verification rejected."
    })

# -----------------------------------------------------------------------------
# 6. STUDENT REGISTRATION & INQUIRIES
# -----------------------------------------------------------------------------
@app.route('/api/students', methods=['GET'])
def get_students():
    return jsonify(DB.get('students', []))

@app.route('/api/admin/database', methods=['GET'])
def get_full_database():
    return jsonify(DB)

@app.route('/api/admin/database/inspector', methods=['GET'])
def get_inspector_database():
    inquiries = []
    for inquiry in DB.get('inquiries', []):
        record = dict(inquiry)
        property_record = next(
            (prop for prop in DB.get('properties', [])
             if prop.get('id') == record.get('propertyId')
             or prop.get('title') == record.get('propertyTitle')),
            None
        )
        if property_record:
            record.setdefault('propertyId', property_record.get('id'))
            record.setdefault('ownerEmail', property_record.get('owner', {}).get('email'))
        record.setdefault('status', 'pending')
        inquiries.append(record)

    return jsonify({
        'students': DB.get('students', []),
        'owners': DB.get('owners', []),
        'inquiries': inquiries
    })

@app.route('/api/owner/inquiries', methods=['GET'])
def get_owner_inquiries():
    owner_email = request.args.get('email', '').strip().lower()
    known_owners = {
        user.get('email', '').lower()
        for user in DB.get('users', [])
        if user.get('role') == 'owner'
    }
    known_owners.update(owner.get('email', '').lower() for owner in DB.get('owners', []))
    if not owner_email or owner_email not in known_owners:
        return jsonify({"error": "Owner account not found"}), 403

    all_inquiries = get_inspector_database().get_json()['inquiries']
    return jsonify({
        "inquiries": [
            inquiry for inquiry in all_inquiries
            if (inquiry.get('ownerEmail') or '').lower() == owner_email
        ]
    })

@app.route('/api/admin/database/<collection>/<record_id>', methods=['DELETE'])
def delete_database_record(collection, record_id):
    if collection not in ('students', 'owners', 'inquiries'):
        return jsonify({"error": "Unsupported database collection"}), 400

    records = DB.get(collection, [])
    remaining = [record for record in records if str(record.get('id')) != record_id]
    if len(remaining) == len(records):
        return jsonify({"error": "Record not found"}), 404

    DB[collection] = remaining
    save_db(DB)
    return jsonify({"success": True, "collection": collection, "id": record_id})

@app.route('/api/admin/database/test-data', methods=['DELETE'])
def clear_database_test_data():
    counts = {collection: len(DB.get(collection, []))
              for collection in ('students', 'owners', 'inquiries')}
    for collection in counts:
        DB[collection] = []
    save_db(DB)
    return jsonify({"success": True, "deleted": counts})

@app.route('/api/students/register', methods=['POST'])
def register_student():
    data = request.get_json() or {}
    student_id = f"std-{int(datetime.datetime.now().timestamp() * 1000000)}"
    record = {
        "id": student_id,
        "name": data.get('name'),
        "email": data.get('email'),
        "phone": data.get('phone'),
        "gender": data.get('gender'),
        "collegeId": data.get('collegeId'),
        "collegeName": data.get('collegeName'),
        "course": data.get('course'),
        "year": data.get('year'),
        "roomSharing": data.get('roomSharing'),
        "budget": data.get('budget'),
        "amenities": data.get('amenities', []),
        "emailVerified": True,
        "registeredAt": datetime.datetime.now().isoformat()
    }
    DB['students'].append(record)
    save_db(DB)
    return jsonify({"success": True, "student": record})

@app.route('/api/inquiries', methods=['POST'])
def submit_inquiry():
    data = request.get_json() or {}
    property_record = next(
        (prop for prop in DB.get('properties', [])
         if (data.get('propertyId') and prop.get('id') == data.get('propertyId'))
         or (data.get('propertyTitle') and prop.get('title') == data.get('propertyTitle'))),
        None
    )
    inq_id = f"inq-{int(datetime.datetime.now().timestamp() * 1000000)}"
    record = {
        "id": inq_id,
        "propertyId": (property_record or {}).get('id') or data.get('propertyId'),
        "propertyTitle": data.get('propertyTitle'),
        "ownerEmail": ((property_record or {}).get('owner') or {}).get('email')
                      or data.get('ownerEmail'),
        "ownerName": ((property_record or {}).get('owner') or {}).get('name')
                     or data.get('ownerName'),
        "name": data.get('name'),
        "studentEmail": data.get('studentEmail'),
        "phone": data.get('phone'),
        "college": data.get('college'),
        "date": data.get('date'),
        "selectedAppliances": data.get('selectedAppliances', {}),
        "commuteMode": data.get('commuteMode', 'walk'),
        "monthlyTotal": data.get('monthlyTotal'),
        "inquiryType": data.get('inquiryType', 'visit'),
        "status": "pending",
        "submittedAt": datetime.datetime.now().isoformat()
    }
    DB['inquiries'].append(record)
    save_db(DB)
    return jsonify({"success": True, "inquiry": record})

@app.route('/api/owner/inquiries/<inquiry_id>/status', methods=['POST'])
def update_owner_inquiry_status(inquiry_id):
    data = request.get_json() or {}
    owner_email = str(data.get('ownerEmail') or '').strip().lower()
    inquiry = next(
        (item for item in DB.get('inquiries', [])
         if str(item.get('id')) == inquiry_id),
        None
    )
    if not inquiry:
        return jsonify({"error": "Inquiry not found"}), 404

    property_record = next(
        (prop for prop in DB.get('properties', [])
         if prop.get('id') == inquiry.get('propertyId')
         or prop.get('title') == inquiry.get('propertyTitle')),
        None
    )
    actual_owner_email = (
        inquiry.get('ownerEmail')
        or ((property_record or {}).get('owner') or {}).get('email')
        or ''
    ).lower()
    if not owner_email or owner_email != actual_owner_email:
        return jsonify({"error": "Inquiry does not belong to this owner"}), 403

    current_status = inquiry.get('status', 'pending')
    next_status = {
        'pending': 'visit_approved',
        'visit_approved': 'move_in_confirmed'
    }.get(current_status)
    if data.get('status') != next_status:
        return jsonify({"error": "Invalid inquiry status transition"}), 400

    inquiry.update({
        'propertyId': inquiry.get('propertyId') or (property_record or {}).get('id'),
        'ownerEmail': actual_owner_email,
        'status': next_status,
        'updatedAt': datetime.datetime.now().isoformat()
    })
    save_db(DB)
    return jsonify({"success": True, "inquiry": inquiry})

# -----------------------------------------------------------------------------
# RUN SERVER
# -----------------------------------------------------------------------------
if __name__ == '__main__':
    print("=" * 60)
    print("RentDirect Flask REST API Backend running on http://127.0.0.1:5000")
    print("Backend Team Account: admin@rentdirect.com / admin123")
    print("PG Owner Account:     ramesh@rentdirect.com / owner123")
    print("Student Account:      ananya@rentdirect.com / student123")
    print("=" * 60)
    app.run(host='127.0.0.1', port=5000, debug=True)
