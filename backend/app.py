import os
import sys

# Ensure backend package can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from backend.config import Config
from backend.db import init_db
from backend.seed import seed_database
from backend.ist_utils import now_ist_iso, today_ist_str, now_ist
from backend.routes.auth_routes import auth_bp
from backend.routes.worker_routes import worker_bp
from backend.routes.attendance_routes import attendance_bp
from backend.routes.dashboard_routes import dashboard_bp
from backend.routes.report_routes import report_bp

def create_app():
    dist_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'frontend', 'dist')
    
    app = Flask(__name__, static_folder=dist_dir if os.path.exists(dist_dir) else None)
    app.config.from_object(Config)

    # Disable strict slashes so requests with or without trailing slash work seamlessly without 405 errors
    app.url_map.strict_slashes = False

    # Enable CORS for frontend Vite dev server and production origins
    CORS(app, resources={r"/api/*": {"origins": "*"}}, supports_credentials=True)

    # Register API Blueprints
    app.register_blueprint(auth_bp)
    app.register_blueprint(worker_bp)
    app.register_blueprint(attendance_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(report_bp)

    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'server_time_ist': now_ist_iso(),
            'today_ist': today_ist_str(),
            'timezone': 'Asia/Kolkata (IST)'
        })

    @app.route('/api/time', methods=['GET'])
    def get_server_time():
        """Returns the official authoritative IST time generated on the backend."""
        ist_now = now_ist()
        return jsonify({
            'iso': ist_now.isoformat(),
            'date': ist_now.strftime('%Y-%m-%d'),
            'time_display': ist_now.strftime('%I:%M:%S %p'),
            'timezone': 'IST (UTC+05:30)'
        })

    # Serve built React frontend in production
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_frontend(path):
        if app.static_folder and os.path.exists(app.static_folder):
            file_path = os.path.join(app.static_folder, path)
            if path and os.path.exists(file_path):
                return send_from_directory(app.static_folder, path)
            index_path = os.path.join(app.static_folder, 'index.html')
            if os.path.exists(index_path):
                return send_from_directory(app.static_folder, 'index.html')
        return jsonify({'message': 'Company Attendance Management API is running. Start Vite dev server for frontend.'}), 200

    @app.errorhandler(404)
    def handle_404(e):
        if request.path.startswith('/api/'):
            return jsonify({'success': False, 'message': 'API endpoint not found.'}), 404
        if app.static_folder and os.path.exists(os.path.join(app.static_folder, 'index.html')):
            return send_from_directory(app.static_folder, 'index.html')
        return jsonify({'success': False, 'message': 'Resource not found.'}), 404

    @app.errorhandler(405)
    def handle_405(e):
        return jsonify({'success': False, 'message': 'Method not allowed for this route.'}), 405

    @app.errorhandler(500)
    def handle_500(e):
        return jsonify({'success': False, 'message': 'A secure internal server error occurred.'}), 500

    @app.errorhandler(Exception)
    def handle_all_exceptions(e):
        # Never expose database credentials or internal stack traces to the client
        app.logger.error(f"Unhandled exception: {e}")
        return jsonify({'success': False, 'message': 'An unexpected server error occurred. Please try again.'}), 500

    # Ensure database schema and initial employees are seeded on startup
    try:
        seed_database()
    except Exception as err:
        print(f"Database initialization notice: {err}")

    return app

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Starting STS Fintech Attendance Backend on http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
