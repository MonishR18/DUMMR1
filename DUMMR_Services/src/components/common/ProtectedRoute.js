import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { currentUser, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ padding: '80px', textAlign: 'center', color: '#64748b', fontSize: '1.1rem' }}>
        Loading session...
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const userRole = (currentUser.role || '').toLowerCase();
  if (allowedRoles) {
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
    if (!normalizedAllowed.includes(userRole) && userRole !== 'admin') {
      const fallbackPath = userRole === 'provider' ? '/seller/dashboard' : '/buyer/dashboard';
      return <Navigate to={fallbackPath} replace />;
    }
  }

  return children;
}
