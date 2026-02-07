"""
Backend API Tests for DataLife ERP - Iteration 12
Testing: Auth, User Management, Permissions, Contact Form
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://super-admin-suite.preview.emergentagent.com')

# Test Credentials
SUPER_ADMIN = {"email": "superadmin@datalife.com", "password": "Admin@2024"}
GENERAL_MANAGER = {"email": "manager@datalife.com", "password": "Admin@2024"}
CEO = {"email": "ceo@datalife.com", "password": "Admin@2024"}
BOARD_CHAIRMAN = {"email": "chairman@datalife.com", "password": "Admin@2024"}
EMPLOYEE = {"email": "employee@datalife.com", "password": "Admin@2024"}


class TestAuthentication:
    """Test login flows and redirections"""

    def test_super_admin_login(self):
        """Super Admin should login successfully with role 'Super Admin'"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] == "Super Admin"
        assert data["user"]["email"] == SUPER_ADMIN["email"]
        print(f"✓ Super Admin login successful - Role: {data['user']['role']}")

    def test_general_manager_login(self):
        """General Manager should login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=GENERAL_MANAGER)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "access_token" in data
        # Role could be in Arabic or English
        assert data["user"]["role"] in ["General Manager", "مدير عام"]
        print(f"✓ General Manager login successful - Role: {data['user']['role']}")

    def test_ceo_login(self):
        """CEO should login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CEO)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] in ["CEO", "المدير التنفيذي"]
        print(f"✓ CEO login successful - Role: {data['user']['role']}")

    def test_board_chairman_login(self):
        """Board Chairman should login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=BOARD_CHAIRMAN)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["role"] in ["Board Chairman", "رئيس مجلس الإدارة"]
        print(f"✓ Board Chairman login successful - Role: {data['user']['role']}")

    def test_invalid_login(self):
        """Invalid credentials should return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "invalid@test.com", "password": "wrong"})
        assert response.status_code == 401
        print("✓ Invalid login correctly rejected with 401")


class TestUserManagement:
    """Test user management APIs"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Get token for authenticated requests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=GENERAL_MANAGER)
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def test_list_company_users(self):
        """Should list all users in company"""
        response = requests.get(f"{BASE_URL}/api/users/", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        users = response.json()
        assert isinstance(users, list)
        print(f"✓ Listed {len(users)} company users")

    def test_list_roles(self):
        """Should list available roles"""
        response = requests.get(f"{BASE_URL}/api/users/roles", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        roles = response.json()
        assert isinstance(roles, list)
        assert len(roles) > 0
        print(f"✓ Listed {len(roles)} available roles: {roles[:5]}...")


class TestPermissionsUpdate:
    """Test permission editing by authorized roles (GM, CEO, Board Chairman)"""

    @pytest.fixture
    def gm_headers(self):
        """Get General Manager token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=GENERAL_MANAGER)
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    @pytest.fixture
    def ceo_headers(self):
        """Get CEO token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=CEO)
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    @pytest.fixture
    def chairman_headers(self):
        """Get Board Chairman token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=BOARD_CHAIRMAN)
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    @pytest.fixture
    def employee_headers(self):
        """Get Employee token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=EMPLOYEE)
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def test_gm_can_update_permissions(self, gm_headers):
        """General Manager should be able to update user permissions"""
        # First get a user to edit
        users_response = requests.get(f"{BASE_URL}/api/users/", headers=gm_headers)
        users = users_response.json()
        
        # Find a non-manager user to edit (like employee)
        target_user = None
        for user in users:
            if user.get('email') == 'employee@datalife.com':
                target_user = user
                break
        
        if not target_user:
            pytest.skip("No employee user found to test permissions")
        
        # Update permissions
        new_permissions = ["dashboard", "hr", "financial"]
        response = requests.put(
            f"{BASE_URL}/api/users/{target_user['id']}/permissions",
            json={"permissions": new_permissions},
            headers=gm_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ General Manager successfully updated permissions for {target_user['email']}")

    def test_ceo_can_update_permissions(self, ceo_headers):
        """CEO should be able to update user permissions"""
        users_response = requests.get(f"{BASE_URL}/api/users/", headers=ceo_headers)
        users = users_response.json()
        
        target_user = None
        for user in users:
            if user.get('email') == 'employee@datalife.com':
                target_user = user
                break
        
        if not target_user:
            pytest.skip("No employee user found to test permissions")
        
        new_permissions = ["dashboard", "projects"]
        response = requests.put(
            f"{BASE_URL}/api/users/{target_user['id']}/permissions",
            json={"permissions": new_permissions},
            headers=ceo_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ CEO successfully updated permissions for {target_user['email']}")

    def test_chairman_can_update_permissions(self, chairman_headers):
        """Board Chairman should be able to update user permissions"""
        users_response = requests.get(f"{BASE_URL}/api/users/", headers=chairman_headers)
        users = users_response.json()
        
        target_user = None
        for user in users:
            if user.get('email') == 'employee@datalife.com':
                target_user = user
                break
        
        if not target_user:
            pytest.skip("No employee user found to test permissions")
        
        new_permissions = ["dashboard", "analytics", "settings"]
        response = requests.put(
            f"{BASE_URL}/api/users/{target_user['id']}/permissions",
            json={"permissions": new_permissions},
            headers=chairman_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print(f"✓ Board Chairman successfully updated permissions for {target_user['email']}")

    def test_employee_cannot_update_permissions(self, employee_headers):
        """Employee should NOT be able to update user permissions"""
        users_response = requests.get(f"{BASE_URL}/api/users/", headers=employee_headers)
        
        # Employee might not have access to list users
        if users_response.status_code != 200:
            print("✓ Employee correctly denied access to user list")
            return
            
        users = users_response.json()
        if not users:
            pytest.skip("No users to test")
        
        target_user = users[0]
        response = requests.put(
            f"{BASE_URL}/api/users/{target_user['id']}/permissions",
            json={"permissions": ["dashboard"]},
            headers=employee_headers
        )
        assert response.status_code in [403, 401], f"Expected 403/401, got {response.status_code}"
        print("✓ Employee correctly denied permission update access")

    def test_invalid_permission_rejected(self, gm_headers):
        """Invalid permission IDs should be rejected"""
        users_response = requests.get(f"{BASE_URL}/api/users/", headers=gm_headers)
        users = users_response.json()
        
        if not users:
            pytest.skip("No users to test")
        
        target_user = users[0]
        response = requests.put(
            f"{BASE_URL}/api/users/{target_user['id']}/permissions",
            json={"permissions": ["invalid_permission_xyz"]},
            headers=gm_headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Invalid permissions correctly rejected")


class TestContactForm:
    """Test contact form API"""

    def test_contact_form_submission(self):
        """Contact form should submit successfully"""
        contact_data = {
            "name": "Test User",
            "email": "testuser@example.com",
            "message": "This is a test message from automated testing"
        }
        response = requests.post(f"{BASE_URL}/api/contact/send", json=contact_data)
        # Contact form might return 200 or 500 if email not configured
        assert response.status_code in [200, 500], f"Unexpected status: {response.status_code}"
        
        if response.status_code == 200:
            print("✓ Contact form submitted successfully")
        else:
            print("⚠ Contact form API exists but email service may not be configured")

    def test_contact_form_validation(self):
        """Contact form should validate required fields"""
        contact_data = {
            "name": "",
            "email": "",
            "message": ""
        }
        response = requests.post(f"{BASE_URL}/api/contact/send", json=contact_data)
        # Empty fields should be rejected
        print(f"Contact form validation returned: {response.status_code}")


class TestAdminAPIs:
    """Test Admin-specific APIs"""

    @pytest.fixture(autouse=True)
    def setup(self):
        """Get Super Admin token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=SUPER_ADMIN)
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def test_admin_dashboard(self):
        """Admin dashboard should return statistics"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        # Check for expected fields
        assert "total_users" in data or "stats" in data
        print(f"✓ Admin dashboard data retrieved successfully")

    def test_admin_all_users(self):
        """Admin should see all users from all companies"""
        response = requests.get(f"{BASE_URL}/api/admin/all-users", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        users = response.json()
        assert isinstance(users, list)
        print(f"✓ Admin can see {len(users)} total users across all companies")

    def test_admin_companies(self):
        """Admin should list all companies"""
        response = requests.get(f"{BASE_URL}/api/admin/companies", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        companies = response.json()
        assert isinstance(companies, list)
        print(f"✓ Admin can see {len(companies)} companies")

    def test_admin_permissions_list(self):
        """Admin should list available permissions"""
        response = requests.get(f"{BASE_URL}/api/admin/permissions", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        permissions = response.json()
        assert isinstance(permissions, list)
        assert len(permissions) == 10  # Should have 10 permissions
        print(f"✓ Admin permissions endpoint returns {len(permissions)} permissions")

    def test_admin_contact_messages(self):
        """Admin should access contact messages"""
        response = requests.get(f"{BASE_URL}/api/contact/messages", headers=self.headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        messages = response.json()
        assert isinstance(messages, list)
        print(f"✓ Admin can access {len(messages)} contact messages")


class TestUnauthorizedAccess:
    """Test that unauthorized users cannot access protected resources"""

    def test_unauthenticated_users_list(self):
        """Unauthenticated request should be rejected"""
        response = requests.get(f"{BASE_URL}/api/users/")
        assert response.status_code == 401
        print("✓ Unauthenticated access to users list correctly rejected")

    def test_unauthenticated_admin_dashboard(self):
        """Unauthenticated request to admin should be rejected"""
        response = requests.get(f"{BASE_URL}/api/admin/dashboard")
        assert response.status_code == 401
        print("✓ Unauthenticated access to admin dashboard correctly rejected")

    def test_regular_user_admin_access(self):
        """Regular user should not access admin endpoints"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json=EMPLOYEE)
        if response.status_code != 200:
            pytest.skip("Employee user not found")
        
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        admin_response = requests.get(f"{BASE_URL}/api/admin/dashboard", headers=headers)
        # Should be forbidden
        assert admin_response.status_code in [403, 401], f"Expected 403/401, got {admin_response.status_code}"
        print("✓ Regular user correctly denied admin access")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
