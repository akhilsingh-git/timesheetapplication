import requests
import sys
from datetime import datetime, timedelta
import json

class TimesheetAPITester:
    def __init__(self, base_url="https://reverent-ardinghelli-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.project_id = None
        self.sub_project_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"   Response: {response.text}")
                except:
                    pass
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "",
            200
        )
        return success

    def test_login(self, email, password):
        """Test login and get token"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response.get('user', {}).get('id')
            print(f"   Token obtained: {self.token[:20]}...")
            print(f"   User ID: {self.user_id}")
            return True
        return False

    def test_get_current_user(self):
        """Test getting current user info"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_get_projects(self):
        """Test getting all projects"""
        success, response = self.run_test(
            "Get Projects",
            "GET",
            "projects",
            200
        )
        if success and isinstance(response, list):
            print(f"   Found {len(response)} projects")
            for project in response:
                print(f"   - {project.get('name')} ({project.get('code')})")
        return success

    def test_create_project(self, name, code, sub_projects):
        """Test creating a new project"""
        project_data = {
            "name": name,
            "code": code,
            "sub_projects": sub_projects
        }
        
        success, response = self.run_test(
            "Create Project",
            "POST",
            "projects",
            200,
            data=project_data
        )
        
        if success and 'id' in response:
            self.project_id = response['id']
            # Find the sub-project ID
            for sub_proj in response.get('sub_projects', []):
                if sub_proj['name'] == 'Task A':
                    self.sub_project_id = sub_proj['id']
                    break
            print(f"   Project created with ID: {self.project_id}")
            print(f"   Sub-project ID: {self.sub_project_id}")
            return True
        return False

    def test_get_timesheet_by_week(self, week_start):
        """Test getting timesheet for a specific week"""
        success, response = self.run_test(
            "Get Timesheet by Week",
            "GET",
            f"timesheets/week?week_start={week_start}",
            200
        )
        return success, response

    def test_save_timesheet(self, week_start):
        """Test saving a timesheet with 8 hours Mon-Fri"""
        if not self.project_id or not self.sub_project_id:
            print("❌ Cannot test timesheet - missing project/sub-project IDs")
            return False

        # Create entries for Mon-Fri (8 hours each)
        entries = []
        for day in range(7):  # 0=Mon, 6=Sun
            hours = 8.0 if day < 5 else 0.0  # 8 hours Mon-Fri, 0 for Sat-Sun
            entries.append({
                "day_index": day,
                "hours": hours,
                "notes": f"Work on Task A - Day {day + 1}"
            })

        timesheet_data = {
            "user_id": self.user_id,
            "week_start_date": week_start,
            "rows": [{
                "project_id": self.project_id,
                "sub_project_id": self.sub_project_id,
                "entries": entries,
                "location": "Remote"
            }],
            "status": "Draft"
        }

        success, response = self.run_test(
            "Save Timesheet",
            "POST",
            "timesheets",
            200,
            data=timesheet_data
        )
        
        if success:
            total_hours = response.get('total_hours', 0)
            print(f"   Total hours: {total_hours}")
            if total_hours == 40.0:
                print("✅ Total hours calculation correct (40 hours)")
            else:
                print(f"❌ Total hours incorrect - expected 40, got {total_hours}")
            return response.get('id')
        return None

def main():
    # Setup
    tester = TimesheetAPITester()
    
    print("🚀 Starting Timesheet API Tests...")
    
    # Test basic connectivity
    if not tester.test_root_endpoint():
        print("❌ Root endpoint failed, stopping tests")
        return 1

    # Test login
    if not tester.test_login("admin@example.com", "admin"):
        print("❌ Login failed, stopping tests")
        return 1

    # Test user info
    if not tester.test_get_current_user():
        print("❌ Get current user failed")
        return 1

    # Test getting existing projects
    if not tester.test_get_projects():
        print("❌ Get projects failed")
        return 1

    # Test creating new project
    sub_projects = [
        {"name": "Task A", "code": "TASK-A"},
        {"name": "Task B", "code": "TASK-B"}
    ]
    
    if not tester.test_create_project("Test Project", "TEST-001", sub_projects):
        print("❌ Create project failed")
        return 1

    # Test timesheet operations
    # Get current Monday's date
    today = datetime.now()
    days_since_monday = today.weekday()
    monday = today - timedelta(days=days_since_monday)
    week_start = monday.strftime('%Y-%m-%d')
    
    print(f"\n📅 Testing timesheet for week starting: {week_start}")
    
    # Check if timesheet exists
    success, existing_timesheet = tester.test_get_timesheet_by_week(week_start)
    if success and existing_timesheet:
        print("   Found existing timesheet")
    else:
        print("   No existing timesheet found")

    # Save new timesheet
    timesheet_id = tester.test_save_timesheet(week_start)
    if not timesheet_id:
        print("❌ Save timesheet failed")
        return 1

    # Print final results
    print(f"\n📊 Tests Summary:")
    print(f"   Tests passed: {tester.tests_passed}/{tester.tests_run}")
    print(f"   Success rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("✅ All backend tests passed!")
        return 0
    else:
        print("❌ Some backend tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())