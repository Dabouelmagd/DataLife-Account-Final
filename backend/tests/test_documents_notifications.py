"""
Test Suite for Documents Module and Task Notifications
Features tested:
1. Documents CRUD - folders, upload, download, delete
2. Documents categories and stats
3. Task notifications - due-soon, overdue, check-and-send
"""

import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "dalia@ddaadvertising.net"
TEST_PASSWORD = "Dalia@2024"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    data = response.json()
    return data.get("access_token") or data.get("token")


@pytest.fixture
def api_client(auth_token):
    """Session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    })
    return session


class TestDocumentCategories:
    """Test document categories endpoint"""
    
    def test_get_categories(self, api_client):
        """Get document categories - should return predefined categories"""
        response = api_client.get(f"{BASE_URL}/api/documents/categories")
        assert response.status_code == 200, f"Failed to get categories: {response.text}"
        
        categories = response.json()
        assert isinstance(categories, list)
        assert len(categories) > 0
        
        # Check category structure
        for cat in categories:
            assert "id" in cat
            assert "name_en" in cat
            assert "name_ar" in cat
        
        # Verify expected categories exist
        category_ids = [c["id"] for c in categories]
        expected = ["contracts", "invoices", "hr", "financial", "legal", "policies", "reports", "other"]
        for exp_id in expected:
            assert exp_id in category_ids, f"Expected category '{exp_id}' not found"
        
        print(f"✓ Got {len(categories)} document categories")


class TestDocumentStats:
    """Test document statistics endpoint"""
    
    def test_get_stats(self, api_client):
        """Get document statistics"""
        response = api_client.get(f"{BASE_URL}/api/documents/stats")
        assert response.status_code == 200, f"Failed to get stats: {response.text}"
        
        stats = response.json()
        # Check stats structure
        assert "total_documents" in stats
        assert "total_size_bytes" in stats
        assert "total_size_mb" in stats
        assert "by_category" in stats
        assert "by_type" in stats
        assert "recent_uploads" in stats
        
        assert isinstance(stats["total_documents"], int)
        assert isinstance(stats["total_size_mb"], (int, float))
        
        print(f"✓ Stats: {stats['total_documents']} documents, {stats['total_size_mb']} MB")


class TestDocumentFolders:
    """Test folder CRUD operations"""
    
    @pytest.fixture
    def test_folder(self, api_client):
        """Create a test folder and cleanup after"""
        folder_data = {
            "name": "TEST_Folder_Pytest",
            "description": "Test folder for pytest",
            "color": "#6366f1"
        }
        response = api_client.post(
            f"{BASE_URL}/api/documents/folders",
            json=folder_data
        )
        assert response.status_code == 200, f"Failed to create test folder: {response.text}"
        folder = response.json()
        
        yield folder
        
        # Cleanup
        try:
            api_client.delete(f"{BASE_URL}/api/documents/folders/{folder['id']}")
        except:
            pass
    
    def test_create_folder(self, api_client):
        """Create a new folder"""
        folder_data = {
            "name": "TEST_Create_Folder",
            "description": "Created via pytest",
            "color": "#ef4444"
        }
        response = api_client.post(
            f"{BASE_URL}/api/documents/folders",
            json=folder_data
        )
        assert response.status_code == 200, f"Failed to create folder: {response.text}"
        
        folder = response.json()
        assert folder["name"] == folder_data["name"]
        assert folder["description"] == folder_data["description"]
        assert folder["color"] == folder_data["color"]
        assert "id" in folder
        
        print(f"✓ Created folder: {folder['id']}")
        
        # Cleanup
        api_client.delete(f"{BASE_URL}/api/documents/folders/{folder['id']}")
    
    def test_get_folders(self, api_client, test_folder):
        """Get all folders"""
        response = api_client.get(f"{BASE_URL}/api/documents/folders")
        assert response.status_code == 200, f"Failed to get folders: {response.text}"
        
        folders = response.json()
        assert isinstance(folders, list)
        
        # Find our test folder
        folder_ids = [f["id"] for f in folders]
        assert test_folder["id"] in folder_ids, "Test folder not found in list"
        
        print(f"✓ Got {len(folders)} folders")
    
    def test_update_folder(self, api_client, test_folder):
        """Update a folder"""
        update_data = {
            "name": "TEST_Updated_Folder",
            "description": "Updated description",
            "color": "#22c55e"
        }
        response = api_client.put(
            f"{BASE_URL}/api/documents/folders/{test_folder['id']}",
            json=update_data
        )
        assert response.status_code == 200, f"Failed to update folder: {response.text}"
        
        # Verify update
        result = response.json()
        assert result.get("success") == True
        print(f"✓ Updated folder: {test_folder['id']}")
    
    def test_delete_folder(self, api_client):
        """Delete a folder"""
        # Create folder to delete
        folder_data = {"name": "TEST_Delete_Folder", "description": "", "color": "#000000"}
        create_response = api_client.post(f"{BASE_URL}/api/documents/folders", json=folder_data)
        assert create_response.status_code == 200
        folder = create_response.json()
        
        # Delete folder
        response = api_client.delete(f"{BASE_URL}/api/documents/folders/{folder['id']}")
        assert response.status_code == 200, f"Failed to delete folder: {response.text}"
        
        # Verify deletion
        folders_response = api_client.get(f"{BASE_URL}/api/documents/folders")
        folder_ids = [f["id"] for f in folders_response.json()]
        assert folder["id"] not in folder_ids, "Folder still exists after deletion"
        
        print(f"✓ Deleted folder: {folder['id']}")


class TestDocumentUpload:
    """Test document upload, download, and delete"""
    
    @pytest.fixture
    def uploaded_doc(self, auth_token):
        """Upload a test document and cleanup after"""
        # Create a simple test file
        test_content = b"This is a test document for pytest testing"
        files = {
            'file': ('TEST_Document.txt', io.BytesIO(test_content), 'text/plain')
        }
        data = {
            'category': 'other',
            'tags': 'test,pytest'
        }
        
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/documents/upload",
            files=files,
            data=data,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to upload test document: {response.text}"
        doc = response.json()
        
        yield doc
        
        # Cleanup
        try:
            requests.delete(
                f"{BASE_URL}/api/documents/{doc['id']}?permanent=true",
                headers=headers
            )
        except:
            pass
    
    def test_upload_document(self, auth_token):
        """Upload a document"""
        test_content = b"Test file content for upload test"
        files = {
            'file': ('TEST_Upload.txt', io.BytesIO(test_content), 'text/plain')
        }
        data = {
            'category': 'contracts',
            'tags': 'test,upload'
        }
        
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.post(
            f"{BASE_URL}/api/documents/upload",
            files=files,
            data=data,
            headers=headers
        )
        assert response.status_code == 200, f"Failed to upload: {response.text}"
        
        doc = response.json()
        assert "id" in doc
        assert doc["name"] == "TEST_Upload.txt"
        assert doc["category"] == "contracts"
        assert "test" in doc["tags"]
        
        print(f"✓ Uploaded document: {doc['id']}")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/documents/{doc['id']}?permanent=true",
            headers=headers
        )
    
    def test_get_documents(self, api_client, uploaded_doc):
        """Get all documents"""
        response = api_client.get(f"{BASE_URL}/api/documents/")
        assert response.status_code == 200, f"Failed to get documents: {response.text}"
        
        docs = response.json()
        assert isinstance(docs, list)
        
        # Find our test document
        doc_ids = [d["id"] for d in docs]
        assert uploaded_doc["id"] in doc_ids, "Uploaded document not found in list"
        
        print(f"✓ Got {len(docs)} documents")
    
    def test_get_single_document(self, api_client, uploaded_doc):
        """Get single document by ID"""
        response = api_client.get(f"{BASE_URL}/api/documents/{uploaded_doc['id']}")
        assert response.status_code == 200, f"Failed to get document: {response.text}"
        
        doc = response.json()
        assert doc["id"] == uploaded_doc["id"]
        assert doc["name"] == uploaded_doc["name"]
        
        print(f"✓ Got document: {doc['id']}")
    
    def test_download_document(self, api_client, uploaded_doc):
        """Download a document"""
        response = api_client.get(f"{BASE_URL}/api/documents/{uploaded_doc['id']}/download")
        assert response.status_code == 200, f"Failed to download: {response.text}"
        
        data = response.json()
        assert "filename" in data
        assert "content" in data
        assert "mime_type" in data
        assert data["filename"] == uploaded_doc["name"]
        
        print(f"✓ Downloaded document: {data['filename']}")
    
    def test_delete_document(self, auth_token):
        """Delete a document"""
        # First upload a document
        test_content = b"Document to delete"
        files = {'file': ('TEST_Delete.txt', io.BytesIO(test_content), 'text/plain')}
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        upload_response = requests.post(
            f"{BASE_URL}/api/documents/upload",
            files=files,
            data={'category': 'other'},
            headers=headers
        )
        assert upload_response.status_code == 200
        doc = upload_response.json()
        
        # Archive (soft delete)
        response = requests.delete(
            f"{BASE_URL}/api/documents/{doc['id']}",
            headers=headers
        )
        assert response.status_code == 200, f"Failed to archive: {response.text}"
        
        # Permanent delete
        response = requests.delete(
            f"{BASE_URL}/api/documents/{doc['id']}?permanent=true",
            headers=headers
        )
        # May be 200 or 404 since it's archived
        assert response.status_code in [200, 404], f"Unexpected status: {response.status_code}"
        
        print(f"✓ Deleted document: {doc['id']}")


class TestDocumentSearch:
    """Test document search functionality"""
    
    def test_search_by_name(self, api_client):
        """Search documents by name"""
        response = api_client.get(f"{BASE_URL}/api/documents/?search=test")
        assert response.status_code == 200, f"Failed to search: {response.text}"
        
        docs = response.json()
        assert isinstance(docs, list)
        print(f"✓ Search returned {len(docs)} results")
    
    def test_filter_by_category(self, api_client):
        """Filter documents by category"""
        response = api_client.get(f"{BASE_URL}/api/documents/?category=contracts")
        assert response.status_code == 200, f"Failed to filter: {response.text}"
        
        docs = response.json()
        assert isinstance(docs, list)
        # All results should be in contracts category
        for doc in docs:
            assert doc["category"] == "contracts", f"Document {doc['id']} has wrong category"
        
        print(f"✓ Filter by category returned {len(docs)} results")


class TestTaskNotificationsDueSoon:
    """Test task notifications - due soon endpoint"""
    
    def test_get_due_soon_tasks(self, api_client):
        """Get tasks due soon"""
        response = api_client.get(f"{BASE_URL}/api/tasks/notifications/due-soon")
        assert response.status_code == 200, f"Failed to get due soon tasks: {response.text}"
        
        data = response.json()
        assert "due_today" in data
        assert "due_tomorrow" in data
        assert "due_within_3_days" in data
        assert "total_urgent" in data
        
        assert isinstance(data["due_today"], list)
        assert isinstance(data["due_tomorrow"], list)
        assert isinstance(data["due_within_3_days"], list)
        assert isinstance(data["total_urgent"], int)
        
        print(f"✓ Due soon: {data['total_urgent']} urgent tasks")


class TestTaskNotificationsOverdue:
    """Test task notifications - overdue endpoint"""
    
    def test_get_overdue_tasks(self, api_client):
        """Get overdue tasks"""
        response = api_client.get(f"{BASE_URL}/api/tasks/notifications/overdue")
        assert response.status_code == 200, f"Failed to get overdue tasks: {response.text}"
        
        data = response.json()
        assert "overdue_tasks" in data
        assert "total_overdue" in data
        
        assert isinstance(data["overdue_tasks"], list)
        assert isinstance(data["total_overdue"], int)
        
        print(f"✓ Overdue: {data['total_overdue']} overdue tasks")


class TestTaskNotificationsCheckAndSend:
    """Test task notifications - check and send endpoint"""
    
    def test_check_and_send_notifications(self, api_client):
        """Check and send task notifications"""
        response = api_client.post(f"{BASE_URL}/api/tasks/notifications/check-and-send")
        assert response.status_code == 200, f"Failed to check and send: {response.text}"
        
        data = response.json()
        assert "success" in data
        assert "notifications_created" in data
        assert "tasks_checked" in data
        
        assert data["success"] == True
        assert isinstance(data["notifications_created"], int)
        assert isinstance(data["tasks_checked"], int)
        
        print(f"✓ Checked {data['tasks_checked']} tasks, created {data['notifications_created']} notifications")


class TestUnauthorizedAccess:
    """Test that endpoints require authentication"""
    
    def test_documents_requires_auth(self):
        """Documents endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/documents/")
        assert response.status_code == 401
        print("✓ Documents endpoint requires auth")
    
    def test_folders_requires_auth(self):
        """Folders endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/documents/folders")
        assert response.status_code == 401
        print("✓ Folders endpoint requires auth")
    
    def test_stats_requires_auth(self):
        """Stats endpoint requires auth"""
        response = requests.get(f"{BASE_URL}/api/documents/stats")
        assert response.status_code == 401
        print("✓ Stats endpoint requires auth")
    
    def test_task_notifications_requires_auth(self):
        """Task notifications endpoints require auth"""
        response = requests.get(f"{BASE_URL}/api/tasks/notifications/due-soon")
        assert response.status_code == 401
        
        response = requests.get(f"{BASE_URL}/api/tasks/notifications/overdue")
        assert response.status_code == 401
        
        response = requests.post(f"{BASE_URL}/api/tasks/notifications/check-and-send")
        assert response.status_code == 401
        print("✓ Task notification endpoints require auth")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
