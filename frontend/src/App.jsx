import { useState } from 'react';
import Dashboard from './components/Dashboard';
import CreateArtifact from './components/CreateArtifact';
import ArtifactView from './components/ArtifactView';
import './App.css';

function App() {
  const [view, setView] = useState('dashboard');
  const [selectedArtifactId, setSelectedArtifactId] = useState(null);

  return (
    <div className="app-container">
      {view === 'dashboard' && (
        <Dashboard 
          setView={setView} 
          setSelectedArtifactId={setSelectedArtifactId} 
        />
      )}
      
      {view === 'create' && (
        <CreateArtifact 
          setView={setView} 
          setSelectedArtifactId={setSelectedArtifactId} 
        />
      )}
      
      {view === 'view' && selectedArtifactId && (
        <ArtifactView 
          artifactId={selectedArtifactId} 
          setView={setView} 
        />
      )}
    </div>
  );
}

export default App;
