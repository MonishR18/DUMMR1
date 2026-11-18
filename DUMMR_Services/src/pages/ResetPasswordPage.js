import React, { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { resetPassword } from '../api';

export default function ResetPasswordPage({ onNotice }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Missing reset token. Please request a new password reset link.');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword({ token, new_password: newPassword });
      setIsSuccess(true);
      if (onNotice) {
        onNotice('Password has been reset successfully! You can now log in.');
      }
    } catch (err) {
      setError(err.message || 'Failed to reset password. The link may be expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div style={{ maxWidth: '480px', margin: '80px auto', padding: '0 20px' }}>
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '40px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔒</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>
            Invalid Password Reset Link
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '24px' }}>
            No reset token found in URL. Please request a new password reset link from the login page.
          </p>
          <Link to="/login" className="btn-primary" style={{ textDecoration: 'none' }}>
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div style={{ maxWidth: '480px', margin: '80px auto', padding: '0 20px' }}>
        <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '40px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>✅</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px', color: '#16a34a' }}>
            Password Reset Complete
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '24px' }}>
            Your account password has been successfully updated. You may now log in with your new credentials.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate('/login')}
          >
            Sign In Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '480px', margin: '80px auto', padding: '0 20px' }}>
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04)',
          border: '1px solid #e2e8f0',
          padding: '40px 32px',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px', textAlign: 'center' }}>
          Set New Password
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '24px', textAlign: 'center' }}>
          Enter a new secure password for your DUMMR account.
        </p>

        {error && (
          <div
            style={{
              background: '#fee2e2',
              color: '#991b1b',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '0.88rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              New Password
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
              Confirm New Password
            </label>
            <input
              type="password"
              className="form-input"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '1rem' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Resetting Password...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
}

