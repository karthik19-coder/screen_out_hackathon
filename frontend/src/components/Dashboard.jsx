import { useState, useEffect, useRef } from 'react';
import { getArtifacts, uploadArtifact, searchArtifacts } from '../api';

function Dashboard({ setView, setSelectedArtifactId }) {
  const [artifacts, setArtifacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchAttempted, setSearchAttempted] = useState(false);

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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
        setSearchResults([]);
        setSearchAttempted(false);
        return;
    }
    
    setIsSearching(true);
    setError(null);
    try {
        const results = await searchArtifacts(searchQuery.trim());
        setSearchResults(results);
        setSearchAttempted(true);
        setIsSearching(false);
    } catch (err) {
        setError(err.message);
        setIsSearching(false);
    }
  };

  const clearSearch = () => {
      setSearchQuery('');
      setSearchResults([]);
      setSearchAttempted(false);
  };

  if (loading && !uploading && !isSearching) return <div className="loading">Loading artifacts...</div>;

  return (
    <div className="dashboard-container">
      <div className="header-row">
        <h2>Research Artifacts</h2>
        
        <div className="search-bar-container">
            <form onSubmit={handleSearch} className="search-form">
                <input 
                    type="text" 
                    placeholder="Search documents..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                />
                <button type="submit" className="primary-btn search-btn" disabled={isSearching || !searchQuery.trim()}>
                    {isSearching ? 'Searching...' : 'Search'}
                </button>
                {searchAttempted && (
                    <button type="button" className="cancel-btn" onClick={clearSearch}>Clear</button>
                )}
            </form>
        </div>

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

      {searchAttempted ? (
          <div className="search-results-section">
              <h3>Search Results ({searchResults.length})</h3>
              {searchResults.length === 0 ? (
                  <div className="empty-state">No matching documents found.</div>
              ) : (
                  <div className="artifact-list">
                      {searchResults.map((res, idx) => (
                          <div 
                              key={idx} 
                              className="artifact-card search-result-card"
                              onClick={() => {
                                  setSelectedArtifactId(res.artifact_id);
                                  // Technically we could pass versionId to view a specific version, 
                                  // but ArtifactView defaults to latest on main.
                                  // For a hackathon MVP, just opening the artifact is great.
                                  setView('view');
                              }}
                          >
                              <h3>{res.artifact_title}</h3>
                              <div className="search-meta">Branch: {res.branch_name} | V{res.version_number}</div>
                              <p className="search-snippet">"{res.snippet}"</p>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      ) : (
          artifacts.length === 0 ? (
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
          )
      )}
    </div>
  );
}

export default Dashboard;
