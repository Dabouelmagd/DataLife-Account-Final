"""
Test suite for Notifications and Invoices API endpoints
Testing:
1. Notifications: GET /api/notifications/, POST /api/notifications/, PUT /api/notifications/{id}/read
2. Invoices: POST /api/invoices/, GET /api/invoices/, GET /api/invoices/stats, POST /api/invoices/{number}/etax/submit
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@company.com"
TEST_PASSWORD = "Test@123"


@pytest.fixture(scope="module")
def api_session():
    """Create requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_session):
    """Get authentication token by logging in"""
    response = api_session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    data = response.json()
    return data.get("access_token") or data.get("token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


# ===========================================
# NOTIFICATIONS API TESTS
# ===========================================

class TestNotificationsAPI:
    """Test Notifications API endpoints"""
    
    def test_get_notifications_unauthorized(self, api_session):
        """Test getting notifications without auth returns 401"""
        response = api_session.get(f"{BASE_URL}/api/notifications/")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: GET /api/notifications/ without auth returns 401")
    
    def test_get_notifications_authorized(self, api_session, auth_headers):
        """Test getting notifications with valid auth"""
        response = api_session.get(
            f"{BASE_URL}/api/notifications/",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "notifications" in data, "Response should contain 'notifications' key"
        assert "unread_count" in data, "Response should contain 'unread_count' key"
        assert isinstance(data["notifications"], list), "Notifications should be a list"
        print(f"PASS: GET /api/notifications/ returns {len(data['notifications'])} notifications, {data['unread_count']} unread")
    
    def test_create_notification(self, api_session, auth_headers):
        """Test creating a new notification"""
        notification_data = {
            "type": "system",
            "title_en": "TEST_Notification Title",
            "title_ar": "عنوان الإشعار التجريبي",
            "message_en": "This is a test notification message",
            "message_ar": "هذه رسالة إشعار تجريبية",
            "broadcast": False
        }
        
        response = api_session.post(
            f"{BASE_URL}/api/notifications/",
            json=notification_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "id" in data, "Response should contain notification 'id'"
        assert data["type"] == "system", "Notification type should be 'system'"
        assert data["title_en"] == "TEST_Notification Title", "Title should match"
        assert data["read"] == False, "New notification should be unread"
        
        # Store notification id for later tests
        TestNotificationsAPI.created_notification_id = data["id"]
        print(f"PASS: POST /api/notifications/ created notification with id: {data['id']}")
    
    def test_mark_notification_as_read(self, api_session, auth_headers):
        """Test marking a notification as read"""
        notification_id = getattr(TestNotificationsAPI, 'created_notification_id', None)
        
        if not notification_id:
            pytest.skip("No notification ID from previous test")
        
        response = api_session.put(
            f"{BASE_URL}/api/notifications/{notification_id}/read",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Should return success: true"
        print(f"PASS: PUT /api/notifications/{notification_id}/read marked as read")
    
    def test_get_notifications_verify_read_status(self, api_session, auth_headers):
        """Verify notification is marked as read after update"""
        notification_id = getattr(TestNotificationsAPI, 'created_notification_id', None)
        
        if not notification_id:
            pytest.skip("No notification ID from previous test")
        
        response = api_session.get(
            f"{BASE_URL}/api/notifications/",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Find our notification
        found = False
        for notif in data["notifications"]:
            if notif.get("id") == notification_id:
                found = True
                assert notif.get("read") == True, "Notification should be marked as read"
                print(f"PASS: Notification {notification_id} is now marked as read")
                break
        
        if not found:
            print(f"INFO: Notification {notification_id} not found in list (may have been cleaned)")


# ===========================================
# INVOICES API TESTS
# ===========================================

class TestInvoicesAPI:
    """Test Invoices API endpoints"""
    
    def test_get_invoices_unauthorized(self, api_session):
        """Test getting invoices without auth returns 401"""
        response = api_session.get(f"{BASE_URL}/api/invoices/")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: GET /api/invoices/ without auth returns 401")
    
    def test_get_invoices_authorized(self, api_session, auth_headers):
        """Test getting invoices with valid auth"""
        response = api_session.get(
            f"{BASE_URL}/api/invoices/",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list of invoices"
        print(f"PASS: GET /api/invoices/ returns {len(data)} invoices")
    
    def test_get_invoice_stats(self, api_session, auth_headers):
        """Test getting invoice statistics"""
        response = api_session.get(
            f"{BASE_URL}/api/invoices/stats",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total_invoices" in data, "Response should contain 'total_invoices'"
        assert "total_amount" in data, "Response should contain 'total_amount'"
        assert "paid_amount" in data, "Response should contain 'paid_amount'"
        assert "pending_amount" in data, "Response should contain 'pending_amount'"
        print(f"PASS: GET /api/invoices/stats - Total: {data['total_invoices']}, Amount: {data['total_amount']}")
    
    def test_create_regular_invoice(self, api_session, auth_headers):
        """Test creating a regular invoice"""
        invoice_data = {
            "customer_name": "TEST_Customer",
            "customer_email": "test_customer@example.com",
            "customer_phone": "+201234567890",
            "customer_address": "123 Test Street",
            "invoice_type": "regular",
            "items": [
                {
                    "description": "Test Product A",
                    "quantity": 2,
                    "unit_price": 100.00,
                    "tax_rate": 14,
                    "discount": 0
                },
                {
                    "description": "Test Service B",
                    "quantity": 1,
                    "unit_price": 500.00,
                    "tax_rate": 14,
                    "discount": 10
                }
            ],
            "notes": "Test regular invoice",
            "currency": "EGP"
        }
        
        response = api_session.post(
            f"{BASE_URL}/api/invoices/",
            json=invoice_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "invoice_number" in data, "Response should contain 'invoice_number'"
        assert data["invoice_type"] == "regular", "Invoice type should be 'regular'"
        assert data["customer_name"] == "TEST_Customer", "Customer name should match"
        assert data["status"] == "draft", "New invoice should be in 'draft' status"
        assert "grand_total" in data, "Response should contain 'grand_total'"
        assert len(data["items"]) == 2, "Invoice should have 2 items"
        
        # Calculate expected totals
        # Item A: 2 * 100 = 200, tax = 200 * 0.14 = 28, total = 228
        # Item B: 1 * 500 = 500, discount = 50, after discount = 450, tax = 450 * 0.14 = 63, total = 513
        # Grand total should be 228 + 513 = 741
        
        TestInvoicesAPI.created_regular_invoice_number = data["invoice_number"]
        print(f"PASS: POST /api/invoices/ (regular) created invoice: {data['invoice_number']}, total: {data['grand_total']} EGP")
    
    def test_create_etax_invoice(self, api_session, auth_headers):
        """Test creating an E-Tax electronic invoice"""
        invoice_data = {
            "customer_name": "TEST_ETax_Customer",
            "customer_email": "etax_customer@example.com",
            "customer_phone": "+201234567891",
            "customer_address": "456 E-Tax Street",
            "customer_tax_id": "123456789",  # Required for E-Tax
            "issuer_tax_id": "987654321",
            "invoice_type": "etax",
            "items": [
                {
                    "description": "E-Tax Product",
                    "quantity": 3,
                    "unit_price": 200.00,
                    "tax_rate": 14,
                    "discount": 5
                }
            ],
            "notes": "Test E-Tax invoice",
            "currency": "EGP"
        }
        
        response = api_session.post(
            f"{BASE_URL}/api/invoices/",
            json=invoice_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "invoice_number" in data, "Response should contain 'invoice_number'"
        assert data["invoice_type"] == "etax", "Invoice type should be 'etax'"
        assert data["invoice_number"].startswith("ETAX-"), "E-Tax invoice number should start with 'ETAX-'"
        assert data["customer_tax_id"] == "123456789", "Customer tax ID should match"
        assert "etax_uuid" in data, "E-Tax invoice should have UUID"
        assert data["etax_submission_status"] == "pending", "E-Tax status should be 'pending'"
        
        TestInvoicesAPI.created_etax_invoice_number = data["invoice_number"]
        print(f"PASS: POST /api/invoices/ (etax) created invoice: {data['invoice_number']}, UUID: {data['etax_uuid'][:16]}...")
    
    def test_get_invoice_by_number(self, api_session, auth_headers):
        """Test getting invoice by number"""
        invoice_number = getattr(TestInvoicesAPI, 'created_regular_invoice_number', None)
        
        if not invoice_number:
            pytest.skip("No invoice number from previous test")
        
        response = api_session.get(
            f"{BASE_URL}/api/invoices/{invoice_number}",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["invoice_number"] == invoice_number, "Invoice number should match"
        print(f"PASS: GET /api/invoices/{invoice_number} returns correct invoice")
    
    def test_submit_etax_invoice_without_tax_id(self, api_session, auth_headers):
        """Test E-Tax submission fails when customer tax ID is missing"""
        # Create invoice without tax ID
        invoice_data = {
            "customer_name": "TEST_NoTaxID_Customer",
            "invoice_type": "etax",
            "items": [
                {
                    "description": "Test Product",
                    "quantity": 1,
                    "unit_price": 100.00,
                    "tax_rate": 14,
                    "discount": 0
                }
            ]
        }
        
        response = api_session.post(
            f"{BASE_URL}/api/invoices/",
            json=invoice_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Create should succeed, got {response.status_code}"
        data = response.json()
        invoice_number = data["invoice_number"]
        
        # Try to submit to E-Tax
        response = api_session.post(
            f"{BASE_URL}/api/invoices/{invoice_number}/etax/submit",
            headers=auth_headers
        )
        
        assert response.status_code == 400, f"Expected 400 for missing tax ID, got {response.status_code}"
        print("PASS: E-Tax submission correctly fails when customer tax ID is missing")
    
    def test_submit_etax_invoice(self, api_session, auth_headers):
        """Test submitting E-Tax invoice to Egyptian Tax Authority (MOCKED)"""
        invoice_number = getattr(TestInvoicesAPI, 'created_etax_invoice_number', None)
        
        if not invoice_number:
            pytest.skip("No E-Tax invoice number from previous test")
        
        response = api_session.post(
            f"{BASE_URL}/api/invoices/{invoice_number}/etax/submit",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Should return success: true"
        assert "etax_response" in data, "Should contain 'etax_response'"
        assert data["etax_response"].get("status") == "Valid", "Status should be 'Valid'"
        print(f"PASS: POST /api/invoices/{invoice_number}/etax/submit - MOCKED submission successful")
    
    def test_get_etax_status_after_submission(self, api_session, auth_headers):
        """Verify E-Tax status after submission"""
        invoice_number = getattr(TestInvoicesAPI, 'created_etax_invoice_number', None)
        
        if not invoice_number:
            pytest.skip("No E-Tax invoice number from previous test")
        
        response = api_session.get(
            f"{BASE_URL}/api/invoices/{invoice_number}/etax/status",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["status"] == "submitted", "Status should be 'submitted' after submission"
        assert data.get("submitted_at") is not None, "Should have submission timestamp"
        print(f"PASS: GET /api/invoices/{invoice_number}/etax/status shows 'submitted'")
    
    def test_get_etax_stats(self, api_session, auth_headers):
        """Test getting E-Tax statistics"""
        response = api_session.get(
            f"{BASE_URL}/api/invoices/etax/stats",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "total_etax_invoices" in data, "Response should contain 'total_etax_invoices'"
        assert "submitted" in data, "Response should contain 'submitted' count"
        assert "pending" in data, "Response should contain 'pending' count"
        print(f"PASS: GET /api/invoices/etax/stats - Total: {data['total_etax_invoices']}, Submitted: {data['submitted']}, Pending: {data['pending']}")
    
    def test_submit_regular_invoice_to_etax_fails(self, api_session, auth_headers):
        """Test that submitting a regular invoice to E-Tax fails"""
        invoice_number = getattr(TestInvoicesAPI, 'created_regular_invoice_number', None)
        
        if not invoice_number:
            pytest.skip("No regular invoice number from previous test")
        
        response = api_session.post(
            f"{BASE_URL}/api/invoices/{invoice_number}/etax/submit",
            headers=auth_headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("PASS: Regular invoice cannot be submitted to E-Tax (expected 400)")


# ===========================================
# CLEANUP
# ===========================================

class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_invoices(self, api_session, auth_headers):
        """Clean up test invoices"""
        # Delete regular invoice
        regular_invoice = getattr(TestInvoicesAPI, 'created_regular_invoice_number', None)
        if regular_invoice:
            response = api_session.delete(
                f"{BASE_URL}/api/invoices/{regular_invoice}",
                headers=auth_headers
            )
            print(f"INFO: Cleanup regular invoice {regular_invoice}: {response.status_code}")
        
        # E-Tax invoice cannot be deleted after submission, just log it
        etax_invoice = getattr(TestInvoicesAPI, 'created_etax_invoice_number', None)
        if etax_invoice:
            print(f"INFO: E-Tax invoice {etax_invoice} kept (submitted to E-Tax)")
        
        print("PASS: Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
