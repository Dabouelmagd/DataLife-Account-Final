#!/usr/bin/env python3
"""
Quick test to create a test user and verify password reset functionality
"""

import asyncio
import httpx
from datetime import datetime

BACKEND_URL = "https://perms-editor.preview.emergentagent.com/api"

async def test_create_user_and_password_reset():
    client = httpx.AsyncClient(timeout=30.0)
    
    try:
        # Create a test company and user first
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        company_data = {
            "name": f"Test Company {timestamp}",
            "industry": "Technology",
            "size": "Small (1-50)",
            "contact_email": f"test.{timestamp}@company.com",
            "phone": "+201234567890"
        }
        
        user_email = "dalia.abouelmagd@gmail.com"
        user_password = "testpass123"
        
        print("🔧 Creating test user...")
        
        # Try to register company with the specific email
        response = await client.post(
            f"{BACKEND_URL}/auth/register-company",
            json=company_data,
            params={
                "user_email": user_email,
                "user_password": user_password,
                "user_full_name": "Dalia Abouelmagd"
            },
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            print("✅ Test user created successfully")
            data = response.json()
            token = data["access_token"]
            
            # Now test password reset
            print("\n🔑 Testing password reset...")
            
            reset_response = await client.post(
                f"{BACKEND_URL}/auth/reset-password",
                json={"email": user_email},
                headers={"Content-Type": "application/json"}
            )
            
            if reset_response.status_code == 200:
                reset_data = reset_response.json()
                print("✅ Password reset successful")
                print(f"   Response: {reset_data}")
                
                # If we got a new password, test login with it
                if "new_password" in reset_data:
                    new_password = reset_data["new_password"]
                    print(f"\n🔐 Testing login with new password: {new_password}")
                    
                    login_response = await client.post(
                        f"{BACKEND_URL}/auth/login",
                        json={"email": user_email, "password": new_password},
                        headers={"Content-Type": "application/json"}
                    )
                    
                    if login_response.status_code == 200:
                        print("✅ Login with reset password successful")
                        login_data = login_response.json()
                        new_token = login_data["access_token"]
                        
                        # Test token verification
                        verify_response = await client.get(
                            f"{BACKEND_URL}/auth/verify",
                            headers={"Authorization": f"Bearer {new_token}"}
                        )
                        
                        if verify_response.status_code == 200:
                            print("✅ Token verification successful")
                            verify_data = verify_response.json()
                            print(f"   User: {verify_data.get('full_name')} ({verify_data.get('email')})")
                        else:
                            print(f"❌ Token verification failed: {verify_response.status_code}")
                    else:
                        print(f"❌ Login with reset password failed: {login_response.status_code}")
                        print(f"   Response: {login_response.text}")
                
            else:
                print(f"❌ Password reset failed: {reset_response.status_code}")
                print(f"   Response: {reset_response.text}")
                
        elif response.status_code == 400:
            print("ℹ️  User already exists, testing with existing user...")
            
            # Test login with existing credentials
            login_response = await client.post(
                f"{BACKEND_URL}/auth/login",
                json={"email": user_email, "password": user_password},
                headers={"Content-Type": "application/json"}
            )
            
            if login_response.status_code == 200:
                print("✅ Login with existing credentials successful")
                
                # Test password reset
                print("\n🔑 Testing password reset...")
                
                reset_response = await client.post(
                    f"{BACKEND_URL}/auth/reset-password",
                    json={"email": user_email},
                    headers={"Content-Type": "application/json"}
                )
                
                if reset_response.status_code == 200:
                    reset_data = reset_response.json()
                    print("✅ Password reset successful")
                    print(f"   Response: {reset_data}")
                else:
                    print(f"❌ Password reset failed: {reset_response.status_code}")
                    
            else:
                print(f"❌ Login failed: {login_response.status_code}")
                print(f"   Response: {login_response.text}")
        else:
            print(f"❌ User creation failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    finally:
        await client.aclose()

if __name__ == "__main__":
    asyncio.run(test_create_user_and_password_reset())