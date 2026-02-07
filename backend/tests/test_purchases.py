"""
Test suite for Purchases Module API endpoints
Tests: Supplier CRUD, Purchase Orders CRUD, Status transitions, Stats
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')

# Test credentials
TEST_EMAIL = "test@company.com"
TEST_PASSWORD = "Test@123"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for tests"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Auth failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Headers with authorization"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


# ============ SUPPLIER TESTS ============

class TestSuppliers:
    """Supplier management endpoint tests"""
    
    created_supplier_id = None
    
    def test_create_supplier(self, auth_headers):
        """Test creating a new supplier"""
        supplier_data = {
            "name": "TEST_Supplier_Pytest",
            "contact_person": "Test Contact",
            "email": "test_supplier@pytest.com",
            "phone": "0123456789",
            "address": "Test Address 123",
            "tax_id": "TAX123456",
            "payment_terms": "Net 30",
            "category": "Test Category",
            "notes": "Created by pytest"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/purchases/suppliers",
            json=supplier_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Failed to create supplier: {response.text}"
        
        data = response.json()
        assert "id" in data, "Supplier ID not returned"
        assert data["name"] == supplier_data["name"]
        assert data["email"] == supplier_data["email"]
        assert data["is_active"] == True
        assert data["total_orders"] == 0
        
        TestSuppliers.created_supplier_id = data["id"]
        print(f"Created supplier: {data['id']}")
    
    def test_get_suppliers_list(self, auth_headers):
        """Test fetching suppliers list"""
        response = requests.get(
            f"{BASE_URL}/api/purchases/suppliers",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify our created supplier exists
        supplier_ids = [s["id"] for s in data]
        assert TestSuppliers.created_supplier_id in supplier_ids, "Created supplier not in list"
    
    def test_get_single_supplier(self, auth_headers):
        """Test getting a single supplier by ID"""
        response = requests.get(
            f"{BASE_URL}/api/purchases/suppliers/{TestSuppliers.created_supplier_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == TestSuppliers.created_supplier_id
        assert data["name"] == "TEST_Supplier_Pytest"
        assert "recent_orders" in data  # Should include order history
    
    def test_update_supplier(self, auth_headers):
        """Test updating supplier information"""
        update_data = {
            "name": "TEST_Supplier_Updated",
            "contact_person": "Updated Contact",
            "category": "Updated Category"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/purchases/suppliers/{TestSuppliers.created_supplier_id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        
        # Verify update persisted
        verify_response = requests.get(
            f"{BASE_URL}/api/purchases/suppliers/{TestSuppliers.created_supplier_id}",
            headers=auth_headers
        )
        verify_data = verify_response.json()
        assert verify_data["name"] == "TEST_Supplier_Updated"
        assert verify_data["contact_person"] == "Updated Contact"
    
    def test_get_suppliers_with_category_filter(self, auth_headers):
        """Test filtering suppliers by category"""
        response = requests.get(
            f"{BASE_URL}/api/purchases/suppliers?category=Updated%20Category",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        # All returned suppliers should have the filtered category
        for supplier in data:
            if supplier["id"] == TestSuppliers.created_supplier_id:
                assert supplier["category"] == "Updated Category"
    
    def test_get_supplier_not_found(self, auth_headers):
        """Test getting non-existent supplier returns 404"""
        response = requests.get(
            f"{BASE_URL}/api/purchases/suppliers/nonexistent_id_12345",
            headers=auth_headers
        )
        
        assert response.status_code == 404


# ============ PURCHASE ORDER TESTS ============

class TestPurchaseOrders:
    """Purchase order endpoint tests"""
    
    created_po_number = None
    
    def test_create_purchase_order(self, auth_headers):
        """Test creating a new purchase order"""
        # First get an existing supplier
        suppliers_response = requests.get(
            f"{BASE_URL}/api/purchases/suppliers",
            headers=auth_headers
        )
        suppliers = suppliers_response.json()
        supplier = suppliers[0] if suppliers else None
        
        order_data = {
            "supplier_id": supplier["id"] if supplier else "sup_63r7xg0i",
            "supplier_name": supplier["name"] if supplier else "Test Supplier",
            "items": [
                {
                    "description": "TEST_Item_1",
                    "quantity": 10,
                    "unit_price": 100,
                    "product_id": "prod_001"
                },
                {
                    "description": "TEST_Item_2",
                    "quantity": 5,
                    "unit_price": 200,
                    "product_id": "prod_002"
                }
            ],
            "tax_rate": 14,
            "payment_terms": "Net 30",
            "delivery_date": "2026-03-01",
            "notes": "Test order created by pytest"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/purchases/orders",
            json=order_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Failed to create order: {response.text}"
        
        data = response.json()
        assert "po_number" in data, "PO number not returned"
        assert data["status"] == "draft"
        assert data["payment_status"] == "unpaid"
        
        # Verify tax calculation (14% of 2000)
        expected_subtotal = (10 * 100) + (5 * 200)  # 2000
        expected_tax = expected_subtotal * 0.14  # 280
        expected_total = expected_subtotal + expected_tax  # 2280
        
        assert data["subtotal"] == expected_subtotal, f"Subtotal mismatch: {data['subtotal']} != {expected_subtotal}"
        assert abs(data["tax_amount"] - expected_tax) < 0.01, f"Tax mismatch: {data['tax_amount']} != {expected_tax}"
        assert abs(data["grand_total"] - expected_total) < 0.01, f"Total mismatch: {data['grand_total']} != {expected_total}"
        
        TestPurchaseOrders.created_po_number = data["po_number"]
        print(f"Created PO: {data['po_number']}")
    
    def test_get_purchase_orders_list(self, auth_headers):
        """Test fetching purchase orders list"""
        response = requests.get(
            f"{BASE_URL}/api/purchases/orders",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # Verify our created order exists
        po_numbers = [o["po_number"] for o in data]
        assert TestPurchaseOrders.created_po_number in po_numbers
    
    def test_get_single_purchase_order(self, auth_headers):
        """Test getting a single purchase order by PO number"""
        response = requests.get(
            f"{BASE_URL}/api/purchases/orders/{TestPurchaseOrders.created_po_number}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["po_number"] == TestPurchaseOrders.created_po_number
        assert data["status"] == "draft"
        assert len(data["items"]) == 2
    
    def test_get_orders_with_status_filter(self, auth_headers):
        """Test filtering orders by status"""
        response = requests.get(
            f"{BASE_URL}/api/purchases/orders?status=draft",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        for order in data:
            assert order["status"] == "draft"
    
    def test_update_purchase_order(self, auth_headers):
        """Test updating purchase order details"""
        update_data = {
            "notes": "Updated notes by pytest",
            "payment_terms": "Net 60"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/purchases/orders/{TestPurchaseOrders.created_po_number}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        
        # Verify update
        verify_response = requests.get(
            f"{BASE_URL}/api/purchases/orders/{TestPurchaseOrders.created_po_number}",
            headers=auth_headers
        )
        verify_data = verify_response.json()
        assert verify_data["notes"] == "Updated notes by pytest"


# ============ ORDER STATUS WORKFLOW TESTS ============

class TestOrderStatusWorkflow:
    """Test order status transitions: draft -> pending -> approved -> ordered -> received"""
    
    workflow_po_number = None
    
    def test_create_order_for_workflow(self, auth_headers):
        """Create an order for workflow testing"""
        order_data = {
            "supplier_id": "sup_63r7xg0i",
            "supplier_name": "Workflow Test Supplier",
            "items": [
                {"description": "TEST_Workflow_Item", "quantity": 1, "unit_price": 100}
            ],
            "tax_rate": 14
        }
        
        response = requests.post(
            f"{BASE_URL}/api/purchases/orders",
            json=order_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        TestOrderStatusWorkflow.workflow_po_number = data["po_number"]
        assert data["status"] == "draft"
        print(f"Created workflow PO: {data['po_number']}")
    
    def test_status_draft_to_pending_approval(self, auth_headers):
        """Test transitioning from draft to pending_approval"""
        response = requests.put(
            f"{BASE_URL}/api/purchases/orders/{TestOrderStatusWorkflow.workflow_po_number}/status",
            json={"status": "pending_approval"},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        # Verify status change
        verify = requests.get(
            f"{BASE_URL}/api/purchases/orders/{TestOrderStatusWorkflow.workflow_po_number}",
            headers=auth_headers
        )
        assert verify.json()["status"] == "pending_approval"
    
    def test_status_pending_to_approved(self, auth_headers):
        """Test transitioning from pending_approval to approved"""
        response = requests.put(
            f"{BASE_URL}/api/purchases/orders/{TestOrderStatusWorkflow.workflow_po_number}/status",
            json={"status": "approved"},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        # Verify status and approval fields
        verify = requests.get(
            f"{BASE_URL}/api/purchases/orders/{TestOrderStatusWorkflow.workflow_po_number}",
            headers=auth_headers
        )
        data = verify.json()
        assert data["status"] == "approved"
        assert "approved_by" in data
        assert "approved_at" in data
    
    def test_status_approved_to_ordered(self, auth_headers):
        """Test transitioning from approved to ordered"""
        response = requests.put(
            f"{BASE_URL}/api/purchases/orders/{TestOrderStatusWorkflow.workflow_po_number}/status",
            json={"status": "ordered"},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        verify = requests.get(
            f"{BASE_URL}/api/purchases/orders/{TestOrderStatusWorkflow.workflow_po_number}",
            headers=auth_headers
        )
        assert verify.json()["status"] == "ordered"
    
    def test_status_ordered_to_received(self, auth_headers):
        """Test transitioning from ordered to received"""
        response = requests.put(
            f"{BASE_URL}/api/purchases/orders/{TestOrderStatusWorkflow.workflow_po_number}/status",
            json={"status": "received"},
            headers=auth_headers
        )
        
        assert response.status_code == 200
        
        verify = requests.get(
            f"{BASE_URL}/api/purchases/orders/{TestOrderStatusWorkflow.workflow_po_number}",
            headers=auth_headers
        )
        data = verify.json()
        assert data["status"] == "received"
        assert "received_at" in data
    
    def test_invalid_status_rejected(self, auth_headers):
        """Test that invalid status is rejected"""
        # Create a new order for this test
        order_response = requests.post(
            f"{BASE_URL}/api/purchases/orders",
            json={
                "supplier_id": "sup_63r7xg0i",
                "supplier_name": "Test",
                "items": [{"description": "TEST_Invalid_Status", "quantity": 1, "unit_price": 50}],
                "tax_rate": 14
            },
            headers=auth_headers
        )
        po = order_response.json()["po_number"]
        
        response = requests.put(
            f"{BASE_URL}/api/purchases/orders/{po}/status",
            json={"status": "invalid_status"},
            headers=auth_headers
        )
        
        assert response.status_code == 400


# ============ ORDER CANCELLATION TESTS ============

class TestOrderCancellation:
    """Test order cancellation (DELETE endpoint)"""
    
    def test_cancel_draft_order(self, auth_headers):
        """Test cancelling a draft order"""
        # Create an order to cancel
        order_response = requests.post(
            f"{BASE_URL}/api/purchases/orders",
            json={
                "supplier_id": "sup_63r7xg0i",
                "supplier_name": "Cancel Test Supplier",
                "items": [{"description": "TEST_Cancel_Item", "quantity": 1, "unit_price": 100}],
                "tax_rate": 14
            },
            headers=auth_headers
        )
        po_number = order_response.json()["po_number"]
        
        # Cancel the order
        response = requests.delete(
            f"{BASE_URL}/api/purchases/orders/{po_number}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        
        # Verify order is now cancelled
        verify = requests.get(
            f"{BASE_URL}/api/purchases/orders/{po_number}",
            headers=auth_headers
        )
        assert verify.json()["status"] == "cancelled"
    
    def test_cannot_cancel_received_order(self, auth_headers):
        """Test that received orders cannot be cancelled"""
        # Create and progress an order to received
        order_response = requests.post(
            f"{BASE_URL}/api/purchases/orders",
            json={
                "supplier_id": "sup_63r7xg0i",
                "supplier_name": "No Cancel Test",
                "items": [{"description": "TEST_No_Cancel", "quantity": 1, "unit_price": 100}],
                "tax_rate": 14
            },
            headers=auth_headers
        )
        po_number = order_response.json()["po_number"]
        
        # Progress to received
        for status in ["pending_approval", "approved", "ordered", "received"]:
            requests.put(
                f"{BASE_URL}/api/purchases/orders/{po_number}/status",
                json={"status": status},
                headers=auth_headers
            )
        
        # Try to cancel - should fail
        response = requests.delete(
            f"{BASE_URL}/api/purchases/orders/{po_number}",
            headers=auth_headers
        )
        
        assert response.status_code == 400
    
    def test_cancel_nonexistent_order(self, auth_headers):
        """Test cancelling non-existent order returns 404"""
        response = requests.delete(
            f"{BASE_URL}/api/purchases/orders/PO-NONEXISTENT-999999",
            headers=auth_headers
        )
        
        assert response.status_code == 404


# ============ PURCHASE STATS TESTS ============

class TestPurchaseStats:
    """Test purchase statistics endpoint"""
    
    def test_get_purchase_stats(self, auth_headers):
        """Test fetching purchase statistics"""
        response = requests.get(
            f"{BASE_URL}/api/purchases/stats",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify stats structure
        assert "total_orders" in data
        assert "total_amount" in data
        assert "pending_orders" in data
        assert "by_status" in data
        assert "top_suppliers" in data
        
        # Verify data types
        assert isinstance(data["total_orders"], int)
        assert isinstance(data["total_amount"], (int, float))
        assert isinstance(data["by_status"], dict)
        assert isinstance(data["top_suppliers"], list)
        
        print(f"Stats: {data['total_orders']} orders, {data['total_amount']} total amount")


# ============ AUTHORIZATION TESTS ============

class TestAuthorization:
    """Test authorization requirements"""
    
    def test_suppliers_requires_auth(self):
        """Test that suppliers endpoint requires authorization"""
        response = requests.get(f"{BASE_URL}/api/purchases/suppliers")
        assert response.status_code == 401
    
    def test_orders_requires_auth(self):
        """Test that orders endpoint requires authorization"""
        response = requests.get(f"{BASE_URL}/api/purchases/orders")
        assert response.status_code == 401
    
    def test_stats_requires_auth(self):
        """Test that stats endpoint requires authorization"""
        response = requests.get(f"{BASE_URL}/api/purchases/stats")
        assert response.status_code == 401
    
    def test_create_order_requires_auth(self):
        """Test that creating order requires authorization"""
        response = requests.post(
            f"{BASE_URL}/api/purchases/orders",
            json={"supplier_id": "test", "items": []}
        )
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
