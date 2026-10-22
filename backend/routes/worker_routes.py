from flask import Blueprint, request, jsonify, g
from backend.db import get_db_connection, row_to_dict, rows_to_dict_list
from backend.auth import token_required
from backend.ist_utils import now_ist_iso, today_ist_str
from backend.department_utils import (
    VALID_DEPARTMENTS, DEPARTMENT_DEFINITIONS, DEPARTMENT_MAP,
    normalize_department, get_department_label
)

worker_bp = Blueprint('workers', __name__, url_prefix='/api/workers')

def enrich_worker(worker_dict):
    """Enriches worker dict with formatted display ID and department label."""
    if not worker_dict:
        return None
    w = dict(worker_dict)
    w['worker_code'] = f"WKR-{w['id']:04d}"
    w['department_key'] = w.get('department')
    w['department_label'] = get_department_label(w.get('department'))
    return w

@worker_bp.route('', methods=['GET'])
@token_required
def get_workers():
    """
    Retrieves all workers with optional filters:
    - search: by name or employee_code
    - department: filter by department key or label ('interns', 'ai_ml_frontend', 'backend')
    - status: 'Active', 'Inactive', or 'All'
    """
    search = (request.args.get('search') or '').strip()
    raw_dept = (request.args.get('department') or '').strip()
    status = (request.args.get('status') or '').strip()

    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM workers WHERE 1=1"
    params = []

    if status and status.lower() != 'all':
        query += " AND employment_status = ?"
        params.append(status)

    if raw_dept and raw_dept.lower() != 'all':
        norm_dept = normalize_department(raw_dept)
        if norm_dept:
            query += " AND department = ?"
            params.append(norm_dept)

    if search:
        search_pattern = f"%{search}%"
        query += " AND (full_name LIKE ? OR employee_code LIKE ? OR printf('WKR-%04d', id) LIKE ?)"
        params.extend([search_pattern, search_pattern, search_pattern])

    query += " ORDER BY department ASC, full_name ASC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    workers = [enrich_worker(row) for row in rows]
    return jsonify({
        'success': True,
        'count': len(workers),
        'workers': workers
    })

@worker_bp.route('/by-department', methods=['GET'])
@token_required
def get_workers_by_department():
    """
    Returns employees organized into the exactly three required department groups:
    1. Interns ('interns')
    2. AI/ML, Frontend Engineer ('ai_ml_frontend')
    3. Backend Engineer ('backend')
    """
    status = (request.args.get('status') or 'Active').strip()
    
    conn = get_db_connection()
    cursor = conn.cursor()

    query = "SELECT * FROM workers WHERE 1=1"
    params = []
    if status.lower() != 'all':
        query += " AND employment_status = ?"
        params.append(status)

    query += " ORDER BY full_name ASC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    grouped = {
        'interns': [],
        'ai_ml_frontend': [],
        'backend': []
    }

    for row in rows:
        w = enrich_worker(row)
        dept_key = w.get('department')
        if dept_key in grouped:
            grouped[dept_key].append(w)
        else:
            # Fallback normalization
            norm = normalize_department(dept_key) or 'backend'
            grouped[norm].append(w)

    return jsonify({
        'success': True,
        'departments': [
            {
                'key': 'interns',
                'label': 'Interns',
                'workers': grouped['interns'],
                'count': len(grouped['interns'])
            },
            {
                'key': 'ai_ml_frontend',
                'label': 'AI/ML, Frontend Engineer',
                'workers': grouped['ai_ml_frontend'],
                'count': len(grouped['ai_ml_frontend'])
            },
            {
                'key': 'backend',
                'label': 'Backend Engineer',
                'workers': grouped['backend'],
                'count': len(grouped['backend'])
            }
        ]
    })

@worker_bp.route('/<int:worker_id>', methods=['GET'])
@token_required
def get_worker_detail(worker_id):
    """Retrieves single worker details plus historical attendance summary."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM workers WHERE id = ?", (worker_id,))
    worker = cursor.fetchone()

    if not worker:
        conn.close()
        return jsonify({'success': False, 'message': 'Worker not found.'}), 404

    worker_dict = enrich_worker(worker)

    # Attendance statistics
    cursor.execute("""
        SELECT 
            COUNT(*) AS total_days_recorded,
            SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) AS present_days,
            SUM(CASE WHEN status = 'HALF_DAY' THEN 1 ELSE 0 END) AS half_days,
            SUM(CASE WHEN status = 'LEAVE' THEN 1 ELSE 0 END) AS leave_days,
            SUM(COALESCE(total_working_minutes, 0)) AS total_minutes_worked,
            AVG(CASE WHEN total_working_minutes IS NOT NULL THEN total_working_minutes ELSE NULL END) AS avg_daily_minutes
        FROM attendance 
        WHERE worker_id = ?
    """, (worker_id,))
    stats_row = cursor.fetchone()
    stats = dict(stats_row) if stats_row else {}

    # Recent 15 attendance records
    cursor.execute("""
        SELECT * FROM attendance 
        WHERE worker_id = ? 
        ORDER BY attendance_date DESC 
        LIMIT 15
    """, (worker_id,))
    recent_records = rows_to_dict_list(cursor.fetchall())

    conn.close()

    return jsonify({
        'success': True,
        'worker': worker_dict,
        'stats': stats,
        'recent_attendance': recent_records
    })

@worker_bp.route('', methods=['POST'])
@token_required
def create_worker():
    """
    Registers a new worker into one of the three permitted departments:
    - 'interns' (Interns)
    - 'ai_ml_frontend' (AI/ML, Frontend Engineer)
    - 'backend' (Backend Engineer)
    """
    data = request.get_json() or {}
    full_name = (data.get('full_name') or '').strip()
    employee_code = (data.get('employee_code') or '').strip() or None
    raw_dept = (data.get('department') or '').strip()
    phone = (data.get('phone') or '').strip() or None
    joining_date = (data.get('joining_date') or '').strip() or today_ist_str()

    if not full_name:
        return jsonify({'success': False, 'message': 'Worker full name is required.'}), 400

    dept_key = normalize_department(raw_dept)
    if not dept_key:
        return jsonify({
            'success': False, 
            'message': 'Invalid department. Permitted departments are: Interns, AI/ML, Frontend Engineer, or Backend Engineer.'
        }), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Check for duplicate employee_code if provided
    if employee_code:
        cursor.execute("SELECT id FROM workers WHERE employee_code = ?", (employee_code,))
        if cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'message': f'Employee code "{employee_code}" is already in use.'}), 400

    now_str = now_ist_iso()
    try:
        cursor.execute("""
            INSERT INTO workers (employee_code, full_name, department, phone, joining_date, employment_status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'Active', ?, ?)
        """, (employee_code, full_name, dept_key, phone, joining_date, now_str, now_str))
        worker_id = cursor.lastrowid

        # If employee_code was omitted, generate sequential default code
        if not employee_code:
            gen_code = f"EMP-{worker_id + 1000}"
            cursor.execute("UPDATE workers SET employee_code = ? WHERE id = ?", (gen_code, worker_id))

        conn.commit()

        cursor.execute("SELECT * FROM workers WHERE id = ?", (worker_id,))
        new_worker = enrich_worker(cursor.fetchone())
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'message': f'Failed to register worker: {str(e)}'}), 500

    conn.close()
    return jsonify({
        'success': True,
        'message': f"Worker {full_name} registered successfully in {get_department_label(dept_key)} (ID: {new_worker['worker_code']}).",
        'worker': new_worker
    }), 201

@worker_bp.route('/<int:worker_id>', methods=['PUT'])
@token_required
def update_worker(worker_id):
    """
    Updates worker details.
    Allows changing department among the 3 permitted departments,
    while preserving their employee ID and all historical attendance records!
    """
    data = request.get_json() or {}
    full_name = (data.get('full_name') or '').strip()
    employee_code = (data.get('employee_code') or '').strip() or None
    raw_dept = (data.get('department') or '').strip()
    phone = (data.get('phone') or '').strip() or None
    joining_date = (data.get('joining_date') or '').strip()
    employment_status = (data.get('employment_status') or '').strip()

    if not full_name:
        return jsonify({'success': False, 'message': 'Full name is required.'}), 400

    dept_key = normalize_department(raw_dept)
    if not dept_key:
        return jsonify({
            'success': False, 
            'message': 'Invalid department. Permitted departments are: Interns, AI/ML, Frontend Engineer, or Backend Engineer.'
        }), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM workers WHERE id = ?", (worker_id,))
    worker = cursor.fetchone()
    if not worker:
        conn.close()
        return jsonify({'success': False, 'message': 'Worker not found.'}), 404

    # Check employee_code uniqueness
    if employee_code:
        cursor.execute("SELECT id FROM workers WHERE employee_code = ? AND id != ?", (employee_code, worker_id))
        if cursor.fetchone():
            conn.close()
            return jsonify({'success': False, 'message': f'Employee code "{employee_code}" is already used by another worker.'}), 400

    status = employment_status if employment_status in ['Active', 'Inactive'] else worker['employment_status']
    joining = joining_date if joining_date else worker['joining_date']
    now_str = now_ist_iso()

    try:
        cursor.execute("""
            UPDATE workers 
            SET full_name = ?, employee_code = ?, department = ?, phone = ?, joining_date = ?, employment_status = ?, updated_at = ?
            WHERE id = ?
        """, (full_name, employee_code, dept_key, phone, joining, status, now_str, worker_id))
        conn.commit()

        cursor.execute("SELECT * FROM workers WHERE id = ?", (worker_id,))
        updated = enrich_worker(cursor.fetchone())
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'message': f'Failed to update worker: {str(e)}'}), 500

    conn.close()
    return jsonify({
        'success': True,
        'message': f"Worker {full_name} details updated successfully.",
        'worker': updated
    })

@worker_bp.route('/<int:worker_id>/deactivate', methods=['POST'])
@token_required
def deactivate_worker(worker_id):
    """Deactivates a worker. Permanent attendance history is strictly preserved."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM workers WHERE id = ?", (worker_id,))
    worker = cursor.fetchone()

    if not worker:
        conn.close()
        return jsonify({'success': False, 'message': 'Worker not found.'}), 404

    now_str = now_ist_iso()
    cursor.execute("UPDATE workers SET employment_status = 'Inactive', updated_at = ? WHERE id = ?", (now_str, worker_id))
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': f"Worker {worker['full_name']} has been deactivated. Historical records remain fully preserved."
    })

@worker_bp.route('/<int:worker_id>/reactivate', methods=['POST'])
@token_required
def reactivate_worker(worker_id):
    """Reactivates a previously deactivated worker."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM workers WHERE id = ?", (worker_id,))
    worker = cursor.fetchone()

    if not worker:
        conn.close()
        return jsonify({'success': False, 'message': 'Worker not found.'}), 404

    now_str = now_ist_iso()
    cursor.execute("UPDATE workers SET employment_status = 'Active', updated_at = ? WHERE id = ?", (now_str, worker_id))
    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': f"Worker {worker['full_name']} has been reactivated successfully."
    })

@worker_bp.route('/departments', methods=['GET'])
@token_required
def get_departments():
    """Returns the official list of 3 permitted company departments."""
    return jsonify({
        'success': True,
        'departments': DEPARTMENT_DEFINITIONS
    })
