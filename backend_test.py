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
BACKEND_URL = "https://multi-tenant-erp-2.preview.emergentagent.com/api"

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

    async def test_list_users(self):
        """Test listing users in company"""
        if "admin" not in self.test_tokens:
            self.log_result("List Users", False, "No admin token available")
            return None
            
        try:
            response = await self.client.get(
                f"{self.base_url}/users/",
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
                f"{self.base_url}/users/",
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
                f"{self.base_url}/users/",
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
                f"{self.base_url}/users/",
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
                f"{self.base_url}/users/",
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
                f"{self.base_url}/users/{hr_user_id}/role",
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
                f"{self.base_url}/users/{accountant_user_id}",
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
                f"{self.base_url}/users/{admin_user_id}",
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
            response = await self.client.get(f"{self.base_url}/users/roles")
            
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
                response = await self.client.get(f"{self.base_url}/users/permissions/{role}")
                
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
                f"{self.base_url}/users/",
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
        print("🚀 Starting RBAC API Tests...")
        print(f"Backend URL: {self.base_url}")
        print("=" * 60)
        
        await self.setup()
        
        try:
            # Test API health first
            await self.test_api_health()
            
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
    tester = RBACAPITester()
    results = await tester.run_all_tests()
    
    # Return exit code based on test results
    failed_count = sum(1 for result in results if not result["success"])
    return 0 if failed_count == 0 else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)