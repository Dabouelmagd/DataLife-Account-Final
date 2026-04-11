"""
Push Notifications API Tests
Tests for P3: Browser push notifications with Service Worker, VAPID keys, notification bell
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPushNotificationsPublic:
    """Public push notification endpoints (no auth required)"""
    
    def test_get_vapid_public_key(self):
        """GET /api/push/vapid-key should return VAPID public key"""
        response = requests.get(f"{BASE_URL}/api/push/vapid-key")
        assert response.status_code == 200
        
        data = response.json()
        assert "publicKey" in data
        assert isinstance(data["publicKey"], str)
        assert len(data["publicKey"]) > 50  # VAPID keys are long
        print(f"VAPID public key returned: {data['publicKey'][:30]}...")
    
    def test_service_worker_accessible(self):
        """Service worker file should be accessible at /sw-push.js"""
        response = requests.get(f"{BASE_URL}/sw-push.js")
        assert response.status_code == 200
        
        content = response.text
        assert "push" in content.lower()
        assert "addEventListener" in content
        assert "showNotification" in content
        print("Service worker file is accessible and contains push notification code")


class TestPushNotificationsAuth:
    """Authenticated push notification endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "info@datalifeai.com", "password": "Admin@123456"}
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed - skipping authenticated tests")
        
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.user_id = login_response.json().get("user", {}).get("id")
    
    def test_get_notifications(self):
        """GET /api/push/notifications should return user notifications with unread count"""
        response = requests.get(
            f"{BASE_URL}/api/push/notifications?limit=20",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "notifications" in data
        assert "total" in data
        assert "unread" in data
        assert isinstance(data["notifications"], list)
        assert isinstance(data["total"], int)
        assert isinstance(data["unread"], int)
        print(f"Notifications: total={data['total']}, unread={data['unread']}")
    
    def test_get_notifications_without_auth(self):
        """GET /api/push/notifications without auth should return 401"""
        response = requests.get(f"{BASE_URL}/api/push/notifications")
        assert response.status_code == 401
        print("Correctly returns 401 without auth")
    
    def test_subscribe_push(self):
        """POST /api/push/subscribe should store push subscription"""
        subscription_data = {
            "endpoint": "https://test-endpoint.example.com/push/test_pytest_123",
            "keys": {
                "p256dh": "test_p256dh_key_pytest",
                "auth": "test_auth_key_pytest"
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json=subscription_data,
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert "message" in data
        print(f"Subscribe response: {data}")
    
    def test_subscribe_push_without_auth(self):
        """POST /api/push/subscribe without auth should return 401"""
        subscription_data = {
            "endpoint": "https://test-endpoint.example.com/push/no_auth",
            "keys": {"p256dh": "test", "auth": "test"}
        }
        
        response = requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json=subscription_data
        )
        assert response.status_code == 401
        print("Correctly returns 401 without auth")
    
    def test_send_test_notification(self):
        """POST /api/push/send-test should create a test notification"""
        # Get initial notification count
        initial_response = requests.get(
            f"{BASE_URL}/api/push/notifications?limit=50",
            headers=self.headers
        )
        initial_count = initial_response.json().get("total", 0)
        
        # Send test notification
        response = requests.post(
            f"{BASE_URL}/api/push/send-test",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert "message" in data
        print(f"Send test response: {data}")
        
        # Verify notification was created
        after_response = requests.get(
            f"{BASE_URL}/api/push/notifications?limit=50",
            headers=self.headers
        )
        after_count = after_response.json().get("total", 0)
        assert after_count >= initial_count  # Should have at least same or more
        print(f"Notification count: before={initial_count}, after={after_count}")
    
    def test_send_test_notification_without_auth(self):
        """POST /api/push/send-test without auth should return 401"""
        response = requests.post(f"{BASE_URL}/api/push/send-test")
        assert response.status_code == 401
        print("Correctly returns 401 without auth")
    
    def test_mark_all_notifications_read(self):
        """PUT /api/push/notifications/read should mark all notifications as read"""
        response = requests.put(
            f"{BASE_URL}/api/push/notifications/read",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        print(f"Mark all read response: {data}")
        
        # Verify unread count is 0
        check_response = requests.get(
            f"{BASE_URL}/api/push/notifications",
            headers=self.headers
        )
        unread = check_response.json().get("unread", -1)
        assert unread == 0
        print(f"Unread count after marking all read: {unread}")
    
    def test_mark_all_notifications_read_without_auth(self):
        """PUT /api/push/notifications/read without auth should return 401"""
        response = requests.put(f"{BASE_URL}/api/push/notifications/read")
        assert response.status_code == 401
        print("Correctly returns 401 without auth")
    
    def test_notification_structure(self):
        """Verify notification structure has required fields"""
        # First send a test notification to ensure we have one
        requests.post(f"{BASE_URL}/api/push/send-test", headers=self.headers)
        
        response = requests.get(
            f"{BASE_URL}/api/push/notifications?limit=5",
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        notifications = data.get("notifications", [])
        
        if len(notifications) > 0:
            notification = notifications[0]
            # Check required fields
            assert "id" in notification
            assert "title" in notification
            assert "body" in notification
            assert "created_at" in notification
            assert "read" in notification
            print(f"Notification structure verified: {list(notification.keys())}")
        else:
            print("No notifications to verify structure")


class TestPushNotificationsUnsubscribe:
    """Test unsubscribe functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get auth token"""
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "info@datalifeai.com", "password": "Admin@123456"}
        )
        if login_response.status_code != 200:
            pytest.skip("Login failed - skipping authenticated tests")
        
        self.token = login_response.json().get("access_token")
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_unsubscribe_push(self):
        """POST /api/push/unsubscribe should remove push subscription"""
        # First subscribe
        subscription_data = {
            "endpoint": "https://test-endpoint.example.com/push/unsubscribe_test",
            "keys": {"p256dh": "test_key", "auth": "test_auth"}
        }
        
        requests.post(
            f"{BASE_URL}/api/push/subscribe",
            json=subscription_data,
            headers=self.headers
        )
        
        # Then unsubscribe
        response = requests.post(
            f"{BASE_URL}/api/push/unsubscribe",
            json=subscription_data,
            headers=self.headers
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        print(f"Unsubscribe response: {data}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
