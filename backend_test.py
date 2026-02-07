#!/usr/bin/env python3
"""
Comprehensive Multi-Tenant Backend API Testing
Tests the complete multi-tenant SaaS backend with HR and Financial data APIs.
Verifies company data isolation, RBAC enforcement, authentication requirements, and data persistence.
"""

import asyncio
import httpx
import json
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# Get backend URL from environment
BACKEND_URL = "https://erp-bugfix-9.preview.emergentagent.com/api"

class MultiTenantAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.client = None
        self.test_results = []
        self.test_tokens = {}  # Store tokens for different users
        self.test_users = {}   # Store user data
        self.test_companies = {}  # Store multiple companies for multi-tenant testing
        self.test_data = {}  # Store created test data for isolation testing
        
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
                
                # Store for later tests (backward compatibility)
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

    async def test_duplicate_company_registration(self):
        """Test duplicate company registration should fail"""
        if not self.test_company:
            self.log_result("Duplicate Company Registration", False, "No test company data available")
            return
            
        # Try to register same company again
        company_data = {
            "name": "Test Company Duplicate",
            "industry": "Technology", 
            "size": "Medium (51-200)",
            "contact_email": self.test_company["email"].replace("admin", "test"),  # Same company email
            "phone": "+201234567891"
        }
        
        try:
            response = await self.client.post(
                f"{self.base_url}/auth/register-company",
                json=company_data,
                params={
                    "user_email": "duplicate@company.com",
                    "user_password": "password123",
                    "user_full_name": "Duplicate User"
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 400:
                data = response.json()
                if "already exists" in data.get("detail", "").lower():
                    self.log_result("Duplicate Company Registration", True, 
                                  "Correctly rejected duplicate company", data)
                else:
                    self.log_result("Duplicate Company Registration", False, 
                                  f"Wrong error message: {data.get('detail')}", data)
            else:
                self.log_result("Duplicate Company Registration", False, 
                              f"Expected 400, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Duplicate Company Registration", False, f"Exception: {str(e)}")

    async def test_duplicate_user_registration(self):
        """Test duplicate user email should fail"""
        if not self.test_company:
            self.log_result("Duplicate User Registration", False, "No test company data available")
            return
            
        # Try to register with same user email
        company_data = {
            "name": "Another Company",
            "industry": "Finance", 
            "size": "Large (201+)",
            "contact_email": "another@company.com",
            "phone": "+201234567892"
        }
        
        try:
            response = await self.client.post(
                f"{self.base_url}/auth/register-company",
                json=company_data,
                params={
                    "user_email": self.test_company["email"],  # Same user email
                    "user_password": "password123",
                    "user_full_name": "Another User"
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 400:
                data = response.json()
                if "user" in data.get("detail", "").lower() and "already exists" in data.get("detail", "").lower():
                    self.log_result("Duplicate User Registration", True, 
                                  "Correctly rejected duplicate user email", data)
                else:
                    self.log_result("Duplicate User Registration", False, 
                                  f"Wrong error message: {data.get('detail')}", data)
            else:
                self.log_result("Duplicate User Registration", False, 
                              f"Expected 400, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Duplicate User Registration", False, f"Exception: {str(e)}")

    async def test_login_success(self):
        """Test successful login"""
        if not self.test_company:
            self.log_result("Login Success", False, "No test company data available")
            return None
            
        login_data = {
            "email": self.test_company["email"],
            "password": self.test_company["password"]
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
                    self.log_result("Login Success", False, 
                                  f"Missing required fields: {missing_fields}", data)
                    return None
                
                # Validate user data
                user_data = data.get("user", {})
                if user_data.get("email") != login_data["email"]:
                    self.log_result("Login Success", False, 
                                  f"Email mismatch: expected {login_data['email']}, got {user_data.get('email')}", data)
                    return None
                
                self.log_result("Login Success", True, 
                              f"Login successful for {user_data.get('email')}", data)
                return data
            else:
                self.log_result("Login Success", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Login Success", False, f"Exception: {str(e)}")
            return None

    async def test_login_invalid_email(self):
        """Test login with invalid email"""
        login_data = {
            "email": "nonexistent@company.com",
            "password": "password123"
        }
        
        try:
            response = await self.client.post(
                f"{self.base_url}/auth/login",
                json=login_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 401:
                data = response.json()
                if "invalid" in data.get("detail", "").lower():
                    self.log_result("Login Invalid Email", True, 
                                  "Correctly rejected invalid email", data)
                else:
                    self.log_result("Login Invalid Email", False, 
                                  f"Wrong error message: {data.get('detail')}", data)
            else:
                self.log_result("Login Invalid Email", False, 
                              f"Expected 401, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Login Invalid Email", False, f"Exception: {str(e)}")

    async def test_login_wrong_password(self):
        """Test login with wrong password"""
        if not self.test_company:
            self.log_result("Login Wrong Password", False, "No test company data available")
            return
            
        login_data = {
            "email": self.test_company["email"],
            "password": "wrongpassword"
        }
        
        try:
            response = await self.client.post(
                f"{self.base_url}/auth/login",
                json=login_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 401:
                data = response.json()
                if "invalid" in data.get("detail", "").lower():
                    self.log_result("Login Wrong Password", True, 
                                  "Correctly rejected wrong password", data)
                else:
                    self.log_result("Login Wrong Password", False, 
                                  f"Wrong error message: {data.get('detail')}", data)
            else:
                self.log_result("Login Wrong Password", False, 
                              f"Expected 401, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Login Wrong Password", False, f"Exception: {str(e)}")

    async def test_token_verification_valid(self):
        """Test token verification with valid token"""
        if "admin" not in self.test_tokens:
            self.log_result("Token Verification Valid", False, "No admin token available")
            return
            
        try:
            response = await self.client.get(
                f"{self.base_url}/auth/verify",
                headers={"Authorization": f"Bearer {self.test_tokens['admin']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ["id", "email", "full_name", "company_id", "role", "is_active"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("Token Verification Valid", False, 
                                  f"Missing required fields: {missing_fields}", data)
                    return None
                
                if data.get("email") != self.test_company["email"]:
                    self.log_result("Token Verification Valid", False, 
                                  f"Email mismatch in token verification", data)
                    return None
                
                self.log_result("Token Verification Valid", True, 
                              f"Token verification successful for {data.get('email')}", data)
                return data
            else:
                self.log_result("Token Verification Valid", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Token Verification Valid", False, f"Exception: {str(e)}")
            return None

    async def test_token_verification_invalid(self):
        """Test token verification with invalid token"""
        try:
            response = await self.client.get(
                f"{self.base_url}/auth/verify",
                headers={"Authorization": "Bearer invalid_token_here"}
            )
            
            if response.status_code == 401:
                self.log_result("Token Verification Invalid", True, 
                              "Correctly rejected invalid token")
            else:
                self.log_result("Token Verification Invalid", False, 
                              f"Expected 401, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Token Verification Invalid", False, f"Exception: {str(e)}")

    async def test_token_verification_missing_header(self):
        """Test token verification with missing Authorization header"""
        try:
            response = await self.client.get(f"{self.base_url}/auth/verify")
            
            if response.status_code == 401:
                data = response.json()
                if "authorization header missing" in data.get("detail", "").lower():
                    self.log_result("Token Verification Missing Header", True, 
                                  "Correctly rejected missing header", data)
                else:
                    self.log_result("Token Verification Missing Header", False, 
                                  f"Wrong error message: {data.get('detail')}", data)
            else:
                self.log_result("Token Verification Missing Header", False, 
                              f"Expected 401, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Token Verification Missing Header", False, f"Exception: {str(e)}")

    async def test_password_reset_valid_email(self):
        """Test password reset with valid email (NEW FEATURE)"""
        # Use the test user email from review request
        test_email = "dalia.abouelmagd@gmail.com"
        
        try:
            response = await self.client.post(
                f"{self.base_url}/auth/reset-password",
                json={"email": test_email},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ["message", "message_ar", "email"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("Password Reset Valid Email", False, 
                                  f"Missing required fields: {missing_fields}", data)
                    return None
                
                if data.get("email") != test_email:
                    self.log_result("Password Reset Valid Email", False, 
                                  f"Email mismatch: expected {test_email}, got {data.get('email')}", data)
                    return None
                
                # Check if password was provided (fallback case) or email was sent
                if "new_password" in data:
                    self.log_result("Password Reset Valid Email", True, 
                                  f"Password reset successful with fallback password: {data.get('new_password')}", data)
                else:
                    self.log_result("Password Reset Valid Email", True, 
                                  "Password reset successful, new password sent via email", data)
                
                return data
            elif response.status_code == 404:
                data = response.json()
                if "not found" in data.get("detail", "").lower():
                    self.log_result("Password Reset Valid Email", False, 
                                  f"User {test_email} not found in database. Need to create test user first.", data)
                else:
                    self.log_result("Password Reset Valid Email", False, 
                                  f"Unexpected 404 error: {data.get('detail')}", data)
                return None
            else:
                self.log_result("Password Reset Valid Email", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Password Reset Valid Email", False, f"Exception: {str(e)}")
            return None

    async def test_password_reset_invalid_email(self):
        """Test password reset with non-existent email"""
        invalid_email = "nonexistent@example.com"
        
        try:
            response = await self.client.post(
                f"{self.base_url}/auth/reset-password",
                json={"email": invalid_email},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 404:
                data = response.json()
                if "not found" in data.get("detail", "").lower():
                    self.log_result("Password Reset Invalid Email", True, 
                                  "Correctly rejected non-existent email", data)
                else:
                    self.log_result("Password Reset Invalid Email", False, 
                                  f"Wrong error message: {data.get('detail')}", data)
            else:
                self.log_result("Password Reset Invalid Email", False, 
                              f"Expected 404, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Password Reset Invalid Email", False, f"Exception: {str(e)}")

    async def test_password_reset_missing_email(self):
        """Test password reset with missing email field"""
        try:
            response = await self.client.post(
                f"{self.base_url}/auth/reset-password",
                json={},
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 400:
                data = response.json()
                if "email is required" in data.get("detail", "").lower():
                    self.log_result("Password Reset Missing Email", True, 
                                  "Correctly rejected missing email", data)
                else:
                    self.log_result("Password Reset Missing Email", False, 
                                  f"Wrong error message: {data.get('detail')}", data)
            else:
                self.log_result("Password Reset Missing Email", False, 
                              f"Expected 400, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Password Reset Missing Email", False, f"Exception: {str(e)}")

    async def test_login_with_reset_password(self):
        """Test login with password after reset (if reset was successful)"""
        if not hasattr(self, 'reset_password_data') or not self.reset_password_data:
            self.log_result("Login with Reset Password", False, "No reset password data available")
            return
            
        reset_data = self.reset_password_data
        if "new_password" not in reset_data:
            self.log_result("Login with Reset Password", False, "No new password in reset data")
            return
            
        login_data = {
            "email": reset_data["email"],
            "password": reset_data["new_password"]
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
                    self.log_result("Login with Reset Password", False, 
                                  f"Missing required fields: {missing_fields}", data)
                    return None
                
                self.log_result("Login with Reset Password", True, 
                              f"Successfully logged in with reset password", data)
                return data
            else:
                self.log_result("Login with Reset Password", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Login with Reset Password", False, f"Exception: {str(e)}")
            return None

    async def test_list_users(self):
        """Test listing users in company"""
        if "admin" not in self.test_tokens:
            self.log_result("List Users", False, "No admin token available")
            return None
            
        try:
            response = await self.client.get(
                f"{self.base_url}/users",
                headers={"Authorization": f"Bearer {self.test_tokens['admin']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    self.log_result("List Users", False, 
                                  f"Expected list, got {type(data)}", data)
                    return None
                
                if len(data) < 1:
                    self.log_result("List Users", False, 
                                  "Expected at least 1 user (admin)", data)
                    return None
                
                # Check if admin user is in the list
                admin_found = False
                for user in data:
                    if user.get("email") == self.test_company["email"]:
                        admin_found = True
                        break
                
                if not admin_found:
                    self.log_result("List Users", False, 
                                  "Admin user not found in user list", data)
                    return None
                
                self.log_result("List Users", True, 
                              f"Successfully retrieved {len(data)} users", data)
                return data
            else:
                self.log_result("List Users", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("List Users", False, f"Exception: {str(e)}")
            return None

    async def test_add_hr_manager(self):
        """Test adding HR Manager user"""
        if "admin" not in self.test_tokens:
            self.log_result("Add HR Manager", False, "No admin token available")
            return None
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        user_data = {
            "email": f"hr.{timestamp}@company.com",
            "full_name": "HR Manager User",
            "role": "HR Manager",
            "password": "password123"
        }
        
        try:
            response = await self.client.post(
                f"{self.base_url}/users",
                json=user_data,
                headers={
                    "Authorization": f"Bearer {self.test_tokens['admin']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ["id", "email", "full_name", "company_id", "role", "is_active"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("Add HR Manager", False, 
                                  f"Missing required fields: {missing_fields}", data)
                    return None
                
                if data.get("email") != user_data["email"]:
                    self.log_result("Add HR Manager", False, 
                                  f"Email mismatch: expected {user_data['email']}, got {data.get('email')}", data)
                    return None
                
                if data.get("role") != "HR Manager":
                    self.log_result("Add HR Manager", False, 
                                  f"Role mismatch: expected 'HR Manager', got {data.get('role')}", data)
                    return None
                
                # Store HR manager data for later tests
                self.test_users["hr"] = data
                
                self.log_result("Add HR Manager", True, 
                              f"HR Manager created successfully: {data.get('email')}", data)
                return data
            else:
                self.log_result("Add HR Manager", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Add HR Manager", False, f"Exception: {str(e)}")
            return None

    async def test_add_financial_manager(self):
        """Test adding Financial Manager user"""
        if "admin" not in self.test_tokens:
            self.log_result("Add Financial Manager", False, "No admin token available")
            return None
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        user_data = {
            "email": f"finance.{timestamp}@company.com",
            "full_name": "Financial Manager User",
            "role": "Financial Manager",
            "password": "password123"
        }
        
        try:
            response = await self.client.post(
                f"{self.base_url}/users",
                json=user_data,
                headers={
                    "Authorization": f"Bearer {self.test_tokens['admin']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("role") != "Financial Manager":
                    self.log_result("Add Financial Manager", False, 
                                  f"Role mismatch: expected 'Financial Manager', got {data.get('role')}", data)
                    return None
                
                # Store Financial manager data for later tests
                self.test_users["finance"] = data
                
                self.log_result("Add Financial Manager", True, 
                              f"Financial Manager created successfully: {data.get('email')}", data)
                return data
            else:
                self.log_result("Add Financial Manager", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Add Financial Manager", False, f"Exception: {str(e)}")
            return None

    async def test_add_accountant(self):
        """Test adding Accountant user"""
        if "admin" not in self.test_tokens:
            self.log_result("Add Accountant", False, "No admin token available")
            return None
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        user_data = {
            "email": f"accountant.{timestamp}@company.com",
            "full_name": "Accountant User",
            "role": "Accountant",
            "password": "password123"
        }
        
        try:
            response = await self.client.post(
                f"{self.base_url}/users",
                json=user_data,
                headers={
                    "Authorization": f"Bearer {self.test_tokens['admin']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("role") != "Accountant":
                    self.log_result("Add Accountant", False, 
                                  f"Role mismatch: expected 'Accountant', got {data.get('role')}", data)
                    return None
                
                # Store Accountant data for later tests
                self.test_users["accountant"] = data
                
                self.log_result("Add Accountant", True, 
                              f"Accountant created successfully: {data.get('email')}", data)
                return data
            else:
                self.log_result("Add Accountant", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Add Accountant", False, f"Exception: {str(e)}")
            return None

    async def test_permission_denied_non_admin(self):
        """Test that non-General Manager cannot add users"""
        # First, login as HR Manager if we have one
        if "hr" not in self.test_users:
            self.log_result("Permission Denied Non-Admin", False, "No HR user available for testing")
            return
            
        # Login as HR Manager
        hr_email = self.test_users["hr"]["email"]
        login_data = {
            "email": hr_email,
            "password": "password123"
        }
        
        try:
            login_response = await self.client.post(
                f"{self.base_url}/auth/login",
                json=login_data,
                headers={"Content-Type": "application/json"}
            )
            
            if login_response.status_code != 200:
                self.log_result("Permission Denied Non-Admin", False, 
                              f"Could not login as HR Manager: {login_response.status_code}")
                return
                
            hr_token = login_response.json()["access_token"]
            
            # Try to add user as HR Manager (should fail)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            user_data = {
                "email": f"test.{timestamp}@company.com",
                "full_name": "Test User",
                "role": "Accountant",
                "password": "password123"
            }
            
            response = await self.client.post(
                f"{self.base_url}/users",
                json=user_data,
                headers={
                    "Authorization": f"Bearer {hr_token}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 403:
                data = response.json()
                if "insufficient permissions" in data.get("detail", "").lower():
                    self.log_result("Permission Denied Non-Admin", True, 
                                  "Correctly denied non-admin user creation", data)
                else:
                    self.log_result("Permission Denied Non-Admin", False, 
                                  f"Wrong error message: {data.get('detail')}", data)
            else:
                self.log_result("Permission Denied Non-Admin", False, 
                              f"Expected 403, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Permission Denied Non-Admin", False, f"Exception: {str(e)}")

    async def test_update_user_role(self):
        """Test updating user role"""
        if "admin" not in self.test_tokens or "hr" not in self.test_users:
            self.log_result("Update User Role", False, "No admin token or HR user available")
            return
            
        hr_user_id = self.test_users["hr"]["id"]
        new_role = "Financial Manager"
        
        try:
            response = await self.client.put(
                f"{self.base_url}/users{hr_user_id}/role",
                params={"role": new_role},
                headers={"Authorization": f"Bearer {self.test_tokens['admin']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get("role") != new_role:
                    self.log_result("Update User Role", False, 
                                  f"Role not updated: expected {new_role}, got {data.get('role')}", data)
                    return None
                
                # Update stored user data
                self.test_users["hr"]["role"] = new_role
                
                self.log_result("Update User Role", True, 
                              f"Role updated successfully to {new_role}", data)
                return data
            else:
                self.log_result("Update User Role", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Update User Role", False, f"Exception: {str(e)}")
            return None

    async def test_delete_user(self):
        """Test deactivating a user"""
        if "admin" not in self.test_tokens or "accountant" not in self.test_users:
            self.log_result("Delete User", False, "No admin token or accountant user available")
            return
            
        accountant_user_id = self.test_users["accountant"]["id"]
        
        try:
            response = await self.client.delete(
                f"{self.base_url}/users{accountant_user_id}",
                headers={"Authorization": f"Bearer {self.test_tokens['admin']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                if "deactivated successfully" not in data.get("message", "").lower():
                    self.log_result("Delete User", False, 
                                  f"Unexpected response message: {data.get('message')}", data)
                    return None
                
                self.log_result("Delete User", True, 
                              f"User deactivated successfully", data)
                return data
            else:
                self.log_result("Delete User", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Delete User", False, f"Exception: {str(e)}")
            return None

    async def test_cannot_delete_self(self):
        """Test that General Manager cannot delete their own account"""
        if "admin" not in self.test_tokens or "admin" not in self.test_users:
            self.log_result("Cannot Delete Self", False, "No admin token or user available")
            return
            
        admin_user_id = self.test_users["admin"]["id"]
        
        try:
            response = await self.client.delete(
                f"{self.base_url}/users{admin_user_id}",
                headers={"Authorization": f"Bearer {self.test_tokens['admin']}"}
            )
            
            if response.status_code == 400:
                data = response.json()
                if "cannot deactivate your own account" in data.get("detail", "").lower():
                    self.log_result("Cannot Delete Self", True, 
                                  "Correctly prevented self-deletion", data)
                else:
                    self.log_result("Cannot Delete Self", False, 
                                  f"Wrong error message: {data.get('detail')}", data)
            else:
                self.log_result("Cannot Delete Self", False, 
                              f"Expected 400, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Cannot Delete Self", False, f"Exception: {str(e)}")

    async def test_get_company_details(self):
        """Test getting company details"""
        if "admin" not in self.test_tokens or not self.test_company:
            self.log_result("Get Company Details", False, "No admin token or company data available")
            return
            
        company_id = self.test_company["id"]
        
        try:
            response = await self.client.get(
                f"{self.base_url}/companies/{company_id}",
                headers={"Authorization": f"Bearer {self.test_tokens['admin']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ["id", "name", "industry", "size", "contact_email", "phone", "subscription_status"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("Get Company Details", False, 
                                  f"Missing required fields: {missing_fields}", data)
                    return None
                
                if data.get("id") != company_id:
                    self.log_result("Get Company Details", False, 
                                  f"Company ID mismatch: expected {company_id}, got {data.get('id')}", data)
                    return None
                
                self.log_result("Get Company Details", True, 
                              f"Company details retrieved successfully", data)
                return data
            else:
                self.log_result("Get Company Details", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Get Company Details", False, f"Exception: {str(e)}")
            return None

    async def test_list_roles(self):
        """Test listing all available roles"""
        try:
            response = await self.client.get(f"{self.base_url}/usersroles")
            
            if response.status_code == 200:
                data = response.json()
                
                if not isinstance(data, list):
                    self.log_result("List Roles", False, 
                                  f"Expected list, got {type(data)}", data)
                    return None
                
                expected_roles = ["General Manager", "HR Manager", "Financial Manager", "Accountant"]
                missing_roles = [role for role in expected_roles if role not in data]
                
                if missing_roles:
                    self.log_result("List Roles", False, 
                                  f"Missing roles: {missing_roles}", data)
                    return None
                
                self.log_result("List Roles", True, 
                              f"All roles retrieved successfully: {data}", data)
                return data
            else:
                self.log_result("List Roles", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("List Roles", False, f"Exception: {str(e)}")
            return None

    async def test_get_role_permissions(self):
        """Test getting permissions for each role"""
        roles = ["General Manager", "HR Manager", "Financial Manager", "Accountant"]
        
        for role in roles:
            try:
                response = await self.client.get(f"{self.base_url}/userspermissions/{role}")
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Validate response structure
                    required_fields = ["role", "modules", "permissions"]
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if missing_fields:
                        self.log_result(f"Get {role} Permissions", False, 
                                      f"Missing required fields: {missing_fields}", data)
                        continue
                    
                    if data.get("role") != role:
                        self.log_result(f"Get {role} Permissions", False, 
                                      f"Role mismatch: expected {role}, got {data.get('role')}", data)
                        continue
                    
                    self.log_result(f"Get {role} Permissions", True, 
                                  f"Permissions retrieved successfully", data)
                else:
                    self.log_result(f"Get {role} Permissions", False, 
                                  f"Expected 200, got {response.status_code}", response.text)
                    
            except Exception as e:
                self.log_result(f"Get {role} Permissions", False, f"Exception: {str(e)}")

    async def test_upload_logo_as_general_manager(self):
        """Test uploading logo as General Manager (should succeed)"""
        if "admin" not in self.test_tokens or not self.test_company:
            self.log_result("Upload Logo as General Manager", False, "No admin token or company data available")
            return
            
        company_id = self.test_company["id"]
        
        # Create a simple test image content
        test_image_content = b"fake_image_content_for_testing"
        
        try:
            files = {"file": ("test_logo.jpg", test_image_content, "image/jpeg")}
            
            response = await self.client.post(
                f"{self.base_url}/companies/{company_id}/upload-logo",
                files=files,
                headers={"Authorization": f"Bearer {self.test_tokens['admin']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ["message", "logo_url"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("Upload Logo as General Manager", False, 
                                  f"Missing required fields: {missing_fields}", data)
                    return None
                
                if "successfully" not in data.get("message", "").lower():
                    self.log_result("Upload Logo as General Manager", False, 
                                  f"Unexpected message: {data.get('message')}", data)
                    return None
                
                # Verify logo_url format
                logo_url = data.get("logo_url")
                if not logo_url or not logo_url.startswith("/uploads/logos/"):
                    self.log_result("Upload Logo as General Manager", False, 
                                  f"Invalid logo_url format: {logo_url}", data)
                    return None
                
                self.log_result("Upload Logo as General Manager", True, 
                              f"Logo uploaded successfully: {logo_url}", data)
                return data
            else:
                self.log_result("Upload Logo as General Manager", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Upload Logo as General Manager", False, f"Exception: {str(e)}")
            return None

    async def test_upload_non_image_file(self):
        """Test uploading non-image file (should fail with 400)"""
        if "admin" not in self.test_tokens or not self.test_company:
            self.log_result("Upload Non-Image File", False, "No admin token or company data available")
            return
            
        company_id = self.test_company["id"]
        
        # Create a non-image file content
        test_file_content = b"This is not an image file content"
        
        try:
            files = {"file": ("test_file.txt", test_file_content, "text/plain")}
            
            response = await self.client.post(
                f"{self.base_url}/companies/{company_id}/upload-logo",
                files=files,
                headers={"Authorization": f"Bearer {self.test_tokens['admin']}"}
            )
            
            if response.status_code == 400:
                data = response.json()
                if "only image files" in data.get("detail", "").lower():
                    self.log_result("Upload Non-Image File", True, 
                                  "Correctly rejected non-image file", data)
                else:
                    self.log_result("Upload Non-Image File", False, 
                                  f"Wrong error message: {data.get('detail')}", data)
            else:
                self.log_result("Upload Non-Image File", False, 
                              f"Expected 400, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Upload Non-Image File", False, f"Exception: {str(e)}")

    async def test_upload_logo_without_auth(self):
        """Test uploading logo without authentication (should fail with 401)"""
        if not self.test_company:
            self.log_result("Upload Logo Without Auth", False, "No company data available")
            return
            
        company_id = self.test_company["id"]
        test_image_content = b"fake_image_content_for_testing"
        
        try:
            files = {"file": ("test_logo.jpg", test_image_content, "image/jpeg")}
            
            response = await self.client.post(
                f"{self.base_url}/companies/{company_id}/upload-logo",
                files=files
            )
            
            if response.status_code == 401:
                data = response.json()
                if "authorization header missing" in data.get("detail", "").lower():
                    self.log_result("Upload Logo Without Auth", True, 
                                  "Correctly rejected request without authentication", data)
                else:
                    self.log_result("Upload Logo Without Auth", False, 
                                  f"Wrong error message: {data.get('detail')}", data)
            else:
                self.log_result("Upload Logo Without Auth", False, 
                              f"Expected 401, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Upload Logo Without Auth", False, f"Exception: {str(e)}")

    async def test_upload_logo_as_accountant(self):
        """Test uploading logo as Accountant (should fail with 403)"""
        if "admin" not in self.test_tokens or not self.test_company:
            self.log_result("Upload Logo as Accountant", False, "No admin token or company data available")
            return
            
        # Create a new Accountant user for this test (since previous one might be deactivated)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        user_data = {
            "email": f"accountant_logo.{timestamp}@company.com",
            "full_name": "Accountant Logo Test User",
            "role": "Accountant",
            "password": "password123"
        }
        
        try:
            # Create new accountant user
            create_response = await self.client.post(
                f"{self.base_url}/users",
                json=user_data,
                headers={
                    "Authorization": f"Bearer {self.test_tokens['admin']}",
                    "Content-Type": "application/json"
                }
            )
            
            if create_response.status_code != 200:
                self.log_result("Upload Logo as Accountant", False, 
                              f"Could not create Accountant user: {create_response.status_code}")
                return
            
            # Login as the new Accountant
            login_data = {
                "email": user_data["email"],
                "password": user_data["password"]
            }
            
            login_response = await self.client.post(
                f"{self.base_url}/auth/login",
                json=login_data,
                headers={"Content-Type": "application/json"}
            )
            
            if login_response.status_code != 200:
                self.log_result("Upload Logo as Accountant", False, 
                              f"Could not login as Accountant: {login_response.status_code}")
                return
                
            accountant_token = login_response.json()["access_token"]
            company_id = self.test_company["id"]
            test_image_content = b"fake_image_content_for_testing"
            
            files = {"file": ("test_logo.jpg", test_image_content, "image/jpeg")}
            
            response = await self.client.post(
                f"{self.base_url}/companies/{company_id}/upload-logo",
                files=files,
                headers={"Authorization": f"Bearer {accountant_token}"}
            )
            
            if response.status_code == 403:
                data = response.json()
                if "only company administrators" in data.get("detail", "").lower():
                    self.log_result("Upload Logo as Accountant", True, 
                                  "Correctly denied logo upload for Accountant role", data)
                else:
                    self.log_result("Upload Logo as Accountant", False, 
                                  f"Wrong error message: {data.get('detail')}", data)
            else:
                self.log_result("Upload Logo as Accountant", False, 
                              f"Expected 403, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Upload Logo as Accountant", False, f"Exception: {str(e)}")

    async def test_get_company_with_logo_url(self):
        """Test that GET company returns logo_url after upload"""
        if "admin" not in self.test_tokens or not self.test_company:
            self.log_result("Get Company with Logo URL", False, "No admin token or company data available")
            return
            
        company_id = self.test_company["id"]
        
        try:
            response = await self.client.get(
                f"{self.base_url}/companies/{company_id}",
                headers={"Authorization": f"Bearer {self.test_tokens['admin']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Check if logo_url is present and not null
                logo_url = data.get("logo_url")
                if logo_url and logo_url.startswith("/uploads/logos/"):
                    self.log_result("Get Company with Logo URL", True, 
                                  f"Company data includes logo_url: {logo_url}", data)
                elif logo_url is None:
                    self.log_result("Get Company with Logo URL", True, 
                                  "Company data includes logo_url field (null - no logo uploaded yet)", data)
                else:
                    self.log_result("Get Company with Logo URL", False, 
                                  f"Invalid logo_url format: {logo_url}", data)
                return data
            else:
                self.log_result("Get Company with Logo URL", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("Get Company with Logo URL", False, f"Exception: {str(e)}")
            return None

    # ==================== MULTI-TENANT TESTING METHODS ====================
    
    async def setup_multi_tenant_companies(self):
        """Setup two companies for multi-tenant testing"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Company A - TechCorp A
        company_a_data = {
            "name": "TechCorp A",
            "industry": "Technology", 
            "size": "Medium (51-200)",
            "contact_email": f"contact.a.{timestamp}@techcorp.com",
            "phone": "+201111111111"
        }
        
        admin_a_email = f"admin.a.{timestamp}@techcorp.com"
        admin_a_password = "securepass123"
        
        try:
            response_a = await self.client.post(
                f"{self.base_url}/auth/register-company",
                json=company_a_data,
                params={
                    "user_email": admin_a_email,
                    "user_password": admin_a_password,
                    "user_full_name": "General Manager A"
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response_a.status_code == 200:
                data_a = response_a.json()
                self.test_companies["A"] = {
                    "id": data_a["user"]["company_id"],
                    "email": admin_a_email,
                    "password": admin_a_password,
                    "token": data_a["access_token"],
                    "user": data_a["user"]
                }
                self.log_result("Setup Company A", True, f"Company A created: {company_a_data['name']}")
            else:
                self.log_result("Setup Company A", False, f"Failed to create Company A: {response_a.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Setup Company A", False, f"Exception: {str(e)}")
            return False
        
        # Company B - TechCorp B
        company_b_data = {
            "name": "TechCorp B",
            "industry": "Finance", 
            "size": "Large (201+)",
            "contact_email": f"contact.b.{timestamp}@techcorp.com",
            "phone": "+202222222222"
        }
        
        admin_b_email = f"admin.b.{timestamp}@techcorp.com"
        admin_b_password = "securepass456"
        
        try:
            response_b = await self.client.post(
                f"{self.base_url}/auth/register-company",
                json=company_b_data,
                params={
                    "user_email": admin_b_email,
                    "user_password": admin_b_password,
                    "user_full_name": "General Manager B"
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response_b.status_code == 200:
                data_b = response_b.json()
                self.test_companies["B"] = {
                    "id": data_b["user"]["company_id"],
                    "email": admin_b_email,
                    "password": admin_b_password,
                    "token": data_b["access_token"],
                    "user": data_b["user"]
                }
                self.log_result("Setup Company B", True, f"Company B created: {company_b_data['name']}")
                return True
            else:
                self.log_result("Setup Company B", False, f"Failed to create Company B: {response_b.status_code}")
                return False
                
        except Exception as e:
            self.log_result("Setup Company B", False, f"Exception: {str(e)}")
            return False

    async def create_company_a_users(self):
        """Create additional users for Company A"""
        if "A" not in self.test_companies:
            self.log_result("Create Company A Users", False, "Company A not available")
            return False
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        admin_token = self.test_companies["A"]["token"]
        
        users_to_create = [
            {
                "role": "HR Manager",
                "email": f"hr.a.{timestamp}@techcorp.com",
                "full_name": "HR Manager A",
                "password": "hrpass123"
            },
            {
                "role": "Financial Manager", 
                "email": f"finance.a.{timestamp}@techcorp.com",
                "full_name": "Financial Manager A",
                "password": "financepass123"
            },
            {
                "role": "Accountant",
                "email": f"accountant.a.{timestamp}@techcorp.com", 
                "full_name": "Accountant A",
                "password": "accountpass123"
            }
        ]
        
        created_users = {}
        
        for user_data in users_to_create:
            try:
                response = await self.client.post(
                    f"{self.base_url}/users",
                    json=user_data,
                    headers={
                        "Authorization": f"Bearer {admin_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    
                    # Login to get token
                    login_response = await self.client.post(
                        f"{self.base_url}/auth/login",
                        json={"email": user_data["email"], "password": user_data["password"]},
                        headers={"Content-Type": "application/json"}
                    )
                    
                    if login_response.status_code == 200:
                        login_data = login_response.json()
                        created_users[user_data["role"]] = {
                            "user": data,
                            "email": user_data["email"],
                            "password": user_data["password"],
                            "token": login_data["access_token"]
                        }
                        self.log_result(f"Create {user_data['role']} A", True, f"User created and logged in")
                    else:
                        self.log_result(f"Create {user_data['role']} A", False, f"User created but login failed")
                        return False
                else:
                    self.log_result(f"Create {user_data['role']} A", False, f"Failed to create user: {response.status_code}")
                    return False
                    
            except Exception as e:
                self.log_result(f"Create {user_data['role']} A", False, f"Exception: {str(e)}")
                return False
        
        self.test_companies["A"]["users"] = created_users
        return True

    # ==================== HR API TESTING ====================
    
    async def test_hr_employees_api(self):
        """Test HR Employees API with RBAC and multi-tenant isolation"""
        if "A" not in self.test_companies:
            self.log_result("HR Employees API", False, "Company A not available")
            return
            
        company_a = self.test_companies["A"]
        
        # Test data
        employee_data = {
            "company_id": company_a["id"],
            "name": "Ahmed Hassan",
            "position": "Software Engineer",
            "department": "IT",
            "email": "ahmed.hassan@techcorp.com",
            "phone": "+201234567890",
            "hire_date": "2024-01-15",
            "basic_salary": 15000.0
        }
        
        # Test 1: POST as General Manager (should succeed)
        try:
            response = await self.client.post(
                f"{self.base_url}/hr/employees",
                json=employee_data,
                headers={
                    "Authorization": f"Bearer {company_a['token']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                self.test_data["employee_id"] = data.get("id")
                self.log_result("HR Employees POST (General Manager)", True, "Employee created successfully")
            else:
                self.log_result("HR Employees POST (General Manager)", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("HR Employees POST (General Manager)", False, f"Exception: {str(e)}")
        
        # Test 2: GET as General Manager (should return only Company A data)
        try:
            response = await self.client.get(
                f"{self.base_url}/hr/employees",
                headers={"Authorization": f"Bearer {company_a['token']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    # Check that all employees belong to Company A
                    company_a_employees = [emp for emp in data if emp.get("company_id") == company_a["id"]]
                    if len(company_a_employees) == len(data):
                        self.log_result("HR Employees GET (Company A)", True, f"Retrieved {len(data)} employees for Company A only")
                    else:
                        self.log_result("HR Employees GET (Company A)", False, "Data contains employees from other companies")
                else:
                    self.log_result("HR Employees GET (Company A)", False, f"Expected list, got {type(data)}")
            else:
                self.log_result("HR Employees GET (Company A)", False, f"Expected 200, got {response.status_code}")
                
        except Exception as e:
            self.log_result("HR Employees GET (Company A)", False, f"Exception: {str(e)}")
        
        # Test 3: POST as Accountant (should fail 403)
        if "users" in company_a and "Accountant" in company_a["users"]:
            try:
                accountant_token = company_a["users"]["Accountant"]["token"]
                response = await self.client.post(
                    f"{self.base_url}/hr/employees",
                    json=employee_data,
                    headers={
                        "Authorization": f"Bearer {accountant_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 403:
                    self.log_result("HR Employees POST (Accountant Denied)", True, "Correctly denied Accountant access")
                else:
                    self.log_result("HR Employees POST (Accountant Denied)", False, f"Expected 403, got {response.status_code}")
                    
            except Exception as e:
                self.log_result("HR Employees POST (Accountant Denied)", False, f"Exception: {str(e)}")

    async def test_hr_allowances_api(self):
        """Test HR Allowances API with RBAC"""
        if "A" not in self.test_companies:
            self.log_result("HR Allowances API", False, "Company A not available")
            return
            
        company_a = self.test_companies["A"]
        
        # Test data
        allowance_data = {
            "company_id": company_a["id"],
            "employee_id": self.test_data.get("employee_id", "emp_123"),
            "employee_name": "Ahmed Hassan",
            "type": "Transport",
            "amount": 1500.0,
            "month": "2024-12"
        }
        
        # Test 1: POST as HR Manager (should succeed)
        if "users" in company_a and "HR Manager" in company_a["users"]:
            try:
                hr_token = company_a["users"]["HR Manager"]["token"]
                response = await self.client.post(
                    f"{self.base_url}/hr/allowances",
                    json=allowance_data,
                    headers={
                        "Authorization": f"Bearer {hr_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    self.log_result("HR Allowances POST (HR Manager)", True, "Allowance created successfully")
                else:
                    self.log_result("HR Allowances POST (HR Manager)", False, f"Expected 200, got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result("HR Allowances POST (HR Manager)", False, f"Exception: {str(e)}")
        
        # Test 2: GET as any role (should return only Company A data)
        try:
            response = await self.client.get(
                f"{self.base_url}/hr/allowances",
                headers={"Authorization": f"Bearer {company_a['token']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    company_a_allowances = [allow for allow in data if allow.get("company_id") == company_a["id"]]
                    if len(company_a_allowances) == len(data):
                        self.log_result("HR Allowances GET (Company A)", True, f"Retrieved {len(data)} allowances for Company A only")
                    else:
                        self.log_result("HR Allowances GET (Company A)", False, "Data contains allowances from other companies")
                else:
                    self.log_result("HR Allowances GET (Company A)", False, f"Expected list, got {type(data)}")
            else:
                self.log_result("HR Allowances GET (Company A)", False, f"Expected 200, got {response.status_code}")
                
        except Exception as e:
            self.log_result("HR Allowances GET (Company A)", False, f"Exception: {str(e)}")
        
        # Test 3: POST as Accountant (should fail 403)
        if "users" in company_a and "Accountant" in company_a["users"]:
            try:
                accountant_token = company_a["users"]["Accountant"]["token"]
                response = await self.client.post(
                    f"{self.base_url}/hr/allowances",
                    json=allowance_data,
                    headers={
                        "Authorization": f"Bearer {accountant_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 403:
                    self.log_result("HR Allowances POST (Accountant Denied)", True, "Correctly denied Accountant access")
                else:
                    self.log_result("HR Allowances POST (Accountant Denied)", False, f"Expected 403, got {response.status_code}")
                    
            except Exception as e:
                self.log_result("HR Allowances POST (Accountant Denied)", False, f"Exception: {str(e)}")

    async def test_hr_deductions_api(self):
        """Test HR Deductions API"""
        if "A" not in self.test_companies:
            self.log_result("HR Deductions API", False, "Company A not available")
            return
            
        company_a = self.test_companies["A"]
        
        # Test data
        deduction_data = {
            "company_id": company_a["id"],
            "employee_id": self.test_data.get("employee_id", "emp_123"),
            "employee_name": "Ahmed Hassan",
            "type": "Insurance",
            "amount": 500.0,
            "month": "2024-12"
        }
        
        # Test 1: POST as Financial Manager (should succeed)
        if "users" in company_a and "Financial Manager" in company_a["users"]:
            try:
                finance_token = company_a["users"]["Financial Manager"]["token"]
                response = await self.client.post(
                    f"{self.base_url}/hr/deductions",
                    json=deduction_data,
                    headers={
                        "Authorization": f"Bearer {finance_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    self.log_result("HR Deductions POST (Financial Manager)", True, "Deduction created successfully")
                else:
                    self.log_result("HR Deductions POST (Financial Manager)", False, f"Expected 200, got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result("HR Deductions POST (Financial Manager)", False, f"Exception: {str(e)}")
        
        # Test 2: GET (should return only Company A data)
        try:
            response = await self.client.get(
                f"{self.base_url}/hr/deductions",
                headers={"Authorization": f"Bearer {company_a['token']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("HR Deductions GET (Company A)", True, f"Retrieved {len(data)} deductions for Company A")
                else:
                    self.log_result("HR Deductions GET (Company A)", False, f"Expected list, got {type(data)}")
            else:
                self.log_result("HR Deductions GET (Company A)", False, f"Expected 200, got {response.status_code}")
                
        except Exception as e:
            self.log_result("HR Deductions GET (Company A)", False, f"Exception: {str(e)}")

    async def test_hr_leaves_api(self):
        """Test HR Leaves API"""
        if "A" not in self.test_companies:
            self.log_result("HR Leaves API", False, "Company A not available")
            return
            
        company_a = self.test_companies["A"]
        
        # Test data
        leave_data = {
            "company_id": company_a["id"],
            "employee_id": self.test_data.get("employee_id", "emp_123"),
            "employee_name": "Ahmed Hassan",
            "leave_type": "annual",
            "start_date": "2024-12-25",
            "end_date": "2024-12-30",
            "days": 5,
            "reason": "Year-end vacation"
        }
        
        # Test 1: POST as any authenticated user (should succeed)
        try:
            response = await self.client.post(
                f"{self.base_url}/hr/leaves",
                json=leave_data,
                headers={
                    "Authorization": f"Bearer {company_a['token']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                self.log_result("HR Leaves POST (Any User)", True, "Leave created successfully")
            else:
                self.log_result("HR Leaves POST (Any User)", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("HR Leaves POST (Any User)", False, f"Exception: {str(e)}")
        
        # Test 2: GET (should return only Company A data)
        try:
            response = await self.client.get(
                f"{self.base_url}/hr/leaves",
                headers={"Authorization": f"Bearer {company_a['token']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("HR Leaves GET (Company A)", True, f"Retrieved {len(data)} leaves for Company A")
                else:
                    self.log_result("HR Leaves GET (Company A)", False, f"Expected list, got {type(data)}")
            else:
                self.log_result("HR Leaves GET (Company A)", False, f"Expected 200, got {response.status_code}")
                
        except Exception as e:
            self.log_result("HR Leaves GET (Company A)", False, f"Exception: {str(e)}")

    async def test_hr_attendance_api(self):
        """Test HR Attendance API"""
        if "A" not in self.test_companies:
            self.log_result("HR Attendance API", False, "Company A not available")
            return
            
        company_a = self.test_companies["A"]
        
        # Test data
        attendance_data = {
            "company_id": company_a["id"],
            "employee_id": self.test_data.get("employee_id", "emp_123"),
            "employee_name": "Ahmed Hassan",
            "date": "2024-12-15",
            "check_in": "09:00",
            "check_out": "17:00",
            "status": "present",
            "hours": 8.0
        }
        
        # Test 1: POST as HR Manager (should succeed)
        if "users" in company_a and "HR Manager" in company_a["users"]:
            try:
                hr_token = company_a["users"]["HR Manager"]["token"]
                response = await self.client.post(
                    f"{self.base_url}/hr/attendance",
                    json=attendance_data,
                    headers={
                        "Authorization": f"Bearer {hr_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    self.log_result("HR Attendance POST (HR Manager)", True, "Attendance recorded successfully")
                else:
                    self.log_result("HR Attendance POST (HR Manager)", False, f"Expected 200, got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result("HR Attendance POST (HR Manager)", False, f"Exception: {str(e)}")
        
        # Test 2: GET (should return only Company A data)
        try:
            response = await self.client.get(
                f"{self.base_url}/hr/attendance",
                headers={"Authorization": f"Bearer {company_a['token']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("HR Attendance GET (Company A)", True, f"Retrieved {len(data)} attendance records for Company A")
                else:
                    self.log_result("HR Attendance GET (Company A)", False, f"Expected list, got {type(data)}")
            else:
                self.log_result("HR Attendance GET (Company A)", False, f"Expected 200, got {response.status_code}")
                
        except Exception as e:
            self.log_result("HR Attendance GET (Company A)", False, f"Exception: {str(e)}")
        
        # Test 3: POST as Accountant (should fail 403)
        if "users" in company_a and "Accountant" in company_a["users"]:
            try:
                accountant_token = company_a["users"]["Accountant"]["token"]
                response = await self.client.post(
                    f"{self.base_url}/hr/attendance",
                    json=attendance_data,
                    headers={
                        "Authorization": f"Bearer {accountant_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 403:
                    self.log_result("HR Attendance POST (Accountant Denied)", True, "Correctly denied Accountant access")
                else:
                    self.log_result("HR Attendance POST (Accountant Denied)", False, f"Expected 403, got {response.status_code}")
                    
            except Exception as e:
                self.log_result("HR Attendance POST (Accountant Denied)", False, f"Exception: {str(e)}")

    # ==================== FINANCIAL API TESTING ====================
    
    async def test_financial_journal_entries_api(self):
        """Test Financial Journal Entries API"""
        if "A" not in self.test_companies:
            self.log_result("Financial Journal Entries API", False, "Company A not available")
            return
            
        company_a = self.test_companies["A"]
        
        # Test data
        journal_entry_data = {
            "company_id": company_a["id"],
            "date": "2024-12-15",
            "description": "Office supplies purchase",
            "account": "Office Expenses",
            "debit": 2500.0,
            "credit": 0.0
        }
        
        # Test 1: POST as Financial Manager (should succeed)
        if "users" in company_a and "Financial Manager" in company_a["users"]:
            try:
                finance_token = company_a["users"]["Financial Manager"]["token"]
                response = await self.client.post(
                    f"{self.base_url}/financial/journal-entries",
                    json=journal_entry_data,
                    headers={
                        "Authorization": f"Bearer {finance_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    self.log_result("Financial Journal Entries POST (Financial Manager)", True, "Journal entry created successfully")
                else:
                    self.log_result("Financial Journal Entries POST (Financial Manager)", False, f"Expected 200, got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result("Financial Journal Entries POST (Financial Manager)", False, f"Exception: {str(e)}")
        
        # Test 2: GET (should return only Company A data)
        try:
            response = await self.client.get(
                f"{self.base_url}/financial/journal-entries",
                headers={"Authorization": f"Bearer {company_a['token']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Financial Journal Entries GET (Company A)", True, f"Retrieved {len(data)} journal entries for Company A")
                else:
                    self.log_result("Financial Journal Entries GET (Company A)", False, f"Expected list, got {type(data)}")
            else:
                self.log_result("Financial Journal Entries GET (Company A)", False, f"Expected 200, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Financial Journal Entries GET (Company A)", False, f"Exception: {str(e)}")
        
        # Test 3: POST as Accountant (should fail 403)
        if "users" in company_a and "Accountant" in company_a["users"]:
            try:
                accountant_token = company_a["users"]["Accountant"]["token"]
                response = await self.client.post(
                    f"{self.base_url}/financial/journal-entries",
                    json=journal_entry_data,
                    headers={
                        "Authorization": f"Bearer {accountant_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 403:
                    self.log_result("Financial Journal Entries POST (Accountant Denied)", True, "Correctly denied Accountant write access")
                else:
                    self.log_result("Financial Journal Entries POST (Accountant Denied)", False, f"Expected 403, got {response.status_code}")
                    
            except Exception as e:
                self.log_result("Financial Journal Entries POST (Accountant Denied)", False, f"Exception: {str(e)}")

    async def test_financial_treasury_api(self):
        """Test Financial Treasury API"""
        if "A" not in self.test_companies:
            self.log_result("Financial Treasury API", False, "Company A not available")
            return
            
        company_a = self.test_companies["A"]
        
        # Test data
        treasury_data = {
            "company_id": company_a["id"],
            "date": "2024-12-15",
            "description": "Cash deposit from sales",
            "type": "in",
            "amount": 50000.0
        }
        
        # Test 1: POST as Financial Manager (should succeed)
        if "users" in company_a and "Financial Manager" in company_a["users"]:
            try:
                finance_token = company_a["users"]["Financial Manager"]["token"]
                response = await self.client.post(
                    f"{self.base_url}/financial/treasury",
                    json=treasury_data,
                    headers={
                        "Authorization": f"Bearer {finance_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    self.log_result("Financial Treasury POST (Financial Manager)", True, "Treasury transaction created successfully")
                else:
                    self.log_result("Financial Treasury POST (Financial Manager)", False, f"Expected 200, got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result("Financial Treasury POST (Financial Manager)", False, f"Exception: {str(e)}")
        
        # Test 2: GET as Accountant (should succeed - read access)
        if "users" in company_a and "Accountant" in company_a["users"]:
            try:
                accountant_token = company_a["users"]["Accountant"]["token"]
                response = await self.client.get(
                    f"{self.base_url}/financial/treasury",
                    headers={"Authorization": f"Bearer {accountant_token}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list):
                        self.log_result("Financial Treasury GET (Accountant Read Access)", True, f"Accountant can read {len(data)} treasury transactions")
                    else:
                        self.log_result("Financial Treasury GET (Accountant Read Access)", False, f"Expected list, got {type(data)}")
                else:
                    self.log_result("Financial Treasury GET (Accountant Read Access)", False, f"Expected 200, got {response.status_code}")
                    
            except Exception as e:
                self.log_result("Financial Treasury GET (Accountant Read Access)", False, f"Exception: {str(e)}")

    async def test_financial_bank_api(self):
        """Test Financial Bank API"""
        if "A" not in self.test_companies:
            self.log_result("Financial Bank API", False, "Company A not available")
            return
            
        company_a = self.test_companies["A"]
        
        # Test data
        bank_data = {
            "company_id": company_a["id"],
            "date": "2024-12-15",
            "description": "Client payment received",
            "bank_name": "National Bank of Egypt",
            "type": "deposit",
            "amount": 75000.0,
            "balance": 125000.0
        }
        
        # Test 1: POST as Financial Manager (should succeed)
        if "users" in company_a and "Financial Manager" in company_a["users"]:
            try:
                finance_token = company_a["users"]["Financial Manager"]["token"]
                response = await self.client.post(
                    f"{self.base_url}/financial/bank",
                    json=bank_data,
                    headers={
                        "Authorization": f"Bearer {finance_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    self.log_result("Financial Bank POST (Financial Manager)", True, "Bank transaction created successfully")
                else:
                    self.log_result("Financial Bank POST (Financial Manager)", False, f"Expected 200, got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result("Financial Bank POST (Financial Manager)", False, f"Exception: {str(e)}")
        
        # Test 2: GET (should return only Company A data)
        try:
            response = await self.client.get(
                f"{self.base_url}/financial/bank",
                headers={"Authorization": f"Bearer {company_a['token']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Financial Bank GET (Company A)", True, f"Retrieved {len(data)} bank transactions for Company A")
                else:
                    self.log_result("Financial Bank GET (Company A)", False, f"Expected list, got {type(data)}")
            else:
                self.log_result("Financial Bank GET (Company A)", False, f"Expected 200, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Financial Bank GET (Company A)", False, f"Exception: {str(e)}")
        
        # Test 3: POST as Accountant (should fail 403)
        if "users" in company_a and "Accountant" in company_a["users"]:
            try:
                accountant_token = company_a["users"]["Accountant"]["token"]
                response = await self.client.post(
                    f"{self.base_url}/financial/bank",
                    json=bank_data,
                    headers={
                        "Authorization": f"Bearer {accountant_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 403:
                    self.log_result("Financial Bank POST (Accountant Denied)", True, "Correctly denied Accountant write access")
                else:
                    self.log_result("Financial Bank POST (Accountant Denied)", False, f"Expected 403, got {response.status_code}")
                    
            except Exception as e:
                self.log_result("Financial Bank POST (Accountant Denied)", False, f"Exception: {str(e)}")

    async def test_financial_customers_api(self):
        """Test Financial Customers API"""
        if "A" not in self.test_companies:
            self.log_result("Financial Customers API", False, "Company A not available")
            return
            
        company_a = self.test_companies["A"]
        
        # Test data
        customer_data = {
            "company_id": company_a["id"],
            "name": "Mahmoud Ali Trading",
            "email": "mahmoud@alitrading.com",
            "phone": "+201555666777",
            "address": "123 Commerce Street, Cairo",
            "balance": 25000.0
        }
        
        # Test 1: POST as Financial Manager (should succeed)
        if "users" in company_a and "Financial Manager" in company_a["users"]:
            try:
                finance_token = company_a["users"]["Financial Manager"]["token"]
                response = await self.client.post(
                    f"{self.base_url}/financial/customers",
                    json=customer_data,
                    headers={
                        "Authorization": f"Bearer {finance_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    self.test_data["customer_id"] = data.get("id")
                    self.log_result("Financial Customers POST (Financial Manager)", True, "Customer created successfully")
                else:
                    self.log_result("Financial Customers POST (Financial Manager)", False, f"Expected 200, got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result("Financial Customers POST (Financial Manager)", False, f"Exception: {str(e)}")
        
        # Test 2: GET (should return only Company A data)
        try:
            response = await self.client.get(
                f"{self.base_url}/financial/customers",
                headers={"Authorization": f"Bearer {company_a['token']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Financial Customers GET (Company A)", True, f"Retrieved {len(data)} customers for Company A")
                else:
                    self.log_result("Financial Customers GET (Company A)", False, f"Expected list, got {type(data)}")
            else:
                self.log_result("Financial Customers GET (Company A)", False, f"Expected 200, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Financial Customers GET (Company A)", False, f"Exception: {str(e)}")

    async def test_financial_suppliers_api(self):
        """Test Financial Suppliers API"""
        if "A" not in self.test_companies:
            self.log_result("Financial Suppliers API", False, "Company A not available")
            return
            
        company_a = self.test_companies["A"]
        
        # Test data
        supplier_data = {
            "company_id": company_a["id"],
            "name": "Tech Solutions Provider",
            "email": "sales@techsolutions.com",
            "phone": "+201444555666",
            "address": "456 Technology Park, Giza",
            "balance": -15000.0
        }
        
        # Test 1: POST as Financial Manager (should succeed)
        if "users" in company_a and "Financial Manager" in company_a["users"]:
            try:
                finance_token = company_a["users"]["Financial Manager"]["token"]
                response = await self.client.post(
                    f"{self.base_url}/financial/suppliers",
                    json=supplier_data,
                    headers={
                        "Authorization": f"Bearer {finance_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    self.log_result("Financial Suppliers POST (Financial Manager)", True, "Supplier created successfully")
                else:
                    self.log_result("Financial Suppliers POST (Financial Manager)", False, f"Expected 200, got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result("Financial Suppliers POST (Financial Manager)", False, f"Exception: {str(e)}")
        
        # Test 2: GET (should return only Company A data)
        try:
            response = await self.client.get(
                f"{self.base_url}/financial/suppliers",
                headers={"Authorization": f"Bearer {company_a['token']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Financial Suppliers GET (Company A)", True, f"Retrieved {len(data)} suppliers for Company A")
                else:
                    self.log_result("Financial Suppliers GET (Company A)", False, f"Expected list, got {type(data)}")
            else:
                self.log_result("Financial Suppliers GET (Company A)", False, f"Expected 200, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Financial Suppliers GET (Company A)", False, f"Exception: {str(e)}")

    # ==================== MULTI-TENANT ISOLATION TESTING ====================
    
    async def test_multi_tenant_isolation(self):
        """Test that Company A cannot see Company B data and vice versa"""
        if "A" not in self.test_companies or "B" not in self.test_companies:
            self.log_result("Multi-Tenant Isolation", False, "Both companies not available")
            return
            
        company_a = self.test_companies["A"]
        company_b = self.test_companies["B"]
        
        # Test 1: Company B General Manager tries to access Company A employee data
        try:
            response = await self.client.get(
                f"{self.base_url}/hr/employees",
                headers={"Authorization": f"Bearer {company_b['token']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    # Check that no Company A employees are returned
                    company_a_employees = [emp for emp in data if emp.get("company_id") == company_a["id"]]
                    if len(company_a_employees) == 0:
                        self.log_result("Multi-Tenant Isolation (HR Employees)", True, f"Company B cannot see Company A employees (returned {len(data)} Company B employees)")
                    else:
                        self.log_result("Multi-Tenant Isolation (HR Employees)", False, f"CRITICAL: Company B can see {len(company_a_employees)} Company A employees")
                else:
                    self.log_result("Multi-Tenant Isolation (HR Employees)", False, f"Expected list, got {type(data)}")
            else:
                self.log_result("Multi-Tenant Isolation (HR Employees)", False, f"Expected 200, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Multi-Tenant Isolation (HR Employees)", False, f"Exception: {str(e)}")
        
        # Test 2: Company B General Manager tries to access Company A customer data
        try:
            response = await self.client.get(
                f"{self.base_url}/financial/customers",
                headers={"Authorization": f"Bearer {company_b['token']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    # Check that no Company A customers are returned
                    company_a_customers = [cust for cust in data if cust.get("company_id") == company_a["id"]]
                    if len(company_a_customers) == 0:
                        self.log_result("Multi-Tenant Isolation (Financial Customers)", True, f"Company B cannot see Company A customers (returned {len(data)} Company B customers)")
                    else:
                        self.log_result("Multi-Tenant Isolation (Financial Customers)", False, f"CRITICAL: Company B can see {len(company_a_customers)} Company A customers")
                else:
                    self.log_result("Multi-Tenant Isolation (Financial Customers)", False, f"Expected list, got {type(data)}")
            else:
                self.log_result("Multi-Tenant Isolation (Financial Customers)", False, f"Expected 200, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Multi-Tenant Isolation (Financial Customers)", False, f"Exception: {str(e)}")

    # ==================== AUTHENTICATION TESTING ====================
    
    async def test_endpoints_without_auth(self):
        """Test that all endpoints require authentication"""
        endpoints_to_test = [
            "/hr/employees",
            "/hr/allowances", 
            "/hr/deductions",
            "/hr/leaves",
            "/hr/attendance",
            "/financial/journal-entries",
            "/financial/treasury",
            "/financial/bank",
            "/financial/customers",
            "/financial/suppliers"
        ]
        
        for endpoint in endpoints_to_test:
            try:
                response = await self.client.get(f"{self.base_url}{endpoint}")
                
                if response.status_code == 401:
                    self.log_result(f"Auth Required {endpoint}", True, "Correctly requires authentication")
                else:
                    self.log_result(f"Auth Required {endpoint}", False, f"Expected 401, got {response.status_code}")
                    
            except Exception as e:
                self.log_result(f"Auth Required {endpoint}", False, f"Exception: {str(e)}")

    async def test_endpoints_with_invalid_token(self):
        """Test endpoints with invalid token"""
        endpoints_to_test = [
            "/hr/employees",
            "/financial/customers"
        ]
        
        for endpoint in endpoints_to_test:
            try:
                response = await self.client.get(
                    f"{self.base_url}{endpoint}",
                    headers={"Authorization": "Bearer invalid_token_12345"}
                )
                
                if response.status_code == 401:
                    self.log_result(f"Invalid Token {endpoint}", True, "Correctly rejects invalid token")
                else:
                    self.log_result(f"Invalid Token {endpoint}", False, f"Expected 401, got {response.status_code}")
                    
            except Exception as e:
                self.log_result(f"Invalid Token {endpoint}", False, f"Exception: {str(e)}")

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

    # ==================== ANALYTICS API TESTING ====================
    
    async def test_analytics_overview_authentication(self):
        """Test analytics overview endpoint requires authentication"""
        try:
            # Test without authorization header
            response = await self.client.get(f"{self.base_url}/analytics/overview")
            
            if response.status_code == 401:
                self.log_result("Analytics Overview - No Auth", True, "Correctly rejected request without authentication")
            else:
                self.log_result("Analytics Overview - No Auth", False, f"Expected 401, got {response.status_code}")
            
            # Test with invalid token
            response = await self.client.get(
                f"{self.base_url}/analytics/overview",
                headers={"Authorization": "Bearer invalid_token"}
            )
            
            if response.status_code == 401:
                self.log_result("Analytics Overview - Invalid Token", True, "Correctly rejected invalid token")
            else:
                self.log_result("Analytics Overview - Invalid Token", False, f"Expected 401, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Analytics Overview Authentication", False, f"Exception: {str(e)}")

    async def test_analytics_overview_success(self):
        """Test analytics overview endpoint with valid authentication"""
        # Use existing test user
        login_data = {"email": "test-logo@example.com", "password": "testpass123"}
        
        try:
            # Login to get token
            login_response = await self.client.post(
                f"{self.base_url}/auth/login",
                json=login_data,
                headers={"Content-Type": "application/json"}
            )
            
            if login_response.status_code != 200:
                self.log_result("Analytics Overview Success", False, f"Could not login: {login_response.status_code}")
                return
            
            token = login_response.json()["access_token"]
            
            # Test with default period (monthly)
            response = await self.client.get(
                f"{self.base_url}/analytics/overview",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ["period", "hr_analytics", "financial_analytics", "inventory_analytics"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("Analytics Overview Success", False, f"Missing required fields: {missing_fields}", data)
                    return
                
                # Validate hr_analytics structure
                hr_required = ["total_employees", "total_allowances", "total_deductions", "total_leaves"]
                hr_missing = [field for field in hr_required if field not in data["hr_analytics"]]
                
                if hr_missing:
                    self.log_result("Analytics Overview Success", False, f"Missing HR analytics fields: {hr_missing}", data)
                    return
                
                # Validate financial_analytics structure
                fin_required = ["total_customers", "total_suppliers", "total_revenue", "total_expenses", "net_profit", "profit_margin"]
                fin_missing = [field for field in fin_required if field not in data["financial_analytics"]]
                
                if fin_missing:
                    self.log_result("Analytics Overview Success", False, f"Missing financial analytics fields: {fin_missing}", data)
                    return
                
                # Validate inventory_analytics structure
                inv_required = ["total_items", "total_value", "low_stock_items", "in_stock_items"]
                inv_missing = [field for field in inv_required if field not in data["inventory_analytics"]]
                
                if inv_missing:
                    self.log_result("Analytics Overview Success", False, f"Missing inventory analytics fields: {inv_missing}", data)
                    return
                
                self.log_result("Analytics Overview Success", True, f"Overview analytics retrieved successfully with period: {data['period']}", data)
                
                # Store token for other tests
                self.test_tokens["analytics"] = token
                
            else:
                self.log_result("Analytics Overview Success", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Analytics Overview Success", False, f"Exception: {str(e)}")

    async def test_analytics_overview_periods(self):
        """Test analytics overview with different period parameters"""
        if "analytics" not in self.test_tokens:
            self.log_result("Analytics Overview Periods", False, "No analytics token available")
            return
        
        token = self.test_tokens["analytics"]
        periods = ["daily", "monthly", "yearly"]
        
        for period in periods:
            try:
                response = await self.client.get(
                    f"{self.base_url}/analytics/overview",
                    params={"period": period},
                    headers={"Authorization": f"Bearer {token}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("period") == period:
                        self.log_result(f"Analytics Overview - {period.title()} Period", True, f"Successfully retrieved {period} analytics")
                    else:
                        self.log_result(f"Analytics Overview - {period.title()} Period", False, f"Period mismatch: expected {period}, got {data.get('period')}")
                else:
                    self.log_result(f"Analytics Overview - {period.title()} Period", False, f"Expected 200, got {response.status_code}")
                    
            except Exception as e:
                self.log_result(f"Analytics Overview - {period.title()} Period", False, f"Exception: {str(e)}")

    async def test_analytics_financial_endpoint(self):
        """Test financial analytics endpoint"""
        if "analytics" not in self.test_tokens:
            self.log_result("Analytics Financial", False, "No analytics token available")
            return
        
        token = self.test_tokens["analytics"]
        
        try:
            # Test without authentication first
            response = await self.client.get(f"{self.base_url}/analytics/financial")
            
            if response.status_code == 401:
                self.log_result("Analytics Financial - No Auth", True, "Correctly rejected request without authentication")
            else:
                self.log_result("Analytics Financial - No Auth", False, f"Expected 401, got {response.status_code}")
            
            # Test with valid authentication
            response = await self.client.get(
                f"{self.base_url}/analytics/financial",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ["revenue_by_month", "expenses_by_month", "customer_balances", "supplier_balances", 
                                 "total_customers", "total_suppliers", "total_revenue", "total_expenses"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("Analytics Financial", False, f"Missing required fields: {missing_fields}", data)
                    return
                
                # Validate array fields
                if not isinstance(data["revenue_by_month"], list):
                    self.log_result("Analytics Financial", False, "revenue_by_month should be a list", data)
                    return
                
                if not isinstance(data["expenses_by_month"], list):
                    self.log_result("Analytics Financial", False, "expenses_by_month should be a list", data)
                    return
                
                if not isinstance(data["customer_balances"], list):
                    self.log_result("Analytics Financial", False, "customer_balances should be a list", data)
                    return
                
                if not isinstance(data["supplier_balances"], list):
                    self.log_result("Analytics Financial", False, "supplier_balances should be a list", data)
                    return
                
                # Validate customer_balances structure (top 10)
                if len(data["customer_balances"]) > 10:
                    self.log_result("Analytics Financial", False, f"customer_balances should be limited to 10, got {len(data['customer_balances'])}", data)
                    return
                
                # Validate supplier_balances structure (top 10)
                if len(data["supplier_balances"]) > 10:
                    self.log_result("Analytics Financial", False, f"supplier_balances should be limited to 10, got {len(data['supplier_balances'])}", data)
                    return
                
                self.log_result("Analytics Financial", True, f"Financial analytics retrieved successfully with {len(data['revenue_by_month'])} revenue entries and {len(data['customer_balances'])} customers", data)
                
            else:
                self.log_result("Analytics Financial", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Analytics Financial", False, f"Exception: {str(e)}")

    async def test_analytics_hr_endpoint(self):
        """Test HR analytics endpoint"""
        if "analytics" not in self.test_tokens:
            self.log_result("Analytics HR", False, "No analytics token available")
            return
        
        token = self.test_tokens["analytics"]
        
        try:
            # Test without authentication first
            response = await self.client.get(f"{self.base_url}/analytics/hr")
            
            if response.status_code == 401:
                self.log_result("Analytics HR - No Auth", True, "Correctly rejected request without authentication")
            else:
                self.log_result("Analytics HR - No Auth", False, f"Expected 401, got {response.status_code}")
            
            # Test with valid authentication
            response = await self.client.get(
                f"{self.base_url}/analytics/hr",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ["total_employees", "department_distribution", "salary_distribution", 
                                 "leave_statistics", "attendance_data", "total_allowances", "total_deductions", "total_leaves"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("Analytics HR", False, f"Missing required fields: {missing_fields}", data)
                    return
                
                # Validate array fields
                if not isinstance(data["department_distribution"], list):
                    self.log_result("Analytics HR", False, "department_distribution should be a list", data)
                    return
                
                if not isinstance(data["salary_distribution"], list):
                    self.log_result("Analytics HR", False, "salary_distribution should be a list", data)
                    return
                
                if not isinstance(data["leave_statistics"], list):
                    self.log_result("Analytics HR", False, "leave_statistics should be a list", data)
                    return
                
                if not isinstance(data["attendance_data"], list):
                    self.log_result("Analytics HR", False, "attendance_data should be a list", data)
                    return
                
                # Validate salary_distribution has expected ranges
                salary_ranges = [item["range"] for item in data["salary_distribution"]]
                expected_ranges = ["0-5000", "5000-10000", "10000-15000", "15000+"]
                missing_ranges = [r for r in expected_ranges if r not in salary_ranges]
                
                if missing_ranges:
                    self.log_result("Analytics HR", False, f"Missing salary ranges: {missing_ranges}", data)
                    return
                
                self.log_result("Analytics HR", True, f"HR analytics retrieved successfully with {data['total_employees']} employees and {len(data['department_distribution'])} departments", data)
                
            else:
                self.log_result("Analytics HR", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Analytics HR", False, f"Exception: {str(e)}")

    async def test_analytics_inventory_endpoint(self):
        """Test inventory analytics endpoint"""
        if "analytics" not in self.test_tokens:
            self.log_result("Analytics Inventory", False, "No analytics token available")
            return
        
        token = self.test_tokens["analytics"]
        
        try:
            # Test without authentication first
            response = await self.client.get(f"{self.base_url}/analytics/inventory")
            
            if response.status_code == 401:
                self.log_result("Analytics Inventory - No Auth", True, "Correctly rejected request without authentication")
            else:
                self.log_result("Analytics Inventory - No Auth", False, f"Expected 401, got {response.status_code}")
            
            # Test with valid authentication
            response = await self.client.get(
                f"{self.base_url}/analytics/inventory",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ["total_items", "total_value", "category_distribution", "status_distribution", 
                                 "top_items_by_value", "low_stock_alerts", "in_stock_count", "low_stock_count"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("Analytics Inventory", False, f"Missing required fields: {missing_fields}", data)
                    return
                
                # Validate array fields
                if not isinstance(data["category_distribution"], list):
                    self.log_result("Analytics Inventory", False, "category_distribution should be a list", data)
                    return
                
                if not isinstance(data["status_distribution"], list):
                    self.log_result("Analytics Inventory", False, "status_distribution should be a list", data)
                    return
                
                if not isinstance(data["top_items_by_value"], list):
                    self.log_result("Analytics Inventory", False, "top_items_by_value should be a list", data)
                    return
                
                if not isinstance(data["low_stock_alerts"], list):
                    self.log_result("Analytics Inventory", False, "low_stock_alerts should be a list", data)
                    return
                
                # Validate top_items_by_value is limited to 10
                if len(data["top_items_by_value"]) > 10:
                    self.log_result("Analytics Inventory", False, f"top_items_by_value should be limited to 10, got {len(data['top_items_by_value'])}", data)
                    return
                
                # Validate status_distribution has expected statuses
                status_names = [item["status"] for item in data["status_distribution"]]
                expected_statuses = ["in-stock", "low-stock"]
                missing_statuses = [s for s in expected_statuses if s not in status_names]
                
                if missing_statuses:
                    self.log_result("Analytics Inventory", False, f"Missing status types: {missing_statuses}", data)
                    return
                
                # Validate count consistency
                total_from_status = sum(item["count"] for item in data["status_distribution"])
                if total_from_status != data["total_items"]:
                    self.log_result("Analytics Inventory", False, f"Status count mismatch: status sum {total_from_status} != total_items {data['total_items']}", data)
                    return
                
                self.log_result("Analytics Inventory", True, f"Inventory analytics retrieved successfully with {data['total_items']} items and {len(data['category_distribution'])} categories", data)
                
            else:
                self.log_result("Analytics Inventory", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Analytics Inventory", False, f"Exception: {str(e)}")

    async def test_analytics_multi_tenant_isolation(self):
        """Test that analytics endpoints enforce multi-tenant isolation"""
        if "analytics" not in self.test_tokens:
            self.log_result("Analytics Multi-Tenant Isolation", False, "No analytics token available")
            return
        
        # Create a second company for isolation testing
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        company_b_data = {
            "name": "Analytics Test Company B",
            "industry": "Healthcare", 
            "size": "Small (1-50)",
            "contact_email": f"analytics.b.{timestamp}@testcompany.com",
            "phone": "+201987654321"
        }
        
        admin_b_email = f"analytics.admin.b.{timestamp}@testcompany.com"
        admin_b_password = "analyticspass123"
        
        try:
            # Create Company B
            response_b = await self.client.post(
                f"{self.base_url}/auth/register-company",
                json=company_b_data,
                params={
                    "user_email": admin_b_email,
                    "user_password": admin_b_password,
                    "user_full_name": "Analytics Admin B"
                },
                headers={"Content-Type": "application/json"}
            )
            
            if response_b.status_code != 200:
                self.log_result("Analytics Multi-Tenant Isolation", False, f"Could not create Company B: {response_b.status_code}")
                return
            
            company_b_token = response_b.json()["access_token"]
            
            # Test that Company B sees empty/different analytics data
            endpoints = [
                ("overview", "/analytics/overview"),
                ("financial", "/analytics/financial"),
                ("hr", "/analytics/hr"),
                ("inventory", "/analytics/inventory")
            ]
            
            for endpoint_name, endpoint_path in endpoints:
                try:
                    response = await self.client.get(
                        f"{self.base_url}{endpoint_path}",
                        headers={"Authorization": f"Bearer {company_b_token}"}
                    )
                    
                    if response.status_code == 200:
                        data = response.json()
                        
                        # Company B should have empty/zero data since it's new
                        if endpoint_name == "overview":
                            hr_totals = sum(data["hr_analytics"].values())
                            fin_totals = data["financial_analytics"]["total_customers"] + data["financial_analytics"]["total_suppliers"]
                            inv_totals = data["inventory_analytics"]["total_items"]
                            
                            if hr_totals == 0 and fin_totals == 0 and inv_totals == 0:
                                self.log_result(f"Analytics {endpoint_name.title()} - Company B Isolation", True, "Company B correctly shows empty data (proper isolation)")
                            else:
                                self.log_result(f"Analytics {endpoint_name.title()} - Company B Isolation", False, f"Company B shows non-zero data: HR={hr_totals}, Fin={fin_totals}, Inv={inv_totals}")
                        
                        elif endpoint_name == "financial":
                            if data["total_customers"] == 0 and data["total_suppliers"] == 0:
                                self.log_result(f"Analytics {endpoint_name.title()} - Company B Isolation", True, "Company B correctly shows empty financial data")
                            else:
                                self.log_result(f"Analytics {endpoint_name.title()} - Company B Isolation", False, f"Company B shows financial data: customers={data['total_customers']}, suppliers={data['total_suppliers']}")
                        
                        elif endpoint_name == "hr":
                            if data["total_employees"] == 0:
                                self.log_result(f"Analytics {endpoint_name.title()} - Company B Isolation", True, "Company B correctly shows empty HR data")
                            else:
                                self.log_result(f"Analytics {endpoint_name.title()} - Company B Isolation", False, f"Company B shows HR data: employees={data['total_employees']}")
                        
                        elif endpoint_name == "inventory":
                            if data["total_items"] == 0:
                                self.log_result(f"Analytics {endpoint_name.title()} - Company B Isolation", True, "Company B correctly shows empty inventory data")
                            else:
                                self.log_result(f"Analytics {endpoint_name.title()} - Company B Isolation", False, f"Company B shows inventory data: items={data['total_items']}")
                    
                    else:
                        self.log_result(f"Analytics {endpoint_name.title()} - Company B Isolation", False, f"Expected 200, got {response.status_code}")
                        
                except Exception as e:
                    self.log_result(f"Analytics {endpoint_name.title()} - Company B Isolation", False, f"Exception: {str(e)}")
                    
        except Exception as e:
            self.log_result("Analytics Multi-Tenant Isolation", False, f"Exception: {str(e)}")

    # ==================== INVENTORY API TESTING ====================

    async def test_inventory_api_with_existing_user(self):
        """Test Inventory API with existing test user: test-logo@example.com"""
        print("\n🔍 Testing with existing user: test-logo@example.com")
        
        # Login with existing test user
        login_data = {
            "email": "test-logo@example.com",
            "password": "testpass123"
        }
        
        try:
            login_response = await self.client.post(
                f"{self.base_url}/auth/login",
                json=login_data,
                headers={"Content-Type": "application/json"}
            )
            
            if login_response.status_code != 200:
                self.log_result("Existing User Login", False, f"Could not login existing user: {login_response.status_code}")
                return
                
            login_data_response = login_response.json()
            existing_user_token = login_data_response["access_token"]
            user_info = login_data_response["user"]
            
            self.log_result("Existing User Login", True, f"Successfully logged in as {user_info.get('full_name')} ({user_info.get('role')})")
            
        except Exception as e:
            self.log_result("Existing User Login", False, f"Exception: {str(e)}")
            return
        
        # Test 1: GET /api/inventory/items - List existing items
        try:
            response = await self.client.get(
                f"{self.base_url}/inventory/items",
                headers={"Authorization": f"Bearer {existing_user_token}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Existing User - GET Items", True, f"Retrieved {len(data)} inventory items")
                else:
                    self.log_result("Existing User - GET Items", False, f"Expected list, got {type(data)}")
            else:
                self.log_result("Existing User - GET Items", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Existing User - GET Items", False, f"Exception: {str(e)}")
        
        # Test 2: POST /api/inventory/items - Create new item (General Manager should succeed)
        test_item = {
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
                json=test_item,
                headers={
                    "Authorization": f"Bearer {existing_user_token}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                expected_total_value = test_item["quantity"] * test_item["unit_price"]  # 100 * 25.50 = 2550
                expected_status = "in-stock"  # quantity (100) > min_stock (20)
                
                if data.get("total_value") == expected_total_value and data.get("status") == expected_status:
                    created_item_id = data.get("id")
                    self.log_result("Existing User - POST Item", True, f"Item created successfully with correct calculations")
                else:
                    self.log_result("Existing User - POST Item", False, f"Calculation error: expected total_value={expected_total_value}, got {data.get('total_value')}")
            else:
                self.log_result("Existing User - POST Item", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Existing User - POST Item", False, f"Exception: {str(e)}")
        
        # Test 3: GET /api/inventory/items{item_id} - Get specific item
        if created_item_id:
            try:
                response = await self.client.get(
                    f"{self.base_url}/inventory/items{created_item_id}",
                    headers={"Authorization": f"Bearer {existing_user_token}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("name") == test_item["name"]:
                        self.log_result("Existing User - GET Specific Item", True, f"Retrieved specific item: {data.get('name')}")
                    else:
                        self.log_result("Existing User - GET Specific Item", False, f"Item name mismatch")
                else:
                    self.log_result("Existing User - GET Specific Item", False, f"Expected 200, got {response.status_code}")
                    
            except Exception as e:
                self.log_result("Existing User - GET Specific Item", False, f"Exception: {str(e)}")
        
        # Test 4: PUT /api/inventory/items{item_id} - Update item
        if created_item_id:
            update_data = {
                "quantity": 75.0,  # Reduce quantity
                "min_stock": 80.0  # Increase min_stock to test low-stock status
            }
            
            try:
                response = await self.client.put(
                    f"{self.base_url}/inventory/items{created_item_id}",
                    json=update_data,
                    headers={
                        "Authorization": f"Bearer {existing_user_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    expected_total_value = update_data["quantity"] * test_item["unit_price"]  # 75 * 25.50 = 1912.5
                    expected_status = "low-stock"  # quantity (75) <= min_stock (80)
                    
                    if data.get("total_value") == expected_total_value and data.get("status") == expected_status:
                        self.log_result("Existing User - PUT Item", True, f"Item updated with correct status change to low-stock")
                    else:
                        self.log_result("Existing User - PUT Item", False, f"Update calculation error")
                else:
                    self.log_result("Existing User - PUT Item", False, f"Expected 200, got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result("Existing User - PUT Item", False, f"Exception: {str(e)}")
        
        # Test 5: DELETE /api/inventory/items{item_id} - Delete item
        if created_item_id:
            try:
                response = await self.client.delete(
                    f"{self.base_url}/inventory/items{created_item_id}",
                    headers={"Authorization": f"Bearer {existing_user_token}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if "deleted successfully" in data.get("message", "").lower():
                        self.log_result("Existing User - DELETE Item", True, f"Item deleted successfully")
                    else:
                        self.log_result("Existing User - DELETE Item", False, f"Unexpected response: {data.get('message')}")
                else:
                    self.log_result("Existing User - DELETE Item", False, f"Expected 200, got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result("Existing User - DELETE Item", False, f"Exception: {str(e)}")

    async def test_inventory_api_comprehensive(self):
        """Comprehensive Inventory Management API Testing"""
        if "A" not in self.test_companies:
            self.log_result("Inventory API Comprehensive", False, "Company A not available")
            return
            
        company_a = self.test_companies["A"]
        
        # Test 1: Authentication Testing - Missing Authorization Header
        try:
            response = await self.client.get(f"{self.base_url}/inventory/items")
            
            if response.status_code == 401:
                data = response.json()
                if "authorization header" in data.get("detail", "").lower():
                    self.log_result("Inventory Auth - Missing Header", True, "Correctly rejected missing auth header")
                else:
                    self.log_result("Inventory Auth - Missing Header", False, f"Wrong error message: {data.get('detail')}")
            else:
                self.log_result("Inventory Auth - Missing Header", False, f"Expected 401, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Inventory Auth - Missing Header", False, f"Exception: {str(e)}")
        
        # Test 2: Authentication Testing - Invalid Token
        try:
            response = await self.client.get(
                f"{self.base_url}/inventory/items",
                headers={"Authorization": "Bearer invalid_token_123"}
            )
            
            if response.status_code == 401:
                data = response.json()
                if "invalid" in data.get("detail", "").lower() or "expired" in data.get("detail", "").lower():
                    self.log_result("Inventory Auth - Invalid Token", True, "Correctly rejected invalid token")
                else:
                    self.log_result("Inventory Auth - Invalid Token", False, f"Wrong error message: {data.get('detail')}")
            else:
                self.log_result("Inventory Auth - Invalid Token", False, f"Expected 401, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Inventory Auth - Invalid Token", False, f"Exception: {str(e)}")
        
        # Test 3: GET /api/inventory/items - List Items (Empty for new company)
        try:
            response = await self.client.get(
                f"{self.base_url}/inventory/items",
                headers={"Authorization": f"Bearer {company_a['token']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Inventory GET Items - Empty List", True, f"Retrieved {len(data)} items for new company (expected empty)")
                else:
                    self.log_result("Inventory GET Items - Empty List", False, f"Expected list, got {type(data)}")
            else:
                self.log_result("Inventory GET Items - Empty List", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Inventory GET Items - Empty List", False, f"Exception: {str(e)}")
        
        # Test 4: POST /api/inventory/items - Create Item as General Manager (Should Succeed)
        inventory_item_data = {
            "name": "Laptop Computer",
            "category": "Finished Products",
            "quantity": 50.0,
            "unit": "pcs",
            "unit_price": 1200.0,
            "min_stock": 10.0
        }
        
        created_item_id = None
        
        try:
            response = await self.client.post(
                f"{self.base_url}/inventory/items",
                json=inventory_item_data,
                headers={
                    "Authorization": f"Bearer {company_a['token']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ["id", "name", "category", "quantity", "unit", "unit_price", "total_value", "min_stock", "status"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("Inventory POST - General Manager", False, f"Missing fields: {missing_fields}")
                else:
                    # Validate automatic calculations
                    expected_total_value = inventory_item_data["quantity"] * inventory_item_data["unit_price"]
                    expected_status = "in-stock"  # quantity (50) > min_stock (10)
                    
                    if data.get("total_value") == expected_total_value and data.get("status") == expected_status:
                        created_item_id = data.get("id")
                        self.test_data["inventory_item_id"] = created_item_id
                        self.log_result("Inventory POST - General Manager", True, f"Item created with correct calculations: total_value={expected_total_value}, status={expected_status}")
                    else:
                        self.log_result("Inventory POST - General Manager", False, f"Calculation error: expected total_value={expected_total_value}, got {data.get('total_value')}")
            else:
                self.log_result("Inventory POST - General Manager", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Inventory POST - General Manager", False, f"Exception: {str(e)}")
        
        # Test 5: POST /api/inventory/items - Create Item as Financial Manager (Should Succeed)
        if "users" in company_a and "Financial Manager" in company_a["users"]:
            financial_item_data = {
                "name": "Office Chair",
                "category": "Supplies",
                "quantity": 25.0,
                "unit": "pcs",
                "unit_price": 150.0,
                "min_stock": 5.0
            }
            
            try:
                financial_token = company_a["users"]["Financial Manager"]["token"]
                response = await self.client.post(
                    f"{self.base_url}/inventory/items",
                    json=financial_item_data,
                    headers={
                        "Authorization": f"Bearer {financial_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    expected_total_value = financial_item_data["quantity"] * financial_item_data["unit_price"]
                    if data.get("total_value") == expected_total_value:
                        self.log_result("Inventory POST - Financial Manager", True, f"Financial Manager can create items successfully")
                    else:
                        self.log_result("Inventory POST - Financial Manager", False, f"Calculation error in Financial Manager creation")
                else:
                    self.log_result("Inventory POST - Financial Manager", False, f"Expected 200, got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result("Inventory POST - Financial Manager", False, f"Exception: {str(e)}")
        
        # Test 6: POST /api/inventory/items - Create Item as Accountant (Should Fail 403)
        if "users" in company_a and "Accountant" in company_a["users"]:
            accountant_item_data = {
                "name": "Unauthorized Item",
                "category": "Supplies",
                "quantity": 10.0,
                "unit": "pcs",
                "unit_price": 50.0,
                "min_stock": 2.0
            }
            
            try:
                accountant_token = company_a["users"]["Accountant"]["token"]
                response = await self.client.post(
                    f"{self.base_url}/inventory/items",
                    json=accountant_item_data,
                    headers={
                        "Authorization": f"Bearer {accountant_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 403:
                    data = response.json()
                    if "insufficient permissions" in data.get("detail", "").lower():
                        self.log_result("Inventory POST - Accountant Denied", True, "Correctly denied Accountant create access")
                    else:
                        self.log_result("Inventory POST - Accountant Denied", False, f"Wrong error message: {data.get('detail')}")
                else:
                    self.log_result("Inventory POST - Accountant Denied", False, f"Expected 403, got {response.status_code}")
                    
            except Exception as e:
                self.log_result("Inventory POST - Accountant Denied", False, f"Exception: {str(e)}")
        
        # Test 7: GET /api/inventory/items - List Items After Creation (Multi-tenant isolation)
        try:
            response = await self.client.get(
                f"{self.base_url}/inventory/items",
                headers={"Authorization": f"Bearer {company_a['token']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    # Check that all items belong to Company A
                    company_a_items = [item for item in data if item.get("name") in ["Laptop Computer", "Office Chair"]]
                    if len(company_a_items) >= 1:  # At least the laptop should be there
                        self.log_result("Inventory GET Items - After Creation", True, f"Retrieved {len(data)} items for Company A only")
                    else:
                        self.log_result("Inventory GET Items - After Creation", False, "Created items not found in list")
                else:
                    self.log_result("Inventory GET Items - After Creation", False, f"Expected list, got {type(data)}")
            else:
                self.log_result("Inventory GET Items - After Creation", False, f"Expected 200, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Inventory GET Items - After Creation", False, f"Exception: {str(e)}")
        
        # Test 8: GET /api/inventory/items{item_id} - Get Specific Item
        if created_item_id:
            try:
                response = await self.client.get(
                    f"{self.base_url}/inventory/items{created_item_id}",
                    headers={"Authorization": f"Bearer {company_a['token']}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("name") == "Laptop Computer" and data.get("id") == created_item_id:
                        self.log_result("Inventory GET Specific Item", True, f"Retrieved specific item successfully: {data.get('name')}")
                    else:
                        self.log_result("Inventory GET Specific Item", False, f"Item data mismatch: expected Laptop Computer, got {data.get('name')}")
                else:
                    self.log_result("Inventory GET Specific Item", False, f"Expected 200, got {response.status_code}")
                    
            except Exception as e:
                self.log_result("Inventory GET Specific Item", False, f"Exception: {str(e)}")
        
        # Test 9: GET /api/inventory/items{item_id} - Non-existent Item (404)
        try:
            response = await self.client.get(
                f"{self.base_url}/inventory/itemsnon-existent-item-id",
                headers={"Authorization": f"Bearer {company_a['token']}"}
            )
            
            if response.status_code == 404:
                data = response.json()
                if "not found" in data.get("detail", "").lower():
                    self.log_result("Inventory GET Non-existent Item", True, "Correctly returned 404 for non-existent item")
                else:
                    self.log_result("Inventory GET Non-existent Item", False, f"Wrong error message: {data.get('detail')}")
            else:
                self.log_result("Inventory GET Non-existent Item", False, f"Expected 404, got {response.status_code}")
                
        except Exception as e:
            self.log_result("Inventory GET Non-existent Item", False, f"Exception: {str(e)}")
        
        # Test 10: PUT /api/inventory/items{item_id} - Update Item as General Manager
        if created_item_id:
            update_data = {
                "quantity": 30.0,  # Reduce quantity to test low-stock status
                "unit_price": 1300.0  # Increase price
            }
            
            try:
                response = await self.client.put(
                    f"{self.base_url}/inventory/items{created_item_id}",
                    json=update_data,
                    headers={
                        "Authorization": f"Bearer {company_a['token']}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    expected_total_value = update_data["quantity"] * update_data["unit_price"]  # 30 * 1300 = 39000
                    expected_status = "in-stock"  # quantity (30) > min_stock (10)
                    
                    if data.get("total_value") == expected_total_value and data.get("status") == expected_status:
                        self.log_result("Inventory PUT - Update Item", True, f"Item updated with recalculated values: total_value={expected_total_value}")
                    else:
                        self.log_result("Inventory PUT - Update Item", False, f"Update calculation error: expected total_value={expected_total_value}, got {data.get('total_value')}")
                else:
                    self.log_result("Inventory PUT - Update Item", False, f"Expected 200, got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result("Inventory PUT - Update Item", False, f"Exception: {str(e)}")
        
        # Test 11: PUT /api/inventory/items{item_id} - Update as Accountant (Should Fail 403)
        if created_item_id and "users" in company_a and "Accountant" in company_a["users"]:
            update_data = {"quantity": 100.0}
            
            try:
                accountant_token = company_a["users"]["Accountant"]["token"]
                response = await self.client.put(
                    f"{self.base_url}/inventory/items{created_item_id}",
                    json=update_data,
                    headers={
                        "Authorization": f"Bearer {accountant_token}",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 403:
                    data = response.json()
                    if "insufficient permissions" in data.get("detail", "").lower():
                        self.log_result("Inventory PUT - Accountant Denied", True, "Correctly denied Accountant update access")
                    else:
                        self.log_result("Inventory PUT - Accountant Denied", False, f"Wrong error message: {data.get('detail')}")
                else:
                    self.log_result("Inventory PUT - Accountant Denied", False, f"Expected 403, got {response.status_code}")
                    
            except Exception as e:
                self.log_result("Inventory PUT - Accountant Denied", False, f"Exception: {str(e)}")
        
        # Test 12: DELETE /api/inventory/items{item_id} - Delete as Accountant (Should Fail 403)
        if created_item_id and "users" in company_a and "Accountant" in company_a["users"]:
            try:
                accountant_token = company_a["users"]["Accountant"]["token"]
                response = await self.client.delete(
                    f"{self.base_url}/inventory/items{created_item_id}",
                    headers={"Authorization": f"Bearer {accountant_token}"}
                )
                
                if response.status_code == 403:
                    data = response.json()
                    if "insufficient permissions" in data.get("detail", "").lower():
                        self.log_result("Inventory DELETE - Accountant Denied", True, "Correctly denied Accountant delete access")
                    else:
                        self.log_result("Inventory DELETE - Accountant Denied", False, f"Wrong error message: {data.get('detail')}")
                else:
                    self.log_result("Inventory DELETE - Accountant Denied", False, f"Expected 403, got {response.status_code}")
                    
            except Exception as e:
                self.log_result("Inventory DELETE - Accountant Denied", False, f"Exception: {str(e)}")
        
        # Test 13: DELETE /api/inventory/items{item_id} - Delete as General Manager (Should Succeed)
        if created_item_id:
            try:
                response = await self.client.delete(
                    f"{self.base_url}/inventory/items{created_item_id}",
                    headers={"Authorization": f"Bearer {company_a['token']}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if "deleted successfully" in data.get("message", "").lower():
                        self.log_result("Inventory DELETE - General Manager", True, f"Item deleted successfully: {data.get('item_id')}")
                    else:
                        self.log_result("Inventory DELETE - General Manager", False, f"Unexpected response: {data.get('message')}")
                else:
                    self.log_result("Inventory DELETE - General Manager", False, f"Expected 200, got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result("Inventory DELETE - General Manager", False, f"Exception: {str(e)}")
        
        # Test 14: GET /api/inventory/items{item_id} - Verify Deletion (Should Return 404)
        if created_item_id:
            try:
                response = await self.client.get(
                    f"{self.base_url}/inventory/items{created_item_id}",
                    headers={"Authorization": f"Bearer {company_a['token']}"}
                )
                
                if response.status_code == 404:
                    self.log_result("Inventory GET After Delete", True, "Correctly returned 404 after deletion")
                else:
                    self.log_result("Inventory GET After Delete", False, f"Expected 404, got {response.status_code}")
                    
            except Exception as e:
                self.log_result("Inventory GET After Delete", False, f"Exception: {str(e)}")
        
        # Test 15: Multi-tenant Isolation - Company B cannot access Company A items
        if "B" in self.test_companies:
            try:
                company_b_token = self.test_companies["B"]["token"]
                response = await self.client.get(
                    f"{self.base_url}/inventory/items",
                    headers={"Authorization": f"Bearer {company_b_token}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list) and len(data) == 0:
                        self.log_result("Inventory Multi-tenant Isolation", True, "Company B cannot see Company A inventory items")
                    else:
                        self.log_result("Inventory Multi-tenant Isolation", False, f"Company B can see {len(data)} items (should be 0)")
                else:
                    self.log_result("Inventory Multi-tenant Isolation", False, f"Expected 200, got {response.status_code}")
                    
            except Exception as e:
                self.log_result("Inventory Multi-tenant Isolation", False, f"Exception: {str(e)}")

    async def run_user_management_tests(self):
        """Run focused User Management API tests based on review request"""
        print("🚀 Starting User Management API Testing...")
        print(f"Backend URL: {self.base_url}")
        print("=" * 80)
        
        await self.setup()
        
        try:
            # Setup: Login with existing General Manager credentials
            print("\n🔐 AUTHENTICATION SETUP")
            print("-" * 40)
            
            # Use the provided test credentials
            login_data = {
                "email": "test-logo@example.com",
                "password": "testpass123"
            }
            
            response = await self.client.post(
                f"{self.base_url}/auth/login",
                json=login_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.test_tokens["admin"] = data["access_token"]
                self.test_users["admin"] = data["user"]
                self.test_company = {
                    "id": data["user"]["company_id"],
                    "email": login_data["email"],
                    "password": login_data["password"]
                }
                self.log_result("Login with Test Credentials", True, f"Successfully logged in as {data['user']['email']}")
            else:
                self.log_result("Login with Test Credentials", False, f"Login failed: {response.status_code} - {response.text}")
                return self.test_results
            
            # User Management Tests
            print("\n👥 USER MANAGEMENT API TESTS")
            print("-" * 40)
            
            # Test 1: GET /api/users - List Users
            await self.test_list_users_detailed()
            
            # Test 2: POST /api/users - Add New User
            await self.test_add_new_user_detailed()
            
            # Test 3: Error Cases
            await self.test_duplicate_email_error()
            await self.test_invalid_role_error()
            await self.test_unauthorized_access()
            await self.test_insufficient_permissions()
            
            # Test 4: Photo Upload Endpoint
            await self.test_user_photo_upload()
            
        except Exception as e:
            self.log_result("User Management Testing", False, f"Exception during testing: {str(e)}")
        finally:
            await self.cleanup()
        
        # Print Summary
        print("\n" + "=" * 80)
        print("📊 USER MANAGEMENT TEST SUMMARY")
        print("=" * 80)
        
        total_tests = len(self.test_results)
        passed_tests = len([r for r in self.test_results if r["success"]])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS ({failed_tests}):")
            print("-" * 40)
            for result in self.test_results:
                if not result["success"]:
                    print(f"• {result['test']}: {result['details']}")
        
        print("\n🎉 User Management Testing completed!")
        return self.test_results

    async def test_list_users_detailed(self):
        """Test GET /api/users - List Users with detailed validation"""
        if "admin" not in self.test_tokens:
            self.log_result("GET /api/users - List Users", False, "No admin token available")
            return None
            
        try:
            response = await self.client.get(
                f"{self.base_url}/users",
                headers={"Authorization": f"Bearer {self.test_tokens['admin']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response is a list
                if not isinstance(data, list):
                    self.log_result("GET /api/users - List Users", False, 
                                  f"Expected list, got {type(data)}", data)
                    return None
                
                # Validate at least one user exists (the General Manager)
                if len(data) < 1:
                    self.log_result("GET /api/users - List Users", False, 
                                  "Expected at least 1 user (General Manager)", data)
                    return None
                
                # Validate user structure
                for user in data:
                    required_fields = ["id", "email", "full_name", "company_id", "role", "is_active"]
                    missing_fields = [field for field in required_fields if field not in user]
                    
                    if missing_fields:
                        self.log_result("GET /api/users - List Users", False, 
                                      f"User missing required fields: {missing_fields}", user)
                        return None
                
                # Check if all users belong to the same company
                company_id = self.test_company["id"]
                for user in data:
                    if user.get("company_id") != company_id:
                        self.log_result("GET /api/users - List Users", False, 
                                      f"User belongs to different company: {user.get('company_id')} vs {company_id}", user)
                        return None
                
                self.log_result("GET /api/users - List Users", True, 
                              f"Successfully retrieved {len(data)} users for company", data)
                return data
            else:
                self.log_result("GET /api/users - List Users", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("GET /api/users - List Users", False, f"Exception: {str(e)}")
            return None

    async def test_add_new_user_detailed(self):
        """Test POST /api/users - Add New User with detailed validation"""
        if "admin" not in self.test_tokens:
            self.log_result("POST /api/users - Add New User", False, "No admin token available")
            return None
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        user_data = {
            "full_name": "Test User New",
            "email": f"testuser.{timestamp}@example.com",
            "password": "testpass123",
            "role": "Accountant"
        }
        
        try:
            response = await self.client.post(
                f"{self.base_url}/users",
                json=user_data,
                headers={
                    "Authorization": f"Bearer {self.test_tokens['admin']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ["id", "email", "full_name", "company_id", "role", "is_active"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("POST /api/users - Add New User", False, 
                                  f"Missing required fields: {missing_fields}", data)
                    return None
                
                # Validate user data matches input
                if data.get("email") != user_data["email"]:
                    self.log_result("POST /api/users - Add New User", False, 
                                  f"Email mismatch: expected {user_data['email']}, got {data.get('email')}", data)
                    return None
                
                if data.get("full_name") != user_data["full_name"]:
                    self.log_result("POST /api/users - Add New User", False, 
                                  f"Name mismatch: expected {user_data['full_name']}, got {data.get('full_name')}", data)
                    return None
                
                if data.get("role") != user_data["role"]:
                    self.log_result("POST /api/users - Add New User", False, 
                                  f"Role mismatch: expected {user_data['role']}, got {data.get('role')}", data)
                    return None
                
                # Validate company_id is set correctly
                if data.get("company_id") != self.test_company["id"]:
                    self.log_result("POST /api/users - Add New User", False, 
                                  f"Company ID mismatch: expected {self.test_company['id']}, got {data.get('company_id')}", data)
                    return None
                
                # Validate user is active
                if not data.get("is_active"):
                    self.log_result("POST /api/users - Add New User", False, 
                                  "New user should be active", data)
                    return None
                
                # Store for later tests
                self.test_users["new_user"] = data
                
                self.log_result("POST /api/users - Add New User", True, 
                              f"User created successfully: {data.get('email')} with ID {data.get('id')}", data)
                return data
            else:
                self.log_result("POST /api/users - Add New User", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("POST /api/users - Add New User", False, f"Exception: {str(e)}")
            return None

    async def test_duplicate_email_error(self):
        """Test POST /api/users with duplicate email (should fail with 400)"""
        if "admin" not in self.test_tokens:
            self.log_result("Duplicate Email Error", False, "No admin token available")
            return
            
        # Try to create user with existing email
        user_data = {
            "full_name": "Duplicate User",
            "email": "test-logo@example.com",  # Same as General Manager
            "password": "testpass123",
            "role": "HR Manager"
        }
        
        try:
            response = await self.client.post(
                f"{self.base_url}/users",
                json=user_data,
                headers={
                    "Authorization": f"Bearer {self.test_tokens['admin']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 400:
                data = response.json()
                if "already exists" in data.get("detail", "").lower():
                    self.log_result("Duplicate Email Error", True, 
                                  "Correctly rejected duplicate email", data)
                else:
                    self.log_result("Duplicate Email Error", False, 
                                  f"Wrong error message: {data.get('detail')}", data)
            else:
                self.log_result("Duplicate Email Error", False, 
                              f"Expected 400, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Duplicate Email Error", False, f"Exception: {str(e)}")

    async def test_invalid_role_error(self):
        """Test POST /api/users with invalid role (should fail with 400)"""
        if "admin" not in self.test_tokens:
            self.log_result("Invalid Role Error", False, "No admin token available")
            return
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        user_data = {
            "full_name": "Invalid Role User",
            "email": f"invalid.{timestamp}@example.com",
            "password": "testpass123",
            "role": "Invalid Role"
        }
        
        try:
            response = await self.client.post(
                f"{self.base_url}/users",
                json=user_data,
                headers={
                    "Authorization": f"Bearer {self.test_tokens['admin']}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 400:
                data = response.json()
                if "invalid role" in data.get("detail", "").lower():
                    self.log_result("Invalid Role Error", True, 
                                  "Correctly rejected invalid role", data)
                else:
                    self.log_result("Invalid Role Error", False, 
                                  f"Wrong error message: {data.get('detail')}", data)
            else:
                self.log_result("Invalid Role Error", False, 
                              f"Expected 400, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Invalid Role Error", False, f"Exception: {str(e)}")

    async def test_unauthorized_access(self):
        """Test POST /api/users without authentication (should fail with 401)"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        user_data = {
            "full_name": "Unauthorized User",
            "email": f"unauthorized.{timestamp}@example.com",
            "password": "testpass123",
            "role": "Accountant"
        }
        
        try:
            response = await self.client.post(
                f"{self.base_url}/users",
                json=user_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 401:
                data = response.json()
                if "authorization header missing" in data.get("detail", "").lower():
                    self.log_result("Unauthorized Access", True, 
                                  "Correctly rejected request without authentication", data)
                else:
                    self.log_result("Unauthorized Access", False, 
                                  f"Wrong error message: {data.get('detail')}", data)
            else:
                self.log_result("Unauthorized Access", False, 
                              f"Expected 401, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Unauthorized Access", False, f"Exception: {str(e)}")

    async def test_insufficient_permissions(self):
        """Test Accountant trying to add user (should fail with 403)"""
        # First, create an Accountant user if we don't have one
        if "new_user" not in self.test_users:
            self.log_result("Insufficient Permissions", False, "No Accountant user available for testing")
            return
            
        # Login as the Accountant
        accountant_email = self.test_users["new_user"]["email"]
        login_data = {
            "email": accountant_email,
            "password": "testpass123"
        }
        
        try:
            login_response = await self.client.post(
                f"{self.base_url}/auth/login",
                json=login_data,
                headers={"Content-Type": "application/json"}
            )
            
            if login_response.status_code != 200:
                self.log_result("Insufficient Permissions", False, 
                              f"Could not login as Accountant: {login_response.status_code}")
                return
                
            accountant_token = login_response.json()["access_token"]
            
            # Try to add user as Accountant (should fail)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            user_data = {
                "full_name": "Forbidden User",
                "email": f"forbidden.{timestamp}@example.com",
                "password": "testpass123",
                "role": "HR Manager"
            }
            
            response = await self.client.post(
                f"{self.base_url}/users",
                json=user_data,
                headers={
                    "Authorization": f"Bearer {accountant_token}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 403:
                data = response.json()
                if "insufficient permissions" in data.get("detail", "").lower():
                    self.log_result("Insufficient Permissions", True, 
                                  "Correctly denied Accountant user creation", data)
                else:
                    self.log_result("Insufficient Permissions", False, 
                                  f"Wrong error message: {data.get('detail')}", data)
            else:
                self.log_result("Insufficient Permissions", False, 
                              f"Expected 403, got {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Insufficient Permissions", False, f"Exception: {str(e)}")

    async def test_user_photo_upload(self):
        """Test POST /api/users{user_id}/upload-photo endpoint"""
        if "new_user" not in self.test_users:
            self.log_result("User Photo Upload", False, "No test user available")
            return
            
        user_id = self.test_users["new_user"]["id"]
        
        # Create a simple test image content
        test_image_content = b"fake_image_content_for_testing"
        
        try:
            files = {"file": ("test_photo.jpg", test_image_content, "image/jpeg")}
            
            response = await self.client.post(
                f"{self.base_url}/users{user_id}/upload-photo",
                files=files,
                headers={"Authorization": f"Bearer {self.test_tokens['admin']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ["message", "photo_url"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_result("User Photo Upload", False, 
                                  f"Missing required fields: {missing_fields}", data)
                    return None
                
                if "successfully" not in data.get("message", "").lower():
                    self.log_result("User Photo Upload", False, 
                                  f"Unexpected message: {data.get('message')}", data)
                    return None
                
                # Verify photo_url format
                photo_url = data.get("photo_url")
                if not photo_url or not photo_url.startswith("/uploads/users"):
                    self.log_result("User Photo Upload", False, 
                                  f"Invalid photo_url format: {photo_url}", data)
                    return None
                
                self.log_result("User Photo Upload", True, 
                              f"Photo uploaded successfully: {photo_url}", data)
                return data
            else:
                self.log_result("User Photo Upload", False, 
                              f"Expected 200, got {response.status_code}", response.text)
                return None
                
        except Exception as e:
            self.log_result("User Photo Upload", False, f"Exception: {str(e)}")
            return None

    async def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting Comprehensive Multi-Tenant Backend API Tests...")
        print(f"Backend URL: {self.base_url}")
        print("=" * 80)
        
        await self.setup()
        
        try:
            # Test API health first
            await self.test_api_health()
            
            print("\n📋 PHASE 1: Basic RBAC System Testing")
            print("-" * 50)
            
            # Test company registration and authentication
            await self.test_company_registration()
            await self.test_duplicate_company_registration()
            await self.test_duplicate_user_registration()
            
            # Test login functionality
            await self.test_login_success()
            await self.test_login_invalid_email()
            await self.test_login_wrong_password()
            
            # Test token verification
            await self.test_token_verification_valid()
            await self.test_token_verification_invalid()
            await self.test_token_verification_missing_header()
            
            # Test password reset functionality (NEW FEATURE)
            print("\n🔑 Password Reset Testing")
            print("-" * 30)
            reset_result = await self.test_password_reset_valid_email()
            if reset_result and "new_password" in reset_result:
                self.reset_password_data = reset_result
                await self.test_login_with_reset_password()
            await self.test_password_reset_invalid_email()
            await self.test_password_reset_missing_email()
            
            # Test user management
            await self.test_list_users()
            await self.test_add_hr_manager()
            await self.test_add_financial_manager()
            await self.test_add_accountant()
            await self.test_permission_denied_non_admin()
            await self.test_update_user_role()
            await self.test_delete_user()
            await self.test_cannot_delete_self()
            
            # Test company API
            await self.test_get_company_details()
            
            # Test roles and permissions
            await self.test_list_roles()
            await self.test_get_role_permissions()
            
            # Test company logo upload functionality
            await self.test_upload_logo_as_general_manager()
            await self.test_upload_non_image_file()
            await self.test_upload_logo_without_auth()
            await self.test_upload_logo_as_accountant()
            await self.test_get_company_with_logo_url()
            
            print("\n🏢 PHASE 2: Multi-Tenant Setup")
            print("-" * 50)
            
            # Setup multi-tenant companies
            if await self.setup_multi_tenant_companies():
                await self.create_company_a_users()
                
                print("\n👥 PHASE 3: HR APIs Testing")
                print("-" * 50)
                
                # Test HR APIs
                await self.test_hr_employees_api()
                await self.test_hr_allowances_api()
                await self.test_hr_deductions_api()
                await self.test_hr_leaves_api()
                await self.test_hr_attendance_api()
                
                print("\n💰 PHASE 4: Financial APIs Testing")
                print("-" * 50)
                
                # Test Financial APIs
                await self.test_financial_journal_entries_api()
                await self.test_financial_treasury_api()
                await self.test_financial_bank_api()
                await self.test_financial_customers_api()
                await self.test_financial_suppliers_api()
                
                print("\n📦 PHASE 5: Inventory APIs Testing")
                print("-" * 50)
                
                # Test Inventory APIs with existing user first
                await self.test_inventory_api_with_existing_user()
                
                # Test Inventory APIs with multi-tenant setup
                await self.test_inventory_api_comprehensive()
                
                print("\n📊 PHASE 6: Analytics APIs Testing")
                print("-" * 50)
                
                # Test Analytics APIs
                await self.test_analytics_overview_authentication()
                await self.test_analytics_overview_success()
                await self.test_analytics_overview_periods()
                await self.test_analytics_financial_endpoint()
                await self.test_analytics_hr_endpoint()
                await self.test_analytics_inventory_endpoint()
                await self.test_analytics_multi_tenant_isolation()
                
                print("\n🔒 PHASE 7: Multi-Tenant Isolation Testing")
                print("-" * 50)
                
                # Test multi-tenant isolation
                await self.test_multi_tenant_isolation()
                
                print("\n🔐 PHASE 8: Authentication Testing")
                print("-" * 50)
                
                # Test authentication requirements
                await self.test_endpoints_without_auth()
                await self.test_endpoints_with_invalid_token()
            else:
                print("❌ Multi-tenant setup failed, skipping advanced tests")
            
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

    # ==================== EXISTING USER COMPREHENSIVE TESTING ====================
    
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

    async def test_existing_user_company_details(self):
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

    async def test_existing_user_logo_upload(self):
        """Test company logo upload"""
        if "existing_user" not in self.test_tokens or "existing_user" not in self.test_users:
            self.log_result("Logo Upload", False, "No existing user data available")
            return
            
        company_id = self.test_users["existing_user"].get("company_id")
        if not company_id:
            self.log_result("Logo Upload", False, "No company_id available")
            return
            
        test_image_content = b"fake_image_content_for_testing"
        
        try:
            files = {"file": ("test_logo.jpg", test_image_content, "image/jpeg")}
            
            response = await self.client.post(
                f"{self.base_url}/companies/{company_id}/upload-logo",
                files=files,
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Logo Upload", True, f"Logo uploaded: {data.get('logo_url')}")
            else:
                self.log_result("Logo Upload", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Logo Upload", False, f"Exception: {str(e)}")

    async def test_existing_user_list_users(self):
        """Test GET /api/users"""
        if "existing_user" not in self.test_tokens:
            self.log_result("List Users", False, "No existing user token available")
            return
            
        try:
            response = await self.client.get(
                f"{self.base_url}/users/",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("List Users", True, f"Retrieved {len(data)} users")
                return data
            else:
                self.log_result("List Users", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("List Users", False, f"Exception: {str(e)}")

    async def test_existing_user_create_user(self):
        """Test POST /api/users"""
        if "existing_user" not in self.test_tokens:
            self.log_result("Create User", False, "No existing user token available")
            return
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        user_data = {
            "email": f"test.user.{timestamp}@company.com",
            "full_name": "Test User",
            "role": "Accountant",
            "password": "testpass123"
        }
        
        try:
            response = await self.client.post(
                f"{self.base_url}/users",
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
                return data
            else:
                self.log_result("Create User", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Create User", False, f"Exception: {str(e)}")

    async def test_existing_user_update_user(self):
        """Test PUT /api/users{id}"""
        if "existing_user" not in self.test_tokens or "created_user_id" not in self.test_data:
            self.log_result("Update User", False, "No user data available for update")
            return
            
        user_id = self.test_data["created_user_id"]
        
        try:
            response = await self.client.put(
                f"{self.base_url}/users{user_id}/role",
                params={"role": "HR Manager"},
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Update User", True, f"Updated user role to: {data.get('role')}")
            else:
                self.log_result("Update User", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Update User", False, f"Exception: {str(e)}")

    async def test_existing_user_delete_user(self):
        """Test DELETE /api/users{id}"""
        if "existing_user" not in self.test_tokens or "created_user_id" not in self.test_data:
            self.log_result("Delete User", False, "No user data available for deletion")
            return
            
        user_id = self.test_data["created_user_id"]
        
        try:
            response = await self.client.delete(
                f"{self.base_url}/users{user_id}",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Delete User", True, "User deleted successfully")
            else:
                self.log_result("Delete User", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Delete User", False, f"Exception: {str(e)}")

    async def test_existing_user_upload_photo(self):
        """Test POST /api/users{id}/upload-photo"""
        if "existing_user" not in self.test_tokens or "existing_user" not in self.test_users:
            self.log_result("Upload Photo", False, "No existing user data available")
            return
            
        user_id = self.test_users["existing_user"].get("id")
        test_image_content = b"fake_photo_content_for_testing"
        
        try:
            files = {"file": ("profile.jpg", test_image_content, "image/jpeg")}
            
            response = await self.client.post(
                f"{self.base_url}/users{user_id}/upload-photo",
                files=files,
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Upload Photo", True, "Profile photo uploaded successfully")
            else:
                self.log_result("Upload Photo", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Upload Photo", False, f"Exception: {str(e)}")

    async def test_existing_user_hr_employees(self):
        """Test HR Employees API"""
        if "existing_user" not in self.test_tokens:
            self.log_result("HR Employees", False, "No existing user token available")
            return
            
        # Test GET
        try:
            response = await self.client.get(
                f"{self.base_url}/hr/employees",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("HR Employees GET", True, f"Retrieved {len(data)} employees")
            else:
                self.log_result("HR Employees GET", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("HR Employees GET", False, f"Exception: {str(e)}")
        
        # Test POST
        company_id = self.test_users["existing_user"].get("company_id") if "existing_user" in self.test_users else None
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
        
        try:
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
            self.log_result("HR Employees POST", False, f"Exception: {str(e)}")

    async def test_existing_user_hr_allowances(self):
        """Test HR Allowances API"""
        if "existing_user" not in self.test_tokens:
            self.log_result("HR Allowances", False, "No existing user token available")
            return
            
        # Test GET
        try:
            response = await self.client.get(
                f"{self.base_url}/hr/allowances",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("HR Allowances GET", True, f"Retrieved {len(data)} allowances")
            else:
                self.log_result("HR Allowances GET", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("HR Allowances GET", False, f"Exception: {str(e)}")
        
        # Test POST
        company_id = self.test_users["existing_user"].get("company_id") if "existing_user" in self.test_users else None
        allowance_data = {
            "company_id": company_id,
            "employee_id": self.test_data.get("employee_id", "emp_123"),
            "employee_name": "Ahmed Hassan",
            "type": "Transport",
            "amount": 1500.0,
            "month": "2024-12"
        }
        
        try:
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
            self.log_result("HR Allowances POST", False, f"Exception: {str(e)}")

    async def test_existing_user_hr_deductions(self):
        """Test HR Deductions API"""
        if "existing_user" not in self.test_tokens:
            self.log_result("HR Deductions", False, "No existing user token available")
            return
            
        # Test GET
        try:
            response = await self.client.get(
                f"{self.base_url}/hr/deductions",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("HR Deductions GET", True, f"Retrieved {len(data)} deductions")
            else:
                self.log_result("HR Deductions GET", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("HR Deductions GET", False, f"Exception: {str(e)}")
        
        # Test POST
        deduction_data = {
            "company_id": company_id,
            "employee_id": self.test_data.get("employee_id", "emp_123"),
            "employee_name": "Ahmed Hassan",
            "type": "Insurance",
            "amount": 500.0,
            "month": "2024-12"
        }
        
        try:
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
            self.log_result("HR Deductions POST", False, f"Exception: {str(e)}")

    async def test_existing_user_hr_leaves(self):
        """Test HR Leaves API"""
        if "existing_user" not in self.test_tokens:
            self.log_result("HR Leaves", False, "No existing user token available")
            return
            
        # Test GET
        try:
            response = await self.client.get(
                f"{self.base_url}/hr/leaves",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("HR Leaves GET", True, f"Retrieved {len(data)} leave records")
            else:
                self.log_result("HR Leaves GET", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("HR Leaves GET", False, f"Exception: {str(e)}")
        
        # Test POST
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
        
        try:
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
            self.log_result("HR Leaves POST", False, f"Exception: {str(e)}")

    async def test_existing_user_hr_attendance(self):
        """Test HR Attendance API"""
        if "existing_user" not in self.test_tokens:
            self.log_result("HR Attendance", False, "No existing user token available")
            return
            
        # Test GET
        try:
            response = await self.client.get(
                f"{self.base_url}/hr/attendance",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("HR Attendance GET", True, f"Retrieved {len(data)} attendance records")
            else:
                self.log_result("HR Attendance GET", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("HR Attendance GET", False, f"Exception: {str(e)}")
        
        # Test POST
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
        
        try:
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
            self.log_result("HR Attendance POST", False, f"Exception: {str(e)}")

    async def test_existing_user_financial_journal_entries(self):
        """Test Financial Journal Entries API"""
        if "existing_user" not in self.test_tokens:
            self.log_result("Financial Journal Entries", False, "No existing user token available")
            return
            
        # Test GET
        try:
            response = await self.client.get(
                f"{self.base_url}/financial/journal-entries",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Financial Journal Entries GET", True, f"Retrieved {len(data)} journal entries")
            else:
                self.log_result("Financial Journal Entries GET", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Financial Journal Entries GET", False, f"Exception: {str(e)}")
        
        # Test POST
        journal_data = {
            "company_id": company_id,
            "date": "2024-12-15",
            "description": "Office supplies purchase",
            "account": "Office Expenses",
            "debit": 2500.0,
            "credit": 0.0
        }
        
        try:
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
                self.test_data["journal_entry_id"] = data.get("id")
                self.log_result("Financial Journal Entries POST", True, f"Created journal entry: {data.get('description')}")
            else:
                self.log_result("Financial Journal Entries POST", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Financial Journal Entries POST", False, f"Exception: {str(e)}")

    async def test_existing_user_financial_customers(self):
        """Test Financial Customers API"""
        if "existing_user" not in self.test_tokens:
            self.log_result("Financial Customers", False, "No existing user token available")
            return
            
        # Test GET
        try:
            response = await self.client.get(
                f"{self.base_url}/financial/customers",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Financial Customers GET", True, f"Retrieved {len(data)} customers")
            else:
                self.log_result("Financial Customers GET", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Financial Customers GET", False, f"Exception: {str(e)}")
        
        # Test POST
        customer_data = {
            "company_id": company_id,
            "name": "Mahmoud Ali Trading",
            "email": "mahmoud@alitrading.com",
            "phone": "+201555666777",
            "address": "123 Commerce Street, Cairo",
            "balance": 25000.0
        }
        
        try:
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
            self.log_result("Financial Customers POST", False, f"Exception: {str(e)}")

    async def test_existing_user_financial_suppliers(self):
        """Test Financial Suppliers API"""
        if "existing_user" not in self.test_tokens:
            self.log_result("Financial Suppliers", False, "No existing user token available")
            return
            
        # Test GET
        try:
            response = await self.client.get(
                f"{self.base_url}/financial/suppliers",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Financial Suppliers GET", True, f"Retrieved {len(data)} suppliers")
            else:
                self.log_result("Financial Suppliers GET", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Financial Suppliers GET", False, f"Exception: {str(e)}")
        
        # Test POST
        supplier_data = {
            "company_id": company_id,
            "name": "Tech Solutions Provider",
            "email": "sales@techsolutions.com",
            "phone": "+201444555666",
            "address": "456 Technology Park, Giza",
            "balance": -15000.0
        }
        
        try:
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
            self.log_result("Financial Suppliers POST", False, f"Exception: {str(e)}")

    async def test_existing_user_financial_treasury(self):
        """Test Financial Treasury API"""
        if "existing_user" not in self.test_tokens:
            self.log_result("Financial Treasury", False, "No existing user token available")
            return
            
        # Test GET
        try:
            response = await self.client.get(
                f"{self.base_url}/financial/treasury",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Financial Treasury GET", True, f"Retrieved {len(data)} treasury transactions")
            else:
                self.log_result("Financial Treasury GET", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Financial Treasury GET", False, f"Exception: {str(e)}")
        
        # Test POST
        treasury_data = {
            "company_id": company_id,
            "date": "2024-12-15",
            "description": "Cash deposit from sales",
            "type": "in",
            "amount": 50000.0
        }
        
        try:
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
            self.log_result("Financial Treasury POST", False, f"Exception: {str(e)}")

    async def test_existing_user_financial_bank(self):
        """Test Financial Bank API"""
        if "existing_user" not in self.test_tokens:
            self.log_result("Financial Bank", False, "No existing user token available")
            return
            
        # Test GET
        try:
            response = await self.client.get(
                f"{self.base_url}/financial/bank",
                headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log_result("Financial Bank GET", True, f"Retrieved {len(data)} bank transactions")
            else:
                self.log_result("Financial Bank GET", False, f"Expected 200, got {response.status_code}: {response.text}")
                
        except Exception as e:
            self.log_result("Financial Bank GET", False, f"Exception: {str(e)}")
        
        # Test POST
        bank_data = {
            "company_id": company_id,
            "date": "2024-12-15",
            "description": "Client payment received",
            "bank_name": "National Bank of Egypt",
            "type": "deposit",
            "amount": 75000.0,
            "balance": 125000.0
        }
        
        try:
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
            self.log_result("Financial Bank POST", False, f"Exception: {str(e)}")

    async def test_existing_user_inventory_management(self):
        """Test Inventory Management APIs"""
        if "existing_user" not in self.test_tokens:
            self.log_result("Inventory Management", False, "No existing user token available")
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
        
        # Test GET /api/inventory/items{id}
        if created_item_id:
            try:
                response = await self.client.get(
                    f"{self.base_url}/inventory/items{created_item_id}",
                    headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    self.log_result("Inventory Item GET by ID", True, f"Retrieved item: {data.get('name')}")
                else:
                    self.log_result("Inventory Item GET by ID", False, f"Expected 200, got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result("Inventory Item GET by ID", False, f"Exception: {str(e)}")
        
        # Test PUT /api/inventory/items{id}
        if created_item_id:
            update_data = {
                "quantity": 75.0,
                "min_stock": 80.0
            }
            
            try:
                response = await self.client.put(
                    f"{self.base_url}/inventory/items{created_item_id}",
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
        
        # Test DELETE /api/inventory/items{id}
        if created_item_id:
            try:
                response = await self.client.delete(
                    f"{self.base_url}/inventory/items{created_item_id}",
                    headers={"Authorization": f"Bearer {self.test_tokens['existing_user']}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    self.log_result("Inventory Item DELETE", True, "Item deleted successfully")
                else:
                    self.log_result("Inventory Item DELETE", False, f"Expected 200, got {response.status_code}: {response.text}")
                    
            except Exception as e:
                self.log_result("Inventory Item DELETE", False, f"Exception: {str(e)}")

    async def test_existing_user_analytics_overview(self):
        """Test Analytics Overview API"""
        if "existing_user" not in self.test_tokens:
            self.log_result("Analytics Overview", False, "No existing user token available")
            return
            
        periods = ["monthly", "daily", "yearly"]
        
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

    async def test_existing_user_analytics_financial(self):
        """Test Analytics Financial API"""
        if "existing_user" not in self.test_tokens:
            self.log_result("Analytics Financial", False, "No existing user token available")
            return
            
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

    async def test_existing_user_analytics_hr(self):
        """Test Analytics HR API"""
        if "existing_user" not in self.test_tokens:
            self.log_result("Analytics HR", False, "No existing user token available")
            return
            
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

    async def test_existing_user_analytics_inventory(self):
        """Test Analytics Inventory API"""
        if "existing_user" not in self.test_tokens:
            self.log_result("Analytics Inventory", False, "No existing user token available")
            return
            
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
        """Run comprehensive validation of all backend APIs with existing user credentials"""
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
            await self.test_existing_user_company_details()
            await self.test_existing_user_logo_upload()
            
            print("\n👥 PHASE 2: User Management APIs")
            print("-" * 60)
            
            # Test user management with existing user
            await self.test_existing_user_list_users()
            await self.test_existing_user_create_user()
            await self.test_existing_user_update_user()
            await self.test_existing_user_delete_user()
            await self.test_existing_user_upload_photo()
            
            print("\n👔 PHASE 3: HR Module APIs")
            print("-" * 60)
            
            # Test all HR APIs
            await self.test_existing_user_hr_employees()
            await self.test_existing_user_hr_allowances()
            await self.test_existing_user_hr_deductions()
            await self.test_existing_user_hr_leaves()
            await self.test_existing_user_hr_attendance()
            
            print("\n💰 PHASE 4: Financial Module APIs")
            print("-" * 60)
            
            # Test all Financial APIs
            await self.test_existing_user_financial_journal_entries()
            await self.test_existing_user_financial_customers()
            await self.test_existing_user_financial_suppliers()
            await self.test_existing_user_financial_treasury()
            await self.test_existing_user_financial_bank()
            
            print("\n📦 PHASE 5: Inventory Management APIs")
            print("-" * 60)
            
            # Test inventory APIs
            await self.test_existing_user_inventory_management()
            
            print("\n📊 PHASE 6: Analytics APIs")
            print("-" * 60)
            
            # Test analytics APIs
            await self.test_existing_user_analytics_overview()
            await self.test_existing_user_analytics_financial()
            await self.test_existing_user_analytics_hr()
            await self.test_existing_user_analytics_inventory()
            
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
    tester = MultiTenantAPITester()
    results = await tester.run_all_tests()
    
    # Return exit code based on test results
    failed_count = sum(1 for result in results if not result["success"])
    return 0 if failed_count == 0 else 1

async def main_comprehensive_validation():
    """Comprehensive Backend API Validation with existing user credentials"""
    tester = MultiTenantAPITester()
    results = await tester.run_comprehensive_validation()
    
    # Return exit code based on test results
    failed_count = sum(1 for result in results if not result["success"])
    return 0 if failed_count == 0 else 1

async def main_user_management():
    """User Management focused test runner"""
    tester = MultiTenantAPITester()
    results = await tester.run_user_management_tests()
    
    # Return exit code based on test results
    failed_count = sum(1 for result in results if not result["success"])
    return 0 if failed_count == 0 else 1

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "user_management":
        exit_code = asyncio.run(main_user_management())
    elif len(sys.argv) > 1 and sys.argv[1] == "comprehensive":
        exit_code = asyncio.run(main_comprehensive_validation())
    elif len(sys.argv) > 1 and sys.argv[1] == "datalife":
        exit_code = asyncio.run(main_datalife_account())
    else:
        exit_code = asyncio.run(main())
    exit(exit_code)

# ==================== DATALIFE ACCOUNT SPECIFIC TESTS ====================

async def main_datalife_account():
    """DataLife Account focused test runner"""
    tester = MultiTenantAPITester()
    results = await tester.run_datalife_account_tests()
    
    # Return exit code based on test results
    failed_count = sum(1 for result in results if not result["success"])
    return 0 if failed_count == 0 else 1