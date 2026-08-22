import { useState, useEffect } from 'react';
import { getArtifactVersions, getArtifactVersion, createArtifactVersion, compareArtifactVersions } from '../api';
import * as Diff from 'diff';

function ArtifactView({ artifactId, setView }) {
  const [history, setHistory] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newContent, setNewContent] = useState('');

  // Compare mode states
  const [compareMode, setCompareMode] = useState(false);
  const [baseVersionId, setBaseVersionId] = useState('');
  const [headVersionId, setHeadVersionId] = useState('');
  const [diffResult, setDiffResult] = useState(null);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const versions = await getArtifactVersions(artifactId);
      setHistory(versions);
      if (versions.length > 0) {
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
      setCompareMode(false);
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

  const handleCompare = async () => {
    if (!baseVersionId || !headVersionId) {
        setError('Please select both a base and head version.');
        return;
    }
    if (baseVersionId === headVersionId) {
        setError('Cannot compare a version with itself.');
        return;
    }

    setLoading(true);
    setError(null);
    try {
        const data = await compareArtifactVersions(artifactId, baseVersionId, headVersionId);
        const diff = Diff.diffLines(data.base_version.content, data.head_version.content);
        setDiffResult(diff);
        setLoading(false);
    } catch (err) {
        setError(err.message);
        setLoading(false);
    }
  };

  if (loading && history.length === 0) return <div className="loading">Loading artifact...</div>;

  return (
    <div className="view-container">
      <div className="header-actions">
        <button className="back-btn" onClick={() => setView('dashboard')}>
          &larr; Back to Dashboard
        </button>
        {!compareMode && history.length > 1 && (
            <button className="secondary-btn" onClick={() => setCompareMode(true)}>Compare Versions</button>
        )}
      </div>

      <div className="artifact-layout">
        {/* Sidebar History */}
        <div className="history-sidebar">
          <h3>Version History</h3>
          <ul className="version-list">
            {history.map((ver) => (
              <li 
                key={ver.id}
                className={selectedVersion?.id === ver.id && !compareMode ? 'active-version' : ''}
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
          
          {compareMode ? (
            <div className="compare-mode-container">
              <h2>Compare Versions</h2>
              <div className="compare-controls">
                <select value={baseVersionId} onChange={(e) => setBaseVersionId(e.target.value)}>
                    <option value="">Select Base Version</option>
                    {history.map(v => <option key={v.id} value={v.id}>V{v.version_number}</option>)}
                </select>
                <span className="vs-text">vs</span>
                <select value={headVersionId} onChange={(e) => setHeadVersionId(e.target.value)}>
                    <option value="">Select Head Version</option>
                    {history.map(v => <option key={v.id} value={v.id}>V{v.version_number}</option>)}
                </select>
                <button className="primary-btn" onClick={handleCompare} disabled={loading}>
                    {loading ? 'Loading...' : 'Compare'}
                </button>
                <button className="cancel-btn" onClick={() => setCompareMode(false)}>Close Compare</button>
              </div>

              {diffResult && (
                <div className="diff-result">
                  {diffResult.map((part, index) => {
                    const colorClass = part.added ? 'diff-added' : part.removed ? 'diff-removed' : 'diff-unchanged';
                    return (
                        <span key={index} className={colorClass}>
                          {part.value}
                        </span>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
             selectedVersion && (
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
             )
          )}
        </div>
      </div>
    </div>
  );
}

export default ArtifactView;
