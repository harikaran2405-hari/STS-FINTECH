import sqlite3
import os
import shutil
from contextlib import contextmanager
from backend.config import Config

def get_db_path():
    env_path = os.environ.get('DATABASE_PATH')
    if env_path:
        return env_path
    if os.environ.get('VERCEL'):
        return '/tmp/attendance.db'
    return Config.DATABASE_PATH

def get_db_connection():
    """Returns a new sqlite3 connection with Row factory and foreign keys enabled."""
    db_path = get_db_path()
    
    # In Vercel serverless environment, copy bundled template db if /tmp/attendance.db does not exist
    if os.environ.get('VERCEL') and db_path == '/tmp/attendance.db' and not os.path.exists(db_path):
        bundled_db = os.path.join(os.path.dirname(__file__), 'attendance.db')
        if os.path.exists(bundled_db):
            try:
                shutil.copy2(bundled_db, db_path)
            except Exception as e:
                print(f"Notice: Failed to copy bundled DB to /tmp: {e}")
                
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

@contextmanager
def db_cursor():
    """Context manager for automatic commit and close."""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        yield cursor
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    """Initializes database tables, constraints, and indexes."""
    with db_cursor() as cursor:
        # Table A: managers
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS managers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
        """)

        # Table B: workers
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS workers (
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

        # Table C: attendance
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                worker_id INTEGER NOT NULL,
                attendance_date TEXT NOT NULL,
                time_in TEXT NOT NULL,
                time_out TEXT,
                total_working_minutes INTEGER,
                status TEXT NOT NULL DEFAULT 'PRESENT',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                created_by_manager_id INTEGER,
                updated_by_manager_id INTEGER,
                FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE RESTRICT,
                FOREIGN KEY (created_by_manager_id) REFERENCES managers(id),
                FOREIGN KEY (updated_by_manager_id) REFERENCES managers(id),
                CONSTRAINT uq_worker_attendance_date UNIQUE (worker_id, attendance_date)
            );
        """)

        # Table D: attendance_audit_logs
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS attendance_audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                attendance_id INTEGER NOT NULL,
                manager_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                old_values TEXT NOT NULL,
                new_values TEXT NOT NULL,
                reason TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE,
                FOREIGN KEY (manager_id) REFERENCES managers(id)
            );
        """)

        # Indexes for fast querying and performance
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_workers_status ON workers(employment_status);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_workers_dept ON workers(department);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_attendance_worker_date ON attendance(worker_id, attendance_date);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_attendance ON attendance_audit_logs(attendance_id);")

def row_to_dict(row):
    """Utility to convert a sqlite3.Row object to a Python dict."""
    if row is None:
        return None
    return dict(row)

def rows_to_dict_list(rows):
    """Utility to convert a list of sqlite3.Row objects to list of dicts."""
    return [dict(row) for row in rows]
