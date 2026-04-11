"""
Test Suite for:
1. POST /api/subscriptions/redeem-code - Activation code redemption flow
2. Admin.py refactoring verification - All admin routes should work after refactoring
"""

import pytest
import requests
import os
import secrets
import string

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "info@datalifeai.com"
SUPER_ADMIN_PASSWORD = "Admin@123456"
REGULAR_USER_EMAIL = "dalia@datalifeai.com"
REGULAR_USER_PASSWORD = "Dalia@2024"


class TestSetup:
    """Setup and authentication helpers"""
    
    @staticmethod
    def get_admin_token():
        """Get admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    @staticmethod
    def get_user_token():
        """Get regular user authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": REGULAR_USER_EMAIL,
            "password": REGULAR_USER_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("access_token")
        return None


# ============================================
# Test: Activation Code Redemption Endpoint
# ============================================

class TestActivationCodeRedemption:
    """Tests for POST /api/subscriptions/redeem-code endpoint"""
    
    def test_redeem_code_without_auth_returns_401(self):
        """Test that redeem-code endpoint requires authentication"""
        response = requests.post(f"{BASE_URL}/api/subscriptions/redeem-code", json={
            "code": "TEST-CODE-1234"
        })
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASS: Redeem code without auth returns 401")
    
    def test_redeem_code_with_invalid_code_returns_error(self):
        """Test that invalid activation code returns error"""
        token = TestSetup.get_user_token()
        if not token:
            pytest.skip("Could not get user token")
        
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/redeem-code",
            json={"code": "INVALID-CODE-XXXX"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        print(f"PASS: Invalid code returns 400 with detail: {data.get('detail')}")
    
    def test_redeem_code_with_empty_code_returns_error(self):
        """Test that empty activation code returns error"""
        token = TestSetup.get_user_token()
        if not token:
            pytest.skip("Could not get user token")
        
        response = requests.post(
            f"{BASE_URL}/api/subscriptions/redeem-code",
            json={"code": ""},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("PASS: Empty code returns 400")
    
    def test_generate_and_redeem_activation_code(self):
        """Test full flow: generate code as admin, redeem as user"""
        admin_token = TestSetup.get_admin_token()
        user_token = TestSetup.get_user_token()
        
        if not admin_token:
            pytest.skip("Could not get admin token")
        if not user_token:
            pytest.skip("Could not get user token")
        
        # Step 1: Generate a new activation code as admin
        code_data = {
            "plan": "professional",
            "duration": "12_months",
            "max_uses": 1,
            "notes": "Test code for pytest"
        }
        
        gen_response = requests.post(
            f"{BASE_URL}/api/admin/activation-codes/generate",
            json=code_data,
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        assert gen_response.status_code == 200, f"Failed to generate code: {gen_response.text}"
        gen_data = gen_response.json()
        assert "code" in gen_data, "Response should contain 'code'"
        new_code = gen_data["code"]
        print(f"Generated activation code: {new_code}")
        
        # Step 2: Redeem the code as regular user
        redeem_response = requests.post(
            f"{BASE_URL}/api/subscriptions/redeem-code",
            json={"code": new_code},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        
        assert redeem_response.status_code == 200, f"Failed to redeem code: {redeem_response.text}"
        redeem_data = redeem_response.json()
        
        # Verify response structure
        assert redeem_data.get("success") == True, "Response should have success=True"
        assert redeem_data.get("amount") == 0, f"Amount should be 0 (free gift), got {redeem_data.get('amount')}"
        assert "subscription_id" in redeem_data, "Response should contain subscription_id"
        assert "plan" in redeem_data, "Response should contain plan"
        assert "end_date" in redeem_data, "Response should contain end_date"
        
        print(f"PASS: Code redeemed successfully!")
        print(f"  - Subscription ID: {redeem_data.get('subscription_id')}")
        print(f"  - Plan: {redeem_data.get('plan')}")
        print(f"  - Amount: {redeem_data.get('amount')} (free gift)")
        print(f"  - End Date: {redeem_data.get('end_date')}")
    
    def test_redeem_already_used_code_returns_error(self):
        """Test that already used code returns error"""
        admin_token = TestSetup.get_admin_token()
        user_token = TestSetup.get_user_token()
        
        if not admin_token or not user_token:
            pytest.skip("Could not get tokens")
        
        # Generate a single-use code
        gen_response = requests.post(
            f"{BASE_URL}/api/admin/activation-codes/generate",
            json={"plan": "starter", "duration": "3_months", "max_uses": 1},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        
        if gen_response.status_code != 200:
            pytest.skip("Could not generate code")
        
        code = gen_response.json().get("code")
        
        # First redemption should succeed
        first_redeem = requests.post(
            f"{BASE_URL}/api/subscriptions/redeem-code",
            json={"code": code},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert first_redeem.status_code == 200, "First redemption should succeed"
        
        # Second redemption should fail
        second_redeem = requests.post(
            f"{BASE_URL}/api/subscriptions/redeem-code",
            json={"code": code},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert second_redeem.status_code == 400, f"Second redemption should fail, got {second_redeem.status_code}"
        print("PASS: Already used code returns 400 on second attempt")


# ============================================
# Test: Admin Dashboard (after refactoring)
# ============================================

class TestAdminDashboard:
    """Tests for admin dashboard endpoint after admin.py refactoring"""
    
    def test_admin_dashboard_returns_stats(self):
        """Test GET /api/admin/dashboard returns dashboard statistics"""
        token = TestSetup.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        response = requests.get(
            f"{BASE_URL}/api/admin/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert "statistics" in data, "Response should contain 'statistics'"
        stats = data["statistics"]
        assert "total_companies" in stats, "Stats should contain total_companies"
        assert "total_users" in stats, "Stats should contain total_users"
        assert "active_subscriptions" in stats, "Stats should contain active_subscriptions"
        
        print(f"PASS: Dashboard returns stats")
        print(f"  - Total Companies: {stats.get('total_companies')}")
        print(f"  - Total Users: {stats.get('total_users')}")
        print(f"  - Active Subscriptions: {stats.get('active_subscriptions')}")


# ============================================
# Test: Admin Permissions (21 permissions including hr_admin, hr_financial)
# ============================================

class TestAdminPermissions:
    """Tests for GET /api/admin/permissions endpoint"""
    
    def test_permissions_returns_21_permissions(self):
        """Test that permissions endpoint returns 21 permissions including hr_admin and hr_financial"""
        token = TestSetup.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        response = requests.get(
            f"{BASE_URL}/api/admin/permissions",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        permissions = response.json()
        
        assert isinstance(permissions, list), "Response should be a list"
        assert len(permissions) == 21, f"Expected 21 permissions, got {len(permissions)}"
        
        # Check for hr_admin and hr_financial
        permission_ids = [p.get("id") for p in permissions]
        assert "hr_admin" in permission_ids, "hr_admin should be in permissions"
        assert "hr_financial" in permission_ids, "hr_financial should be in permissions"
        
        # Check that permissions have name_en field
        for perm in permissions:
            assert "name_en" in perm, f"Permission {perm.get('id')} should have name_en field"
        
        print(f"PASS: Permissions endpoint returns {len(permissions)} permissions")
        print(f"  - hr_admin: present")
        print(f"  - hr_financial: present")


# ============================================
# Test: Admin Companies (from admin_companies.py)
# ============================================

class TestAdminCompanies:
    """Tests for admin companies endpoints after refactoring"""
    
    def test_get_all_companies(self):
        """Test GET /api/admin/companies returns companies list"""
        token = TestSetup.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        response = requests.get(
            f"{BASE_URL}/api/admin/companies",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        companies = response.json()
        
        assert isinstance(companies, list), "Response should be a list"
        print(f"PASS: Companies endpoint returns {len(companies)} companies")


# ============================================
# Test: Admin Users (from admin_users.py)
# ============================================

class TestAdminUsers:
    """Tests for admin users endpoints after refactoring"""
    
    def test_get_all_users(self):
        """Test GET /api/admin/all-users returns users list"""
        token = TestSetup.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        response = requests.get(
            f"{BASE_URL}/api/admin/all-users",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        users = response.json()
        
        assert isinstance(users, list), "Response should be a list"
        print(f"PASS: All-users endpoint returns {len(users)} users")
    
    def test_get_roles(self):
        """Test GET /api/admin/roles returns roles list"""
        token = TestSetup.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        response = requests.get(
            f"{BASE_URL}/api/admin/roles",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        roles = response.json()
        
        assert isinstance(roles, list), "Response should be a list"
        assert len(roles) > 0, "Should have at least one role"
        print(f"PASS: Roles endpoint returns {len(roles)} roles")


# ============================================
# Test: Admin Subscriptions (from admin_subscriptions.py)
# ============================================

class TestAdminSubscriptions:
    """Tests for admin subscriptions endpoints after refactoring"""
    
    def test_get_all_subscriptions(self):
        """Test GET /api/admin/subscriptions returns subscriptions"""
        token = TestSetup.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        response = requests.get(
            f"{BASE_URL}/api/admin/subscriptions",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        subscriptions = response.json()
        
        assert isinstance(subscriptions, list), "Response should be a list"
        print(f"PASS: Subscriptions endpoint returns {len(subscriptions)} subscriptions")
    
    def test_get_activation_codes(self):
        """Test GET /api/admin/activation-codes returns codes"""
        token = TestSetup.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        response = requests.get(
            f"{BASE_URL}/api/admin/activation-codes",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        codes = response.json()
        
        assert isinstance(codes, list), "Response should be a list"
        print(f"PASS: Activation-codes endpoint returns {len(codes)} codes")


# ============================================
# Test: Admin Payments (from admin_payments.py)
# ============================================

class TestAdminPayments:
    """Tests for admin payments endpoints after refactoring"""
    
    def test_get_payment_methods_returns_8_methods(self):
        """Test GET /api/admin/payments/methods returns 8 payment methods"""
        response = requests.get(f"{BASE_URL}/api/admin/payments/methods")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        methods = response.json()
        
        assert isinstance(methods, list), "Response should be a list"
        assert len(methods) == 8, f"Expected 8 payment methods, got {len(methods)}"
        
        # Check for activation_code method
        method_ids = [m.get("id") for m in methods]
        assert "activation_code" in method_ids, "activation_code should be in payment methods"
        
        print(f"PASS: Payment methods endpoint returns {len(methods)} methods")
        print(f"  - activation_code: present")
    
    def test_update_payment_with_activation_code_sets_amount_zero(self):
        """Test PUT /api/admin/payments/subscriptions/{id}/payment with activation_code sets amount=0"""
        token = TestSetup.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        # First get a subscription to update
        subs_response = requests.get(
            f"{BASE_URL}/api/admin/subscriptions",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if subs_response.status_code != 200:
            pytest.skip("Could not get subscriptions")
        
        subscriptions = subs_response.json()
        if not subscriptions:
            pytest.skip("No subscriptions to test with")
        
        sub_id = subscriptions[0].get("id")
        
        # Update payment with activation_code method
        update_response = requests.put(
            f"{BASE_URL}/api/admin/payments/subscriptions/{sub_id}/payment",
            json={
                "is_paid": True,
                "payment_method": "activation_code",
                "amount": 999  # This should be overridden to 0
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert update_response.status_code == 200, f"Expected 200, got {update_response.status_code}"
        
        # Verify the payment was recorded with amount=0
        payments_response = requests.get(
            f"{BASE_URL}/api/admin/payments/subscriptions",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if payments_response.status_code == 200:
            data = payments_response.json()
            subs = data.get("subscriptions", [])
            updated_sub = next((s for s in subs if s.get("id") == sub_id), None)
            if updated_sub:
                assert updated_sub.get("payment_method") == "activation_code"
                assert updated_sub.get("payment_amount") == 0, f"Amount should be 0, got {updated_sub.get('payment_amount')}"
                print(f"PASS: Payment with activation_code sets amount=0")


# ============================================
# Test: Admin Transactions (from admin.py)
# ============================================

class TestAdminTransactions:
    """Tests for admin transactions endpoint"""
    
    def test_get_transactions(self):
        """Test GET /api/admin/transactions returns transactions"""
        token = TestSetup.get_admin_token()
        if not token:
            pytest.skip("Could not get admin token")
        
        response = requests.get(
            f"{BASE_URL}/api/admin/transactions",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        transactions = response.json()
        
        assert isinstance(transactions, list), "Response should be a list"
        print(f"PASS: Transactions endpoint returns {len(transactions)} transactions")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
