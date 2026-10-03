# Civic Connect — Civic Road Problem Reporting Platform

> A civic-tech web application empowering citizens to report road and infrastructure hazards (potholes, open drains, non-functional streetlights, garbage dumps) directly to local ward authorities and track repairs in real time.

---

## 🤖 Stage 10: Google Gemini AI + Google Maps + Duplicate Detection + Priority System

In Stage 10, Civic Connect incorporates artificial intelligence and mapping technologies:
- **Google Gemini API (`@google/genai`)**: Server-side multimodal AI analyzes danger severity and performs semantic duplicate comparison. The AI key is strictly kept on the backend.
- **Google Maps Platform**: Interactive map picker, "Use My Current Location", reverse-geocoding, and interactive markers color-coded and labeled by priority level (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
- **Smart Duplicate Prevention**: Multi-stage pipeline (Category + Haversine GPS Distance <= 100m + Unresolved Status -> Gemini Semantic Comparison). If confidence >= 80%, increments `reportCount`, tracks unique citizen reporter, dynamically recalculates priority, and returns a duplicate notice instead of creating a clutter ticket.
- **Community Endorsement Voting**: Authenticated citizens can vote/endorse complaints once (`POST /api/complaints/:id/vote`).
- **Civic Connect Priority Engine**: Transparent, dynamic formula:
  $$\text{Final Priority} = (\text{Danger Score} \times 0.60) + (\text{Community Score} \times 0.40)$$
  where $\text{Community Score} = (\text{Report Score} \times 0.60) + (\text{Vote Score} \times 0.40)$.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 STAGE 10 PIPELINE                                       │
│                                                                                         │
│  [New Report Submission] ──> [1. DB Proximity Filter] ──> [2. Gemini Semantic Match]   │
│                                 - Same Category              - AI Confidence >= 80%?    │
│                                 - Haversine <= 100m          - Matched Complaint ID     │
│                                 - Active Status                                         │
│                                        │                                │               │
│                                     (No Match)                     (Duplicate)          │
│                                        │                                │               │
│                                        ▼                                ▼               │
│                            [3. Gemini Danger Analysis]       [Increment reportCount]    │
│                                 - Danger Level (0-100)       - Add user to reporters    │
│                                 - Justification reason       - Recalculate priority     │
│                                        │                                │               │
│                                        ▼                                ▼               │
│                            [Calculate Final Priority]        [Return Duplicate Notice]  │
│                                 - Danger 60% + Comm 40%                                 │
│                                 - Save to MongoDB                                       │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏛️ Stage 9: Authentication & Role-Based Authorization (RBAC)

In this stage, Civic Connect implements production-grade authentication and authorization:
- **bcryptjs**: Salted password hashing (plain-text passwords never stored).
- **jsonwebtoken (JWT)**: Cryptographically signed tokens stored in secure, **HTTP-only cookies**.
- **Role-Based Access Control**: Citizen (`user`) vs Municipal Officer (`admin`).
- **Protected Actions**: Citizen problem submissions, personal complaint feeds, and admin resolution workflows.

```
┌─────────────────┐    POST /api/auth/login     ┌────────────────────────┐
│  Browser Client │ ──────────────────────────> │  Express.js Server     │
│  (HTML/CSS/JS)  │                             │  (bcrypt.compare)      │
│                 │ <────────────────────────── │                        │
└────────┬────────┘    Set-Cookie: token (HTTP) └───────────┬────────────┘
         │                                                  │
         │  Credentials: "include"                          ▼
         │  (GET /api/complaints/mine)          ┌────────────────────────┐
         └────────────────────────────────────> │ authMiddleware.protect │
                                                │ (Loads req.user via DB)│
                                                └───────────┬────────────┘
                                                            │
                                                ┌───────────┴────────────┐
                                                ▼                        ▼
                                    ┌──────────────────────┐ ┌──────────────────────┐
                                    │ User Feed / Report   │ │ requireRole('admin') │
                                    │ (role: "user")       │ │ (PATCH /status only) │
                                    └──────────────────────┘ └──────────────────────┘
```

---

## 📁 Project Directory Structure

```
civic-connect/
│
├── index.html                   # Citizen Homepage
├── signup.html                  # Citizen Registration
├── login.html                   # Citizen / Admin Login
├── report-problem.html          # Hazard Reporting Form (GPS + Leaflet map)
├── view-complaints.html         # Public Complaints Explorer (MongoDB Connected)
├── dashboard.html               # Personal Citizen Dashboard & Rewards
├── admin-dashboard.html         # Municipal Admin Console (MongoDB Connected)
├── api-test.html                # Interactive API Endpoint Tester
│
├── style.css                    # Base Design Tokens & Global Styles
├── view-complaints.css          # Badges & Explorer Layout
├── dashboard.css                # User Dashboard & Rewards Layout
├── admin-dashboard.css          # Admin Management & Table Layout
│
├── script.js                    # Universal Navigation & Mobile Menu Controller
├── report-problem.js            # Problem Reporting Form (POST /api/complaints)
├── view-complaints.js           # Explorer Controller (GET & Support API)
├── dashboard.js                 # User Dashboard Controller
├── admin-dashboard.js           # Admin Console (PATCH Status & Verification)
│
├── backend/                     # Node.js & Express REST Backend
│   ├── server.js                # Express App, Middleware & Route Mounting
│   ├── package.json             # Backend Dependencies & Scripts
│   ├── config/
│   │   └── db.js                # Mongoose & MongoDB Atlas Connection
│   ├── middleware/
│   │   └── authMiddleware.js    # protect & requireRole Gatekeepers
│   ├── models/
│   │   ├── User.js              # User Schema (bcrypt hash & roles)
│   │   └── Complaint.js         # Complaint Schema & User Associations
│   ├── routes/
│   │   ├── authRoutes.js        # Register, Login, Logout, /me
│   │   └── complaintRoutes.js   # Public Explorer, /mine, & Admin Routes
│   ├── controllers/
│   │   ├── authController.js    # JWT, Cookies, & Password Verification
│   │   └── complaintController.js # CRUD & Community Endorsement Logic
│   └── scripts/
│       └── createAdmin.js       # Safe CLI Seed Script for Administrator
│
├── .env                         # Private Environment Config (Ignored by Git)
├── .env.example                 # Public Environment Template
├── .gitignore                   # Git Ignore File (node_modules, .env)
├── package.json                 # Root Project Package Configuration
└── README.md                    # Project & Authentication Documentation
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
Ensure Node.js (v18+) is installed on your machine:
```bash
node -v
npm -v
```

### 2. Install Dependencies
Run the install command from the project root:
```bash
npm install
```

### 3. Start the Express Backend Server
```bash
npm start
```
The server will start on port `5000`:
* **Base API:** [http://localhost:5000/api](http://localhost:5000/api)
* **Health Check:** [http://localhost:5000/api/health](http://localhost:5000/api/health)
* **Complaints API:** [http://localhost:5000/api/complaints](http://localhost:5000/api/complaints)
* **Interactive API Tester:** [http://localhost:5000/api-test.html](http://localhost:5000/api-test.html)
* **View Complaints (Live API):** [http://localhost:5000/view-complaints.html](http://localhost:5000/view-complaints.html)
* **Full Website:** [http://localhost:5000/](http://localhost:5000/)

---

## 📡 REST API Documentation

### 1. Root API Info
* **Method:** `GET`
* **URL:** `/api`
* **Purpose:** Basic heartbeat to confirm the Civic Connect REST API is running.
* **Request Body:** None
* **Status Codes:** `200 OK`
* **Example Response:**
```json
{
  "message": "Civic Connect API is running",
  "version": "1.0.0",
  "endpoints": {
    "health": "/api/health",
    "complaints": "/api/complaints"
  }
}
```

---

### 2. Server Health Check
* **Method:** `GET`
* **URL:** `/api/health`
* **Purpose:** Monitor server health, uptime, and system status.
* **Request Body:** None
* **Status Codes:** `200 OK`
* **Example Response:**
```json
{
  "status": "success",
  "message": "Civic Connect server is healthy",
  "uptimeSeconds": 42,
  "timestamp": "2026-10-03T08:02:07.007Z"
}
```

---

### 3. Get All Complaints
* **Method:** `GET`
* **URL:** `/api/complaints`
* **Optional Query Parameters:**
  * `?category=Road/Pothole`
  * `?status=In Progress`
* **Purpose:** Retrieve all citizen-reported civic hazards.
* **Request Body:** None
* **Status Codes:** `200 OK`, `500 Internal Server Error`
* **Example Response:**
```json
{
  "success": true,
  "count": 8,
  "data": [
    {
      "id": "CC-1001",
      "title": "Large pothole cluster near main road",
      "category": "Road/Pothole",
      "description": "Deep asphalt erosion causing severe traffic congestion near Metro Pillar 42.",
      "location": "Gorakhpur, Uttar Pradesh",
      "date": "28 Sep 2026",
      "severity": "High",
      "status": "Under Verification",
      "verification": "Pending",
      "reportedBy": "Civic User",
      "image": "https://images.unsplash.com/...",
      "supporters": 14,
      "resolvedDate": "",
      "resolvedBy": "",
      "resolutionNote": ""
    }
  ]
}
```

---

### 4. Get Single Complaint by ID
* **Method:** `GET`
* **URL:** `/api/complaints/:id` (e.g., `/api/complaints/CC-1001`)
* **Purpose:** Retrieve full details for a specific complaint ticket.
* **Request Body:** None
* **Status Codes:**
  * `200 OK`: Ticket found
  * `404 Not Found`: No ticket matches ID
* **Example Success Response:**
```json
{
  "success": true,
  "data": {
    "id": "CC-1001",
    "title": "Large pothole cluster near main road",
    "category": "Road/Pothole",
    "status": "Under Verification",
    "supporters": 14
  }
}
```
* **Example 404 Response:**
```json
{
  "success": false,
  "message": "Complaint not found"
}
```

---

### 5. Create New Complaint
* **Method:** `POST`
* **URL:** `/api/complaints`
* **Purpose:** Submit a new civic problem report.
* **Headers:** `Content-Type: application/json`
* **Required Fields:** `title`, `category`, `description`, `location`, `severity`
* **Optional Fields:** `reportedBy`, `image`
* **Status Codes:**
  * `201 Created`: Successfully registered
  * `400 Bad Request`: Missing one or more required fields
* **Example Request Body:**
```json
{
  "title": "Broken street light near ward hospital",
  "category": "Street Light",
  "description": "Street light pole damaged during rain storm, wires hanging loose.",
  "location": "Gorakhpur Ward 12",
  "severity": "Medium",
  "reportedBy": "Civic User"
}
```
* **Example 201 Response:**
```json
{
  "success": true,
  "message": "Complaint registered successfully",
  "data": {
    "id": "CC-1009",
    "title": "Broken street light near ward hospital",
    "category": "Street Light",
    "status": "Reported",
    "verification": "Pending",
    "supporters": 0,
    "date": "03 Oct 2026"
  }
}
```
* **Example 400 Response:**
```json
{
  "success": false,
  "message": "Missing required fields: title, category, description, location, severity"
}
```

---

### 6. Update Complaint Status
* **Method:** `PATCH`
* **URL:** `/api/complaints/:id/status` (e.g., `/api/complaints/CC-1001/status`)
* **Purpose:** Update the resolution lifecycle status of a complaint.
* **Headers:** `Content-Type: application/json`
* **Allowed Statuses:** `Reported`, `Under Verification`, `In Progress`, `Resolved`, `Rejected`
* **Optional Fields:** `resolvedNote`, `resolvedBy`
* **Status Codes:**
  * `200 OK`: Status updated successfully
  * `400 Bad Request`: Invalid status value
  * `404 Not Found`: Complaint ID not found
* **Example Request Body:**
```json
{
  "status": "In Progress"
}
```
* **Example 200 Response:**
```json
{
  "success": true,
  "message": "Complaint CC-1001 status updated to In Progress",
  "data": {
    "id": "CC-1001",
    "status": "In Progress",
    "verification": "Verified"
  }
}
```

---

### 7. Support / Upvote a Complaint
* **Method:** `POST`
* **URL:** `/api/complaints/:id/support` (e.g., `/api/complaints/CC-1001/support`)
* **Purpose:** Add citizen endorsement to prioritize repair work.
* **Request Body:** None
* **Status Codes:**
  * `200 OK`: Upvote registered
  * `404 Not Found`: Complaint ID not found
* **Example 200 Response:**
```json
{
  "success": true,
  "message": "Upvoted complaint CC-1001. Total supporters: 15",
  "data": {
    "id": "CC-1001",
    "supporters": 15
  }
}
```

---

### 8. Unknown API Route Fallback
* **Method:** Any HTTP Method (`GET`, `POST`, `PUT`, `DELETE`)
* **URL:** `/api/non-existent-route`
* **Status Code:** `404 Not Found`
* **Response:**
```json
{
  "success": false,
  "message": "API route not found"
}
```

---

## 🧪 Testing the API

### Method A: Interactive Web Tester (Easiest)
Open [http://localhost:5000/api-test.html](http://localhost:5000/api-test.html) in any browser. It provides one-click test buttons for all endpoints with live JSON response inspectors.

### Method B: Terminal curl Commands
```bash
# 1. Health check
curl -i http://localhost:5000/api/health

# 2. Get all complaints
curl -i http://localhost:5000/api/complaints

# 3. Get single ticket
curl -i http://localhost:5000/api/complaints/CC-1001

# 4. Upvote a ticket
curl -i -X POST http://localhost:5000/api/complaints/CC-1001/support

# 5. Test 404 handler
curl -i http://localhost:5000/api/unknown-endpoint
```
