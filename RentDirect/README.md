# RentDirect - Frontend Documentation

RentDirect is a responsive student accommodation marketplace connecting college students with verified PG owners in Faridabad (with special focus on **Manav Rachna**, **JC Bose YMCA**, and **Lingaya's**).

---

## 🚀 How to Run the Website (Quick Start)

Because this frontend uses modern zero-build HTML5, CSS3, and ES6 JavaScript, you do **not** need to install npm packages or run complex build commands.

### Option 1: Direct in Browser
Simply double-click `index.html` to open it in any browser (Chrome, Edge, Firefox, Safari).

### Option 2: Local HTTP Server (Recommended for testing)
Run this command from inside the `RentDirect` folder:
```bash
python -m http.server 8000
```
Then visit: [http://localhost:8000](http://localhost:8000)

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

To re-theme the entire platform (buttons, tags, badges, gradients, navigation, footers), simply change those 3 hex values.

---

## 🔗 Python Flask REST API Integration (For Your Teammate)

All API communication is centralized in [`js/api.js`](file:///c:/Users/HP/Downloads/RentDirect/js/api.js) and configured in [`js/config.js`](file:///c:/Users/HP/Downloads/RentDirect/js/config.js).

### 1. Toggle Mock vs Live Flask API
In [`js/config.js`](file:///c:/Users/HP/Downloads/RentDirect/js/config.js):
```javascript
const CONFIG = {
  USE_MOCK_DATA: false, // Set to false when your teammate's Flask API is ready!
  API_BASE_URL: 'http://127.0.0.1:5000/api',
  ...
};
```
*(When `USE_MOCK_DATA: true`, the website uses local mock data and saves new listings to browser storage so you can demo offline anytime).*

### 2. Flask REST Endpoints Contract

Your teammate's Flask backend should provide these standard endpoints (make sure to install and enable `flask-cors` on Flask):

| Method | Endpoint | Query / Body Params | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/properties` | `?college=mriirs&gender=boys&maxPrice=10000&search=...` | Return array of property listings |
| **GET** | `/api/properties/<id>` | — | Return single property object |
| **POST** | `/api/students/register` | JSON: `{ name, email, phone, gender, collegeId, course, year, roomSharing, budget, amenities, emailVerified }` | Register student profile |
| **POST** | `/api/owners/register` | JSON: `{ name, phone, email }` | Register PG owner |
| **POST** | `/api/properties` | JSON: `{ title, collegeId, distanceToCollege, address, gender, price, roomTypes, amenities, rules, description, images, owner }` | Add new PG listing |
| **POST** | `/api/auth/send-otp` | JSON: `{ email, role }` | Send 6-digit OTP to student/owner |
| **POST** | `/api/auth/verify-otp` | JSON: `{ email, otp }` | Verify OTP code |
| **POST** | `/api/inquiries` | JSON: `{ propertyTitle, name, phone, college, date }` | Submit visit request |
| **GET** | `/api/admin/notifications` | — | Get pending verification queue notifications |
| **POST** | `/api/admin/properties/<id>/verify` | JSON: `{ approved: true }` | Approve or reject owner property verification |

> [!IMPORTANT]
> **Owner Property Verification Pipeline:** When an owner lists a property, it enters the backend queue with `verified: false` and `verificationStatus: 'pending'`. The platform dispatches an admin notification to review the listing. Only when an admin/teammate approves it does `verified` become `true` and the property receive the green Verified badge.

> [!NOTE]
> **Zero URL Scattering:** All endpoint strings, HTTP methods, headers, and `fetch()` logic live exclusively inside [`js/api.js`](file:///c:/Users/HP/Downloads/RentDirect/js/api.js). The HTML pages only call clean helper methods like `RentDirectAPI.getProperties()`, `RentDirectAPI.sendOtp()`, or `RentDirectAPI.createProperty()`.

### Quick Flask CORS snippet for your teammate:
```python
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app) # Allow frontend to call Flask without browser CORS errors
```

---

## 📁 Project Structure

| File | Purpose |
| :--- | :--- |
| [`index.html`](file:///c:/Users/HP/Downloads/RentDirect/index.html) | Homepage with hero search, college cards, featured stays, and dual student/owner sections |
| [`listings.html`](file:///c:/Users/HP/Downloads/RentDirect/listings.html) | Interactive accommodation directory with dynamic filters (college, budget, gender, amenities) |
| [`property-details.html`](file:///c:/Users/HP/Downloads/RentDirect/property-details.html) | Full property profile, image gallery, specs, amenities, direct owner contact & visit booking |
| [`student-register.html`](file:///c:/Users/HP/Downloads/RentDirect/student-register.html) | Student registration, college verification, and room preference form |
| [`owner-register.html`](file:///c:/Users/HP/Downloads/RentDirect/owner-register.html) | PG Owner registration and "List Your Property" 4-step onboarding form |
| [`css/style.css`](file:///c:/Users/HP/Downloads/RentDirect/css/style.css) | Responsive design system with 3 configurable brand colours |
| [`js/config.js`](file:///c:/Users/HP/Downloads/RentDirect/js/config.js) | Flask API URL configuration & Faridabad colleges master list |
| [`js/mock-data.js`](file:///c:/Users/HP/Downloads/RentDirect/js/mock-data.js) | Realistic student PGs near Manav Rachna (Sector 43), JC Bose YMCA, Lingaya's, etc. |
| [`js/api.js`](file:///c:/Users/HP/Downloads/RentDirect/js/api.js) | REST API client service ready for Flask |
| [`js/app.js`](file:///c:/Users/HP/Downloads/RentDirect/js/app.js) | UI helpers, mobile navigation toggle, property card generator, and alerts |
