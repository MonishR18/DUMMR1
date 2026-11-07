import React from 'react';

export default function NotificationToast({ message }) {
  if (!message) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        backgroundColor: '#222325',
        color: '#fff',
        padding: '12px 20px',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 9999,
        fontWeight: 600,
        fontSize: '0.9rem',
        animation: 'fadeIn 0.2s ease-in-out',
      }}
    >
      {message}
    </div>
  );
}
