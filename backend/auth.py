import jwt
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify, g
from werkzeug.security import generate_password_hash, check_password_hash
from backend.config import Config
from backend.db import get_db_connection, row_to_dict

# IP-based rate limiting dictionary: { ip: [timestamp1, timestamp2, ...] }
_login_attempts = defaultdict(list)

def rate_limit_auth(f):
    """Enforces rate limiting on authentication attempts per IP."""
    @wraps(f)
    def decorated(*args, **kwargs):
        # Determine client IP (considering X-Forwarded-For if behind proxy/Render/Vercel)
        forwarded_for = request.headers.get('X-Forwarded-For')
        if forwarded_for:
            ip = forwarded_for.split(',')[0].strip()
        else:
            ip = request.remote_addr or 'unknown'

        now = time.time()
        window = getattr(Config, 'RATE_LIMIT_WINDOW_SECONDS', 300)
        max_attempts = getattr(Config, 'RATE_LIMIT_MAX_ATTEMPTS', 15)

        # Retain only timestamps within the current sliding window
        attempts = [t for t in _login_attempts[ip] if now - t < window]
        _login_attempts[ip] = attempts

        if len(attempts) >= max_attempts:
            retry_after = int(window - (now - attempts[0]))
            return jsonify({
                'success': False,
                'message': f'Too many authentication attempts. Please wait {max(retry_after, 1)} seconds before trying again.'
            }), 429

        # Record attempt timestamp
        _login_attempts[ip].append(now)
        return f(*args, **kwargs)
    return decorated

def hash_password(password: str) -> str:
    """Hashes a password with secure pbkdf2:sha256 algorithm."""
    return generate_password_hash(password, method='pbkdf2:sha256')

def verify_password(password: str, hashed_password: str) -> bool:
    """Checks password against its hashed value."""
    return check_password_hash(hashed_password, password)

def generate_token(manager_id: int, email: str, name: str) -> str:
    """Generates a secure JWT token valid for Config.JWT_EXPIRATION_HOURS."""
    payload = {
        'manager_id': manager_id,
        'email': email,
        'name': name,
        'exp': datetime.now(timezone.utc) + timedelta(hours=Config.JWT_EXPIRATION_HOURS),
        'iat': datetime.now(timezone.utc)
    }
    return jwt.encode(payload, Config.SECRET_KEY, algorithm='HS256')

def decode_token(token: str) -> dict:
    """Decodes and validates a JWT token."""
    return jwt.decode(token, Config.SECRET_KEY, algorithms=['HS256'])

def token_required(f):
    """Decorator to enforce manager authentication on protected REST endpoints."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'success': False, 'message': 'Authentication token is missing. Please log in.'}), 401

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return jsonify({'success': False, 'message': 'Invalid token format. Expected Bearer <token>'}), 401

        token = parts[1]
        try:
            payload = decode_token(token)
            manager_id = payload.get('manager_id')
            
            # Verify manager exists in database
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id, name, email, created_at FROM managers WHERE id = ?", (manager_id,))
            manager = cursor.fetchone()
            conn.close()

            if not manager:
                return jsonify({'success': False, 'message': 'Authenticated manager account not found.'}), 401

            g.current_manager = row_to_dict(manager)
        except jwt.ExpiredSignatureError:
            return jsonify({'success': False, 'message': 'Session token expired. Please log in again.'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'success': False, 'message': 'Invalid session token. Please log in again.'}), 401
        except Exception as e:
            return jsonify({'success': False, 'message': f'Authentication error: {str(e)}'}), 401

        return f(*args, **kwargs)
    return decorated
