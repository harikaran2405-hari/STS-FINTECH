# STS Fintech - Company Attendance Management System

A full-stack, production-grade **Company Attendance Management System** for **STS Fintech**, built with **React.js + Vite + Tailwind CSS** on the frontend, and **Python Flask + SQLite (PostgreSQL-ready)** on the backend. Designed specifically for company manager **Mahesh Kumar** to manage workforce departments, record daily attendance in Indian Standard Time (IST), execute authorized manual corrections with audit logging, and generate attendance reports with CSV export.

---

## 🌟 Key Features

### 1. STS Fintech Manager Authentication
- **Manager Account:** Mahesh Kumar (`manager@stsfintech.com`).
- **Secure Password Hashing:** Powered by PBKDF2:SHA256 (`werkzeug.security`).
- **Token-based JWT Authentication:** Session protection with `@token_required` guards on all operational endpoints.
- **Role Isolation:** Worker records cannot access manager administrative endpoints.

### 2. Department-Based Organization
Organized into three dedicated company departments:
1. **Interns** (Initial: Harikaran, Sahithyashwari, Ranjith)
2. **AI/ML, Frontend Engineer** (Initial: Lingesh)
3. **Backend Engineer** (Initial: Santhosh)

Each department features:
- Dedicated employee roster and attendance table.
- Direct **+ Add Employee** modal with auto-selected department.
- Department-level real-time attendance status indicators.

### 3. Worker Lifecycle Management
- **Single-Registration Rule:** Register workers **only once when they join STS Fintech**. Worker records are reused across all daily attendance entries.
- **Unique Worker IDs & Employee Codes:** Automatic sequential formatted ID (`WKR-0001`, `WKR-0002`, etc.) and optional unique Employee Code (`EMP-1001`).
- **Deactivation & Historical Preservation:** Deactivating a worker preserves all past attendance and audit logs permanently.
- **Reactivation:** Seamlessly reactivate previously deactivated workers if they return.

### 4. Server-Authoritative Daily Attendance in IST
- **Indian Standard Time (IST - UTC+05:30):** All timestamps are computed and enforced on the Python backend using server time. The frontend cannot spoof or fabricate official arrival or departure times.
- **Check-In Workflow:** 1-click Check In captures the server IST timestamp and initiates the worker's shift. Duplicate check-ins during an active shift are blocked.
- **Check-Out Workflow:** 1-click Check Out records the departure timestamp, computes total working duration in minutes and human-readable format (`8h 15m`).
- **Authorized Manual Corrections with Mandatory Audit Trail:** Authorized manager corrections require a mandatory reason and log to `attendance_audit_logs`.

### 5. Manager Dashboard & Analytics
- 6 High-impact summary KPI cards: Total Active Workers, Checked In Today, Currently Working, Checked Out Today, Pending/Absent, and Attendance Rate.
- Department Attendance Breakdown with progress meters.
- Date switcher to inspect historical days or jump back to today.

### 6. Attendance Reports & CSV Export
- Multi-dimensional filtering: Date range (From / To), Department, Worker, and Attendance Status.
- Quick Presets: Today, Last 7 Days, Last 30 Days.
- Aggregated metrics and 1-click download of clean `.csv` reports for payroll and compliance.

---

## 🏗️ Technology Stack

| Component | Technology | Description |
|-----------|------------|-------------|
| **Frontend** | React 18, Vite 5 | Fast, responsive modern SPA |
| **Styling** | Tailwind CSS 3.4, Lucide Icons | Clean corporate STS Fintech branding |
| **Backend** | Python 3.11, Flask 3.1 | RESTful JSON APIs, Blueprint modular architecture |
| **Database** | SQLite 3 / PostgreSQL | Normalized relational schema with foreign keys and indexes |
| **Auth** | PyJWT, Werkzeug Security | Stateless JWT bearer tokens with PBKDF2 password hashing |
| **Timezone** | `pytz`, `python-dateutil` | Authoritative Indian Standard Time (IST - UTC+05:30) |
| **Production Server** | Gunicorn | High-performance WSGI production HTTP server |

---

## 🔐 Manager Credentials

- **Email:** `manager@stsfintech.com` (or `manager@company.com`)
- **Password:** `admin123`
*(A convenient "Fill Demo Credentials" button is provided directly on the login screen).*

---

## 🚀 Cloud Deployment Guide

The application is architected for unified single-origin deployment: the Flask backend automatically serves the compiled React frontend from `frontend/dist/` for all web routes, while handling `/api/*` endpoints.

### Option 1: Deploy to Render (Recommended - Free Tier Available)

1. **Push your code to GitHub:**
   ```bash
   # Create a new repository on https://github.com/new
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```

2. **Deploy on Render:**
   - Log into [Render.com](https://render.com).
   - Click **New +** &rarr; **Web Service**.
   - Connect your GitHub repository.
   - Configure the service:
     - **Name:** `sts-fintech-attendance`
     - **Runtime:** `Python 3`
     - **Build Command:**
       ```bash
       cd frontend && npm install && npm run build && cd .. && pip install -r requirements.txt
       ```
     - **Start Command:**
       ```bash
       gunicorn backend.app:app
       ```
   - **Environment Variables:**
     - `SECRET_KEY`: *(Generate a secure random string)*
     - `PYTHON_VERSION`: `3.11.0`
   - Click **Create Web Service**.
   - Render will build the Vite frontend, install Python dependencies, and launch Gunicorn. Your app will be live at `https://sts-fintech-attendance.onrender.com`.

*(Alternatively, connect the repository and Render will automatically detect `render.yaml` located in the root!)*

---

### Option 2: Deploy to Railway

1. Push your repository to GitHub.
2. Go to [Railway.app](https://railway.app) and click **New Project** &rarr; **Deploy from GitHub repo**.
3. Select this repository.
4. Railway will automatically detect the `Procfile` (`web: gunicorn backend.app:app`) and build command, or you can set:
   - **Build Command:** `cd frontend && npm install && npm run build && cd .. && pip install -r requirements.txt`
   - **Start Command:** `gunicorn backend.app:app`
5. In **Variables**, add:
   - `SECRET_KEY`: `your-secure-random-secret`
6. Click **Generate Domain** in the project settings to get your live public URL.

---

### Option 3: Deploy with Docker (Any Cloud VPS / AWS EC2 / DigitalOcean)

The project includes a multi-stage production `Dockerfile` and `docker-compose.yml`.

1. **Build and start the container:**
   ```bash
   docker compose up -d --build
   ```
2. The application will be running on port `5000` (or the port specified in `.env`):
   - Access at `http://your-server-ip:5000`
3. Attendance data persists automatically inside `./backend/attendance.db` via the volume mount.

---

## 💻 Local Development & Testing

### 1. Start the Flask Backend
```powershell
# From project root:
cd c:\Users\ADMIN\Desktop\sts

# Seed database with initial manager and department employees:
python -m backend.seed

# Start Flask API server:
python backend/app.py
```
*Backend runs on `http://127.0.0.1:5000`.*

### 2. Start the Frontend Development Server
```powershell
# In a separate terminal:
cd c:\Users\ADMIN\Desktop\sts\frontend

# Start Vite dev server:
npm run dev
```
*Frontend runs on `http://localhost:5173` with automatic API proxy to port 5000.*

### 3. Run Backend Test Suite
```powershell
python -m backend.test_suite
```
*Executes all unit and integration tests covering auth, worker CRUD, department assignments, duplicate prevention, attendance guards, and audit logging.*
