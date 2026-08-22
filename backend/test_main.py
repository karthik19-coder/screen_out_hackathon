from fastapi.testclient import TestClient
from datetime import datetime
import uuid
import pytest
import json

from main import app, get_db

client = TestClient(app)

class MockResponse:
    def __init__(self, data):
        self.data = data

class FakeTable:
    def __init__(self, table_name, db):
        self.table_name = table_name
        self.db = db
        self._query = []

    def select(self, *args, **kwargs):
        self._query = [('select', args)]
        return self

    def insert(self, data):
        self._query = [('insert', data)]
        return self
        
    def eq(self, field, value):
        self._query.append(('eq', field, value))
        return self
        
    def ilike(self, field, value):
        self._query.append(('ilike', field, value))
        return self
        
    def order(self, field, desc=False):
        self._query.append(('order', field, desc))
        return self
        
    def limit(self, count):
        self._query.append(('limit', count))
        return self

    def execute(self):
        op = self._query[0][0]
        if op == 'insert':
            data = self._query[0][1]
            if not isinstance(data, list):
                data = [data]
            for item in data:
                if 'id' not in item:
                    item['id'] = str(uuid.uuid4())
                if 'created_at' not in item:
                    item['created_at'] = datetime.now().isoformat()
                self.db.tables[self.table_name].append(item)
            return MockResponse(data)
            
        elif op == 'select':
            results = list(self.db.tables[self.table_name])
            for q in self._query[1:]:
                if q[0] == 'eq':
                    field, value = q[1], q[2]
                    results = [r for r in results if str(r.get(field)) == str(value)]
                elif q[0] == 'ilike':
                    field, value = q[1], q[2]
                    # Simple mock of ILIKE %query%
                    query_str = value.replace('%', '').lower()
                    results = [r for r in results if query_str in str(r.get(field, '')).lower()]
                elif q[0] == 'order':
                    field, desc = q[1], q[2]
                    results = sorted(results, key=lambda x: x.get(field, 0), reverse=desc)
                elif q[0] == 'limit':
                    results = results[:q[1]]
            return MockResponse(results)

class FakeDB:
    def __init__(self):
        self.tables = {
            "artifacts": [],
            "artifact_versions": []
        }
        
    def table(self, name):
        return FakeTable(name, self)


def test_branching_flow():
    mock_db = FakeDB()
    app.dependency_overrides[get_db] = lambda: mock_db
    
    # 1. Create an artifact (V1 on main)
    res = client.post("/artifacts", json={"title": "Test Artifact", "content": "V1 content"})
    assert res.status_code == 200
    artifact = res.json()
    artifact_id = artifact["id"]
    
    # Verify V1 on main
    v_res = client.get(f"/artifacts/{artifact_id}/versions")
    assert v_res.status_code == 200
    versions = v_res.json()
    assert len(versions) == 1
    assert versions[0]["branch_name"] == "main"
    assert versions[0]["version_number"] == 1
    assert versions[0]["parent_id"] is None
    v1_id = versions[0]["id"]
    
    # Create V2 on main
    res_v2 = client.post(f"/artifacts/{artifact_id}/versions", json={
        "content": "V2 content",
        "branch_name": "main",
        "parent_id": v1_id
    })
    assert res_v2.status_code == 200
    assert res_v2.json()["version_number"] == 2
    
    # 2. Create a new "experiment" branch from an existing version (V1)
    res_exp_v1 = client.post(f"/artifacts/{artifact_id}/versions", json={
        "content": "Experiment V1",
        "branch_name": "experiment",
        "parent_id": v1_id
    })
    assert res_exp_v1.status_code == 200
    exp_v1 = res_exp_v1.json()
    assert exp_v1["branch_name"] == "experiment"
    assert exp_v1["version_number"] == 1
    assert exp_v1["parent_id"] == v1_id
    
    # 3. Create another version on experiment (V2 on experiment)
    res_exp_v2 = client.post(f"/artifacts/{artifact_id}/versions", json={
        "content": "Experiment V2",
        "branch_name": "experiment",
        "parent_id": exp_v1["id"]
    })
    assert res_exp_v2.status_code == 200
    assert res_exp_v2.json()["branch_name"] == "experiment"
    assert res_exp_v2.json()["version_number"] == 2
    
    # 4. Main and experiment histories remain separate
    res_main = client.get(f"/artifacts/{artifact_id}/versions?branch=main")
    main_versions = res_main.json()
    assert len(main_versions) == 2
    assert main_versions[1]["version_number"] == 2
    
    res_exp = client.get(f"/artifacts/{artifact_id}/versions?branch=experiment")
    exp_versions = res_exp.json()
    assert len(exp_versions) == 2
    assert exp_versions[0]["version_number"] == 1
    
    # 5. parent_id correctly points to the version from which the branch was created
    assert exp_versions[0]["parent_id"] == v1_id
    
    # 6. GET /branches returns the available branch names
    res_branches = client.get(f"/artifacts/{artifact_id}/branches")
    assert res_branches.status_code == 200
    branches = res_branches.json()
    assert "main" in branches
    assert "experiment" in branches
    assert len(branches) == 2

def test_upload_txt():
    mock_db = FakeDB()
    app.dependency_overrides[get_db] = lambda: mock_db
    
    file_content = b"Hello from TXT"
    res = client.post("/artifacts/upload", files={"file": ("test.txt", file_content, "text/plain")})
    assert res.status_code == 200
    artifact = res.json()
    assert artifact["title"] == "test.txt"
    
    v_res = client.get(f"/artifacts/{artifact['id']}/versions")
    versions = v_res.json()
    assert len(versions) == 1
    assert versions[0]["content"] == "Hello from TXT"
    assert versions[0]["branch_name"] == "main"
    assert versions[0]["version_number"] == 1

def test_upload_json():
    mock_db = FakeDB()
    app.dependency_overrides[get_db] = lambda: mock_db
    
    json_data = {
        "title": "ignored",
        "messages": [
            {"role": "user", "content": "Hi"},
            {"role": "assistant", "message": "Hello!"}
        ]
    }
    file_content = json.dumps(json_data).encode("utf-8")
    res = client.post("/artifacts/upload", files={"file": ("export.json", file_content, "application/json")})
    
    assert res.status_code == 200
    artifact = res.json()
    assert artifact["title"] == "export.json"
    
    v_res = client.get(f"/artifacts/{artifact['id']}/versions")
    versions = v_res.json()
    assert len(versions) == 1
    assert "Hi\nHello!" in versions[0]["content"]

def test_upload_unsupported():
    mock_db = FakeDB()
    app.dependency_overrides[get_db] = lambda: mock_db
    
    res = client.post("/artifacts/upload", files={"file": ("test.exe", b"binary", "application/octet-stream")})
    assert res.status_code == 400
    assert "Unsupported file extension" in res.json()["detail"]

def test_upload_empty():
    mock_db = FakeDB()
    app.dependency_overrides[get_db] = lambda: mock_db
    
    res = client.post("/artifacts/upload", files={"file": ("empty.txt", b"", "text/plain")})
    assert res.status_code == 400
    assert "No meaningful text could be extracted" in res.json()["detail"]

def test_search_empty():
    mock_db = FakeDB()
    app.dependency_overrides[get_db] = lambda: mock_db
    res = client.get("/search?q=")
    assert res.status_code == 400

def test_search_no_results():
    mock_db = FakeDB()
    app.dependency_overrides[get_db] = lambda: mock_db
    res = client.get("/search?q=missing")
    assert res.status_code == 200
    assert res.json() == []

def test_search_matching_content():
    mock_db = FakeDB()
    app.dependency_overrides[get_db] = lambda: mock_db
    
    # create artifact
    client.post("/artifacts", json={"title": "Space Doc", "content": "This is a document about black holes and galaxies."})
    
    res = client.get("/search?q=black holes")
    assert res.status_code == 200
    results = res.json()
    assert len(results) == 1
    assert results[0]["artifact_title"] == "Unknown" # In our mock DB we don't handle the relational join easily, so it falls back to Unknown
    assert results[0]["version_number"] == 1
    assert "black holes" in results[0]["snippet"]


def test_merge_check_up_to_date():
    mock_db = FakeDB()
    app.dependency_overrides[get_db] = lambda: mock_db
    
    res = client.post("/artifacts", json={"title": "Merge Test", "content": "Base"})
    artifact_id = res.json()["id"]
    
    res_merge = client.get(f"/artifacts/{artifact_id}/merge-check?source=main&target=main")
    assert res_merge.status_code == 400
    
def test_merge_check_conflict_and_fast_forward():
    mock_db = FakeDB()
    app.dependency_overrides[get_db] = lambda: mock_db
    
    res = client.post("/artifacts", json={"title": "Merge Test", "content": "Base"})
    artifact_id = res.json()["id"]
    v_res = client.get(f"/artifacts/{artifact_id}/versions")
    v1_id = v_res.json()[0]["id"]
    
    # Create branch A from V1
    client.post(f"/artifacts/{artifact_id}/versions", json={"content": "Branch A", "branch_name": "branch_A", "parent_id": v1_id})
    
    # Check fast forward
    res_ff = client.get(f"/artifacts/{artifact_id}/merge-check?source=branch_A&target=main")
    assert res_ff.status_code == 200
    assert res_ff.json()["status"] == "fast_forward"
    
    # Create branch B from V1
    client.post(f"/artifacts/{artifact_id}/versions", json={"content": "Branch B", "branch_name": "branch_B", "parent_id": v1_id})
    
    # Check conflict
    res_conf = client.get(f"/artifacts/{artifact_id}/merge-check?source=branch_A&target=branch_B")
    assert res_conf.status_code == 200
    assert res_conf.json()["status"] == "conflict"
    assert res_conf.json()["base"]["id"] == v1_id
