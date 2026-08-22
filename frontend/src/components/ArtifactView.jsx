import { useState, useEffect } from 'react';
import { getArtifactVersions, getArtifactVersion, createArtifactVersion, compareArtifactVersions, getBranches, checkMerge } from '../api';
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

  if (loading && history.length === 0 && !selectedVersion) return <div className="loading">Loading artifact...</div>;

  return (
    <div className="view-container">
      <div className="header-actions">
        <button className="back-btn" onClick={() => setView('dashboard')}>
          &larr; Back to Dashboard
        </button>
        <div style={{display: 'flex', gap: '1rem'}}>
            {!compareMode && !mergeMode && history.length > 1 && (
                <button className="secondary-btn" onClick={() => setCompareMode(true)}>Compare Versions</button>
            )}
            {!compareMode && !mergeMode && branches.length > 1 && (
                <button className="secondary-btn" onClick={startMergeMode}>Merge Branch</button>
            )}
        </div>
      </div>

      <div className="artifact-layout">
        {/* Sidebar History */}
        <div className="history-sidebar">
          <div className="branch-selector" style={{marginBottom: '1rem'}}>
            <label style={{display:'block', marginBottom:'0.5rem', fontWeight:'bold', fontSize:'0.9rem'}}>Branch</label>
            <select 
              value={currentBranch} 
              onChange={(e) => setCurrentBranch(e.target.value)}
              style={{width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)'}}
            >
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          
          <h3>Version History</h3>
          <ul className="version-list">
            {history.map((ver) => (
              <li 
                key={ver.id}
                className={selectedVersion?.id === ver.id && !compareMode && !mergeMode ? 'active-version' : ''}
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
          
          {newRemoteVersion && !compareMode && !mergeMode && (
            <div className="new-version-banner">
              <span className="banner-text">A new version (V{newRemoteVersion.version_number}) was published.</span>
              <div className="banner-actions">
                <button className="primary-btn" onClick={handleCompareNewVersion}>Compare changes</button>
                <button className="cancel-btn" onClick={() => setNewRemoteVersion(null)}>Dismiss</button>
              </div>
            </div>
          )}

          {mergeMode ? (
            <div className="merge-mode-container">
               <h2>Merge Branch into {currentBranch}</h2>
               
               {!mergeStatus && (
                   <div className="merge-controls" style={{display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '2rem'}}>
                       <select value={mergeSourceBranch} onChange={(e) => setMergeSourceBranch(e.target.value)} style={{padding: '0.5rem'}}>
                           <option value="">Select source branch</option>
                           {branches.filter(b => b !== currentBranch).map(b => <option key={b} value={b}>{b}</option>)}
                       </select>
                       <button className="primary-btn" onClick={handleCheckMerge} disabled={loading || !mergeSourceBranch}>
                           Check Merge
                       </button>
                       <button className="cancel-btn" onClick={() => setMergeMode(false)}>Cancel</button>
                   </div>
               )}

               {mergeStatus === 'up_to_date' && (
                   <div style={{padding: '1rem', backgroundColor: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: '4px'}}>
                       <h3 style={{color: '#065F46'}}>Already up to date</h3>
                       <p>The target branch contains all changes from the source branch.</p>
                       <button className="secondary-btn" style={{marginTop: '1rem'}} onClick={() => setMergeMode(false)}>Close</button>
                   </div>
               )}

               {mergeStatus === 'fast_forward' && (
                   <div style={{padding: '1rem', backgroundColor: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: '4px'}}>
                       <h3 style={{color: '#1E40AF'}}>Fast-Forward Merge Possible</h3>
                       <p>Source branch <b>{mergeSourceBranch}</b> is strictly ahead of target <b>{currentBranch}</b>. No conflicts detected.</p>
                       <p style={{fontStyle: 'italic', fontSize: '0.9rem', marginTop: '0.5rem'}}>For this MVP, please manually view the branch to incorporate it, or resolve as a conflict if needed.</p>
                       <button className="secondary-btn" style={{marginTop: '1rem'}} onClick={() => setMergeMode(false)}>Close</button>
                   </div>
               )}

               {mergeStatus === 'conflict' && (
                   <div className="merge-conflict-ui">
                       <div style={{padding: '1rem', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '4px', marginBottom: '1rem'}}>
                           <h3 style={{color: '#991B1B', margin: 0}}>Merge Conflict Detected</h3>
                           <p style={{margin: '0.5rem 0 0 0'}}>Both branches have diverged since their common ancestor (V{mergeBase.version_number}). Please manually resolve the content below.</p>
                       </div>

                       <div style={{display: 'flex', gap: '1rem', marginBottom: '1rem'}}>
                           <div style={{flex: 1, border: '1px solid var(--border-color)', borderRadius: '4px', padding: '1rem', background: '#f9f9f9'}}>
                               <h4>Target ({currentBranch} - V{mergeTarget.version_number})</h4>
                               <pre style={{whiteSpace: 'pre-wrap', fontSize: '0.9rem', fontFamily: 'inherit'}}>{mergeTarget.content}</pre>
                           </div>
                           <div style={{flex: 1, border: '1px solid var(--border-color)', borderRadius: '4px', padding: '1rem', background: '#f9f9f9'}}>
                               <h4>Source ({mergeSourceBranch} - V{mergeSource.version_number})</h4>
                               <pre style={{whiteSpace: 'pre-wrap', fontSize: '0.9rem', fontFamily: 'inherit'}}>{mergeSource.content}</pre>
                           </div>
                       </div>
                       
                       <div style={{marginBottom: '1rem'}}>
                           <h4>Resolved Content</h4>
                           <textarea
                               style={{width: '100%', height: '200px', padding: '1rem', fontFamily: 'monospace', border: '1px solid var(--border-color)', borderRadius: '4px'}}
                               value={resolvedContent}
                               onChange={(e) => setResolvedContent(e.target.value)}
                           />
                       </div>

                       <div style={{display: 'flex', gap: '1rem'}}>
                           <button className="primary-btn" onClick={handleSaveMerge} disabled={loading}>
                               {loading ? 'Saving...' : 'Save Merge (New Version)'}
                           </button>
                           <button className="cancel-btn" onClick={() => setMergeMode(false)}>Cancel</button>
                       </div>
                   </div>
               )}

            </div>
          ) : compareMode ? (
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
                <button className="cancel-btn" onClick={() => {
                  setCompareMode(false);
                  setDiffResult(null);
                }}>Close Compare</button>
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
                    {!isEditing && !isCreatingBranch ? (
                      <div className="edit-actions">
                        <button className="secondary-btn" onClick={() => setIsEditing(true)}>Edit (New Version)</button>
                        <button className="secondary-btn" onClick={() => setIsCreatingBranch(true)}>Branch from here</button>
                      </div>
                    ) : (
                      isCreatingBranch ? (
                        <div className="edit-actions" style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
                            <input 
                              type="text" 
                              placeholder="New branch name" 
                              value={newBranchName}
                              onChange={(e) => setNewBranchName(e.target.value)}
                              style={{padding: '0.4rem', border: '1px solid var(--border-color)', borderRadius: '4px'}}
                            />
                            <button className="cancel-btn" onClick={() => { setIsCreatingBranch(false); setNewContent(selectedVersion.content); setNewBranchName(''); }}>Cancel</button>
                            <button className="primary-btn" onClick={handleCreateBranch}>Create Branch</button>
                        </div>
                      ) : (
                        <div className="edit-actions">
                            <button className="cancel-btn" onClick={() => { setIsEditing(false); setNewContent(selectedVersion.content); }}>Cancel</button>
                            <button className="primary-btn" onClick={handleSaveNewVersion}>Save New Version</button>
                        </div>
                      )
                    )}
                </div>

                {isEditing || isCreatingBranch ? (
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
