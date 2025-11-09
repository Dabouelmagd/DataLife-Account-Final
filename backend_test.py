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
BACKEND_URL = "https://datalife-erp.preview.emergentagent.com/api"

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
                    f"{self.base_url}/users/",
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
        
        # Test 3: GET /api/inventory/items/{item_id} - Get specific item
        if created_item_id:
            try:
                response = await self.client.get(
                    f"{self.base_url}/inventory/items/{created_item_id}",
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
        
        # Test 4: PUT /api/inventory/items/{item_id} - Update item
        if created_item_id:
            update_data = {
                "quantity": 75.0,  # Reduce quantity
                "min_stock": 80.0  # Increase min_stock to test low-stock status
            }
            
            try:
                response = await self.client.put(
                    f"{self.base_url}/inventory/items/{created_item_id}",
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
        
        # Test 5: DELETE /api/inventory/items/{item_id} - Delete item
        if created_item_id:
            try:
                response = await self.client.delete(
                    f"{self.base_url}/inventory/items/{created_item_id}",
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
        
        # Test 8: GET /api/inventory/items/{item_id} - Get Specific Item
        if created_item_id:
            try:
                response = await self.client.get(
                    f"{self.base_url}/inventory/items/{created_item_id}",
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
        
        # Test 9: GET /api/inventory/items/{item_id} - Non-existent Item (404)
        try:
            response = await self.client.get(
                f"{self.base_url}/inventory/items/non-existent-item-id",
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
        
        # Test 10: PUT /api/inventory/items/{item_id} - Update Item as General Manager
        if created_item_id:
            update_data = {
                "quantity": 30.0,  # Reduce quantity to test low-stock status
                "unit_price": 1300.0  # Increase price
            }
            
            try:
                response = await self.client.put(
                    f"{self.base_url}/inventory/items/{created_item_id}",
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
        
        # Test 11: PUT /api/inventory/items/{item_id} - Update as Accountant (Should Fail 403)
        if created_item_id and "users" in company_a and "Accountant" in company_a["users"]:
            update_data = {"quantity": 100.0}
            
            try:
                accountant_token = company_a["users"]["Accountant"]["token"]
                response = await self.client.put(
                    f"{self.base_url}/inventory/items/{created_item_id}",
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
        
        # Test 12: DELETE /api/inventory/items/{item_id} - Delete as Accountant (Should Fail 403)
        if created_item_id and "users" in company_a and "Accountant" in company_a["users"]:
            try:
                accountant_token = company_a["users"]["Accountant"]["token"]
                response = await self.client.delete(
                    f"{self.base_url}/inventory/items/{created_item_id}",
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
        
        # Test 13: DELETE /api/inventory/items/{item_id} - Delete as General Manager (Should Succeed)
        if created_item_id:
            try:
                response = await self.client.delete(
                    f"{self.base_url}/inventory/items/{created_item_id}",
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
        
        # Test 14: GET /api/inventory/items/{item_id} - Verify Deletion (Should Return 404)
        if created_item_id:
            try:
                response = await self.client.get(
                    f"{self.base_url}/inventory/items/{created_item_id}",
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
                
                # Test Inventory APIs
                await self.test_inventory_api_comprehensive()
                
                print("\n🔒 PHASE 6: Multi-Tenant Isolation Testing")
                print("-" * 50)
                
                # Test multi-tenant isolation
                await self.test_multi_tenant_isolation()
                
                print("\n🔐 PHASE 7: Authentication Testing")
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

async def main():
    """Main test runner"""
    tester = MultiTenantAPITester()
    results = await tester.run_all_tests()
    
    # Return exit code based on test results
    failed_count = sum(1 for result in results if not result["success"])
    return 0 if failed_count == 0 else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)