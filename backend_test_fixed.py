#!/usr/bin/env python3
"""
Comprehensive Backend API Testing - Fixed Version
Tests all backend APIs with existing user credentials: test-logo@example.com
"""

import asyncio
import httpx
import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Get backend URL from environment
BACKEND_URL = "https://erp-dashboard-62.preview.emergentagent.com/api"

class ComprehensiveAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.client = None
        self.test_results = []
        self.test_tokens = {}
        self.test_users = {}
        self.test_data = {}
        
    async def setup(self):
        """Setup HTTP client"""
        self.client = httpx.AsyncClient(timeout=30.0)
        
    async def cleanup(self):
        """Cleanup HTTP client"""
        if self.client:
            await self.client.aclose()
    
    def log_result(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")

    async def test_api_health(self):
        """Test basic API health"""
        try:
            response = await self.client.get(f"{self.base_url}/")
            
            if response.status_code == 200:
                self.log_result("API Health", True, "API is responding")
            else:
                self.log_result("API Health", False, f"API returned {response.status_code}")
                
        except Exception as e:
            self.log_result("API Health", False, f"Exception: {str(e)}")

    async def test_existing_user_login(self):
        """Test login with existing user credentials"""
        login_data = {
            "email": "test-logo@example.com",
            "password": "testpass123"
        }
        
        try:
            response = await self.client.post(
                f"{self.base_url}/auth/login",
                json=login_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Store token for other tests
                self.test_tokens["existing_user"] = data["access_token"]
                self.test_users["existing_user"] = data["user"]
                
                self.log_result("Existing User Login", True, 
                              f"Successfully logged in as {data['user'].get('full_name')} ({data['user'].get('role')})")
                return data
            else:
                self.log_result("Existing User Login", False, 
                              f"Expected 200, got {response.status_code}: {response.text}")
                return None
                
        except Exception as e:
            self.log_result("Existing User Login", False, f"Exception: {str(e)}")
            return None

    async def test_company_details(self):
        """Test GET /api/companies/{company_id}"""
        if "existing_user" not in self.test_tokens or "existing_user" not in self.test_users:
            self.log_result("Company Details", False, "No existing user data available")
            return
            
        company_id = self.test_users["existing_user"].get("company_id")
        if not company_id:
            self.log_result("Company Details", False, "No company_id available")
            return
            
        try:
            response = await self.client.get(
                f"{self.base_url}/companies/{company_id}",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Company Details", True, f"Retrieved company: {data.get('name')}")
                return data
            else:
                self.log_result("Company Details", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Company Details", False, f"Exception: {str(e)}")

    async def test_user_management_apis(self):
        """Test User Management APIs"""
        if "existing_user" not in self.test_tokens:
            self.log_result("User Management", False, "No existing user token available")
            return
            
        # Test GET /api/users/
        try:
            response = await self.client.get(
                f"{self.base_url}/users/",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("List Users", True, f"Retrieved {len(data)} users")
            else:
                self.log_result("List Users", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("List Users", False, f"Exception: {str(e)}")
        
        # Test POST /api/users/
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        user_data = {
            "email": f"test.user.{timestamp}@company.com",
            "full_name": "Test User",
            "role": "Accountant",
            "password": "testpass123"
        }
        
        try:
            response = await self.client.post(
                f"{self.base_url}/users/",
                json=user_data,
                headers={
                    "Authorization": f"Bearer {self.test_tokens['existing_user']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self.test_data["created_user_id"] = data.get("id")
                self.log_result("Create User", True, f"Created user: {data.get('email')}")
            else:
                self.log_result("Create User", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Create User", False, f"Exception: {str(e)}")

    async def test_hr_apis(self):
        """Test HR Module APIs"""
        if "existing_user" not in self.test_tokens:
            self.log_result("HR APIs", False, "No existing user token available")
            return
            
        company_id = self.test_users["existing_user"].get("company_id") if "existing_user" in self.test_users else None
        
        # Test HR Employees
        try:
            # GET
            response = await self.client.get(
                f"{self.base_url}/hr/employees",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("HR Employees GET", True, f"Retrieved {len(data)} employees")
            else:
                self.log_result("HR Employees GET", False, f"Expected 200, got {response.status_code}: {response.text}")
            
            # POST
            employee_data = {
                "company_id": company_id,
                "name": "Ahmed Hassan",
                "position": "Software Engineer",
                "department": "IT",
                "email": "ahmed.hassan@company.com",
                "phone": "+201234567890",
                "hire_date": "2024-01-15",
                "basic_salary": 15000.0
            }
            
            response = await self.client.post(
                f"{self.base_url}/hr/employees",
                json=employee_data,
                headers={
                    "Authorization": f"Bearer {self.test_tokens['existing_user']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self.test_data["employee_id"] = data.get("id")
                self.log_result("HR Employees POST", True, f"Created employee: {data.get('name')}")
            else:
                self.log_result("HR Employees POST", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("HR Employees", False, f"Exception: {str(e)}")
        
        # Test HR Allowances
        try:
            # GET
            response = await self.client.get(
                f"{self.base_url}/hr/allowances",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("HR Allowances GET", True, f"Retrieved {len(data)} allowances")
            else:
                self.log_result("HR Allowances GET", False, f"Expected 200, got {response.status_code}: {response.text}")
            
            # POST
            allowance_data = {
                "company_id": company_id,
                "employee_id": self.test_data.get("employee_id", "emp_123"),
                "employee_name": "Ahmed Hassan",
                "type": "Transport",
                "amount": 1500.0,
                "month": "2024-12"
            }
            
            response = await self.client.post(
                f"{self.base_url}/hr/allowances",
                json=allowance_data,
                headers={
                    "Authorization": f"Bearer {self.test_tokens['existing_user']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("HR Allowances POST", True, f"Created allowance: {data.get('type')}")
            else:
                self.log_result("HR Allowances POST", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("HR Allowances", False, f"Exception: {str(e)}")

        # Test HR Deductions
        try:
            # GET
            response = await self.client.get(
                f"{self.base_url}/hr/deductions",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("HR Deductions GET", True, f"Retrieved {len(data)} deductions")
            else:
                self.log_result("HR Deductions GET", False, f"Expected 200, got {response.status_code}: {response.text}")
            
            # POST
            deduction_data = {
                "company_id": company_id,
                "employee_id": self.test_data.get("employee_id", "emp_123"),
                "employee_name": "Ahmed Hassan",
                "type": "Insurance",
                "amount": 500.0,
                "month": "2024-12"
            }
            
            response = await self.client.post(
                f"{self.base_url}/hr/deductions",
                json=deduction_data,
                headers={
                    "Authorization": f"Bearer {self.test_tokens['existing_user']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("HR Deductions POST", True, f"Created deduction: {data.get('type')}")
            else:
                self.log_result("HR Deductions POST", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("HR Deductions", False, f"Exception: {str(e)}")

        # Test HR Leaves
        try:
            # GET
            response = await self.client.get(
                f"{self.base_url}/hr/leaves",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("HR Leaves GET", True, f"Retrieved {len(data)} leave records")
            else:
                self.log_result("HR Leaves GET", False, f"Expected 200, got {response.status_code}: {response.text}")
            
            # POST
            leave_data = {
                "company_id": company_id,
                "employee_id": self.test_data.get("employee_id", "emp_123"),
                "employee_name": "Ahmed Hassan",
                "leave_type": "annual",
                "start_date": "2024-12-25",
                "end_date": "2024-12-30",
                "days": 5,
                "reason": "Year-end vacation"
            }
            
            response = await self.client.post(
                f"{self.base_url}/hr/leaves",
                json=leave_data,
                headers={
                    "Authorization": f"Bearer {self.test_tokens['existing_user']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("HR Leaves POST", True, f"Created leave: {data.get('leave_type')}")
            else:
                self.log_result("HR Leaves POST", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("HR Leaves", False, f"Exception: {str(e)}")

        # Test HR Attendance
        try:
            # GET
            response = await self.client.get(
                f"{self.base_url}/hr/attendance",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("HR Attendance GET", True, f"Retrieved {len(data)} attendance records")
            else:
                self.log_result("HR Attendance GET", False, f"Expected 200, got {response.status_code}: {response.text}")
            
            # POST
            attendance_data = {
                "company_id": company_id,
                "employee_id": self.test_data.get("employee_id", "emp_123"),
                "employee_name": "Ahmed Hassan",
                "date": "2024-12-15",
                "check_in": "09:00",
                "check_out": "17:00",
                "status": "present",
                "hours": 8.0
            }
            
            response = await self.client.post(
                f"{self.base_url}/hr/attendance",
                json=attendance_data,
                headers={
                    "Authorization": f"Bearer {self.test_tokens['existing_user']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("HR Attendance POST", True, f"Created attendance record")
            else:
                self.log_result("HR Attendance POST", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("HR Attendance", False, f"Exception: {str(e)}")

    async def test_financial_apis(self):
        """Test Financial Module APIs"""
        if "existing_user" not in self.test_tokens:
            self.log_result("Financial APIs", False, "No existing user token available")
            return
            
        company_id = self.test_users["existing_user"].get("company_id") if "existing_user" in self.test_users else None
        
        # Test Financial Journal Entries
        try:
            # GET
            response = await self.client.get(
                f"{self.base_url}/financial/journal-entries",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Financial Journal Entries GET", True, f"Retrieved {len(data)} journal entries")
            else:
                self.log_result("Financial Journal Entries GET", False, f"Expected 200, got {response.status_code}: {response.text}")
            
            # POST
            journal_data = {
                "company_id": company_id,
                "date": "2024-12-15",
                "description": "Office supplies purchase",
                "account": "Office Expenses",
                "debit": 2500.0,
                "credit": 0.0
            }
            
            response = await self.client.post(
                f"{self.base_url}/financial/journal-entries",
                json=journal_data,
                headers={
                    "Authorization": f"Bearer {self.test_tokens['existing_user']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Financial Journal Entries POST", True, f"Created journal entry: {data.get('description')}")
            else:
                self.log_result("Financial Journal Entries POST", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Financial Journal Entries", False, f"Exception: {str(e)}")

        # Test Financial Customers
        try:
            # GET
            response = await self.client.get(
                f"{self.base_url}/financial/customers",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Financial Customers GET", True, f"Retrieved {len(data)} customers")
            else:
                self.log_result("Financial Customers GET", False, f"Expected 200, got {response.status_code}: {response.text}")
            
            # POST
            customer_data = {
                "company_id": company_id,
                "name": "Mahmoud Ali Trading",
                "email": "mahmoud@alitrading.com",
                "phone": "+201555666777",
                "address": "123 Commerce Street, Cairo",
                "balance": 25000.0
            }
            
            response = await self.client.post(
                f"{self.base_url}/financial/customers",
                json=customer_data,
                headers={
                    "Authorization": f"Bearer {self.test_tokens['existing_user']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Financial Customers POST", True, f"Created customer: {data.get('name')}")
            else:
                self.log_result("Financial Customers POST", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Financial Customers", False, f"Exception: {str(e)}")

        # Test Financial Suppliers
        try:
            # GET
            response = await self.client.get(
                f"{self.base_url}/financial/suppliers",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Financial Suppliers GET", True, f"Retrieved {len(data)} suppliers")
            else:
                self.log_result("Financial Suppliers GET", False, f"Expected 200, got {response.status_code}: {response.text}")
            
            # POST
            supplier_data = {
                "company_id": company_id,
                "name": "Tech Solutions Provider",
                "email": "sales@techsolutions.com",
                "phone": "+201444555666",
                "address": "456 Technology Park, Giza",
                "balance": -15000.0
            }
            
            response = await self.client.post(
                f"{self.base_url}/financial/suppliers",
                json=supplier_data,
                headers={
                    "Authorization": f"Bearer {self.test_tokens['existing_user']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Financial Suppliers POST", True, f"Created supplier: {data.get('name')}")
            else:
                self.log_result("Financial Suppliers POST", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Financial Suppliers", False, f"Exception: {str(e)}")

        # Test Financial Treasury
        try:
            # GET
            response = await self.client.get(
                f"{self.base_url}/financial/treasury",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Financial Treasury GET", True, f"Retrieved {len(data)} treasury transactions")
            else:
                self.log_result("Financial Treasury GET", False, f"Expected 200, got {response.status_code}: {response.text}")
            
            # POST
            treasury_data = {
                "company_id": company_id,
                "date": "2024-12-15",
                "description": "Cash deposit from sales",
                "type": "in",
                "amount": 50000.0
            }
            
            response = await self.client.post(
                f"{self.base_url}/financial/treasury",
                json=treasury_data,
                headers={
                    "Authorization": f"Bearer {self.test_tokens['existing_user']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Financial Treasury POST", True, f"Created treasury transaction: {data.get('description')}")
            else:
                self.log_result("Financial Treasury POST", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Financial Treasury", False, f"Exception: {str(e)}")

        # Test Financial Bank
        try:
            # GET
            response = await self.client.get(
                f"{self.base_url}/financial/bank",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Financial Bank GET", True, f"Retrieved {len(data)} bank transactions")
            else:
                self.log_result("Financial Bank GET", False, f"Expected 200, got {response.status_code}: {response.text}")
            
            # POST
            bank_data = {
                "company_id": company_id,
                "date": "2024-12-15",
                "description": "Client payment received",
                "bank_name": "National Bank of Egypt",
                "type": "deposit",
                "amount": 75000.0,
                "balance": 125000.0
            }
            
            response = await self.client.post(
                f"{self.base_url}/financial/bank",
                json=bank_data,
                headers={
                    "Authorization": f"Bearer {self.test_tokens['existing_user']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Financial Bank POST", True, f"Created bank transaction: {data.get('description')}")
            else:
                self.log_result("Financial Bank POST", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Financial Bank", False, f"Exception: {str(e)}")

    async def test_inventory_apis(self):
        """Test Inventory Management APIs"""
        if "existing_user" not in self.test_tokens:
            self.log_result("Inventory APIs", False, "No existing user token available")
            return
            
        # Test GET /api/inventory/items
        try:
            response = await self.client.get(
                f"{self.base_url}/inventory/items",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Inventory Items GET", True, f"Retrieved {len(data)} inventory items")
            else:
                self.log_result("Inventory Items GET", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Inventory Items GET", False, f"Exception: {str(e)}")
        
        # Test POST /api/inventory/items
        item_data = {
            "name": "Test Inventory Item",
            "category": "Raw Materials",
            "quantity": 100.0,
            "unit": "kg",
            "unit_price": 25.50,
            "min_stock": 20.0
        }
        
        created_item_id = None
        
        try:
            response = await self.client.post(
                f"{self.base_url}/inventory/items",
                json=item_data,
                headers={
                    "Authorization": f"Bearer {self.test_tokens['existing_user']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                created_item_id = data.get("id")
                self.log_result("Inventory Items POST", True, f"Created item: {data.get('name')}")
            else:
                self.log_result("Inventory Items POST", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Inventory Items POST", False, f"Exception: {str(e)}")
        
        # Test GET /api/inventory/items/{id}
        if created_item_id:
            try:
                response = await self.client.get(
                    f"{self.base_url}/inventory/items/{created_item_id}",
                    headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    self.log_result("Inventory Item GET by ID", True, f"Retrieved item: {data.get('name')}")
                else:
                    self.log_result("Inventory Item GET by ID", False, f"Expected 200, got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result("Inventory Item GET by ID", False, f"Exception: {str(e)}")
        
        # Test PUT /api/inventory/items/{id}
        if created_item_id:
            update_data = {
                "quantity": 75.0,
                "min_stock": 80.0
            }
            
            try:
                response = await self.client.put(
                    f"{self.base_url}/inventory/items/{created_item_id}",
                    json=update_data,
                    headers={
                        "Authorization": f"Bearer {self.test_tokens['existing_user']}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    self.log_result("Inventory Item PUT", True, f"Updated item status: {data.get('status')}")
                else:
                    self.log_result("Inventory Item PUT", False, f"Expected 200, got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result("Inventory Item PUT", False, f"Exception: {str(e)}")
        
        # Test DELETE /api/inventory/items/{id}
        if created_item_id:
            try:
                response = await self.client.delete(
                    f"{self.base_url}/inventory/items/{created_item_id}",
                    headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    self.log_result("Inventory Item DELETE", True, "Item deleted successfully")
                else:
                    self.log_result("Inventory Item DELETE", False, f"Expected 200, got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result("Inventory Item DELETE", False, f"Exception: {str(e)}")

    async def test_analytics_apis(self):
        """Test Analytics APIs"""
        if "existing_user" not in self.test_tokens:
            self.log_result("Analytics APIs", False, "No existing user token available")
            return
            
        periods = ["monthly", "daily", "yearly"]
        
        # Test Analytics Overview
        for period in periods:
            try:
                response = await self.client.get(
                    f"{self.base_url}/analytics/overview",
                    params={"period": period},
                    headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    self.log_result(f"Analytics Overview ({period})", True, f"Retrieved {period} analytics overview")
                else:
                    self.log_result(f"Analytics Overview ({period})", False, f"Expected 200, got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result(f"Analytics Overview ({period})", False, f"Exception: {str(e)}")

        # Test Analytics Financial
        try:
            response = await self.client.get(
                f"{self.base_url}/analytics/financial",
                params={"period": "monthly"},
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Analytics Financial", True, f"Retrieved financial analytics with {len(data.get('revenue_by_month', []))} revenue entries")
            else:
                self.log_result("Analytics Financial", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Analytics Financial", False, f"Exception: {str(e)}")

        # Test Analytics HR
        try:
            response = await self.client.get(
                f"{self.base_url}/analytics/hr",
                params={"period": "monthly"},
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Analytics HR", True, f"Retrieved HR analytics with {data.get('total_employees', 0)} employees")
            else:
                self.log_result("Analytics HR", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Analytics HR", False, f"Exception: {str(e)}")

        # Test Analytics Inventory
        try:
            response = await self.client.get(
                f"{self.base_url}/analytics/inventory",
                params={"period": "monthly"},
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Analytics Inventory", True, f"Retrieved inventory analytics with {data.get('total_items', 0)} items")
            else:
                self.log_result("Analytics Inventory", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Analytics Inventory", False, f"Exception: {str(e)}")

    async def run_comprehensive_validation(self):
        """Run comprehensive validation of all backend APIs"""
        print("🚀 Starting Comprehensive Backend API Validation...")
        print(f"Backend URL: {self.base_url}")
        print("Testing with existing user: test-logo@example.com")
        print("=" * 80)
        
        await self.setup()
        
        try:
            # Test API health first
            await self.test_api_health()
            
            print("\n🔐 PHASE 1: Authentication & Company Management")
            print("-" * 60)
            
            # Login with existing credentials
            await self.test_existing_user_login()
            
            # Test company management
            await self.test_company_details()
            
            print("\n👥 PHASE 2: User Management APIs")
            print("-" * 60)
            
            # Test user management with existing user
            await self.test_user_management_apis()
            
            print("\n👔 PHASE 3: HR Module APIs")
            print("-" * 60)
            
            # Test all HR APIs
            await self.test_hr_apis()
            
            print("\n💰 PHASE 4: Financial Module APIs")
            print("-" * 60)
            
            # Test all Financial APIs
            await self.test_financial_apis()
            
            print("\n📦 PHASE 5: Inventory Management APIs")
            print("-" * 60)
            
            # Test inventory APIs
            await self.test_inventory_apis()
            
            print("\n📊 PHASE 6: Analytics APIs")
            print("-" * 60)
            
            # Test analytics APIs
            await self.test_analytics_apis()
            
        finally:
            await self.cleanup()
        
        # Print summary
        print("\n" + "=" * 80)
        print("📊 COMPREHENSIVE VALIDATION SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests}")
        print(f"Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        else:
            print("\n✅ ALL TESTS PASSED - SYSTEM IS PRODUCTION READY!")
        
        return self.test_results

async def main():
    """Main test runner"""
    tester = ComprehensiveAPITester()
    results = await tester.run_comprehensive_validation()
    
    # Return exit code based on test results
    failed_count = sum(1 for result in results if not result["success"])
    return 0 if failed_count == 0 else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)