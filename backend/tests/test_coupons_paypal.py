"""
Test suite for Coupon Management and PayPal Sandbox Integration
Features tested:
- Coupon CRUD operations (create, list, get, update, delete)
- Coupon validation with package_id and amount
- Coupon discount calculation (percentage and fixed)
- Seed default coupons
- PayPal Sandbox checkout creation
- Stripe checkout with coupon support
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test coupon data
TEST_COUPON_PERCENTAGE = {
    "code": "TEST_PERCENT20",
    "name_ar": "خصم 20% للاختبار",
    "name_en": "Test 20% Off",
    "discount_type": "percentage",
    "discount_value": 20,
    "min_amount": 10,
    "max_discount": 50,
    "expiry_date": "2026-12-31T23:59:59Z",
    "usage_limit": 100,
    "is_active": True
}

TEST_COUPON_FIXED = {
    "code": "TEST_FIXED15",
    "name_ar": "خصم 15 دولار للاختبار",
    "name_en": "Test $15 Off",
    "discount_type": "fixed",
    "discount_value": 15,
    "min_amount": 50,
    "expiry_date": "2026-12-31T23:59:59Z",
    "usage_limit": 50,
    "is_active": True
}


class TestCouponSeedDefaults:
    """Test seeding default coupons"""
    
    def test_seed_default_coupons(self):
        """POST /api/coupons/seed-defaults - Seed default test coupons"""
        response = requests.post(f"{BASE_URL}/api/coupons/seed-defaults")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "total_defaults" in data
        assert data["total_defaults"] == 4  # WELCOME10, SAVE20, FLAT25, ENTERPRISE50
        print(f"✓ Seeded default coupons: {data['message']}")


class TestCouponCRUD:
    """Test Coupon CRUD operations"""
    
    def test_create_percentage_coupon(self):
        """POST /api/coupons/create - Create percentage discount coupon"""
        # First delete if exists
        requests.delete(f"{BASE_URL}/api/coupons/{TEST_COUPON_PERCENTAGE['code']}")
        
        response = requests.post(f"{BASE_URL}/api/coupons/create", json=TEST_COUPON_PERCENTAGE)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "coupon" in data
        coupon = data["coupon"]
        assert coupon["code"] == TEST_COUPON_PERCENTAGE["code"]
        assert coupon["discount_type"] == "percentage"
        assert coupon["discount_value"] == 20
        assert coupon["min_amount"] == 10
        assert coupon["max_discount"] == 50
        print(f"✓ Created percentage coupon: {coupon['code']}")
    
    def test_create_fixed_coupon(self):
        """POST /api/coupons/create - Create fixed discount coupon"""
        # First delete if exists
        requests.delete(f"{BASE_URL}/api/coupons/{TEST_COUPON_FIXED['code']}")
        
        response = requests.post(f"{BASE_URL}/api/coupons/create", json=TEST_COUPON_FIXED)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "coupon" in data
        coupon = data["coupon"]
        assert coupon["code"] == TEST_COUPON_FIXED["code"]
        assert coupon["discount_type"] == "fixed"
        assert coupon["discount_value"] == 15
        print(f"✓ Created fixed coupon: {coupon['code']}")
    
    def test_create_duplicate_coupon_fails(self):
        """POST /api/coupons/create - Duplicate code should fail"""
        response = requests.post(f"{BASE_URL}/api/coupons/create", json=TEST_COUPON_PERCENTAGE)
        assert response.status_code == 400, f"Expected 400 for duplicate, got {response.status_code}"
        print("✓ Duplicate coupon creation correctly rejected")
    
    def test_list_coupons(self):
        """GET /api/coupons/list - List all active coupons"""
        response = requests.get(f"{BASE_URL}/api/coupons/list")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "coupons" in data
        assert "total" in data
        assert data["total"] >= 4  # At least the 4 default coupons
        
        # Check default coupons exist
        codes = [c["code"] for c in data["coupons"]]
        assert "WELCOME10" in codes, "WELCOME10 should be in list"
        assert "SAVE20" in codes, "SAVE20 should be in list"
        print(f"✓ Listed {data['total']} coupons")
    
    def test_get_coupon_by_code(self):
        """GET /api/coupons/{code} - Get coupon details"""
        response = requests.get(f"{BASE_URL}/api/coupons/WELCOME10")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        coupon = response.json()
        assert coupon["code"] == "WELCOME10"
        assert coupon["discount_type"] == "percentage"
        assert coupon["discount_value"] == 10
        print(f"✓ Got coupon details: {coupon['code']}")
    
    def test_get_nonexistent_coupon(self):
        """GET /api/coupons/{code} - Non-existent coupon returns 404"""
        response = requests.get(f"{BASE_URL}/api/coupons/NONEXISTENT123")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent coupon correctly returns 404")
    
    def test_update_coupon(self):
        """PUT /api/coupons/{code} - Update coupon"""
        update_data = {
            "name_en": "Updated Test 20% Off",
            "max_discount": 75
        }
        response = requests.put(f"{BASE_URL}/api/coupons/{TEST_COUPON_PERCENTAGE['code']}", json=update_data)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["coupon"]["name_en"] == "Updated Test 20% Off"
        assert data["coupon"]["max_discount"] == 75
        print(f"✓ Updated coupon: {data['coupon']['code']}")


class TestCouponValidation:
    """Test coupon validation logic"""
    
    def test_validate_percentage_coupon(self):
        """POST /api/coupons/validate - Validate percentage coupon"""
        response = requests.post(f"{BASE_URL}/api/coupons/validate", json={
            "code": "WELCOME10",
            "package_id": "starter_3",
            "amount_usd": 100
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["valid"] == True
        assert data["original_amount"] == 100
        assert data["discount_amount"] == 10  # 10% of 100
        assert data["final_amount"] == 90
        print(f"✓ Validated percentage coupon: discount=${data['discount_amount']}")
    
    def test_validate_fixed_coupon(self):
        """POST /api/coupons/validate - Validate fixed coupon"""
        response = requests.post(f"{BASE_URL}/api/coupons/validate", json={
            "code": "FLAT25",
            "package_id": "professional_6",
            "amount_usd": 150
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["valid"] == True
        assert data["discount_amount"] == 25  # Fixed $25 off
        assert data["final_amount"] == 125
        print(f"✓ Validated fixed coupon: discount=${data['discount_amount']}")
    
    def test_validate_coupon_min_amount_check(self):
        """POST /api/coupons/validate - Min amount validation"""
        # FLAT25 requires min $100
        response = requests.post(f"{BASE_URL}/api/coupons/validate", json={
            "code": "FLAT25",
            "package_id": "starter_3",
            "amount_usd": 50  # Below min amount
        })
        assert response.status_code == 400, f"Expected 400 for min amount, got {response.status_code}"
        
        detail = response.json().get("detail", {})
        assert detail.get("error") == "min_amount"
        print("✓ Min amount validation working correctly")
    
    def test_validate_coupon_max_discount_cap(self):
        """POST /api/coupons/validate - Max discount cap for percentage"""
        # WELCOME10 has max_discount of $50
        response = requests.post(f"{BASE_URL}/api/coupons/validate", json={
            "code": "WELCOME10",
            "package_id": "enterprise_lifetime",
            "amount_usd": 1000  # 10% would be $100, but capped at $50
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["discount_amount"] == 50  # Capped at max_discount
        assert data["final_amount"] == 950
        print(f"✓ Max discount cap working: capped at ${data['discount_amount']}")
    
    def test_validate_invalid_coupon_code(self):
        """POST /api/coupons/validate - Invalid code returns 404"""
        response = requests.post(f"{BASE_URL}/api/coupons/validate", json={
            "code": "INVALID_CODE_XYZ",
            "package_id": "starter_3",
            "amount_usd": 100
        })
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        
        detail = response.json().get("detail", {})
        assert detail.get("error") == "invalid_code"
        print("✓ Invalid coupon code correctly returns 404")
    
    def test_validate_enterprise_only_coupon(self):
        """POST /api/coupons/validate - Plan-specific coupon validation"""
        # ENTERPRISE50 is only for enterprise plans
        response = requests.post(f"{BASE_URL}/api/coupons/validate", json={
            "code": "ENTERPRISE50",
            "package_id": "starter_3",  # Not an enterprise plan
            "amount_usd": 200
        })
        assert response.status_code == 400, f"Expected 400 for non-applicable plan, got {response.status_code}"
        
        detail = response.json().get("detail", {})
        assert detail.get("error") == "not_applicable"
        print("✓ Plan-specific coupon validation working")
    
    def test_validate_enterprise_coupon_on_enterprise_plan(self):
        """POST /api/coupons/validate - Enterprise coupon on enterprise plan"""
        response = requests.post(f"{BASE_URL}/api/coupons/validate", json={
            "code": "ENTERPRISE50",
            "package_id": "enterprise_6",
            "amount_usd": 200
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["valid"] == True
        assert data["discount_amount"] == 100  # 50% of 200
        print(f"✓ Enterprise coupon valid on enterprise plan: discount=${data['discount_amount']}")


class TestPayPalSandboxCheckout:
    """Test PayPal Sandbox checkout creation"""
    
    def test_paypal_create_checkout(self):
        """POST /api/payments/paypal/create-checkout - Create PayPal Sandbox payment"""
        response = requests.post(f"{BASE_URL}/api/payments/paypal/create-checkout", json={
            "package_id": "professional_3",
            "origin_url": "https://bulk-upload-demo.preview.emergentagent.com",
            "user_email": "test@example.com"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "order_id" in data
        assert "approval_url" in data
        assert "package" in data
        assert data["sandbox_mode"] == True
        
        # Verify approval URL is real PayPal sandbox
        assert "paypal.com" in data["approval_url"] or "sandbox" in data["approval_url"].lower()
        print(f"✓ PayPal Sandbox checkout created: order_id={data['order_id']}")
        print(f"  Approval URL: {data['approval_url'][:80]}...")
    
    def test_paypal_checkout_with_coupon(self):
        """POST /api/payments/paypal/create-checkout - PayPal with coupon discount"""
        response = requests.post(f"{BASE_URL}/api/payments/paypal/create-checkout", json={
            "package_id": "professional_6",
            "origin_url": "https://bulk-upload-demo.preview.emergentagent.com",
            "user_email": "test@example.com",
            "coupon_code": "WELCOME10"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["coupon_applied"] == "WELCOME10"
        assert data["package"]["discount_amount"] > 0
        assert data["package"]["price_usd"] < data["package"]["original_price_usd"]
        print(f"✓ PayPal checkout with coupon: original=${data['package']['original_price_usd']}, final=${data['package']['price_usd']}")
    
    def test_paypal_checkout_invalid_package(self):
        """POST /api/payments/paypal/create-checkout - Invalid package returns 400"""
        response = requests.post(f"{BASE_URL}/api/payments/paypal/create-checkout", json={
            "package_id": "invalid_package_xyz",
            "origin_url": "https://example.com"
        })
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("✓ Invalid package correctly rejected")


class TestStripeCheckoutWithCoupon:
    """Test Stripe checkout with coupon support"""
    
    def test_stripe_checkout_with_coupon(self):
        """POST /api/payments/create-checkout - Stripe with coupon discount"""
        # Use professional_6 ($63.92) which meets SAVE20's min amount of $50
        response = requests.post(f"{BASE_URL}/api/payments/create-checkout", json={
            "package_id": "professional_6",
            "origin_url": "https://bulk-upload-demo.preview.emergentagent.com",
            "user_email": "test@example.com",
            "coupon_code": "SAVE20"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "url" in data
        assert "session_id" in data
        assert data["coupon_applied"] == "SAVE20"
        assert data["package"]["discount_amount"] > 0
        
        # Verify Stripe URL
        assert "stripe.com" in data["url"]
        print(f"✓ Stripe checkout with coupon: discount=${data['package']['discount_amount']}")
    
    def test_stripe_checkout_without_coupon(self):
        """POST /api/payments/create-checkout - Stripe without coupon"""
        response = requests.post(f"{BASE_URL}/api/payments/create-checkout", json={
            "package_id": "starter_3",
            "origin_url": "https://bulk-upload-demo.preview.emergentagent.com"
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["coupon_applied"] is None
        assert data["package"]["discount_amount"] == 0
        print(f"✓ Stripe checkout without coupon: price=${data['package']['price_usd']}")


class TestCouponDelete:
    """Test coupon deletion (cleanup)"""
    
    def test_delete_test_coupons(self):
        """DELETE /api/coupons/{code} - Delete test coupons"""
        # Delete percentage test coupon
        response = requests.delete(f"{BASE_URL}/api/coupons/{TEST_COUPON_PERCENTAGE['code']}")
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        
        # Delete fixed test coupon
        response = requests.delete(f"{BASE_URL}/api/coupons/{TEST_COUPON_FIXED['code']}")
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        
        print("✓ Test coupons cleaned up")
    
    def test_delete_nonexistent_coupon(self):
        """DELETE /api/coupons/{code} - Non-existent coupon returns 404"""
        response = requests.delete(f"{BASE_URL}/api/coupons/NONEXISTENT_XYZ")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Delete non-existent coupon correctly returns 404")


class TestPaymentMethods:
    """Test payment methods endpoint"""
    
    def test_get_payment_methods(self):
        """GET /api/payments/payment-methods - Check PayPal sandbox mode"""
        response = requests.get(f"{BASE_URL}/api/payments/payment-methods")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "methods" in data
        
        # Find PayPal method
        paypal = next((m for m in data["methods"] if m["id"] == "paypal"), None)
        assert paypal is not None, "PayPal method should exist"
        assert paypal.get("sandbox_mode") == True, "PayPal should be in sandbox mode"
        print(f"✓ PayPal sandbox_mode={paypal.get('sandbox_mode')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
