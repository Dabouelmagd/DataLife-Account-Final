"""
Test suite for Change Password and Delete Employee features
- POST /api/auth/change-password
- DELETE /api/users/{user_id}
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USER_EMAIL = "dalia@datalifeai.com"
TEST_USER_PASSWORD = "Dalia@2024"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
    )
    if response.status_code == 200:
        data = response.json()
        return {
            "token": data.get("access_token"),
            "user_id": data.get("user", {}).get("id"),
            "company_id": data.get("user", {}).get("company_id")
        }
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


class TestChangePassword:
    """Change Password API tests - POST /api/auth/change-password"""
    
    def test_change_password_missing_auth(self, api_client):
        """Test change password without authorization header"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/change-password",
            json={
                "current_password": "test123",
                "new_password": "newtest123"
            }
        )
        assert response.status_code == 401
        print(f"✓ Missing auth returns 401: {response.json().get('detail')}")
    
    def test_change_password_missing_fields(self, api_client, auth_token):
        """Test change password with missing required fields"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {auth_token['token']}"},
            json={}
        )
        assert response.status_code == 400
        data = response.json()
        assert "required" in data.get("detail", "").lower() or "current" in data.get("detail", "").lower()
        print(f"✓ Missing fields returns 400: {data.get('detail')}")
    
    def test_change_password_wrong_current(self, api_client, auth_token):
        """Test change password with incorrect current password"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {auth_token['token']}"},
            json={
                "current_password": "WrongPassword123!",
                "new_password": "ValidNew@2024"
            }
        )
        assert response.status_code == 401
        data = response.json()
        assert "incorrect" in data.get("detail", "").lower() or "wrong" in data.get("detail", "").lower() or "current" in data.get("detail", "").lower()
        print(f"✓ Wrong current password returns 401: {data.get('detail')}")
    
    def test_change_password_short_new(self, api_client, auth_token):
        """Test change password with too short new password"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {auth_token['token']}"},
            json={
                "current_password": TEST_USER_PASSWORD,
                "new_password": "12345"  # Less than 6 characters
            }
        )
        assert response.status_code == 400
        data = response.json()
        assert "6" in data.get("detail", "") or "character" in data.get("detail", "").lower()
        print(f"✓ Short password returns 400: {data.get('detail')}")
    
    def test_change_password_success_and_revert(self, api_client, auth_token):
        """Test successful password change and revert back"""
        new_password = "NewTestPassword@2024"
        
        # Step 1: Change to new password
        response = api_client.post(
            f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {auth_token['token']}"},
            json={
                "current_password": TEST_USER_PASSWORD,
                "new_password": new_password
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "success" in data.get("message", "").lower() or "تم تغيير" in data.get("message_ar", "")
        print(f"✓ Password changed successfully: {data.get('message')}")
        
        # Step 2: Login with new password to verify
        login_response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": new_password}
        )
        assert login_response.status_code == 200
        new_token = login_response.json().get("access_token")
        print("✓ Login with new password successful")
        
        # Step 3: Revert to original password
        revert_response = api_client.post(
            f"{BASE_URL}/api/auth/change-password",
            headers={"Authorization": f"Bearer {new_token}"},
            json={
                "current_password": new_password,
                "new_password": TEST_USER_PASSWORD
            }
        )
        assert revert_response.status_code == 200
        print("✓ Password reverted to original")
        
        # Step 4: Verify original password works
        final_login = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_USER_EMAIL, "password": TEST_USER_PASSWORD}
        )
        assert final_login.status_code == 200
        print("✓ Original password verified working")


class TestDeleteEmployee:
    """Delete Employee API tests - DELETE /api/users/{user_id}"""
    
    def test_delete_without_auth(self, api_client):
        """Test delete without authorization"""
        response = api_client.delete(f"{BASE_URL}/api/users/fake-user-id")
        assert response.status_code == 401
        print(f"✓ Delete without auth returns 401")
    
    def test_delete_self_not_allowed(self, api_client, auth_token):
        """Test that user cannot delete themselves"""
        response = api_client.delete(
            f"{BASE_URL}/api/users/{auth_token['user_id']}",
            headers={"Authorization": f"Bearer {auth_token['token']}"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "cannot" in data.get("detail", "").lower() or "own" in data.get("detail", "").lower()
        print(f"✓ Cannot delete own account: {data.get('detail')}")
    
    def test_delete_nonexistent_user(self, api_client, auth_token):
        """Test delete non-existent user"""
        response = api_client.delete(
            f"{BASE_URL}/api/users/nonexistent-user-id-12345",
            headers={"Authorization": f"Bearer {auth_token['token']}"}
        )
        assert response.status_code == 404
        print(f"✓ Delete non-existent user returns 404")
    
    def test_get_employees_list(self, api_client, auth_token):
        """Test getting list of employees to verify delete target"""
        response = api_client.get(
            f"{BASE_URL}/api/users/",
            headers={"Authorization": f"Bearer {auth_token['token']}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Retrieved {len(data)} employees")
        
        # Check structure of employee data
        if len(data) > 0:
            employee = data[0]
            assert "id" in employee
            assert "email" in employee
            assert "full_name" in employee
            print(f"✓ Employee data structure verified")
        
        return data


class TestIntegration:
    """Integration tests for both features together"""
    
    def test_auth_verification_endpoint(self, api_client, auth_token):
        """Verify auth token is valid before running tests"""
        response = api_client.get(
            f"{BASE_URL}/api/auth/verify",
            headers={"Authorization": f"Bearer {auth_token['token']}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("email") == TEST_USER_EMAIL
        print(f"✓ Auth token verified for {data.get('email')}")
    
    def test_user_role_has_permissions(self, api_client, auth_token):
        """Verify current user has manager role for delete permissions"""
        response = api_client.get(
            f"{BASE_URL}/api/auth/verify",
            headers={"Authorization": f"Bearer {auth_token['token']}"}
        )
        assert response.status_code == 200
        data = response.json()
        # Check if user has management role
        management_roles = ['رئيس مجلس الإدارة', 'مدير عام', 'المدير التنفيذي', 
                          'General Manager', 'CEO', 'Board Chairman']
        role = data.get("role", "")
        has_permission = role in management_roles
        print(f"✓ User role: {role}, Has delete permission: {has_permission}")
        assert has_permission, f"User role '{role}' should be a management role for delete tests"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
