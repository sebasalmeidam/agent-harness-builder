import { Routes, Route } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import ErrorBoundary from './components/ErrorBoundary';
import TeamsListPage from './pages/TeamsListPage';
import CreateTeamPage from './pages/CreateTeamPage';
import TeamDetailPage from './pages/TeamDetailPage';
import ProjectsListPage from './pages/ProjectsListPage';
import CreateProjectPage from './pages/CreateProjectPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import DashboardPage from './pages/DashboardPage';
import ExecutionPage from './pages/ExecutionPage';
import LandingPage from './pages/LandingPage';

function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/landing" element={<LandingPage />} />
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="teams" element={<TeamsListPage />} />
          <Route path="teams/new" element={<CreateTeamPage />} />
          <Route path="teams/:id" element={<TeamDetailPage />} />
          <Route path="projects" element={<ProjectsListPage />} />
          <Route path="projects/new" element={<CreateProjectPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="projects/:id/runs/:runId" element={<ExecutionPage />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
