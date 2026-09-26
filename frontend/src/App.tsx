import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TopBar } from './components/layout/TopBar';
import { Sidebar } from './components/layout/Sidebar';

// Pages
import { Login } from './pages/Login';
import { LowerHODDashboard } from './pages/lower-hod/Dashboard';
import { ReportProblem } from './pages/lower-hod/ReportProblem';
import { MyWork } from './pages/lower-hod/MyWork';
import { MCRPage } from './pages/lower-hod/MCRPage';
import { RequestHistory } from './pages/lower-hod/RequestHistory';

import { CommandDashboard } from './pages/higher-hod/CommandDashboard';
import { AllRequests } from './pages/higher-hod/AllRequests';
import { AIBlockPlanner } from './pages/higher-hod/AIBlockPlanner';
import { BlockManagement } from './pages/higher-hod/BlockManagement';
import { LiveOperations } from './pages/higher-hod/LiveOperations';
import { MCRVerification } from './pages/higher-hod/MCRVerification';
import { Analytics } from './pages/higher-hod/Analytics';
import { MasterData } from './pages/admin/MasterData';

const Layout: React.FC = () => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 p-6 overflow-y-auto max-h-[calc(100vh-65px)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const RootRedirect: React.FC = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'HIGHER_HOD') return <Navigate to="/higher/dashboard" replace />;
  return <Navigate to="/lower/dashboard" replace />;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route element={<Layout />}>
            <Route path="/" element={<RootRedirect />} />
            
            {/* Lower HOD Routes */}
            <Route path="/lower/dashboard" element={<LowerHODDashboard />} />
            <Route path="/lower/report" element={<ReportProblem />} />
            <Route path="/lower/my-work" element={<MyWork />} />
            <Route path="/lower/mcr" element={<MCRPage />} />
            <Route path="/lower/history" element={<RequestHistory />} />

            {/* Higher HOD Routes */}
            <Route path="/higher/dashboard" element={<CommandDashboard />} />
            <Route path="/higher/requests" element={<AllRequests />} />
            <Route path="/higher/ai-planner" element={<AIBlockPlanner />} />
            <Route path="/higher/blocks" element={<BlockManagement />} />
            <Route path="/higher/live-ops" element={<LiveOperations />} />
            <Route path="/higher/mcr-verify" element={<MCRVerification />} />
            <Route path="/higher/analytics" element={<Analytics />} />

            {/* Admin Routes */}
            <Route path="/admin/master" element={<MasterData />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
