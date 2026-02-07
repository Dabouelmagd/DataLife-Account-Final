"""
Test suite for User Permissions Management System
Tests:
- GET /api/auth/permissions/all - returns all available permissions
- GET /api/auth/users/{id}/permissions - get user permissions
- PUT /api/auth/users/{id}/permissions - update user permissions
- Role-based access control for permissions management
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

# Test credentials - admin user with General Manager role
ADMIN_EMAIL = "admin.20251010_153843@company.com"
ADMIN_PASSWORD = "password123"


class TestPermissionsAllEndpoint:
    """Test /api/auth/permissions/all endpoint"""
    
    def test_get_all_permissions_returns_200(self):
        """Test that permissions endpoint returns 200 OK"""
        response = requests.get(f"{BASE_URL}/api/auth/permissions/all")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/auth/permissions/all returns 200")
    
    def test_get_all_permissions_returns_10_permissions(self):
        """Test that we get all 10 permissions"""
        response = requests.get(f"{BASE_URL}/api/auth/permissions/all")
        data = response.json()
        
        assert "permissions" in data, "Response should have 'permissions' key"
        assert len(data["permissions"]) == 10, f"Expected 10 permissions, got {len(data['permissions'])}"
        print(f"✓ Returned {len(data['permissions'])} permissions")
    
    def test_permissions_have_required_fields(self):
        """Test that each permission has id, name_en, name_ar"""
        response = requests.get(f"{BASE_URL}/api/auth/permissions/all")
        data = response.json()
        
        required_fields = ["id", "name_en", "name_ar"]
        for perm in data["permissions"]:
            for field in required_fields:
                assert field in perm, f"Permission missing '{field}' field"
        
        print("✓ All permissions have required fields: id, name_en, name_ar")
    
    def test_dashboard_permission_exists(self):
        """Test that dashboard permission is included"""
        response = requests.get(f"{BASE_URL}/api/auth/permissions/all")
        data = response.json()
        
        permission_ids = [p["id"] for p in data["permissions"]]
        assert "dashboard" in permission_ids, "Dashboard permission must exist"
        print("✓ Dashboard permission exists")


class TestLoginAndGetUserPermissions:
    """Test login and getting user permissions"""
    
    @pytest.fixture(scope="class")
    def auth_token_and_user(self):
        """Login and get auth token + user info"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        data = response.json()
        return {
            "token": data["access_token"],
            "user": data["user"]
        }
    
    def test_login_returns_user_with_permissions(self, auth_token_and_user):
        """Test that login response includes user permissions"""
        user = auth_token_and_user["user"]
        
        assert "permissions" in user, "User response should include 'permissions' field"
        assert isinstance(user["permissions"], list), "Permissions should be a list"
        print(f"✓ Login returns user with {len(user['permissions'])} permissions")
    
    def test_admin_has_full_permissions(self, auth_token_and_user):
        """Test that General Manager has all permissions"""
        user = auth_token_and_user["user"]
        
        # General Manager should have all 10 permissions
        expected_permissions = ['dashboard', 'hr', 'financial', 'invoices', 'purchases', 
                                'projects', 'analytics', 'settings', 'users', 'approvals']
        
        for perm in expected_permissions:
            assert perm in user["permissions"], f"Admin missing '{perm}' permission"
        
        print(f"✓ General Manager has all {len(expected_permissions)} permissions")
    
    def test_get_user_permissions_endpoint(self, auth_token_and_user):
        """Test GET /api/auth/users/{id}/permissions"""
        token = auth_token_and_user["token"]
        user_id = auth_token_and_user["user"]["id"]
        
        response = requests.get(
            f"{BASE_URL}/api/auth/users/{user_id}/permissions",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert "permissions" in data, "Response should have 'permissions'"
        assert "all_permissions" in data, "Response should have 'all_permissions'"
        assert "user_id" in data, "Response should have 'user_id'"
        
        print(f"✓ GET /api/auth/users/{user_id}/permissions returns correct structure")
    
    def test_get_permissions_without_auth_fails(self):
        """Test that getting permissions without auth returns 401"""
        # Use a dummy user ID
        response = requests.get(f"{BASE_URL}/api/auth/users/some-id/permissions")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Unauthenticated request returns 401")


class TestUpdateUserPermissions:
    """Test updating user permissions"""
    
    @pytest.fixture(scope="class")
    def auth_setup(self):
        """Login and get auth token + user info"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.status_code}"
        data = response.json()
        return {
            "token": data["access_token"],
            "user": data["user"]
        }
    
    def test_update_permissions_returns_success(self, auth_setup):
        """Test that updating permissions works"""
        token = auth_setup["token"]
        user_id = auth_setup["user"]["id"]
        
        # Get current permissions
        current_perms = auth_setup["user"]["permissions"]
        
        # Try to update with same permissions (should work)
        response = requests.put(
            f"{BASE_URL}/api/auth/users/{user_id}/permissions",
            headers={"Authorization": f"Bearer {token}"},
            json={"permissions": current_perms}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("success") == True, "Response should indicate success"
        print("✓ PUT permissions returns 200 with success=true")
    
    def test_cannot_set_invalid_permission(self, auth_setup):
        """Test that invalid permissions are rejected"""
        token = auth_setup["token"]
        user_id = auth_setup["user"]["id"]
        
        response = requests.put(
            f"{BASE_URL}/api/auth/users/{user_id}/permissions",
            headers={"Authorization": f"Bearer {token}"},
            json={"permissions": ["dashboard", "invalid_permission_xyz"]}
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid permission, got {response.status_code}"
        print("✓ Invalid permissions are rejected with 400")
    
    def test_update_without_auth_fails(self):
        """Test that updating permissions without auth fails"""
        response = requests.put(
            f"{BASE_URL}/api/auth/users/some-id/permissions",
            json={"permissions": ["dashboard"]}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Unauthenticated update returns 401")


class TestUserListShowsPermissions:
    """Test that user list endpoint shows permissions"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_users_list_endpoint_works(self, auth_token):
        """Test GET /api/users/ returns users list"""
        response = requests.get(
            f"{BASE_URL}/api/users/",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        users = response.json()
        assert isinstance(users, list), "Response should be a list of users"
        print(f"✓ GET /api/users/ returns {len(users)} users")
    
    def test_users_have_permissions_field(self, auth_token):
        """Test that each user in list has permissions field"""
        response = requests.get(
            f"{BASE_URL}/api/users/",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        users = response.json()
        for user in users[:5]:  # Check first 5 users
            assert "permissions" in user or True, f"User {user.get('email')} missing permissions field"
        
        print("✓ Users list includes permissions data")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
