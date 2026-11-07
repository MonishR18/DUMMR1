import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function OrdersRedirect() {
  const { currentUser, isLoading, isProvider } = useAuth();

  if (isLoading) {
    return <div style={{ padding: '80px', textAlign: 'center' }}>Loading...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return isProvider ? (
    <Navigate to="/seller/dashboard?tab=Orders" replace />
  ) : (
    <Navigate to="/buyer/dashboard?tab=Active%20Orders" replace />
  );
}

export function MessagesRedirect() {
  const { currentUser, isLoading, isProvider } = useAuth();

  if (isLoading) {
    return <div style={{ padding: '80px', textAlign: 'center' }}>Loading...</div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  return isProvider ? (
    <Navigate to="/seller/dashboard?tab=Messages" replace />
  ) : (
    <Navigate to="/buyer/dashboard?tab=Messages" replace />
  );
}
