"""
Approvals Module Backend Tests
Tests for: Create Approval Request, Get Pending Approvals, Get My Requests, 
Get Approval Stats, Get Workflows, Approve Request, Reject Request, Cancel Request
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@company.com"
TEST_PASSWORD = "Test@123"


class TestApprovalAuth:
    """Authentication for approval tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        token = response.json().get("access_token")
        assert token, "No token returned"
        return token
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_login_success(self):
        """Test login works"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == TEST_EMAIL
        print(f"✓ Login successful for {TEST_EMAIL}")


class TestApprovalStats:
    """Approval Statistics Tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_approval_stats(self, auth_headers):
        """GET /api/approvals/stats - Get approval statistics"""
        response = requests.get(
            f"{BASE_URL}/api/approvals/stats",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Stats failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "my_pending" in data
        assert "total_requests" in data
        assert "by_status" in data
        assert "by_type" in data
        assert "average_approval_hours" in data
        
        # Verify data types
        assert isinstance(data["my_pending"], int)
        assert isinstance(data["total_requests"], int)
        assert isinstance(data["by_status"], dict)
        assert isinstance(data["by_type"], dict)
        
        print(f"✓ Stats: my_pending={data['my_pending']}, total={data['total_requests']}")


class TestApprovalWorkflows:
    """Workflow Configuration Tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_workflows_list(self, auth_headers):
        """GET /api/approvals/workflows/list - Get all workflows"""
        response = requests.get(
            f"{BASE_URL}/api/approvals/workflows/list",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Workflows failed: {response.text}"
        data = response.json()
        
        # Should return list
        assert isinstance(data, list)
        
        # Check default workflow types exist
        workflow_types = [w.get("type") for w in data]
        expected_types = ["expense", "leave_request", "purchase_order", "invoice"]
        
        for expected in expected_types:
            assert expected in workflow_types, f"Missing workflow type: {expected}"
        
        # Verify workflow structure
        for workflow in data:
            assert "type" in workflow
            assert "name_en" in workflow or "name_ar" in workflow
        
        print(f"✓ Found {len(data)} workflows: {workflow_types}")


class TestCreateApprovalRequest:
    """Approval Request Creation Tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_create_expense_request(self, auth_headers):
        """POST /api/approvals/request - Create expense approval request"""
        request_data = {
            "type": "expense",
            "title": "TEST_Expense_Office Supplies",
            "description": "Office supplies for Q1 2026",
            "amount": "1500.00",
            "currency": "EGP"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/approvals/request",
            json=request_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "id" in data
        assert data["id"].startswith("apr_")
        assert data["type"] == "expense"
        assert data["title"] == request_data["title"]
        assert data["status"] == "pending"
        assert data["current_level"] == 1
        assert "approvers" in data
        assert "approval_history" in data
        
        print(f"✓ Created expense request: {data['id']}")
        return data["id"]
    
    def test_create_leave_request(self, auth_headers):
        """POST /api/approvals/request - Create leave approval request"""
        request_data = {
            "type": "leave_request",
            "title": "TEST_Leave_Annual Leave",
            "description": "Annual leave request for February 2026"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/approvals/request",
            json=request_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        assert data["type"] == "leave_request"
        assert data["status"] == "pending"
        print(f"✓ Created leave request: {data['id']}")
    
    def test_create_purchase_order_request(self, auth_headers):
        """POST /api/approvals/request - Create purchase order approval request"""
        request_data = {
            "type": "purchase_order",
            "title": "TEST_PO_IT Equipment",
            "description": "New IT equipment for development team",
            "amount": "50000.00",
            "currency": "EGP"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/approvals/request",
            json=request_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Create failed: {response.text}"
        data = response.json()
        
        assert data["type"] == "purchase_order"
        assert data["amount"] == "50000.00"
        print(f"✓ Created purchase order request: {data['id']}")
    
    def test_create_invalid_type_fails(self, auth_headers):
        """POST /api/approvals/request - Invalid type should fail"""
        request_data = {
            "type": "invalid_type",
            "title": "Invalid Request"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/approvals/request",
            json=request_data,
            headers=auth_headers
        )
        assert response.status_code == 400, "Should fail for invalid type"
        print("✓ Invalid type correctly rejected")


class TestMyRequests:
    """My Requests Tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_my_requests(self, auth_headers):
        """GET /api/approvals/my-requests - Get user's requests"""
        response = requests.get(
            f"{BASE_URL}/api/approvals/my-requests",
            headers=auth_headers
        )
        assert response.status_code == 200, f"My requests failed: {response.text}"
        data = response.json()
        
        # Should return list
        assert isinstance(data, list)
        
        # If there are requests, verify structure
        if len(data) > 0:
            req = data[0]
            assert "id" in req
            assert "type" in req
            assert "title" in req
            assert "status" in req
        
        print(f"✓ Found {len(data)} requests for current user")
    
    def test_get_my_requests_with_status_filter(self, auth_headers):
        """GET /api/approvals/my-requests?status=pending - Filter by status"""
        response = requests.get(
            f"{BASE_URL}/api/approvals/my-requests?status=pending",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Filtered requests failed: {response.text}"
        data = response.json()
        
        # All returned should be pending
        for req in data:
            assert req["status"] == "pending", f"Found non-pending request: {req['status']}"
        
        print(f"✓ Found {len(data)} pending requests")


class TestPendingApprovals:
    """Pending Approvals Tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_pending_approvals(self, auth_headers):
        """GET /api/approvals/pending - Get pending approvals for user"""
        response = requests.get(
            f"{BASE_URL}/api/approvals/pending",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Pending approvals failed: {response.text}"
        data = response.json()
        
        # Should return list
        assert isinstance(data, list)
        
        # All should be pending status
        for req in data:
            assert req["status"] == "pending", "Non-pending request in pending list"
        
        print(f"✓ Found {len(data)} pending approvals")


class TestApprovalActions:
    """Approve, Reject, Cancel Actions Tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_request_id(self, auth_headers):
        """Create a test request for actions testing"""
        request_data = {
            "type": "document",
            "title": "TEST_Action_Document Approval",
            "description": "Test document for approval actions"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/approvals/request",
            json=request_data,
            headers=auth_headers
        )
        if response.status_code == 200:
            return response.json()["id"]
        return None
    
    def test_cancel_own_request(self, auth_headers, test_request_id):
        """POST /api/approvals/{id}/cancel - Cancel own request"""
        if not test_request_id:
            pytest.skip("No test request created")
        
        response = requests.post(
            f"{BASE_URL}/api/approvals/{test_request_id}/cancel",
            json={},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Cancel failed: {response.text}"
        data = response.json()
        assert data.get("success") == True
        print(f"✓ Cancelled request: {test_request_id}")
    
    def test_cancel_already_cancelled_fails(self, auth_headers, test_request_id):
        """POST /api/approvals/{id}/cancel - Cannot cancel non-pending"""
        if not test_request_id:
            pytest.skip("No test request created")
        
        response = requests.post(
            f"{BASE_URL}/api/approvals/{test_request_id}/cancel",
            json={},
            headers=auth_headers
        )
        # Should fail because already cancelled
        assert response.status_code == 400, "Should fail for non-pending request"
        print("✓ Cannot cancel already cancelled request")
    
    def test_approve_request(self, auth_headers):
        """POST /api/approvals/{id}/approve - Approve a request"""
        # First create a fresh request
        request_data = {
            "type": "document",
            "title": "TEST_Approve_Document",
            "description": "Test document for approval"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/approvals/request",
            json=request_data,
            headers=auth_headers
        )
        
        if create_response.status_code != 200:
            pytest.skip("Could not create test request")
        
        request_id = create_response.json()["id"]
        
        # Try to approve (may fail if user is not an approver at current level)
        approve_response = requests.post(
            f"{BASE_URL}/api/approvals/{request_id}/approve",
            json={"comments": "Approved via test"},
            headers=auth_headers
        )
        
        # Either success (200) or not authorized (403) depending on user role
        assert approve_response.status_code in [200, 403], f"Unexpected status: {approve_response.status_code}"
        
        if approve_response.status_code == 200:
            data = approve_response.json()
            assert data.get("success") == True
            print(f"✓ Approved request: {request_id}")
        else:
            print("✓ User not authorized to approve at this level (expected)")
    
    def test_reject_request(self, auth_headers):
        """POST /api/approvals/{id}/reject - Reject a request"""
        # First create a fresh request
        request_data = {
            "type": "expense",
            "title": "TEST_Reject_Expense",
            "description": "Test expense for rejection",
            "amount": "999"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/approvals/request",
            json=request_data,
            headers=auth_headers
        )
        
        if create_response.status_code != 200:
            pytest.skip("Could not create test request")
        
        request_id = create_response.json()["id"]
        
        # Try to reject
        reject_response = requests.post(
            f"{BASE_URL}/api/approvals/{request_id}/reject",
            json={"reason": "Budget exceeded for test"},
            headers=auth_headers
        )
        
        # Either success or not authorized
        assert reject_response.status_code in [200, 403], f"Unexpected status: {reject_response.status_code}"
        
        if reject_response.status_code == 200:
            data = reject_response.json()
            assert data.get("success") == True
            assert data.get("status") == "rejected"
            print(f"✓ Rejected request: {request_id}")
        else:
            print("✓ User not authorized to reject at this level (expected)")


class TestGetSingleRequest:
    """Get Single Approval Request Tests"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        token = response.json().get("access_token")
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_existing_request(self, auth_headers):
        """GET /api/approvals/{id} - Get existing request"""
        # Use the existing request ID from problem statement
        request_id = "apr_ojp8msjv"
        
        response = requests.get(
            f"{BASE_URL}/api/approvals/{request_id}",
            headers=auth_headers
        )
        
        # May or may not exist
        if response.status_code == 200:
            data = response.json()
            assert data["id"] == request_id
            assert "type" in data
            assert "status" in data
            print(f"✓ Found request: {request_id}, status={data['status']}")
        elif response.status_code == 404:
            print(f"✓ Request {request_id} not found (may have been deleted)")
        else:
            assert False, f"Unexpected status: {response.status_code}"
    
    def test_get_nonexistent_request(self, auth_headers):
        """GET /api/approvals/{id} - Non-existent returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/approvals/apr_nonexistent123",
            headers=auth_headers
        )
        assert response.status_code == 404, "Should return 404 for non-existent"
        print("✓ Non-existent request returns 404")


class TestAuthorizationChecks:
    """Authorization and Security Tests"""
    
    def test_stats_without_auth_fails(self):
        """Stats endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/approvals/stats")
        assert response.status_code == 401, "Should fail without auth"
        print("✓ Stats requires authentication")
    
    def test_pending_without_auth_fails(self):
        """Pending endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/approvals/pending")
        assert response.status_code == 401, "Should fail without auth"
        print("✓ Pending requires authentication")
    
    def test_my_requests_without_auth_fails(self):
        """My requests endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/approvals/my-requests")
        assert response.status_code == 401, "Should fail without auth"
        print("✓ My requests requires authentication")
    
    def test_create_request_without_auth_fails(self):
        """Create request requires auth"""
        response = requests.post(
            f"{BASE_URL}/api/approvals/request",
            json={"type": "expense", "title": "Test"}
        )
        assert response.status_code == 401, "Should fail without auth"
        print("✓ Create request requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
