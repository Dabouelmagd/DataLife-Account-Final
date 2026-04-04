"""
Invoice Adjustments (Discounts & Additions) API Tests
Tests for the new Invoice Adjustments feature including:
- Adjustment categories endpoint
- Creating invoices with discounts (percentage and fixed)
- Creating invoices with additions (percentage and fixed)
- Multiple adjustments on single invoice
- Calculated amounts verification
- Grand total calculation with adjustments
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "dalia@datalifeai.com"
TEST_PASSWORD = "Dalia@2024"


class TestInvoiceAdjustments:
    """Invoice Adjustments API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test fixtures - login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        token = login_response.json().get("access_token")
        assert token, "No access token received"
        
        self.session.headers.update({"Authorization": f"Bearer {token}"})
        
        # Get a customer party_id for invoice creation
        parties_response = self.session.get(f"{BASE_URL}/api/invoice/parties?party_type=customer")
        assert parties_response.status_code == 200
        parties = parties_response.json().get("parties", [])
        assert len(parties) > 0, "No customers found for testing"
        self.party_id = parties[0]["id"]
        self.party_name = parties[0]["name"]
    
    # ==========================================
    # Adjustment Categories Tests
    # ==========================================
    
    def test_get_adjustment_categories(self):
        """Test GET /api/invoice/adjustment-categories returns all categories"""
        response = self.session.get(f"{BASE_URL}/api/invoice/adjustment-categories")
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify discounts categories
        assert "discounts" in data
        discount_ids = [d["id"] for d in data["discounts"]]
        assert "contract_discount" in discount_ids
        assert "early_payment" in discount_ids
        assert "volume_discount" in discount_ids
        assert "promotional" in discount_ids
        assert "custom" in discount_ids
        
        # Verify additions categories
        assert "additions" in data
        addition_ids = [a["id"] for a in data["additions"]]
        assert "shipping" in addition_ids
        assert "service_fee" in addition_ids
        assert "table_tax" in addition_ids
        assert "insurance" in addition_ids
        assert "handling" in addition_ids
        assert "custom" in addition_ids
        
        # Verify calculation types
        assert "calculation_types" in data
        calc_ids = [c["id"] for c in data["calculation_types"]]
        assert "percentage" in calc_ids
        assert "fixed" in calc_ids
        
        # Verify base options
        assert "base_options" in data
        base_ids = [b["id"] for b in data["base_options"]]
        assert "before_tax" in base_ids
        assert "after_tax" in base_ids
        
        print("PASSED: Adjustment categories endpoint returns all expected categories")
    
    def test_adjustment_categories_requires_auth(self):
        """Test adjustment categories endpoint requires authentication"""
        # Create new session without auth
        no_auth_session = requests.Session()
        response = no_auth_session.get(f"{BASE_URL}/api/invoice/adjustment-categories")
        
        assert response.status_code == 401
        print("PASSED: Adjustment categories requires authentication")
    
    # ==========================================
    # Discount Adjustment Tests
    # ==========================================
    
    def test_create_invoice_with_percentage_discount_before_tax(self):
        """Test creating invoice with percentage discount applied before tax"""
        invoice_data = {
            "document_type": "sales_invoice",
            "document_date": datetime.now().strftime("%Y-%m-%d"),
            "party_id": self.party_id,
            "currency": "EGP",
            "payment_terms": "cash",
            "lines": [{
                "description": "TEST_Product for Percentage Discount",
                "quantity": 10,
                "unit_price": 100,
                "tax_rate": 14,
                "tax_type": "vat",
                "discount_percent": 0
            }],
            "adjustments": [{
                "adjustment_type": "discount",
                "category": "contract_discount",
                "name": "Contract Discount",
                "calculation_type": "percentage",
                "value": 5,
                "base": "before_tax"
            }],
            "notes": "TEST_Invoice with 5% discount before tax"
        }
        
        response = self.session.post(f"{BASE_URL}/api/invoice/", json=invoice_data)
        
        assert response.status_code == 200
        invoice = response.json().get("invoice")
        
        # Verify calculations
        # Subtotal: 10 * 100 = 1000
        # Tax: 1000 * 14% = 140
        # Discount: 1000 * 5% = 50 (before tax)
        # Grand Total: 1000 + 140 - 50 = 1090
        
        assert invoice["subtotal"] == 1000
        assert invoice["total_tax"] == 140
        assert invoice["total_invoice_discount"] == 50
        assert invoice["grand_total"] == 1090
        
        # Verify adjustment details
        assert len(invoice["adjustments"]) == 1
        adj = invoice["adjustments"][0]
        assert adj["adjustment_type"] == "discount"
        assert adj["category"] == "contract_discount"
        assert adj["calculation_type"] == "percentage"
        assert adj["value"] == 5
        assert adj["base"] == "before_tax"
        assert adj["calculated_amount"] == 50
        
        print(f"PASSED: Invoice {invoice['document_number']} created with 5% discount = 50 EGP, Grand Total = 1090 EGP")
    
    def test_create_invoice_with_fixed_discount(self):
        """Test creating invoice with fixed amount discount"""
        invoice_data = {
            "document_type": "sales_invoice",
            "document_date": datetime.now().strftime("%Y-%m-%d"),
            "party_id": self.party_id,
            "currency": "EGP",
            "payment_terms": "cash",
            "lines": [{
                "description": "TEST_Product for Fixed Discount",
                "quantity": 5,
                "unit_price": 200,
                "tax_rate": 14,
                "tax_type": "vat",
                "discount_percent": 0
            }],
            "adjustments": [{
                "adjustment_type": "discount",
                "category": "early_payment",
                "name": "Early Payment Discount",
                "calculation_type": "fixed",
                "value": 100,
                "base": "before_tax"
            }],
            "notes": "TEST_Invoice with 100 EGP fixed discount"
        }
        
        response = self.session.post(f"{BASE_URL}/api/invoice/", json=invoice_data)
        
        assert response.status_code == 200
        invoice = response.json().get("invoice")
        
        # Verify calculations
        # Subtotal: 5 * 200 = 1000
        # Tax: 1000 * 14% = 140
        # Discount: 100 (fixed)
        # Grand Total: 1000 + 140 - 100 = 1040
        
        assert invoice["subtotal"] == 1000
        assert invoice["total_tax"] == 140
        assert invoice["total_invoice_discount"] == 100
        assert invoice["grand_total"] == 1040
        
        adj = invoice["adjustments"][0]
        assert adj["calculation_type"] == "fixed"
        assert adj["calculated_amount"] == 100
        
        print(f"PASSED: Invoice {invoice['document_number']} created with fixed 100 EGP discount, Grand Total = 1040 EGP")
    
    # ==========================================
    # Addition Adjustment Tests
    # ==========================================
    
    def test_create_invoice_with_fixed_addition(self):
        """Test creating invoice with fixed amount addition (shipping fee)"""
        invoice_data = {
            "document_type": "sales_invoice",
            "document_date": datetime.now().strftime("%Y-%m-%d"),
            "party_id": self.party_id,
            "currency": "EGP",
            "payment_terms": "cash",
            "lines": [{
                "description": "TEST_Product for Fixed Addition",
                "quantity": 10,
                "unit_price": 100,
                "tax_rate": 14,
                "tax_type": "vat",
                "discount_percent": 0
            }],
            "adjustments": [{
                "adjustment_type": "addition",
                "category": "shipping",
                "name": "Shipping Fee",
                "calculation_type": "fixed",
                "value": 75,
                "base": "before_tax"
            }],
            "notes": "TEST_Invoice with 75 EGP shipping fee"
        }
        
        response = self.session.post(f"{BASE_URL}/api/invoice/", json=invoice_data)
        
        assert response.status_code == 200
        invoice = response.json().get("invoice")
        
        # Verify calculations
        # Subtotal: 10 * 100 = 1000
        # Tax: 1000 * 14% = 140
        # Addition: 75 (fixed)
        # Grand Total: 1000 + 140 + 75 = 1215
        
        assert invoice["subtotal"] == 1000
        assert invoice["total_tax"] == 140
        assert invoice["total_invoice_addition"] == 75
        assert invoice["grand_total"] == 1215
        
        adj = invoice["adjustments"][0]
        assert adj["adjustment_type"] == "addition"
        assert adj["category"] == "shipping"
        assert adj["calculated_amount"] == 75
        
        print(f"PASSED: Invoice {invoice['document_number']} created with 75 EGP shipping, Grand Total = 1215 EGP")
    
    def test_create_invoice_with_percentage_addition(self):
        """Test creating invoice with percentage addition (service fee)"""
        invoice_data = {
            "document_type": "sales_invoice",
            "document_date": datetime.now().strftime("%Y-%m-%d"),
            "party_id": self.party_id,
            "currency": "EGP",
            "payment_terms": "cash",
            "lines": [{
                "description": "TEST_Product for Percentage Addition",
                "quantity": 10,
                "unit_price": 100,
                "tax_rate": 14,
                "tax_type": "vat",
                "discount_percent": 0
            }],
            "adjustments": [{
                "adjustment_type": "addition",
                "category": "service_fee",
                "name": "Service Fee",
                "calculation_type": "percentage",
                "value": 10,
                "base": "before_tax"
            }],
            "notes": "TEST_Invoice with 10% service fee"
        }
        
        response = self.session.post(f"{BASE_URL}/api/invoice/", json=invoice_data)
        
        assert response.status_code == 200
        invoice = response.json().get("invoice")
        
        # Verify calculations
        # Subtotal: 10 * 100 = 1000
        # Tax: 1000 * 14% = 140
        # Addition: 1000 * 10% = 100 (before tax)
        # Grand Total: 1000 + 140 + 100 = 1240
        
        assert invoice["subtotal"] == 1000
        assert invoice["total_tax"] == 140
        assert invoice["total_invoice_addition"] == 100
        assert invoice["grand_total"] == 1240
        
        adj = invoice["adjustments"][0]
        assert adj["calculation_type"] == "percentage"
        assert adj["calculated_amount"] == 100
        
        print(f"PASSED: Invoice {invoice['document_number']} created with 10% service fee = 100 EGP, Grand Total = 1240 EGP")
    
    # ==========================================
    # Multiple Adjustments Tests
    # ==========================================
    
    def test_create_invoice_with_multiple_adjustments(self):
        """Test creating invoice with both discount and addition"""
        invoice_data = {
            "document_type": "sales_invoice",
            "document_date": datetime.now().strftime("%Y-%m-%d"),
            "party_id": self.party_id,
            "currency": "EGP",
            "payment_terms": "cash",
            "lines": [{
                "description": "TEST_Product for Multiple Adjustments",
                "quantity": 10,
                "unit_price": 100,
                "tax_rate": 14,
                "tax_type": "vat",
                "discount_percent": 0
            }],
            "adjustments": [
                {
                    "adjustment_type": "discount",
                    "category": "contract_discount",
                    "name": "Contract Discount",
                    "calculation_type": "percentage",
                    "value": 5,
                    "base": "before_tax"
                },
                {
                    "adjustment_type": "addition",
                    "category": "shipping",
                    "name": "Shipping Fee",
                    "calculation_type": "fixed",
                    "value": 50,
                    "base": "before_tax"
                }
            ],
            "notes": "TEST_Invoice with 5% discount and 50 EGP shipping"
        }
        
        response = self.session.post(f"{BASE_URL}/api/invoice/", json=invoice_data)
        
        assert response.status_code == 200
        invoice = response.json().get("invoice")
        
        # Verify calculations
        # Subtotal: 10 * 100 = 1000
        # Tax: 1000 * 14% = 140
        # Discount: 1000 * 5% = 50
        # Addition: 50 (fixed)
        # Grand Total: 1000 + 140 - 50 + 50 = 1140
        
        assert invoice["subtotal"] == 1000
        assert invoice["total_tax"] == 140
        assert invoice["total_invoice_discount"] == 50
        assert invoice["total_invoice_addition"] == 50
        assert invoice["grand_total"] == 1140
        
        assert len(invoice["adjustments"]) == 2
        
        print(f"PASSED: Invoice {invoice['document_number']} created with multiple adjustments, Grand Total = 1140 EGP")
    
    def test_create_invoice_with_multiple_discounts(self):
        """Test creating invoice with multiple discount adjustments"""
        invoice_data = {
            "document_type": "sales_invoice",
            "document_date": datetime.now().strftime("%Y-%m-%d"),
            "party_id": self.party_id,
            "currency": "EGP",
            "payment_terms": "cash",
            "lines": [{
                "description": "TEST_Product for Multiple Discounts",
                "quantity": 10,
                "unit_price": 100,
                "tax_rate": 14,
                "tax_type": "vat",
                "discount_percent": 0
            }],
            "adjustments": [
                {
                    "adjustment_type": "discount",
                    "category": "contract_discount",
                    "name": "Contract Discount",
                    "calculation_type": "percentage",
                    "value": 5,
                    "base": "before_tax"
                },
                {
                    "adjustment_type": "discount",
                    "category": "volume_discount",
                    "name": "Volume Discount",
                    "calculation_type": "fixed",
                    "value": 30,
                    "base": "before_tax"
                }
            ],
            "notes": "TEST_Invoice with 5% + 30 EGP discounts"
        }
        
        response = self.session.post(f"{BASE_URL}/api/invoice/", json=invoice_data)
        
        assert response.status_code == 200
        invoice = response.json().get("invoice")
        
        # Verify calculations
        # Subtotal: 10 * 100 = 1000
        # Tax: 1000 * 14% = 140
        # Discount 1: 1000 * 5% = 50
        # Discount 2: 30 (fixed)
        # Total Discount: 50 + 30 = 80
        # Grand Total: 1000 + 140 - 80 = 1060
        
        assert invoice["subtotal"] == 1000
        assert invoice["total_tax"] == 140
        assert invoice["total_invoice_discount"] == 80
        assert invoice["grand_total"] == 1060
        
        print(f"PASSED: Invoice {invoice['document_number']} created with multiple discounts = 80 EGP, Grand Total = 1060 EGP")
    
    # ==========================================
    # After Tax Calculation Tests
    # ==========================================
    
    def test_create_invoice_with_discount_after_tax(self):
        """Test creating invoice with discount applied after tax"""
        invoice_data = {
            "document_type": "sales_invoice",
            "document_date": datetime.now().strftime("%Y-%m-%d"),
            "party_id": self.party_id,
            "currency": "EGP",
            "payment_terms": "cash",
            "lines": [{
                "description": "TEST_Product for After Tax Discount",
                "quantity": 10,
                "unit_price": 100,
                "tax_rate": 14,
                "tax_type": "vat",
                "discount_percent": 0
            }],
            "adjustments": [{
                "adjustment_type": "discount",
                "category": "promotional",
                "name": "Promotional Discount",
                "calculation_type": "percentage",
                "value": 5,
                "base": "after_tax"
            }],
            "notes": "TEST_Invoice with 5% discount after tax"
        }
        
        response = self.session.post(f"{BASE_URL}/api/invoice/", json=invoice_data)
        
        assert response.status_code == 200
        invoice = response.json().get("invoice")
        
        # Verify calculations
        # Subtotal: 10 * 100 = 1000
        # Tax: 1000 * 14% = 140
        # After Tax Base: 1000 + 140 = 1140
        # Discount: 1140 * 5% = 57
        # Grand Total: 1140 - 57 = 1083
        
        assert invoice["subtotal"] == 1000
        assert invoice["total_tax"] == 140
        assert invoice["total_invoice_discount"] == 57
        assert invoice["grand_total"] == 1083
        
        adj = invoice["adjustments"][0]
        assert adj["base"] == "after_tax"
        assert adj["calculated_amount"] == 57
        
        print(f"PASSED: Invoice {invoice['document_number']} created with 5% after-tax discount = 57 EGP, Grand Total = 1083 EGP")
    
    # ==========================================
    # All Adjustment Categories Tests
    # ==========================================
    
    def test_all_discount_categories(self):
        """Test all discount categories can be used"""
        discount_categories = ["contract_discount", "early_payment", "volume_discount", "promotional", "custom"]
        
        for category in discount_categories:
            invoice_data = {
                "document_type": "sales_invoice",
                "document_date": datetime.now().strftime("%Y-%m-%d"),
                "party_id": self.party_id,
                "currency": "EGP",
                "payment_terms": "cash",
                "lines": [{
                    "description": f"TEST_Product for {category}",
                    "quantity": 1,
                    "unit_price": 100,
                    "tax_rate": 14,
                    "tax_type": "vat",
                    "discount_percent": 0
                }],
                "adjustments": [{
                    "adjustment_type": "discount",
                    "category": category,
                    "name": f"Test {category}",
                    "calculation_type": "fixed",
                    "value": 10,
                    "base": "before_tax"
                }]
            }
            
            response = self.session.post(f"{BASE_URL}/api/invoice/", json=invoice_data)
            assert response.status_code == 200, f"Failed for category: {category}"
            
            invoice = response.json().get("invoice")
            assert invoice["adjustments"][0]["category"] == category
        
        print(f"PASSED: All discount categories work: {discount_categories}")
    
    def test_all_addition_categories(self):
        """Test all addition categories can be used"""
        addition_categories = ["shipping", "service_fee", "table_tax", "insurance", "handling", "custom"]
        
        for category in addition_categories:
            invoice_data = {
                "document_type": "sales_invoice",
                "document_date": datetime.now().strftime("%Y-%m-%d"),
                "party_id": self.party_id,
                "currency": "EGP",
                "payment_terms": "cash",
                "lines": [{
                    "description": f"TEST_Product for {category}",
                    "quantity": 1,
                    "unit_price": 100,
                    "tax_rate": 14,
                    "tax_type": "vat",
                    "discount_percent": 0
                }],
                "adjustments": [{
                    "adjustment_type": "addition",
                    "category": category,
                    "name": f"Test {category}",
                    "calculation_type": "fixed",
                    "value": 10,
                    "base": "before_tax"
                }]
            }
            
            response = self.session.post(f"{BASE_URL}/api/invoice/", json=invoice_data)
            assert response.status_code == 200, f"Failed for category: {category}"
            
            invoice = response.json().get("invoice")
            assert invoice["adjustments"][0]["category"] == category
        
        print(f"PASSED: All addition categories work: {addition_categories}")
    
    # ==========================================
    # Invoice Retrieval with Adjustments
    # ==========================================
    
    def test_get_invoice_with_adjustments(self):
        """Test retrieving invoice includes adjustment details"""
        # First create an invoice with adjustments
        invoice_data = {
            "document_type": "sales_invoice",
            "document_date": datetime.now().strftime("%Y-%m-%d"),
            "party_id": self.party_id,
            "currency": "EGP",
            "payment_terms": "cash",
            "lines": [{
                "description": "TEST_Product for Retrieval Test",
                "quantity": 10,
                "unit_price": 100,
                "tax_rate": 14,
                "tax_type": "vat",
                "discount_percent": 0
            }],
            "adjustments": [{
                "adjustment_type": "discount",
                "category": "contract_discount",
                "name": "Contract Discount",
                "calculation_type": "percentage",
                "value": 5,
                "base": "before_tax"
            }]
        }
        
        create_response = self.session.post(f"{BASE_URL}/api/invoice/", json=invoice_data)
        assert create_response.status_code == 200
        
        invoice_id = create_response.json().get("invoice", {}).get("id")
        
        # Now retrieve the invoice
        get_response = self.session.get(f"{BASE_URL}/api/invoice/{invoice_id}")
        assert get_response.status_code == 200
        
        invoice = get_response.json()
        
        # Verify adjustments are included
        assert "adjustments" in invoice
        assert len(invoice["adjustments"]) == 1
        assert invoice["adjustments"][0]["adjustment_type"] == "discount"
        assert invoice["adjustments"][0]["calculated_amount"] == 50
        
        # Verify totals
        assert invoice["total_invoice_discount"] == 50
        assert invoice["grand_total"] == 1090
        
        print(f"PASSED: Invoice {invoice['document_number']} retrieved with adjustment details")
    
    # ==========================================
    # Invoice without Adjustments
    # ==========================================
    
    def test_create_invoice_without_adjustments(self):
        """Test creating invoice without any adjustments still works"""
        invoice_data = {
            "document_type": "sales_invoice",
            "document_date": datetime.now().strftime("%Y-%m-%d"),
            "party_id": self.party_id,
            "currency": "EGP",
            "payment_terms": "cash",
            "lines": [{
                "description": "TEST_Product No Adjustments",
                "quantity": 10,
                "unit_price": 100,
                "tax_rate": 14,
                "tax_type": "vat",
                "discount_percent": 0
            }],
            "adjustments": []
        }
        
        response = self.session.post(f"{BASE_URL}/api/invoice/", json=invoice_data)
        
        assert response.status_code == 200
        invoice = response.json().get("invoice")
        
        # Verify calculations without adjustments
        assert invoice["subtotal"] == 1000
        assert invoice["total_tax"] == 140
        assert invoice["total_invoice_discount"] == 0
        assert invoice["total_invoice_addition"] == 0
        assert invoice["grand_total"] == 1140
        
        print(f"PASSED: Invoice {invoice['document_number']} created without adjustments, Grand Total = 1140 EGP")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
