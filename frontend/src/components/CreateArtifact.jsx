import { useState } from 'react';
import { createArtifact } from '../api';

function CreateArtifact({ setView, setSelectedArtifactId }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const result = await createArtifact(title, content);
      
      // Store ID in local storage for "My Artifacts" demo feature
      try {
        const stored = localStorage.getItem('researchgit_my_artifacts');
        const myArtifactIds = stored ? JSON.parse(stored) : [];
        myArtifactIds.push(result.id);
        localStorage.setItem('researchgit_my_artifacts', JSON.stringify(myArtifactIds));
      } catch (e) {
        console.error('Local storage error', e);
      }

      setSelectedArtifactId(result.id);
      setView('view');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <>
      <header className="app-header">
        <h1 onClick={() => setView('dashboard')} className="brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          ResearchGit
        </h1>
      </header>

      <main className="main-content">
        <div className="create-container">
          <button className="back-btn" onClick={() => setView('dashboard')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
            Back to Dashboard
          </button>
          
          <div className="create-header">
            <h2>Create New Research</h2>
          </div>

          <form onSubmit={handleSubmit} className="create-form">
            <div className="form-group">
              <label htmlFor="title">Title</label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a descriptive title for your research..."
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="content">Content</label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Type your initial research content here..."
                rows="15"
                disabled={loading}
              />
            </div>

            {error && <div className="error">{error}</div>}

            <div className="form-footer">
              <span className="markdown-hint">Markdown supported</span>
              <div style={{display: 'flex', gap: '1rem'}}>
                <button type="button" className="cancel-btn" onClick={() => setView('dashboard')} disabled={loading}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={loading || !title.trim() || !content.trim()}>
                  {loading ? 'Creating...' : 'Create Research'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}

export default CreateArtifact;
