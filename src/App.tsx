import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';

const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const CheckIn = lazy(() => import('./pages/CheckIn').then(module => ({ default: module.CheckIn })));
const Missions = lazy(() => import('./pages/Missions').then(module => ({ default: module.Missions })));
const Habits = lazy(() => import('./pages/Habits').then(module => ({ default: module.Habits })));
const Analytics = lazy(() => import('./pages/Analytics').then(module => ({ default: module.Analytics })));
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const Calendar = lazy(() => import('./pages/Calendar').then(module => ({ default: module.Calendar })));
const Money = lazy(() => import('./pages/Money').then(module => ({ default: module.Money })));
const Health = lazy(() => import('./pages/Health').then(module => ({ default: module.Health })));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-bg-dark flex items-center justify-center"><div className="w-8 h-8 border-4 border-neon-green border-t-transparent rounded-full animate-spin"></div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<div className="min-h-screen bg-bg-dark flex items-center justify-center"><div className="w-8 h-8 border-4 border-neon-green border-t-transparent rounded-full animate-spin" /></div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="check-in" element={<CheckIn />} />
              <Route path="missions" element={<Missions />} />
              <Route path="habits" element={<Habits />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="settings" element={<Settings />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="money" element={<Money />} />
              <Route path="health" element={<Health />} />
            </Route>
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}
