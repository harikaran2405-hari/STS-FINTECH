import csv
import io
from datetime import datetime, timedelta, date as dt_date
from flask import Blueprint, request, jsonify, Response, g
from backend.db import get_db_connection
from backend.auth import token_required, decode_token
from backend.ist_utils import (
    today_ist_str, now_ist, format_time_display, format_date_display, 
    format_duration, calculate_working_minutes, parse_to_ist
)
from backend.department_utils import normalize_department, get_department_label, VALID_DEPARTMENTS

report_bp = Blueprint('reports', __name__, url_prefix='/api/reports')

def sanitize_csv_cell(val):
    """Prevents CSV formula injection by prepending single quote if value begins with dangerous characters."""
    if val is None:
        return ''
    s = str(val).strip()
    if s and s[0] in ('=', '+', '-', '@', '\t', '\r'):
        return "'" + s
    return s

def authenticate_export_request():
    """Allows either Authorization header or query parameter 'token' for secure file downloads."""
    auth_header = request.headers.get('Authorization')
    token = None
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
    elif request.args.get('token'):
        token = request.args.get('token')

    if not token:
        return None
    try:
        payload = decode_token(token)
        return payload
    except Exception:
        return None

def calculate_employee_period_metrics(worker, start_dt, end_dt, attendance_by_date, today_date):
    """
    Calculates scheduled working days, present days, absent days, half days,
    late arrivals, and attendance percentage strictly per Section 12 rules:
    - Excludes weekends (Saturday & Sunday).
    - Excludes future dates.
    - Excludes dates before employee joining date.
    - Excludes dates after employee deactivation if applicable.
    - Late arrival = check-in after 09:30 AM IST.
    - Attendance Percentage = (Present Days + 0.5 * Half Days) / Scheduled Days * 100.
    """
    joining_date_str = worker.get('joining_date') or '2020-01-01'
    try:
        worker_join = datetime.strptime(joining_date_str, '%Y-%m-%d').date()
    except Exception:
        worker_join = dt_date(2020, 1, 1)

    # Effective date bounds
    effective_start = max(start_dt, worker_join)
    effective_end = min(end_dt, today_date)

    scheduled_days = 0
    present_days = 0
    half_days = 0
    leave_days = 0
    late_arrivals = 0
    total_minutes = 0

    cur_dt = effective_start
    while cur_dt <= effective_end:
        # Check if weekday (Mon=0 .. Fri=4; Sat=5, Sun=6)
        if cur_dt.weekday() < 5:
            scheduled_days += 1
            date_key = cur_dt.strftime('%Y-%m-%d')
            att = attendance_by_date.get(date_key)
            if att:
                status = att.get('status')
                time_in = att.get('time_in')
                time_out = att.get('time_out')
                mins = att.get('total_working_minutes')

                if mins is None and time_in and time_out:
                    mins = calculate_working_minutes(time_in, time_out)
                if mins:
                    total_minutes += mins

                # Check late arrival (after 09:30 AM IST)
                if time_in:
                    try:
                        t_in = parse_to_ist(time_in)
                        if t_in.hour > 9 or (t_in.hour == 9 and t_in.minute > 30):
                            late_arrivals += 1
                    except Exception:
                        pass

                if status == 'PRESENT':
                    present_days += 1
                elif status == 'HALF_DAY':
                    half_days += 1
                elif status == 'LEAVE':
                    leave_days += 1
        cur_dt += timedelta(days=1)

    absent_days = max(0, scheduled_days - present_days - half_days - leave_days)

    if scheduled_days > 0:
        effective_present = present_days + (0.5 * half_days)
        pct_val = (effective_present / scheduled_days) * 100.0
        pct_formatted = f"{pct_val:.2f}%"
    else:
        pct_formatted = ""

    return {
        'scheduled_days': scheduled_days,
        'present_days': present_days,
        'half_days': half_days,
        'leave_days': leave_days,
        'absent_days': absent_days,
        'late_arrivals': late_arrivals,
        'total_working_minutes': total_minutes,
        'total_working_hours': format_duration(total_minutes),
        'attendance_percentage': pct_formatted
    }

@report_bp.route('/attendance', methods=['GET'])
@token_required
def get_attendance_report():
    """
    Returns filtered attendance records and aggregate statistics for a date range.
    """
    start_date = (request.args.get('start_date') or '').strip()
    end_date = (request.args.get('end_date') or '').strip()
    raw_dept = (request.args.get('department') or 'all').strip()
    worker_id = request.args.get('worker_id')
    status = (request.args.get('status') or 'all').strip()

    if not start_date or not end_date:
        today = today_ist_str()
        end_date = end_date or today
        # default to past 30 days
        if not start_date:
            d = datetime.strptime(end_date, '%Y-%m-%d') - timedelta(days=30)
            start_date = d.strftime('%Y-%m-%d')

    if start_date > end_date:
        return jsonify({'success': False, 'message': 'Start date cannot be later than end date.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT 
            a.id AS attendance_id,
            a.attendance_date,
            a.time_in,
            a.time_out,
            a.total_working_minutes,
            a.status,
            a.created_at,
            a.updated_at,
            w.id AS worker_id,
            w.employee_code,
            w.full_name,
            w.department,
            w.phone,
            w.joining_date,
            w.employment_status,
            m1.name AS created_by_manager,
            m2.name AS updated_by_manager
        FROM attendance a
        JOIN workers w ON a.worker_id = w.id
        LEFT JOIN managers m1 ON a.created_by_manager_id = m1.id
        LEFT JOIN managers m2 ON a.updated_by_manager_id = m2.id
        WHERE a.attendance_date >= ? AND a.attendance_date <= ?
    """
    params = [start_date, end_date]

    if raw_dept != 'all':
        norm_dept = normalize_department(raw_dept)
        if norm_dept:
            query += " AND w.department = ?"
            params.append(norm_dept)

    if worker_id and worker_id != 'all':
        query += " AND w.id = ?"
        params.append(worker_id)

    if status != 'all':
        query += " AND a.status = ?"
        params.append(status)

    query += " ORDER BY a.attendance_date DESC, w.full_name ASC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    total_records = len(rows)
    total_minutes = 0
    present_count = 0
    half_day_count = 0
    leave_count = 0

    records = []
    for r in rows:
        d = dict(r)
        d['worker_code'] = f"WKR-{d['worker_id']:04d}"
        d['department_label'] = get_department_label(d['department'])
        d['date_display'] = format_date_display(d['attendance_date'])
        d['time_in_display'] = format_time_display(d['time_in'])
        d['time_out_display'] = format_time_display(d['time_out']) if d['time_out'] else '-'

        mins = d.get('total_working_minutes')
        if mins is None and d['time_in'] and d['time_out']:
            mins = calculate_working_minutes(d['time_in'], d['time_out'])

        if mins:
            total_minutes += mins
            d['duration_display'] = format_duration(mins)
        elif d['time_in'] and not d['time_out']:
            d['duration_display'] = 'In Progress'
        else:
            d['duration_display'] = '-'

        if d['status'] == 'PRESENT':
            present_count += 1
        elif d['status'] == 'HALF_DAY':
            half_day_count += 1
        elif d['status'] == 'LEAVE':
            leave_count += 1

        records.append(d)

    avg_minutes = (total_minutes // total_records) if total_records > 0 else 0

    summary = {
        'total_records': total_records,
        'present_count': present_count,
        'half_day_count': half_day_count,
        'leave_count': leave_count,
        'total_hours_worked': format_duration(total_minutes),
        'total_minutes': total_minutes,
        'average_daily_hours': format_duration(avg_minutes)
    }

    return jsonify({
        'success': True,
        'start_date': start_date,
        'end_date': end_date,
        'summary': summary,
        'records': records
    })

@report_bp.route('/export-csv-detailed', methods=['GET'])
def export_csv_detailed():
    """
    Requirement 12.B & 12.D: Detailed Daily Attendance CSV
    Contains 16 required columns with one row per eligible employee per date in the selected period.
    """
    user_payload = authenticate_export_request()
    if not user_payload:
        return jsonify({'success': False, 'message': 'Unauthorized. Valid token required to export.'}), 401

    start_date_str = (request.args.get('start_date') or '').strip()
    end_date_str = (request.args.get('end_date') or '').strip()
    raw_dept = (request.args.get('department') or 'all').strip()
    worker_id = request.args.get('worker_id')

    if not start_date_str or not end_date_str:
        return jsonify({'success': False, 'message': 'Start date and end date are both required.'}), 400

    try:
        start_dt = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_dt = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except Exception:
        return jsonify({'success': False, 'message': 'Invalid date format. Expected YYYY-MM-DD.'}), 400

    if start_dt > end_dt:
        return jsonify({'success': False, 'message': 'Start date cannot be later than end date.'}), 400

    today_date = datetime.strptime(today_ist_str(), '%Y-%m-%d').date()

    conn = get_db_connection()
    cursor = conn.cursor()

    # Query filtered active employees
    w_query = "SELECT * FROM workers WHERE employment_status = 'Active'"
    w_params = []
    if raw_dept != 'all':
        norm_dept = normalize_department(raw_dept)
        if norm_dept:
            w_query += " AND department = ?"
            w_params.append(norm_dept)
    if worker_id and worker_id != 'all':
        w_query += " AND id = ?"
        w_params.append(worker_id)
    w_query += " ORDER BY department ASC, full_name ASC"

    cursor.execute(w_query, w_params)
    workers = [dict(w) for w in cursor.fetchall()]

    if not workers:
        conn.close()
        return jsonify({'success': False, 'message': 'No matching employees found for export.'}), 404

    # Query all attendance records in strict date range
    att_query = "SELECT * FROM attendance WHERE attendance_date >= ? AND attendance_date <= ?"
    cursor.execute(att_query, (start_date_str, end_date_str))
    all_att = cursor.fetchall()
    conn.close()

    # Organize attendance by (worker_id, attendance_date)
    att_map = {}
    for a in all_att:
        key = (a['worker_id'], a['attendance_date'])
        att_map[key] = dict(a)

    # Compute period metrics for each worker
    worker_metrics = {}
    for w in workers:
        wid = w['id']
        w_att_by_date = {a['attendance_date']: dict(a) for a in all_att if a['worker_id'] == wid}
        worker_metrics[wid] = calculate_employee_period_metrics(w, start_dt, end_dt, w_att_by_date, today_date)

    output = io.StringIO()
    # Write UTF-8 BOM so Excel opens cleanly
    output.write('\ufeff')
    writer = csv.writer(output)

    # 16 Columns required by Section 12.B
    headers = [
        'Employee ID',
        'Employee Name',
        'Department',
        'Attendance Date',
        'Attendance Status',
        'Present (Yes/No)',
        'Check-In Date and Time',
        'Check-Out Date and Time',
        'Total Working Hours',
        'Total Working Minutes',
        'Scheduled Working Days',
        'Present Days',
        'Absent Days',
        'Half Days',
        'Late Arrivals',
        'Attendance Percentage'
    ]
    writer.writerow([sanitize_csv_cell(h) for h in headers])

    # Generate one row per eligible employee per date in range
    for w in workers:
        wid = w['id']
        emp_code = w.get('employee_code') or f"WKR-{wid:04d}"
        emp_name = w.get('full_name')
        dept_label = get_department_label(w.get('department'))
        metrics = worker_metrics[wid]

        try:
            w_join = datetime.strptime(w.get('joining_date') or '2020-01-01', '%Y-%m-%d').date()
        except Exception:
            w_join = dt_date(2020, 1, 1)

        cur_dt = start_dt
        while cur_dt <= end_dt:
            # Skip weekends for corporate scheduled days
            is_weekend = cur_dt.weekday() >= 5
            is_before_join = cur_dt < w_join
            is_future = cur_dt > today_date

            date_str = cur_dt.strftime('%Y-%m-%d')
            att = att_map.get((wid, date_str))

            if att:
                status = att.get('status') or 'PRESENT'
                is_present = 'Yes' if status in ('PRESENT', 'HALF_DAY') else 'No'
                time_in_str = att.get('time_in')
                time_out_str = att.get('time_out')
                
                # Format IST timestamps
                time_in_disp = format_time_display(time_in_str) if time_in_str else ''
                time_out_disp = format_time_display(time_out_str) if time_out_str else ''

                mins = att.get('total_working_minutes')
                if mins is None and time_in_str and time_out_str:
                    mins = calculate_working_minutes(time_in_str, time_out_str)
                
                hours_disp = f"{(mins/60):.2f}" if mins is not None else ('In Progress' if time_in_str and not time_out_str else '')
                mins_disp = str(mins) if mins is not None else ''

                # Late check
                late_disp = 'No'
                if time_in_str:
                    try:
                        t_in = parse_to_ist(time_in_str)
                        if t_in.hour > 9 or (t_in.hour == 9 and t_in.minute > 30):
                            late_disp = 'Yes'
                    except Exception:
                        pass
            else:
                if is_weekend:
                    status = 'WEEKEND_OFF'
                    is_present = 'No'
                elif is_before_join:
                    status = 'NOT_JOINED'
                    is_present = 'No'
                elif is_future:
                    status = 'UPCOMING'
                    is_present = 'No'
                else:
                    status = 'ABSENT'
                    is_present = 'No'

                time_in_disp = ''
                time_out_disp = ''
                hours_disp = '0.00' if status == 'ABSENT' else ''
                mins_disp = '0' if status == 'ABSENT' else ''
                late_disp = 'No'

            row = [
                sanitize_csv_cell(emp_code),
                sanitize_csv_cell(emp_name),
                sanitize_csv_cell(dept_label),
                sanitize_csv_cell(date_str),
                sanitize_csv_cell(status),
                sanitize_csv_cell(is_present),
                sanitize_csv_cell(time_in_disp),
                sanitize_csv_cell(time_out_disp),
                sanitize_csv_cell(hours_disp),
                sanitize_csv_cell(mins_disp),
                sanitize_csv_cell(metrics['scheduled_days']),
                sanitize_csv_cell(metrics['present_days']),
                sanitize_csv_cell(metrics['absent_days']),
                sanitize_csv_cell(metrics['half_days']),
                sanitize_csv_cell(metrics['late_arrivals']),
                sanitize_csv_cell(metrics['attendance_percentage'])
            ]
            writer.writerow(row)
            cur_dt += timedelta(days=1)

    csv_data = output.getvalue()
    output.close()

    dept_slug = f"_{raw_dept}" if raw_dept != 'all' else ""
    filename = f"attendance_detailed{dept_slug}_{start_date_str}_to_{end_date_str}.csv"

    return Response(
        csv_data,
        mimetype='text/csv; charset=utf-8',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Content-Type': 'text/csv; charset=utf-8'
        }
    )

@report_bp.route('/export-csv-summary', methods=['GET'])
def export_csv_summary():
    """
    Requirement 12.D: Employee Attendance Summary CSV
    Contains one row per employee with period totals, scheduled days, and attendance percentage.
    """
    user_payload = authenticate_export_request()
    if not user_payload:
        return jsonify({'success': False, 'message': 'Unauthorized. Valid token required to export.'}), 401

    start_date_str = (request.args.get('start_date') or '').strip()
    end_date_str = (request.args.get('end_date') or '').strip()
    raw_dept = (request.args.get('department') or 'all').strip()
    worker_id = request.args.get('worker_id')

    if not start_date_str or not end_date_str:
        return jsonify({'success': False, 'message': 'Start date and end date are both required.'}), 400

    try:
        start_dt = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_dt = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except Exception:
        return jsonify({'success': False, 'message': 'Invalid date format. Expected YYYY-MM-DD.'}), 400

    if start_dt > end_dt:
        return jsonify({'success': False, 'message': 'Start date cannot be later than end date.'}), 400

    today_date = datetime.strptime(today_ist_str(), '%Y-%m-%d').date()

    conn = get_db_connection()
    cursor = conn.cursor()

    w_query = "SELECT * FROM workers WHERE employment_status = 'Active'"
    w_params = []
    if raw_dept != 'all':
        norm_dept = normalize_department(raw_dept)
        if norm_dept:
            w_query += " AND department = ?"
            w_params.append(norm_dept)
    if worker_id and worker_id != 'all':
        w_query += " AND id = ?"
        w_params.append(worker_id)
    w_query += " ORDER BY department ASC, full_name ASC"

    cursor.execute(w_query, w_params)
    workers = [dict(w) for w in cursor.fetchall()]

    if not workers:
        conn.close()
        return jsonify({'success': False, 'message': 'No matching employees found for export.'}), 404

    # Fetch attendance in date range
    att_query = "SELECT * FROM attendance WHERE attendance_date >= ? AND attendance_date <= ?"
    cursor.execute(att_query, (start_date_str, end_date_str))
    all_att = [dict(a) for a in cursor.fetchall()]
    conn.close()

    output = io.StringIO()
    output.write('\ufeff')
    writer = csv.writer(output)

    headers = [
        'Employee ID',
        'Employee Name',
        'Department',
        'Scheduled Working Days',
        'Present Days',
        'Absent Days',
        'Half Days',
        'Late Arrivals',
        'Total Working Hours',
        'Total Working Minutes',
        'Attendance Percentage'
    ]
    writer.writerow([sanitize_csv_cell(h) for h in headers])

    for w in workers:
        wid = w['id']
        emp_code = w.get('employee_code') or f"WKR-{wid:04d}"
        emp_name = w.get('full_name')
        dept_label = get_department_label(w.get('department'))
        w_att = {a['attendance_date']: a for a in all_att if a['worker_id'] == wid}

        metrics = calculate_employee_period_metrics(w, start_dt, end_dt, w_att, today_date)

        hours_val = f"{(metrics['total_working_minutes'] / 60):.2f}"

        row = [
            sanitize_csv_cell(emp_code),
            sanitize_csv_cell(emp_name),
            sanitize_csv_cell(dept_label),
            sanitize_csv_cell(metrics['scheduled_days']),
            sanitize_csv_cell(metrics['present_days']),
            sanitize_csv_cell(metrics['absent_days']),
            sanitize_csv_cell(metrics['half_days']),
            sanitize_csv_cell(metrics['late_arrivals']),
            sanitize_csv_cell(hours_val),
            sanitize_csv_cell(metrics['total_working_minutes']),
            sanitize_csv_cell(metrics['attendance_percentage'])
        ]
        writer.writerow(row)

    csv_data = output.getvalue()
    output.close()

    dept_slug = f"_{raw_dept}" if raw_dept != 'all' else ""
    filename = f"attendance_summary{dept_slug}_{start_date_str}_to_{end_date_str}.csv"

    return Response(
        csv_data,
        mimetype='text/csv; charset=utf-8',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Content-Type': 'text/csv; charset=utf-8'
        }
    )
