from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid

# Request schemas
class ArtifactCreate(BaseModel):
    title: str
    content: str

class VersionCreate(BaseModel):
    content: str
    branch_name: Optional[str] = 'main'
    parent_id: Optional[uuid.UUID] = None

# Response schemas
class ArtifactVersionResponse(BaseModel):
    id: uuid.UUID
    artifact_id: uuid.UUID
    version_number: int
    content: Optional[str] = None
    branch_name: str
    parent_id: Optional[uuid.UUID] = None
    created_at: datetime

class ArtifactResponse(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime

class CompareResponse(BaseModel):
    base_version: ArtifactVersionResponse
    head_version: ArtifactVersionResponse
