import sys
from fastapi.testclient import TestClient
from main import app
from database import get_supabase

def run_tests():
    try:
        # 1. Test Supabase connection Status
        print("Checking Supabase connection...")
        db = get_supabase()
        # Verify it can query artifacts
        res = db.table("artifacts").select("id").limit(1).execute()
        print("Supabase connection status: SUCCESS")
    except Exception as e:
        print(f"Supabase connection status: FAILED - {str(e)}")
        sys.exit(1)

    print("\nStarting API integration tests...")
    client = TestClient(app)
    
    # Track created IDs for cleanup or info
    artifact_id = None
    v1_id = None
    v2_id = None
    
    try:
        # Step 1: Create artifact -> Version 1 is created
        print("Test 1: Create artifact and Version 1")
        response = client.post("/artifacts", json={"title": "Real Test Artifact", "content": "Real Initial Text"})
        if response.status_code != 200:
            print(f"FAILED: {response.text}")
            sys.exit(1)
        
        data = response.json()
        artifact_id = data["id"]
        print(f"  SUCCESS - Artifact ID: {artifact_id}")
        
        # Step 2: Confirm Version 1 exists and retrieve version history
        print("Test 2: Retrieve version history and verify Version 1")
        response = client.get(f"/artifacts/{artifact_id}/versions")
        if response.status_code != 200:
            print(f"FAILED: {response.text}")
            sys.exit(1)
            
        history = response.json()
        if len(history) != 1 or history[0]["version_number"] != 1:
            print(f"FAILED: Expected 1 version, got {len(history)}")
            sys.exit(1)
            
        v1_id = history[0]["id"]
        print(f"  SUCCESS - Version 1 ID: {v1_id}")
        
        # Step 3: Create Version 2
        print("Test 3: Create Version 2")
        response = client.post(f"/artifacts/{artifact_id}/versions", json={"content": "Real Updated Text"})
        if response.status_code != 200:
            print(f"FAILED: {response.text}")
            sys.exit(1)
            
        v2_data = response.json()
        v2_id = v2_data["id"]
        print(f"  SUCCESS - Version 2 ID: {v2_id}")
        
        # Step 4: Retrieve Version 1
        print("Test 4: Retrieve Version 1 content")
        response = client.get(f"/artifacts/{artifact_id}/versions/{v1_id}")
        if response.status_code != 200 or response.json()["content"] != "Real Initial Text":
            print(f"FAILED: {response.text}")
            sys.exit(1)
        print("  SUCCESS")
        
        # Step 5: Retrieve Version 2
        print("Test 5: Retrieve Version 2 content")
        response = client.get(f"/artifacts/{artifact_id}/versions/{v2_id}")
        if response.status_code != 200 or response.json()["content"] != "Real Updated Text":
            print(f"FAILED: {response.text}")
            sys.exit(1)
        print("  SUCCESS")
        
        # Step 6: Compare Version 1 and Version 2
        print("Test 6: Compare versions")
        response = client.get(f"/artifacts/{artifact_id}/compare?base_version_id={v1_id}&head_version_id={v2_id}")
        if response.status_code != 200:
            print(f"FAILED: {response.text}")
            sys.exit(1)
            
        compare_data = response.json()
        if compare_data["base_version"]["content"] != "Real Initial Text" or compare_data["head_version"]["content"] != "Real Updated Text":
            print("FAILED: Compare content mismatch")
            sys.exit(1)
        print("  SUCCESS")

        print("\nAll integration tests passed successfully!")

    except Exception as e:
        print(f"Test failed with error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
