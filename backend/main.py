from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List
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
    allow_origins=["*"],  # Allows all origins for local hackathon
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

def get_db():
    return get_supabase()

@app.post("/artifacts", response_model=ArtifactResponse)
def create_artifact(artifact: ArtifactCreate, db = Depends(get_db)):
    # 1. Create the artifact
    artifact_data = {
        "title": artifact.title
    }
    
    # insert artifact
    res = db.table("artifacts").insert(artifact_data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create artifact")
    
    new_artifact = res.data[0]
    
    # 2. Create version 1
    version_data = {
        "artifact_id": new_artifact["id"],
        "version_number": 1,
        "content": artifact.content
    }
    v_res = db.table("artifact_versions").insert(version_data).execute()
    if not v_res.data:
        # In a real app we'd rollback, but Supabase python client doesn't do transactions easily
        raise HTTPException(status_code=500, detail="Failed to create version 1")
    
    return new_artifact

@app.get("/artifacts", response_model=List[ArtifactResponse])
def get_artifacts(db = Depends(get_db)):
    res = db.table("artifacts").select("*").order("created_at", desc=True).execute()
    return res.data

@app.post("/artifacts/{artifact_id}/versions", response_model=ArtifactVersionResponse)
def create_version(artifact_id: str, version: VersionCreate, db = Depends(get_db)):
    # Find latest version to increment number
    v_res = db.table("artifact_versions").select("version_number").eq("artifact_id", artifact_id).order("version_number", desc=True).limit(1).execute()
    
    if not v_res.data:
        raise HTTPException(status_code=404, detail="Artifact not found or has no versions")
    
    latest_version = v_res.data[0]["version_number"]
    next_version = latest_version + 1
    
    new_version_data = {
        "artifact_id": artifact_id,
        "version_number": next_version,
        "content": version.content
    }
    
    res = db.table("artifact_versions").insert(new_version_data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create new version")
        
    return res.data[0]

@app.get("/artifacts/{artifact_id}/versions", response_model=List[ArtifactVersionResponse])
def get_version_history(artifact_id: str, db = Depends(get_db)):
    # Exclude content for history listing if needed, but since our schema requires it, we just return all
    # Or we can omit it in the model (content is Optional in schema).
    res = db.table("artifact_versions").select("id, artifact_id, version_number, created_at").eq("artifact_id", artifact_id).order("version_number", desc=False).execute()
    return res.data

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
