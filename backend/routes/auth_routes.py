from flask import Blueprint, request, jsonify, g
from backend.config import Config
from backend.db import get_db_connection, db_cursor, row_to_dict
from backend.auth import hash_password, verify_password, generate_token, token_required, rate_limit_auth
from backend.ist_utils import now_ist_iso

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/status', methods=['GET'])
def get_auth_status():
    """Returns system initialization status for public registration."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) AS count FROM managers")
    count = cursor.fetchone()['count']
    
    first_mgr_name = None
    if count > 0:
        cursor.execute("SELECT name FROM managers ORDER BY id ASC LIMIT 1")
        first_mgr = cursor.fetchone()
        if first_mgr:
            first_mgr_name = first_mgr['name']
            
    conn.close()
    return jsonify({
        'success': True,
        'initialized': count > 0,
        'requires_invite': count > 0,
        'primary_manager': first_mgr_name or 'Mahesh Kumar'
    })

@auth_bp.route('/login', methods=['POST'])
@rate_limit_auth
def login():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({'success': False, 'message': 'Email and password are required.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    # Support both manager@stsfintech.com and manager@company.com
    cursor.execute("""
        SELECT * FROM managers 
        WHERE LOWER(email) = ? 
           OR (? IN ('manager@company.com', 'manager@stsfintech.com') AND email IN ('manager@company.com', 'manager@stsfintech.com'))
    """, (email, email))
    manager = cursor.fetchone()
    conn.close()

    if not manager or not verify_password(password, manager['password_hash']):
        return jsonify({'success': False, 'message': 'Invalid manager credentials.'}), 401

    token = generate_token(manager['id'], manager['email'], manager['name'])
    return jsonify({
        'success': True,
        'message': 'Login successful.',
        'token': token,
        'manager': {
            'id': manager['id'],
            'name': manager['name'],
            'email': manager['email'],
            'created_at': manager['created_at']
        }
    })

@auth_bp.route('/me', methods=['GET'])
@token_required
def get_current_manager_profile():
    return jsonify({
        'success': True,
        'manager': g.current_manager
    })

@auth_bp.route('/setup', methods=['POST'])
@auth_bp.route('/register', methods=['POST'])
@rate_limit_auth
def setup_initial_manager():
    """
    Manager registration endpoint.
    Allows managers to register directly, hashes passwords securely,
    prevents duplicate emails, and logs them in immediately.
    """
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not name or not email or not password:
        return jsonify({'success': False, 'message': 'Full name, email, and password are required.'}), 400

    if len(password) < 6:
        return jsonify({'success': False, 'message': 'Password must be at least 6 characters long.'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if a manager with this email already exists
    cursor.execute("SELECT id FROM managers WHERE LOWER(email) = ?", (email,))
    existing_manager = cursor.fetchone()
    if existing_manager:
        conn.close()
        return jsonify({'success': False, 'message': 'A manager account with this email already exists. Please sign in.'}), 400

    # Store password as secure PBKDF2:SHA256 hash
    hashed = hash_password(password)
    created_at = now_ist_iso()

    try:
        cursor.execute(
            "INSERT INTO managers (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (name, email, hashed, created_at)
        )
        manager_id = cursor.lastrowid
        conn.commit()
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'message': 'Failed to create manager account. Please try again.'}), 500

    conn.close()
    token = generate_token(manager_id, email, name)

    return jsonify({
        'success': True,
        'message': f'Manager account created successfully! Welcome, {name}.',
        'token': token,
        'manager': {
            'id': manager_id,
            'name': name,
            'email': email,
            'created_at': created_at
        }
    }), 201

@auth_bp.route('/change-password', methods=['PUT'])
@token_required
def change_password():
    data = request.get_json() or {}
    old_password = data.get('old_password') or ''
    new_password = data.get('new_password') or ''

    if not old_password or not new_password:
        return jsonify({'success': False, 'message': 'Both old and new passwords are required.'}), 400

    if len(new_password) < 6:
        return jsonify({'success': False, 'message': 'New password must be at least 6 characters.'}), 400

    manager_id = g.current_manager['id']
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash FROM managers WHERE id = ?", (manager_id,))
    row = cursor.fetchone()

    if not row or not verify_password(old_password, row['password_hash']):
        conn.close()
        return jsonify({'success': False, 'message': 'Current password does not match.'}), 400

    new_hash = hash_password(new_password)
    cursor.execute("UPDATE managers SET password_hash = ? WHERE id = ?", (new_hash, manager_id))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': 'Password updated successfully.'})
