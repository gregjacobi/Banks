import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import BankSearch from './components/BankSearch';
import BankDetail from './components/BankDetail';
import MultiBankUBPRValidation from './components/MultiBankUBPRValidation';
import FFIECUploadTab from './components/FFIECUploadTab';
import GroundingAdmin from './pages/GroundingAdmin';
import ResearchIDE from './pages/ResearchIDE';
import PresentationViewer from './pages/PresentationViewer';
import TAMDashboard from './pages/TAMDashboard';
import TeamMemberDetail from './pages/TeamMemberDetail';
import StrategicPrioritiesDashboard from './pages/StrategicPrioritiesDashboard';
import { PodcastPlayerProvider, usePodcastPlayer } from './contexts/PodcastPlayerContext';
import CompactPodcastPlayer from './components/CompactPodcastPlayer';

function AppContent() {
  const { persistentPodcast, closePodcast } = usePodcastPlayer();

  return (
    <div className="min-h-screen bg-background">
      <Routes>
        {/* Research IDE - Full screen, no navbar */}
        <Route path="/research/:idrssd" element={<ResearchIDE />} />

        {/* Presentation Viewer - Full screen, no navbar */}
        <Route path="/presentations/:idrssd/:filename" element={<PresentationViewer />} />

        {/* All other routes - with navbar */}
        <Route path="/*" element={
          <>
            <Navbar />
            <div className="container mx-auto py-4">
              <Routes>
                <Route path="/" element={<BankSearch />} />
                <Route path="/bank/:idrssd" element={<BankDetail />} />
                <Route path="/tam" element={<TAMDashboard />} />
                <Route path="/tam/member/:memberId" element={<TeamMemberDetail />} />
                <Route path="/strategic-priorities" element={<StrategicPrioritiesDashboard />} />
                <Route path="/ubpr" element={<MultiBankUBPRValidation />} />
                <Route path="/ffiec" element={<FFIECUploadTab />} />
                <Route path="/admin" element={<GroundingAdmin />} />
              </Routes>
            </div>
          </>
        } />
      </Routes>

      {/* Global Persistent Podcast Player */}
      {persistentPodcast && (
        <CompactPodcastPlayer
          podcastUrl={persistentPodcast.url}
          bankName={persistentPodcast.bankName}
          onClose={closePodcast}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <PodcastPlayerProvider>
      <Router>
        <AppContent />
      </Router>
    </PodcastPlayerProvider>
  );
}

export default App;
