import React, { useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Header from './components/common/Header';
import Footer from './components/common/Footer';
import NotificationToast from './components/common/NotificationToast';
import { OrdersRedirect, MessagesRedirect } from './components/common/RoleRedirects';

// Pages
import HomePage from './pages/HomePage';
import ExplorePage from './pages/ExplorePage';
import ServiceDetailPage from './pages/ServiceDetailPage';
import AuthPage from './AuthPage';
import SellerDashboardPage from './pages/SellerDashboardPage';
import BuyerDashboardPage from './pages/BuyerDashboardPage';
import CreateServicePage from './pages/CreateServicePage';

export default function App() {
  const [notification, setNotification] = useState('');

  const triggerNotice = useCallback((msg) => {
    setNotification(msg);
    const timer = setTimeout(() => {
      setNotification('');
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AuthProvider>
      <Router>
        <div className="app-container">
          <NotificationToast message={notification} />
          <Header onNotice={triggerNotice} />

          <main className="content-wrapper" style={{ flex: 1 }}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/explore" element={<ExplorePage onNotice={triggerNotice} />} />
              <Route path="/services/:id" element={<ServiceDetailPage onNotice={triggerNotice} />} />
              <Route
                path="/login"
                element={<AuthPage initialMode="signin" onAuthSuccess={(_, mode) => triggerNotice(mode === 'signup' ? 'Account created successfully!' : 'Welcome back!')} />}
              />
              <Route
                path="/signup"
                element={<AuthPage initialMode="signup" onAuthSuccess={(_, mode) => triggerNotice(mode === 'signup' ? 'Welcome to DUMMR! Your account is ready.' : 'Welcome back!')} />}
              />

              {/* Dynamic Redirects */}
              <Route path="/orders" element={<OrdersRedirect />} />
              <Route path="/messages" element={<MessagesRedirect />} />

              {/* Protected Provider Routes */}
              <Route
                path="/seller/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['provider']}>
                    <SellerDashboardPage onNotice={triggerNotice} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/seller/services/new"
                element={
                  <ProtectedRoute allowedRoles={['provider']}>
                    <CreateServicePage onNotice={triggerNotice} />
                  </ProtectedRoute>
                }
              />

              {/* Protected Buyer Routes (clients and providers can browse their buyer hub) */}
              <Route
                path="/buyer/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['client', 'provider']}>
                    <BuyerDashboardPage onNotice={triggerNotice} />
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <Footer />
        </div>
      </Router>
    </AuthProvider>
  );
}
