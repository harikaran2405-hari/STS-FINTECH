from flask import Blueprint, request, jsonify
from backend.db import get_db_connection
from backend.auth import token_required
from backend.ist_utils import today_ist_str, format_time_display, format_duration, calculate_working_minutes
from backend.department_utils import VALID_DEPARTMENTS, DEPARTMENT_MAP, get_department_label

dashboard_bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')

@dashboard_bp.route('/summary', methods=['GET'])
@token_required
def get_dashboard_summary():
    """
    Returns high-level KPI metrics and the 3 department group summaries for the manager dashboard
    on the selected date (default today IST).
    """
    date = (request.args.get('date') or '').strip() or today_ist_str()

    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Total active & registered workers
    cursor.execute("SELECT COUNT(*) AS total FROM workers WHERE employment_status = 'Active'")
    total_active_workers = cursor.fetchone()['total']

    cursor.execute("SELECT COUNT(*) AS total FROM workers")
    total_registered_workers = cursor.fetchone()['total']

    # 2. Overall Attendance stats on selected date for ACTIVE workers
    cursor.execute("""
        SELECT 
            COUNT(a.id) AS total_recorded,
            SUM(CASE WHEN a.time_in IS NOT NULL AND a.time_in != '' THEN 1 ELSE 0 END) AS checked_in_total,
            SUM(CASE WHEN a.time_in IS NOT NULL AND a.time_in != '' AND a.time_out IS NOT NULL AND a.time_out != '' THEN 1 ELSE 0 END) AS checked_out_total,
            SUM(CASE WHEN a.time_in IS NOT NULL AND a.time_in != '' AND (a.time_out IS NULL OR a.time_out = '') THEN 1 ELSE 0 END) AS currently_working_total,
            SUM(CASE WHEN a.status = 'LEAVE' THEN 1 ELSE 0 END) AS on_leave_total,
            SUM(COALESCE(a.total_working_minutes, 0)) AS total_minutes_logged
        FROM workers w
        LEFT JOIN attendance a ON w.id = a.worker_id AND a.attendance_date = ?
        WHERE w.employment_status = 'Active'
    """, (date,))
    att_stats = cursor.fetchone()

    checked_in = att_stats['checked_in_total'] or 0
    checked_out = att_stats['checked_out_total'] or 0
    currently_working = att_stats['currently_working_total'] or 0
    on_leave = att_stats['on_leave_total'] or 0
    total_minutes = att_stats['total_minutes_logged'] or 0

    not_checked_in = max(0, total_active_workers - checked_in - on_leave)
    attendance_rate = round((checked_in / total_active_workers * 100), 1) if total_active_workers > 0 else 0

    # 3. Exactly Three Department Summaries with Employee and Attendance details (Requirement 8)
    department_summaries = []
    for dept_key in VALID_DEPARTMENTS:
        dept_label = DEPARTMENT_MAP[dept_key]

        # Query all active workers in this department with their attendance record for this date
        cursor.execute("""
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
                a.status AS attendance_status
            FROM workers w
            LEFT JOIN attendance a ON w.id = a.worker_id AND a.attendance_date = ?
            WHERE w.department = ? AND w.employment_status = 'Active'
            ORDER BY w.full_name ASC
        """, (date, dept_key))
        worker_rows = cursor.fetchall()

        dept_total = len(worker_rows)
        dept_checked_in = 0
        dept_checked_out = 0
        dept_working = 0
        dept_not_checked_in = 0
        dept_leave = 0

        dept_workers = []
        for r in worker_rows:
            d = dict(r)
            d['worker_code'] = f"WKR-{d['worker_id']:04d}"
            d['time_in_display'] = format_time_display(d.get('time_in'))
            d['time_out_display'] = format_time_display(d.get('time_out')) if d.get('time_out') else None

            time_in = d.get('time_in')
            time_out = d.get('time_out')
            status = d.get('attendance_status')

            if not time_in:
                if status == 'LEAVE':
                    state = 'LEAVE'
                    dept_leave += 1
                else:
                    state = 'NOT_CHECKED_IN'
                    dept_not_checked_in += 1
                d['duration_display'] = '-'
            elif time_in and not time_out:
                state = 'WORKING'
                dept_checked_in += 1
                dept_working += 1
                d['duration_display'] = 'In Progress'
            else:
                state = 'COMPLETED'
                dept_checked_in += 1
                dept_checked_out += 1
                mins = d.get('total_working_minutes')
                if mins is None:
                    mins = calculate_working_minutes(time_in, time_out)
                d['duration_display'] = format_duration(mins)

            d['state'] = state
            dept_workers.append(d)

        dept_rate = round((dept_checked_in / dept_total * 100), 1) if dept_total > 0 else 0

        department_summaries.append({
            'key': dept_key,
            'department': dept_label,
            'label': dept_label,
            'total_workers': dept_total,
            'checked_in_today': dept_checked_in,
            'currently_working': dept_working,
            'checked_out_today': dept_checked_out,
            'not_checked_in': dept_not_checked_in,
            'on_leave': dept_leave,
            'attendance_rate': dept_rate,
            'workers': dept_workers
        })

    # 4. Recent activity log
    cursor.execute("""
        SELECT 
            a.id,
            a.worker_id,
            w.full_name,
            w.department,
            a.attendance_date,
            a.time_in,
            a.time_out,
            a.status,
            a.updated_at
        FROM attendance a
        JOIN workers w ON a.worker_id = w.id
        WHERE a.attendance_date = ?
        ORDER BY a.updated_at DESC
        LIMIT 8
    """, (date,))
    recent_rows = cursor.fetchall()
    recent_activity = []
    for r in recent_rows:
        is_checkout = bool(r['time_out'])
        event_time = format_time_display(r['time_out'] if is_checkout else r['time_in'])
        recent_activity.append({
            'attendance_id': r['id'],
            'worker_id': r['worker_id'],
            'worker_code': f"WKR-{r['worker_id']:04d}",
            'worker_name': r['full_name'],
            'department': get_department_label(r['department']),
            'department_key': r['department'],
            'event_type': 'CHECK_OUT' if is_checkout else 'CHECK_IN',
            'time_display': event_time,
            'status': r['status']
        })

    conn.close()

    return jsonify({
        'success': True,
        'date': date,
        'kpis': {
            'total_active_workers': total_active_workers,
            'total_registered_workers': total_registered_workers,
            'checked_in_today': checked_in,
            'checked_out_today': checked_out,
            'currently_working': currently_working,
            'not_checked_in': not_checked_in,
            'on_leave': on_leave,
            'attendance_rate': attendance_rate,
            'total_working_hours_display': format_duration(total_minutes)
        },
        'departments': department_summaries,
        'recent_activity': recent_activity
    })
