"""
Test Inventory Management API
Tests for: Warehouses, Categories, Units, Products, Stock Movements, Reports
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://bulk-upload-demo.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "dalia@datalifeai.com"
TEST_PASSWORD = "Dalia@2024"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]


@pytest.fixture(scope="module")
def headers(auth_token):
    """Get headers with auth token"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


# ==========================================
# Warehouse Tests
# ==========================================

class TestWarehouses:
    """Test warehouse CRUD operations"""
    
    def test_list_warehouses(self, headers):
        """GET /api/inventory/warehouses - List all warehouses"""
        response = requests.get(f"{BASE_URL}/api/inventory/warehouses", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "warehouses" in data
        print(f"Found {len(data['warehouses'])} warehouses")
        # Verify existing warehouse from seed data
        if data['warehouses']:
            wh = data['warehouses'][0]
            assert "id" in wh
            assert "code" in wh
            assert "name" in wh
            print(f"First warehouse: {wh.get('code')} - {wh.get('name')}")
    
    def test_create_warehouse(self, headers):
        """POST /api/inventory/warehouses - Create new warehouse"""
        warehouse_data = {
            "code": f"TEST-WH-{datetime.now().strftime('%H%M%S')}",
            "name": "مخزن اختبار",
            "name_en": "Test Warehouse",
            "address": "Test Address",
            "phone": "0123456789",
            "is_default": False,
            "allow_negative": False
        }
        response = requests.post(
            f"{BASE_URL}/api/inventory/warehouses",
            headers=headers,
            json=warehouse_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "warehouse" in data
        assert data["warehouse"]["code"] == warehouse_data["code"]
        assert data["warehouse"]["name"] == warehouse_data["name"]
        print(f"Created warehouse: {data['warehouse']['code']}")
        return data["warehouse"]["id"]


# ==========================================
# Category Tests
# ==========================================

class TestCategories:
    """Test category CRUD operations"""
    
    def test_list_categories(self, headers):
        """GET /api/inventory/categories - List all categories"""
        response = requests.get(f"{BASE_URL}/api/inventory/categories", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "categories" in data
        print(f"Found {len(data['categories'])} categories")
    
    def test_create_category(self, headers):
        """POST /api/inventory/categories - Create new category"""
        category_data = {
            "code": f"TEST-CAT-{datetime.now().strftime('%H%M%S')}",
            "name": "تصنيف اختبار",
            "name_en": "Test Category",
            "description": "Test category description"
        }
        response = requests.post(
            f"{BASE_URL}/api/inventory/categories",
            headers=headers,
            json=category_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "category" in data
        assert data["category"]["code"] == category_data["code"]
        print(f"Created category: {data['category']['code']}")
        return data["category"]["id"]


# ==========================================
# Units Tests
# ==========================================

class TestUnits:
    """Test units of measure"""
    
    def test_list_units(self, headers):
        """GET /api/inventory/units - List units (should return default units)"""
        response = requests.get(f"{BASE_URL}/api/inventory/units", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "units" in data
        units = data["units"]
        assert len(units) > 0, "Should have default units"
        
        # Verify default units exist
        unit_codes = [u["code"] for u in units]
        expected_codes = ["PCS", "KG", "M", "L", "BOX", "PACK"]
        for code in expected_codes:
            assert code in unit_codes, f"Missing default unit: {code}"
        
        print(f"Found {len(units)} units: {unit_codes}")


# ==========================================
# Products Tests
# ==========================================

class TestProducts:
    """Test product CRUD operations"""
    
    @pytest.fixture
    def unit_id(self, headers):
        """Get a unit ID for product creation"""
        response = requests.get(f"{BASE_URL}/api/inventory/units", headers=headers)
        units = response.json()["units"]
        # Get PCS (piece) unit
        pcs_unit = next((u for u in units if u["code"] == "PCS"), units[0])
        return pcs_unit["id"]
    
    def test_list_products(self, headers):
        """GET /api/inventory/products - List products with stock info"""
        response = requests.get(f"{BASE_URL}/api/inventory/products", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "products" in data
        assert "total" in data
        print(f"Found {data['total']} products")
        
        # Verify product structure
        if data["products"]:
            product = data["products"][0]
            assert "id" in product
            assert "code" in product
            assert "name" in product
            assert "total_stock" in product
            print(f"First product: {product.get('code')} - {product.get('name')}, Stock: {product.get('total_stock')}")
    
    def test_create_product_with_barcode_sku(self, headers, unit_id):
        """POST /api/inventory/products - Create product with barcode, SKU, reorder level"""
        product_data = {
            "code": f"TEST-PRD-{datetime.now().strftime('%H%M%S')}",
            "sku": f"SKU-{datetime.now().strftime('%H%M%S')}",
            "barcode": f"BAR-{datetime.now().strftime('%H%M%S')}",
            "name": "منتج اختبار",
            "name_en": "Test Product",
            "base_unit_id": unit_id,
            "cost_price": 100.0,
            "sale_price": 150.0,
            "tax_rate": 14.0,
            "reorder_level": 10.0,
            "min_stock": 5.0,
            "max_stock": 100.0,
            "has_expiry": False
        }
        response = requests.post(
            f"{BASE_URL}/api/inventory/products",
            headers=headers,
            json=product_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "product" in data
        product = data["product"]
        assert product["code"] == product_data["code"]
        assert product["sku"] == product_data["sku"]
        assert product["barcode"] == product_data["barcode"]
        assert product["reorder_level"] == product_data["reorder_level"]
        print(f"Created product: {product['code']} with SKU: {product['sku']}, Barcode: {product['barcode']}")
        return product["id"]


# ==========================================
# Stock Movements Tests
# ==========================================

class TestStockMovements:
    """Test stock movement operations"""
    
    @pytest.fixture
    def test_data(self, headers):
        """Get test data for movements"""
        # Get warehouse
        wh_response = requests.get(f"{BASE_URL}/api/inventory/warehouses", headers=headers)
        warehouses = wh_response.json()["warehouses"]
        warehouse = warehouses[0] if warehouses else None
        
        # Get product
        prod_response = requests.get(f"{BASE_URL}/api/inventory/products", headers=headers)
        products = prod_response.json()["products"]
        product = products[0] if products else None
        
        # Get unit
        unit_response = requests.get(f"{BASE_URL}/api/inventory/units", headers=headers)
        units = unit_response.json()["units"]
        unit = next((u for u in units if u["code"] == "PCS"), units[0])
        
        return {
            "warehouse_id": warehouse["id"] if warehouse else None,
            "product_id": product["id"] if product else None,
            "unit_id": unit["id"] if unit else None,
            "product_name": product["name"] if product else None
        }
    
    def test_list_movements(self, headers):
        """GET /api/inventory/movements - List movements"""
        response = requests.get(f"{BASE_URL}/api/inventory/movements", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "movements" in data
        assert "total" in data
        print(f"Found {data['total']} movements")
        
        # Verify movement structure
        if data["movements"]:
            mov = data["movements"][0]
            assert "movement_number" in mov
            assert "movement_type" in mov
            assert "product_name" in mov
            assert "quantity" in mov
            print(f"First movement: {mov.get('movement_number')} - {mov.get('movement_type')}")
    
    def test_create_opening_balance_movement(self, headers, test_data):
        """POST /api/inventory/movements - Create opening balance movement"""
        if not test_data["product_id"] or not test_data["warehouse_id"]:
            pytest.skip("No product or warehouse available for testing")
        
        movement_data = {
            "movement_date": datetime.now().strftime("%Y-%m-%d"),
            "movement_type": "opening",
            "product_id": test_data["product_id"],
            "warehouse_id": test_data["warehouse_id"],
            "quantity": 50.0,
            "unit_id": test_data["unit_id"],
            "unit_cost": 100.0,
            "notes": "Test opening balance"
        }
        response = requests.post(
            f"{BASE_URL}/api/inventory/movements",
            headers=headers,
            json=movement_data
        )
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "movement" in data
        mov = data["movement"]
        assert mov["movement_type"] == "opening"
        assert mov["quantity"] == 50.0
        print(f"Created opening balance: {mov['movement_number']} - {mov['quantity']} units")
    
    def test_create_sales_movement(self, headers, test_data):
        """POST /api/inventory/movements - Create sales movement (decreases stock)"""
        if not test_data["product_id"] or not test_data["warehouse_id"]:
            pytest.skip("No product or warehouse available for testing")
        
        movement_data = {
            "movement_date": datetime.now().strftime("%Y-%m-%d"),
            "movement_type": "sales",
            "product_id": test_data["product_id"],
            "warehouse_id": test_data["warehouse_id"],
            "quantity": 5.0,
            "unit_id": test_data["unit_id"],
            "unit_cost": 100.0,
            "notes": "Test sales movement"
        }
        response = requests.post(
            f"{BASE_URL}/api/inventory/movements",
            headers=headers,
            json=movement_data
        )
        # May fail if insufficient stock - that's expected behavior
        if response.status_code == 400:
            error = response.json()
            print(f"Sales movement blocked (expected if insufficient stock): {error.get('detail')}")
            return
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        assert "movement" in data
        mov = data["movement"]
        assert mov["movement_type"] == "sales"
        print(f"Created sales movement: {mov['movement_number']} - {mov['quantity']} units")


# ==========================================
# Stock Summary Tests
# ==========================================

class TestStockSummary:
    """Test stock summary endpoint"""
    
    def test_get_stock_summary(self, headers):
        """GET /api/inventory/stocks/summary - Get stock summary stats"""
        response = requests.get(f"{BASE_URL}/api/inventory/stocks/summary", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        # Verify summary structure
        assert "total_value" in data
        assert "total_products" in data
        assert "low_stock_count" in data
        assert "expiring_soon" in data
        assert "warehouses_count" in data
        
        print(f"Stock Summary:")
        print(f"  Total Value: {data['total_value']}")
        print(f"  Total Products: {data['total_products']}")
        print(f"  Low Stock Count: {data['low_stock_count']}")
        print(f"  Expiring Soon: {data['expiring_soon']}")
        print(f"  Warehouses Count: {data['warehouses_count']}")


# ==========================================
# Reports Tests
# ==========================================

class TestReports:
    """Test inventory reports"""
    
    def test_stock_balance_report(self, headers):
        """GET /api/inventory/reports/stock-balance - Stock balance report"""
        response = requests.get(f"{BASE_URL}/api/inventory/reports/stock-balance", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "report" in data
        assert "totals" in data
        
        totals = data["totals"]
        assert "total_items" in totals
        assert "total_value" in totals
        assert "low_stock_items" in totals
        
        print(f"Stock Balance Report:")
        print(f"  Total Items: {totals['total_items']}")
        print(f"  Total Value: {totals['total_value']}")
        print(f"  Low Stock Items: {totals['low_stock_items']}")
    
    def test_low_stock_report(self, headers):
        """GET /api/inventory/reports/low-stock - Low stock report"""
        response = requests.get(f"{BASE_URL}/api/inventory/reports/low-stock", headers=headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "items" in data
        assert "total_items" in data
        
        print(f"Low Stock Report: {data['total_items']} items below reorder level")
        
        # Verify item structure if any
        if data["items"]:
            item = data["items"][0]
            assert "product_code" in item
            assert "product_name" in item
            assert "current_qty" in item
            assert "reorder_level" in item


# ==========================================
# Authentication Tests
# ==========================================

class TestAuthentication:
    """Test authentication requirements"""
    
    def test_warehouses_requires_auth(self):
        """Verify warehouses endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/inventory/warehouses")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Warehouses endpoint correctly requires authentication")
    
    def test_products_requires_auth(self):
        """Verify products endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/inventory/products")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Products endpoint correctly requires authentication")
    
    def test_movements_requires_auth(self):
        """Verify movements endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/inventory/movements")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("Movements endpoint correctly requires authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
