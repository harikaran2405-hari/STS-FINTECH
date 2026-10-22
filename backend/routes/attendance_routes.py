import json
from flask import Blueprint, request, jsonify, g
from backend.db import get_db_connection, row_to_dict, rows_to_dict_list
from backend.auth import token_required
from backend.ist_utils import (
    now_ist_iso, today_ist_str, format_time_display, 
    calculate_working_minutes, format_duration, parse_to_ist
)
from backend.department_utils import (
    VALID_DEPARTMENTS, DEPARTMENT_MAP, normalize_department, get_department_label
)

attendance_bp = Blueprint('attendance', __name__, url_prefix='/api/attendance')

def enrich_attendance_record(record):
    """Enriches raw attendance record with IST display fields and progress state."""
    if not record:
        return None
    r = dict(record)
    r['time_in_display'] = format_time_display(r.get('time_in'))
    r['time_out_display'] = format_time_display(r.get('time_out')) if r.get('time_out') else None
    
    time_in = r.get('time_in')
    time_out = r.get('time_out')
    
    if time_in and not time_out:
        r['is_in_progress'] = True
        r['duration_display'] = 'In Progress'
    elif time_in and time_out:
        r['is_in_progress'] = False
        minutes = r.get('total_working_minutes')
        if minutes is None:
            minutes = calculate_working_minutes(time_in, time_out)
        r['duration_display'] = format_duration(minutes)
    else:
        r['is_in_progress'] = False
        r['duration_display'] = '-'
        
    return r

@attendance_bp.route('', methods=['GET'])
@token_required
def get_daily_attendance():
    """
    Returns attendance sheet for a given date (defaults to today in IST).
    Lists all active workers, with their attendance record for that date if it exists.
    Also supports filtering by status (all, working, completed, not_checked_in, leave)
    and department.
    """
    date = (request.args.get('date') or '').strip()
    if not date:
        date = today_ist_str()

    filter_status = (request.args.get('filter_status') or 'all').lower()
    department = (request.args.get('department') or 'all').strip()
    search = (request.args.get('search') or '').strip()

    conn = get_db_connection()
    cursor = conn.cursor()

    # Query active workers along with their attendance record on the selected date
    query = """
        SELECT 
            w.id AS worker_id,
            w.employee_code,
            w.full_name,
            w.department,
            w.phone,
            w.employment_status,
            a.id AS attendance_id,
            a.attendance_date,
            a.time_in,
            a.time_out,
            a.total_working_minutes,
            a.status AS attendance_status,
            a.created_at AS attendance_created_at,
            a.updated_at AS attendance_updated_at,
            m1.name AS created_by_manager_name,
            m2.name AS updated_by_manager_name
        FROM workers w
        LEFT JOIN attendance a ON w.id = a.worker_id AND a.attendance_date = ?
        LEFT JOIN managers m1 ON a.created_by_manager_id = m1.id
        LEFT JOIN managers m2 ON a.updated_by_manager_id = m2.id
        WHERE w.employment_status = 'Active'
    """
    params = [date]

    if department != 'all':
        norm_dept = normalize_department(department)
        if norm_dept:
            query += " AND w.department = ?"
            params.append(norm_dept)

    if search:
        pattern = f"%{search}%"
        query += " AND (w.full_name LIKE ? OR w.employee_code LIKE ? OR printf('WKR-%04d', w.id) LIKE ?)"
        params.extend([pattern, pattern, pattern])

    query += " ORDER BY w.full_name ASC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    results = []
    for row in rows:
        d = dict(row)
        d['worker_code'] = f"WKR-{d['worker_id']:04d}"
        d['department_key'] = d.get('department')
        d['department_label'] = get_department_label(d.get('department'))
        
        # Determine attendance state
        time_in = d.get('time_in')
        time_out = d.get('time_out')
        att_status = d.get('attendance_status')
        
        if not time_in:
            if att_status == 'LEAVE':
                state = 'LEAVE'
                state_label = 'On Leave'
            else:
                state = 'NOT_CHECKED_IN'
                state_label = 'Not Checked In'
            d['time_in_display'] = '-'
            d['time_out_display'] = '-'
            d['duration_display'] = '-'
            d['is_in_progress'] = False
        elif time_in and not time_out:
            state = 'WORKING'
            state_label = 'Currently Working'
            d['time_in_display'] = format_time_display(time_in)
            d['time_out_display'] = '-'
            d['duration_display'] = 'In Progress'
            d['is_in_progress'] = True
        else:
            state = 'COMPLETED'
            state_label = 'Checked Out'
            d['time_in_display'] = format_time_display(time_in)
            d['time_out_display'] = format_time_display(time_out)
            mins = d.get('total_working_minutes')
            if mins is None:
                mins = calculate_working_minutes(time_in, time_out)
            d['duration_display'] = format_duration(mins)
            d['is_in_progress'] = False

        d['state'] = state
        d['state_label'] = state_label

        # Apply status filter
        if filter_status == 'working' and state != 'WORKING':
            continue
        elif filter_status == 'completed' and state != 'COMPLETED':
            continue
        elif filter_status == 'not_checked_in' and state != 'NOT_CHECKED_IN':
            continue
        elif filter_status == 'leave' and state != 'LEAVE':
            continue

        results.append(d)

    return jsonify({
        'success': True,
        'date': date,
        'total': len(results),
        'records': results
    })

@attendance_bp.route('/by-department', methods=['GET'])
@token_required
def get_daily_attendance_by_department():
    """
    Returns attendance sheet partitioned into the 3 distinct departments:
    1. Interns ('interns')
    2. AI/ML, Frontend Engineer ('ai_ml_frontend')
    3. Backend Engineer ('backend')
    Each department contains its employee attendance records and summary metrics.
    """
    date = (request.args.get('date') or '').strip() or today_ist_str()
    search = (request.args.get('search') or '').strip()

    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT 
            w.id AS worker_id,
            w.employee_code,
            w.full_name,
            w.department,
            w.phone,
            w.employment_status,
            a.id AS attendance_id,
            a.attendance_date,
            a.time_in,
            a.time_out,
            a.total_working_minutes,
            a.status AS attendance_status,
            a.created_at AS attendance_created_at,
            a.updated_at AS attendance_updated_at,
            m1.name AS created_by_manager_name,
            m2.name AS updated_by_manager_name
        FROM workers w
        LEFT JOIN attendance a ON w.id = a.worker_id AND a.attendance_date = ?
        LEFT JOIN managers m1 ON a.created_by_manager_id = m1.id
        LEFT JOIN managers m2 ON a.updated_by_manager_id = m2.id
        WHERE w.employment_status = 'Active'
    """
    params = [date]

    if search:
        pattern = f"%{search}%"
        query += " AND (w.full_name LIKE ? OR w.employee_code LIKE ? OR printf('WKR-%04d', w.id) LIKE ?)"
        params.extend([pattern, pattern, pattern])

    query += " ORDER BY w.full_name ASC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    dept_buckets = {
        'interns': {'records': [], 'working': 0, 'completed': 0, 'not_checked_in': 0, 'leave': 0},
        'ai_ml_frontend': {'records': [], 'working': 0, 'completed': 0, 'not_checked_in': 0, 'leave': 0},
        'backend': {'records': [], 'working': 0, 'completed': 0, 'not_checked_in': 0, 'leave': 0}
    }

    for row in rows:
        d = dict(row)
        d['worker_code'] = f"WKR-{d['worker_id']:04d}"
        dept_key = normalize_department(d.get('department')) or 'backend'
        d['department_key'] = dept_key
        d['department_label'] = DEPARTMENT_MAP.get(dept_key, d.get('department'))

        time_in = d.get('time_in')
        time_out = d.get('time_out')
        att_status = d.get('attendance_status')

        if not time_in:
            if att_status == 'LEAVE':
                state = 'LEAVE'
                state_label = 'On Leave'
                dept_buckets[dept_key]['leave'] += 1
            else:
                state = 'NOT_CHECKED_IN'
                state_label = 'Not Checked In'
                dept_buckets[dept_key]['not_checked_in'] += 1
            d['time_in_display'] = '-'
            d['time_out_display'] = '-'
            d['duration_display'] = '-'
            d['is_in_progress'] = False
        elif time_in and not time_out:
            state = 'WORKING'
            state_label = 'Currently Working'
            dept_buckets[dept_key]['working'] += 1
            d['time_in_display'] = format_time_display(time_in)
            d['time_out_display'] = '-'
            d['duration_display'] = 'In Progress'
            d['is_in_progress'] = True
        else:
            state = 'COMPLETED'
            state_label = 'Checked Out'
            dept_buckets[dept_key]['completed'] += 1
            d['time_in_display'] = format_time_display(time_in)
            d['time_out_display'] = format_time_display(time_out)
            mins = d.get('total_working_minutes')
            if mins is None:
                mins = calculate_working_minutes(time_in, time_out)
            d['duration_display'] = format_duration(mins)
            d['is_in_progress'] = False

        d['state'] = state
        d['state_label'] = state_label
        dept_buckets[dept_key]['records'].append(d)

    departments_out = []
    for k in VALID_DEPARTMENTS:
        b = dept_buckets[k]
        tot = len(b['records'])
        departments_out.append({
            'key': k,
            'label': DEPARTMENT_MAP[k],
            'total_workers': tot,
            'working_count': b['working'],
            'completed_count': b['completed'],
            'not_checked_in_count': b['not_checked_in'],
            'leave_count': b['leave'],
            'records': b['records']
        })

    return jsonify({
        'success': True,
        'date': date,
        'departments': departments_out
    })

@attendance_bp.route('/check-in', methods=['POST'])
@token_required
def check_in():
    """
    Official Check In endpoint.
    - Generates server timestamp strictly on the backend in IST.
    - Disallows second check-in if open attendance already exists.
    - Disallows duplicate attendance record for same worker on same date.
    """
    data = request.get_json() or {}
    worker_id = data.get('worker_id')
    date = (data.get('date') or '').strip() or today_ist_str()

    if not worker_id:
        return jsonify({'success': False, 'message': 'Worker ID is required.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Verify worker exists and is active
    cursor.execute("SELECT * FROM workers WHERE id = ?", (worker_id,))
    worker = cursor.fetchone()
    if not worker:
        conn.close()
        return jsonify({'success': False, 'message': 'Worker not found.'}), 404

    if worker['employment_status'] != 'Active':
        conn.close()
        return jsonify({'success': False, 'message': 'Cannot check in an Inactive worker. Please reactivate them first.'}), 400

    # 2. Check if attendance record already exists for this date
    cursor.execute("SELECT * FROM attendance WHERE worker_id = ? AND attendance_date = ?", (worker_id, date))
    existing = cursor.fetchone()

    if existing:
        conn.close()
        if existing['time_in'] and not existing['time_out']:
            return jsonify({
                'success': False, 
                'message': f"Worker {worker['full_name']} already has an active check-in at {format_time_display(existing['time_in'])}."
            }), 409
        else:
            return jsonify({
                'success': False, 
                'message': f"Worker {worker['full_name']} already has a completed attendance record for {date}."
            }), 409

    # 3. Official backend timestamp in IST
    server_time_in = now_ist_iso()
    manager_id = g.current_manager['id']

    try:
        cursor.execute("""
            INSERT INTO attendance (
                worker_id, attendance_date, time_in, time_out, total_working_minutes, 
                status, created_at, updated_at, created_by_manager_id, updated_by_manager_id
            ) VALUES (?, ?, ?, NULL, NULL, 'PRESENT', ?, ?, ?, ?)
        """, (worker_id, date, server_time_in, server_time_in, server_time_in, manager_id, manager_id))
        
        att_id = cursor.lastrowid
        conn.commit()

        cursor.execute("SELECT * FROM attendance WHERE id = ?", (att_id,))
        new_record = enrich_attendance_record(dict(cursor.fetchone()))
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'message': f'Failed to record check-in: {str(e)}'}), 500

    conn.close()
    return jsonify({
        'success': True,
        'message': f"{worker['full_name']} checked in successfully at {format_time_display(server_time_in)}.",
        'record': new_record
    }), 201

@attendance_bp.route('/check-out', methods=['POST'])
@token_required
def check_out():
    """
    Official Check Out endpoint.
    - Generates server timestamp strictly on backend in IST.
    - Checks that an active check-in exists.
    - Disallows checkout before check-in or if already checked out.
    - Computes total working minutes.
    """
    data = request.get_json() or {}
    attendance_id = data.get('attendance_id')
    worker_id = data.get('worker_id')
    date = (data.get('date') or '').strip() or today_ist_str()

    conn = get_db_connection()
    cursor = conn.cursor()

    # Find the active attendance session
    if attendance_id:
        cursor.execute("SELECT a.*, w.full_name FROM attendance a JOIN workers w ON a.worker_id = w.id WHERE a.id = ?", (attendance_id,))
    elif worker_id:
        cursor.execute("SELECT a.*, w.full_name FROM attendance a JOIN workers w ON a.worker_id = w.id WHERE a.worker_id = ? AND a.attendance_date = ?", (worker_id, date))
    else:
        conn.close()
        return jsonify({'success': False, 'message': 'Either attendance_id or worker_id is required.'}), 400

    att = cursor.fetchone()
    if not att:
        conn.close()
        return jsonify({'success': False, 'message': 'No check-in record found. Cannot check out without an active check-in.'}), 400

    if not att['time_in']:
        conn.close()
        return jsonify({'success': False, 'message': 'Worker has no check-in timestamp. Check out not allowed.'}), 400

    if att['time_out']:
        conn.close()
        return jsonify({
            'success': False, 
            'message': f"Worker {att['full_name']} has already checked out at {format_time_display(att['time_out'])}."
        }), 409

    # Generate official checkout timestamp in IST
    server_time_out = now_ist_iso()
    minutes = calculate_working_minutes(att['time_in'], server_time_out)
    now_str = server_time_out
    manager_id = g.current_manager['id']

    try:
        cursor.execute("""
            UPDATE attendance 
            SET time_out = ?, total_working_minutes = ?, updated_at = ?, updated_by_manager_id = ?
            WHERE id = ?
        """, (server_time_out, minutes, now_str, manager_id, att['id']))
        conn.commit()

        cursor.execute("SELECT * FROM attendance WHERE id = ?", (att['id'],))
        updated_rec = enrich_attendance_record(dict(cursor.fetchone()))
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'message': f'Failed to record check-out: {str(e)}'}), 500

    conn.close()
    return jsonify({
        'success': True,
        'message': f"{att['full_name']} checked out at {format_time_display(server_time_out)} (Duration: {format_duration(minutes)}).",
        'record': updated_rec
    })

@attendance_bp.route('/manual-edit', methods=['POST'])
@token_required
def manual_edit_attendance():
    """
    Authorized Manual Edit endpoint for managers.
    - Allows correcting time_in, time_out, or status.
    - Recalculates total_working_minutes.
    - Creates mandatory audit trail record in attendance_audit_logs.
    """
    data = request.get_json() or {}
    attendance_id = data.get('attendance_id')
    new_time_in = (data.get('time_in') or '').strip()
    new_time_out = (data.get('time_out') or '').strip() or None
    new_status = (data.get('status') or 'PRESENT').strip()
    reason = (data.get('reason') or '').strip()

    if not attendance_id:
        return jsonify({'success': False, 'message': 'Attendance ID is required.'}), 400

    if not reason:
        return jsonify({'success': False, 'message': 'A reason for manual correction is strictly required for the audit trail.'}), 400

    if not new_time_in:
        return jsonify({'success': False, 'message': 'Time In is required.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT a.*, w.full_name, w.employee_code 
        FROM attendance a 
        JOIN workers w ON a.worker_id = w.id 
        WHERE a.id = ?
    """, (attendance_id,))
    old_row = cursor.fetchone()

    if not old_row:
        conn.close()
        return jsonify({'success': False, 'message': 'Attendance record not found.'}), 404

    old_values = {
        'time_in': old_row['time_in'],
        'time_out': old_row['time_out'],
        'total_working_minutes': old_row['total_working_minutes'],
        'status': old_row['status'],
        'updated_at': old_row['updated_at']
    }

    # Recalculate duration if time_out is provided
    minutes = None
    if new_time_in and new_time_out:
        minutes = calculate_working_minutes(new_time_in, new_time_out)

    now_str = now_ist_iso()
    manager_id = g.current_manager['id']

    new_values = {
        'time_in': new_time_in,
        'time_out': new_time_out,
        'total_working_minutes': minutes,
        'status': new_status,
        'updated_at': now_str
    }

    try:
        # Update attendance
        cursor.execute("""
            UPDATE attendance 
            SET time_in = ?, time_out = ?, total_working_minutes = ?, status = ?, updated_at = ?, updated_by_manager_id = ?
            WHERE id = ?
        """, (new_time_in, new_time_out, minutes, new_status, now_str, manager_id, attendance_id))

        # Insert audit log record
        cursor.execute("""
            INSERT INTO attendance_audit_logs (attendance_id, manager_id, action, old_values, new_values, reason, created_at)
            VALUES (?, ?, 'MANUAL_EDIT', ?, ?, ?, ?)
        """, (attendance_id, manager_id, json.dumps(old_values), json.dumps(new_values), reason, now_str))

        conn.commit()

        cursor.execute("SELECT * FROM attendance WHERE id = ?", (attendance_id,))
        updated_rec = enrich_attendance_record(dict(cursor.fetchone()))
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'message': f'Failed to update attendance: {str(e)}'}), 500

    conn.close()
    return jsonify({
        'success': True,
        'message': f"Attendance record for {old_row['full_name']} updated successfully. Audit log created.",
        'record': updated_rec
    })

@attendance_bp.route('/mark-leave', methods=['POST'])
@token_required
def mark_leave():
    """Allows manager to mark an active worker on Leave for the day."""
    data = request.get_json() or {}
    worker_id = data.get('worker_id')
    date = (data.get('date') or '').strip() or today_ist_str()
    reason = (data.get('reason') or 'Approved Leave').strip()

    if not worker_id:
        return jsonify({'success': False, 'message': 'Worker ID is required.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM workers WHERE id = ?", (worker_id,))
    worker = cursor.fetchone()
    if not worker:
        conn.close()
        return jsonify({'success': False, 'message': 'Worker not found.'}), 404

    cursor.execute("SELECT * FROM attendance WHERE worker_id = ? AND attendance_date = ?", (worker_id, date))
    existing = cursor.fetchone()

    now_str = now_ist_iso()
    manager_id = g.current_manager['id']

    if existing:
        if existing['time_in']:
            conn.close()
            return jsonify({'success': False, 'message': 'Worker has already checked in on this date. Use Manual Edit instead.'}), 400
        # Update existing record
        cursor.execute("UPDATE attendance SET status = 'LEAVE', updated_at = ?, updated_by_manager_id = ? WHERE id = ?", (now_str, manager_id, existing['id']))
        att_id = existing['id']
    else:
        # Create leave record without time_in
        cursor.execute("""
            INSERT INTO attendance (worker_id, attendance_date, time_in, time_out, total_working_minutes, status, created_at, updated_at, created_by_manager_id, updated_by_manager_id)
            VALUES (?, ?, '', NULL, 0, 'LEAVE', ?, ?, ?, ?)
        """, (worker_id, date, now_str, now_str, manager_id, manager_id))
        att_id = cursor.lastrowid

    # Add audit log
    cursor.execute("""
        INSERT INTO attendance_audit_logs (attendance_id, manager_id, action, old_values, new_values, reason, created_at)
        VALUES (?, ?, 'MARK_LEAVE', '{}', ?, ?, ?)
    """, (att_id, manager_id, json.dumps({'status': 'LEAVE'}), reason, now_str))

    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': f"Worker {worker['full_name']} marked as On Leave for {date}."
    })

@attendance_bp.route('/audit-logs', methods=['GET'])
@token_required
def get_audit_logs():
    """Retrieves audit trail logs, optionally filtered by attendance_id."""
    att_id = request.args.get('attendance_id')
    limit = int(request.args.get('limit') or 50)

    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT 
            al.id,
            al.attendance_id,
            al.manager_id,
            al.action,
            al.old_values,
            al.new_values,
            al.reason,
            al.created_at,
            m.name AS manager_name,
            m.email AS manager_email,
            w.full_name AS worker_name,
            w.id AS worker_id,
            a.attendance_date
        FROM attendance_audit_logs al
        JOIN managers m ON al.manager_id = m.id
        JOIN attendance a ON al.attendance_id = a.id
        JOIN workers w ON a.worker_id = w.id
        WHERE 1=1
    """
    params = []
    if att_id:
        query += " AND al.attendance_id = ?"
        params.append(att_id)

    query += " ORDER BY al.id DESC LIMIT ?"
    params.append(limit)

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    logs = []
    for r in rows:
        item = dict(r)
        item['worker_code'] = f"WKR-{item['worker_id']:04d}"
        try:
            item['old_values'] = json.loads(item['old_values'])
        except Exception:
            pass
        try:
            item['new_values'] = json.loads(item['new_values'])
        except Exception:
            pass
        logs.append(item)

    return jsonify({'success': True, 'count': len(logs), 'logs': logs})
