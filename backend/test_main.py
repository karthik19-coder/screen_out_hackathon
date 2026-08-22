from fastapi.testclient import TestClient
from datetime import datetime
import uuid
import pytest

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
