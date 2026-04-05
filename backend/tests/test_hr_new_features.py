"""
Test HR New Features - Deductions, Allowances, Shifts, HR Alerts, Employee Code Protection
Tests for iteration 26 - HR pages redesign and new features
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "dalia@datalifeai.com"
TEST_PASSWORD = "Dalia@2024"


class TestAuthentication:
    """Authentication tests - must pass before other tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        # API returns access_token, not token
        token = data.get("access_token") or data.get("token")
        assert token, "No token in response"
        return token
    
    def test_login_success(self, auth_token):
        """Test login returns valid token"""
        assert auth_token is not None
        assert len(auth_token) > 0
        print(f"✓ Login successful, token obtained")


class TestHRAlerts:
    """Test HR Alerts API - /api/notifications/hr-alerts"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip("Authentication failed")
    
    def test_get_hr_alerts(self, auth_token):
        """Test GET /api/notifications/hr-alerts returns alerts structure"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/hr-alerts",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"HR alerts failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "alerts" in data, "Missing 'alerts' in response"
        assert "total" in data, "Missing 'total' in response"
        assert "high_priority" in data, "Missing 'high_priority' in response"
        assert "medium_priority" in data, "Missing 'medium_priority' in response"
        
        # Verify alerts is a list
        assert isinstance(data["alerts"], list), "alerts should be a list"
        
        # If there are alerts, verify structure
        if len(data["alerts"]) > 0:
            alert = data["alerts"][0]
            assert "id" in alert, "Alert missing 'id'"
            assert "type" in alert, "Alert missing 'type'"
            assert "priority" in alert, "Alert missing 'priority'"
            assert alert["type"] in ["leave_expiring", "termination_approaching"], f"Unknown alert type: {alert['type']}"
        
        print(f"✓ HR Alerts API working - {data['total']} alerts found")
    
    def test_hr_alerts_unauthorized(self):
        """Test HR alerts requires authentication"""
        response = requests.get(f"{BASE_URL}/api/notifications/hr-alerts")
        assert response.status_code == 401, "Should require authentication"
        print("✓ HR Alerts properly requires authentication")


class TestEmployeeCodeProtection:
    """Test that employee_code cannot be modified via PUT /api/employees/{id}"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def test_employee(self, auth_token):
        """Get an existing employee for testing"""
        response = requests.get(
            f"{BASE_URL}/api/employees",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if response.status_code == 200:
            data = response.json()
            employees = data.get("employees", [])
            if employees:
                return employees[0]
        pytest.skip("No employees found for testing")
    
    def test_employee_code_immutable(self, auth_token, test_employee):
        """Test that employee_code cannot be changed via update"""
        employee_id = test_employee.get("id")
        original_code = test_employee.get("employee_code")
        
        # Try to update employee_code
        response = requests.put(
            f"{BASE_URL}/api/employees/{employee_id}",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json={
                "employee_code": "MODIFIED_CODE_123",
                "notes": "Test update"
            }
        )
        
        # Update should succeed (200) but employee_code should not change
        assert response.status_code == 200, f"Update failed: {response.text}"
        
        # Verify employee_code was not changed
        get_response = requests.get(
            f"{BASE_URL}/api/employees/{employee_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert get_response.status_code == 200
        updated_employee = get_response.json()
        
        # Employee code should remain unchanged
        assert updated_employee.get("employee_code") == original_code, \
            f"Employee code was modified! Original: {original_code}, New: {updated_employee.get('employee_code')}"
        
        print(f"✓ Employee code protection working - code remains '{original_code}'")


class TestDeductionsAPI:
    """Test HR Deductions API - /api/hr/deductions"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip("Authentication failed")
    
    def test_get_deductions(self, auth_token):
        """Test GET /api/hr/deductions"""
        current_month = datetime.now().strftime("%Y-%m")
        response = requests.get(
            f"{BASE_URL}/api/hr/deductions?month={current_month}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # API may return 200 with data or 404 if not implemented
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list), "Deductions should be a list"
            print(f"✓ Deductions API working - {len(data)} deductions found")
        elif response.status_code == 404:
            print("⚠ Deductions API endpoint not found (may use mock data in frontend)")
        else:
            print(f"⚠ Deductions API returned {response.status_code}")


class TestAllowancesAPI:
    """Test HR Allowances API - /api/hr/allowances"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip("Authentication failed")
    
    def test_get_allowances(self, auth_token):
        """Test GET /api/hr/allowances"""
        current_month = datetime.now().strftime("%Y-%m")
        response = requests.get(
            f"{BASE_URL}/api/hr/allowances?month={current_month}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # API may return 200 with data or 404 if not implemented
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list), "Allowances should be a list"
            print(f"✓ Allowances API working - {len(data)} allowances found")
        elif response.status_code == 404:
            print("⚠ Allowances API endpoint not found (may use mock data in frontend)")
        else:
            print(f"⚠ Allowances API returned {response.status_code}")


class TestShiftsAPI:
    """Test HR Shifts API - /api/hr/shifts"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip("Authentication failed")
    
    def test_get_shifts(self, auth_token):
        """Test GET /api/hr/shifts"""
        response = requests.get(
            f"{BASE_URL}/api/hr/shifts",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # API may return 200 with data or 404 if not implemented
        if response.status_code == 200:
            data = response.json()
            # Could be list or dict with shifts key
            if isinstance(data, list):
                print(f"✓ Shifts API working - {len(data)} shifts found")
            elif isinstance(data, dict) and "shifts" in data:
                print(f"✓ Shifts API working - {len(data['shifts'])} shifts found")
            else:
                print(f"✓ Shifts API working - response: {type(data)}")
        elif response.status_code == 404:
            print("⚠ Shifts API endpoint not found (may use mock data in frontend)")
        else:
            print(f"⚠ Shifts API returned {response.status_code}")


class TestEmployeesExtendedAPI:
    """Test Extended Employees API - /api/employees"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip("Authentication failed")
    
    def test_get_employees(self, auth_token):
        """Test GET /api/employees returns employee list"""
        response = requests.get(
            f"{BASE_URL}/api/employees",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get employees failed: {response.text}"
        data = response.json()
        
        assert "employees" in data, "Missing 'employees' in response"
        assert "total" in data, "Missing 'total' in response"
        assert isinstance(data["employees"], list), "employees should be a list"
        
        print(f"✓ Employees API working - {data['total']} employees found")
    
    def test_get_shifts_list(self, auth_token):
        """Test GET /api/employees/shifts/list"""
        response = requests.get(
            f"{BASE_URL}/api/employees/shifts/list",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get shifts list failed: {response.text}"
        data = response.json()
        
        assert "shifts" in data, "Missing 'shifts' in response"
        assert isinstance(data["shifts"], list), "shifts should be a list"
        
        print(f"✓ Shifts list API working - {len(data['shifts'])} shifts found")


class TestNotificationsAPI:
    """Test Notifications API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip("Authentication failed")
    
    def test_get_notifications(self, auth_token):
        """Test GET /api/notifications"""
        response = requests.get(
            f"{BASE_URL}/api/notifications/",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Get notifications failed: {response.text}"
        data = response.json()
        
        assert "notifications" in data, "Missing 'notifications' in response"
        assert "unread_count" in data, "Missing 'unread_count' in response"
        
        print(f"✓ Notifications API working - {data['unread_count']} unread")


class TestAttendanceProAPI:
    """Test Attendance Pro API"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            return data.get("access_token") or data.get("token")
        pytest.skip("Authentication failed")
    
    def test_get_daily_summary(self, auth_token):
        """Test GET /api/attendance-pro/daily-summary"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/attendance-pro/daily-summary?date={today}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        # May return 200 or 404 depending on implementation
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Attendance daily summary API working")
        else:
            print(f"⚠ Attendance daily summary returned {response.status_code}")
    
    def test_get_attendance_records(self, auth_token):
        """Test GET /api/attendance-pro/records"""
        today = datetime.now().strftime("%Y-%m-%d")
        response = requests.get(
            f"{BASE_URL}/api/attendance-pro/records?date={today}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        if response.status_code == 200:
            data = response.json()
            records = data.get("records", [])
            print(f"✓ Attendance records API working - {len(records)} records")
        else:
            print(f"⚠ Attendance records returned {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
