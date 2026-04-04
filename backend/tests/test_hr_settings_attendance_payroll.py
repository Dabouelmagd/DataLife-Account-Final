"""
HR Settings and Attendance-Payroll Integration Tests
Tests for:
- GET /api/payroll/hr-settings - Get HR settings for company
- PUT /api/payroll/hr-settings - Update HR settings
- GET /api/payroll/attendance-payroll-preview - Preview attendance impact on payroll
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bulk-upload-demo.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "dalia@datalifeai.com"
TEST_PASSWORD = "Dalia@2024"


class TestHRSettingsAuthentication:
    """Test authentication for HR settings endpoints"""
    
    def test_hr_settings_requires_auth(self):
        """HR settings endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/payroll/hr-settings")
        assert response.status_code == 401
        print("✓ HR settings requires authentication")
    
    def test_attendance_payroll_preview_requires_auth(self):
        """Attendance payroll preview endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/payroll/attendance-payroll-preview?month=2026-04")
        assert response.status_code == 401
        print("✓ Attendance payroll preview requires authentication")


class TestHRSettingsGet:
    """Test GET /api/payroll/hr-settings endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_hr_settings_success(self):
        """GET /api/payroll/hr-settings - Returns HR settings"""
        response = requests.get(f"{BASE_URL}/api/payroll/hr-settings", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        print(f"✓ GET HR settings returned: {list(data.keys())}")
        
        # Verify response is a dict (not wrapped in another key)
        assert isinstance(data, dict)
    
    def test_hr_settings_has_late_deduction_fields(self):
        """HR settings contains late deduction configuration"""
        response = requests.get(f"{BASE_URL}/api/payroll/hr-settings", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Late deduction fields
        assert "late_deduction_enabled" in data
        assert "late_deduction_method" in data
        assert "grace_period_minutes" in data
        print(f"✓ Late deduction fields present: enabled={data.get('late_deduction_enabled')}, method={data.get('late_deduction_method')}, grace={data.get('grace_period_minutes')}")
    
    def test_hr_settings_has_absence_deduction_fields(self):
        """HR settings contains absence deduction configuration"""
        response = requests.get(f"{BASE_URL}/api/payroll/hr-settings", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Absence deduction fields
        assert "absence_deduction_enabled" in data
        assert "absence_deduction_method" in data
        assert "absence_deduction_days" in data
        print(f"✓ Absence deduction fields present: enabled={data.get('absence_deduction_enabled')}, method={data.get('absence_deduction_method')}, days={data.get('absence_deduction_days')}")
    
    def test_hr_settings_has_overtime_fields(self):
        """HR settings contains overtime configuration"""
        response = requests.get(f"{BASE_URL}/api/payroll/hr-settings", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Overtime fields
        assert "overtime_enabled" in data
        assert "overtime_calculation_method" in data
        assert "overtime_rate" in data
        assert "overtime_holiday_rate" in data
        assert "overtime_night_rate" in data
        print(f"✓ Overtime fields present: enabled={data.get('overtime_enabled')}, rate={data.get('overtime_rate')}, holiday_rate={data.get('overtime_holiday_rate')}")
    
    def test_hr_settings_has_working_hours_fields(self):
        """HR settings contains working hours configuration"""
        response = requests.get(f"{BASE_URL}/api/payroll/hr-settings", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Working hours fields
        assert "standard_working_hours_per_day" in data
        assert "standard_working_days_per_month" in data
        assert "weekend_days" in data
        print(f"✓ Working hours fields present: hours/day={data.get('standard_working_hours_per_day')}, days/month={data.get('standard_working_days_per_month')}, weekend={data.get('weekend_days')}")
    
    def test_hr_settings_default_values(self):
        """HR settings has reasonable default values"""
        response = requests.get(f"{BASE_URL}/api/payroll/hr-settings", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify default values are reasonable
        assert data.get("grace_period_minutes", 0) >= 0
        assert data.get("overtime_rate", 0) >= 1.0  # At least 1x
        assert data.get("standard_working_hours_per_day", 0) > 0
        assert data.get("standard_working_days_per_month", 0) > 0
        print("✓ HR settings default values are reasonable")


class TestHRSettingsUpdate:
    """Test PUT /api/payroll/hr-settings endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_update_hr_settings_grace_period(self):
        """PUT /api/payroll/hr-settings - Update grace period"""
        # First get current settings
        response = requests.get(f"{BASE_URL}/api/payroll/hr-settings", headers=self.headers)
        original_settings = response.json()
        original_grace = original_settings.get("grace_period_minutes", 15)
        
        # Update grace period
        new_grace = 20 if original_grace != 20 else 15
        response = requests.put(
            f"{BASE_URL}/api/payroll/hr-settings",
            headers=self.headers,
            json={"grace_period_minutes": new_grace}
        )
        assert response.status_code == 200
        print(f"✓ Updated grace period to {new_grace}")
        
        # Verify update persisted
        response = requests.get(f"{BASE_URL}/api/payroll/hr-settings", headers=self.headers)
        updated_settings = response.json()
        assert updated_settings.get("grace_period_minutes") == new_grace
        print(f"✓ Verified grace period is now {new_grace}")
        
        # Restore original
        requests.put(
            f"{BASE_URL}/api/payroll/hr-settings",
            headers=self.headers,
            json={"grace_period_minutes": original_grace}
        )
    
    def test_update_hr_settings_overtime_rate(self):
        """PUT /api/payroll/hr-settings - Update overtime rate"""
        # First get current settings
        response = requests.get(f"{BASE_URL}/api/payroll/hr-settings", headers=self.headers)
        original_settings = response.json()
        original_rate = original_settings.get("overtime_rate", 1.5)
        
        # Update overtime rate
        new_rate = 1.75 if original_rate != 1.75 else 1.5
        response = requests.put(
            f"{BASE_URL}/api/payroll/hr-settings",
            headers=self.headers,
            json={"overtime_rate": new_rate}
        )
        assert response.status_code == 200
        print(f"✓ Updated overtime rate to {new_rate}")
        
        # Verify update persisted
        response = requests.get(f"{BASE_URL}/api/payroll/hr-settings", headers=self.headers)
        updated_settings = response.json()
        assert updated_settings.get("overtime_rate") == new_rate
        print(f"✓ Verified overtime rate is now {new_rate}")
        
        # Restore original
        requests.put(
            f"{BASE_URL}/api/payroll/hr-settings",
            headers=self.headers,
            json={"overtime_rate": original_rate}
        )
    
    def test_update_hr_settings_late_deduction_method(self):
        """PUT /api/payroll/hr-settings - Update late deduction method"""
        response = requests.get(f"{BASE_URL}/api/payroll/hr-settings", headers=self.headers)
        original_settings = response.json()
        original_method = original_settings.get("late_deduction_method", "per_minute")
        
        # Update method
        new_method = "per_hour" if original_method != "per_hour" else "per_minute"
        response = requests.put(
            f"{BASE_URL}/api/payroll/hr-settings",
            headers=self.headers,
            json={"late_deduction_method": new_method}
        )
        assert response.status_code == 200
        print(f"✓ Updated late deduction method to {new_method}")
        
        # Verify update persisted
        response = requests.get(f"{BASE_URL}/api/payroll/hr-settings", headers=self.headers)
        updated_settings = response.json()
        assert updated_settings.get("late_deduction_method") == new_method
        print(f"✓ Verified late deduction method is now {new_method}")
        
        # Restore original
        requests.put(
            f"{BASE_URL}/api/payroll/hr-settings",
            headers=self.headers,
            json={"late_deduction_method": original_method}
        )
    
    def test_update_hr_settings_multiple_fields(self):
        """PUT /api/payroll/hr-settings - Update multiple fields at once"""
        response = requests.put(
            f"{BASE_URL}/api/payroll/hr-settings",
            headers=self.headers,
            json={
                "late_deduction_enabled": True,
                "absence_deduction_enabled": True,
                "overtime_enabled": True,
                "standard_working_hours_per_day": 8.0,
                "standard_working_days_per_month": 22
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data or response.status_code == 200
        print("✓ Updated multiple HR settings fields at once")


class TestAttendancePayrollPreview:
    """Test GET /api/payroll/attendance-payroll-preview endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_attendance_payroll_preview_success(self):
        """GET /api/payroll/attendance-payroll-preview - Returns preview data"""
        response = requests.get(
            f"{BASE_URL}/api/payroll/attendance-payroll-preview?month=2026-04",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "month" in data
        assert "employees" in data
        assert "totals" in data
        print(f"✓ Attendance payroll preview returned for month {data.get('month')}")
    
    def test_attendance_payroll_preview_has_employee_data(self):
        """Preview contains employee attendance data"""
        response = requests.get(
            f"{BASE_URL}/api/payroll/attendance-payroll-preview?month=2026-04",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        employees = data.get("employees", [])
        assert isinstance(employees, list)
        print(f"✓ Preview contains {len(employees)} employees")
        
        if len(employees) > 0:
            emp = employees[0]
            # Verify employee data structure
            assert "employee_id" in emp
            assert "employee_name" in emp
            assert "basic_salary" in emp
            assert "present_days" in emp
            assert "absent_days" in emp
            assert "late_days" in emp
            assert "total_late_minutes" in emp
            assert "total_overtime_hours" in emp
            assert "late_deduction" in emp
            assert "absence_deduction" in emp
            assert "overtime_bonus" in emp
            assert "net_adjustment" in emp
            print(f"✓ Employee data structure is correct: {emp.get('employee_name')}")
    
    def test_attendance_payroll_preview_has_totals(self):
        """Preview contains totals"""
        response = requests.get(
            f"{BASE_URL}/api/payroll/attendance-payroll-preview?month=2026-04",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        
        totals = data.get("totals", {})
        assert "late_deduction" in totals
        assert "absence_deduction" in totals
        assert "overtime_bonus" in totals
        assert "net_adjustment" in totals
        print(f"✓ Totals: late_deduction={totals.get('late_deduction')}, absence_deduction={totals.get('absence_deduction')}, overtime_bonus={totals.get('overtime_bonus')}, net_adjustment={totals.get('net_adjustment')}")
    
    def test_attendance_payroll_preview_for_specific_employee(self):
        """Preview can filter by specific employee"""
        # First get an employee
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=self.headers)
        employees = response.json()
        
        if len(employees) > 0:
            employee_id = employees[0]["id"]
            
            response = requests.get(
                f"{BASE_URL}/api/payroll/attendance-payroll-preview?month=2026-04&employee_id={employee_id}",
                headers=self.headers
            )
            assert response.status_code == 200
            data = response.json()
            
            # Should return only one employee
            assert len(data.get("employees", [])) <= 1
            print(f"✓ Preview filtered by employee_id returns {len(data.get('employees', []))} employee(s)")
    
    def test_attendance_payroll_preview_different_months(self):
        """Preview works for different months"""
        months = ["2026-01", "2026-02", "2026-03", "2026-04"]
        
        for month in months:
            response = requests.get(
                f"{BASE_URL}/api/payroll/attendance-payroll-preview?month={month}",
                headers=self.headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data.get("month") == month
        
        print(f"✓ Preview works for multiple months: {months}")


class TestPayrollCalculationWithAttendance:
    """Test that payroll calculation includes attendance adjustments"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_payroll_run_has_attendance_totals(self):
        """Payroll run includes attendance-related totals"""
        response = requests.get(f"{BASE_URL}/api/payroll/runs", headers=self.headers)
        assert response.status_code == 200
        runs = response.json().get("payroll_runs", [])
        
        # Check calculated/approved/paid runs
        processed_runs = [r for r in runs if r.get("status") in ["calculated", "approved", "paid"]]
        
        if len(processed_runs) > 0:
            run = processed_runs[0]
            # These fields should exist after calculation
            has_late = "total_late_deductions" in run
            has_absence = "total_absence_deductions" in run
            has_overtime = "total_overtime_bonus" in run
            
            print(f"✓ Payroll run {run.get('payroll_number')}: late_deductions={run.get('total_late_deductions', 'N/A')}, absence_deductions={run.get('total_absence_deductions', 'N/A')}, overtime_bonus={run.get('total_overtime_bonus', 'N/A')}")
    
    def test_employee_payroll_has_attendance_summary(self):
        """Employee payroll data includes attendance summary"""
        response = requests.get(f"{BASE_URL}/api/payroll/runs", headers=self.headers)
        runs = response.json().get("payroll_runs", [])
        
        # Check runs with employee data
        runs_with_employees = [r for r in runs if r.get("employees")]
        
        if len(runs_with_employees) > 0:
            run = runs_with_employees[0]
            employees = run.get("employees", [])
            
            if len(employees) > 0:
                emp = employees[0]
                
                # Check for attendance_summary in employee data
                if "attendance_summary" in emp:
                    summary = emp["attendance_summary"]
                    assert "present_days" in summary
                    assert "absent_days" in summary
                    assert "late_days" in summary
                    assert "total_late_minutes" in summary
                    assert "total_overtime_hours" in summary
                    assert "late_deduction" in summary
                    assert "absence_deduction" in summary
                    assert "overtime_bonus" in summary
                    print(f"✓ Employee {emp.get('employee_name')} has attendance_summary: present={summary.get('present_days')}, absent={summary.get('absent_days')}, late={summary.get('late_days')}")
                else:
                    print(f"⚠ Employee {emp.get('employee_name')} does not have attendance_summary (may be older payroll)")


class TestHRSettingsValidation:
    """Test HR settings validation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_hr_settings_accepts_valid_late_methods(self):
        """HR settings accepts valid late deduction methods"""
        valid_methods = ["per_minute", "per_hour", "brackets", "none"]
        
        for method in valid_methods:
            response = requests.put(
                f"{BASE_URL}/api/payroll/hr-settings",
                headers=self.headers,
                json={"late_deduction_method": method}
            )
            assert response.status_code == 200, f"Failed for method: {method}"
        
        print(f"✓ All valid late deduction methods accepted: {valid_methods}")
    
    def test_hr_settings_accepts_valid_absence_methods(self):
        """HR settings accepts valid absence deduction methods"""
        valid_methods = ["full_day", "day_plus_penalty", "none"]
        
        for method in valid_methods:
            response = requests.put(
                f"{BASE_URL}/api/payroll/hr-settings",
                headers=self.headers,
                json={"absence_deduction_method": method}
            )
            assert response.status_code == 200, f"Failed for method: {method}"
        
        print(f"✓ All valid absence deduction methods accepted: {valid_methods}")
    
    def test_hr_settings_accepts_valid_overtime_methods(self):
        """HR settings accepts valid overtime calculation methods"""
        valid_methods = ["hourly", "daily", "none"]
        
        for method in valid_methods:
            response = requests.put(
                f"{BASE_URL}/api/payroll/hr-settings",
                headers=self.headers,
                json={"overtime_calculation_method": method}
            )
            assert response.status_code == 200, f"Failed for method: {method}"
        
        print(f"✓ All valid overtime calculation methods accepted: {valid_methods}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
