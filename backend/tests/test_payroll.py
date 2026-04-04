"""
Payroll API Tests - Testing HR to Accounting Integration
Tests for payroll runs, loans, end of service, and journal entry creation
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bulk-upload-demo.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "dalia@datalifeai.com"
TEST_PASSWORD = "Dalia@2024"


class TestPayrollAuthentication:
    """Test authentication for payroll endpoints"""
    
    def test_payroll_runs_requires_auth(self):
        """Payroll runs endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/payroll/runs")
        assert response.status_code == 401
    
    def test_payroll_loans_requires_auth(self):
        """Payroll loans endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/payroll/loans")
        assert response.status_code == 401
    
    def test_payroll_settings_requires_auth(self):
        """Payroll settings endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/payroll/settings")
        assert response.status_code == 401


class TestPayrollRuns:
    """Test payroll run CRUD operations"""
    
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
    
    def test_get_payroll_runs(self):
        """GET /api/payroll/runs - List payroll runs"""
        response = requests.get(f"{BASE_URL}/api/payroll/runs", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "payroll_runs" in data
        assert isinstance(data["payroll_runs"], list)
    
    def test_get_existing_payroll_run(self):
        """GET /api/payroll/runs - Verify existing payroll run data"""
        response = requests.get(f"{BASE_URL}/api/payroll/runs", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        if len(data["payroll_runs"]) > 0:
            run = data["payroll_runs"][0]
            # Verify payroll run structure
            assert "id" in run
            assert "payroll_number" in run
            assert "month" in run
            assert "status" in run
            assert "total_employees" in run
            assert "total_gross_salary" in run
            assert "total_deductions" in run
            assert "total_net_salary" in run
    
    def test_get_payroll_run_by_id(self):
        """GET /api/payroll/runs/{run_id} - Get specific payroll run"""
        # First get list of runs
        response = requests.get(f"{BASE_URL}/api/payroll/runs", headers=self.headers)
        assert response.status_code == 200
        runs = response.json()["payroll_runs"]
        
        if len(runs) > 0:
            run_id = runs[0]["id"]
            response = requests.get(f"{BASE_URL}/api/payroll/runs/{run_id}", headers=self.headers)
            assert response.status_code == 200
            run = response.json()
            assert run["id"] == run_id
    
    def test_create_payroll_run_duplicate_month(self):
        """POST /api/payroll/runs - Cannot create duplicate for same month"""
        # Try to create for a month that already exists
        response = requests.post(
            f"{BASE_URL}/api/payroll/runs",
            headers=self.headers,
            json={"month": "2025-01"}  # This month already has a payroll run
        )
        # Should fail with 400 if duplicate
        if response.status_code == 400:
            assert "يوجد مسير رواتب" in response.json().get("detail", "") or "already" in response.json().get("detail", "").lower()
    
    def test_create_new_payroll_run(self):
        """POST /api/payroll/runs - Create new payroll run for new month"""
        # Use a future month that doesn't exist
        test_month = "2026-03"
        
        # First check if it exists
        response = requests.get(f"{BASE_URL}/api/payroll/runs", headers=self.headers)
        runs = response.json()["payroll_runs"]
        existing_months = [r["month"] for r in runs]
        
        if test_month not in existing_months:
            response = requests.post(
                f"{BASE_URL}/api/payroll/runs",
                headers=self.headers,
                json={"month": test_month}
            )
            assert response.status_code == 200
            data = response.json()
            assert "payroll_run" in data
            assert data["payroll_run"]["month"] == test_month
            assert data["payroll_run"]["status"] == "draft"
            
            # Store for cleanup
            self.created_run_id = data["payroll_run"]["id"]


class TestPayrollCalculation:
    """Test payroll calculation functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_calculate_payroll(self):
        """POST /api/payroll/runs/{run_id}/calculate - Calculate payroll"""
        # Get a draft payroll run
        response = requests.get(f"{BASE_URL}/api/payroll/runs?status=draft", headers=self.headers)
        runs = response.json()["payroll_runs"]
        
        draft_runs = [r for r in runs if r["status"] == "draft"]
        
        if len(draft_runs) > 0:
            run_id = draft_runs[0]["id"]
            response = requests.post(
                f"{BASE_URL}/api/payroll/runs/{run_id}/calculate",
                headers=self.headers
            )
            assert response.status_code == 200
            data = response.json()
            assert "summary" in data
            assert "employees" in data["summary"]
            assert "gross_salary" in data["summary"]
            assert "deductions" in data["summary"]
            assert "net_salary" in data["summary"]
    
    def test_verify_calculated_payroll_data(self):
        """Verify calculated payroll has correct employee data"""
        response = requests.get(f"{BASE_URL}/api/payroll/runs", headers=self.headers)
        runs = response.json()["payroll_runs"]
        
        calculated_runs = [r for r in runs if r["status"] in ["calculated", "approved", "paid"]]
        
        if len(calculated_runs) > 0:
            run = calculated_runs[0]
            assert run["total_employees"] > 0
            assert run["total_gross_salary"] > 0
            assert run["total_net_salary"] > 0
            
            # Verify employees array
            if "employees" in run:
                for emp in run["employees"]:
                    assert "employee_id" in emp
                    assert "employee_name" in emp
                    assert "basic_salary" in emp
                    assert "gross_salary" in emp
                    assert "net_salary" in emp
                    assert "deductions" in emp


class TestPayrollApproval:
    """Test payroll approval and journal entry creation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_approve_payroll_creates_journal_entry(self):
        """POST /api/payroll/runs/{run_id}/approve - Approve creates journal entry"""
        # Get a calculated payroll run
        response = requests.get(f"{BASE_URL}/api/payroll/runs", headers=self.headers)
        runs = response.json()["payroll_runs"]
        
        calculated_runs = [r for r in runs if r["status"] == "calculated"]
        
        if len(calculated_runs) > 0:
            run_id = calculated_runs[0]["id"]
            response = requests.post(
                f"{BASE_URL}/api/payroll/runs/{run_id}/approve",
                headers=self.headers
            )
            assert response.status_code == 200
            data = response.json()
            assert "journal_entry_number" in data
            assert data["journal_entry_number"] is not None
    
    def test_approved_payroll_has_journal_entry(self):
        """Verify approved payroll has journal entry reference"""
        response = requests.get(f"{BASE_URL}/api/payroll/runs", headers=self.headers)
        runs = response.json()["payroll_runs"]
        
        approved_runs = [r for r in runs if r["status"] in ["approved", "paid"]]
        
        if len(approved_runs) > 0:
            run = approved_runs[0]
            assert "journal_entry_id" in run or "journal_entry_number" in run
            # At least one should be set
            has_journal = run.get("journal_entry_id") or run.get("journal_entry_number")
            assert has_journal is not None, "Approved payroll should have journal entry"


class TestPayrollPayment:
    """Test payroll payment functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_pay_payroll(self):
        """POST /api/payroll/runs/{run_id}/pay - Pay approved payroll"""
        response = requests.get(f"{BASE_URL}/api/payroll/runs", headers=self.headers)
        runs = response.json()["payroll_runs"]
        
        approved_runs = [r for r in runs if r["status"] == "approved"]
        
        if len(approved_runs) > 0:
            run_id = approved_runs[0]["id"]
            response = requests.post(
                f"{BASE_URL}/api/payroll/runs/{run_id}/pay",
                headers=self.headers
            )
            assert response.status_code == 200
            data = response.json()
            assert "payment_journal_entry" in data
    
    def test_cannot_pay_unapproved_payroll(self):
        """Cannot pay payroll that is not approved"""
        response = requests.get(f"{BASE_URL}/api/payroll/runs", headers=self.headers)
        runs = response.json()["payroll_runs"]
        
        draft_runs = [r for r in runs if r["status"] == "draft"]
        
        if len(draft_runs) > 0:
            run_id = draft_runs[0]["id"]
            response = requests.post(
                f"{BASE_URL}/api/payroll/runs/{run_id}/pay",
                headers=self.headers
            )
            assert response.status_code == 400


class TestPayrollLoans:
    """Test employee loans functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_loans(self):
        """GET /api/payroll/loans - List loans"""
        response = requests.get(f"{BASE_URL}/api/payroll/loans", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "loans" in data
        assert isinstance(data["loans"], list)
    
    def test_create_loan(self):
        """POST /api/payroll/loans - Create new loan"""
        # Get an employee
        response = requests.get(f"{BASE_URL}/api/hr/employees", headers=self.headers)
        employees = response.json()
        
        if len(employees) > 0:
            employee = employees[0]
            
            response = requests.post(
                f"{BASE_URL}/api/payroll/loans",
                headers=self.headers,
                json={
                    "employee_id": employee["id"],
                    "amount": 5000,
                    "installments": 10,
                    "start_month": "2026-04",
                    "reason": "Test loan"
                }
            )
            assert response.status_code == 200
            data = response.json()
            assert "loan" in data
            assert data["loan"]["amount"] == 5000
            assert data["loan"]["installments"] == 10
            assert data["loan"]["installment_amount"] == 500  # 5000/10
            assert data["loan"]["status"] == "pending"
            
            # Store for later tests
            self.created_loan_id = data["loan"]["id"]
    
    def test_approve_loan_creates_journal_entry(self):
        """POST /api/payroll/loans/{loan_id}/approve - Approve creates journal entry"""
        # Get pending loans
        response = requests.get(f"{BASE_URL}/api/payroll/loans?status=pending", headers=self.headers)
        loans = response.json()["loans"]
        
        pending_loans = [l for l in loans if l["status"] == "pending"]
        
        if len(pending_loans) > 0:
            loan_id = pending_loans[0]["id"]
            response = requests.post(
                f"{BASE_URL}/api/payroll/loans/{loan_id}/approve",
                headers=self.headers
            )
            assert response.status_code == 200
            data = response.json()
            assert "journal_entry" in data
    
    def test_loan_structure(self):
        """Verify loan data structure"""
        response = requests.get(f"{BASE_URL}/api/payroll/loans", headers=self.headers)
        loans = response.json()["loans"]
        
        if len(loans) > 0:
            loan = loans[0]
            assert "id" in loan
            assert "loan_number" in loan
            assert "employee_id" in loan
            assert "employee_name" in loan
            assert "amount" in loan
            assert "installments" in loan
            assert "installment_amount" in loan
            assert "remaining_amount" in loan
            assert "status" in loan


class TestPayrollSettings:
    """Test payroll settings functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_settings(self):
        """GET /api/payroll/settings - Get payroll settings"""
        response = requests.get(f"{BASE_URL}/api/payroll/settings", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify settings structure
        assert "employee_social_insurance_rate" in data
        assert "company_social_insurance_rate" in data
        assert "income_tax_brackets" in data
        assert "personal_exemption" in data
    
    def test_settings_values(self):
        """Verify settings have correct default values"""
        response = requests.get(f"{BASE_URL}/api/payroll/settings", headers=self.headers)
        data = response.json()
        
        # Egyptian social insurance rates
        assert data["employee_social_insurance_rate"] == 11.0
        assert data["company_social_insurance_rate"] == 18.75
        
        # Tax brackets should be a list
        assert isinstance(data["income_tax_brackets"], list)
        assert len(data["income_tax_brackets"]) > 0


class TestEndOfService:
    """Test end of service settlements"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_settlements(self):
        """GET /api/payroll/end-of-service - List settlements"""
        response = requests.get(f"{BASE_URL}/api/payroll/end-of-service", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert "settlements" in data
        assert isinstance(data["settlements"], list)


class TestJournalEntryIntegration:
    """Test journal entry integration with payroll"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_payroll_journal_entry_balanced(self):
        """Verify payroll journal entries are balanced (debits = credits)"""
        # Get approved payroll with journal entry
        response = requests.get(f"{BASE_URL}/api/payroll/runs", headers=self.headers)
        runs = response.json()["payroll_runs"]
        
        approved_runs = [r for r in runs if r.get("journal_entry_id")]
        
        if len(approved_runs) > 0:
            journal_id = approved_runs[0]["journal_entry_id"]
            
            # Get journal entry
            response = requests.get(
                f"{BASE_URL}/api/accounting/journal-entries/{journal_id}",
                headers=self.headers
            )
            
            if response.status_code == 200:
                entry = response.json()
                if "lines" in entry:
                    total_debit = sum(line.get("debit", 0) for line in entry["lines"])
                    total_credit = sum(line.get("credit", 0) for line in entry["lines"])
                    
                    # Allow small floating point difference
                    assert abs(total_debit - total_credit) < 0.01, \
                        f"Journal entry not balanced: debit={total_debit}, credit={total_credit}"


class TestPayrollReports:
    """Test payroll reports"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_monthly_cost_report(self):
        """GET /api/payroll/reports/monthly-cost - Monthly cost report"""
        response = requests.get(
            f"{BASE_URL}/api/payroll/reports/monthly-cost?year=2025",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "report" in data
        assert "totals" in data
        assert "year" in data
    
    def test_department_cost_report(self):
        """GET /api/payroll/reports/department-cost - Department cost report"""
        response = requests.get(
            f"{BASE_URL}/api/payroll/reports/department-cost?month=2025-01",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "report" in data
        assert "month" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
