from fastapi.testclient import TestClient
from unittest.mock import MagicMock
import pytest
from datetime import datetime
import uuid

from main import app, get_db

client = TestClient(app)

class MockResponse:
    def __init__(self, data):
        self.data = data

def test_full_flow():
    # Setup mock Supabase client
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    
    artifact_id = str(uuid.uuid4())
    v1_id = str(uuid.uuid4())
    v2_id = str(uuid.uuid4())
    
    # 1. Create an artifact
    # Mocking artifacts insert
    mock_db.table().insert().execute.side_effect = [
        MockResponse([{"id": artifact_id, "title": "Test Artifact", "created_at": datetime.now().isoformat()}]),
        MockResponse([{"id": v1_id, "artifact_id": artifact_id, "version_number": 1, "content": "Initial text", "created_at": datetime.now().isoformat()}])
    ]
    
    response = client.post("/artifacts", json={"title": "Test Artifact", "content": "Initial text"})
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == artifact_id
    assert data["title"] == "Test Artifact"
    
    # 2. Confirm Version 1 exists (simulated via history endpoint)
    # Mock history list
    mock_db.table().select().eq().order().execute.return_value = MockResponse([
        {"id": v1_id, "artifact_id": artifact_id, "version_number": 1, "created_at": datetime.now().isoformat()}
    ])
    
    response = client.get(f"/artifacts/{artifact_id}/versions")
    assert response.status_code == 200
    history = response.json()
    assert len(history) == 1
    assert history[0]["version_number"] == 1
    
    # 3. Create Version 2
    # Mock fetching latest version
    mock_db.table().select().eq().order().limit().execute.return_value = MockResponse([
        {"version_number": 1}
    ])
    # Mock insert version 2
    mock_db.table().insert().execute.side_effect = None
    mock_db.table().insert().execute.return_value = MockResponse([
        {"id": v2_id, "artifact_id": artifact_id, "version_number": 2, "content": "Updated text", "created_at": datetime.now().isoformat()}
    ])
    
    response = client.post(f"/artifacts/{artifact_id}/versions", json={"content": "Updated text"})
    assert response.status_code == 200
    v2_data = response.json()
    assert v2_data["version_number"] == 2
    assert v2_data["content"] == "Updated text"
    
    # 4. Retrieve version history (again to see both)
    mock_db.table().select().eq().order().execute.return_value = MockResponse([
        {"id": v1_id, "artifact_id": artifact_id, "version_number": 1, "created_at": datetime.now().isoformat()},
        {"id": v2_id, "artifact_id": artifact_id, "version_number": 2, "created_at": datetime.now().isoformat()}
    ])
    response = client.get(f"/artifacts/{artifact_id}/versions")
    history = response.json()
    assert len(history) == 2
    
    # 5. Retrieve Version 1
    mock_db.table().select().eq().eq().execute.return_value = MockResponse([
        {"id": v1_id, "artifact_id": artifact_id, "version_number": 1, "content": "Initial text", "created_at": datetime.now().isoformat()}
    ])
    response = client.get(f"/artifacts/{artifact_id}/versions/{v1_id}")
    assert response.status_code == 200
    assert response.json()["content"] == "Initial text"
    
    # 6. Retrieve Version 2
    mock_db.table().select().eq().eq().execute.return_value = MockResponse([
        {"id": v2_id, "artifact_id": artifact_id, "version_number": 2, "content": "Updated text", "created_at": datetime.now().isoformat()}
    ])
    response = client.get(f"/artifacts/{artifact_id}/versions/{v2_id}")
    assert response.status_code == 200
    assert response.json()["content"] == "Updated text"
    
    # 7. Compare Version 1 and Version 2
    mock_db.table().select().eq().eq().execute.side_effect = [
        MockResponse([{"id": v1_id, "artifact_id": artifact_id, "version_number": 1, "content": "Initial text", "created_at": datetime.now().isoformat()}]),
        MockResponse([{"id": v2_id, "artifact_id": artifact_id, "version_number": 2, "content": "Updated text", "created_at": datetime.now().isoformat()}])
    ]
    
    response = client.get(f"/artifacts/{artifact_id}/compare?base_version_id={v1_id}&head_version_id={v2_id}")
    assert response.status_code == 200
    compare_data = response.json()
    assert compare_data["base_version"]["content"] == "Initial text"
    assert compare_data["head_version"]["content"] == "Updated text"
