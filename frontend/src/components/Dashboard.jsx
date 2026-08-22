import { useState, useEffect, useRef } from 'react';
import { getArtifacts, uploadArtifact, searchArtifacts, deleteArtifact } from '../api';

function Dashboard({ setView, setSelectedArtifactId }) {
  const [artifacts, setArtifacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Tabs state
  const [activeTab, setActiveTab] = useState('all');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Delete state
  const [artifactToDelete, setArtifactToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // My Artifacts state
  const [myArtifactIds, setMyArtifactIds] = useState(() => {
    try {
      const stored = localStorage.getItem('researchgit_my_artifacts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addMyArtifact = (id) => {
    const updated = [...myArtifactIds, id];
    setMyArtifactIds(updated);
    localStorage.setItem('researchgit_my_artifacts', JSON.stringify(updated));
  };

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
    // Clear state on mount to ensure clean dashboard return
    setSearchQuery('');
    setSearchResults([]);
    setActiveTab('all');
  }, []);

  // Handle search when query changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchArtifacts(searchQuery.trim());
        setSearchResults(results);
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

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
      addMyArtifact(result.id);
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

  const handleSearchSubmit = (e) => {
    e.preventDefault();
  };

  const clearSearch = () => {
      setSearchQuery('');
      setSearchResults([]);
  };

  const handleDeleteClick = (e, artifact) => {
    e.stopPropagation();
    setArtifactToDelete(artifact);
  };

  const cancelDelete = () => {
    setArtifactToDelete(null);
  };

  const confirmDelete = async () => {
    if (!artifactToDelete) return;
    setDeletingId(artifactToDelete.id);
    
    try {
      await deleteArtifact(artifactToDelete.id);
      
      setArtifacts(prev => prev.filter(a => a.id !== artifactToDelete.id));
      setSearchResults(prev => prev.filter(res => res.artifact_id !== artifactToDelete.id));
      
      if (myArtifactIds.includes(artifactToDelete.id)) {
        const updatedIds = myArtifactIds.filter(id => id !== artifactToDelete.id);
        setMyArtifactIds(updatedIds);
        localStorage.setItem('researchgit_my_artifacts', JSON.stringify(updatedIds));
      }
    } catch (err) {
      console.error("Failed to delete artifact", err);
      setError("Failed to delete artifact: " + err.message);
    } finally {
      setDeletingId(null);
      setArtifactToDelete(null);
    }
  };

  // Filter and Sort artifacts based on activeTab
  const getProcessedArtifacts = () => {
    let filtered = [...artifacts];
    if (activeTab === 'mine') {
      filtered = filtered.filter(a => myArtifactIds.includes(a.id));
    }
    if (activeTab === 'recent') {
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    return filtered;
  };

  const getProcessedSearchResults = () => {
    let filtered = [...searchResults];
    if (activeTab === 'mine') {
      filtered = filtered.filter(res => myArtifactIds.includes(res.artifact_id));
    }
    if (activeTab === 'recent') {
      filtered.sort((a, b) => {
        const artA = artifacts.find(art => art.id === a.artifact_id);
        const artB = artifacts.find(art => art.id === b.artifact_id);
        const dateA = artA ? new Date(artA.created_at) : new Date(0);
        const dateB = artB ? new Date(artB.created_at) : new Date(0);
        return dateB - dateA;
      });
    }
    return filtered;
  };

  const displayedArtifacts = getProcessedArtifacts();
  const displayedSearchResults = getProcessedSearchResults();
  const hasSearch = searchQuery.trim().length > 0;

  return (
    <>
      <header className="app-header">
        <h1 onClick={() => { setView('dashboard'); clearSearch(); setActiveTab('all'); }} className="brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          ResearchGit
        </h1>
        
        <div className="header-search">
            <form onSubmit={handleSearchSubmit} className="header-search-form" style={{position: 'relative'}}>
                <input 
                    type="text" 
                    placeholder="Search artifacts, content, or keywords..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                    style={{width: '100%', padding: '0.6rem 2.5rem 0.6rem 1rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.875rem', background: '#fff', color: '#111'}}
                />
                {searchQuery && (
                  <button type="button" onClick={clearSearch} style={{position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)'}}>
                    ✕
                  </button>
                )}
            </form>
        </div>

        <div className="header-actions">
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
      </header>

      <main className="main-content">
        <div className="dashboard-header">
          <h2>Your Research</h2>
          <p>All your artifacts in one place</p>
        </div>

        {error && <div className="error" style={{marginBottom: '1rem'}}>{error}</div>}

        <div className="dashboard-filters">
          <div className="filter-tabs">
            <span className={`filter-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>All</span>
            <span className={`filter-tab ${activeTab === 'mine' ? 'active' : ''}`} onClick={() => setActiveTab('mine')}>My Artifacts</span>
            <span className={`filter-tab ${activeTab === 'recent' ? 'active' : ''}`} onClick={() => setActiveTab('recent')}>Recently Updated</span>
          </div>
          <div className="sort-info">
            {activeTab === 'recent' ? 'Sort by: Updated (Newest)' : 'Sort by: Default'}
          </div>
        </div>

        <div className="dashboard-layout">
          {/* Left Column */}
          <div>
            {hasSearch ? (
              <div className="search-results-section">
                <h3 style={{fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-muted)'}}>
                  {isSearching ? 'Searching...' : `Search Results for "${searchQuery}" (${displayedSearchResults.length})`}
                </h3>
                
                {!isSearching && displayedSearchResults.length === 0 ? (
                  <div className="empty-state">
                    <h3>No results</h3>
                    <p>No artifacts matched "{searchQuery}".<br/>Try another keyword.</p>
                  </div>
                ) : (
                  <div className="artifact-list">
                      {displayedSearchResults.map((res, idx) => {
                          const art = artifacts.find(a => a.id === res.artifact_id);
                          return (
                          <div 
                              key={idx} 
                              className="artifact-card"
                              onClick={() => {
                                  setSelectedArtifactId(res.artifact_id);
                                  setView('view');
                              }}
                          >
                              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                                <h3 style={{margin: 0, paddingBottom: '0.25rem'}}>{res.artifact_title}</h3>
                                <button 
                                  className="delete-icon-btn" 
                                  title="Delete Artifact"
                                  onClick={(e) => handleDeleteClick(e, { id: res.artifact_id, title: res.artifact_title })}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex', alignItems: 'center' }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                </button>
                              </div>
                              <div className="meta" style={{marginBottom: '0.75rem'}}>
                                <span>V{res.version_number}</span> &middot;
                                <span>{res.branch_name}</span> &middot;
                                {art && <span>{new Date(art.created_at).toLocaleDateString()}</span>}
                              </div>
                              <p className="snippet" style={{whiteSpace:'pre-wrap', fontStyle:'italic', padding:'0.75rem', background:'var(--bg-color)', borderLeft:'3px solid var(--border-color)', margin:0}}>
                                "{res.snippet}"
                              </p>
                          </div>
                          );
                      })}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {loading && !uploading ? (
                  <div className="loading">Loading artifacts...</div>
                ) : displayedArtifacts.length === 0 ? (
                  <div className="empty-state">
                    {activeTab === 'mine' ? (
                      <>
                        <h3>No artifacts yet</h3>
                        <p>Create or upload your first research document.</p>
                      </>
                    ) : activeTab === 'recent' ? (
                      <>
                        <h3>No recently updated artifacts</h3>
                        <p>Check back later.</p>
                      </>
                    ) : (
                      <>
                        <h3>No research yet!</h3>
                        <p>Create your first research artifact to get started.</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="artifact-list">
                    {displayedArtifacts.map((art) => (
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
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                          <h3 style={{margin: 0}}>{art.title}</h3>
                          <button 
                            className="delete-icon-btn" 
                            title="Delete Artifact"
                            onClick={(e) => handleDeleteClick(e, art)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '2px', display: 'flex', alignItems: 'center' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                          </button>
                        </div>
                        <p className="snippet" style={{marginTop: '0.5rem'}}>A research artifact containing document history and versions...</p>
                        <div className="meta">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                          <span>Updated {new Date(art.created_at).toLocaleDateString()}</span>
                          &middot;
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                          <span>Artifact ID: {art.id.substring(0,8)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column */}
          <div>
            <div className="side-panel">
              <h3>Recent Activity</h3>
              <p style={{fontSize:'0.875rem', color:'var(--text-muted)', margin: 0}}>No recent activity to show.</p>
            </div>
            <div className="side-panel">
              <h3>Statistics</h3>
              <div className="stat-row">
                <span className="stat-label">Total Artifacts</span>
                <span className="stat-val">{artifacts.length}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">My Artifacts</span>
                <span className="stat-val">{myArtifactIds.length}</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {artifactToDelete && (
        <div className="modal-overlay" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div className="modal-content" style={{background: '#fff', padding: '2rem', borderRadius: '8px', maxWidth: '450px', width: '90%', border: '1px solid var(--border-color)', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}}>
            <h3 style={{marginTop: 0, fontSize: '1.25rem'}}>Delete artifact?</h3>
            <p style={{margin: '1.5rem 0 0.5rem'}}>Are you sure you want to delete <strong>{artifactToDelete.title}</strong>?</p>
            <p style={{color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 2rem'}}>All versions and branches of this artifact will be permanently deleted.</p>
            <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end'}}>
              <button className="secondary-btn" onClick={cancelDelete} disabled={deletingId === artifactToDelete.id}>Cancel</button>
              <button 
                className="primary-btn" 
                style={{background: '#dc2626', borderColor: '#dc2626', color: '#fff'}} 
                onClick={confirmDelete}
                disabled={deletingId === artifactToDelete.id}
              >
                {deletingId === artifactToDelete.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Dashboard;
