import React, { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { verifyEmail } from '../api';
import { useAuth } from '../context/AuthContext';

export default function VerifyEmailPage({ onNotice }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { refreshUser, currentUser } = useAuth();

  const [status, setStatus] = useState(token ? 'verifying' : 'no_token');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    if (!token) return;

    const performVerification = async () => {
      try {
        const res = await verifyEmail(token);
        if (isMounted) {
          setStatus('success');
          setMessage(res?.message || 'Email verified successfully!');
          if (onNotice) onNotice('Email verified successfully!');
          if (refreshUser) refreshUser();
        }
      } catch (err) {
        if (isMounted) {
          setStatus('error');
          setMessage(err.message || 'Verification failed. The link may be expired or invalid.');
        }
      }
    };

    performVerification();
    return () => {
      isMounted = false;
    };
  }, [token, onNotice, refreshUser]);

  return (
    <div style={{ maxWidth: '520px', margin: '80px auto', padding: '0 20px' }}>
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04)',
          border: '1px solid #e2e8f0',
          padding: '40px 32px',
          textAlign: 'center',
        }}
      >
        {status === 'verifying' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⏳</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>
              Verifying Your Email
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.95rem' }}>
              Please wait while we confirm your account credentials...
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎉</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px', color: '#16a34a' }}>
              Account Verified!
            </h1>
            <p style={{ color: '#475569', fontSize: '0.95rem', marginBottom: '24px' }}>
              {message || 'Your email has been verified. You can now publish services, place orders, and access all platform features.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              {currentUser ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => navigate(currentUser.role === 'provider' ? '/seller/dashboard' : '/buyer/dashboard')}
                >
                  Go to Dashboard
                </button>
              ) : (
                <Link to="/login" className="btn-primary" style={{ textDecoration: 'none' }}>
                  Sign In to Continue
                </Link>
              )}
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px', color: '#dc2626' }}>
              Verification Failed
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '24px' }}>
              {message}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Link to="/login" className="btn-primary" style={{ textDecoration: 'none' }}>
                Go to Sign In
              </Link>
              <Link to="/" className="btn-secondary" style={{ textDecoration: 'none' }}>
                Home
              </Link>
            </div>
          </>
        )}

        {status === 'no_token' && (
          <>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>❓</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px', color: '#1e293b' }}>
              Invalid Verification Link
            </h1>
            <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '24px' }}>
              No verification token was found in the link. Please check your confirmation email and click the link again.
            </p>
            <Link to="/" className="btn-primary" style={{ textDecoration: 'none' }}>
              Return Home
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

