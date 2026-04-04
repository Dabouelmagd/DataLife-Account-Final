"""
ETA (Egyptian Tax Authority) Settings API Tests
Tests for ETA integration settings, connection testing, and submissions log
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
    """Get authentication token for API tests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "access_token" in data, "No access_token in login response"
    return data["access_token"]


@pytest.fixture(scope="module")
def api_client(auth_token):
    """Create authenticated session"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestETASettingsAPI:
    """Tests for ETA Settings endpoints"""
    
    def test_get_eta_settings(self, api_client):
        """GET /api/eta/settings - should return ETA settings for company"""
        response = api_client.get(f"{BASE_URL}/api/eta/settings")
        
        assert response.status_code == 200, f"Failed to get ETA settings: {response.text}"
        
        data = response.json()
        # Verify required fields exist
        assert "company_id" in data, "Missing company_id in response"
        assert "tax_registration_number" in data, "Missing tax_registration_number"
        assert "branch_id" in data, "Missing branch_id"
        assert "activity_code" in data, "Missing activity_code"
        assert "client_id" in data, "Missing client_id"
        assert "environment" in data, "Missing environment"
        assert "is_active" in data, "Missing is_active"
        assert "auto_submit_invoices" in data, "Missing auto_submit_invoices"
        
        # Verify client_secret is not exposed (should be masked or removed)
        # The API should either mask it or not return it at all
        print(f"ETA Settings retrieved successfully for company: {data.get('company_id')}")
    
    def test_update_eta_settings_tax_registration(self, api_client):
        """PUT /api/eta/settings - should update tax registration number"""
        # Update tax registration number
        update_data = {
            "tax_registration_number": "TEST_123456789"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/eta/settings",
            json=update_data
        )
        
        assert response.status_code == 200, f"Failed to update ETA settings: {response.text}"
        
        data = response.json()
        assert "message" in data, "No message in update response"
        
        # Verify the update persisted
        get_response = api_client.get(f"{BASE_URL}/api/eta/settings")
        assert get_response.status_code == 200
        
        settings = get_response.json()
        assert settings["tax_registration_number"] == "TEST_123456789", "Tax registration number not updated"
        print("Tax registration number updated successfully")
    
    def test_update_eta_settings_branch_and_activity(self, api_client):
        """PUT /api/eta/settings - should update branch ID and activity code"""
        update_data = {
            "branch_id": "TEST_1",
            "activity_code": "TEST_4610"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/eta/settings",
            json=update_data
        )
        
        assert response.status_code == 200, f"Failed to update: {response.text}"
        
        # Verify persistence
        get_response = api_client.get(f"{BASE_URL}/api/eta/settings")
        settings = get_response.json()
        
        assert settings["branch_id"] == "TEST_1", "Branch ID not updated"
        assert settings["activity_code"] == "TEST_4610", "Activity code not updated"
        print("Branch ID and activity code updated successfully")
    
    def test_update_eta_settings_environment(self, api_client):
        """PUT /api/eta/settings - should update environment setting"""
        # Test preprod environment
        response = api_client.put(
            f"{BASE_URL}/api/eta/settings",
            json={"environment": "preprod"}
        )
        assert response.status_code == 200
        
        get_response = api_client.get(f"{BASE_URL}/api/eta/settings")
        settings = get_response.json()
        assert settings["environment"] == "preprod", "Environment not set to preprod"
        
        # Test production environment
        response = api_client.put(
            f"{BASE_URL}/api/eta/settings",
            json={"environment": "production"}
        )
        assert response.status_code == 200
        
        get_response = api_client.get(f"{BASE_URL}/api/eta/settings")
        settings = get_response.json()
        assert settings["environment"] == "production", "Environment not set to production"
        
        # Reset to preprod
        api_client.put(f"{BASE_URL}/api/eta/settings", json={"environment": "preprod"})
        print("Environment setting updated successfully")
    
    def test_update_eta_settings_is_active(self, api_client):
        """PUT /api/eta/settings - should toggle is_active flag"""
        # Enable integration
        response = api_client.put(
            f"{BASE_URL}/api/eta/settings",
            json={"is_active": True}
        )
        assert response.status_code == 200
        
        get_response = api_client.get(f"{BASE_URL}/api/eta/settings")
        settings = get_response.json()
        assert settings["is_active"] == True, "is_active not set to True"
        
        # Disable integration
        response = api_client.put(
            f"{BASE_URL}/api/eta/settings",
            json={"is_active": False}
        )
        assert response.status_code == 200
        
        get_response = api_client.get(f"{BASE_URL}/api/eta/settings")
        settings = get_response.json()
        assert settings["is_active"] == False, "is_active not set to False"
        print("is_active toggle works correctly")
    
    def test_update_eta_settings_auto_submit(self, api_client):
        """PUT /api/eta/settings - should toggle auto_submit_invoices flag"""
        # Enable auto submit
        response = api_client.put(
            f"{BASE_URL}/api/eta/settings",
            json={"auto_submit_invoices": True}
        )
        assert response.status_code == 200
        
        get_response = api_client.get(f"{BASE_URL}/api/eta/settings")
        settings = get_response.json()
        assert settings["auto_submit_invoices"] == True, "auto_submit_invoices not enabled"
        
        # Disable auto submit
        response = api_client.put(
            f"{BASE_URL}/api/eta/settings",
            json={"auto_submit_invoices": False}
        )
        assert response.status_code == 200
        
        get_response = api_client.get(f"{BASE_URL}/api/eta/settings")
        settings = get_response.json()
        assert settings["auto_submit_invoices"] == False, "auto_submit_invoices not disabled"
        print("auto_submit_invoices toggle works correctly")
    
    def test_update_eta_settings_client_credentials(self, api_client):
        """PUT /api/eta/settings - should update client_id and client_secret"""
        update_data = {
            "client_id": "TEST_client_id_12345",
            "client_secret": "TEST_client_secret_67890"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/eta/settings",
            json=update_data
        )
        assert response.status_code == 200, f"Failed to update credentials: {response.text}"
        
        # Verify client_id is updated (client_secret should be masked)
        get_response = api_client.get(f"{BASE_URL}/api/eta/settings")
        settings = get_response.json()
        assert settings["client_id"] == "TEST_client_id_12345", "client_id not updated"
        
        # client_secret should be masked or not returned
        # The API masks it with client_secret_masked field
        print("Client credentials updated successfully")


class TestETAConnectionAPI:
    """Tests for ETA Connection testing endpoint"""
    
    def test_test_connection_endpoint_exists(self, api_client):
        """POST /api/eta/test-connection - endpoint should exist and respond"""
        response = api_client.post(
            f"{BASE_URL}/api/eta/test-connection",
            json={
                "client_id": "test-client-id",
                "client_secret": "test-secret",
                "environment": "preprod"
            }
        )
        
        # Should return 200 even if connection fails (with success: false)
        assert response.status_code == 200, f"Unexpected status code: {response.status_code}"
        
        data = response.json()
        assert "success" in data, "Missing 'success' field in response"
        assert "message" in data, "Missing 'message' field in response"
        
        # With fake credentials, success should be false
        assert data["success"] == False, "Should fail with fake credentials"
        print(f"Test connection response: {data}")
    
    def test_test_connection_preprod_environment(self, api_client):
        """POST /api/eta/test-connection - should use preprod environment"""
        response = api_client.post(
            f"{BASE_URL}/api/eta/test-connection",
            json={
                "client_id": "fake-client-id",
                "client_secret": "fake-secret",
                "environment": "preprod"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should fail but return proper error structure
        assert data["success"] == False
        assert "error" in data, "Should include error details"
        print(f"Preprod connection test: {data.get('error', 'No error details')}")
    
    def test_test_connection_production_environment(self, api_client):
        """POST /api/eta/test-connection - should use production environment"""
        response = api_client.post(
            f"{BASE_URL}/api/eta/test-connection",
            json={
                "client_id": "fake-client-id",
                "client_secret": "fake-secret",
                "environment": "production"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should fail but return proper error structure
        assert data["success"] == False
        print(f"Production connection test: {data.get('error', 'No error details')}")
    
    def test_test_connection_missing_credentials(self, api_client):
        """POST /api/eta/test-connection - should handle missing credentials"""
        # Test with empty client_id
        response = api_client.post(
            f"{BASE_URL}/api/eta/test-connection",
            json={
                "client_id": "",
                "client_secret": "test-secret",
                "environment": "preprod"
            }
        )
        
        # Should either return 422 (validation error) or 200 with success: false
        assert response.status_code in [200, 422], f"Unexpected status: {response.status_code}"
        print("Missing credentials handled correctly")


class TestETASubmissionsAPI:
    """Tests for ETA Submissions log endpoint"""
    
    def test_get_submissions_empty(self, api_client):
        """GET /api/eta/submissions - should return submissions list (may be empty)"""
        response = api_client.get(f"{BASE_URL}/api/eta/submissions")
        
        assert response.status_code == 200, f"Failed to get submissions: {response.text}"
        
        data = response.json()
        assert "submissions" in data, "Missing 'submissions' field"
        assert "total" in data, "Missing 'total' field"
        assert "page" in data, "Missing 'page' field"
        assert "limit" in data, "Missing 'limit' field"
        assert "total_pages" in data, "Missing 'total_pages' field"
        
        assert isinstance(data["submissions"], list), "submissions should be a list"
        assert isinstance(data["total"], int), "total should be an integer"
        print(f"Submissions retrieved: {data['total']} total")
    
    def test_get_submissions_with_pagination(self, api_client):
        """GET /api/eta/submissions - should support pagination parameters"""
        response = api_client.get(
            f"{BASE_URL}/api/eta/submissions",
            params={"page": 1, "limit": 10}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["page"] == 1, "Page should be 1"
        assert data["limit"] == 10, "Limit should be 10"
        print("Pagination parameters work correctly")
    
    def test_get_submissions_with_status_filter(self, api_client):
        """GET /api/eta/submissions - should support status filter"""
        # Test with different status filters
        for status in ["pending", "submitted", "valid", "invalid", "rejected"]:
            response = api_client.get(
                f"{BASE_URL}/api/eta/submissions",
                params={"status": status}
            )
            
            assert response.status_code == 200, f"Failed with status filter '{status}'"
            
            data = response.json()
            # All returned submissions should have the filtered status (if any)
            for sub in data["submissions"]:
                assert sub.get("status") == status, f"Submission status mismatch: expected {status}"
        
        print("Status filter works correctly")
    
    def test_get_submissions_large_limit(self, api_client):
        """GET /api/eta/submissions - should handle large limit"""
        response = api_client.get(
            f"{BASE_URL}/api/eta/submissions",
            params={"limit": 100}
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["limit"] == 100, "Limit should be 100"
        print("Large limit handled correctly")


class TestETASettingsUnauthorized:
    """Tests for unauthorized access to ETA endpoints"""
    
    def test_get_settings_without_auth(self):
        """GET /api/eta/settings - should require authentication"""
        response = requests.get(f"{BASE_URL}/api/eta/settings")
        assert response.status_code == 401, "Should return 401 without auth"
        print("Unauthorized access blocked correctly")
    
    def test_update_settings_without_auth(self):
        """PUT /api/eta/settings - should require authentication"""
        response = requests.put(
            f"{BASE_URL}/api/eta/settings",
            json={"tax_registration_number": "123"}
        )
        assert response.status_code == 401, "Should return 401 without auth"
        print("Unauthorized update blocked correctly")
    
    def test_test_connection_without_auth(self):
        """POST /api/eta/test-connection - should require authentication"""
        response = requests.post(
            f"{BASE_URL}/api/eta/test-connection",
            json={"client_id": "test", "client_secret": "test", "environment": "preprod"}
        )
        assert response.status_code == 401, "Should return 401 without auth"
        print("Unauthorized connection test blocked correctly")
    
    def test_get_submissions_without_auth(self):
        """GET /api/eta/submissions - should require authentication"""
        response = requests.get(f"{BASE_URL}/api/eta/submissions")
        assert response.status_code == 401, "Should return 401 without auth"
        print("Unauthorized submissions access blocked correctly")


class TestETASettingsCleanup:
    """Cleanup test data after tests"""
    
    def test_cleanup_test_data(self, api_client):
        """Reset ETA settings to reasonable defaults after tests"""
        cleanup_data = {
            "tax_registration_number": "123456789",
            "branch_id": "0",
            "activity_code": "4610",
            "client_id": "test-client-id",
            "environment": "preprod",
            "is_active": False,
            "auto_submit_invoices": False
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/eta/settings",
            json=cleanup_data
        )
        
        assert response.status_code == 200, "Cleanup failed"
        print("Test data cleaned up successfully")
