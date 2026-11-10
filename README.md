# RentDirect - Student Accommodation Marketplace

RentDirect is a responsive student accommodation platform connecting college students with verified PG owners in Faridabad (with special focus on **Manav Rachna**, **JC Bose YMCA**, and **Lingaya's**).

---

## 🚀 Quick Start (Running Frontend & Backend)

### 1. Run Python Flask Backend
From inside the `RentDirect` folder:
```bash
python app.py
```
This launches the Flask REST API at **`http://127.0.0.1:5000`** with pre-seeded data and CORS enabled.

### 2. Run Frontend
In a second terminal window (or simply double-click [`index.html`](file:///c:/Users/HP/Downloads/RentDirect/index.html)):
```bash
python -m http.server 8000
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser.

---

## 🔑 Login / Logout Panel & Test Credentials

RentDirect includes role-based access control (RBAC):

| Role | Demo Email | Demo Password | Capabilities |
| :--- | :--- | :--- | :--- |
| **🛡️ Backend Team** | `admin@rentdirect.com` | `admin123` | **Exclusive Access:** Review new owner listings, dispatch campus inspection date ranges, inspect claimed facilities, and issue Verified Badges. |
| **🏠 PG Owner** | `ramesh@rentdirect.com` | `owner123` | List properties, review student visit requests, approve visits, confirm move-ins, and view scheduled inspection date ranges. |
| **🎓 Student** | `ananya@rentdirect.com` | `student123` | Search PGs by campus gate, filter by meals/budget, request room tours. |

*(The Login modal includes a **"⚡ One-Click Fill"** button for fast hackathon demo presentations).*

Property listings are automatically flagged for rent below ₹3,000 and possible duplicates (matching owner phone, address, or title). The Backend Team Admin Review panel can set each property to **Reviewed**, **Pending**, or **Unverified**. Listing badges include the note “A review is a check, not a guarantee.”

---

## 🔍 Verification & Inspection Date Range Pipeline

To ensure listed facilities (Wi-Fi speeds, hygienic meals, AC backup) are genuine:

1. **Owner Registration:**
   * When an owner posts a PG, it enters the backend queue with `verified: false` and `verificationStatus: 'pending'`.
   * **PG Owners CANNOT approve their own listings.**
2. **Backend Team Notification:**
   * The notification bell (`🔔`) and Verification Center are **strictly restricted to the Backend Team**.
3. **Dispatch Inspection Date Range:**
   * The backend team sends a **date range** (e.g. *Nov 6 - Nov 9*, not an exact day) to the owner to inspect campus rooms and amenities.
   * Status updates to `📅 Inspection Scheduled`.
4. **Physical Facility Checklist & Approval:**
   * On site, the team verifies high-speed Wi-Fi, kitchen hygiene, AC backup, and security.
   * Clicking **"Confirm Facilities & Approve"** grants the green **`✓ Verified Property`** badge.

---

## 🎨 Configurable Brand Colours

The platform is styled using exactly three primary brand colours defined as CSS variables at the top of [`css/style.css`](file:///c:/Users/HP/Downloads/RentDirect/css/style.css#L8-L16):

```css
:root {
  --brand-primary: #2563eb;    /* 1. Main brand identity & primary action buttons */
  --brand-secondary: #0d9488;  /* 2. Secondary accent, badges & owner highlights */
  --brand-neutral: #1e293b;    /* 3. Deep headings, dark surfaces & primary text */
}
```

---

## 🔗 Python Flask REST API Contract

All frontend API calls are strictly centralized in [`js/api.js`](file:///c:/Users/HP/Downloads/RentDirect/js/api.js):

| Method | Endpoint | Query / Body Params | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/auth/login` | `{ email, password, role }` | Sign in & return user session |
| **POST** | `/api/auth/logout` | — | Sign out |
| **POST** | `/api/auth/send-otp` | `{ email, role }` | Send 6-digit OTP (Demo: `123456`) |
| **POST** | `/api/auth/verify-otp` | `{ email, otp }` | Verify OTP |
| **GET** | `/api/properties` | `?college=...&gender=...&maxPrice=...&search=...` | List student accommodations |
| **GET** | `/api/properties/<id>` | — | Single property profile |
| **POST** | `/api/properties` | `{ title, collegeId, distanceToCollege, address, price, ... }` | Owner lists PG (starts unverified) |
| **GET** | `/api/admin/notifications` | — | **Backend Team Only:** Pending verification queue |
| **POST** | `/api/admin/properties/<id>/schedule-inspection` | `{ startDate, endDate, notes }` | **Backend Team Only:** Send inspection date range |
| **POST** | `/api/admin/properties/<id>/verify` | `{ approved: true, checklist: [...] }` | **Backend Team Only:** Final facility approval |
| **POST** | `/api/admin/properties/<id>/review-status` | `{ adminEmail, reviewStatus }` | **Backend Team Only:** Set Reviewed, Pending, or Unverified |
| **POST** | `/api/inquiries` | `{ propertyId, propertyTitle, ownerEmail, studentEmail, name, phone, college, date }` | Save a room-visit inquiry |
| **GET** | `/api/owner/inquiries?email=...` | Owner email | List inquiries for that PG Owner |
| **POST** | `/api/owner/inquiries/<id>/status` | `{ ownerEmail, status }` | Approve a visit, then confirm move-in |
| **GET** | `/api/admin/database/inspector` | — | Student, owner, and inquiry records for the Live Database Inspector |
| **DELETE** | `/api/admin/database/<collection>/<id>` | — | Delete one student, owner, or inquiry record |
| **DELETE** | `/api/admin/database/test-data` | — | Clear student, owner, and inquiry records |

---

The Live Database Inspector refreshes from the backend when available and mirrors these records to `rentdirect_students`, `rentdirect_owners`, and `rentdirect_inquiries` in `localStorage`. Student visit requests are saved to both stores, appear in the inspector automatically, and are shown to the matching owner. Owners can advance inquiry status from **Awaiting response** to **Visit approved**, then **Move-in confirmed**. Inspector row-level Delete and Reset actions update both stores when the backend is reachable; Reset preserves accounts and property listings.

## 💸 True-Cost View

Property cards and detail pages show the monthly Base Rent, Mess (₹2,500), and Maintenance (₹500) alongside estimated utilities. Fixed charges use **[CONFIRMED]** for reviewed listings and **[OWNER STATED]** until review. The detail-page calculator estimates appliance usage (AC ₹1,400, geyser ₹350, cooler ₹250 per month) and commute (Walk ₹0 or Auto / Metro ₹1,800 per month); actual bills and travel costs may vary. Upfront move-in cash is calculated as one month of base rent + security deposit + ₹0 brokerage.

## 📁 Project Structure

| File | Purpose |
| :--- | :--- |
| [`app.py`](file:///c:/Users/HP/Downloads/RentDirect/app.py) | Complete Python Flask REST API server with RBAC and inspection scheduling |
| [`index.html`](file:///c:/Users/HP/Downloads/RentDirect/index.html) | Homepage with hero search, Faridabad region colleges, and live stay cards |
| [`listings.html`](file:///c:/Users/HP/Downloads/RentDirect/listings.html) | Interactive accommodation directory with dynamic filters (college, budget, gender, amenities) |
| [`property-details.html`](file:///c:/Users/HP/Downloads/RentDirect/property-details.html) | Full property profile, inspection status banner, amenities, and owner contact |
| [`student-register.html`](file:///c:/Users/HP/Downloads/RentDirect/student-register.html) | 5-step student registration wizard with OTP verification |
| [`owner-register.html`](file:///c:/Users/HP/Downloads/RentDirect/owner-register.html) | 5-step PG Owner onboarding wizard (submits into verification queue) |
| [`css/style.css`](file:///c:/Users/HP/Downloads/RentDirect/css/style.css) | Responsive design system, login modal, inspection UI, 3 brand colours |
| [`js/config.js`](file:///c:/Users/HP/Downloads/RentDirect/js/config.js) | Flask API URL configuration & Faridabad colleges master list |
| [`js/mock-data.js`](file:///c:/Users/HP/Downloads/RentDirect/js/mock-data.js) | Realistic student PGs near Manav Rachna (Sector 43), JC Bose YMCA, Lingaya's |
| [`js/api.js`](file:///c:/Users/HP/Downloads/RentDirect/js/api.js) | Centralized REST API service with auth, role checks, and inspection methods |
| [`js/app.js`](file:///c:/Users/HP/Downloads/RentDirect/js/app.js) | UI helpers, universal Login/Logout modal, Backend Team verification center |
