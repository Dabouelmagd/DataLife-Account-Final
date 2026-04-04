"""
Test Currency Management APIs
Tests for:
- GET /api/invoice/config/currencies - Get currencies list
- PUT /api/invoice/config/currencies/settings - Update currency settings (enable/disable, set base)
- POST /api/invoice/config/exchange-rates - Add exchange rate
- GET /api/invoice/config/exchange-rates - Get exchange rates
- DELETE /api/invoice/config/exchange-rates/{rate_id} - Delete exchange rate
- GET /api/invoice/config/convert - Currency converter
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "dalia@datalifeai.com"
TEST_PASSWORD = "Dalia@2024"


class TestCurrencyAPIs:
    """Currency Management API Tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
            print(f"Login successful, token obtained")
        else:
            pytest.skip(f"Login failed: {login_response.status_code}")
    
    # ==========================================
    # GET /api/invoice/config/currencies
    # ==========================================
    
    def test_get_currencies_success(self):
        """Test getting currencies list"""
        response = self.session.get(f"{BASE_URL}/api/invoice/config/currencies")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "currencies" in data, "Response should contain 'currencies' key"
        assert "base_currency" in data, "Response should contain 'base_currency' key"
        assert "enabled_currencies" in data, "Response should contain 'enabled_currencies' key"
        
        # Verify currencies structure
        currencies = data["currencies"]
        assert len(currencies) > 0, "Should have at least one currency"
        
        # Check currency structure
        first_currency = currencies[0]
        assert "code" in first_currency, "Currency should have 'code'"
        assert "name_en" in first_currency, "Currency should have 'name_en'"
        assert "name_ar" in first_currency, "Currency should have 'name_ar'"
        assert "symbol" in first_currency, "Currency should have 'symbol'"
        
        print(f"Found {len(currencies)} currencies")
        print(f"Base currency: {data['base_currency']}")
        print(f"Enabled currencies: {data['enabled_currencies']}")
    
    def test_get_currencies_without_auth(self):
        """Test getting currencies without authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/invoice/config/currencies")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
    
    # ==========================================
    # PUT /api/invoice/config/currencies/settings
    # ==========================================
    
    def test_update_enabled_currencies(self):
        """Test enabling/disabling currencies"""
        # First get current settings
        get_response = self.session.get(f"{BASE_URL}/api/invoice/config/currencies")
        assert get_response.status_code == 200
        original_enabled = get_response.json()["enabled_currencies"]
        
        # Update enabled currencies
        new_enabled = ["EGP", "USD", "EUR"]
        response = self.session.put(
            f"{BASE_URL}/api/invoice/config/currencies/settings",
            json={"enabled_currencies": new_enabled}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify the change
        verify_response = self.session.get(f"{BASE_URL}/api/invoice/config/currencies")
        assert verify_response.status_code == 200
        updated_enabled = verify_response.json()["enabled_currencies"]
        
        assert set(updated_enabled) == set(new_enabled), f"Expected {new_enabled}, got {updated_enabled}"
        print(f"Successfully updated enabled currencies to: {updated_enabled}")
        
        # Restore original settings
        self.session.put(
            f"{BASE_URL}/api/invoice/config/currencies/settings",
            json={"enabled_currencies": original_enabled}
        )
    
    def test_set_base_currency(self):
        """Test setting base currency"""
        # First get current settings
        get_response = self.session.get(f"{BASE_URL}/api/invoice/config/currencies")
        assert get_response.status_code == 200
        original_base = get_response.json()["base_currency"]
        original_enabled = get_response.json()["enabled_currencies"]
        
        # Set new base currency (USD)
        response = self.session.put(
            f"{BASE_URL}/api/invoice/config/currencies/settings",
            json={"base_currency": "USD", "enabled_currencies": ["EGP", "USD", "EUR"]}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify the change
        verify_response = self.session.get(f"{BASE_URL}/api/invoice/config/currencies")
        assert verify_response.status_code == 200
        updated_base = verify_response.json()["base_currency"]
        
        assert updated_base == "USD", f"Expected USD, got {updated_base}"
        print(f"Successfully set base currency to: {updated_base}")
        
        # Restore original settings
        self.session.put(
            f"{BASE_URL}/api/invoice/config/currencies/settings",
            json={"base_currency": original_base, "enabled_currencies": original_enabled}
        )
    
    def test_update_currency_settings_invalid_currency(self):
        """Test updating with invalid currency code"""
        response = self.session.put(
            f"{BASE_URL}/api/invoice/config/currencies/settings",
            json={"base_currency": "INVALID"}
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Correctly rejected invalid currency code")
    
    # ==========================================
    # POST /api/invoice/config/exchange-rates
    # ==========================================
    
    def test_add_exchange_rate(self):
        """Test adding a new exchange rate"""
        response = self.session.post(
            f"{BASE_URL}/api/invoice/config/exchange-rates",
            json={
                "to_currency": "USD",
                "rate": 0.0204,
                "effective_date": "2026-04-04"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "rate" in data, "Response should contain 'rate'"
        
        rate_data = data["rate"]
        assert rate_data["to_currency"] == "USD", "Currency should be USD"
        assert rate_data["rate"] == 0.0204, "Rate should be 0.0204"
        
        print(f"Successfully added exchange rate: 1 EGP = 0.0204 USD")
        
        # Store rate_id for cleanup
        self.created_rate_id = rate_data.get("id")
    
    def test_add_exchange_rate_invalid_currency(self):
        """Test adding exchange rate with invalid currency"""
        response = self.session.post(
            f"{BASE_URL}/api/invoice/config/exchange-rates",
            json={
                "to_currency": "INVALID",
                "rate": 1.0,
                "effective_date": "2026-04-04"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Correctly rejected invalid currency for exchange rate")
    
    def test_add_exchange_rate_zero_rate(self):
        """Test adding exchange rate with zero rate"""
        response = self.session.post(
            f"{BASE_URL}/api/invoice/config/exchange-rates",
            json={
                "to_currency": "USD",
                "rate": 0,
                "effective_date": "2026-04-04"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Correctly rejected zero exchange rate")
    
    def test_add_exchange_rate_negative_rate(self):
        """Test adding exchange rate with negative rate"""
        response = self.session.post(
            f"{BASE_URL}/api/invoice/config/exchange-rates",
            json={
                "to_currency": "USD",
                "rate": -1.0,
                "effective_date": "2026-04-04"
            }
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Correctly rejected negative exchange rate")
    
    # ==========================================
    # GET /api/invoice/config/exchange-rates
    # ==========================================
    
    def test_get_exchange_rates(self):
        """Test getting exchange rates"""
        response = self.session.get(f"{BASE_URL}/api/invoice/config/exchange-rates")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "base_currency" in data, "Response should contain 'base_currency'"
        assert "rates" in data, "Response should contain 'rates'"
        
        print(f"Base currency: {data['base_currency']}")
        print(f"Number of exchange rates: {len(data['rates'])}")
        
        if data['rates']:
            for rate in data['rates']:
                print(f"  1 {data['base_currency']} = {rate['rate']} {rate['to_currency']}")
    
    def test_get_exchange_rates_filter_by_currency(self):
        """Test getting exchange rates filtered by currency"""
        response = self.session.get(f"{BASE_URL}/api/invoice/config/exchange-rates?currency=USD")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        # All rates should be for USD
        for rate in data.get("rates", []):
            assert rate["to_currency"] == "USD", f"Expected USD, got {rate['to_currency']}"
        
        print(f"Found {len(data.get('rates', []))} USD exchange rates")
    
    # ==========================================
    # DELETE /api/invoice/config/exchange-rates/{rate_id}
    # ==========================================
    
    def test_delete_exchange_rate(self):
        """Test deleting an exchange rate"""
        # First create a rate to delete
        create_response = self.session.post(
            f"{BASE_URL}/api/invoice/config/exchange-rates",
            json={
                "to_currency": "EUR",
                "rate": 0.019,
                "effective_date": "2026-04-04"
            }
        )
        
        assert create_response.status_code == 200
        rate_id = create_response.json()["rate"]["id"]
        
        # Delete the rate
        delete_response = self.session.delete(f"{BASE_URL}/api/invoice/config/exchange-rates/{rate_id}")
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}: {delete_response.text}"
        print(f"Successfully deleted exchange rate: {rate_id}")
    
    def test_delete_nonexistent_exchange_rate(self):
        """Test deleting a non-existent exchange rate"""
        response = self.session.delete(f"{BASE_URL}/api/invoice/config/exchange-rates/nonexistent-id")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Correctly returned 404 for non-existent rate")
    
    # ==========================================
    # GET /api/invoice/config/convert
    # ==========================================
    
    def test_currency_conversion(self):
        """Test currency conversion"""
        # First ensure we have an exchange rate for USD
        self.session.post(
            f"{BASE_URL}/api/invoice/config/exchange-rates",
            json={
                "to_currency": "USD",
                "rate": 0.0204,
                "effective_date": "2026-04-04"
            }
        )
        
        # Test conversion
        response = self.session.get(
            f"{BASE_URL}/api/invoice/config/convert?amount=1000&from_currency=EGP&to_currency=USD"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "original_amount" in data, "Response should contain 'original_amount'"
        assert "converted_amount" in data, "Response should contain 'converted_amount'"
        assert "from_currency" in data, "Response should contain 'from_currency'"
        assert "to_currency" in data, "Response should contain 'to_currency'"
        assert "rate" in data, "Response should contain 'rate'"
        
        assert data["original_amount"] == 1000, "Original amount should be 1000"
        assert data["from_currency"] == "EGP", "From currency should be EGP"
        assert data["to_currency"] == "USD", "To currency should be USD"
        
        print(f"Converted {data['original_amount']} {data['from_currency']} = {data['converted_amount']} {data['to_currency']}")
        print(f"Exchange rate: {data['rate']}")
    
    def test_currency_conversion_same_currency(self):
        """Test conversion with same currency"""
        response = self.session.get(
            f"{BASE_URL}/api/invoice/config/convert?amount=1000&from_currency=EGP&to_currency=EGP"
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["converted_amount"] == 1000, "Same currency conversion should return same amount"
        assert data["rate"] == 1.0, "Same currency rate should be 1.0"
        
        print("Same currency conversion works correctly")
    
    def test_currency_conversion_invalid_currency(self):
        """Test conversion with invalid currency"""
        response = self.session.get(
            f"{BASE_URL}/api/invoice/config/convert?amount=1000&from_currency=INVALID&to_currency=USD"
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Correctly rejected invalid currency for conversion")


class TestInvoiceWithCurrency:
    """Test invoice creation with different currencies"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get auth token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if login_response.status_code == 200:
            token = login_response.json().get("access_token")
            self.session.headers.update({"Authorization": f"Bearer {token}"})
        else:
            pytest.skip(f"Login failed: {login_response.status_code}")
    
    def test_get_parties_for_invoice(self):
        """Test getting parties (customers) for invoice creation"""
        response = self.session.get(f"{BASE_URL}/api/invoice/parties?party_type=customer")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "parties" in data, "Response should contain 'parties'"
        
        print(f"Found {len(data['parties'])} customers")
        
        if data['parties']:
            self.customer_id = data['parties'][0]['id']
            print(f"First customer: {data['parties'][0]['name']} (ID: {self.customer_id})")
    
    def test_create_invoice_with_usd_currency(self):
        """Test creating an invoice with USD currency"""
        # First get a customer
        parties_response = self.session.get(f"{BASE_URL}/api/invoice/parties?party_type=customer")
        if parties_response.status_code != 200 or not parties_response.json().get('parties'):
            pytest.skip("No customers available for invoice creation")
        
        customer_id = parties_response.json()['parties'][0]['id']
        
        # Create invoice with USD currency
        invoice_data = {
            "document_type": "sales_invoice",
            "document_date": "2026-04-04",
            "due_date": "2026-04-14",
            "party_id": customer_id,
            "currency": "USD",
            "payment_terms": "net_7",
            "lines": [
                {
                    "description": "TEST_Currency_Service",
                    "quantity": 1,
                    "unit_price": 100.00,
                    "tax_rate": 14,
                    "discount_percent": 0,
                    "tax_type": "vat"
                }
            ],
            "notes": "Test invoice with USD currency",
            "reference": "TEST-USD-001"
        }
        
        response = self.session.post(f"{BASE_URL}/api/invoice/", json=invoice_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "invoice" in data, "Response should contain 'invoice'"
        
        invoice = data["invoice"]
        assert invoice["currency"] == "USD", f"Expected USD, got {invoice['currency']}"
        
        print(f"Successfully created invoice with USD currency")
        print(f"Invoice number: {invoice['document_number']}")
        print(f"Grand total: {invoice['grand_total']} USD")
        
        # Store invoice ID for cleanup
        self.created_invoice_id = invoice.get("id")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
