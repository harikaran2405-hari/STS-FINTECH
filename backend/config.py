import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'sts-fintech-corporate-attendance-secret-key-2026')
    DATABASE_PATH = os.environ.get('DATABASE_PATH', os.path.join(os.path.dirname(__file__), 'attendance.db'))
    DATABASE_URL = os.environ.get('DATABASE_URL')
    JWT_EXPIRATION_HOURS = int(os.environ.get('JWT_EXPIRATION_HOURS', '24'))
    TIMEZONE = 'Asia/Kolkata'
    
    # Secure invitation code for registering additional managers after initial manager setup
    MANAGER_INVITE_CODE = os.environ.get('MANAGER_INVITE_CODE', 'STS-2026-INVITE')
    
    # Rate limiting for auth endpoints (max attempts within sliding window)
    RATE_LIMIT_MAX_ATTEMPTS = int(os.environ.get('RATE_LIMIT_MAX_ATTEMPTS', '15'))
    RATE_LIMIT_WINDOW_SECONDS = int(os.environ.get('RATE_LIMIT_WINDOW_SECONDS', '300'))
