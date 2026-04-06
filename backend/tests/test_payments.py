"""
Payment Gateway Tests - Stripe & PayPal Integration
Tests for subscription packages, payment methods, and checkout flows
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPaymentPackages:
    """Tests for subscription packages endpoint"""
    
    def test_get_packages_returns_15_packages(self):
        """GET /api/payments/packages should return 15 subscription packages"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        packages = response.json()
        assert isinstance(packages, list), "Response should be a list"
        assert len(packages) == 15, f"Expected 15 packages, got {len(packages)}"
        
        # Verify package structure
        for pkg in packages:
            assert "id" in pkg, "Package should have id"
            assert "plan" in pkg, "Package should have plan"
            assert "duration" in pkg, "Package should have duration"
            assert "price_egp" in pkg, "Package should have price_egp"
            assert "price_usd" in pkg, "Package should have price_usd"
            assert "name_en" in pkg, "Package should have name_en"
            assert "name_ar" in pkg, "Package should have name_ar"
    
    def test_packages_have_correct_plans(self):
        """Packages should include starter, professional, and enterprise plans"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        
        assert response.status_code == 200
        packages = response.json()
        
        plans = set(pkg["plan"] for pkg in packages)
        assert "starter" in plans, "Should have starter plan"
        assert "professional" in plans, "Should have professional plan"
        assert "enterprise" in plans, "Should have enterprise plan"
    
    def test_packages_have_correct_durations(self):
        """Each plan should have 5 duration options"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        
        assert response.status_code == 200
        packages = response.json()
        
        expected_durations = {"3_months", "6_months", "9_months", "12_months", "lifetime"}
        
        for plan in ["starter", "professional", "enterprise"]:
            plan_packages = [p for p in packages if p["plan"] == plan]
            assert len(plan_packages) == 5, f"{plan} should have 5 duration options"
            
            durations = set(p["duration"] for p in plan_packages)
            assert durations == expected_durations, f"{plan} should have all duration options"


class TestPaymentMethods:
    """Tests for payment methods endpoint"""
    
    def test_get_payment_methods_returns_stripe_and_paypal(self):
        """GET /api/payments/payment-methods should return Stripe and PayPal"""
        response = requests.get(f"{BASE_URL}/api/payments/payment-methods")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "methods" in data, "Response should have methods key"
        
        methods = data["methods"]
        assert isinstance(methods, list), "Methods should be a list"
        assert len(methods) == 2, f"Expected 2 methods, got {len(methods)}"
        
        method_ids = [m["id"] for m in methods]
        assert "stripe" in method_ids, "Should have stripe method"
        assert "paypal" in method_ids, "Should have paypal method"
    
    def test_payment_methods_structure(self):
        """Payment methods should have correct structure"""
        response = requests.get(f"{BASE_URL}/api/payments/payment-methods")
        
        assert response.status_code == 200
        methods = response.json()["methods"]
        
        for method in methods:
            assert "id" in method, "Method should have id"
            assert "name_en" in method, "Method should have name_en"
            assert "name_ar" in method, "Method should have name_ar"
            assert "description_en" in method, "Method should have description_en"
            assert "description_ar" in method, "Method should have description_ar"
            assert "enabled" in method, "Method should have enabled flag"
    
    def test_paypal_has_test_mode_flag(self):
        """PayPal method should have test_mode flag"""
        response = requests.get(f"{BASE_URL}/api/payments/payment-methods")
        
        assert response.status_code == 200
        methods = response.json()["methods"]
        
        paypal = next((m for m in methods if m["id"] == "paypal"), None)
        assert paypal is not None, "PayPal method should exist"
        assert paypal.get("test_mode") == True, "PayPal should be in test mode"


class TestStripeCheckout:
    """Tests for Stripe checkout endpoint"""
    
    def test_create_stripe_checkout_success(self):
        """POST /api/payments/create-checkout should create Stripe checkout session"""
        response = requests.post(
            f"{BASE_URL}/api/payments/create-checkout",
            json={
                "package_id": "starter_3",
                "origin_url": "https://bulk-upload-demo.preview.emergentagent.com",
                "user_email": "test@example.com",
                "company_id": "test_company_123"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "url" in data, "Response should have checkout URL"
        assert "session_id" in data, "Response should have session_id"
        assert "package" in data, "Response should have package info"
        
        # Verify URL is a valid Stripe checkout URL
        assert data["url"].startswith("https://checkout.stripe.com"), f"URL should be Stripe checkout: {data['url']}"
        
        # Verify package info
        assert data["package"]["id"] == "starter_3"
        assert data["package"]["price_usd"] == 11.94
    
    def test_create_stripe_checkout_invalid_package(self):
        """POST /api/payments/create-checkout with invalid package should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/payments/create-checkout",
            json={
                "package_id": "invalid_package",
                "origin_url": "https://example.com"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
    
    def test_create_stripe_checkout_missing_fields(self):
        """POST /api/payments/create-checkout without required fields should return 422"""
        response = requests.post(
            f"{BASE_URL}/api/payments/create-checkout",
            json={}
        )
        
        assert response.status_code == 422, f"Expected 422, got {response.status_code}"


class TestPayPalCheckout:
    """Tests for PayPal checkout endpoint (Test Mode)"""
    
    def test_create_paypal_checkout_success(self):
        """POST /api/payments/paypal/create-checkout should create PayPal order"""
        response = requests.post(
            f"{BASE_URL}/api/payments/paypal/create-checkout",
            json={
                "package_id": "professional_6",
                "origin_url": "https://bulk-upload-demo.preview.emergentagent.com",
                "user_email": "test@example.com",
                "company_id": "test_company_456"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "order_id" in data, "Response should have order_id"
        assert "approval_url" in data, "Response should have approval_url"
        assert "package" in data, "Response should have package info"
        assert "test_mode" in data, "Response should indicate test_mode"
        
        # Verify order_id format
        assert data["order_id"].startswith("PP-"), f"Order ID should start with PP-: {data['order_id']}"
        
        # Verify approval URL points to simulation page
        assert "/payment/paypal-simulate" in data["approval_url"], "Approval URL should point to simulation page"
        
        # Verify package info
        assert data["package"]["id"] == "professional_6"
        assert data["package"]["price_usd"] == 63.92
        
        # Verify test mode
        assert data["test_mode"] == True
    
    def test_create_paypal_checkout_invalid_package(self):
        """POST /api/payments/paypal/create-checkout with invalid package should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/payments/paypal/create-checkout",
            json={
                "package_id": "invalid_package",
                "origin_url": "https://example.com"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"


class TestPayPalCapture:
    """Tests for PayPal payment capture endpoint"""
    
    def test_capture_paypal_payment_success(self):
        """POST /api/payments/paypal/capture/{order_id} should capture payment"""
        # First create a PayPal order
        create_response = requests.post(
            f"{BASE_URL}/api/payments/paypal/create-checkout",
            json={
                "package_id": "enterprise_3",
                "origin_url": "https://bulk-upload-demo.preview.emergentagent.com",
                "user_email": "capture_test@example.com",
                "company_id": "test_company_capture"
            }
        )
        
        assert create_response.status_code == 200
        order_id = create_response.json()["order_id"]
        
        # Now capture the payment
        capture_response = requests.post(f"{BASE_URL}/api/payments/paypal/capture/{order_id}")
        
        assert capture_response.status_code == 200, f"Expected 200, got {capture_response.status_code}: {capture_response.text}"
        
        data = capture_response.json()
        assert data["status"] == "captured", f"Expected captured status, got {data['status']}"
        assert data["order_id"] == order_id
        assert "amount_usd" in data
        assert "amount_egp" in data
    
    def test_capture_paypal_payment_already_captured(self):
        """Capturing already captured payment should return already_captured status"""
        # First create a PayPal order
        create_response = requests.post(
            f"{BASE_URL}/api/payments/paypal/create-checkout",
            json={
                "package_id": "starter_12",
                "origin_url": "https://bulk-upload-demo.preview.emergentagent.com",
                "user_email": "double_capture@example.com"
            }
        )
        
        assert create_response.status_code == 200
        order_id = create_response.json()["order_id"]
        
        # Capture first time
        first_capture = requests.post(f"{BASE_URL}/api/payments/paypal/capture/{order_id}")
        assert first_capture.status_code == 200
        
        # Capture second time
        second_capture = requests.post(f"{BASE_URL}/api/payments/paypal/capture/{order_id}")
        assert second_capture.status_code == 200
        
        data = second_capture.json()
        assert data["status"] == "already_captured", f"Expected already_captured, got {data['status']}"
    
    def test_capture_paypal_payment_not_found(self):
        """Capturing non-existent order should return 404"""
        response = requests.post(f"{BASE_URL}/api/payments/paypal/capture/PP-NONEXISTENT123")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestPaymentTransactions:
    """Tests for payment transactions endpoint"""
    
    def test_get_transactions(self):
        """GET /api/payments/transactions should return transaction list"""
        response = requests.get(f"{BASE_URL}/api/payments/transactions")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
    
    def test_get_transactions_by_company(self):
        """GET /api/payments/transactions?company_id=xxx should filter by company"""
        response = requests.get(f"{BASE_URL}/api/payments/transactions?company_id=test_company_123")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
