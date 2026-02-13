import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import TeamsListPage from './pages/TeamsListPage';
import CreateTeamPage from './pages/CreateTeamPage';
import TeamDetailPage from './pages/TeamDetailPage';
import ProjectsListPage from './pages/ProjectsListPage';
import CreateProjectPage from './pages/CreateProjectPage';

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/teams" replace />} />
        <Route path="teams" element={<TeamsListPage />} />
        <Route path="teams/new" element={<CreateTeamPage />} />
        <Route path="teams/:id" element={<TeamDetailPage />} />
        <Route path="projects" element={<ProjectsListPage />} />
        <Route path="projects/new" element={<CreateProjectPage />} />
        <Route path="projects/:id" element={<div>Project Detail Placeholder</div>} />
      </Route>
    </Routes>
  );
}

export default App;
