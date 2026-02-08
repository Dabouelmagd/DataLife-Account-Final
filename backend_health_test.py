#!/usr/bin/env python3
"""
Backend API Health Check
Quick health check for all backend endpoints using existing test user.
"""

import asyncio
import httpx
import json
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = "https://erp-debug-2.preview.emergentagent.com/api"

# Test user credentials from review request
TEST_USER = {
    "email": "test-logo@example.com",
    "password": "testpass123"
}

class BackendHealthChecker:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.client = None
        self.test_results = []
        self.auth_token = None
        self.company_id = None
        
    async def setup(self):
        """Setup HTTP client"""
        self.client = httpx.AsyncClient(timeout=30.0)
        
    async def cleanup(self):
        """Cleanup HTTP client"""
        if self.client:
            await self.client.aclose()
    
    def log_result(self, test_name: str, success: bool, details: str = "", response_data: any = None):
        """Log test result"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        if response_data and not success:
            print(f"   Response: {response_data}")
    
    async def test_login(self):
        """Test login with existing user"""
        login_data = {
            "email": TEST_USER["email"],
            "password": TEST_USER["password"]
        }
        
        try:
            response = await self.client.post(
                f"{self.base_url}/auth/login",
                json=login_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ["access_token", "token_type", "user"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("POST /api/auth/login", False, 
                                  f"Missing required fields: {missing_fields}", data)
                    return False
                
                # Store auth token and company_id for subsequent tests
                self.auth_token = data["access_token"]
                user_data = data.get("user", {})
                self.company_id = user_data.get("company_id")
                
                if not self.company_id:
                    self.log_result("POST /api/auth/login", False, 
                                  "No company_id in user data", data)
                    return False
                
                self.log_result("POST /api/auth/login", True, 
                              f"Login successful, company_id: {self.company_id}")
                return True
            else:
                self.log_result("POST /api/auth/login", False, 
                              f"Status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("POST /api/auth/login", False, f"Exception: {str(e)}")
            return False

    async def test_verify_token(self):
        """Test token verification"""
        if not self.auth_token:
            self.log_result("GET /api/auth/verify", False, "No auth token available")
            return False
            
        try:
            response = await self.client.get(
                f"{self.base_url}/auth/verify",
                headers={"Authorization": f"Bearer {self.auth_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ["id", "email", "full_name", "company_id", "role", "is_active"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("GET /api/auth/verify", False, 
                                  f"Missing required fields: {missing_fields}", data)
                    return False
                
                if data.get("email") != TEST_USER["email"]:
                    self.log_result("GET /api/auth/verify", False, 
                                  f"Email mismatch: expected {TEST_USER['email']}, got {data.get('email')}")
                    return False
                
                self.log_result("GET /api/auth/verify", True, 
                              f"Token verification successful for {data.get('email')}")
                return True
            else:
                self.log_result("GET /api/auth/verify", False, 
                              f"Status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("GET /api/auth/verify", False, f"Exception: {str(e)}")
            return False

    async def test_get_company(self):
        """Test getting company details"""
        if not self.auth_token or not self.company_id:
            self.log_result("GET /api/companies/{company_id}", False, "No auth token or company_id available")
            return False
            
        try:
            response = await self.client.get(
                f"{self.base_url}/companies/{self.company_id}",
                headers={"Authorization": f"Bearer {self.auth_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ["id", "name", "industry", "contact_email", "subscription_status"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("GET /api/companies/{company_id}", False, 
                                  f"Missing required fields: {missing_fields}", data)
                    return False
                
                if data.get("id") != self.company_id:
                    self.log_result("GET /api/companies/{company_id}", False, 
                                  f"Company ID mismatch: expected {self.company_id}, got {data.get('id')}")
                    return False
                
                self.log_result("GET /api/companies/{company_id}", True, 
                              f"Company details retrieved: {data.get('name')}")
                return True
            else:
                self.log_result("GET /api/companies/{company_id}", False, 
                              f"Status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("GET /api/companies/{company_id}", False, f"Exception: {str(e)}")
            return False

    async def test_hr_employees(self):
        """Test HR employees endpoint"""
        if not self.auth_token:
            self.log_result("GET /api/hr/employees", False, "No auth token available")
            return False
            
        try:
            response = await self.client.get(
                f"{self.base_url}/hr/employees",
                headers={"Authorization": f"Bearer {self.auth_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    self.log_result("GET /api/hr/employees", False, 
                                  f"Expected list, got {type(data)}")
                    return False
                
                # Check that all employees belong to the same company
                if data:
                    company_ids = set(emp.get("company_id") for emp in data)
                    if len(company_ids) > 1:
                        self.log_result("GET /api/hr/employees", False, 
                                      f"Data contains employees from multiple companies: {company_ids}")
                        return False
                    
                    if self.company_id not in company_ids:
                        self.log_result("GET /api/hr/employees", False, 
                                      f"Data doesn't contain current company employees")
                        return False
                
                self.log_result("GET /api/hr/employees", True, 
                              f"Retrieved {len(data)} employees with proper company isolation")
                return True
            else:
                self.log_result("GET /api/hr/employees", False, 
                              f"Status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("GET /api/hr/employees", False, f"Exception: {str(e)}")
            return False

    async def test_hr_allowances(self):
        """Test HR allowances endpoint"""
        if not self.auth_token:
            self.log_result("GET /api/hr/allowances", False, "No auth token available")
            return False
            
        try:
            response = await self.client.get(
                f"{self.base_url}/hr/allowances",
                headers={"Authorization": f"Bearer {self.auth_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    self.log_result("GET /api/hr/allowances", False, 
                                  f"Expected list, got {type(data)}")
                    return False
                
                # Check company isolation
                if data:
                    company_ids = set(allow.get("company_id") for allow in data)
                    if len(company_ids) > 1:
                        self.log_result("GET /api/hr/allowances", False, 
                                      f"Data contains allowances from multiple companies: {company_ids}")
                        return False
                    
                    if self.company_id not in company_ids:
                        self.log_result("GET /api/hr/allowances", False, 
                                      f"Data doesn't contain current company allowances")
                        return False
                
                self.log_result("GET /api/hr/allowances", True, 
                              f"Retrieved {len(data)} allowances with proper company isolation")
                return True
            else:
                self.log_result("GET /api/hr/allowances", False, 
                              f"Status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("GET /api/hr/allowances", False, f"Exception: {str(e)}")
            return False

    async def test_hr_deductions(self):
        """Test HR deductions endpoint"""
        if not self.auth_token:
            self.log_result("GET /api/hr/deductions", False, "No auth token available")
            return False
            
        try:
            response = await self.client.get(
                f"{self.base_url}/hr/deductions",
                headers={"Authorization": f"Bearer {self.auth_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    self.log_result("GET /api/hr/deductions", False, 
                                  f"Expected list, got {type(data)}")
                    return False
                
                # Check company isolation
                if data:
                    company_ids = set(ded.get("company_id") for ded in data)
                    if len(company_ids) > 1:
                        self.log_result("GET /api/hr/deductions", False, 
                                      f"Data contains deductions from multiple companies: {company_ids}")
                        return False
                    
                    if self.company_id not in company_ids:
                        self.log_result("GET /api/hr/deductions", False, 
                                      f"Data doesn't contain current company deductions")
                        return False
                
                self.log_result("GET /api/hr/deductions", True, 
                              f"Retrieved {len(data)} deductions with proper company isolation")
                return True
            else:
                self.log_result("GET /api/hr/deductions", False, 
                              f"Status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("GET /api/hr/deductions", False, f"Exception: {str(e)}")
            return False

    async def test_financial_customers(self):
        """Test Financial customers endpoint"""
        if not self.auth_token:
            self.log_result("GET /api/financial/customers", False, "No auth token available")
            return False
            
        try:
            response = await self.client.get(
                f"{self.base_url}/financial/customers",
                headers={"Authorization": f"Bearer {self.auth_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    self.log_result("GET /api/financial/customers", False, 
                                  f"Expected list, got {type(data)}")
                    return False
                
                # Check company isolation
                if data:
                    company_ids = set(cust.get("company_id") for cust in data)
                    if len(company_ids) > 1:
                        self.log_result("GET /api/financial/customers", False, 
                                      f"Data contains customers from multiple companies: {company_ids}")
                        return False
                    
                    if self.company_id not in company_ids:
                        self.log_result("GET /api/financial/customers", False, 
                                      f"Data doesn't contain current company customers")
                        return False
                
                self.log_result("GET /api/financial/customers", True, 
                              f"Retrieved {len(data)} customers with proper company isolation")
                return True
            else:
                self.log_result("GET /api/financial/customers", False, 
                              f"Status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("GET /api/financial/customers", False, f"Exception: {str(e)}")
            return False

    async def test_financial_suppliers(self):
        """Test Financial suppliers endpoint"""
        if not self.auth_token:
            self.log_result("GET /api/financial/suppliers", False, "No auth token available")
            return False
            
        try:
            response = await self.client.get(
                f"{self.base_url}/financial/suppliers",
                headers={"Authorization": f"Bearer {self.auth_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    self.log_result("GET /api/financial/suppliers", False, 
                                  f"Expected list, got {type(data)}")
                    return False
                
                # Check company isolation
                if data:
                    company_ids = set(supp.get("company_id") for supp in data)
                    if len(company_ids) > 1:
                        self.log_result("GET /api/financial/suppliers", False, 
                                      f"Data contains suppliers from multiple companies: {company_ids}")
                        return False
                    
                    if self.company_id not in company_ids:
                        self.log_result("GET /api/financial/suppliers", False, 
                                      f"Data doesn't contain current company suppliers")
                        return False
                
                self.log_result("GET /api/financial/suppliers", True, 
                              f"Retrieved {len(data)} suppliers with proper company isolation")
                return True
            else:
                self.log_result("GET /api/financial/suppliers", False, 
                              f"Status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("GET /api/financial/suppliers", False, f"Exception: {str(e)}")
            return False

    async def test_financial_journal_entries(self):
        """Test Financial journal entries endpoint"""
        if not self.auth_token:
            self.log_result("GET /api/financial/journal-entries", False, "No auth token available")
            return False
            
        try:
            response = await self.client.get(
                f"{self.base_url}/financial/journal-entries",
                headers={"Authorization": f"Bearer {self.auth_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    self.log_result("GET /api/financial/journal-entries", False, 
                                  f"Expected list, got {type(data)}")
                    return False
                
                # Check company isolation
                if data:
                    company_ids = set(entry.get("company_id") for entry in data)
                    if len(company_ids) > 1:
                        self.log_result("GET /api/financial/journal-entries", False, 
                                      f"Data contains journal entries from multiple companies: {company_ids}")
                        return False
                    
                    if self.company_id not in company_ids:
                        self.log_result("GET /api/financial/journal-entries", False, 
                                      f"Data doesn't contain current company journal entries")
                        return False
                
                self.log_result("GET /api/financial/journal-entries", True, 
                              f"Retrieved {len(data)} journal entries with proper company isolation")
                return True
            else:
                self.log_result("GET /api/financial/journal-entries", False, 
                              f"Status {response.status_code}", response.text)
                return False
                
        except Exception as e:
            self.log_result("GET /api/financial/journal-entries", False, f"Exception: {str(e)}")
            return False

    async def run_health_check(self):
        """Run all health check tests"""
        print("🔍 Starting Backend API Health Check...")
        print(f"Backend URL: {self.base_url}")
        print(f"Test User: {TEST_USER['email']}")
        print("=" * 60)
        
        await self.setup()
        
        try:
            # Authentication tests
            print("\n📋 AUTHENTICATION APIs")
            login_success = await self.test_login()
            if login_success:
                await self.test_verify_token()
            
            # Company API test
            print("\n🏢 COMPANY APIs")
            await self.test_get_company()
            
            # HR API tests
            print("\n👥 HR APIs")
            await self.test_hr_employees()
            await self.test_hr_allowances()
            await self.test_hr_deductions()
            
            # Financial API tests
            print("\n💰 FINANCIAL APIs")
            await self.test_financial_customers()
            await self.test_financial_suppliers()
            await self.test_financial_journal_entries()
            
        finally:
            await self.cleanup()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 HEALTH CHECK SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['details']}")
        
        return failed_tests == 0

async def main():
    """Main function"""
    checker = BackendHealthChecker()
    success = await checker.run_health_check()
    
    if success:
        print("\n🎉 All backend APIs are healthy!")
        return 0
    else:
        print("\n⚠️  Some backend APIs have issues!")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)