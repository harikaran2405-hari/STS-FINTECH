from datetime import datetime, timezone, timedelta
from dateutil import parser
import pytz

IST_TZ = pytz.timezone('Asia/Kolkata')
IST_OFFSET = timezone(timedelta(hours=5, minutes=30))

def now_ist() -> datetime:
    """Returns current datetime in Indian Standard Time (IST)."""
    return datetime.now(IST_TZ)

def today_ist_str() -> str:
    """Returns today's date in IST formatted as YYYY-MM-DD."""
    return now_ist().strftime('%Y-%m-%d')

def now_ist_iso() -> str:
    """Returns current IST datetime formatted as ISO 8601 string."""
    return now_ist().isoformat()

def parse_to_ist(dt_str: str) -> datetime:
    """Parses any valid datetime string and converts to IST timezone."""
    if not dt_str:
        return None
    dt = parser.parse(dt_str)
    if dt.tzinfo is None:
        dt = IST_TZ.localize(dt)
    else:
        dt = dt.astimezone(IST_TZ)
    return dt

def format_time_display(dt_str: str) -> str:
    """Formats an ISO datetime string into human readable IST time, e.g. '09:30 AM'."""
    if not dt_str:
        return "-"
    try:
        dt = parse_to_ist(dt_str)
        return dt.strftime('%I:%M %p')
    except Exception:
        return dt_str

def format_date_display(date_str: str) -> str:
    """Formats YYYY-MM-DD or ISO string into readable format, e.g. '22 Oct 2026'."""
    if not date_str:
        return "-"
    try:
        if 'T' in date_str or ' ' in date_str:
            dt = parse_to_ist(date_str)
        else:
            dt = datetime.strptime(date_str, '%Y-%m-%d')
        return dt.strftime('%d %b %Y')
    except Exception:
        return date_str

def calculate_working_minutes(time_in_str: str, time_out_str: str) -> int:
    """
    Calculates total elapsed minutes between time_in and time_out.
    Accurately supports standard and overnight shifts.
    """
    if not time_in_str or not time_out_str:
        return None
    try:
        t_in = parse_to_ist(time_in_str)
        t_out = parse_to_ist(time_out_str)
        
        diff = t_out - t_in
        minutes = int(diff.total_seconds() // 60)
        
        # If overnight shift entered as times on same nominal date but t_out is earlier,
        # add 24 hours (1440 minutes)
        if minutes < 0:
            minutes += 24 * 60
            
        return max(0, minutes)
    except Exception:
        return 0

def format_duration(minutes: int) -> str:
    """Formats minutes into human readable 'Xh Ym' or '0h 0m'."""
    if minutes is None:
        return "-"
    hours = minutes // 60
    mins = minutes % 60
    if hours > 0 and mins > 0:
        return f"{hours}h {mins}m"
    elif hours > 0:
        return f"{hours}h"
    else:
        return f"{mins}m"
