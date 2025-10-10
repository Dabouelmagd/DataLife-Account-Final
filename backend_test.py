#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for RBAC System
Tests the Authentication, User Management, and Company APIs with comprehensive validation.
"""

import asyncio
import httpx
import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Get backend URL from environment
BACKEND_URL = "https://finance-hr-demo.preview.emergentagent.com/api"

class RBACAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.client = None
        self.test_results = []
        self.test_tokens = {}  # Store tokens for different users
        self.test_users = {}   # Store user data
        self.test_company = None
        
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
    
    async def test_company_registration(self):
        """Test company registration with user creation"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Company data
        company_data = {
            "name": "Test Company",
            "industry": "Technology", 
            "size": "Small (1-50)",
            "contact_email": f"test.{timestamp}@company.com",
            "phone": "+201234567890"
        }
        
        # User data
        user_email = f"admin.{timestamp}@company.com"
        user_password = "password123"
        user_full_name = "Admin User"
        
        try:
            response = await self.client.post(
                f"{self.base_url}/auth/register-company",
                json=company_data,
                params={
                    "user_email": user_email,
                    "user_password": user_password,
                    "user_full_name": user_full_name
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ["access_token", "token_type", "user"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("Company Registration", False, 
                                  f"Missing required fields: {missing_fields}", data)
                    return None
                
                # Validate user data
                user_data = data.get("user", {})
                if user_data.get("email") != user_email:
                    self.log_result("Company Registration", False, 
                                  f"Email mismatch: expected {user_email}, got {user_data.get('email')}", data)
                    return None
                
                if user_data.get("role") != "General Manager":
                    self.log_result("Company Registration", False, 
                                  f"Expected role 'General Manager', got '{user_data.get('role')}'", data)
                    return None
                
                # Store for later tests
                self.test_tokens["admin"] = data["access_token"]
                self.test_users["admin"] = user_data
                self.test_company = {
                    "id": user_data.get("company_id"),
                    "email": user_email,
                    "password": user_password
                }
                
                self.log_result("Company Registration", True, 
                              f"Company and admin user created successfully", data)
                return data
            else:
                self.log_result("Company Registration", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Company Registration", False, f"Exception: {str(e)}")
            return None
    
    async def test_create_trial_duplicate_email(self):
        """Test trial creation with duplicate email"""
        duplicate_email = "duplicate.test@techcorp.com"
        
        # First, create a trial
        first_trial_data = {
            "email": duplicate_email,
            "first_name": "John",
            "last_name": "Doe",
            "company_name": "First Company"
        }
        
        try:
            # Create first trial
            first_response = await self.client.post(
                f"{self.base_url}/trials/",
                json=first_trial_data,
                headers={"Content-Type": "application/json"}
            )
            
            # Now try to create duplicate
            second_trial_data = {
                "email": duplicate_email,
                "first_name": "Jane",
                "last_name": "Smith", 
                "company_name": "Second Company"
            }
            
            second_response = await self.client.post(
                f"{self.base_url}/trials/",
                json=second_trial_data,
                headers={"Content-Type": "application/json"}
            )
            
            if second_response.status_code == 400:
                data = second_response.json()
                if "active trial already exists" in data.get("detail", "").lower():
                    self.log_result("Create Trial - Duplicate Email", True, 
                                  "Correctly rejected duplicate email", data)
                else:
                    self.log_result("Create Trial - Duplicate Email", False, 
                                  f"Wrong error message: {data.get('detail')}", data)
            else:
                self.log_result("Create Trial - Duplicate Email", False, 
                              f"Expected 400, got {second_response.status_code}", second_response.text)
                
        except Exception as e:
            self.log_result("Create Trial - Duplicate Email", False, f"Exception: {str(e)}")
    
    async def test_create_trial_invalid_email(self):
        """Test trial creation with invalid email"""
        test_data = {
            "email": "invalid-email",
            "first_name": "Test",
            "last_name": "User",
            "company_name": "Test Company"
        }
        
        try:
            response = await self.client.post(
                f"{self.base_url}/trials/",
                json=test_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 422:  # Validation error
                self.log_result("Create Trial - Invalid Email", True, 
                              "Correctly rejected invalid email format")
            else:
                self.log_result("Create Trial - Invalid Email", False, 
                              f"Expected 422, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Create Trial - Invalid Email", False, f"Exception: {str(e)}")
    
    async def test_create_trial_missing_required_fields(self):
        """Test trial creation with missing required fields"""
        test_data = {
            "email": "incomplete@test.com"
            # Missing first_name, last_name, company_name
        }
        
        try:
            response = await self.client.post(
                f"{self.base_url}/trials/",
                json=test_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 422:  # Validation error
                self.log_result("Create Trial - Missing Fields", True, 
                              "Correctly rejected missing required fields")
            else:
                self.log_result("Create Trial - Missing Fields", False, 
                              f"Expected 422, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Create Trial - Missing Fields", False, f"Exception: {str(e)}")
    
    async def test_get_trial_by_email(self, trial_email: str = "sarah.johnson@techcorp.com"):
        """Test getting trial by email"""
        try:
            response = await self.client.get(f"{self.base_url}/trials/customer/{trial_email}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("email") == trial_email:
                    self.log_result("Get Trial by Email", True, 
                                  f"Successfully retrieved trial for {trial_email}", data)
                    return data
                else:
                    self.log_result("Get Trial by Email", False, 
                                  f"Email mismatch in response", data)
            elif response.status_code == 404:
                self.log_result("Get Trial by Email", False, 
                              f"Trial not found for {trial_email}", response.text)
            else:
                self.log_result("Get Trial by Email", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Get Trial by Email", False, f"Exception: {str(e)}")
        
        return None
    
    async def test_get_trial_by_id(self, trial_id: str):
        """Test getting trial by ID"""
        try:
            response = await self.client.get(f"{self.base_url}/trials/{trial_id}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("id") == trial_id:
                    self.log_result("Get Trial by ID", True, 
                                  f"Successfully retrieved trial {trial_id}", data)
                    return data
                else:
                    self.log_result("Get Trial by ID", False, 
                                  f"ID mismatch in response", data)
            elif response.status_code == 404:
                self.log_result("Get Trial by ID", False, 
                              f"Trial not found for ID {trial_id}", response.text)
            else:
                self.log_result("Get Trial by ID", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Get Trial by ID", False, f"Exception: {str(e)}")
        
        return None
    
    async def test_get_trial_progress(self, trial_id: str):
        """Test getting trial progress"""
        try:
            response = await self.client.get(f"{self.base_url}/trials/{trial_id}/progress")
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["trial_id", "days_remaining", "usage_percentage", "onboarding_progress"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("Get Trial Progress", False, 
                                  f"Missing required fields: {missing_fields}", data)
                else:
                    self.log_result("Get Trial Progress", True, 
                                  f"Successfully retrieved progress for trial {trial_id}", data)
                    return data
            elif response.status_code == 404:
                self.log_result("Get Trial Progress", False, 
                              f"Trial not found for progress check", response.text)
            else:
                self.log_result("Get Trial Progress", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Get Trial Progress", False, f"Exception: {str(e)}")
        
        return None
    
    async def test_track_trial_usage(self, trial_id: str):
        """Test tracking trial usage"""
        try:
            response = await self.client.post(
                f"{self.base_url}/trials/{trial_id}/track-usage",
                params={"action": "login", "details": {"source": "web_app"}}
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "success":
                    self.log_result("Track Trial Usage", True, 
                                  f"Successfully tracked usage for trial {trial_id}", data)
                else:
                    self.log_result("Track Trial Usage", False, 
                                  f"Unexpected response format", data)
            else:
                self.log_result("Track Trial Usage", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Track Trial Usage", False, f"Exception: {str(e)}")
    
    async def test_cors_headers(self):
        """Test CORS headers"""
        try:
            response = await self.client.options(f"{self.base_url}/trials/")
            
            cors_headers = [
                "access-control-allow-origin",
                "access-control-allow-methods", 
                "access-control-allow-headers"
            ]
            
            missing_headers = []
            for header in cors_headers:
                if header not in response.headers:
                    missing_headers.append(header)
            
            if not missing_headers:
                self.log_result("CORS Headers", True, "All required CORS headers present")
            else:
                self.log_result("CORS Headers", False, f"Missing CORS headers: {missing_headers}")
                
        except Exception as e:
            self.log_result("CORS Headers", False, f"Exception: {str(e)}")
    
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
    
    async def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Free Trial API Tests...")
        print(f"Backend URL: {self.base_url}")
        print("=" * 60)
        
        await self.setup()
        
        try:
            # Test API health first
            await self.test_api_health()
            
            # Test CORS
            await self.test_cors_headers()
            
            # Test trial creation with valid data
            trial_data = await self.test_create_trial_success()
            
            # Test validation errors
            await self.test_create_trial_invalid_email()
            await self.test_create_trial_missing_required_fields()
            await self.test_create_trial_duplicate_email()
            
            # Test retrieval endpoints if trial was created
            if trial_data:
                trial_id = trial_data.get("id")
                trial_email = trial_data.get("email")
                
                if trial_id:
                    await self.test_get_trial_by_id(trial_id)
                    await self.test_get_trial_progress(trial_id)
                    await self.test_track_trial_usage(trial_id)
                
                if trial_email:
                    await self.test_get_trial_by_email(trial_email)
            
        finally:
            await self.cleanup()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
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
        
        return self.test_results

async def main():
    """Main test runner"""
    tester = TrialAPITester()
    results = await tester.run_all_tests()
    
    # Return exit code based on test results
    failed_count = sum(1 for result in results if not result["success"])
    return 0 if failed_count == 0 else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)