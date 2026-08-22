import { useState, useEffect } from 'react';
import { getArtifacts } from '../api';

function Dashboard({ setView, setSelectedArtifactId }) {
  const [artifacts, setArtifacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getArtifacts()
      .then((data) => {
        setArtifacts(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="loading">Loading artifacts...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="dashboard-container">
      <div className="header-row">
        <h2>Research Artifacts</h2>
        <button className="primary-btn" onClick={() => setView('create')}>
          + New Research
        </button>
      </div>

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
                setSelectedArtifactId(art.id);
                setView('view');
              }}
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
