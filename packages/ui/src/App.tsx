import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import TeamsListPage from './pages/TeamsListPage';
import CreateTeamPage from './pages/CreateTeamPage';

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/teams" replace />} />
        <Route path="teams" element={<TeamsListPage />} />
        <Route path="teams/new" element={<CreateTeamPage />} />
        <Route path="teams/:id" element={<div>Team Detail (coming soon)</div>} />
      </Route>
    </Routes>
  );
}

export default App;
