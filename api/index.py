import os
import sys
import shutil

# Ensure the root project directory is on the Python path
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

# In Vercel serverless functions, the root filesystem is read-only.
# We copy attendance.db to /tmp so SQLite write operations succeed.
if os.environ.get('VERCEL'):
    tmp_db = '/tmp/attendance.db'
    bundled_db = os.path.join(ROOT_DIR, 'backend', 'attendance.db')
    if not os.path.exists(tmp_db) and os.path.exists(bundled_db):
        try:
            shutil.copy2(bundled_db, tmp_db)
        except Exception as e:
            print(f"Error copying DB to /tmp: {e}")
    os.environ['DATABASE_PATH'] = tmp_db

from backend.app import app

# Vercel looks for the WSGI/ASGI 'app' object in api/index.py
