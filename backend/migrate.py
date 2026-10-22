import sqlite3
import os
import sys

# Ensure backend package can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config import Config
from backend.auth import hash_password
from backend.ist_utils import now_ist, today_ist_str, calculate_working_minutes
from datetime import timedelta

VALID_DEPARTMENTS = ['interns', 'ai_ml_frontend', 'backend']
DEPT_LABELS = {
    'interns': 'Interns',
    'ai_ml_frontend': 'AI/ML, Frontend Engineer',
    'backend': 'Backend Engineer'
}

def migrate_database():
    db_path = Config.DATABASE_PATH
    print(f"Connecting to database: {db_path}")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = OFF;")
    cursor = conn.cursor()

    # 1. Update Manager Name to "Mahesh Kumar"
    cursor.execute("SELECT id, name, email FROM managers WHERE email = 'manager@company.com' OR id = 1")
    mgr = cursor.fetchone()
    now_str = now_ist().isoformat()
    if mgr:
        cursor.execute("UPDATE managers SET name = 'Mahesh Kumar' WHERE id = ?", (mgr['id'],))
        manager_id = mgr['id']
        print(f"Updated manager ID {manager_id} name to 'Mahesh Kumar'.")
    else:
        cursor.execute("""
            INSERT INTO managers (name, email, password_hash, created_at)
            VALUES (?, ?, ?, ?)
        """, ('Mahesh Kumar', 'manager@company.com', hash_password('admin123'), now_str))
        manager_id = cursor.lastrowid
        print(f"Created manager 'Mahesh Kumar' with ID {manager_id}.")

    # 2. Check for old demo workers and remove them
    old_demo_names = [
        'Aarav Patel', 'Priya Verma', 'Rahul Nair', 'Vikram Singh',
        'Ananya Iyer', 'Suresh Reddy', 'Sneha Gupta', 'Rohan Mehta',
        'Kavita Joshi', 'Amit Kumar', 'Sunil Chauhan', 'Devendra Sharma'
    ]
    cursor.execute(f"SELECT id FROM workers WHERE full_name IN ({','.join(['?']*len(old_demo_names))})", old_demo_names)
    demo_worker_ids = [row['id'] for row in cursor.fetchall()]
    
    if demo_worker_ids:
        print(f"Removing {len(demo_worker_ids)} demo workers and their associated attendance records...")
        # Remove demo attendance and audit logs
        cursor.execute(f"DELETE FROM attendance_audit_logs WHERE attendance_id IN (SELECT id FROM attendance WHERE worker_id IN ({','.join(['?']*len(demo_worker_ids))}))", demo_worker_ids)
        cursor.execute(f"DELETE FROM attendance WHERE worker_id IN ({','.join(['?']*len(demo_worker_ids))})", demo_worker_ids)
        cursor.execute(f"DELETE FROM workers WHERE id IN ({','.join(['?']*len(demo_worker_ids))})", demo_worker_ids)

    # 3. Create or Update workers table schema with CHECK(department IN ('interns', 'ai_ml_frontend', 'backend'))
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS workers_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_code TEXT UNIQUE,
            full_name TEXT NOT NULL,
            department TEXT NOT NULL CHECK(department IN ('interns', 'ai_ml_frontend', 'backend')),
            phone TEXT,
            joining_date TEXT NOT NULL,
            employment_status TEXT NOT NULL DEFAULT 'Active' CHECK(employment_status IN ('Active', 'Inactive')),
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
    """)

    # Copy any non-demo workers into workers_new if any exist
    cursor.execute("SELECT * FROM workers")
    existing_workers = cursor.fetchall()
    for w in existing_workers:
        dept = w['department']
        # Map old dept names if needed
        if dept not in VALID_DEPARTMENTS:
            if 'intern' in dept.lower():
                dept = 'interns'
            elif 'ai' in dept.lower() or 'front' in dept.lower():
                dept = 'ai_ml_frontend'
            else:
                dept = 'backend'
        cursor.execute("""
            INSERT OR IGNORE INTO workers_new (id, employee_code, full_name, department, phone, joining_date, employment_status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (w['id'], w['employee_code'], w['full_name'], dept, w['phone'], w['joining_date'], w['employment_status'], w['created_at'], w['updated_at']))

    cursor.execute("DROP TABLE workers;")
    cursor.execute("ALTER TABLE workers_new RENAME TO workers;")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_workers_status ON workers(employment_status);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_workers_dept ON workers(department);")

    # 4. Insert Initial Persistent Employees (Requirement 4)
    initial_employees = [
        # Department 1: Interns
        ('EMP-1001', 'Harikaran', 'interns', '+91 98765 10001', '2026-10-01', 'Active'),
        ('EMP-1002', 'Sahithyashwari', 'interns', '+91 98765 10002', '2026-10-01', 'Active'),
        ('EMP-1003', 'Ranjith', 'interns', '+91 98765 10003', '2026-10-01', 'Active'),
        # Department 2: AI/ML, Frontend Engineer
        ('EMP-1004', 'Lingesh', 'ai_ml_frontend', '+91 98765 10004', '2026-09-15', 'Active'),
        # Department 3: Backend Engineer
        ('EMP-1005', 'Santhosh', 'backend', '+91 98765 10005', '2026-09-01', 'Active'),
    ]

    emp_ids = {}
    for code, name, dept, phone, join_date, status in initial_employees:
        cursor.execute("SELECT id FROM workers WHERE full_name = ? OR employee_code = ?", (name, code))
        row = cursor.fetchone()
        if not row:
            cursor.execute("""
                INSERT INTO workers (employee_code, full_name, department, phone, joining_date, employment_status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (code, name, dept, phone, join_date, status, now_str, now_str))
            emp_ids[name] = cursor.lastrowid
            print(f"Added persistent employee: {name} ({dept}) with ID WKR-{cursor.lastrowid:04d}")
        else:
            # Update to ensure correct department and active status
            cursor.execute("""
                UPDATE workers SET department = ?, employment_status = ? WHERE id = ?
            """, (dept, status, row['id']))
            emp_ids[name] = row['id']
            print(f"Verified existing employee: {name} (ID: {row['id']})")

    # 5. Seed Realistic Attendance for Past 5 Days and Today
    today_dt = now_ist()
    for day_offset in range(4, -1, -1):
        target_dt = today_dt - timedelta(days=day_offset)
        date_str = target_dt.strftime('%Y-%m-%d')

        # Skip weekend
        if target_dt.weekday() >= 5:
            continue

        for idx, (name, wid) in enumerate(emp_ids.items()):
            cursor.execute("SELECT id FROM attendance WHERE worker_id = ? AND attendance_date = ?", (wid, date_str))
            if cursor.fetchone():
                continue

            if day_offset > 0:
                # Historical completed shifts
                in_time = target_dt.replace(hour=9, minute=15 + (idx * 3), second=0, microsecond=0)
                out_time = target_dt.replace(hour=17, minute=(30 + (idx * 5)) % 60, second=0, microsecond=0)
                mins = calculate_working_minutes(in_time.isoformat(), out_time.isoformat())
                cursor.execute("""
                    INSERT INTO attendance (worker_id, attendance_date, time_in, time_out, total_working_minutes, status, created_at, updated_at, created_by_manager_id, updated_by_manager_id)
                    VALUES (?, ?, ?, ?, ?, 'PRESENT', ?, ?, ?, ?)
                """, (wid, date_str, in_time.isoformat(), out_time.isoformat(), mins, in_time.isoformat(), out_time.isoformat(), manager_id, manager_id))
            else:
                # Today: realistic mix
                if name in ['Harikaran', 'Lingesh']:
                    # Completed shift
                    in_time = target_dt.replace(hour=9, minute=0, second=0, microsecond=0)
                    out_time = target_dt.replace(hour=17, minute=15, second=0, microsecond=0)
                    mins = calculate_working_minutes(in_time.isoformat(), out_time.isoformat())
                    cursor.execute("""
                        INSERT INTO attendance (worker_id, attendance_date, time_in, time_out, total_working_minutes, status, created_at, updated_at, created_by_manager_id, updated_by_manager_id)
                        VALUES (?, ?, ?, ?, ?, 'PRESENT', ?, ?, ?, ?)
                    """, (wid, date_str, in_time.isoformat(), out_time.isoformat(), mins, in_time.isoformat(), out_time.isoformat(), manager_id, manager_id))
                elif name in ['Sahithyashwari', 'Santhosh']:
                    # Currently working
                    in_time = target_dt.replace(hour=9, minute=20, second=0, microsecond=0)
                    cursor.execute("""
                        INSERT INTO attendance (worker_id, attendance_date, time_in, time_out, total_working_minutes, status, created_at, updated_at, created_by_manager_id, updated_by_manager_id)
                        VALUES (?, ?, ?, NULL, NULL, 'PRESENT', ?, ?, ?, ?)
                    """, (wid, date_str, in_time.isoformat(), in_time.isoformat(), in_time.isoformat(), manager_id, manager_id))
                elif name == 'Ranjith':
                    # Not checked in yet today (pending arrival)
                    pass

    conn.commit()
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.close()
    print("Migration completed successfully!")

if __name__ == '__main__':
    migrate_database()
