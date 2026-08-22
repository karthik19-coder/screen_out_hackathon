# ResearchGit

A version-controlled research artifact manager. Upload documents, track immutable version histories, create branches, compare diffs, detect merge conflicts, and resolve them — all through a clean, minimal UI.

Built for the Screen Out Hackathon.

---

## Features

| Feature | Description |
|---|---|
| **Document Ingestion** | Upload `.txt`, `.md`, `.json`, and `.pdf` files. Text is extracted and stored as the first version. |
| **Immutable Versioning** | Every edit creates a new version. Previous versions are never overwritten. |
| **Branching** | Create named branches from any version. Each branch maintains its own version sequence. |
| **Version Comparison** | Side-by-side diff of any two versions with added/removed highlighting. |
| **Merge Conflict Detection** | Conservative 3-way merge check using the parent-chain common ancestor. |
| **Conflict Resolution** | Manual resolution UI with Target, Source, and editable Resolution panels. Saving creates a new immutable version. |
| **Full-Text Search** | Search across all versions and branches. Results include artifact title, version, branch, and contextual snippet. |
| **Concurrent Update Detection** | 5-second polling detects remote version changes and shows a notification banner with a "Compare changes" action. |
| **Artifact Deletion** | Delete an artifact and all of its versions/branches permanently. |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19 (Vite), vanilla CSS |
| **Backend** | Python, FastAPI, Pydantic |
| **Database** | Supabase (PostgreSQL) |
| **Diff Engine** | `diff` (npm, line-level diffing) |
| **PDF Parsing** | `pypdf` |

---

## Project Structure

```
screen_out_hackathon/
├── backend/
│   ├── main.py              # FastAPI application (all endpoints)
│   ├── database.py          # Supabase client
│   ├── schemas.py           # Pydantic request/response models
│   ├── migration.sql        # Branch-aware unique constraint
│   ├── requirements.txt     # Python dependencies
│   ├── test_main.py         # Unit tests (mock DB)
│   ├── test_real.py         # Integration tests (live Supabase)
│   └── .env.example         # Environment variable template
├── frontend/
│   ├── index.html           # Entry point
│   ├── src/
│   │   ├── App.jsx          # Root component (view router)
│   │   ├── App.css          # Global styles
│   │   ├── api.js           # API client (all fetch calls)
│   │   └── components/
│   │       ├── Dashboard.jsx     # Artifact list, search, tabs, delete
│   │       ├── CreateArtifact.jsx # New artifact form
│   │       └── ArtifactView.jsx  # Version history, branching, compare, merge
│   └── package.json
├── .gitignore
└── README.md
```

---

## Setup

### Prerequisites

- Python 3.9+
- Node.js 18+
- A Supabase project with the following table:

```sql
CREATE TABLE artifacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE artifact_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    artifact_id UUID REFERENCES artifacts(id),
    version_number INTEGER NOT NULL,
    content TEXT,
    branch_name TEXT DEFAULT 'main',
    parent_id UUID REFERENCES artifact_versions(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (artifact_id, branch_name, version_number)
);
```

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env from the template
cp .env.example .env
# Edit .env with your Supabase credentials

uvicorn main:app --reload
```

The API runs on `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The UI runs on `http://localhost:5173`.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/artifacts` | Create artifact + V1 |
| `POST` | `/artifacts/upload` | Upload file (.txt, .md, .json, .pdf) |
| `GET` | `/artifacts` | List all artifacts |
| `DELETE` | `/artifacts/{id}` | Delete artifact + all versions |
| `POST` | `/artifacts/{id}/versions` | Create new version |
| `GET` | `/artifacts/{id}/versions` | Version history (optional `?branch=`) |
| `GET` | `/artifacts/{id}/versions/{vid}` | Get specific version |
| `GET` | `/artifacts/{id}/branches` | List branches |
| `GET` | `/artifacts/{id}/compare` | Compare two versions |
| `GET` | `/artifacts/{id}/merge-check` | Check merge status between branches |
| `GET` | `/search?q=...` | Full-text search across all content |

---

## Running Tests

### Backend (unit tests)

```bash
cd backend
source venv/bin/activate
pytest
```

### Frontend (production build)

```bash
cd frontend
npm run build
```

---

## Demo Walkthrough (2 minutes)

1. **Dashboard** — Show all seeded artifacts.
2. **Open "Electric Vehicle Battery Research"** — Click through V1 → V2 → V3 in the timeline.
3. **Compare V1 vs V2** — Show red (removed) and green (added) diff highlighting.
4. **Open "AI Research Strategy"** — Switch between `main`, `research-a`, and `research-b` branches.
5. **Open "Product Recommendation Policy"** — Switch to `privacy-update` branch.
6. **Click "Merge Branch"** — Select `pricing-update` as source → "Check Merge".
7. **Conflict detected** — Show Target/Source panels. Type a resolved version. Click "Save Merge".
8. **Verify** — `privacy-update` now has V2 with the merged content. V1 is unchanged.
9. **Search** — Type "transformer" → results show version, branch, and snippet.
10. **Click a result** — Opens the correct artifact view.
11. **Concurrent update** — Open the same artifact in two tabs. Create a version in one. The other shows a "New version published" banner.

---

## Architecture Decisions

- **Immutable versions**: Every write creates a new row. No content is ever modified or deleted (except full artifact deletion).
- **Parent-chain ancestry**: `parent_id` on each version builds a DAG. Merge conflict detection walks this chain to find the common ancestor.
- **Conservative conflict detection**: If both branches diverged from the common ancestor, the system reports a conflict rather than attempting automatic merging.
- **No authentication**: This is a hackathon MVP. "My Artifacts" uses `localStorage` to track session-created artifacts.
- **Polling over WebSockets**: A 5-second `setInterval` checks for remote version updates. Simple and dependency-free.

---

## License

Hackathon project — not licensed for production use.