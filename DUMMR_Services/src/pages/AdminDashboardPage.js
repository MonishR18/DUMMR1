import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchAdminDashboard,
  fetchAdminUsers,
  fetchAdminServices,
  fetchAdminOrders,
  fetchAdminReports,
  deactivateUserAdmin,
  reactivateUserAdmin,
  unpublishServiceAdmin,
  deleteServiceAdmin,
  resolveReportAdmin,
} from '../api';

export default function AdminDashboardPage({ onNotice }) {
  const [activeTab, setActiveTab] = useState('Overview');

  // Stats
  const [stats, setStats] = useState({ users: 0, services: 0, orders: 0, revenue: 0 });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  // Tab Data
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reports, setReports] = useState([]);
  const [reportFilter, setReportFilter] = useState('');
  const [isLoadingTab, setIsLoadingTab] = useState(false);

  // Load Overview Stats
  const loadStats = useCallback(async () => {
    setIsLoadingStats(true);
    try {
      const data = await fetchAdminDashboard();
      if (data) {
        setStats(data);
      }
    } catch (err) {
      // Keep defaults
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Load active tab data
  const loadTabData = useCallback(async () => {
    setIsLoadingTab(true);
    try {
      if (activeTab === 'Users') {
        const data = await fetchAdminUsers(0, 50);
        setUsers(Array.isArray(data) ? data : []);
      } else if (activeTab === 'Services') {
        const data = await fetchAdminServices(0, 50);
        setServices(Array.isArray(data) ? data : []);
      } else if (activeTab === 'Orders') {
        const data = await fetchAdminOrders(0, 50);
        setOrders(Array.isArray(data) ? data : []);
      } else if (activeTab === 'Reports') {
        const data = await fetchAdminReports(reportFilter, 0, 50);
        setReports(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Failed to fetch admin data.');
    } finally {
      setIsLoadingTab(false);
    }
  }, [activeTab, reportFilter, onNotice]);

  useEffect(() => {
    if (activeTab !== 'Overview') {
      loadTabData();
    }
  }, [activeTab, loadTabData]);

  // User Actions
  const handleToggleUserActive = async (user) => {
    try {
      if (user.is_active) {
        await deactivateUserAdmin(user.id);
        if (onNotice) onNotice(`User @${user.username} deactivated.`);
      } else {
        await reactivateUserAdmin(user.id);
        if (onNotice) onNotice(`User @${user.username} reactivated.`);
      }
      loadTabData();
      loadStats();
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Action failed.');
    }
  };

  // Service Actions
  const handleUnpublishService = async (serviceId) => {
    try {
      await unpublishServiceAdmin(serviceId);
      if (onNotice) onNotice(`Service #${serviceId} unpublished.`);
      loadTabData();
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Action failed.');
    }
  };

  const handleDeleteService = async (serviceId) => {
    if (!window.confirm(`Are you sure you want to permanently delete service #${serviceId}?`)) return;
    try {
      await deleteServiceAdmin(serviceId);
      if (onNotice) onNotice(`Service #${serviceId} deleted.`);
      loadTabData();
      loadStats();
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Action failed.');
    }
  };

  // Report Actions
  const handleResolveReport = async (reportId, status) => {
    try {
      await resolveReportAdmin(reportId, status);
      if (onNotice) onNotice(`Report #${reportId} marked as ${status}.`);
      loadTabData();
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Action failed.');
    }
  };

  const navItems = ['Overview', 'Users', 'Services', 'Orders', 'Reports'];

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <div className="sidebar-title" style={{ color: '#ef4444' }}>
          🛡️ Admin Control
        </div>
        <ul className="sidebar-nav-list">
          {navItems.map((item) => (
            <li key={item}>
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === item ? 'active' : ''}`}
                onClick={() => setActiveTab(item)}
              >
                {item}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="dashboard-main">
        <div className="dash-header-row">
          <h1 className="page-title">Admin Management — {activeTab}</h1>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              loadStats();
              if (activeTab !== 'Overview') loadTabData();
            }}
          >
            🔄 Refresh
          </button>
        </div>

        {/* ── TAB: OVERVIEW ────────────────────────────────────────── */}
        {activeTab === 'Overview' && (
          <>
            <div className="stats-cards-grid">
              <div className="stat-card">
                <div className="stat-label">Total Users</div>
                <div className="stat-value">{isLoadingStats ? '...' : stats.users}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Services</div>
                <div className="stat-value">{isLoadingStats ? '...' : stats.services}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Orders</div>
                <div className="stat-value">{isLoadingStats ? '...' : stats.orders}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Platform Revenue</div>
                <div className="stat-value" style={{ color: '#16a34a' }}>
                  ${isLoadingStats ? '...' : stats.revenue?.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="content-block">
              <h2 className="block-title">Administrative Overview</h2>
              <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: '1.6' }}>
                Welcome to the DUMMR Administration Portal. From here you can manage registered users,
                moderate service storefronts, oversee order transactions, and review moderation flags.
              </p>
            </div>
          </>
        )}

        {/* ── TAB: USERS ──────────────────────────────────────────── */}
        {activeTab === 'Users' && (
          <div className="table-container">
            <div className="table-header">Registered Users ({users.length})</div>
            {isLoadingTab ? (
              <div style={{ padding: '30px', textAlign: 'center' }}>Loading users...</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Verified</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>#{u.id}</td>
                      <td>
                        <strong>{u.name || u.username}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>@{u.username}</div>
                      </td>
                      <td>{u.email}</td>
                      <td>
                        <span className="badge" style={{ background: '#f1f5f9', color: '#334155' }}>
                          {u.role}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${u.is_active ? 'badge-toprated' : ''}`}
                          style={!u.is_active ? { background: '#fee2e2', color: '#991b1b' } : {}}
                        >
                          {u.is_active ? 'ACTIVE' : 'DEACTIVATED'}
                        </span>
                      </td>
                      <td>{u.is_verified ? '✅ Yes' : '❌ No'}</td>
                      <td>
                        <button
                          type="button"
                          className={u.is_active ? 'btn-secondary' : 'btn-primary'}
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                          onClick={() => handleToggleUserActive(u)}
                        >
                          {u.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                        No users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── TAB: SERVICES ───────────────────────────────────────── */}
        {activeTab === 'Services' && (
          <div className="table-container">
            <div className="table-header">Service Storefronts ({services.length})</div>
            {isLoadingTab ? (
              <div style={{ padding: '30px', textAlign: 'center' }}>Loading services...</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Seller ID</th>
                    <th>Status</th>
                    <th>Rating</th>
                    <th>Orders</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((srv) => (
                    <tr key={srv.id}>
                      <td style={{ fontWeight: 600 }}>#{srv.id}</td>
                      <td>
                        <strong>{srv.title}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>slug: {srv.slug}</div>
                      </td>
                      <td>#{srv.seller_id}</td>
                      <td>
                        <span
                          className={`badge ${srv.status === 'PUBLISHED' ? 'badge-toprated' : ''}`}
                          style={srv.status === 'DRAFT' ? { background: '#fef3c7', color: '#92400e' } : {}}
                        >
                          {srv.status}
                        </span>
                      </td>
                      <td>★ {srv.rating || 0}</td>
                      <td>{srv.order_count || 0}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {srv.status !== 'DRAFT' && (
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                              onClick={() => handleUnpublishService(srv.id)}
                            >
                              Unpublish
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ fontSize: '0.75rem', padding: '4px 8px', color: '#dc2626', borderColor: '#fca5a5' }}
                            onClick={() => handleDeleteService(srv.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {services.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                        No services found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── TAB: ORDERS ─────────────────────────────────────────── */}
        {activeTab === 'Orders' && (
          <div className="table-container">
            <div className="table-header">All Platform Orders ({orders.length})</div>
            {isLoadingTab ? (
              <div style={{ padding: '30px', textAlign: 'center' }}>Loading orders...</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Buyer</th>
                    <th>Seller</th>
                    <th>Service</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((ord) => (
                    <tr key={ord.id}>
                      <td style={{ fontWeight: 600 }}>#{ord.id}</td>
                      <td>#{ord.buyer_id}</td>
                      <td>#{ord.seller_id}</td>
                      <td>#{ord.service_id}</td>
                      <td style={{ fontWeight: 700 }}>${ord.amount}</td>
                      <td>
                        <span className={`badge-status badge-${ord.status?.toLowerCase().replace('_', '-')}`}>
                          {ord.status?.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                        No orders recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── TAB: REPORTS & MODERATION ──────────────────────────── */}
        {activeTab === 'Reports' && (
          <div className="table-container">
            <div className="dash-header-row" style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>Moderation Reports ({reports.length})</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Filter:</span>
                <select
                  className="form-input"
                  style={{ padding: '4px 8px', width: 'auto', fontSize: '0.85rem' }}
                  value={reportFilter}
                  onChange={(e) => setReportFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">PENDING</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="DISMISSED">DISMISSED</option>
                </select>
              </div>
            </div>

            {isLoadingTab ? (
              <div style={{ padding: '30px', textAlign: 'center' }}>Loading reports...</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Report ID</th>
                    <th>Reporter ID</th>
                    <th>Target Type</th>
                    <th>Target ID</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>#{r.id}</td>
                      <td>#{r.reporter_id}</td>
                      <td>
                        <span className="badge" style={{ background: '#e0e7ff', color: '#3730a3' }}>
                          {r.target_type}
                        </span>
                      </td>
                      <td>#{r.target_id}</td>
                      <td style={{ maxWidth: '240px' }}>{r.reason}</td>
                      <td>
                        <span
                          className={`badge ${r.status === 'RESOLVED' ? 'badge-toprated' : ''}`}
                          style={r.status === 'PENDING' ? { background: '#fef3c7', color: '#92400e' } : {}}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td>
                        {r.status === 'PENDING' ? (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ fontSize: '0.75rem', padding: '4px 8px', background: '#16a34a' }}
                              onClick={() => handleResolveReport(r.id, 'RESOLVED')}
                            >
                              Resolve
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                              onClick={() => handleResolveReport(r.id, 'DISMISSED')}
                            >
                              Dismiss
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Processed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {reports.length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                        No reports matching this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

