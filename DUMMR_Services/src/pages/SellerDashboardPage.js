import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  fetchSellerDashboard,
  fetchSellerServices,
  acceptOrder,
  startOrder,
  deliverOrder,
  publishService,
  pauseService,
  fetchConversations,
  fetchMessages,
  sendMessage,
} from '../api';
import { useAuth } from '../context/AuthContext';

export default function SellerDashboardPage({ onNotice }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();

  const activeTab = searchParams.get('tab') || 'Dashboard';
  const setActiveTab = (tab) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    setSearchParams(newParams);
  };

  // Dashboard Data State
  const [dashboardData, setDashboardData] = useState({
    revenue: 2450,
    orders_count: 38,
    active_orders: 3,
    rating: 4.9,
    views: '12.4K',
    recent_orders: [],
  });
  const [myServices, setMyServices] = useState([]);

  // Deliver Modal State
  const [deliverModalOrder, setDeliverModalOrder] = useState(null);
  const [deliveryMessage, setDeliveryMessage] = useState('');
  const [isDelivering, setIsDelivering] = useState(false);

  // Messaging State
  const [conversations, setConversations] = useState([]);
  const [activeThreadIndex, setActiveThreadIndex] = useState(0);
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);

  // Load Dashboard & Services
  const loadData = useCallback(async () => {
    try {
      const [dashRes, servicesRes] = await Promise.allSettled([
        fetchSellerDashboard(),
        fetchSellerServices(),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value) {
        setDashboardData((prev) => ({
          ...prev,
          revenue: dashRes.value.revenue ?? prev.revenue,
          orders_count: dashRes.value.orders_count ?? prev.orders_count,
          active_orders: dashRes.value.active_orders ?? prev.active_orders,
          rating: dashRes.value.rating ?? prev.rating,
          views: dashRes.value.views ?? prev.views,
          recent_orders: Array.isArray(dashRes.value.recent_orders)
            ? dashRes.value.recent_orders
            : [],
        }));
      }

      if (servicesRes.status === 'fulfilled' && Array.isArray(servicesRes.value)) {
        setMyServices(servicesRes.value);
      }
    } catch (err) {
      // Fallback data remains
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load Conversations when Messages tab is active
  useEffect(() => {
    let isMounted = true;
    if (activeTab === 'Messages') {
      const loadChats = async () => {
        try {
          const convList = await fetchConversations();
          if (isMounted && Array.isArray(convList) && convList.length > 0) {
            setConversations(convList);
            const activeConv = convList[activeThreadIndex] || convList[0];
            if (activeConv?.id) {
              const msgList = await fetchMessages(activeConv.id);
              if (isMounted && Array.isArray(msgList)) {
                setMessages(msgList);
              }
            }
          } else if (isMounted) {
            // Demo conversations if none in backend yet
            setConversations([
              {
                id: 1,
                name: 'Rahul Sharma',
                initials: 'RS',
                service: 'Professional Website Design',
                preview: 'Can we schedule a call to review the landing page header?',
                time: '10m ago',
                unread: 1,
              },
              {
                id: 2,
                name: 'Arjun Patel',
                initials: 'AP',
                service: 'Cinematic 4K Video Editing',
                preview: 'The color grading on the first draft looks awesome!',
                time: '2h ago',
                unread: 0,
              },
            ]);
            setMessages([
              { from: 'them', text: 'Hi! Looking forward to working together on the design.', ts: '10:00 AM' },
              { from: 'me', text: 'Welcome! I have received your wireframes and started layout.', ts: '10:05 AM' },
              { from: 'them', text: 'Can we schedule a call to review the landing page header?', ts: '10:30 AM' },
            ]);
          }
        } catch (err) {
          // Demo fallback
        }
      };
      loadChats();
    }
    return () => {
      isMounted = false;
    };
  }, [activeTab, activeThreadIndex]);

  // Status Actions
  const handleAcceptOrder = async (orderId) => {
    try {
      await acceptOrder(orderId);
      if (onNotice) onNotice(`Order #${orderId} accepted!`);
      loadData();
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Failed to accept order.');
    }
  };

  const handleStartOrder = async (orderId) => {
    try {
      await startOrder(orderId);
      if (onNotice) onNotice(`Order #${orderId} marked as in progress!`);
      loadData();
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Failed to start order.');
    }
  };

  const handleConfirmDeliver = async (e) => {
    e.preventDefault();
    if (!deliverModalOrder) return;
    setIsDelivering(true);
    try {
      await deliverOrder(deliverModalOrder.id, {
        message: deliveryMessage,
        files: [],
      });
      if (onNotice) onNotice(`Order #${deliverModalOrder.id} successfully delivered!`);
      setDeliverModalOrder(null);
      setDeliveryMessage('');
      loadData();
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Failed to deliver order.');
    } finally {
      setIsDelivering(false);
    }
  };

  const handleToggleServiceStatus = async (service) => {
    try {
      if (service.status === 'published') {
        await pauseService(service.id);
        if (onNotice) onNotice(`Service "${service.title}" paused.`);
      } else {
        await publishService(service.id);
        if (onNotice) onNotice(`Service "${service.title}" published!`);
      }
      loadData();
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Failed to change service status.');
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!msgInput.trim()) return;
    const text = msgInput.trim();
    setMsgInput('');
    setIsSendingMsg(true);

    const activeConv = conversations[activeThreadIndex];
    if (activeConv?.id && typeof activeConv.id === 'number') {
      try {
        await sendMessage(activeConv.id, text);
        const updated = await fetchMessages(activeConv.id);
        setMessages(updated);
      } catch (err) {
        // Optimistic append
        setMessages((prev) => [...prev, { from: 'me', text, ts: 'Just now' }]);
      }
    } else {
      setMessages((prev) => [...prev, { from: 'me', text, ts: 'Just now' }]);
    }
    setIsSendingMsg(false);
  };

  const renderActiveOrders = () => {
    const orders = dashboardData.recent_orders.length > 0
      ? dashboardData.recent_orders
      : [
          { id: 101, buyer_name: 'Rahul', service_title: 'Website Design', price: 120, status: 'in_progress' },
          { id: 102, buyer_name: 'Arjun', service_title: 'Video Editing', price: 80, status: 'delivered' },
          { id: 103, buyer_name: 'Priya', service_title: 'Logo Design', price: 40, status: 'pending' },
        ];

    return (
      <div className="table-container">
        <div className="table-header">Active Orders</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Buyer</th>
              <th>Service</th>
              <th>Price</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((ord) => {
              const status = ord.status || 'pending';
              return (
                <tr key={ord.id}>
                  <td style={{ fontWeight: 600 }}>#{ord.id}</td>
                  <td>{ord.buyer?.name || ord.buyer_name || 'Client'}</td>
                  <td>{ord.service?.title || ord.service_title || 'Marketplace Service'}</td>
                  <td style={{ fontWeight: 700 }}>${ord.price || 50}</td>
                  <td>
                    <span className={`badge-status badge-${status.replace('_', '-')}`}>
                      {status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {status === 'pending' && (
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                          onClick={() => handleAcceptOrder(ord.id)}
                        >
                          Accept
                        </button>
                      )}
                      {status === 'accepted' && (
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#0284c7' }}
                          onClick={() => handleStartOrder(ord.id)}
                        >
                          Start Work
                        </button>
                      )}
                      {status === 'in_progress' && (
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ padding: '4px 10px', fontSize: '0.75rem', background: '#16a34a' }}
                          onClick={() => {
                            setDeliverModalOrder(ord);
                            setDeliveryMessage('');
                          }}
                        >
                          Deliver Work
                        </button>
                      )}
                      {status === 'delivered' && (
                        <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                          Awaiting Review
                        </span>
                      )}
                      {status === 'completed' && (
                        <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 600 }}>
                          Completed
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const navItems = [
    'Dashboard',
    'My Services',
    'Orders',
    'Messages',
    'Analytics',
    'Earnings',
    'Profile',
  ];

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <div className="sidebar-title">Seller Hub</div>
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
          <h1 className="page-title">
            {activeTab === 'Messages' ? 'Seller Inbox' : `Seller ${activeTab}`}
          </h1>
          <Link
            to="/seller/services/new"
            className="btn-primary"
            style={{ textDecoration: 'none' }}
          >
            + Create New Service
          </Link>
        </div>

        {/* ── TAB: DASHBOARD ───────────────────────────────────────── */}
        {activeTab === 'Dashboard' && (
          <>
            <div className="stats-cards-grid">
              <div className="stat-card">
                <div className="stat-label">Total Revenue</div>
                <div className="stat-value" style={{ color: 'var(--primary)' }}>
                  ${dashboardData.revenue}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Orders</div>
                <div className="stat-value">{dashboardData.orders_count}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Storefront Views</div>
                <div className="stat-value">{dashboardData.views}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Client Rating</div>
                <div className="stat-value">★ {dashboardData.rating}</div>
              </div>
            </div>

            {renderActiveOrders()}

            <div className="content-block">
              <div className="dash-header-row" style={{ marginBottom: '16px' }}>
                <h2 className="block-title" style={{ margin: 0 }}>My Active Services</h2>
                <Link
                  to="/seller/services/new"
                  className="btn-outline-primary"
                  style={{ textDecoration: 'none' }}
                >
                  + Create New Service
                </Link>
              </div>

              <div className="services-grid" style={{ marginBottom: 0 }}>
                {myServices.length > 0 ? (
                  myServices.map((srv) => (
                    <div key={srv.id} className="service-card">
                      <div className="service-card-body">
                        <h3 className="service-card-title">{srv.title}</h3>
                        <div className="service-card-footer">
                          <span className={`badge ${srv.status === 'published' ? 'badge-toprated' : ''}`}>
                            {srv.status ? srv.status.toUpperCase() : 'ACTIVE'}
                          </span>
                          <span className="price-amount">${srv.packages?.[0]?.price || srv.price || 50}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="service-card">
                      <div className="service-card-body">
                        <h3 className="service-card-title">Professional Website Design</h3>
                        <div className="service-card-footer">
                          <span className="badge badge-toprated">PUBLISHED</span>
                          <span className="price-amount">$120</span>
                        </div>
                      </div>
                    </div>
                    <div className="service-card">
                      <div className="service-card-body">
                        <h3 className="service-card-title">Cinematic 4K Video Editing</h3>
                        <div className="service-card-footer">
                          <span className="badge badge-toprated">PUBLISHED</span>
                          <span className="price-amount">$80</span>
                        </div>
                      </div>
                    </div>
                    <div className="service-card">
                      <div className="service-card-body">
                        <h3 className="service-card-title">Modern Minimalist Logo Design</h3>
                        <div className="service-card-footer">
                          <span className="badge badge-toprated">PUBLISHED</span>
                          <span className="price-amount">$40</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── TAB: MY SERVICES ─────────────────────────────────────── */}
        {activeTab === 'My Services' && (
          <div className="content-block">
            <div className="dash-header-row" style={{ marginBottom: '20px' }}>
              <div>
                <h2 className="block-title" style={{ margin: 0 }}>All Services &amp; Storefronts</h2>
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                  Manage, pause, or edit your service storefront listings.
                </p>
              </div>
              <Link to="/seller/services/new" className="btn-primary" style={{ textDecoration: 'none' }}>
                + Add Service
              </Link>
            </div>

            {myServices.length > 0 ? (
              <div className="services-grid">
                {myServices.map((srv) => (
                  <div key={srv.id} className="service-card">
                    <div className="service-card-body">
                      <h3 className="service-card-title">{srv.title}</h3>
                      <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '12px' }}>
                        {srv.description?.slice(0, 80)}...
                      </p>
                      <div className="service-card-footer" style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                        <span className={`badge ${srv.status === 'published' ? 'badge-toprated' : ''}`}>
                          {srv.status ? srv.status.toUpperCase() : 'PUBLISHED'}
                        </span>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                          onClick={() => handleToggleServiceStatus(srv)}
                        >
                          {srv.status === 'published' ? 'Pause' : 'Publish'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '12px' }}>
                <h3>No services created yet</h3>
                <p style={{ color: '#64748b', marginBottom: '16px' }}>
                  Create your first service storefront to start receiving client bookings.
                </p>
                <Link to="/seller/services/new" className="btn-primary" style={{ textDecoration: 'none' }}>
                  Create Storefront
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: ORDERS ─────────────────────────────────────────── */}
        {activeTab === 'Orders' && renderActiveOrders()}

        {/* ── TAB: MESSAGES ───────────────────────────────────────── */}
        {activeTab === 'Messages' && (
          <div className="inbox-layout">
            <div className="inbox-sidebar">
              <div className="inbox-search-wrap">
                <input
                  type="text"
                  className="inbox-search"
                  placeholder="🔍  Search client messages…"
                />
              </div>
              {conversations.map((c, i) => (
                <button
                  key={c.id || i}
                  type="button"
                  className={`inbox-thread-item ${activeThreadIndex === i ? 'active' : ''}`}
                  onClick={() => setActiveThreadIndex(i)}
                >
                  <div className="inbox-avatar" style={{ background: '#4f46e5' }}>
                    {c.initials || (c.name || 'CL').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="inbox-thread-meta">
                    <div className="inbox-thread-top">
                      <span className="inbox-thread-name">{c.name || `Client #${c.id}`}</span>
                      <span className="inbox-thread-time">{c.time || 'Today'}</span>
                    </div>
                    <div className="inbox-thread-service">{c.service || 'Marketplace Order'}</div>
                    <div className="inbox-thread-preview">{c.preview || 'Click to view conversation'}</div>
                  </div>
                  {c.unread > 0 && <span className="inbox-unread-badge">{c.unread}</span>}
                </button>
              ))}
            </div>

            <div className="inbox-chat">
              <div className="inbox-chat-header">
                <div className="inbox-avatar" style={{ background: '#4f46e5', width: '38px', height: '38px' }}>
                  {conversations[activeThreadIndex]?.initials || 'CL'}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {conversations[activeThreadIndex]?.name || 'Client'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {conversations[activeThreadIndex]?.service || 'Direct Chat'}
                  </div>
                </div>
              </div>

              <div className="inbox-messages">
                {messages.map((m, idx) => {
                  const isMine = m.from === 'me' || m.sender_id === currentUser?.id;
                  return (
                    <div key={idx} className={`inbox-bubble-row ${isMine ? 'mine' : 'theirs'}`}>
                      <div className="inbox-bubble-wrap">
                        <div className={`inbox-bubble ${isMine ? 'bubble-mine' : 'bubble-theirs'}`}>
                          {m.text || m.content}
                        </div>
                        <span className="inbox-bubble-ts">{m.ts || 'Today'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form className="inbox-composer" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  className="inbox-input"
                  placeholder="Type a response to client..."
                  value={msgInput}
                  onChange={(e) => setMsgInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ padding: '10px 20px', borderRadius: '12px' }}
                  disabled={isSendingMsg}
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── TAB: ANALYTICS & EARNINGS ────────────────────────────── */}
        {(activeTab === 'Analytics' || activeTab === 'Earnings') && (
          <div className="content-block">
            <h2 className="block-title">Financial &amp; Performance Insights</h2>
            <div className="stats-cards-grid" style={{ marginBottom: '24px' }}>
              <div className="stat-card">
                <div className="stat-label">Net Cleared Earnings</div>
                <div className="stat-value" style={{ color: '#16a34a' }}>${dashboardData.revenue}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Pending In Escrow</div>
                <div className="stat-value" style={{ color: '#0284c7' }}>$240</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Average Order Value</div>
                <div className="stat-value">$64.50</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Completion Rate</div>
                <div className="stat-value">98.2%</div>
              </div>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              DUMMR automatically disburses cleared payments directly to your connected bank account.
            </p>
          </div>
        )}

        {/* ── TAB: PROFILE ────────────────────────────────────────── */}
        {activeTab === 'Profile' && (
          <div className="content-block">
            <h2 className="block-title">Provider Profile</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '24px', alignItems: 'center' }}>
              <div className="freelancer-avatar-lg" style={{ width: '90px', height: '90px', fontSize: '2rem' }}>
                {currentUser?.avatar || 'DS'}
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px 0' }}>{currentUser?.name || currentUser?.username}</h3>
                <p style={{ color: '#64748b', margin: '0 0 8px 0' }}>{currentUser?.specialty || 'Independent Specialist'}</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span className="badge badge-toprated">Verified Provider</span>
                  <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>{currentUser?.email}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Deliver Order Modal */}
      {deliverModalOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              maxWidth: '500px',
              width: '100%',
              padding: '28px',
            }}
          >
            <h3 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>
              Deliver Work for Order #{deliverModalOrder.id}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px' }}>
              Submit your completed deliverables, notes, or download links for the client.
            </p>
            <form onSubmit={handleConfirmDeliver}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Delivery Message / Notes / Links
                </label>
                <textarea
                  rows="4"
                  className="form-textarea"
                  placeholder="Here are your finalized files and deliverables..."
                  value={deliveryMessage}
                  onChange={(e) => setDeliveryMessage(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isDelivering}
                  onClick={() => setDeliverModalOrder(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isDelivering}
                >
                  {isDelivering ? 'Submitting Delivery...' : 'Submit Final Delivery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
