import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth, homeFor } from './lib/auth';
import AppLayout from './components/AppLayout';

import Landing from './pages/public/Landing';
import Login from './pages/public/Login';
import Register from './pages/public/Register';

import EmployeeDashboard from './pages/employee/Dashboard';
import Profile from './pages/employee/Profile';
import Passport from './pages/employee/Passport';
import Assessments from './pages/employee/Assessments';
import TakeAssessment from './pages/employee/TakeAssessment';
import AssessmentResult from './pages/employee/AssessmentResult';
import GapAnalysis from './pages/employee/GapAnalysis';
import LearningPlan from './pages/employee/LearningPlan';
import Opportunities from './pages/employee/Opportunities';
import Badges from './pages/employee/Badges';

import ManagerDashboard from './pages/manager/Dashboard';
import TeamDirectory from './pages/manager/TeamDirectory';
import EmployeeReview from './pages/manager/EmployeeReview';
import ProjectList from './pages/manager/ProjectList';
import ProjectForm from './pages/manager/ProjectForm';
import ProjectDetails from './pages/manager/ProjectDetails';
import Matching from './pages/manager/Matching';
import Approvals from './pages/manager/Approvals';

import HrDashboard from './pages/hr/Dashboard';
import EmployeeManagement from './pages/hr/EmployeeManagement';
import ProjectOversight from './pages/hr/ProjectOversight';
import MarketIntel from './pages/hr/MarketIntel';
import WorkforceAnalytics from './pages/hr/WorkforceAnalytics';
import HiringInsights from './pages/hr/HiringInsights';
import UserRoles from './pages/hr/UserRoles';
import AuditSettings from './pages/hr/AuditSettings';

function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  // UI guard only — the backend enforces RBAC on every request.
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Every account has a Skill Passport, so managers/HR can open the employee portal too */}
      <Route path="/employee" element={<Protected roles={['EMPLOYEE', 'MANAGER', 'HR']}><AppLayout role="EMPLOYEE" /></Protected>}>
        <Route index element={<EmployeeDashboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="passport" element={<Passport />} />
        <Route path="assessments" element={<Assessments />} />
        <Route path="assessments/:id/take" element={<TakeAssessment />} />
        <Route path="results/:id" element={<AssessmentResult />} />
        <Route path="gap" element={<GapAnalysis />} />
        <Route path="learning" element={<LearningPlan />} />
        <Route path="opportunities" element={<Opportunities />} />
        <Route path="badges" element={<Badges />} />
      </Route>

      <Route path="/manager" element={<Protected roles={['MANAGER', 'HR']}><AppLayout role="MANAGER" /></Protected>}>
        <Route index element={<ManagerDashboard />} />
        <Route path="team" element={<TeamDirectory />} />
        <Route path="team/:id" element={<EmployeeReview />} />
        <Route path="projects" element={<ProjectList />} />
        <Route path="projects/new" element={<ProjectForm />} />
        <Route path="projects/:id" element={<ProjectDetails />} />
        <Route path="projects/:id/edit" element={<ProjectForm />} />
        <Route path="projects/:id/matching" element={<Matching />} />
        <Route path="approvals" element={<Approvals />} />
      </Route>

      <Route path="/hr" element={<Protected roles={['HR']}><AppLayout role="HR" /></Protected>}>
        <Route index element={<HrDashboard />} />
        <Route path="employees" element={<EmployeeManagement />} />
        <Route path="employees/:id" element={<EmployeeReview />} />
        <Route path="projects" element={<ProjectOversight />} />
        <Route path="projects/new" element={<ProjectForm />} />
        <Route path="projects/:id" element={<ProjectDetails />} />
        <Route path="projects/:id/edit" element={<ProjectForm />} />
        <Route path="projects/:id/matching" element={<Matching />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="market" element={<MarketIntel />} />
        <Route path="analytics" element={<WorkforceAnalytics />} />
        <Route path="hiring" element={<HiringInsights />} />
        <Route path="users" element={<UserRoles />} />
        <Route path="audit" element={<AuditSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
