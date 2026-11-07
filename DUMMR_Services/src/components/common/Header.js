import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Header({ onNotice }) {
  const { currentUser, logout, isProvider } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    if (onNotice) {
      onNotice('Signed out successfully.');
    }
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="global-header">
      <div className="content-wrapper header-inner">
        <Link to="/" className="logo-area" style={{ textDecoration: 'none', color: 'inherit' }}>
          <svg className="brand-logo-svg" viewBox="0 0 26.9 16.6" width="28" height="18" fill="none">
            <ellipse cx="13.25" cy="8.4" rx="13.2" ry="2.9" transform="rotate(-25 13.25 8.4)" stroke="currentColor" strokeWidth="1.25"/>
            <circle cx="13.25" cy="8.4" r="8.8" fill="#000"/>
            <circle cx="13.25" cy="8.4" r="8.1" fill="currentColor"/>
            <ellipse cx="13.25" cy="8.4" rx="13.2" ry="2.9" transform="rotate(-25 13.25 8.4)" stroke="#000" strokeWidth="0.9" strokeDasharray="28.2 28.2"/>
            <ellipse cx="13.25" cy="8.4" rx="13.2" ry="2.9" transform="rotate(-25 13.25 8.4)" stroke="currentColor" strokeWidth="1.25" strokeDasharray="28.2 28.2"/>
          </svg>
          <span className="brand-logo">
            DUMMR<span>.</span>
          </span>
        </Link>

        <nav className="header-nav" aria-label="Main Navigation">
          <Link
            to="/"
            className={`nav-link ${isActive('/') ? 'active' : ''}`}
          >
            Home
          </Link>
          <Link
            to="/explore"
            className={`nav-link ${isActive('/explore') ? 'active' : ''}`}
          >
            Explore
          </Link>
          <Link
            to="/messages"
            className={`nav-link ${location.pathname.includes('messages') || location.search.includes('tab=Messages') ? 'active' : ''}`}
          >
            Messages
          </Link>
          <Link
            to="/orders"
            className={`nav-link ${location.pathname.includes('orders') || location.search.includes('tab=Orders') || location.search.includes('tab=Active%20Orders') ? 'active' : ''}`}
          >
            Orders
          </Link>

          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {!isProvider && (
                <Link
                  to="/seller/dashboard"
                  className="nav-link seller-cta-nav"
                >
                  Become a Seller
                </Link>
              )}
              {isProvider && (
                <Link
                  to="/seller/dashboard"
                  className="nav-link seller-cta-nav"
                  style={{ background: '#f1f5f9', color: '#1e293b' }}
                >
                  Seller Hub
                </Link>
              )}
              <button
                type="button"
                className="profile-avatar-btn"
                onClick={() => {
                  if (isProvider) {
                    navigate('/seller/dashboard');
                  } else {
                    navigate('/buyer/dashboard?tab=Profile');
                  }
                }}
                title={`Signed in as ${currentUser.name || currentUser.username} (${currentUser.role})`}
              >
                <span className="avatar-badge">{currentUser.avatar || 'ME'}</span>
                <span>{currentUser.name || currentUser.username}</span>
              </button>
              <button
                type="button"
                className="nav-link"
                style={{ fontSize: '0.82rem', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
                onClick={handleSignOut}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link
                to="/login"
                className={`nav-link ${isActive('/login') ? 'active' : ''}`}
              >
                Sign In
              </Link>
              <Link
                to="/signup?role=provider"
                className="nav-link seller-cta-nav"
              >
                Become a Seller
              </Link>
              <Link
                to="/signup"
                className="nav-link seller-cta-nav"
                style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                  color: '#fff',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Join DUMMR
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
