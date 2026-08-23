from fastapi import FastAPI, HTTPException, Depends, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
import uuid
import json
import io
import pypdf

from database import get_supabase
from schemas import (
    ArtifactCreate, 
    ArtifactResponse, 
    VersionCreate, 
    ArtifactVersionResponse, 
    CompareResponse,
    SearchResult,
    MergeCheckResponse
)

import os

app = FastAPI(title="ResearchGit API")

origins = [
    "http://localhost:5173",
]
env_origins = os.environ.get("CORS_ORIGINS", "")
if env_origins:
    origins.extend([o.strip() for o in env_origins.split(",") if o.strip()])

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    return get_supabase()

def extract_text_from_json(data):
    if isinstance(data, str):
        return data.strip()
    elif isinstance(data, list):
        return "\n".join([extract_text_from_json(item) for item in data if item]).strip()
    elif isinstance(data, dict):
        text_parts = []
        # Prioritize useful keys
        prioritized = False
        for key in ["content", "text", "message", "messages", "parts", "prompt", "response"]:
            if key in data and data[key]:
                extracted = extract_text_from_json(data[key])
                if extracted:
                    text_parts.append(extracted)
                    prioritized = True
        if prioritized:
            return "\n".join(text_parts).strip()
        
        # If no prioritized keys found, traverse all values
        for k, v in data.items():
            if isinstance(v, (str, dict, list)):
                extracted = extract_text_from_json(v)
                if extracted:
                    text_parts.append(extracted)
        return "\n".join(text_parts).strip()
    return ""

def extract_text_from_pdf(file_bytes):
    reader = pypdf.PdfReader(io.BytesIO(file_bytes))
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
    return text.strip()

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

@app.post("/artifacts/upload", response_model=ArtifactResponse)
async def upload_artifact(file: UploadFile = File(...), db = Depends(get_db)):
    filename = file.filename
    ext = filename.split('.')[-1].lower() if '.' in filename else ''
    
    if ext not in ['txt', 'md', 'json', 'pdf']:
        raise HTTPException(status_code=400, detail=f"Unsupported file extension: {ext}")
        
    content_bytes = await file.read()
    
    try:
        if ext in ['txt', 'md']:
            extracted_text = content_bytes.decode('utf-8')
        elif ext == 'pdf':
            extracted_text = extract_text_from_pdf(content_bytes)
        elif ext == 'json':
            json_data = json.loads(content_bytes.decode('utf-8'))
            extracted_text = extract_text_from_json(json_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process file: {str(e)}")
        
    extracted_text = extracted_text.strip()
    if not extracted_text:
        raise HTTPException(status_code=400, detail="No meaningful text could be extracted from the file.")
        
    # Reuse create artifact logic
    artifact_data = {
        "title": filename
    }
    
    res = db.table("artifacts").insert(artifact_data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create artifact")
    
    new_artifact = res.data[0]
    
    version_data = {
        "artifact_id": new_artifact["id"],
        "version_number": 1,
        "content": extracted_text,
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

@app.get("/search", response_model=List[SearchResult])
def search_artifacts(q: str, db = Depends(get_db)):
    if not q or not q.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    query = q.strip()
    
    # We use ilike for simple case-insensitive matching
    res = db.table("artifact_versions").select("*, artifacts(title)").ilike("content", f"%{query}%").execute()
    
    if not res.data:
        return []
        
    results = []
    for row in res.data:
        content = row.get("content", "")
        # Find index of query
        idx = content.lower().find(query.lower())
        if idx == -1:
            snippet = content[:150] + "..."
        else:
            # Roughly 75 characters before and 75 characters after
            start = max(0, idx - 75)
            end = min(len(content), idx + len(query) + 75)
            snippet = content[start:end]
            if start > 0:
                snippet = "..." + snippet
            if end < len(content):
                snippet = snippet + "..."
                
        artifact_title = "Unknown"
        if row.get("artifacts") and isinstance(row["artifacts"], dict):
            artifact_title = row["artifacts"].get("title", "Unknown")
            
        results.append({
            "artifact_id": row["artifact_id"],
            "artifact_title": artifact_title,
            "version_id": row["id"],
            "version_number": row["version_number"],
            "branch_name": row["branch_name"],
            "snippet": snippet
        })
        
    return results

@app.get("/artifacts/{artifact_id}/merge-check", response_model=MergeCheckResponse)
def check_merge(artifact_id: str, source: str, target: str, db = Depends(get_db)):
    if source == target:
        raise HTTPException(status_code=400, detail="Source and target branches must be different")

    # Get latest version on source
    res_source = db.table("artifact_versions").select("*").eq("artifact_id", artifact_id).eq("branch_name", source).order("version_number", desc=True).limit(1).execute()
    if not res_source.data:
        raise HTTPException(status_code=404, detail=f"Source branch '{source}' not found")
    source_ver = res_source.data[0]

    # Get latest version on target
    res_target = db.table("artifact_versions").select("*").eq("artifact_id", artifact_id).eq("branch_name", target).order("version_number", desc=True).limit(1).execute()
    if not res_target.data:
        raise HTTPException(status_code=404, detail=f"Target branch '{target}' not found")
    target_ver = res_target.data[0]

    if source_ver["id"] == target_ver["id"]:
        return {"status": "up_to_date", "base": source_ver, "source": source_ver, "target": target_ver}

    # Fetch all versions for this artifact to build the graph
    res_all = db.table("artifact_versions").select("id, parent_id").eq("artifact_id", artifact_id).execute()
    version_map = {v["id"]: v["parent_id"] for v in res_all.data}

    # Get ancestors of target
    target_ancestors = set()
    current = target_ver["id"]
    while current:
        target_ancestors.add(current)
        current = version_map.get(current)

    # Walk up source to find first common ancestor
    common_ancestor_id = None
    current = source_ver["id"]
    while current:
        if current in target_ancestors:
            common_ancestor_id = current
            break
        current = version_map.get(current)

    if not common_ancestor_id:
        raise HTTPException(status_code=400, detail="No common ancestor found between branches.")

    # Fetch common ancestor
    res_base = db.table("artifact_versions").select("*").eq("id", common_ancestor_id).execute()
    base_ver = res_base.data[0]

    # Determine status
    if common_ancestor_id == source_ver["id"]:
        return {"status": "up_to_date", "base": base_ver, "source": source_ver, "target": target_ver}
    elif common_ancestor_id == target_ver["id"]:
        return {"status": "fast_forward", "base": base_ver, "source": source_ver, "target": target_ver}
    else:
        return {"status": "conflict", "base": base_ver, "source": source_ver, "target": target_ver}

@app.delete("/artifacts/{artifact_id}")
def delete_artifact(artifact_id: str, db = Depends(get_db)):
    # Verify the artifact exists
    res = db.table("artifacts").select("id").eq("id", artifact_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Artifact not found")
        
    try:
        # Delete all versions first (to satisfy referential integrity if cascade is not enabled)
        db.table("artifact_versions").delete().eq("artifact_id", artifact_id).execute()
        # Delete the artifact
        res_del = db.table("artifacts").delete().eq("id", artifact_id).execute()
        if not hasattr(res_del, 'data') and res_del is None: # some supabase versions might return differently, but usually it raises an exception on error
            pass
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete artifact: {str(e)}")
