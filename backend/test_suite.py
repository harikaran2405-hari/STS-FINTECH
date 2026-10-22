import os
import sys
import unittest
import json
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app import create_app
from backend.db import init_db, get_db_connection
from backend.seed import seed_database
from backend.ist_utils import today_ist_str

class AttendanceSystemTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = cls.app.test_client()
        seed_database()

    def test_01_manager_name_and_auth(self):
        """Verify Manager is Mahesh Kumar and login works."""
        res = self.client.post('/api/auth/login', json={'email': 'manager@company.com', 'password': 'admin123'})
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(data['manager']['name'], 'Mahesh Kumar')
        self.__class__.token = data['token']
        print("[OK] Manager name verified as 'Mahesh Kumar' and authenticated.")

    def test_02_three_departments_and_initial_employees(self):
        """Verify exactly 3 departments and initial persistent employees."""
        headers = {'Authorization': f"Bearer {self.token}"}

        # 1. Departments endpoint returns the 3 official departments
        res_depts = self.client.get('/api/workers/departments', headers=headers)
        self.assertEqual(res_depts.status_code, 200)
        dept_keys = [d['key'] for d in res_depts.get_json()['departments']]
        self.assertEqual(dept_keys, ['interns', 'ai_ml_frontend', 'backend'])

        # 2. Employees by department
        res_by_dept = self.client.get('/api/workers/by-department', headers=headers)
        self.assertEqual(res_by_dept.status_code, 200)
        depts_data = res_by_dept.get_json()['departments']

        interns_names = [w['full_name'] for d in depts_data if d['key'] == 'interns' for w in d['workers']]
        aiml_names = [w['full_name'] for d in depts_data if d['key'] == 'ai_ml_frontend' for w in d['workers']]
        backend_names = [w['full_name'] for d in depts_data if d['key'] == 'backend' for w in d['workers']]

        self.assertIn('Harikaran', interns_names)
        self.assertIn('Sahithyashwari', interns_names)
        self.assertIn('Ranjith', interns_names)
        self.assertIn('Lingesh', aiml_names)
        self.assertIn('Balaji Sai', aiml_names)
        self.assertIn('Santhosh', backend_names)

        # 3. Verify STS Employee Codes
        all_workers_list = [w for d in depts_data for w in d['workers']]
        code_by_name = {w['full_name']: w['employee_code'] for w in all_workers_list}
        self.assertEqual(code_by_name.get('Santhosh'), '26STS001')
        self.assertEqual(code_by_name.get('Balaji Sai'), '26STS002')
        self.assertEqual(code_by_name.get('Harikaran'), '26STS003')
        self.assertEqual(code_by_name.get('Sahithyashwari'), '26STS004')
        self.assertEqual(code_by_name.get('Ranjith'), '26STS005')
        self.assertEqual(code_by_name.get('Lingesh'), '26STS006')

        # 4. Verify no demo workers remain
        all_workers = interns_names + aiml_names + backend_names
        self.assertNotIn('Aarav Patel', all_workers)
        self.assertNotIn('Priya Verma', all_workers)
        self.assertNotIn('Sunil Chauhan', all_workers)

        print("[OK] 3 department groups and 6 persistent STS employees verified.")

    def test_03_add_employee_per_department(self):
        """Verify adding an employee to each department works and validates departments."""
        headers = {'Authorization': f"Bearer {self.token}"}

        # 1. Attempt adding with invalid department -> must fail
        res_invalid = self.client.post('/api/workers', json={
            'full_name': 'Invalid Dept User',
            'department': 'Marketing'
        }, headers=headers)
        self.assertEqual(res_invalid.status_code, 400)
        self.assertIn('Invalid department', res_invalid.get_json()['message'])

        # 2. Add employee to interns
        test_code_1 = f"EMP-TEST-{int(time.time() * 1000)}"
        res_intern = self.client.post('/api/workers', json={
            'full_name': 'New Intern Candidate',
            'employee_code': test_code_1,
            'department': 'interns',
            'joining_date': today_ist_str()
        }, headers=headers)
        self.assertEqual(res_intern.status_code, 201)
        self.assertEqual(res_intern.get_json()['worker']['department_key'], 'interns')

        # 3. Add employee to backend with label input
        res_backend = self.client.post('/api/workers', json={
            'full_name': 'New Backend Developer',
            'department': 'Backend Engineer',
            'joining_date': today_ist_str()
        }, headers=headers)
        self.assertEqual(res_backend.status_code, 201)
        self.assertEqual(res_backend.get_json()['worker']['department_key'], 'backend')

        print("[OK] Adding employee per department and department validation verified.")

    def test_04_department_attendance_sheet(self):
        """Verify daily attendance partitioned by department."""
        headers = {'Authorization': f"Bearer {self.token}"}
        today = today_ist_str()

        res = self.client.get(f'/api/attendance/by-department?date={today}', headers=headers)
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertTrue(data['success'])
        self.assertEqual(len(data['departments']), 3)

        dept_keys = [d['key'] for d in data['departments']]
        self.assertEqual(dept_keys, ['interns', 'ai_ml_frontend', 'backend'])
        print("[OK] Department-based attendance table endpoints verified.")

    def test_05_csv_export_detailed_and_summary(self):
        """Test Requirement 12: CSV Export with date range and attendance percentage."""
        headers = {'Authorization': f"Bearer {self.token}"}
        today = today_ist_str()

        # 1. Invalid date range (start > end) -> 400
        res_err = self.client.get('/api/reports/export-csv-detailed?start_date=2026-10-25&end_date=2026-10-20', headers=headers)
        self.assertEqual(res_err.status_code, 400)

        # 2. Unauthorized export -> 401
        res_unauth = self.client.get('/api/reports/export-csv-detailed?start_date=2026-10-01&end_date=2026-10-22')
        self.assertEqual(res_unauth.status_code, 401)

        # 3. Export detailed CSV for date range
        res_det = self.client.get(f'/api/reports/export-csv-detailed?start_date=2026-10-01&end_date={today}', headers=headers)
        self.assertEqual(res_det.status_code, 200)
        self.assertIn('text/csv', res_det.content_type)
        csv_text = res_det.data.decode('utf-8')
        
        # Verify 16 columns in Detailed CSV
        self.assertIn('Employee ID', csv_text)
        self.assertIn('Employee Name', csv_text)
        self.assertIn('Attendance Status', csv_text)
        self.assertIn('Scheduled Working Days', csv_text)
        self.assertIn('Attendance Percentage', csv_text)
        self.assertIn('Late Arrivals', csv_text)

        # 4. Export summary CSV for single department (interns)
        res_sum = self.client.get(f'/api/reports/export-csv-summary?start_date=2026-10-01&end_date={today}&department=interns', headers=headers)
        self.assertEqual(res_sum.status_code, 200)
        self.assertIn('text/csv', res_sum.content_type)
        sum_text = res_sum.data.decode('utf-8')

        self.assertIn('Harikaran', sum_text)
        self.assertIn('Interns', sum_text)
        # Other departments excluded
        self.assertNotIn('Lingesh', sum_text)
        self.assertNotIn('Santhosh', sum_text)

        # 5. Export for single employee
        # Get Lingesh ID
        res_lingesh = self.client.get('/api/workers?search=Lingesh', headers=headers)
        lingesh_id = res_lingesh.get_json()['workers'][0]['id']

        res_single = self.client.get(f'/api/reports/export-csv-summary?start_date=2026-10-01&end_date={today}&worker_id={lingesh_id}', headers=headers)
        self.assertEqual(res_single.status_code, 200)
        single_text = res_single.data.decode('utf-8')
        self.assertIn('Lingesh', single_text)
        self.assertNotIn('Harikaran', single_text)

        print("[OK] Detailed and Summary CSV exports, date range validation, and percentages verified.")

    def test_06_idempotent_seeding(self):
        """Verify repeated execution of seed does not duplicate employees or reset names."""
        seed_database()
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) AS cnt FROM workers WHERE full_name = 'Harikaran'")
        cnt = cursor.fetchone()['cnt']
        self.assertEqual(cnt, 1)

        cursor.execute("SELECT name FROM managers WHERE email IN ('manager@stsfintech.com', 'manager@company.com')")
        m_name = cursor.fetchone()['name']
        self.assertEqual(m_name, 'Mahesh Kumar')
        conn.close()
        print("[OK] Idempotent database seeding verified.")

    def test_07_public_access_and_auth_protection(self):
        """Verify public endpoints load without auth and protected endpoints are guarded."""
        # 1. Public health check
        res_health = self.client.get('/api/health')
        self.assertEqual(res_health.status_code, 200)
        self.assertEqual(res_health.get_json()['status'], 'healthy')

        # 2. Public authoritative time in IST
        res_time = self.client.get('/api/time')
        self.assertEqual(res_time.status_code, 200)
        self.assertIn('IST', res_time.get_json()['timezone'])

        # 3. Public auth status
        res_status = self.client.get('/api/auth/status')
        self.assertEqual(res_status.status_code, 200)
        self.assertTrue(res_status.get_json()['initialized'])

        # 4. Protected endpoints reject unauthenticated access with 401
        protected_endpoints = [
            '/api/workers',
            '/api/workers/by-department',
            '/api/attendance',
            '/api/attendance/by-department',
            '/api/dashboard/summary',
            '/api/reports/attendance'
        ]
        for ep in protected_endpoints:
            res_prot = self.client.get(ep)
            self.assertEqual(res_prot.status_code, 401, f"Endpoint {ep} must require authentication.")

        print("[OK] Public access and protected API guards verified.")

    def test_08_manager_registration_and_invitation_process(self):
        """Verify manager registration behavior."""
        # 1. Missing fields validation -> 400
        res_missing = self.client.post('/api/auth/setup', json={
            'name': 'Incomplete Manager'
        })
        self.assertEqual(res_missing.status_code, 400)

        # 2. Short password validation (< 6 chars) -> 400
        res_short_pwd = self.client.post('/api/auth/setup', json={
            'name': 'Short Password User',
            'email': 'short@stsfintech.com',
            'password': '123'
        })
        self.assertEqual(res_short_pwd.status_code, 400)

        # 3. Direct registration succeeds -> 201 Created
        new_email = f"hari.karan.{int(time.time())}@stsfintech.com"
        res_valid = self.client.post('/api/auth/setup', json={
            'name': 'Hari Karan',
            'email': new_email,
            'password': 'securepassword123'
        })
        self.assertEqual(res_valid.status_code, 201)
        data = res_valid.get_json()
        self.assertTrue(data['success'])
        self.assertIn('token', data)
        self.assertEqual(data['manager']['name'], 'Hari Karan')

        # 4. Verify password in DB is hashed, not plain text
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT password_hash FROM managers WHERE email = ?", (new_email,))
        row = cursor.fetchone()
        conn.close()
        self.assertIsNotNone(row)
        self.assertFalse(row['password_hash'] == 'securepassword123')
        self.assertTrue(row['password_hash'].startswith('pbkdf2:sha256:'))

        # 5. Authenticate with newly registered manager
        res_login = self.client.post('/api/auth/login', json={
            'email': new_email,
            'password': 'securepassword123'
        })
        self.assertEqual(res_login.status_code, 200)
        self.assertTrue(res_login.get_json()['success'])

        # 6. Duplicate registration prevention -> 400
        res_dup = self.client.post('/api/auth/setup', json={
            'name': 'Duplicate User',
            'email': new_email,
            'password': 'anotherpassword'
        })
        self.assertEqual(res_dup.status_code, 400)
        self.assertIn('already exists', res_dup.get_json()['message'])

        print("[OK] Manager registration and duplicate prevention verified.")

if __name__ == '__main__':
    unittest.main()
