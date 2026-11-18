import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '../../api';
import dummrLogo from '../../assets/dummrlogo.png';

export default function Header({ onNotice }) {
  const { currentUser, logout, isProvider } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';

  const loadNotifs = async () => {
    if (!currentUser) return;
    try {
      const data = await fetchNotifications();
      if (Array.isArray(data)) {
        setNotifications(data);
      }
    } catch (e) {
      // Non-fatal
    }
  };

  useEffect(() => {
    loadNotifs();
    const interval = setInterval(loadNotifs, 30000); // 30s polling
    return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await logout();
    if (onNotice) {
      onNotice('Signed out successfully.');
    }
    navigate('/');
  };

  const handleMarkOneRead = async (notif) => {
    try {
      if (!notif.is_read) {
        await markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
      }
    } catch (err) {
      // Non-fatal
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      if (onNotice) onNotice('All notifications marked as read.');
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Failed to mark all as read.');
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const isActive = (path) => location.pathname === path;

  return (
    <header className="global-header">
      <div className="content-wrapper header-inner">
        <Link to="/" className="logo-area" style={{ textDecoration: 'none', color: 'inherit' }}>
          <img src={dummrLogo} alt="DUMMR Services" className="brand-logo-img" />
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

          {isAdmin && (
            <Link
              to="/admin"
              className={`nav-link ${location.pathname.startsWith('/admin') ? 'active' : ''}`}
              style={{ color: '#ef4444', fontWeight: 700 }}
            >
              🛡️ Admin
            </Link>
          )}

          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Notification Bell */}
              <div style={{ position: 'relative' }} ref={dropdownRef}>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1.25rem',
                    position: 'relative',
                    padding: '6px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                  title="Notifications"
                >
                  🔔
                  {unreadCount > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '2px',
                        right: '2px',
                        background: '#ef4444',
                        color: '#fff',
                        borderRadius: '50%',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        width: '18px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '40px',
                      width: '320px',
                      background: '#fff',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)',
                      border: '1px solid #e2e8f0',
                      zIndex: 1000,
                      maxHeight: '400px',
                      overflowY: 'auto',
                    }}
                  >
                    <div
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #f1f5f9',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <strong style={{ fontSize: '0.9rem' }}>Notifications</strong>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#6366f1',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                          onClick={handleMarkAllRead}
                        >
                          Mark all read
                        </button>
                      )}
                    </div>

                    <div style={{ padding: '4px 0' }}>
                      {notifications.slice(0, 15).map((n) => (
                        <div
                          key={n.id}
                          style={{
                            padding: '10px 16px',
                            borderBottom: '1px solid #f8fafc',
                            background: n.is_read ? '#fff' : '#f0fdf4',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleMarkOneRead(n)}
                        >
                          <div style={{ fontSize: '0.82rem', fontWeight: n.is_read ? 500 : 700, color: '#1e293b' }}>
                            {n.title}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                            {n.message}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: '4px' }}>
                            {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                        </div>
                      ))}

                      {notifications.length === 0 && (
                        <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                          No notifications
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {!isProvider && !isAdmin && (
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
                  if (isAdmin) {
                    navigate('/admin');
                  } else if (isProvider) {
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
