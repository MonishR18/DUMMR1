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

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    // If provider tries to access buyer routes, or vice versa
    const fallbackPath = currentUser.role === 'provider' ? '/seller/dashboard' : '/buyer/dashboard';
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
}
