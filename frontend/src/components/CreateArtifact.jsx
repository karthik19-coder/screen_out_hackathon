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
      setSelectedArtifactId(result.id);
      setView('view');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="create-container">
      <button className="back-btn" onClick={() => setView('dashboard')}>
        &larr; Back to Dashboard
      </button>
      <h2>Create New Research Artifact</h2>

      <form onSubmit={handleSubmit} className="create-form">
        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter research title..."
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="content">Research Content (Version 1)</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your initial research content here..."
            rows="10"
            disabled={loading}
          />
        </div>

        {error && <div className="error">{error}</div>}

        <button type="submit" className="primary-btn" disabled={loading || !title.trim() || !content.trim()}>
          {loading ? 'Creating...' : 'Create Artifact'}
        </button>
      </form>
    </div>
  );
}

export default CreateArtifact;
