"""
Test suite for Super Admin User Permissions Management System
Tests:
- GET /api/admin/permissions - returns all available permissions
- PUT /api/admin/users/{user_id}/permissions - update user permissions
- GET /api/admin/companies/{company_id}/users - get users with permissions
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

# Super Admin credentials
SUPER_ADMIN_EMAIL = "superadmin@datalife.com"
SUPER_ADMIN_PASSWORD = "Admin@2024"

# Expected permissions
EXPECTED_PERMISSIONS = [
    'dashboard', 'hr', 'financial', 'invoices', 'purchases',
    'projects', 'analytics', 'settings', 'users', 'approvals'
]


class TestSuperAdminLogin:
    """Test Super Admin authentication"""
    
    def test_super_admin_login_success(self):
        """Test that Super Admin can login successfully"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "access_token" in data, "Response should contain access_token"
        assert data["user"]["role"] == "Super Admin", "User should have Super Admin role"
        print("✓ Super Admin login successful")


class TestAdminPermissionsEndpoint:
    """Test GET /api/admin/permissions endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for Super Admin"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.status_code}"
        return response.json()["access_token"]
    
    def test_get_permissions_returns_200(self, auth_token):
        """Test that GET /api/admin/permissions returns 200"""
        response = requests.get(
            f"{BASE_URL}/api/admin/permissions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        print("✓ GET /api/admin/permissions returns 200")
    
    def test_get_permissions_returns_10_permissions(self, auth_token):
        """Test that we get all 10 permissions"""
        response = requests.get(
            f"{BASE_URL}/api/admin/permissions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        assert len(data) == 10, f"Expected 10 permissions, got {len(data)}"
        print(f"✓ Returned {len(data)} permissions")
    
    def test_permissions_have_correct_structure(self, auth_token):
        """Test that each permission has id, name_en, name_ar fields"""
        response = requests.get(
            f"{BASE_URL}/api/admin/permissions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = response.json()
        
        for perm in data:
            assert "id" in perm, "Permission should have 'id' field"
            assert "name_en" in perm, "Permission should have 'name_en' field"
            assert "name_ar" in perm, "Permission should have 'name_ar' field"
        
        print("✓ All permissions have correct structure")
    
    def test_all_expected_permissions_exist(self, auth_token):
        """Test that all expected permissions are present"""
        response = requests.get(
            f"{BASE_URL}/api/admin/permissions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        data = response.json()
        
        permission_ids = [p["id"] for p in data]
        
        for expected in EXPECTED_PERMISSIONS:
            assert expected in permission_ids, f"Missing expected permission: {expected}"
        
        print(f"✓ All {len(EXPECTED_PERMISSIONS)} expected permissions exist")
    
    def test_get_permissions_requires_auth(self):
        """Test that unauthenticated requests fail"""
        response = requests.get(f"{BASE_URL}/api/admin/permissions")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Unauthenticated request returns 401")


class TestUpdateUserPermissions:
    """Test PUT /api/admin/users/{user_id}/permissions endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_and_user_setup(self):
        """Get auth token and find a test user"""
        # Login as Super Admin
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.status_code}"
        token = login_response.json()["access_token"]
        
        # Get companies with users
        companies_response = requests.get(
            f"{BASE_URL}/api/admin/companies",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert companies_response.status_code == 200, "Failed to get companies"
        companies = companies_response.json()
        
        # Find a company with users
        test_user = None
        company_id = None
        for company in companies:
            if company.get("user_count", 0) > 0:
                company_id = company["id"]
                users_response = requests.get(
                    f"{BASE_URL}/api/admin/companies/{company_id}/users",
                    headers={"Authorization": f"Bearer {token}"}
                )
                if users_response.status_code == 200:
                    users = users_response.json()
                    if users:
                        test_user = users[0]
                        break
        
        assert test_user is not None, "No test user found"
        
        return {
            "token": token,
            "user_id": test_user["id"],
            "original_permissions": test_user.get("permissions", [])
        }
    
    def test_update_permissions_returns_200(self, auth_and_user_setup):
        """Test that PUT permissions returns 200"""
        token = auth_and_user_setup["token"]
        user_id = auth_and_user_setup["user_id"]
        
        response = requests.put(
            f"{BASE_URL}/api/admin/users/{user_id}/permissions",
            headers={"Authorization": f"Bearer {token}"},
            json={"permissions": ["dashboard", "hr"]}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        print("✓ PUT /api/admin/users/{id}/permissions returns 200")
    
    def test_update_permissions_returns_correct_structure(self, auth_and_user_setup):
        """Test that response has correct structure"""
        token = auth_and_user_setup["token"]
        user_id = auth_and_user_setup["user_id"]
        
        response = requests.put(
            f"{BASE_URL}/api/admin/users/{user_id}/permissions",
            headers={"Authorization": f"Bearer {token}"},
            json={"permissions": ["dashboard", "financial", "invoices"]}
        )
        
        data = response.json()
        assert "user_id" in data, "Response should have user_id"
        assert "permissions" in data, "Response should have permissions"
        assert "message" in data, "Response should have message"
        assert data["message"] == "Permissions updated successfully", "Should return success message"
        print("✓ Response has correct structure with success message")
    
    def test_permissions_are_persisted(self, auth_and_user_setup):
        """Test that permissions changes are saved to database"""
        token = auth_and_user_setup["token"]
        user_id = auth_and_user_setup["user_id"]
        
        # Set specific permissions
        new_permissions = ["dashboard", "hr", "financial", "projects"]
        
        update_response = requests.put(
            f"{BASE_URL}/api/admin/users/{user_id}/permissions",
            headers={"Authorization": f"Bearer {token}"},
            json={"permissions": new_permissions}
        )
        assert update_response.status_code == 200, f"Update failed: {update_response.status_code}"
        
        # Verify by getting companies and users
        companies_response = requests.get(
            f"{BASE_URL}/api/admin/companies",
            headers={"Authorization": f"Bearer {token}"}
        )
        companies = companies_response.json()
        
        # Find the user
        for company in companies:
            users_response = requests.get(
                f"{BASE_URL}/api/admin/companies/{company['id']}/users",
                headers={"Authorization": f"Bearer {token}"}
            )
            if users_response.status_code == 200:
                users = users_response.json()
                for user in users:
                    if user["id"] == user_id:
                        saved_perms = user.get("permissions", [])
                        assert set(saved_perms) == set(new_permissions), f"Permissions not persisted correctly. Expected {new_permissions}, got {saved_perms}"
                        print("✓ Permissions are correctly persisted in database")
                        return
        
        pytest.fail("Could not find user to verify permissions")
    
    def test_invalid_permission_returns_400(self, auth_and_user_setup):
        """Test that invalid permissions are rejected"""
        token = auth_and_user_setup["token"]
        user_id = auth_and_user_setup["user_id"]
        
        response = requests.put(
            f"{BASE_URL}/api/admin/users/{user_id}/permissions",
            headers={"Authorization": f"Bearer {token}"},
            json={"permissions": ["dashboard", "invalid_permission_xyz"]}
        )
        
        assert response.status_code == 400, f"Expected 400 for invalid permission, got {response.status_code}"
        print("✓ Invalid permissions are rejected with 400")
    
    def test_update_requires_auth(self):
        """Test that unauthenticated requests fail"""
        response = requests.put(
            f"{BASE_URL}/api/admin/users/{str(uuid.uuid4())}/permissions",
            json={"permissions": ["dashboard"]}
        )
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Unauthenticated update returns 401")
    
    def test_update_nonexistent_user_returns_404(self, auth_and_user_setup):
        """Test that updating non-existent user returns 404"""
        token = auth_and_user_setup["token"]
        fake_user_id = str(uuid.uuid4())
        
        response = requests.put(
            f"{BASE_URL}/api/admin/users/{fake_user_id}/permissions",
            headers={"Authorization": f"Bearer {token}"},
            json={"permissions": ["dashboard"]}
        )
        
        assert response.status_code == 404, f"Expected 404 for non-existent user, got {response.status_code}"
        print("✓ Non-existent user returns 404")
    
    def test_update_all_permissions(self, auth_and_user_setup):
        """Test updating user to have all permissions"""
        token = auth_and_user_setup["token"]
        user_id = auth_and_user_setup["user_id"]
        
        response = requests.put(
            f"{BASE_URL}/api/admin/users/{user_id}/permissions",
            headers={"Authorization": f"Bearer {token}"},
            json={"permissions": EXPECTED_PERMISSIONS}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert len(data["permissions"]) == 10, f"Expected 10 permissions, got {len(data['permissions'])}"
        print("✓ All 10 permissions can be assigned to user")
    
    def test_update_no_permissions(self, auth_and_user_setup):
        """Test updating user to have no permissions"""
        token = auth_and_user_setup["token"]
        user_id = auth_and_user_setup["user_id"]
        
        response = requests.put(
            f"{BASE_URL}/api/admin/users/{user_id}/permissions",
            headers={"Authorization": f"Bearer {token}"},
            json={"permissions": []}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert len(data["permissions"]) == 0, f"Expected 0 permissions, got {len(data['permissions'])}"
        print("✓ User can have zero permissions")
    
    def test_cleanup_restore_permissions(self, auth_and_user_setup):
        """Cleanup: restore original permissions"""
        token = auth_and_user_setup["token"]
        user_id = auth_and_user_setup["user_id"]
        original_perms = auth_and_user_setup["original_permissions"]
        
        response = requests.put(
            f"{BASE_URL}/api/admin/users/{user_id}/permissions",
            headers={"Authorization": f"Bearer {token}"},
            json={"permissions": original_perms if original_perms else ["dashboard"]}
        )
        
        assert response.status_code == 200, f"Cleanup failed: {response.status_code}"
        print("✓ Cleanup: restored user permissions")


class TestGetCompanyUsers:
    """Test GET /api/admin/companies/{company_id}/users includes permissions"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": SUPER_ADMIN_EMAIL, "password": SUPER_ADMIN_PASSWORD}
        )
        assert response.status_code == 200
        return response.json()["access_token"]
    
    def test_users_include_permissions_field(self, auth_token):
        """Test that users returned include permissions field"""
        # Get companies
        companies_response = requests.get(
            f"{BASE_URL}/api/admin/companies",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        companies = companies_response.json()
        
        # Find company with users
        for company in companies:
            if company.get("user_count", 0) > 0:
                users_response = requests.get(
                    f"{BASE_URL}/api/admin/companies/{company['id']}/users",
                    headers={"Authorization": f"Bearer {auth_token}"}
                )
                if users_response.status_code == 200:
                    users = users_response.json()
                    if users:
                        # Check that permissions field exists
                        for user in users:
                            assert "permissions" in user or isinstance(user.get("permissions"), list), \
                                f"User {user.get('email')} should have permissions field"
                        print("✓ Users include permissions field")
                        return
        
        pytest.skip("No company with users found for testing")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
