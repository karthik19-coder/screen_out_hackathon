import { useState, useEffect } from 'react';
import { getArtifactVersions, getArtifactVersion, createArtifactVersion } from '../api';

function ArtifactView({ artifactId, setView }) {
  const [history, setHistory] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newContent, setNewContent] = useState('');

  const loadHistory = async () => {
    try {
      setLoading(true);
      const versions = await getArtifactVersions(artifactId);
      setHistory(versions);
      if (versions.length > 0) {
        // Load the latest version content by default
        const latest = versions[versions.length - 1];
        await loadVersionContent(latest.id, latest.version_number);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const loadVersionContent = async (versionId, versionNumber) => {
    try {
      setLoading(true);
      const data = await getArtifactVersion(artifactId, versionId);
      setSelectedVersion(data);
      setNewContent(data.content);
      setIsEditing(false);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [artifactId]);

  const handleSaveNewVersion = async () => {
    if (!newContent.trim() || newContent === selectedVersion?.content) {
        setIsEditing(false);
        return;
    }
    
    setLoading(true);
    try {
      await createArtifactVersion(artifactId, newContent);
      await loadHistory();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading && history.length === 0) return <div className="loading">Loading artifact...</div>;

  return (
    <div className="view-container">
      <button className="back-btn" onClick={() => setView('dashboard')}>
        &larr; Back to Dashboard
      </button>

      <div className="artifact-layout">
        {/* Sidebar History */}
        <div className="history-sidebar">
          <h3>Version History</h3>
          <ul className="version-list">
            {history.map((ver) => (
              <li 
                key={ver.id}
                className={selectedVersion?.id === ver.id ? 'active-version' : ''}
                onClick={() => loadVersionContent(ver.id, ver.version_number)}
              >
                V{ver.version_number} 
                <span className="version-date">{new Date(ver.created_at).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Main Content Area */}
        <div className="content-area">
          {error && <div className="error">{error}</div>}
          
          {selectedVersion && (
            <div className="version-details">
              <div className="version-header">
                <h2>Viewing Version {selectedVersion.version_number}</h2>
                {!isEditing ? (
                  <button className="secondary-btn" onClick={() => setIsEditing(true)}>Edit (Create New Version)</button>
                ) : (
                  <div className="edit-actions">
                    <button className="cancel-btn" onClick={() => { setIsEditing(false); setNewContent(selectedVersion.content); }}>Cancel</button>
                    <button className="primary-btn" onClick={handleSaveNewVersion}>Save New Version</button>
                  </div>
                )}
              </div>

              {isEditing ? (
                <textarea
                  className="edit-textarea"
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows="15"
                  disabled={loading}
                />
              ) : (
                <div className="readonly-content">
                  {selectedVersion.content.split('\n').map((line, i) => (
                      <p key={i}>{line || <br />}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ArtifactView;
