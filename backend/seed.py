import os
import sys
import json
from datetime import datetime, timedelta
import pytz

# Allow running backend/seed.py directly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.db import init_db, get_db_connection
from backend.auth import hash_password
from backend.ist_utils import (
    now_ist, today_ist_str, IST_TZ, calculate_working_minutes
)

VALID_DEPARTMENTS = ['interns', 'ai_ml_frontend', 'backend']
DEPT_DISPLAY_NAMES = {
    'interns': 'Interns',
    'ai_ml_frontend': 'AI/ML, Frontend Engineer',
    'backend': 'Backend Engineer'
}

def seed_database():
    """Idempotent seed function. Safe to run multiple times."""
    init_db()

    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Seed or update Manager account: Mahesh Kumar
    cursor.execute("SELECT id FROM managers WHERE email IN ('manager@stsfintech.com', 'manager@company.com')")
    existing_mgr = cursor.fetchone()

    now_str = now_ist().isoformat()
    if not existing_mgr:
        print("Creating default manager account (Mahesh Kumar - manager@stsfintech.com / admin123)...")
        cursor.execute("""
            INSERT INTO managers (name, email, password_hash, created_at)
            VALUES (?, ?, ?, ?)
        """, (
            'Mahesh Kumar',
            'manager@stsfintech.com',
            hash_password('admin123'),
            now_str
        ))
        manager_id = cursor.lastrowid
    else:
        manager_id = existing_mgr['id']
        cursor.execute("UPDATE managers SET name = 'Mahesh Kumar', email = 'manager@stsfintech.com' WHERE id = ?", (manager_id,))
        print(f"Manager verified with ID {manager_id} (Mahesh Kumar).")

    # 2. Seed Initial Persistent Employees with STS Employee IDs
    initial_employees = [
        # Department: Backend Engineer
        ('26STS001', 'Santhosh', 'backend', '+91 98765 10001', '2026-09-01', 'Active', 'Senior Backend Engineer'),
        # Department: AI/ML, Frontend Engineer
        ('26STS002', 'Balaji Sai', 'ai_ml_frontend', '+91 98765 10002', '2026-09-15', 'Active', 'AI/ML & Frontend Engineer'),
        ('26STS006', 'Lingesh', 'ai_ml_frontend', '+91 98765 10006', '2026-09-15', 'Active', 'AI/ML & Frontend Engineer'),
        # Department: Interns
        ('26STS003', 'Harikaran', 'interns', '+91 98765 10003', '2026-10-01', 'Active', 'Software Intern'),
        ('26STS004', 'Sahithyashwari', 'interns', '+91 98765 10004', '2026-10-01', 'Active', 'Software Intern'),
        ('26STS005', 'Ranjith', 'interns', '+91 98765 10005', '2026-10-01', 'Active', 'Software Intern'),
    ]

    # Clean up test artifact workers if any
    cursor.execute("""
        DELETE FROM workers 
        WHERE full_name LIKE '%New Intern Candidate%' 
           OR full_name LIKE '%New Backend Developer%' 
           OR full_name LIKE '%Short Password%'
           OR full_name LIKE '%Invalid Dept%'
           OR employee_code LIKE 'EMP-TEST-%'
    """)

    emp_ids = {}
    for code, name, dept, phone, join_date, status, role in initial_employees:
        # Match by name, common alias, or code
        cursor.execute("""
            SELECT id FROM workers 
            WHERE full_name = ? 
               OR employee_code = ? 
               OR (full_name LIKE 'Hari%' AND ? = '26STS003')
               OR (full_name LIKE 'Sahithya%' AND ? = '26STS004')
        """, (name, code, code, code))
        row = cursor.fetchone()
        
        if not row:
            cursor.execute("""
                INSERT INTO workers (employee_code, full_name, department, phone, joining_date, employment_status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (code, name, dept, phone, join_date, status, now_str, now_str))
            emp_ids[name] = cursor.lastrowid
            print(f"Inserted employee {name} ({dept}) ID {code}")
        else:
            emp_ids[name] = row['id']
            cursor.execute("""
                UPDATE workers 
                SET employee_code = ?, full_name = ?, department = ?, employment_status = 'Active' 
                WHERE id = ?
            """, (code, name, dept, row['id']))
            print(f"Updated employee {name} ({dept}) with official code {code}")

    print(f"Verified initial employees. Total: {len(emp_ids)}")

    # 3. Seed initial attendance for past dates if not already present
    today_dt = now_ist()
    for day_offset in range(4, -1, -1):
        target_dt = today_dt - timedelta(days=day_offset)
        date_str = target_dt.strftime('%Y-%m-%d')

        # Skip weekend days for corporate calendar
        if target_dt.weekday() >= 5:
            continue

        for idx, (name, wid) in enumerate(emp_ids.items()):
            cursor.execute("SELECT id FROM attendance WHERE worker_id = ? AND attendance_date = ?", (wid, date_str))
            if cursor.fetchone():
                continue

            if day_offset > 0:
                in_time = target_dt.replace(hour=9, minute=10 + (idx * 3), second=0, microsecond=0)
                out_time = target_dt.replace(hour=17, minute=(30 + (idx * 5)) % 60, second=0, microsecond=0)
                mins = calculate_working_minutes(in_time.isoformat(), out_time.isoformat())
                cursor.execute("""
                    INSERT INTO attendance (
                        worker_id, attendance_date, time_in, time_out, total_working_minutes, 
                        status, created_at, updated_at, created_by_manager_id, updated_by_manager_id
                    ) VALUES (?, ?, ?, ?, ?, 'PRESENT', ?, ?, ?, ?)
                """, (
                    wid, date_str, in_time.isoformat(), out_time.isoformat(), 
                    mins, in_time.isoformat(), out_time.isoformat(), 
                    manager_id, manager_id
                ))
            else:
                # Today: mix of completed, in progress, and not checked in
                if name in ['Harikaran', 'Lingesh']:
                    in_time = target_dt.replace(hour=9, minute=0, second=0, microsecond=0)
                    out_time = target_dt.replace(hour=17, minute=15, second=0, microsecond=0)
                    mins = calculate_working_minutes(in_time.isoformat(), out_time.isoformat())
                    cursor.execute("""
                        INSERT INTO attendance (worker_id, attendance_date, time_in, time_out, total_working_minutes, status, created_at, updated_at, created_by_manager_id, updated_by_manager_id)
                        VALUES (?, ?, ?, ?, ?, 'PRESENT', ?, ?, ?, ?)
                    """, (wid, date_str, in_time.isoformat(), out_time.isoformat(), mins, in_time.isoformat(), out_time.isoformat(), manager_id, manager_id))
                elif name in ['Sahithyashwari', 'Santhosh']:
                    in_time = target_dt.replace(hour=9, minute=20, second=0, microsecond=0)
                    cursor.execute("""
                        INSERT INTO attendance (worker_id, attendance_date, time_in, time_out, total_working_minutes, status, created_at, updated_at, created_by_manager_id, updated_by_manager_id)
                        VALUES (?, ?, ?, NULL, NULL, 'PRESENT', ?, ?, ?, ?)
                    """, (wid, date_str, in_time.isoformat(), in_time.isoformat(), in_time.isoformat(), manager_id, manager_id))
                elif name == 'Ranjith':
                    # Not checked in yet
                    pass

    conn.commit()
    conn.close()
    print("Database seeding completed.")

if __name__ == '__main__':
    seed_database()
