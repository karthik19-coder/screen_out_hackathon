import { useState, useEffect } from 'react';
import { getArtifactVersions, getArtifactVersion, createArtifactVersion, compareArtifactVersions, getBranches, checkMerge, deleteArtifact } from '../api';
import * as Diff from 'diff';

function ArtifactView({ artifactId, setView }) {
  const [history, setHistory] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [newContent, setNewContent] = useState('');

  // Branching states
  const [branches, setBranches] = useState(['main']);
  const [currentBranch, setCurrentBranch] = useState('main');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');

  // Compare mode states
  const [compareMode, setCompareMode] = useState(false);
  const [baseVersionId, setBaseVersionId] = useState('');
  const [headVersionId, setHeadVersionId] = useState('');
  const [diffResult, setDiffResult] = useState(null);

  // Merge Mode states
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSourceBranch, setMergeSourceBranch] = useState('');
  const [mergeStatus, setMergeStatus] = useState(null);
  const [mergeBase, setMergeBase] = useState(null);
  const [mergeSource, setMergeSource] = useState(null);
  const [mergeTarget, setMergeTarget] = useState(null);
  const [resolvedContent, setResolvedContent] = useState('');

  // Polling state
  const [newRemoteVersion, setNewRemoteVersion] = useState(null);

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadHistory = async (branchToLoad = currentBranch) => {
    try {
      setLoading(true);
      const branchList = await getBranches(artifactId);
      setBranches(branchList.length > 0 ? branchList : ['main']);

      const versions = await getArtifactVersions(artifactId, branchToLoad);
      setHistory(versions);
      if (versions.length > 0) {
        const latest = versions[versions.length - 1];
        await loadVersionContent(latest.id, latest.version_number);
      } else {
        setSelectedVersion(null);
        setNewContent('');
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
      setIsCreatingBranch(false);
      setCompareMode(false);
      setMergeMode(false);
      setMergeStatus(null);
      setNewRemoteVersion(null); 
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(currentBranch);
  }, [artifactId, currentBranch]);

  // Polling Effect for Concurrent Context
  useEffect(() => {
    let interval;
    if (artifactId && currentBranch && !compareMode && !mergeMode && !isEditing && !isCreatingBranch) {
      interval = setInterval(async () => {
        try {
          const versions = await getArtifactVersions(artifactId, currentBranch);
          if (versions.length > 0) {
            const remoteLatest = versions[versions.length - 1];
            
            setHistory(prevHistory => {
              const localLatest = prevHistory.length > 0 ? prevHistory[prevHistory.length - 1] : null;
              if (localLatest && remoteLatest.version_number > localLatest.version_number) {
                setNewRemoteVersion(remoteLatest);
                return versions;
              }
              return prevHistory;
            });
          }
        } catch (e) {
          console.error("Polling error:", e);
        }
      }, 5000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [artifactId, currentBranch, compareMode, mergeMode, isEditing, isCreatingBranch]);

  const handleSaveNewVersion = async () => {
    if (!newContent.trim() || newContent === selectedVersion?.content) {
        setIsEditing(false);
        return;
    }
    
    setLoading(true);
    try {
      await createArtifactVersion(artifactId, newContent, currentBranch, selectedVersion?.id);
      await loadHistory(currentBranch);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) {
      setError("Branch name cannot be empty");
      return;
    }
    if (branches.includes(newBranchName.trim())) {
      setError("Branch already exists");
      return;
    }
    
    setLoading(true);
    try {
      const branchName = newBranchName.trim();
      await createArtifactVersion(artifactId, newContent, branchName, selectedVersion?.id);
      setCurrentBranch(branchName);
      setIsCreatingBranch(false);
      setNewBranchName('');
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

  const handleCompareNewVersion = () => {
    if (!selectedVersion || !newRemoteVersion) return;
    setBaseVersionId(selectedVersion.id);
    setHeadVersionId(newRemoteVersion.id);
    setCompareMode(true);
    setNewRemoteVersion(null);
    handleCompareWithArgs(selectedVersion.id, newRemoteVersion.id);
  };
  
  const handleCompareWithArgs = async (base, head) => {
    setLoading(true);
    setError(null);
    try {
        const data = await compareArtifactVersions(artifactId, base, head);
        const diff = Diff.diffLines(data.base_version.content, data.head_version.content);
        setDiffResult(diff);
        setLoading(false);
    } catch (err) {
        setError(err.message);
        setLoading(false);
    }
  };

  const startMergeMode = () => {
      setMergeMode(true);
      setMergeStatus(null);
      setMergeSourceBranch('');
  };

  const handleCheckMerge = async () => {
      if (!mergeSourceBranch) {
          setError("Please select a source branch to merge");
          return;
      }
      setLoading(true);
      setError(null);
      try {
          const res = await checkMerge(artifactId, mergeSourceBranch, currentBranch);
          setMergeStatus(res.status);
          setMergeBase(res.base);
          setMergeSource(res.source);
          setMergeTarget(res.target);
          if (res.status === 'conflict') {
              setResolvedContent(`<<<<<<< TARGET (${currentBranch})\n${res.target.content}\n=======\n${res.source.content}\n>>>>>>> SOURCE (${mergeSourceBranch})`);
          }
          setLoading(false);
      } catch (err) {
          setError(err.message);
          setLoading(false);
      }
  };

  const handleSaveMerge = async () => {
      if (!resolvedContent.trim()) {
          setError("Resolved content cannot be empty");
          return;
      }
      setLoading(true);
      try {
          await createArtifactVersion(artifactId, resolvedContent, currentBranch, mergeTarget.id);
          setMergeMode(false);
          await loadHistory(currentBranch);
      } catch (err) {
          setError(err.message);
          setLoading(false);
      }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteArtifact(artifactId);
      // Remove from My Artifacts localStorage if present
      try {
        const stored = localStorage.getItem('researchgit_my_artifacts');
        if (stored) {
          const ids = JSON.parse(stored);
          const updated = ids.filter(id => id !== artifactId);
          localStorage.setItem('researchgit_my_artifacts', JSON.stringify(updated));
        }
      } catch (e) {
        console.error("Local storage error", e);
      }
      
      setView('dashboard');
    } catch (err) {
      setError(err.message);
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading && history.length === 0 && !selectedVersion) return <div className="loading">Loading artifact...</div>;

  return (
    <>
      <header className="app-header">
        <h1 onClick={() => setView('dashboard')} className="brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          ResearchGit
        </h1>
        
        <div className="header-actions">
            {!compareMode && !mergeMode && history.length > 1 && (
                <button className="secondary-btn" onClick={() => setCompareMode(true)}>
                  Compare Versions
                </button>
            )}
            {!compareMode && !mergeMode && (
                <button className="secondary-btn" onClick={startMergeMode}>
                  Merge Branch
                </button>
            )}
        </div>
      </header>
      
      <main className="main-content">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <button className="back-btn" onClick={() => setView('dashboard')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              Back to Dashboard
            </button>
            <button 
              className="delete-icon-btn" 
              onClick={() => setShowDeleteModal(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
              Delete Artifact
            </button>
        </div>

        <div className="artifact-layout">
          {/* Sidebar History */}
          <div className="history-sidebar">
            <div className="form-group" style={{marginBottom: '2rem'}}>
              <label>Branch</label>
              <select 
                value={currentBranch} 
                onChange={(e) => setCurrentBranch(e.target.value)}
                style={{padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontFamily: 'inherit', width: '100%'}}
              >
                  {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            
            <h3>Version History</h3>
            <div className="timeline-container">
              {[...history].reverse().map((ver) => (
                <div 
                  key={ver.id}
                  className={`timeline-item ${selectedVersion?.id === ver.id && !compareMode && !mergeMode ? 'active' : ''}`}
                  onClick={() => loadVersionContent(ver.id, ver.version_number)}
                >
                  <div className="tl-title">V{ver.version_number}</div>
                  <div className="tl-meta">
                    {new Date(ver.created_at).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})} &middot; {ver.branch_name}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Main Content Area */}
          <div className="content-area">
            {error && <div className="error">{error}</div>}
            
            {newRemoteVersion && !compareMode && !mergeMode && (
              <div className="new-version-banner">
                <span className="banner-text">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '0.5rem', verticalAlign: 'middle'}}><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                  New version published: V{newRemoteVersion.version_number} was created while you were viewing V{selectedVersion?.version_number}.
                </span>
                <div className="banner-actions">
                  <button className="primary-btn" onClick={handleCompareNewVersion}>Compare changes</button>
                  <button className="cancel-btn" onClick={() => setNewRemoteVersion(null)}>Dismiss</button>
                </div>
              </div>
            )}

            {mergeMode ? (
              <div className="merge-mode-container">
                 <div className="compare-header">
                   <h2>Merge Branch</h2>
                   <button className="cancel-btn" onClick={() => setMergeMode(false)}>Close Merge</button>
                 </div>
                 
                 {branches.length <= 1 ? (
                     <div className="merge-status-panel">
                         <p>No other branches available. Create a branch from this version first to start merging.</p>
                     </div>
                 ) : (
                     <>
                         {!mergeStatus && (
                             <div className="merge-controls">
                                 <span className="vs-text">Source</span>
                                 <select value={mergeSourceBranch} onChange={(e) => setMergeSourceBranch(e.target.value)}>
                                     <option value="">Select branch...</option>
                                     {branches.filter(b => b !== currentBranch).map(b => <option key={b} value={b}>{b}</option>)}
                                 </select>
                                 <span className="vs-text">→ Target ({currentBranch})</span>
                                 <button className="primary-btn" onClick={handleCheckMerge} disabled={loading || !mergeSourceBranch}>
                                     Check Merge
                                 </button>
                             </div>
                         )}

                         {mergeStatus === 'up_to_date' && (
                             <div className="merge-status-panel up-to-date">
                                 <h3>Already up to date</h3>
                                 <p>The target branch contains all changes from the source branch.</p>
                             </div>
                         )}

                         {mergeStatus === 'fast_forward' && (
                             <div className="merge-status-panel fast-forward">
                                 <h3>Fast-Forward Merge Possible</h3>
                                 <p>Source branch <b>{mergeSourceBranch}</b> is strictly ahead of target <b>{currentBranch}</b>. No conflicts detected.</p>
                                 <p style={{marginTop: '0.5rem', fontStyle: 'italic'}}>For this MVP, please manually view the branch to incorporate it, or resolve as a conflict if needed.</p>
                             </div>
                         )}

                         {mergeStatus === 'conflict' && (
                             <div className="merge-conflict-ui">
                                 <div className="conflict-warning">
                                     <h3>
                                       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                                       Merge Conflict Detected
                                     </h3>
                                     <p>Both branches modified the same content since their common ancestor (V{mergeBase.version_number}).</p>
                                 </div>

                                 <div className="conflict-panels">
                                     <div className="conflict-panel">
                                         <div className="conflict-panel-header">Target ({currentBranch})</div>
                                         <div className="conflict-panel-content">{mergeTarget.content}</div>
                                     </div>
                                     <div className="conflict-panel">
                                         <div className="conflict-panel-header">Source ({mergeSourceBranch})</div>
                                         <div className="conflict-panel-content">{mergeSource.content}</div>
                                     </div>
                                 </div>
                                 
                                 <div className="resolution-section">
                                     <h4>Resolution (Edit the merged content)</h4>
                                     <textarea
                                         className="resolution-textarea"
                                         value={resolvedContent}
                                         onChange={(e) => setResolvedContent(e.target.value)}
                                     />
                                     <div style={{display: 'flex', justifyContent: 'flex-end'}}>
                                       <button className="primary-btn" onClick={handleSaveMerge} disabled={loading}>
                                           {loading ? 'Saving...' : 'Save Merge'}
                                       </button>
                                     </div>
                                 </div>
                             </div>
                         )}
                     </>
                 )}
              </div>

            ) : compareMode ? (
              <div className="compare-mode-container">
                <div className="compare-header">
                  <h2>Compare Versions</h2>
                  <button className="cancel-btn" onClick={() => {
                    setCompareMode(false);
                    setDiffResult(null);
                  }}>Close Compare</button>
                </div>

                <div className="compare-controls">
                  <span className="vs-text">Base</span>
                  <select value={baseVersionId} onChange={(e) => setBaseVersionId(e.target.value)}>
                      <option value="">Select version...</option>
                      {history.map(v => <option key={v.id} value={v.id}>V{v.version_number}</option>)}
                  </select>
                  <span className="vs-text">↔ Head</span>
                  <select value={headVersionId} onChange={(e) => setHeadVersionId(e.target.value)}>
                      <option value="">Select version...</option>
                      {history.map(v => <option key={v.id} value={v.id}>V{v.version_number}</option>)}
                  </select>
                  <button className="primary-btn" onClick={handleCompare} disabled={loading}>
                      {loading ? 'Loading...' : 'Compare'}
                  </button>
                </div>

                {diffResult && (
                  <div className="diff-result">
                    <div style={{marginBottom: '1rem', display: 'flex', gap: '1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase'}}>
                      <span style={{display: 'flex', alignItems: 'center', gap: '0.25rem'}}><span style={{display: 'inline-block', width: '10px', height: '10px', backgroundColor: 'var(--diff-rm-bg)', border: '1px solid var(--diff-rm-text)'}}></span> Removed</span>
                      <span style={{display: 'flex', alignItems: 'center', gap: '0.25rem'}}><span style={{display: 'inline-block', width: '10px', height: '10px', backgroundColor: 'var(--diff-add-bg)', border: '1px solid var(--diff-add-text)'}}></span> Added</span>
                    </div>
                    {diffResult.map((part, index) => {
                      const colorClass = part.added ? 'diff-added' : part.removed ? 'diff-removed' : 'diff-unchanged';
                      const prefix = part.added ? '+ ' : part.removed ? '− ' : '  ';
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
                      <h2>Artifact View</h2>
                      <div className="version-meta">
                        <span>Branch: {currentBranch}</span> &middot;
                        <span>Viewing V{selectedVersion.version_number}</span> &middot;
                        <span>{history.length} total versions</span>
                      </div>
                      
                      {!isEditing && !isCreatingBranch ? (
                        <div className="version-actions">
                          <button className="secondary-btn" onClick={() => setIsEditing(true)}>Edit (New Version)</button>
                          <button className="secondary-btn" onClick={() => setIsCreatingBranch(true)}>Branch from here</button>
                        </div>
                      ) : (
                        isCreatingBranch ? (
                          <div className="version-actions">
                              <input 
                                type="text" 
                                placeholder="New branch name" 
                                value={newBranchName}
                                onChange={(e) => setNewBranchName(e.target.value)}
                                style={{padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '6px'}}
                              />
                              <button className="primary-btn" onClick={handleCreateBranch}>Create Branch</button>
                              <button className="cancel-btn" onClick={() => { setIsCreatingBranch(false); setNewContent(selectedVersion.content); setNewBranchName(''); }}>Cancel</button>
                          </div>
                        ) : (
                          <div className="version-actions">
                              <button className="primary-btn" onClick={handleSaveNewVersion}>Save New Version</button>
                              <button className="cancel-btn" onClick={() => { setIsEditing(false); setNewContent(selectedVersion.content); }}>Cancel</button>
                          </div>
                        )
                      )}
                  </div>

                  {isEditing || isCreatingBranch ? (
                      <textarea
                      className="edit-textarea"
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
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
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div className="modal-content" style={{background: '#fff', padding: '2rem', borderRadius: '8px', maxWidth: '450px', width: '90%', border: '1px solid var(--border-color)', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}}>
            <h3 style={{marginTop: 0, fontSize: '1.25rem'}}>Delete artifact?</h3>
            <p style={{margin: '1.5rem 0 0.5rem'}}>Are you sure you want to delete this artifact?</p>
            <p style={{color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0 0 2rem'}}>All versions and branches of this artifact will be permanently deleted.</p>
            <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end'}}>
              <button className="secondary-btn" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>Cancel</button>
              <button 
                className="primary-btn" 
                style={{background: '#dc2626', borderColor: '#dc2626', color: '#fff'}} 
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default ArtifactView;
