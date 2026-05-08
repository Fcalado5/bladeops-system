import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AlertProvider } from './context/AlertContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/Login/LoginPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import DayOperationsPage from './pages/DayOperations/DayOperationsPage';
import DayOperationDetailPage from './pages/DayOperations/DayOperationDetailPage';
import FlightsPage from './pages/Flights/FlightsPage';
import PilotsPage from './pages/Pilots/PilotsPage';
import AircraftPage from './pages/Aircraft/AircraftPage';
import DestinationsPage from './pages/Destinations/DestinationsPage';
import AlertsPage from './pages/Alerts/AlertsPage';
import ReportsPage from './pages/Reports/ReportsPage';

function ProtectedRoute({ children, roles }) {
  const { user, token } = useAuth();
  if (!token || !user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { token } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="day-operations" element={<DayOperationsPage />} />
        <Route path="day-operations/:id" element={<DayOperationDetailPage />} />
        <Route path="flights" element={<FlightsPage />} />
        <Route path="pilots" element={<PilotsPage />} />
        <Route path="aircraft" element={<ProtectedRoute roles={['admin']}><AircraftPage /></ProtectedRoute>} />
        <Route path="destinations" element={<DestinationsPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="reports" element={<ProtectedRoute roles={['admin']}><ReportsPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AlertProvider>
          <AppRoutes />
        </AlertProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
