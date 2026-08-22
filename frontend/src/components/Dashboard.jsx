import { useState, useEffect, useRef } from 'react';
import { getArtifacts, uploadArtifact } from '../api';

function Dashboard({ setView, setSelectedArtifactId }) {
  const [artifacts, setArtifacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const fetchArtifacts = () => {
    getArtifacts()
      .then((data) => {
        setArtifacts(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchArtifacts();
  }, []);

  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const result = await uploadArtifact(file);
      setSelectedArtifactId(result.id);
      setView('view');
    } catch (err) {
      setError(err.message);
      setUploading(false);
      // Reset input so they can try again if they want
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (loading && !uploading) return <div className="loading">Loading artifacts...</div>;

  return (
    <div className="dashboard-container">
      <div className="header-row">
        <h2>Research Artifacts</h2>
        <div className="actions" style={{display: 'flex', gap: '1rem'}}>
            <button className="secondary-btn" onClick={handleUploadClick} disabled={uploading}>
              {uploading ? 'Uploading...' : 'Upload Document'}
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{display: 'none'}} 
              accept=".txt,.md,.pdf,.json" 
              onChange={handleFileChange}
              disabled={uploading}
            />
            <button className="primary-btn" onClick={() => setView('create')} disabled={uploading}>
            + New Research
            </button>
        </div>
      </div>
      
      {error && <div className="error">{error}</div>}

      {artifacts.length === 0 ? (
        <div className="empty-state">
          <h3>No research yet!</h3>
          <p>Create your first research artifact to get started.</p>
        </div>
      ) : (
        <div className="artifact-list">
          {artifacts.map((art) => (
            <div
              key={art.id}
              className="artifact-card"
              onClick={() => {
                if(uploading) return;
                setSelectedArtifactId(art.id);
                setView('view');
              }}
              style={uploading ? {opacity: 0.5, cursor: 'not-allowed'} : {}}
            >
              <h3>{art.title}</h3>
              <span className="date">Created: {new Date(art.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
