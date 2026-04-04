"""
Attendance Pro API Tests - اختبارات واجهة الحضور والانصراف
Tests for: check-in, check-out, manual attendance, daily/monthly summaries, fingerprint report, overtime report
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAttendanceProAPI:
    """Attendance Pro API endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "dalia@datalifeai.com",
            "password": "Dalia@2024"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            self.token = token
        else:
            pytest.skip("Authentication failed - skipping tests")
        
        # Get employees for testing
        emp_response = self.session.get(f"{BASE_URL}/api/employees")
        if emp_response.status_code == 200:
            employees = emp_response.json().get("employees", [])
            self.employees = employees
            if employees:
                self.test_employee_id = employees[0].get("id")
        else:
            self.employees = []
            self.test_employee_id = None
    
    # ==========================================
    # Daily Summary Tests
    # ==========================================
    
    def test_get_daily_summary_success(self):
        """Test GET /api/attendance-pro/daily-summary returns statistics"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = self.session.get(f"{BASE_URL}/api/attendance-pro/daily-summary?date={today}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "date" in data
        assert "total_employees" in data
        assert "present_count" in data
        assert "absent_count" in data
        assert "late_count" in data
        assert "attendance_rate" in data
        
        # Verify data types
        assert isinstance(data["total_employees"], int)
        assert isinstance(data["present_count"], int)
        assert isinstance(data["absent_count"], int)
        assert isinstance(data["late_count"], int)
        assert isinstance(data["attendance_rate"], (int, float))
    
    def test_get_daily_summary_with_specific_date(self):
        """Test daily summary for a specific date"""
        response = self.session.get(f"{BASE_URL}/api/attendance-pro/daily-summary?date=2026-01-15")
        
        assert response.status_code == 200
        data = response.json()
        assert data["date"] == "2026-01-15"
    
    # ==========================================
    # Monthly Summary Tests
    # ==========================================
    
    def test_get_monthly_summary_success(self):
        """Test GET /api/attendance-pro/monthly-summary returns employee summaries"""
        response = self.session.get(f"{BASE_URL}/api/attendance-pro/monthly-summary?month=2026-01")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "summaries" in data
        assert "month" in data
        assert isinstance(data["summaries"], list)
        assert data["month"] == "2026-01"
    
    def test_get_monthly_summary_with_employee_filter(self):
        """Test monthly summary filtered by employee"""
        if not self.test_employee_id:
            pytest.skip("No employee available for testing")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance-pro/monthly-summary?month=2026-01&employee_id={self.test_employee_id}"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "summaries" in data
    
    # ==========================================
    # Fingerprint Report Tests
    # ==========================================
    
    def test_get_fingerprint_report_success(self):
        """Test GET /api/attendance-pro/fingerprint-report returns detailed report"""
        response = self.session.get(
            f"{BASE_URL}/api/attendance-pro/fingerprint-report?start_date=2026-01-01&end_date=2026-01-31"
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "report" in data
        assert "statistics" in data
        assert "period" in data
        
        # Verify statistics structure
        stats = data["statistics"]
        assert "total_records" in stats
        assert "total_late_instances" in stats
        assert "total_overtime_hours" in stats
        assert "average_working_hours" in stats
        
        # Verify period
        assert data["period"]["start_date"] == "2026-01-01"
        assert data["period"]["end_date"] == "2026-01-31"
    
    def test_get_fingerprint_report_with_filters(self):
        """Test fingerprint report with department filter"""
        response = self.session.get(
            f"{BASE_URL}/api/attendance-pro/fingerprint-report?start_date=2026-01-01&end_date=2026-01-31&department=المالية"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "report" in data
    
    # ==========================================
    # Overtime Report Tests
    # ==========================================
    
    def test_get_overtime_report_success(self):
        """Test GET /api/attendance-pro/overtime-report returns overtime data"""
        response = self.session.get(f"{BASE_URL}/api/attendance-pro/overtime-report?month=2026-01")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "report" in data
        assert "month" in data
        assert "total_overtime_hours" in data
        
        assert isinstance(data["report"], list)
        assert data["month"] == "2026-01"
        assert isinstance(data["total_overtime_hours"], (int, float))
    
    # ==========================================
    # Check-In Tests
    # ==========================================
    
    def test_check_in_success(self):
        """Test POST /api/attendance-pro/check-in records attendance"""
        if not self.employees or len(self.employees) < 3:
            pytest.skip("Not enough employees for testing")
        
        # Use an employee that might not have a record today
        employee_id = self.employees[-1].get("id")
        
        response = self.session.post(f"{BASE_URL}/api/attendance-pro/check-in", json={
            "employee_id": employee_id,
            "check_in_time": "08:30:00"
        })
        
        # Either success (200) or already checked in (400)
        assert response.status_code in [200, 400]
        
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            assert "record_id" in data
            assert "check_in" in data
            assert "status" in data
    
    def test_check_in_invalid_employee(self):
        """Test check-in with invalid employee ID"""
        response = self.session.post(f"{BASE_URL}/api/attendance-pro/check-in", json={
            "employee_id": "invalid-employee-id",
            "check_in_time": "08:30:00"
        })
        
        assert response.status_code == 404
    
    # ==========================================
    # Check-Out Tests
    # ==========================================
    
    def test_check_out_success(self):
        """Test POST /api/attendance-pro/check-out records checkout and calculates hours"""
        if not self.employees or len(self.employees) < 3:
            pytest.skip("Not enough employees for testing")
        
        # Use an employee that might have checked in
        employee_id = self.employees[-1].get("id")
        
        response = self.session.post(f"{BASE_URL}/api/attendance-pro/check-out", json={
            "employee_id": employee_id,
            "check_out_time": "17:30:00"
        })
        
        # Either success (200), already checked out (400), or no check-in record (404)
        assert response.status_code in [200, 400, 404]
        
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            assert "check_out" in data
            assert "actual_working_hours" in data
    
    def test_check_out_no_check_in(self):
        """Test check-out without prior check-in"""
        response = self.session.post(f"{BASE_URL}/api/attendance-pro/check-out", json={
            "employee_id": "invalid-employee-id",
            "check_out_time": "17:30:00"
        })
        
        assert response.status_code == 404
    
    # ==========================================
    # Manual Attendance Tests
    # ==========================================
    
    def test_manual_attendance_success(self):
        """Test POST /api/attendance-pro/manual creates record"""
        if not self.employees:
            pytest.skip("No employees available for testing")
        
        # Use a unique date to avoid conflicts
        test_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        employee_id = self.employees[0].get("id")
        
        response = self.session.post(f"{BASE_URL}/api/attendance-pro/manual", json={
            "employee_id": employee_id,
            "date": test_date,
            "check_in": "09:00",
            "check_out": "18:00",
            "status": "present",
            "notes": "TEST_Manual attendance record"
        })
        
        # Either success (200) or record already exists (400)
        assert response.status_code in [200, 400]
        
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            assert "record" in data
            
            record = data["record"]
            assert record["employee_id"] == employee_id
            assert record["date"] == test_date
            assert record["status"] == "present"
    
    def test_manual_attendance_invalid_employee(self):
        """Test manual attendance with invalid employee"""
        response = self.session.post(f"{BASE_URL}/api/attendance-pro/manual", json={
            "employee_id": "invalid-employee-id",
            "date": "2026-01-10",
            "check_in": "09:00",
            "check_out": "18:00",
            "status": "present"
        })
        
        assert response.status_code == 404
    
    def test_manual_attendance_with_excused(self):
        """Test manual attendance with excused flag"""
        if not self.employees:
            pytest.skip("No employees available for testing")
        
        test_date = (datetime.now() - timedelta(days=35)).strftime("%Y-%m-%d")
        employee_id = self.employees[0].get("id")
        
        response = self.session.post(f"{BASE_URL}/api/attendance-pro/manual", json={
            "employee_id": employee_id,
            "date": test_date,
            "status": "late",
            "check_in": "10:00",
            "check_out": "18:00",
            "is_excused": True,
            "excuse_reason": "TEST_Traffic jam"
        })
        
        assert response.status_code in [200, 400]
    
    # ==========================================
    # Records CRUD Tests
    # ==========================================
    
    def test_get_records_by_date(self):
        """Test GET /api/attendance-pro/records with date filter"""
        response = self.session.get(f"{BASE_URL}/api/attendance-pro/records?date=2026-01-14")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "records" in data
        assert "total" in data
        assert isinstance(data["records"], list)
    
    def test_get_records_by_date_range(self):
        """Test GET /api/attendance-pro/records with date range"""
        response = self.session.get(
            f"{BASE_URL}/api/attendance-pro/records?start_date=2026-01-01&end_date=2026-01-31"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "records" in data
    
    def test_get_records_by_employee(self):
        """Test GET /api/attendance-pro/records filtered by employee"""
        if not self.test_employee_id:
            pytest.skip("No employee available for testing")
        
        response = self.session.get(
            f"{BASE_URL}/api/attendance-pro/records?employee_id={self.test_employee_id}"
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "records" in data
    
    # ==========================================
    # Statistics Tests
    # ==========================================
    
    def test_get_statistics(self):
        """Test GET /api/attendance-pro/statistics"""
        response = self.session.get(f"{BASE_URL}/api/attendance-pro/statistics?month=2026-01")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "month" in data
        assert "total_employees" in data
        assert "total_records" in data
        assert "present_count" in data
        assert "absent_count" in data
        assert "total_working_hours" in data
        assert "total_overtime_hours" in data
    
    # ==========================================
    # Settings Tests
    # ==========================================
    
    def test_get_settings(self):
        """Test GET /api/attendance-pro/settings"""
        response = self.session.get(f"{BASE_URL}/api/attendance-pro/settings")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify settings structure
        assert "grace_period_minutes" in data
        assert "late_deduction_per_minute" in data
        assert "max_late_minutes_before_absence" in data
        assert "weekend_days" in data
    
    # ==========================================
    # Holidays Tests
    # ==========================================
    
    def test_get_holidays(self):
        """Test GET /api/attendance-pro/holidays"""
        response = self.session.get(f"{BASE_URL}/api/attendance-pro/holidays")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "holidays" in data
        assert isinstance(data["holidays"], list)
    
    def test_add_holiday(self):
        """Test POST /api/attendance-pro/holidays"""
        response = self.session.post(f"{BASE_URL}/api/attendance-pro/holidays", json={
            "name": "TEST_عطلة اختبار",
            "name_en": "TEST_Test Holiday",
            "date": "2026-12-25",
            "is_annual": True
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "holiday" in data


class TestAttendanceProIntegration:
    """Integration tests for attendance workflow"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "dalia@datalifeai.com",
            "password": "Dalia@2024"
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed")
        
        # Get employees
        emp_response = self.session.get(f"{BASE_URL}/api/employees")
        if emp_response.status_code == 200:
            self.employees = emp_response.json().get("employees", [])
        else:
            self.employees = []
    
    def test_full_attendance_workflow(self):
        """Test complete attendance workflow: manual entry -> verify in reports"""
        if not self.employees:
            pytest.skip("No employees available")
        
        employee_id = self.employees[0].get("id")
        test_date = (datetime.now() - timedelta(days=40)).strftime("%Y-%m-%d")
        
        # Step 1: Create manual attendance
        create_response = self.session.post(f"{BASE_URL}/api/attendance-pro/manual", json={
            "employee_id": employee_id,
            "date": test_date,
            "check_in": "08:00",
            "check_out": "19:00",  # 11 hours - 1 hour break = 10 hours, 2 hours overtime
            "status": "present",
            "notes": "TEST_Integration test"
        })
        
        if create_response.status_code == 400:
            # Record already exists, skip
            pytest.skip("Record already exists for this date")
        
        assert create_response.status_code == 200
        record = create_response.json().get("record", {})
        record_id = record.get("id")
        
        # Step 2: Verify in records
        records_response = self.session.get(f"{BASE_URL}/api/attendance-pro/records?date={test_date}")
        assert records_response.status_code == 200
        records = records_response.json().get("records", [])
        
        found = any(r.get("id") == record_id for r in records)
        assert found, "Created record not found in records list"
        
        # Step 3: Verify in daily summary
        summary_response = self.session.get(f"{BASE_URL}/api/attendance-pro/daily-summary?date={test_date}")
        assert summary_response.status_code == 200
        summary = summary_response.json()
        assert summary.get("present_count", 0) >= 1


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
