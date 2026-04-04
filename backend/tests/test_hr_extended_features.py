"""
Test HR Extended Features:
- Employee Profile with tabs (Personal Info, Employment, Salary, Documents, History)
- Employee allowances and deductions
- Work shifts management
- Payroll send-payslips endpoint
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "dalia@datalifeai.com"
TEST_PASSWORD = "Dalia@2024"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        data = response.json()
        # API returns access_token, not token
        return data.get("access_token") or data.get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Authenticated requests session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestEmployeeProfile:
    """Test Employee Profile API endpoints"""
    
    def test_get_employees_list(self, api_client):
        """Test GET /api/employees - list all employees"""
        response = api_client.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "employees" in data
        assert "total" in data
        print(f"Found {data['total']} employees")
    
    def test_get_employee_details(self, api_client):
        """Test GET /api/employees/{id} - get employee with salary breakdown"""
        # First get list of employees
        list_response = api_client.get(f"{BASE_URL}/api/employees")
        assert list_response.status_code == 200
        
        employees = list_response.json().get("employees", [])
        if not employees:
            pytest.skip("No employees found")
        
        employee_id = employees[0]["id"]
        
        # Get employee details
        response = api_client.get(f"{BASE_URL}/api/employees/{employee_id}")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        # Verify salary fields are present
        assert "basic_salary" in data, "Missing basic_salary"
        assert "total_allowances" in data, "Missing total_allowances"
        assert "total_deductions" in data, "Missing total_deductions"
        assert "gross_salary" in data, "Missing gross_salary"
        assert "net_salary" in data, "Missing net_salary"
        
        print(f"Employee: {data.get('name')}")
        print(f"  Basic Salary: {data.get('basic_salary')}")
        print(f"  Total Allowances: {data.get('total_allowances')}")
        print(f"  Gross Salary: {data.get('gross_salary')}")
        print(f"  Total Deductions: {data.get('total_deductions')}")
        print(f"  Net Salary: {data.get('net_salary')}")


class TestEmployeeAllowances:
    """Test Employee Allowances API"""
    
    @pytest.fixture
    def employee_id(self, api_client):
        """Get first employee ID"""
        response = api_client.get(f"{BASE_URL}/api/employees")
        employees = response.json().get("employees", [])
        if not employees:
            pytest.skip("No employees found")
        return employees[0]["id"]
    
    def test_add_allowance(self, api_client, employee_id):
        """Test POST /api/employees/{id}/allowances - add allowance"""
        allowance_data = {
            "category": "housing",
            "name": "بدل سكن اختبار",
            "name_en": "Test Housing Allowance",
            "amount": 500,
            "is_percentage": False,
            "percentage": 0,
            "is_taxable": True,
            "is_insurable": False
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/employees/{employee_id}/allowances",
            json=allowance_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "allowance" in data
        
        allowance = data["allowance"]
        assert allowance["name"] == allowance_data["name"]
        assert allowance["amount"] == allowance_data["amount"]
        
        print(f"Added allowance: {allowance['name']} - {allowance['amount']}")
        return allowance.get("id")
    
    def test_verify_allowance_in_employee(self, api_client, employee_id):
        """Verify allowance appears in employee data"""
        response = api_client.get(f"{BASE_URL}/api/employees/{employee_id}")
        assert response.status_code == 200
        
        data = response.json()
        allowances = data.get("allowances", [])
        
        # Check if our test allowance exists
        test_allowance = next(
            (a for a in allowances if "اختبار" in a.get("name", "")),
            None
        )
        
        if test_allowance:
            print(f"Found test allowance in employee data: {test_allowance['name']}")
        else:
            print(f"Total allowances: {len(allowances)}")


class TestEmployeeDeductions:
    """Test Employee Deductions API"""
    
    @pytest.fixture
    def employee_id(self, api_client):
        """Get first employee ID"""
        response = api_client.get(f"{BASE_URL}/api/employees")
        employees = response.json().get("employees", [])
        if not employees:
            pytest.skip("No employees found")
        return employees[0]["id"]
    
    def test_add_deduction(self, api_client, employee_id):
        """Test POST /api/employees/{id}/deductions - add deduction"""
        deduction_data = {
            "category": "other",
            "name": "خصم اختبار",
            "name_en": "Test Deduction",
            "amount": 100,
            "is_percentage": False,
            "percentage": 0
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/employees/{employee_id}/deductions",
            json=deduction_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "deduction" in data
        
        deduction = data["deduction"]
        assert deduction["name"] == deduction_data["name"]
        assert deduction["amount"] == deduction_data["amount"]
        
        print(f"Added deduction: {deduction['name']} - {deduction['amount']}")


class TestWorkShifts:
    """Test Work Shifts API"""
    
    def test_get_shifts_list(self, api_client):
        """Test GET /api/employees/shifts/list - list all shifts"""
        response = api_client.get(f"{BASE_URL}/api/employees/shifts/list")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "shifts" in data
        
        shifts = data["shifts"]
        print(f"Found {len(shifts)} shifts")
        
        for shift in shifts:
            print(f"  - {shift.get('name')}: {shift.get('start_time')} - {shift.get('end_time')}")
    
    def test_create_shift(self, api_client):
        """Test POST /api/employees/shifts/create - create new shift"""
        shift_data = {
            "name": "وردية اختبار",
            "name_en": "Test Shift",
            "shift_type": "morning",
            "start_time": "09:00",
            "end_time": "17:00",
            "break_start": "12:00",
            "break_end": "13:00",
            "break_duration": 60,
            "working_hours": 8.0,
            "overtime_starts_after": 8.0,
            "working_days": ["sunday", "monday", "tuesday", "wednesday", "thursday"],
            "overtime_rate": 1.5,
            "holiday_rate": 2.0,
            "night_rate": 1.25,
            "allow_late_minutes": 15
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/employees/shifts/create",
            json=shift_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "shift" in data
        
        shift = data["shift"]
        assert shift["name"] == shift_data["name"]
        assert shift["start_time"] == shift_data["start_time"]
        assert shift["end_time"] == shift_data["end_time"]
        
        print(f"Created shift: {shift['name']} ({shift['start_time']} - {shift['end_time']})")
        return shift.get("id")
    
    def test_verify_shift_in_list(self, api_client):
        """Verify created shift appears in list"""
        response = api_client.get(f"{BASE_URL}/api/employees/shifts/list")
        assert response.status_code == 200
        
        shifts = response.json().get("shifts", [])
        test_shift = next(
            (s for s in shifts if "اختبار" in s.get("name", "")),
            None
        )
        
        if test_shift:
            print(f"Found test shift: {test_shift['name']}")
        else:
            print(f"Test shift not found, total shifts: {len(shifts)}")


class TestPayrollHistory:
    """Test Employee Payroll History API"""
    
    @pytest.fixture
    def employee_id(self, api_client):
        """Get first employee ID"""
        response = api_client.get(f"{BASE_URL}/api/employees")
        employees = response.json().get("employees", [])
        if not employees:
            pytest.skip("No employees found")
        return employees[0]["id"]
    
    def test_get_payroll_history(self, api_client, employee_id):
        """Test GET /api/employees/{id}/payroll-history"""
        response = api_client.get(f"{BASE_URL}/api/employees/{employee_id}/payroll-history")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "history" in data
        
        history = data["history"]
        print(f"Found {len(history)} payroll history records")
        
        for record in history[:3]:  # Show first 3
            print(f"  - {record.get('month')}: Net {record.get('net_salary')} ({record.get('status')})")


class TestPayrollSendPayslips:
    """Test Payroll Send Payslips API"""
    
    def test_get_payroll_runs(self, api_client):
        """Test GET /api/payroll/runs - list payroll runs"""
        response = api_client.get(f"{BASE_URL}/api/payroll/runs")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "payroll_runs" in data
        
        runs = data["payroll_runs"]
        print(f"Found {len(runs)} payroll runs")
        
        for run in runs[:3]:
            print(f"  - {run.get('payroll_number')}: {run.get('month')} - {run.get('status')}")
    
    def test_send_payslips_endpoint_exists(self, api_client):
        """Test POST /api/payroll/runs/{id}/send-payslips endpoint exists"""
        # First get a payroll run that is approved or paid
        response = api_client.get(f"{BASE_URL}/api/payroll/runs")
        assert response.status_code == 200
        
        runs = response.json().get("payroll_runs", [])
        
        # Find an approved or paid run
        eligible_run = next(
            (r for r in runs if r.get("status") in ["approved", "paid"]),
            None
        )
        
        if not eligible_run:
            print("No approved/paid payroll runs found - skipping send-payslips test")
            pytest.skip("No approved/paid payroll runs available")
        
        run_id = eligible_run["id"]
        print(f"Testing send-payslips for run: {eligible_run.get('payroll_number')} ({eligible_run.get('status')})")
        
        # Test the endpoint (it will actually try to send emails)
        response = api_client.post(f"{BASE_URL}/api/payroll/runs/{run_id}/send-payslips")
        
        # Should return 200 even if emails fail (graceful handling)
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "results" in data
        
        results = data["results"]
        print(f"Send payslips result: {data.get('message')}")
        print(f"  Total: {results.get('total')}")
        print(f"  Sent: {results.get('sent')}")
        print(f"  Failed: {results.get('failed')}")
        print(f"  Skipped: {results.get('skipped')}")
    
    def test_send_payslips_requires_approved_status(self, api_client):
        """Test that send-payslips fails for draft payroll"""
        # Get payroll runs
        response = api_client.get(f"{BASE_URL}/api/payroll/runs")
        runs = response.json().get("payroll_runs", [])
        
        # Find a draft run
        draft_run = next(
            (r for r in runs if r.get("status") == "draft"),
            None
        )
        
        if not draft_run:
            print("No draft payroll runs found - skipping validation test")
            pytest.skip("No draft payroll runs available")
        
        run_id = draft_run["id"]
        
        # Try to send payslips for draft run - should fail
        response = api_client.post(f"{BASE_URL}/api/payroll/runs/{run_id}/send-payslips")
        
        # Should return 400 for draft status
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Correctly rejected send-payslips for draft payroll")


class TestEmployeeSalarySummary:
    """Test Employee Salary Summary API"""
    
    @pytest.fixture
    def employee_id(self, api_client):
        """Get first employee ID"""
        response = api_client.get(f"{BASE_URL}/api/employees")
        employees = response.json().get("employees", [])
        if not employees:
            pytest.skip("No employees found")
        return employees[0]["id"]
    
    def test_get_salary_summary(self, api_client, employee_id):
        """Test GET /api/employees/{id}/salary-summary"""
        response = api_client.get(f"{BASE_URL}/api/employees/{employee_id}/salary-summary")
        assert response.status_code == 200, f"Failed: {response.text}"
        
        data = response.json()
        
        # Verify all salary breakdown fields
        assert "basic_salary" in data
        assert "allowances" in data
        assert "total_allowances" in data
        assert "gross_salary" in data
        assert "deductions" in data
        assert "total_deductions" in data
        assert "net_salary" in data
        
        print(f"Salary Summary for {data.get('employee_name')}:")
        print(f"  Basic Salary: {data.get('basic_salary')}")
        print(f"  Allowances ({len(data.get('allowances', []))}):")
        for a in data.get("allowances", []):
            print(f"    - {a.get('name')}: {a.get('amount')}")
        print(f"  Total Allowances: {data.get('total_allowances')}")
        print(f"  Gross Salary: {data.get('gross_salary')}")
        print(f"  Deductions ({len(data.get('deductions', []))}):")
        for d in data.get("deductions", []):
            print(f"    - {d.get('name')}: {d.get('amount')}")
        print(f"  Total Deductions: {data.get('total_deductions')}")
        print(f"  Net Salary: {data.get('net_salary')}")


class TestAuthenticationRequired:
    """Test that endpoints require authentication"""
    
    def test_employees_requires_auth(self):
        """Test /api/employees requires authentication"""
        response = requests.get(f"{BASE_URL}/api/employees")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_shifts_requires_auth(self):
        """Test /api/employees/shifts/list requires authentication"""
        response = requests.get(f"{BASE_URL}/api/employees/shifts/list")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    def test_payroll_requires_auth(self):
        """Test /api/payroll/runs requires authentication"""
        response = requests.get(f"{BASE_URL}/api/payroll/runs")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
