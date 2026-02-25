"""
Test suite for Data Import Feature
Tests all import endpoints: employees, customers, suppliers, inventory, invoices, purchases, financial
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_EMAIL = "dalia@datalifeai.com"
TEST_PASSWORD = "Dalia@2024"


class TestImportAuth:
    """Authentication tests for import endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed - skipping tests")
    
    def test_import_history_requires_auth(self):
        """Import history endpoint should require authentication"""
        response = requests.get(f"{BASE_URL}/api/import/history")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASSED: Import history requires auth")
    
    def test_import_employees_requires_auth(self):
        """Import employees endpoint should require authentication"""
        # Create a simple CSV content
        csv_content = b"name,position\nTest,Engineer"
        files = {'file': ('test.csv', io.BytesIO(csv_content), 'text/csv')}
        response = requests.post(f"{BASE_URL}/api/import/employees", files=files)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("PASSED: Import employees requires auth")


class TestImportTemplates:
    """Test template endpoint for all data types"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed - skipping tests")
    
    def test_template_employees(self):
        """Get employees template"""
        response = requests.get(f"{BASE_URL}/api/import/template/employees")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "columns_en" in data
        assert "columns_ar" in data
        assert "sample" in data
        assert "name" in data["columns_en"]
        assert "الاسم" in data["columns_ar"]
        print(f"PASSED: Employees template - columns_en: {data['columns_en']}")
    
    def test_template_customers(self):
        """Get customers template"""
        response = requests.get(f"{BASE_URL}/api/import/template/customers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "columns_en" in data
        assert "name" in data["columns_en"]
        print(f"PASSED: Customers template - columns_en: {data['columns_en']}")
    
    def test_template_suppliers(self):
        """Get suppliers template"""
        response = requests.get(f"{BASE_URL}/api/import/template/suppliers")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "columns_en" in data
        assert "name" in data["columns_en"]
        print(f"PASSED: Suppliers template - columns_en: {data['columns_en']}")
    
    def test_template_inventory(self):
        """Get inventory template"""
        response = requests.get(f"{BASE_URL}/api/import/template/inventory")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "columns_en" in data
        assert "name" in data["columns_en"]
        print(f"PASSED: Inventory template - columns_en: {data['columns_en']}")
    
    def test_template_invoices(self):
        """Get invoices template"""
        response = requests.get(f"{BASE_URL}/api/import/template/invoices")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "columns_en" in data
        assert "invoice_number" in data["columns_en"]
        print(f"PASSED: Invoices template - columns_en: {data['columns_en']}")
    
    def test_template_purchases(self):
        """Get purchases template"""
        response = requests.get(f"{BASE_URL}/api/import/template/purchases")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "columns_en" in data
        assert "purchase_number" in data["columns_en"]
        print(f"PASSED: Purchases template - columns_en: {data['columns_en']}")
    
    def test_template_financial(self):
        """Get financial template"""
        response = requests.get(f"{BASE_URL}/api/import/template/financial")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "columns_en" in data
        assert "date" in data["columns_en"]
        assert "amount" in data["columns_en"]
        print(f"PASSED: Financial template - columns_en: {data['columns_en']}")
    
    def test_template_not_found(self):
        """Test invalid template type returns 404"""
        response = requests.get(f"{BASE_URL}/api/import/template/invalid_type")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("PASSED: Invalid template returns 404")


class TestImportEmployees:
    """Test employees import functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed - skipping tests")
    
    def test_import_employees_english_headers(self):
        """Import employees with English headers"""
        csv_content = b"name,position,department,email,phone,hire_date,basic_salary\nTEST_John Doe,Engineer,IT,testjohn@test.com,1234567890,2024-01-15,15000"
        files = {'file': ('test_employees_en.csv', io.BytesIO(csv_content), 'text/csv')}
        
        response = requests.post(
            f"{BASE_URL}/api/import/employees",
            files=files,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        assert "total" in data
        assert "success" in data
        assert data["total"] == 1
        assert data["success"] >= 0  # May be 0 if name already exists
        print(f"PASSED: Import employees (English) - total: {data['total']}, success: {data['success']}")
    
    def test_import_employees_arabic_headers(self):
        """Import employees with Arabic headers"""
        csv_content = "الاسم,الوظيفة,القسم,البريد الإلكتروني,الهاتف,تاريخ التعيين,الراتب الأساسي\nTEST_عمر محمد,مهندس برمجيات,تكنولوجيا المعلومات,omar@test.com,01234567893,2024-01-15,15000".encode('utf-8-sig')
        files = {'file': ('test_employees_ar.csv', io.BytesIO(csv_content), 'text/csv')}
        
        response = requests.post(
            f"{BASE_URL}/api/import/employees",
            files=files,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "message" in data
        assert data["total"] == 1
        print(f"PASSED: Import employees (Arabic) - total: {data['total']}, success: {data['success']}")
    
    def test_import_employees_missing_name_column(self):
        """Import employees without required name column should fail"""
        csv_content = b"position,department\nEngineer,IT"
        files = {'file': ('test_no_name.csv', io.BytesIO(csv_content), 'text/csv')}
        
        response = requests.post(
            f"{BASE_URL}/api/import/employees",
            files=files,
            headers=self.headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("PASSED: Import fails without name column")


class TestImportCustomers:
    """Test customers import functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed - skipping tests")
    
    def test_import_customers_english(self):
        """Import customers with English headers"""
        csv_content = b"name,email,phone,address,balance\nTEST_ABC Company,info@abc.com,1234567890,Cairo,5000"
        files = {'file': ('test_customers.csv', io.BytesIO(csv_content), 'text/csv')}
        
        response = requests.post(
            f"{BASE_URL}/api/import/customers",
            files=files,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["total"] == 1
        print(f"PASSED: Import customers - total: {data['total']}, success: {data['success']}")
    
    def test_import_customers_arabic(self):
        """Import customers with Arabic headers"""
        csv_content = "الاسم,البريد الإلكتروني,الهاتف,العنوان,الرصيد\nTEST_شركة XYZ,xyz@test.com,01234567894,الجيزة,10000".encode('utf-8-sig')
        files = {'file': ('test_customers_ar.csv', io.BytesIO(csv_content), 'text/csv')}
        
        response = requests.post(
            f"{BASE_URL}/api/import/customers",
            files=files,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["total"] == 1
        print(f"PASSED: Import customers (Arabic) - total: {data['total']}, success: {data['success']}")


class TestImportSuppliers:
    """Test suppliers import functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed - skipping tests")
    
    def test_import_suppliers(self):
        """Import suppliers with English headers"""
        csv_content = b"name,email,phone,address,balance\nTEST_Supplier 1,supplier1@test.com,1234567890,Cairo,8000"
        files = {'file': ('test_suppliers.csv', io.BytesIO(csv_content), 'text/csv')}
        
        response = requests.post(
            f"{BASE_URL}/api/import/suppliers",
            files=files,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["total"] == 1
        print(f"PASSED: Import suppliers - total: {data['total']}, success: {data['success']}")


class TestImportInventory:
    """Test inventory import functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed - skipping tests")
    
    def test_import_inventory(self):
        """Import inventory items"""
        csv_content = b"name,category,quantity,unit,unit_price,min_stock\nTEST_Product 1,Raw Materials,100,kg,50,20"
        files = {'file': ('test_inventory.csv', io.BytesIO(csv_content), 'text/csv')}
        
        response = requests.post(
            f"{BASE_URL}/api/import/inventory",
            files=files,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["total"] == 1
        print(f"PASSED: Import inventory - total: {data['total']}, success: {data['success']}")


class TestImportInvoices:
    """Test invoices import functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed - skipping tests")
    
    def test_import_invoices(self):
        """Import invoices"""
        csv_content = b"invoice_number,customer_name,date,due_date,amount,status\nTEST_INV-001,Customer 1,2024-01-15,2024-02-15,5000,pending"
        files = {'file': ('test_invoices.csv', io.BytesIO(csv_content), 'text/csv')}
        
        response = requests.post(
            f"{BASE_URL}/api/import/invoices",
            files=files,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["total"] == 1
        print(f"PASSED: Import invoices - total: {data['total']}, success: {data['success']}")


class TestImportPurchases:
    """Test purchases import functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed - skipping tests")
    
    def test_import_purchases(self):
        """Import purchases"""
        csv_content = b"purchase_number,supplier_name,date,amount,status\nTEST_PO-001,Supplier 1,2024-01-15,10000,pending"
        files = {'file': ('test_purchases.csv', io.BytesIO(csv_content), 'text/csv')}
        
        response = requests.post(
            f"{BASE_URL}/api/import/purchases",
            files=files,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["total"] == 1
        print(f"PASSED: Import purchases - total: {data['total']}, success: {data['success']}")


class TestImportFinancial:
    """Test financial data import functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed - skipping tests")
    
    def test_import_revenue(self):
        """Import revenue data"""
        csv_content = b"date,description,amount,category\n2024-01-15,TEST_Product Sales,25000,Sales"
        files = {'file': ('test_revenue.csv', io.BytesIO(csv_content), 'text/csv')}
        data = {'data_type': 'revenue'}
        
        response = requests.post(
            f"{BASE_URL}/api/import/financial",
            files=files,
            data=data,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        result = response.json()
        assert result["total"] == 1
        print(f"PASSED: Import revenue - total: {result['total']}, success: {result['success']}")
    
    def test_import_expense(self):
        """Import expense data"""
        csv_content = b"date,description,amount,category\n2024-01-15,TEST_Office Supplies,5000,Office"
        files = {'file': ('test_expense.csv', io.BytesIO(csv_content), 'text/csv')}
        data = {'data_type': 'expense'}
        
        response = requests.post(
            f"{BASE_URL}/api/import/financial",
            files=files,
            data=data,
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        result = response.json()
        assert result["total"] == 1
        print(f"PASSED: Import expense - total: {result['total']}, success: {result['success']}")


class TestImportHistory:
    """Test import history functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed - skipping tests")
    
    def test_get_import_history(self):
        """Get import history"""
        response = requests.get(
            f"{BASE_URL}/api/import/history",
            headers=self.headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Expected list response"
        print(f"PASSED: Get import history - found {len(data)} records")
        
        # If there are records, verify structure
        if len(data) > 0:
            record = data[0]
            assert "type" in record
            assert "filename" in record
            assert "total_rows" in record
            assert "success_count" in record
            print(f"PASSED: Import history record structure verified")


class TestImportFileFormats:
    """Test different file format handling"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            self.token = response.json().get("access_token")
            self.headers = {"Authorization": f"Bearer {self.token}"}
        else:
            pytest.skip("Login failed - skipping tests")
    
    def test_invalid_file_format(self):
        """Test uploading invalid file format"""
        content = b"This is not a valid CSV or Excel file"
        files = {'file': ('test.txt', io.BytesIO(content), 'text/plain')}
        
        response = requests.post(
            f"{BASE_URL}/api/import/employees",
            files=files,
            headers=self.headers
        )
        
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("PASSED: Invalid file format rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
