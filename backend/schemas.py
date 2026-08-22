from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid

# Request schemas
class ArtifactCreate(BaseModel):
    title: str
    content: str

class VersionCreate(BaseModel):
    content: str

# Response schemas
class ArtifactVersionResponse(BaseModel):
    id: uuid.UUID
    artifact_id: uuid.UUID
    version_number: int
    content: Optional[str] = None  # Content may be omitted in lists
    created_at: datetime

class ArtifactResponse(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime

class CompareResponse(BaseModel):
    base_version: ArtifactVersionResponse
    head_version: ArtifactVersionResponse
