"""
Customer Portal API Tests
Testing all customer portal endpoints:
- Customer login/authentication
- Dashboard data
- Invoices list
- Payments list
- Profile management
- Company-side portal management (setup, invite, list customers)
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from the review request
COMPANY_USER_EMAIL = "test@company.com"
COMPANY_USER_PASSWORD = "Test@123"
CUSTOMER_EMAIL = "customer@example.com"
CUSTOMER_PASSWORD = "ZWU0KdwRNzti"
PORTAL_CODE = "PEMFQ6TP"


class TestCustomerPortalLogin:
    """Test customer portal authentication"""
    
    def test_customer_login_success(self):
        """Test customer login with valid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/customer-portal/login",
            json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
        )
        print(f"Customer login response status: {response.status_code}")
        print(f"Customer login response: {response.json()}")
        
        # Should return 200 with token
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "customer" in data
        assert data["customer"]["email"] == CUSTOMER_EMAIL
    
    def test_customer_login_invalid_credentials(self):
        """Test customer login with invalid credentials"""
        response = requests.post(
            f"{BASE_URL}/api/customer-portal/login",
            json={"email": "wrong@example.com", "password": "wrongpass"}
        )
        print(f"Invalid login response status: {response.status_code}")
        
        # Should return 401
        assert response.status_code == 401
    
    def test_customer_login_missing_fields(self):
        """Test customer login with missing fields"""
        response = requests.post(
            f"{BASE_URL}/api/customer-portal/login",
            json={"email": CUSTOMER_EMAIL}
        )
        print(f"Missing field response status: {response.status_code}")
        
        # Should return 400
        assert response.status_code == 400


class TestCustomerPortalDashboard:
    """Test customer dashboard endpoint"""
    
    @pytest.fixture
    def customer_token(self):
        """Get customer authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/customer-portal/login",
            json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Customer login failed - skipping dashboard tests")
    
    def test_get_dashboard_data(self, customer_token):
        """Test getting customer dashboard data"""
        response = requests.get(
            f"{BASE_URL}/api/customer-portal/dashboard",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        print(f"Dashboard response status: {response.status_code}")
        print(f"Dashboard data: {response.json()}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify dashboard structure
        assert "summary" in data
        assert "recent_invoices" in data
        assert "pending_invoices" in data
        
        # Verify summary fields
        summary = data["summary"]
        assert "total_invoices" in summary
        assert "total_amount" in summary
        assert "paid_amount" in summary
        assert "pending_amount" in summary
    
    def test_dashboard_unauthorized(self):
        """Test dashboard access without token"""
        response = requests.get(f"{BASE_URL}/api/customer-portal/dashboard")
        print(f"Unauthorized dashboard response: {response.status_code}")
        
        # Should return 401
        assert response.status_code == 401


class TestCustomerPortalInvoices:
    """Test customer invoices endpoints"""
    
    @pytest.fixture
    def customer_token(self):
        """Get customer authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/customer-portal/login",
            json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Customer login failed - skipping invoices tests")
    
    def test_get_invoices_list(self, customer_token):
        """Test getting customer's invoices"""
        response = requests.get(
            f"{BASE_URL}/api/customer-portal/invoices",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        print(f"Invoices list response status: {response.status_code}")
        print(f"Invoices count: {len(response.json()) if response.status_code == 200 else 'N/A'}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_invoices_by_status(self, customer_token):
        """Test getting invoices filtered by status"""
        response = requests.get(
            f"{BASE_URL}/api/customer-portal/invoices?status=paid",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        print(f"Filtered invoices response status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_invoices_unauthorized(self):
        """Test invoices access without token"""
        response = requests.get(f"{BASE_URL}/api/customer-portal/invoices")
        
        # Should return 401
        assert response.status_code == 401


class TestCustomerPortalPayments:
    """Test customer payments endpoint"""
    
    @pytest.fixture
    def customer_token(self):
        """Get customer authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/customer-portal/login",
            json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Customer login failed - skipping payments tests")
    
    def test_get_payments_list(self, customer_token):
        """Test getting customer's payments"""
        response = requests.get(
            f"{BASE_URL}/api/customer-portal/payments",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        print(f"Payments list response status: {response.status_code}")
        print(f"Payments response: {response.json()}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_payments_unauthorized(self):
        """Test payments access without token"""
        response = requests.get(f"{BASE_URL}/api/customer-portal/payments")
        
        # Should return 401
        assert response.status_code == 401


class TestCustomerPortalProfile:
    """Test customer profile endpoints"""
    
    @pytest.fixture
    def customer_token(self):
        """Get customer authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/customer-portal/login",
            json={"email": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Customer login failed - skipping profile tests")
    
    def test_get_profile(self, customer_token):
        """Test getting customer profile"""
        response = requests.get(
            f"{BASE_URL}/api/customer-portal/profile",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        print(f"Profile response status: {response.status_code}")
        print(f"Profile data: {response.json()}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify profile structure
        assert "email" in data
        assert data["email"] == CUSTOMER_EMAIL
        # Should not contain password_hash
        assert "password_hash" not in data
    
    def test_update_profile(self, customer_token):
        """Test updating customer profile"""
        update_data = {
            "name": "TEST_Updated Customer Name",
            "phone": "1234567890"
        }
        response = requests.put(
            f"{BASE_URL}/api/customer-portal/profile",
            json=update_data,
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        print(f"Update profile response status: {response.status_code}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        
        # Verify the update by fetching profile again
        get_response = requests.get(
            f"{BASE_URL}/api/customer-portal/profile",
            headers={"Authorization": f"Bearer {customer_token}"}
        )
        assert get_response.status_code == 200
        profile = get_response.json()
        assert profile.get("name") == "TEST_Updated Customer Name"
    
    def test_profile_unauthorized(self):
        """Test profile access without token"""
        response = requests.get(f"{BASE_URL}/api/customer-portal/profile")
        
        # Should return 401
        assert response.status_code == 401


class TestCompanyPortalManagement:
    """Test company-side portal management endpoints"""
    
    @pytest.fixture
    def company_token(self):
        """Get company user authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": COMPANY_USER_EMAIL, "password": COMPANY_USER_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Company login failed - skipping company portal tests")
    
    def test_setup_portal(self, company_token):
        """Test setting up customer portal for company"""
        response = requests.post(
            f"{BASE_URL}/api/customer-portal/setup-portal",
            headers={"Authorization": f"Bearer {company_token}"}
        )
        print(f"Setup portal response status: {response.status_code}")
        print(f"Setup portal response: {response.json()}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "portal_code" in data
        assert "portal_url" in data
    
    def test_list_portal_customers(self, company_token):
        """Test listing customers with portal access"""
        response = requests.get(
            f"{BASE_URL}/api/customer-portal/customers",
            headers={"Authorization": f"Bearer {company_token}"}
        )
        print(f"List customers response status: {response.status_code}")
        print(f"Customers count: {len(response.json()) if response.status_code == 200 else 'N/A'}")
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_invite_customer(self, company_token):
        """Test inviting a customer to portal"""
        import time
        test_email = f"TEST_invite_{int(time.time())}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/customer-portal/customers/invite",
            json={"email": test_email, "name": "TEST_Invited Customer"},
            headers={"Authorization": f"Bearer {company_token}"}
        )
        print(f"Invite customer response status: {response.status_code}")
        print(f"Invite response: {response.json()}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "customer_id" in data
        assert "temp_password" in data  # Temporary password for the customer
    
    def test_invite_duplicate_customer(self, company_token):
        """Test inviting same customer twice should fail"""
        # First invite
        import time
        test_email = f"TEST_dup_{int(time.time())}@example.com"
        
        response1 = requests.post(
            f"{BASE_URL}/api/customer-portal/customers/invite",
            json={"email": test_email, "name": "TEST_Duplicate Customer"},
            headers={"Authorization": f"Bearer {company_token}"}
        )
        assert response1.status_code == 200
        
        # Second invite with same email
        response2 = requests.post(
            f"{BASE_URL}/api/customer-portal/customers/invite",
            json={"email": test_email, "name": "TEST_Duplicate Customer"},
            headers={"Authorization": f"Bearer {company_token}"}
        )
        print(f"Duplicate invite response status: {response2.status_code}")
        
        # Should return 400
        assert response2.status_code == 400
    
    def test_portal_management_unauthorized(self):
        """Test portal management without token"""
        response = requests.get(f"{BASE_URL}/api/customer-portal/customers")
        
        # Should return 401
        assert response.status_code == 401


class TestCustomerToggleAccess:
    """Test customer access toggle functionality"""
    
    @pytest.fixture
    def company_token(self):
        """Get company user authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": COMPANY_USER_EMAIL, "password": COMPANY_USER_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Company login failed - skipping toggle tests")
    
    def test_toggle_customer_access(self, company_token):
        """Test toggling customer portal access"""
        # First, get list of customers to find one
        list_response = requests.get(
            f"{BASE_URL}/api/customer-portal/customers",
            headers={"Authorization": f"Bearer {company_token}"}
        )
        
        if list_response.status_code != 200 or len(list_response.json()) == 0:
            pytest.skip("No customers available for toggle test")
        
        customers = list_response.json()
        customer_id = customers[0].get("id")
        initial_status = customers[0].get("is_active")
        
        # Toggle access
        toggle_response = requests.put(
            f"{BASE_URL}/api/customer-portal/customers/{customer_id}/toggle",
            headers={"Authorization": f"Bearer {company_token}"}
        )
        print(f"Toggle response status: {toggle_response.status_code}")
        print(f"Toggle response: {toggle_response.json()}")
        
        assert toggle_response.status_code == 200
        data = toggle_response.json()
        assert data.get("success") == True
        assert data.get("is_active") != initial_status
        
        # Toggle back to original state
        requests.put(
            f"{BASE_URL}/api/customer-portal/customers/{customer_id}/toggle",
            headers={"Authorization": f"Bearer {company_token}"}
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
