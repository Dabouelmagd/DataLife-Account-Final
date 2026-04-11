"""
Test Admin Payments and Permissions API
Tests for:
1. GET /api/admin/permissions - should include hr_admin and hr_financial
2. PUT /api/admin/users/{user_id}/permissions - should accept hr_admin and hr_financial
3. GET /api/admin/payments/methods - should return activation_code method
4. PUT /api/admin/payments/subscriptions/{subscription_id}/payment - activation_code should set amount=0
5. PUT /api/admin/payments/subscriptions/{subscription_id}/payment - regular method should calculate amount normally
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials from review request
SUPER_ADMIN_EMAIL = "info@datalifeai.com"
SUPER_ADMIN_PASSWORD = "Admin@123456"


class TestAdminPermissions:
    """Test admin permissions API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            # Note: response uses access_token, not token
            self.token = data.get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
    
    def test_get_permissions_includes_hr_admin(self):
        """GET /api/admin/permissions should include hr_admin with Arabic label"""
        response = self.session.get(f"{BASE_URL}/api/admin/permissions")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        permissions = response.json()
        assert isinstance(permissions, list), "Permissions should be a list"
        
        # Find hr_admin permission
        hr_admin = next((p for p in permissions if p.get('id') == 'hr_admin'), None)
        assert hr_admin is not None, "hr_admin permission should exist in the list"
        assert hr_admin.get('name_en') == 'HR Administration', f"hr_admin name_en should be 'HR Administration', got {hr_admin.get('name_en')}"
        assert hr_admin.get('name_ar') == 'إدارة الموارد البشرية', f"hr_admin name_ar should be 'إدارة الموارد البشرية', got {hr_admin.get('name_ar')}"
        
        print(f"✅ hr_admin permission found: {hr_admin}")
    
    def test_get_permissions_includes_hr_financial(self):
        """GET /api/admin/permissions should include hr_financial with Arabic label"""
        response = self.session.get(f"{BASE_URL}/api/admin/permissions")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        permissions = response.json()
        
        # Find hr_financial permission
        hr_financial = next((p for p in permissions if p.get('id') == 'hr_financial'), None)
        assert hr_financial is not None, "hr_financial permission should exist in the list"
        assert hr_financial.get('name_en') == 'HR Financial', f"hr_financial name_en should be 'HR Financial', got {hr_financial.get('name_en')}"
        assert hr_financial.get('name_ar') == 'مالية الموارد البشرية', f"hr_financial name_ar should be 'مالية الموارد البشرية', got {hr_financial.get('name_ar')}"
        
        print(f"✅ hr_financial permission found: {hr_financial}")
    
    def test_update_user_permissions_accepts_hr_admin(self):
        """PUT /api/admin/users/{user_id}/permissions should accept hr_admin"""
        # First get all users to find a test user
        users_response = self.session.get(f"{BASE_URL}/api/admin/all-users")
        assert users_response.status_code == 200, f"Failed to get users: {users_response.text}"
        
        users = users_response.json()
        # Find a non-super-admin user to test with
        test_user = next((u for u in users if u.get('role') not in ['Super Admin', 'مدير النظام']), None)
        
        if not test_user:
            pytest.skip("No non-super-admin user found for testing")
        
        user_id = test_user.get('id')
        original_permissions = test_user.get('permissions', [])
        
        # Update permissions to include hr_admin
        new_permissions = ['dashboard', 'hr', 'hr_admin']
        response = self.session.put(
            f"{BASE_URL}/api/admin/users/{user_id}/permissions",
            json={"permissions": new_permissions}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get('permissions') == new_permissions, f"Permissions should be updated to {new_permissions}"
        
        print(f"✅ Successfully updated user {user_id} with hr_admin permission")
        
        # Restore original permissions
        self.session.put(
            f"{BASE_URL}/api/admin/users/{user_id}/permissions",
            json={"permissions": original_permissions}
        )
    
    def test_update_user_permissions_accepts_hr_financial(self):
        """PUT /api/admin/users/{user_id}/permissions should accept hr_financial"""
        # First get all users to find a test user
        users_response = self.session.get(f"{BASE_URL}/api/admin/all-users")
        assert users_response.status_code == 200, f"Failed to get users: {users_response.text}"
        
        users = users_response.json()
        # Find a non-super-admin user to test with
        test_user = next((u for u in users if u.get('role') not in ['Super Admin', 'مدير النظام']), None)
        
        if not test_user:
            pytest.skip("No non-super-admin user found for testing")
        
        user_id = test_user.get('id')
        original_permissions = test_user.get('permissions', [])
        
        # Update permissions to include hr_financial
        new_permissions = ['dashboard', 'hr', 'hr_financial']
        response = self.session.put(
            f"{BASE_URL}/api/admin/users/{user_id}/permissions",
            json={"permissions": new_permissions}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get('permissions') == new_permissions, f"Permissions should be updated to {new_permissions}"
        
        print(f"✅ Successfully updated user {user_id} with hr_financial permission")
        
        # Restore original permissions
        self.session.put(
            f"{BASE_URL}/api/admin/users/{user_id}/permissions",
            json={"permissions": original_permissions}
        )


class TestPaymentMethods:
    """Test payment methods API"""
    
    def test_get_payment_methods_includes_activation_code(self):
        """GET /api/admin/payments/methods should return activation_code method"""
        response = requests.get(f"{BASE_URL}/api/admin/payments/methods")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        methods = response.json()
        assert isinstance(methods, list), "Payment methods should be a list"
        
        # Find activation_code method
        activation_code = next((m for m in methods if m.get('id') == 'activation_code'), None)
        assert activation_code is not None, "activation_code method should exist in the list"
        assert activation_code.get('name') == 'Activation Code', f"activation_code name should be 'Activation Code', got {activation_code.get('name')}"
        assert activation_code.get('name_ar') == 'كود تفعيل', f"activation_code name_ar should be 'كود تفعيل', got {activation_code.get('name_ar')}"
        
        print(f"✅ activation_code payment method found: {activation_code}")


class TestPaymentStatusUpdate:
    """Test payment status update API"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        else:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
    
    def test_activation_code_payment_sets_amount_to_zero(self):
        """PUT /api/admin/payments/subscriptions/{id}/payment with activation_code should set amount=0"""
        # First get subscriptions to find one to test
        subs_response = self.session.get(f"{BASE_URL}/api/admin/payments/subscriptions")
        
        if subs_response.status_code != 200:
            pytest.skip(f"Failed to get subscriptions: {subs_response.text}")
        
        data = subs_response.json()
        subscriptions = data.get('subscriptions', [])
        
        if not subscriptions:
            pytest.skip("No subscriptions found for testing")
        
        test_sub = subscriptions[0]
        subscription_id = test_sub.get('id')
        original_payment_method = test_sub.get('payment_method')
        original_amount = test_sub.get('payment_amount')
        
        # Update payment with activation_code method
        response = self.session.put(
            f"{BASE_URL}/api/admin/payments/subscriptions/{subscription_id}/payment",
            json={
                "is_paid": True,
                "payment_method": "activation_code",
                "amount": 999  # This should be overridden to 0
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify the amount was set to 0 by fetching the subscription again
        verify_response = self.session.get(f"{BASE_URL}/api/admin/payments/subscriptions")
        assert verify_response.status_code == 200
        
        verify_data = verify_response.json()
        updated_sub = next((s for s in verify_data.get('subscriptions', []) if s.get('id') == subscription_id), None)
        
        if updated_sub:
            assert updated_sub.get('payment_amount') == 0, f"Amount should be 0 for activation_code, got {updated_sub.get('payment_amount')}"
            print(f"✅ activation_code payment correctly set amount to 0")
        
        # Restore original payment method if needed
        if original_payment_method and original_payment_method != 'activation_code':
            self.session.put(
                f"{BASE_URL}/api/admin/payments/subscriptions/{subscription_id}/payment",
                json={
                    "is_paid": test_sub.get('is_paid', False),
                    "payment_method": original_payment_method,
                    "amount": original_amount
                }
            )
    
    def test_regular_payment_method_calculates_amount_normally(self):
        """PUT /api/admin/payments/subscriptions/{id}/payment with cash should use provided amount"""
        # First get subscriptions to find one to test
        subs_response = self.session.get(f"{BASE_URL}/api/admin/payments/subscriptions")
        
        if subs_response.status_code != 200:
            pytest.skip(f"Failed to get subscriptions: {subs_response.text}")
        
        data = subs_response.json()
        subscriptions = data.get('subscriptions', [])
        
        if not subscriptions:
            pytest.skip("No subscriptions found for testing")
        
        test_sub = subscriptions[0]
        subscription_id = test_sub.get('id')
        original_payment_method = test_sub.get('payment_method')
        original_amount = test_sub.get('payment_amount')
        original_is_paid = test_sub.get('is_paid')
        
        test_amount = 500
        
        # Update payment with cash method and specific amount
        response = self.session.put(
            f"{BASE_URL}/api/admin/payments/subscriptions/{subscription_id}/payment",
            json={
                "is_paid": True,
                "payment_method": "cash",
                "amount": test_amount
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify the amount was set correctly
        verify_response = self.session.get(f"{BASE_URL}/api/admin/payments/subscriptions")
        assert verify_response.status_code == 200
        
        verify_data = verify_response.json()
        updated_sub = next((s for s in verify_data.get('subscriptions', []) if s.get('id') == subscription_id), None)
        
        if updated_sub:
            assert updated_sub.get('payment_amount') == test_amount, f"Amount should be {test_amount} for cash, got {updated_sub.get('payment_amount')}"
            print(f"✅ cash payment correctly set amount to {test_amount}")
        
        # Restore original values
        self.session.put(
            f"{BASE_URL}/api/admin/payments/subscriptions/{subscription_id}/payment",
            json={
                "is_paid": original_is_paid if original_is_paid is not None else False,
                "payment_method": original_payment_method,
                "amount": original_amount
            }
        )


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
