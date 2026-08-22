from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import uuid

from database import get_supabase
from schemas import (
    ArtifactCreate, 
    ArtifactResponse, 
    VersionCreate, 
    ArtifactVersionResponse, 
    CompareResponse
)

app = FastAPI(title="ResearchGit API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    return get_supabase()

@app.post("/artifacts", response_model=ArtifactResponse)
def create_artifact(artifact: ArtifactCreate, db = Depends(get_db)):
    artifact_data = {
        "title": artifact.title
    }
    
    res = db.table("artifacts").insert(artifact_data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create artifact")
    
    new_artifact = res.data[0]
    
    version_data = {
        "artifact_id": new_artifact["id"],
        "version_number": 1,
        "content": artifact.content,
        "branch_name": "main",
        "parent_id": None
    }
    v_res = db.table("artifact_versions").insert(version_data).execute()
    if not v_res.data:
        raise HTTPException(status_code=500, detail="Failed to create version 1")
    
    return new_artifact

@app.get("/artifacts", response_model=List[ArtifactResponse])
def get_artifacts(db = Depends(get_db)):
    res = db.table("artifacts").select("*").order("created_at", desc=True).execute()
    return res.data

@app.post("/artifacts/{artifact_id}/versions", response_model=ArtifactVersionResponse)
def create_version(artifact_id: str, version: VersionCreate, db = Depends(get_db)):
    # Find latest version scoped to branch
    branch = version.branch_name if version.branch_name else "main"
    
    v_res = db.table("artifact_versions").select("version_number").eq("artifact_id", artifact_id).eq("branch_name", branch).order("version_number", desc=True).limit(1).execute()
    
    if not v_res.data:
        next_version = 1
    else:
        latest_version = v_res.data[0]["version_number"]
        next_version = latest_version + 1
    
    parent_id = str(version.parent_id) if version.parent_id else None
    
    new_version_data = {
        "artifact_id": artifact_id,
        "version_number": next_version,
        "content": version.content,
        "branch_name": branch,
        "parent_id": parent_id
    }
    
    res = db.table("artifact_versions").insert(new_version_data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create new version")
        
    return res.data[0]

@app.get("/artifacts/{artifact_id}/versions", response_model=List[ArtifactVersionResponse])
def get_version_history(artifact_id: str, branch: Optional[str] = None, db = Depends(get_db)):
    query = db.table("artifact_versions").select("id, artifact_id, version_number, created_at, branch_name, parent_id").eq("artifact_id", artifact_id)
    if branch:
        query = query.eq("branch_name", branch)
        
    res = query.order("version_number", desc=False).execute()
    return res.data

@app.get("/artifacts/{artifact_id}/branches", response_model=List[str])
def get_branches(artifact_id: str, db = Depends(get_db)):
    res = db.table("artifact_versions").select("branch_name").eq("artifact_id", artifact_id).execute()
    if not res.data:
        return []
    # Extract unique branch names
    branches = list(set([item["branch_name"] for item in res.data]))
    return branches

@app.get("/artifacts/{artifact_id}/versions/{version_id}", response_model=ArtifactVersionResponse)
def get_version(artifact_id: str, version_id: str, db = Depends(get_db)):
    res = db.table("artifact_versions").select("*").eq("id", version_id).eq("artifact_id", artifact_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Version not found")
    return res.data[0]

@app.get("/artifacts/{artifact_id}/compare", response_model=CompareResponse)
def compare_versions(artifact_id: str, base_version_id: str, head_version_id: str, db = Depends(get_db)):
    res_base = db.table("artifact_versions").select("*").eq("id", base_version_id).eq("artifact_id", artifact_id).execute()
    if not res_base.data:
        raise HTTPException(status_code=404, detail="Base version not found")
        
    res_head = db.table("artifact_versions").select("*").eq("id", head_version_id).eq("artifact_id", artifact_id).execute()
    if not res_head.data:
        raise HTTPException(status_code=404, detail="Head version not found")
        
    return {
        "base_version": res_base.data[0],
        "head_version": res_head.data[0]
    }
