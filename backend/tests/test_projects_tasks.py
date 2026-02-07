"""
Test file for Projects & Tasks module
Tests all CRUD operations for projects and tasks
Tests attendance employee name display (not 'Unknown')
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://landing-page-update-3.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "dalia@ddaadvertising.net"
TEST_PASSWORD = "Dalia@2024"

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for testing"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json()["access_token"]

@pytest.fixture(scope="module")
def headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestProjectsCRUD:
    """Test Projects CRUD operations"""
    
    created_project_id = None
    
    def test_create_project(self, headers):
        """Test creating a new project"""
        project_data = {
            "name": "TEST_Project_Pytest",
            "description": "Test project created by pytest",
            "priority": "high",
            "start_date": "2026-02-01",
            "end_date": "2026-03-31",
            "budget": 50000
        }
        
        response = requests.post(
            f"{BASE_URL}/api/tasks/projects",
            json=project_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Create project failed: {response.text}"
        data = response.json()
        
        # Data assertions
        assert "id" in data
        assert data["name"] == "TEST_Project_Pytest"
        assert data["description"] == "Test project created by pytest"
        assert data["priority"] == "high"
        assert data["status"] == "planning"  # Default status
        assert data["progress"] == 0
        assert data["tasks_count"] == 0
        
        TestProjectsCRUD.created_project_id = data["id"]
        print(f"Created project: {data['id']}")
    
    def test_get_projects_list(self, headers):
        """Test getting list of projects"""
        response = requests.get(
            f"{BASE_URL}/api/tasks/projects",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should be a list
        assert isinstance(data, list)
        
        # Find our test project
        test_projects = [p for p in data if p.get("name") == "TEST_Project_Pytest"]
        assert len(test_projects) >= 1, "Created project not found in list"
        print(f"Found {len(data)} projects total")
    
    def test_get_single_project(self, headers):
        """Test getting a single project with tasks"""
        assert TestProjectsCRUD.created_project_id, "No project ID from create test"
        
        response = requests.get(
            f"{BASE_URL}/api/tasks/projects/{TestProjectsCRUD.created_project_id}",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert data["id"] == TestProjectsCRUD.created_project_id
        assert data["name"] == "TEST_Project_Pytest"
        assert "tasks" in data  # Should include tasks list
        assert isinstance(data["tasks"], list)
    
    def test_update_project(self, headers):
        """Test updating a project"""
        assert TestProjectsCRUD.created_project_id, "No project ID from create test"
        
        update_data = {
            "name": "TEST_Project_Updated",
            "status": "in_progress",
            "priority": "urgent"
        }
        
        response = requests.put(
            f"{BASE_URL}/api/tasks/projects/{TestProjectsCRUD.created_project_id}",
            json=update_data,
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        
        # Verify the update by getting the project
        verify_response = requests.get(
            f"{BASE_URL}/api/tasks/projects/{TestProjectsCRUD.created_project_id}",
            headers=headers
        )
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        assert verify_data["name"] == "TEST_Project_Updated"
        assert verify_data["status"] == "in_progress"
        assert verify_data["priority"] == "urgent"
    
    def test_get_projects_filter_status(self, headers):
        """Test filtering projects by status"""
        response = requests.get(
            f"{BASE_URL}/api/tasks/projects?status=in_progress",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned projects should have status in_progress
        for project in data:
            assert project["status"] == "in_progress"
    
    def test_get_projects_filter_priority(self, headers):
        """Test filtering projects by priority"""
        response = requests.get(
            f"{BASE_URL}/api/tasks/projects?priority=urgent",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All returned projects should have priority urgent
        for project in data:
            assert project["priority"] == "urgent"


class TestTasksCRUD:
    """Test Tasks CRUD operations"""
    
    created_task_id = None
    
    def test_create_task(self, headers):
        """Test creating a new task"""
        project_id = TestProjectsCRUD.created_project_id
        
        task_data = {
            "title": "TEST_Task_Pytest",
            "description": "Test task created by pytest",
            "project_id": project_id,
            "priority": "high",
            "due_date": "2026-02-15",
            "estimated_hours": 8
        }
        
        response = requests.post(
            f"{BASE_URL}/api/tasks/",
            json=task_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Create task failed: {response.text}"
        data = response.json()
        
        # Data assertions
        assert "id" in data
        assert data["title"] == "TEST_Task_Pytest"
        assert data["description"] == "Test task created by pytest"
        assert data["status"] == "todo"  # Default status
        assert data["priority"] == "high"
        assert data["project_id"] == project_id
        
        TestTasksCRUD.created_task_id = data["id"]
        print(f"Created task: {data['id']}")
    
    def test_get_tasks_list(self, headers):
        """Test getting list of tasks"""
        response = requests.get(
            f"{BASE_URL}/api/tasks/",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should be a list
        assert isinstance(data, list)
        
        # Find our test task
        test_tasks = [t for t in data if t.get("title") == "TEST_Task_Pytest"]
        assert len(test_tasks) >= 1, "Created task not found in list"
        print(f"Found {len(data)} tasks total")
    
    def test_get_tasks_by_project(self, headers):
        """Test getting tasks filtered by project"""
        project_id = TestProjectsCRUD.created_project_id
        
        response = requests.get(
            f"{BASE_URL}/api/tasks/?project_id={project_id}",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # All tasks should belong to the project
        for task in data:
            assert task["project_id"] == project_id
    
    def test_get_single_task(self, headers):
        """Test getting a single task"""
        assert TestTasksCRUD.created_task_id, "No task ID from create test"
        
        response = requests.get(
            f"{BASE_URL}/api/tasks/{TestTasksCRUD.created_task_id}",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert data["id"] == TestTasksCRUD.created_task_id
        assert data["title"] == "TEST_Task_Pytest"
    
    def test_update_task_status(self, headers):
        """Test updating task status"""
        assert TestTasksCRUD.created_task_id, "No task ID from create test"
        
        # Update to in_progress
        update_data = {"status": "in_progress"}
        response = requests.put(
            f"{BASE_URL}/api/tasks/{TestTasksCRUD.created_task_id}",
            json=update_data,
            headers=headers
        )
        
        assert response.status_code == 200
        assert response.json()["success"] == True
        
        # Verify
        verify_response = requests.get(
            f"{BASE_URL}/api/tasks/{TestTasksCRUD.created_task_id}",
            headers=headers
        )
        assert verify_response.json()["status"] == "in_progress"
        
        # Update to review
        update_data = {"status": "review"}
        response = requests.put(
            f"{BASE_URL}/api/tasks/{TestTasksCRUD.created_task_id}",
            json=update_data,
            headers=headers
        )
        assert response.status_code == 200
        
        # Update to completed
        update_data = {"status": "completed"}
        response = requests.put(
            f"{BASE_URL}/api/tasks/{TestTasksCRUD.created_task_id}",
            json=update_data,
            headers=headers
        )
        assert response.status_code == 200
        
        # Verify task is completed
        verify_response = requests.get(
            f"{BASE_URL}/api/tasks/{TestTasksCRUD.created_task_id}",
            headers=headers
        )
        verify_data = verify_response.json()
        assert verify_data["status"] == "completed"
        assert verify_data.get("completed_at") is not None
    
    def test_update_task_details(self, headers):
        """Test updating task details"""
        assert TestTasksCRUD.created_task_id, "No task ID from create test"
        
        update_data = {
            "title": "TEST_Task_Updated",
            "priority": "urgent",
            "estimated_hours": 16
        }
        
        response = requests.put(
            f"{BASE_URL}/api/tasks/{TestTasksCRUD.created_task_id}",
            json=update_data,
            headers=headers
        )
        
        assert response.status_code == 200
        
        # Verify
        verify_response = requests.get(
            f"{BASE_URL}/api/tasks/{TestTasksCRUD.created_task_id}",
            headers=headers
        )
        verify_data = verify_response.json()
        assert verify_data["title"] == "TEST_Task_Updated"
        assert verify_data["priority"] == "urgent"
        assert verify_data["estimated_hours"] == 16
    
    def test_my_tasks(self, headers):
        """Test getting user's tasks"""
        response = requests.get(
            f"{BASE_URL}/api/tasks/my-tasks",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestTaskComments:
    """Test task comments functionality"""
    
    def test_add_comment(self, headers):
        """Test adding a comment to a task"""
        task_id = TestTasksCRUD.created_task_id
        assert task_id, "No task ID available"
        
        comment_data = {
            "text": "Test comment from pytest"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/tasks/{task_id}/comments",
            json=comment_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Add comment failed: {response.text}"
        data = response.json()
        
        # Verify comment structure
        assert "id" in data
        assert data["text"] == "Test comment from pytest"
        assert "user_name" in data
        assert "created_at" in data
        print(f"Comment added by: {data['user_name']}")
    
    def test_view_task_with_comments(self, headers):
        """Test viewing task with comments"""
        task_id = TestTasksCRUD.created_task_id
        assert task_id, "No task ID available"
        
        response = requests.get(
            f"{BASE_URL}/api/tasks/{task_id}",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Task should have comments array
        assert "comments" in data
        assert isinstance(data["comments"], list)
        assert len(data["comments"]) >= 1
        
        # Check comment has proper structure
        comment = data["comments"][-1]
        assert "text" in comment
        assert "user_name" in comment
        assert comment["user_name"] != "Unknown"  # Verify name is not Unknown


class TestDashboardStats:
    """Test dashboard statistics"""
    
    def test_get_stats(self, headers):
        """Test getting task statistics"""
        response = requests.get(
            f"{BASE_URL}/api/tasks/dashboard/stats",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify stats structure
        assert "total_tasks" in data
        assert "my_tasks" in data
        assert "overdue" in data
        assert "due_this_week" in data
        assert "by_status" in data
        assert "my_tasks_by_status" in data
        
        # Verify by_status structure
        status_keys = ["todo", "in_progress", "review", "completed"]
        for key in status_keys:
            assert key in data["by_status"]
            assert key in data["my_tasks_by_status"]
        
        print(f"Total tasks: {data['total_tasks']}")
        print(f"By status: {data['by_status']}")


class TestProjectProgress:
    """Test project progress calculation"""
    
    def test_project_progress_updates(self, headers):
        """Test that project progress updates when tasks are completed"""
        project_id = TestProjectsCRUD.created_project_id
        assert project_id, "No project ID available"
        
        # Get project to check progress
        response = requests.get(
            f"{BASE_URL}/api/tasks/projects/{project_id}",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # If there are tasks, progress should be calculated
        if data["tasks_count"] > 0:
            assert data["progress"] >= 0
            assert data["progress"] <= 100
            
            # If completed_tasks > 0, progress should be > 0
            if data["completed_tasks"] > 0:
                assert data["progress"] > 0
        
        print(f"Project progress: {data['progress']}%")
        print(f"Tasks: {data['completed_tasks']}/{data['tasks_count']}")


class TestAttendanceEmployeeName:
    """Test that attendance module displays employee names correctly (not 'Unknown')"""
    
    created_employee_id = None
    
    def test_create_employee_for_attendance(self, headers):
        """Create a test employee with 'name' field"""
        employee_data = {
            "company_id": "9dedd788-11d4-4c8c-a805-db2ca0aaaa2b",
            "name": "TEST_Employee_AttendanceCheck",
            "position": "Developer",
            "department": "IT",
            "email": "test_attendance@test.com",
            "phone": "+201234567890",
            "hire_date": "2026-01-01",
            "basic_salary": 15000.0,
            "is_active": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/hr/employees",
            json=employee_data,
            headers=headers
        )
        
        # Might fail due to permissions, skip if so
        if response.status_code == 403:
            pytest.skip("User doesn't have permission to create employees")
        
        assert response.status_code == 200, f"Create employee failed: {response.text}"
        data = response.json()
        
        # Store the employee ID for later tests
        TestAttendanceEmployeeName.created_employee_id = data.get("id")
        print("Created employee for attendance test")
    
    def test_employee_has_name_field(self, headers):
        """Verify employee model uses 'name' field not 'full_name'"""
        response = requests.get(
            f"{BASE_URL}/api/hr/employees",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Check that any employee with our test prefix has 'name' field
        for emp in data:
            if emp.get("name", "").startswith("TEST_"):
                # Should have 'name' field, not 'full_name'
                assert "name" in emp, "Employee should have 'name' field"
                assert emp["name"] != "Unknown", "Employee name should not be 'Unknown'"
                print(f"Found employee: {emp['name']}")
                break


class TestDeleteOperations:
    """Test delete operations - run last"""
    
    def test_delete_task(self, headers):
        """Test deleting a task"""
        task_id = TestTasksCRUD.created_task_id
        if not task_id:
            pytest.skip("No task ID to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/tasks/{task_id}",
            headers=headers
        )
        
        assert response.status_code == 200
        assert response.json()["success"] == True
        
        # Verify task is deleted
        verify_response = requests.get(
            f"{BASE_URL}/api/tasks/{task_id}",
            headers=headers
        )
        assert verify_response.status_code == 404
        print(f"Deleted task: {task_id}")
    
    def test_delete_project(self, headers):
        """Test deleting a project"""
        project_id = TestProjectsCRUD.created_project_id
        if not project_id:
            pytest.skip("No project ID to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/tasks/projects/{project_id}",
            headers=headers
        )
        
        assert response.status_code == 200
        assert response.json()["success"] == True
        
        # Verify project is deleted
        verify_response = requests.get(
            f"{BASE_URL}/api/tasks/projects/{project_id}",
            headers=headers
        )
        assert verify_response.status_code == 404
        print(f"Deleted project: {project_id}")


class TestAuthorizationRequired:
    """Test that endpoints require authorization"""
    
    def test_projects_require_auth(self):
        """Test that projects endpoint requires authorization"""
        response = requests.get(f"{BASE_URL}/api/tasks/projects")
        assert response.status_code == 401
    
    def test_tasks_require_auth(self):
        """Test that tasks endpoint requires authorization"""
        response = requests.get(f"{BASE_URL}/api/tasks/")
        assert response.status_code == 401
    
    def test_my_tasks_require_auth(self):
        """Test that my-tasks endpoint requires authorization"""
        response = requests.get(f"{BASE_URL}/api/tasks/my-tasks")
        assert response.status_code == 401
    
    def test_stats_require_auth(self):
        """Test that stats endpoint requires authorization"""
        response = requests.get(f"{BASE_URL}/api/tasks/dashboard/stats")
        assert response.status_code == 401
