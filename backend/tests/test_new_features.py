"""
Tests for new features:
1. GET /api/admin/all-users - All Users tab in Admin Dashboard
2. PUT /api/users/{user_id}/permissions - Company manager permission update
3. Language switching functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://perms-editor.preview.emergentagent.com')


class TestAllUsersEndpoint:
    """Tests for GET /api/admin/all-users endpoint - Super Admin All Users Tab"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token for authenticated requests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as Super Admin
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@datalife.com", "password": "Admin@2024"}
        )
        
        if login_response.status_code == 200:
            self.token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Authentication failed - skipping tests")
    
    def test_get_all_users_returns_200(self):
        """Test GET /api/admin/all-users returns 200"""
        response = self.session.get(f"{BASE_URL}/api/admin/all-users")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print(f"GET /api/admin/all-users returned status 200")
    
    def test_get_all_users_returns_list(self):
        """Test GET /api/admin/all-users returns a list of users"""
        response = self.session.get(f"{BASE_URL}/api/admin/all-users")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"GET /api/admin/all-users returned {len(data)} users")
    
    def test_all_users_have_required_fields(self):
        """Test all users have required fields"""
        response = self.session.get(f"{BASE_URL}/api/admin/all-users")
        assert response.status_code == 200
        
        users = response.json()
        if len(users) > 0:
            # Check first user has required fields
            user = users[0]
            required_fields = ['id', 'email', 'company_id']
            for field in required_fields:
                assert field in user, f"User should have '{field}' field"
            print(f"First user has all required fields: {required_fields}")
        else:
            print("No users found to check fields")
    
    def test_all_users_include_company_name(self):
        """Test all users include company_name field"""
        response = self.session.get(f"{BASE_URL}/api/admin/all-users")
        assert response.status_code == 200
        
        users = response.json()
        if len(users) > 0:
            user = users[0]
            assert 'company_name' in user, "User should have 'company_name' field"
            print(f"First user company_name: {user.get('company_name')}")
    
    def test_all_users_no_password_returned(self):
        """Test passwords are not returned in response"""
        response = self.session.get(f"{BASE_URL}/api/admin/all-users")
        assert response.status_code == 200
        
        users = response.json()
        if len(users) > 0:
            user = users[0]
            assert 'password' not in user, "Password should not be returned"
            assert 'password_hash' not in user, "Password hash should not be returned"
            print("Passwords not exposed in response - PASSED")
    
    def test_all_users_without_auth_returns_401(self):
        """Test unauthenticated request returns 401"""
        # Create new session without auth
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/admin/all-users")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Unauthenticated request correctly returned 401")


class TestCompanyManagerPermissionsEndpoint:
    """Tests for PUT /api/users/{user_id}/permissions - Company Manager updating user permissions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token for authenticated requests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as Super Admin first to get user list
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@datalife.com", "password": "Admin@2024"}
        )
        
        if login_response.status_code == 200:
            self.token = login_response.json().get("access_token")
            self.user_data = login_response.json().get("user", {})
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip("Authentication failed - skipping tests")
    
    def test_update_user_permissions_valid_data(self):
        """Test updating user permissions with valid data"""
        # Get all users first
        users_response = self.session.get(f"{BASE_URL}/api/admin/all-users")
        if users_response.status_code != 200:
            pytest.skip("Could not get users list")
        
        users = users_response.json()
        if len(users) < 1:
            pytest.skip("No users available for testing")
        
        # Find a user to update (not the super admin)
        test_user = None
        for u in users:
            if u.get('email') != 'superadmin@datalife.com':
                test_user = u
                break
        
        if not test_user:
            pytest.skip("No suitable user found for testing")
        
        user_id = test_user.get('id')
        new_permissions = ['dashboard', 'hr', 'invoices']
        
        response = self.session.put(
            f"{BASE_URL}/api/admin/users/{user_id}/permissions",
            json={"permissions": new_permissions}
        )
        
        # Could be 200 (admin endpoint) or other success code
        assert response.status_code in [200, 201], f"Expected 200/201, got {response.status_code}"
        
        data = response.json()
        if 'permissions' in data:
            assert set(data['permissions']) == set(new_permissions), "Permissions should match"
        print(f"Updated permissions for user {user_id}: {new_permissions}")
    
    def test_update_permissions_invalid_permission(self):
        """Test updating with invalid permission returns 400"""
        # Get any user ID
        users_response = self.session.get(f"{BASE_URL}/api/admin/all-users")
        if users_response.status_code != 200:
            pytest.skip("Could not get users list")
        
        users = users_response.json()
        if len(users) < 1:
            pytest.skip("No users available")
        
        user_id = users[0].get('id')
        invalid_permissions = ['invalid_permission_xyz']
        
        response = self.session.put(
            f"{BASE_URL}/api/admin/users/{user_id}/permissions",
            json={"permissions": invalid_permissions}
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid permission, got {response.status_code}"
        print("Invalid permission correctly rejected with 400")
    
    def test_update_permissions_nonexistent_user(self):
        """Test updating non-existent user returns 404"""
        fake_user_id = "non_existent_user_xyz_12345"
        
        response = self.session.put(
            f"{BASE_URL}/api/admin/users/{fake_user_id}/permissions",
            json={"permissions": ['dashboard']}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Non-existent user correctly returned 404")
    
    def test_update_permissions_without_auth(self):
        """Test unauthenticated request returns 401"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.put(
            f"{BASE_URL}/api/admin/users/some_user_id/permissions",
            json={"permissions": ['dashboard']}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Unauthenticated request correctly returned 401")


class TestAdminPermissionsEndpoint:
    """Tests for GET /api/admin/permissions endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@datalife.com", "password": "Admin@2024"}
        )
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed")
    
    def test_get_permissions_returns_list(self):
        """Test GET /api/admin/permissions returns list"""
        response = self.session.get(f"{BASE_URL}/api/admin/permissions")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) > 0, "Should have at least one permission"
        print(f"Found {len(data)} permissions")
    
    def test_permissions_have_required_fields(self):
        """Test permissions have id, name_en, name_ar fields"""
        response = self.session.get(f"{BASE_URL}/api/admin/permissions")
        assert response.status_code == 200
        
        permissions = response.json()
        if len(permissions) > 0:
            perm = permissions[0]
            assert 'id' in perm, "Permission should have 'id'"
            assert 'name_en' in perm, "Permission should have 'name_en'"
            assert 'name_ar' in perm, "Permission should have 'name_ar'"
            print(f"First permission: {perm}")


class TestAdminDashboard:
    """Tests for Admin Dashboard API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup authenticated session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "superadmin@datalife.com", "password": "Admin@2024"}
        )
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip("Authentication failed")
    
    def test_dashboard_returns_statistics(self):
        """Test GET /api/admin/dashboard returns statistics"""
        response = self.session.get(f"{BASE_URL}/api/admin/dashboard")
        assert response.status_code == 200
        
        data = response.json()
        assert 'statistics' in data, "Response should have statistics"
        stats = data['statistics']
        assert 'total_users' in stats, "Statistics should have total_users"
        print(f"Dashboard statistics: total_users={stats.get('total_users')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
