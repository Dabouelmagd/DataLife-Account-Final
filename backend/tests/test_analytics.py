"""
Test suite for Analytics APIs
Tests: /api/analytics/overview, /api/analytics/financial, /api/analytics/hr, /api/analytics/inventory
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
COMPANY_MANAGER = {
    "email": "dalia@datalifeai.com",
    "password": "Dalia@2024"
}

SUPER_ADMIN = {
    "email": "superadmin@datalife.com",
    "password": "Admin@2024"
}


class TestAnalyticsAPIs:
    """Analytics API Tests for Overview, Financial, HR, and Inventory"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for company manager"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=COMPANY_MANAGER)
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    @pytest.fixture(scope="class")
    def super_admin_token(self):
        """Get authentication token for super admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Super admin authentication failed")
    
    # --- Authentication Tests ---
    def test_login_company_manager(self):
        """Test login with company manager credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=COMPANY_MANAGER)
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "Token not returned in response"
        print(f"Company manager login successful")
    
    # --- Analytics Overview Tests ---
    def test_analytics_overview_daily(self, auth_token):
        """Test /api/analytics/overview with daily period"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/overview?period=daily", headers=headers)
        
        assert response.status_code == 200, f"API returned {response.status_code}: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "period" in data, "Missing 'period' in response"
        assert "hr_analytics" in data, "Missing 'hr_analytics' in response"
        assert "financial_analytics" in data, "Missing 'financial_analytics' in response"
        assert "inventory_analytics" in data, "Missing 'inventory_analytics' in response"
        
        # Validate HR analytics structure
        hr = data["hr_analytics"]
        assert "total_employees" in hr
        assert "total_allowances" in hr
        assert "total_deductions" in hr
        assert "total_leaves" in hr
        
        # Validate financial analytics structure
        fin = data["financial_analytics"]
        assert "total_customers" in fin
        assert "total_suppliers" in fin
        assert "total_revenue" in fin
        assert "total_expenses" in fin
        assert "net_profit" in fin
        assert "profit_margin" in fin
        
        # Validate inventory analytics structure
        inv = data["inventory_analytics"]
        assert "total_items" in inv
        assert "total_value" in inv
        assert "low_stock_items" in inv
        assert "in_stock_items" in inv
        
        print(f"Analytics Overview (daily) PASSED - period: {data['period']}")
    
    def test_analytics_overview_monthly(self, auth_token):
        """Test /api/analytics/overview with monthly period"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/overview?period=monthly", headers=headers)
        
        assert response.status_code == 200, f"API returned {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["period"] == "monthly"
        assert "hr_analytics" in data
        assert "financial_analytics" in data
        assert "inventory_analytics" in data
        
        print(f"Analytics Overview (monthly) PASSED")
    
    def test_analytics_overview_yearly(self, auth_token):
        """Test /api/analytics/overview with yearly period"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/overview?period=yearly", headers=headers)
        
        assert response.status_code == 200, f"API returned {response.status_code}: {response.text}"
        data = response.json()
        
        assert data["period"] == "yearly"
        print(f"Analytics Overview (yearly) PASSED")
    
    # --- Financial Analytics Tests ---
    def test_analytics_financial(self, auth_token):
        """Test /api/analytics/financial endpoint"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/financial?period=monthly", headers=headers)
        
        assert response.status_code == 200, f"API returned {response.status_code}: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "revenue_by_month" in data, "Missing 'revenue_by_month'"
        assert "expenses_by_month" in data, "Missing 'expenses_by_month'"
        assert "customer_balances" in data, "Missing 'customer_balances'"
        assert "supplier_balances" in data, "Missing 'supplier_balances'"
        assert "total_customers" in data, "Missing 'total_customers'"
        assert "total_suppliers" in data, "Missing 'total_suppliers'"
        assert "total_revenue" in data, "Missing 'total_revenue'"
        assert "total_expenses" in data, "Missing 'total_expenses'"
        
        # Validate data types
        assert isinstance(data["revenue_by_month"], list)
        assert isinstance(data["expenses_by_month"], list)
        assert isinstance(data["customer_balances"], list)
        assert isinstance(data["supplier_balances"], list)
        
        print(f"Financial Analytics PASSED - {data['total_customers']} customers, {data['total_suppliers']} suppliers")
    
    # --- HR Analytics Tests ---
    def test_analytics_hr(self, auth_token):
        """Test /api/analytics/hr endpoint"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/hr?period=monthly", headers=headers)
        
        assert response.status_code == 200, f"API returned {response.status_code}: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "total_employees" in data, "Missing 'total_employees'"
        assert "department_distribution" in data, "Missing 'department_distribution'"
        assert "salary_distribution" in data, "Missing 'salary_distribution'"
        assert "leave_statistics" in data, "Missing 'leave_statistics'"
        assert "attendance_data" in data, "Missing 'attendance_data'"
        assert "total_allowances" in data, "Missing 'total_allowances'"
        assert "total_deductions" in data, "Missing 'total_deductions'"
        assert "total_leaves" in data, "Missing 'total_leaves'"
        
        # Validate data types
        assert isinstance(data["department_distribution"], list)
        assert isinstance(data["salary_distribution"], list)
        assert isinstance(data["leave_statistics"], list)
        assert isinstance(data["attendance_data"], list)
        
        print(f"HR Analytics PASSED - {data['total_employees']} employees")
    
    # --- Inventory Analytics Tests ---
    def test_analytics_inventory(self, auth_token):
        """Test /api/analytics/inventory endpoint"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/analytics/inventory?period=monthly", headers=headers)
        
        assert response.status_code == 200, f"API returned {response.status_code}: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "total_items" in data, "Missing 'total_items'"
        assert "total_value" in data, "Missing 'total_value'"
        assert "category_distribution" in data, "Missing 'category_distribution'"
        assert "status_distribution" in data, "Missing 'status_distribution'"
        assert "top_items_by_value" in data, "Missing 'top_items_by_value'"
        assert "low_stock_alerts" in data, "Missing 'low_stock_alerts'"
        assert "in_stock_count" in data, "Missing 'in_stock_count'"
        assert "low_stock_count" in data, "Missing 'low_stock_count'"
        
        # Validate data types
        assert isinstance(data["category_distribution"], list)
        assert isinstance(data["status_distribution"], list)
        assert isinstance(data["top_items_by_value"], list)
        assert isinstance(data["low_stock_alerts"], list)
        
        print(f"Inventory Analytics PASSED - {data['total_items']} items, value: {data['total_value']}")
    
    # --- Authorization Tests ---
    def test_analytics_without_auth(self):
        """Test that analytics APIs require authentication"""
        response = requests.get(f"{BASE_URL}/api/analytics/overview?period=monthly")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Authorization check PASSED - 401 returned without token")
    
    def test_analytics_with_invalid_token(self):
        """Test analytics with invalid token"""
        headers = {"Authorization": "Bearer invalid_token_123"}
        response = requests.get(f"{BASE_URL}/api/analytics/overview?period=monthly", headers=headers)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Invalid token check PASSED - 401 returned")
    
    # --- Financial Reports Advanced Test ---
    def test_financial_reports_year(self, auth_token):
        """Test /api/analytics/financial-reports endpoint with year filter"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/financial-reports?period_type=year&year=2024",
            headers=headers
        )
        
        assert response.status_code == 200, f"API returned {response.status_code}: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "period" in data, "Missing 'period'"
        assert "current" in data, "Missing 'current'"
        
        # Validate period info
        period = data["period"]
        assert period["type"] == "year"
        
        # Validate current data
        current = data["current"]
        assert "total_revenue" in current
        assert "total_expenses" in current
        assert "net_profit" in current
        
        print(f"Financial Reports (year) PASSED")
    
    def test_financial_reports_with_comparison(self, auth_token):
        """Test financial reports with period comparison"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/analytics/financial-reports?period_type=year&year=2024&compare=true",
            headers=headers
        )
        
        assert response.status_code == 200, f"API returned {response.status_code}: {response.text}"
        data = response.json()
        
        # When compare=true, should have comparison and growth_rates
        assert "comparison" in data, "Missing 'comparison' when compare=true"
        assert "growth_rates" in data, "Missing 'growth_rates' when compare=true"
        
        print(f"Financial Reports with comparison PASSED")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
