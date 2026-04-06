"""
Test Admin Dashboard - Delete User Functionality
Tests for Super Admin dashboard features:
1. Super Admin login
2. Get all companies with subscription info
3. Get all users with role, permissions, status
4. Delete user API
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "superadmin@datalife.com"
SUPER_ADMIN_PASSWORD = "SuperAdmin@2024"


class TestSuperAdminLogin:
    """Test Super Admin login functionality"""
    
    def test_super_admin_login_success(self):
        """Test that Super Admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        assert "access_token" in data, "No access_token in response"
        assert "user" in data, "No user in response"
        assert data["user"]["role"] == "Super Admin", f"Expected Super Admin role, got {data['user']['role']}"
        assert data["user"]["email"] == SUPER_ADMIN_EMAIL


class TestCompaniesTab:
    """Test Companies tab - shows all companies with subscription info"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for Super Admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_all_companies(self, auth_token):
        """Test GET /api/admin/companies returns companies with subscription info"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/companies", headers=headers)
        
        assert response.status_code == 200, f"Failed to get companies: {response.text}"
        
        companies = response.json()
        assert isinstance(companies, list), "Response should be a list"
        assert len(companies) > 0, "Should have at least one company"
        
        # Check first company has required fields
        company = companies[0]
        assert "id" in company, "Company should have id"
        assert "name" in company, "Company should have name"
        assert "user_count" in company, "Company should have user_count"
        
        # Check subscription info is present (can be null)
        assert "subscription" in company or "subscription_status" in company, "Company should have subscription info"
    
    def test_companies_have_subscription_status(self, auth_token):
        """Test that companies have subscription status field"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/companies", headers=headers)
        
        assert response.status_code == 200
        companies = response.json()
        
        for company in companies:
            # Either subscription_status or subscription.status should exist
            has_status = "subscription_status" in company or (
                company.get("subscription") and "status" in company.get("subscription", {})
            )
            assert has_status or company.get("subscription") is None, f"Company {company.get('name')} missing subscription status"


class TestAllUsersTab:
    """Test All Users tab - shows users with role, permissions, status"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for Super Admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_all_users(self, auth_token):
        """Test GET /api/admin/all-users returns users with required fields"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/all-users", headers=headers)
        
        assert response.status_code == 200, f"Failed to get users: {response.text}"
        
        users = response.json()
        assert isinstance(users, list), "Response should be a list"
        assert len(users) > 0, "Should have at least one user"
        
        # Check first user has required fields
        user = users[0]
        assert "id" in user, "User should have id"
        assert "email" in user, "User should have email"
        assert "role" in user, "User should have role"
        assert "is_active" in user, "User should have is_active status"
    
    def test_users_have_permissions_field(self, auth_token):
        """Test that users have permissions field"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/all-users", headers=headers)
        
        assert response.status_code == 200
        users = response.json()
        
        # At least some users should have permissions
        users_with_permissions = [u for u in users if "permissions" in u]
        assert len(users_with_permissions) > 0, "At least some users should have permissions field"
    
    def test_users_have_company_name(self, auth_token):
        """Test that users have company_name field"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/all-users", headers=headers)
        
        assert response.status_code == 200
        users = response.json()
        
        for user in users:
            assert "company_name" in user, f"User {user.get('email')} missing company_name"


class TestDeleteUserAPI:
    """Test Delete User API functionality"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for Super Admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_delete_user_endpoint_exists(self, auth_token):
        """Test that DELETE /api/admin/users/{user_id} endpoint exists"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Try to delete a non-existent user - should return 404, not 405
        fake_user_id = str(uuid.uuid4())
        response = requests.delete(f"{BASE_URL}/api/admin/users/{fake_user_id}", headers=headers)
        
        # 404 means endpoint exists but user not found
        # 405 would mean endpoint doesn't exist
        assert response.status_code in [404, 403], f"Unexpected status: {response.status_code}, {response.text}"
    
    def test_cannot_delete_super_admin(self, auth_token):
        """Test that Super Admin cannot be deleted"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First get the Super Admin user ID
        response = requests.get(f"{BASE_URL}/api/admin/all-users", headers=headers)
        assert response.status_code == 200
        
        users = response.json()
        super_admin = next((u for u in users if u.get("role") == "Super Admin"), None)
        
        if super_admin:
            # Try to delete Super Admin - should fail
            delete_response = requests.delete(
                f"{BASE_URL}/api/admin/users/{super_admin['id']}", 
                headers=headers
            )
            assert delete_response.status_code == 403, f"Should not be able to delete Super Admin: {delete_response.text}"


class TestEditRoleAndPermissions:
    """Test Edit Role and Permissions functionality"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for Super Admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    def test_get_available_roles(self, auth_token):
        """Test GET /api/admin/roles returns available roles"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/roles", headers=headers)
        
        assert response.status_code == 200, f"Failed to get roles: {response.text}"
        
        roles = response.json()
        assert isinstance(roles, list), "Response should be a list"
        assert len(roles) > 0, "Should have at least one role"
        
        # Check role structure
        role = roles[0]
        assert "id" in role, "Role should have id"
    
    def test_get_available_permissions(self, auth_token):
        """Test GET /api/admin/permissions returns available permissions"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(f"{BASE_URL}/api/admin/permissions", headers=headers)
        
        assert response.status_code == 200, f"Failed to get permissions: {response.text}"
        
        permissions = response.json()
        assert isinstance(permissions, list), "Response should be a list"
        assert len(permissions) > 0, "Should have at least one permission"
        
        # Check permission structure
        perm = permissions[0]
        assert "id" in perm, "Permission should have id"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
