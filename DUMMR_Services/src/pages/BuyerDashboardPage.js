import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  fetchBuyerDashboard,
  fetchOrders,
  fetchSavedServices,
  completeOrder,
  createReview,
  fetchConversations,
  fetchMessages,
  sendMessage,
} from '../api';
import { useAuth } from '../context/AuthContext';

export default function BuyerDashboardPage({ onNotice }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();

  const activeTab = searchParams.get('tab') || 'Dashboard';
  const setActiveTab = (tab) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', tab);
    setSearchParams(newParams);
  };

  // State
  const [buyerMetrics, setBuyerMetrics] = useState({
    active_orders_count: 2,
    total_spend: 330,
    saved_count: 2,
  });
  const [orders, setOrders] = useState([]);
  const [savedServices, setSavedServices] = useState([]);

  // Review & Complete Modal
  const [completingOrder, setCompletingOrder] = useState(null);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Messaging State
  const [conversations, setConversations] = useState([]);
  const [activeThreadIndex, setActiveThreadIndex] = useState(0);
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [isSendingMsg, setIsSendingMsg] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [dashRes, ordersRes, savedRes] = await Promise.allSettled([
        fetchBuyerDashboard(),
        fetchOrders(),
        fetchSavedServices(),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value) {
        setBuyerMetrics((prev) => ({
          ...prev,
          active_orders_count: dashRes.value.active_orders_count ?? prev.active_orders_count,
          total_spend: dashRes.value.spend ?? dashRes.value.total_spend ?? prev.total_spend,
          saved_count: dashRes.value.saved_services ?? prev.saved_count,
        }));
      }

      if (ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value)) {
        setOrders(ordersRes.value);
      }

      if (savedRes.status === 'fulfilled' && Array.isArray(savedRes.value)) {
        setSavedServices(savedRes.value);
      }
    } catch (err) {
      // Fallback retained
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load messaging threads
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
            // Default demo threads
            setConversations([
              {
                id: 1,
                name: 'John Studio',
                initials: 'JS',
                color: '#7c3aed',
                service: 'Video Editing – 4K Cinematic',
                preview: 'Hi! I have uploaded the first cut of your 4K video.',
                time: '2m ago',
                unread: 2,
              },
              {
                id: 2,
                name: 'Sarah Tech',
                initials: 'ST',
                color: '#10b981',
                service: 'Website Development – Full Stack',
                preview: 'I have deployed the staging database for your site.',
                time: '1h ago',
                unread: 1,
              },
              {
                id: 3,
                name: 'Priya Design',
                initials: 'PD',
                color: '#f59e0b',
                service: 'Logo Design – Brand Identity',
                preview: 'Here are the 3 initial concept drafts for review.',
                time: '3h ago',
                unread: 0,
              },
            ]);
            setMessages([
              { from: 'them', text: 'Hey! Just wanted to confirm the order details before I start.', ts: '10:02 AM' },
              { from: 'me', text: 'Sure! I need a 2-minute highlight reel from the raw footage.', ts: '10:08 AM' },
              { from: 'them', text: 'Got it. Any specific colour grade style — warm, cool, or natural?', ts: '10:11 AM' },
              { from: 'me', text: 'Warm and cinematic please. Think golden hour vibes.', ts: '10:14 AM' },
              { from: 'them', text: 'Perfect. I will have a rough cut ready within 48 hours.', ts: '11:30 AM' },
              { from: 'them', text: 'Hi! I have uploaded the first cut of your 4K video. Let me know what you think!', ts: '2:15 PM' },
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
        setMessages((prev) => [...prev, { from: 'me', text, ts: 'Just now' }]);
      }
    } else {
      setMessages((prev) => [...prev, { from: 'me', text, ts: 'Just now' }]);
    }
    setIsSendingMsg(false);
  };

  const handleCompleteAndReview = async (e) => {
    e.preventDefault();
    if (!completingOrder) return;
    setIsSubmittingReview(true);
    try {
      await completeOrder(completingOrder.id);
      await createReview(completingOrder.id, {
        rating: Number(rating),
        comment: reviewComment,
      });

      if (onNotice) {
        onNotice(`Order #${completingOrder.id} completed & review submitted!`);
      }
      setCompletingOrder(null);
      setReviewComment('');
      loadData();
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Failed to complete order.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const activeOrdersList = orders.filter((o) => !['completed', 'cancelled', 'refunded'].includes(o.status));
  const completedOrdersList = orders.filter((o) => ['completed', 'cancelled', 'refunded'].includes(o.status));

  const navItems = [
    'Dashboard',
    'Active Orders',
    'Messages',
    'Saved Services',
    'Order History',
    'Payments',
    'Profile',
  ];

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <div className="sidebar-title">Buyer Hub</div>
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
            {activeTab === 'Messages' ? 'Inbox' : `Buyer ${activeTab}`}
          </h1>
          <Link to="/explore" className="btn-primary" style={{ textDecoration: 'none' }}>
            Explore Services
          </Link>
        </div>

        {/* ── TAB: DASHBOARD ───────────────────────────────────────── */}
        {activeTab === 'Dashboard' && (
          <>
            <div className="stats-cards-grid">
              <div className="stat-card">
                <div className="stat-label">Active Orders</div>
                <div className="stat-value" style={{ color: 'var(--primary)' }}>
                  {activeOrdersList.length || buyerMetrics.active_orders_count}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total Spend</div>
                <div className="stat-value">${buyerMetrics.total_spend}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Saved Services</div>
                <div className="stat-value">{savedServices.length || buyerMetrics.saved_count}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Buyer Rating</div>
                <div className="stat-value">★ 5.0</div>
              </div>
            </div>

            <div className="content-block">
              <h2 className="block-title">Active Order Progress</h2>
              {activeOrdersList.length > 0 ? (
                activeOrdersList.map((ord) => (
                  <div key={ord.id} className="progress-card">
                    <div className="progress-header">
                      <span>Order #{ord.id}: <strong>{ord.service?.title || ord.service_title || 'Custom Service'}</strong></span>
                      <span>Price: <strong>${ord.price}</strong> • Status: <strong style={{ textTransform: 'capitalize' }}>{ord.status?.replace('_', ' ')}</strong></span>
                    </div>
                    <div className="progress-bar-bg">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: ord.status === 'delivered' ? '100%' : ord.status === 'in_progress' ? '65%' : '30%',
                        }}
                      />
                    </div>
                    {ord.status === 'delivered' && (
                      <div style={{ marginTop: '12px', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ padding: '6px 14px', fontSize: '0.85rem', background: '#16a34a' }}
                          onClick={() => setCompletingOrder(ord)}
                        >
                          Accept Delivery &amp; Leave Review
                        </button>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <>
                  <div className="progress-card">
                    <div className="progress-header">
                      <span>Service: <strong>Video Editing</strong></span>
                      <span>Price: <strong>$80</strong> (Progress: 60%)</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: '60%' }}></div>
                    </div>
                  </div>
                  <div className="progress-card" style={{ marginBottom: 0 }}>
                    <div className="progress-header">
                      <span>Service: <strong>Website Development</strong></span>
                      <span>Price: <strong>$250</strong> (Progress: 25%)</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: '25%' }}></div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="content-block">
              <h2 className="block-title">Saved Services</h2>
              <div className="services-grid" style={{ marginBottom: 0 }}>
                {savedServices.length > 0 ? (
                  savedServices.slice(0, 3).map((item) => {
                    const s = item.service || item;
                    return (
                      <div
                        key={s.id}
                        className="service-card"
                        onClick={() => navigate(`/services/${s.id}`)}
                      >
                        <div className="service-card-body">
                          <h3 className="service-card-title">{s.title}</h3>
                          <div className="service-card-footer">
                            <span className="price-label">Starting at</span>
                            <span className="price-amount">${s.packages?.[0]?.price || s.price || 50}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <>
                    <div className="service-card" onClick={() => navigate('/explore')}>
                      <div className="service-card-body">
                        <h3 className="service-card-title">I will create a cinematic 4K video for you</h3>
                        <div className="service-card-footer">
                          <span className="price-label">Starting at</span>
                          <span className="price-amount">$60</span>
                        </div>
                      </div>
                    </div>
                    <div className="service-card" onClick={() => navigate('/explore')}>
                      <div className="service-card-body">
                        <h3 className="service-card-title">I will build responsive web applications in React</h3>
                        <div className="service-card-footer">
                          <span className="price-label">Starting at</span>
                          <span className="price-amount">$150</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── TAB: ACTIVE ORDERS ───────────────────────────────────── */}
        {activeTab === 'Active Orders' && (
          <div className="content-block">
            <h2 className="block-title">Ongoing Deliveries</h2>
            {activeOrdersList.length > 0 ? (
              activeOrdersList.map((ord) => (
                <div key={ord.id} className="progress-card">
                  <div className="progress-header">
                    <div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                        Order #{ord.id}: {ord.service?.title || ord.service_title || 'Independent Service'}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>
                        Seller: {ord.seller?.name || ord.seller?.username || 'DUMMR Seller'} • Price: ${ord.price}
                      </div>
                    </div>
                    <span className={`badge-status badge-${ord.status?.replace('_', '-')}`}>
                      {ord.status?.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  {ord.delivery_message && (
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', margin: '12px 0', fontSize: '0.85rem' }}>
                      <strong>Seller Note:</strong> {ord.delivery_message}
                    </div>
                  )}

                  {ord.status === 'delivered' ? (
                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ background: '#16a34a' }}
                        onClick={() => setCompletingOrder(ord)}
                      >
                        Accept Delivery &amp; Leave Review
                      </button>
                    </div>
                  ) : (
                    <div className="progress-bar-bg" style={{ marginTop: '14px' }}>
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: ord.status === 'in_progress' ? '60%' : '20%',
                        }}
                      />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '12px' }}>
                <h3>No active orders</h3>
                <p style={{ color: '#64748b', marginBottom: '16px' }}>
                  Explore top-rated freelance services and hire with escrow protection.
                </p>
                <Link to="/explore" className="btn-primary" style={{ textDecoration: 'none' }}>
                  Browse Services
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: MESSAGES ───────────────────────────────────────── */}
        {activeTab === 'Messages' && (
          <div className="inbox-layout">
            <div className="inbox-sidebar">
              <div className="inbox-search-wrap">
                <input
                  type="text"
                  className="inbox-search"
                  placeholder="🔍  Search messages…"
                />
              </div>
              {conversations.map((t, i) => (
                <button
                  key={t.id || i}
                  type="button"
                  className={`inbox-thread-item ${activeThreadIndex === i ? 'active' : ''}`}
                  onClick={() => setActiveThreadIndex(i)}
                >
                  <div
                    className="inbox-avatar"
                    style={{ background: t.color || '#7c3aed' }}
                  >
                    {t.initials || (t.name || 'DS').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="inbox-thread-meta">
                    <div className="inbox-thread-top">
                      <span className="inbox-thread-name">{t.name}</span>
                      <span className="inbox-thread-time">{t.time || 'Today'}</span>
                    </div>
                    <div className="inbox-thread-service">{t.service || 'Marketplace Service'}</div>
                    <div className="inbox-thread-preview">{t.preview}</div>
                  </div>
                  {t.unread > 0 && (
                    <span className="inbox-unread-badge">{t.unread}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="inbox-chat">
              <div className="inbox-chat-header">
                <div
                  className="inbox-avatar"
                  style={{
                    background: conversations[activeThreadIndex]?.color || '#7c3aed',
                    width: '38px',
                    height: '38px',
                    fontSize: '0.85rem',
                  }}
                >
                  {conversations[activeThreadIndex]?.initials || 'DS'}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{conversations[activeThreadIndex]?.name || 'Seller'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {conversations[activeThreadIndex]?.service || 'Direct Chat'}
                  </div>
                </div>
              </div>

              <div className="inbox-messages">
                {messages.map((msg, i) => {
                  const isMine = msg.from === 'me' || msg.sender_id === currentUser?.id;
                  return (
                    <div
                      key={i}
                      className={`inbox-bubble-row ${isMine ? 'mine' : 'theirs'}`}
                    >
                      {!isMine && (
                        <div
                          className="inbox-avatar"
                          style={{
                            background: conversations[activeThreadIndex]?.color || '#7c3aed',
                            width: '30px',
                            height: '30px',
                            fontSize: '0.7rem',
                            flexShrink: 0,
                            alignSelf: 'flex-end',
                          }}
                        >
                          {conversations[activeThreadIndex]?.initials || 'DS'}
                        </div>
                      )}
                      <div className="inbox-bubble-wrap">
                        <div className={`inbox-bubble ${isMine ? 'bubble-mine' : 'bubble-theirs'}`}>
                          {msg.text || msg.content}
                        </div>
                        <span className="inbox-bubble-ts">{msg.ts || 'Today'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form className="inbox-composer" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  className="inbox-input"
                  placeholder="Type a message…"
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

        {/* ── TAB: SAVED SERVICES ─────────────────────────────────── */}
        {activeTab === 'Saved Services' && (
          <div className="content-block">
            <h2 className="block-title">Saved Favorites</h2>
            {savedServices.length > 0 ? (
              <div className="services-grid">
                {savedServices.map((item) => {
                  const s = item.service || item;
                  return (
                    <div
                      key={s.id}
                      className="service-card"
                      onClick={() => navigate(`/services/${s.id}`)}
                    >
                      <div className="service-card-body">
                        <h3 className="service-card-title">{s.title}</h3>
                        <div className="service-card-footer">
                          <span className="price-label">Starting at</span>
                          <span className="price-amount">${s.packages?.[0]?.price || s.price || 50}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '12px' }}>
                <h3>No saved services yet</h3>
                <p style={{ color: '#64748b', marginBottom: '16px' }}>
                  Click the heart icon on any service listing to save it for later.
                </p>
                <Link to="/explore" className="btn-primary" style={{ textDecoration: 'none' }}>
                  Explore Services
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: ORDER HISTORY ──────────────────────────────────── */}
        {activeTab === 'Order History' && (
          <div className="table-container">
            <div className="table-header">Completed &amp; Past Orders</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Service</th>
                  <th>Seller</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {completedOrdersList.length > 0 ? (
                  completedOrdersList.map((ord) => (
                    <tr key={ord.id}>
                      <td>#{ord.id}</td>
                      <td>{ord.service?.title || ord.service_title || 'Marketplace Service'}</td>
                      <td>{ord.seller?.name || ord.seller?.username || 'DUMMR Seller'}</td>
                      <td>${ord.price}</td>
                      <td>
                        <span className={`badge-status badge-${ord.status?.replace('_', '-')}`}>
                          {ord.status?.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <>
                    <tr>
                      <td>#ORD-7812</td>
                      <td>Logo Design</td>
                      <td>Priya Design</td>
                      <td>$40</td>
                      <td><span className="badge-status badge-delivered">Completed</span></td>
                    </tr>
                    <tr>
                      <td>#ORD-6541</td>
                      <td>SEO Consultation</td>
                      <td>Mark Words</td>
                      <td>$35</td>
                      <td><span className="badge-status badge-delivered">Completed</span></td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── TAB: PAYMENTS ───────────────────────────────────────── */}
        {activeTab === 'Payments' && (
          <div className="content-block">
            <h2 className="block-title">Payment Methods &amp; Invoices</h2>
            <div className="stats-cards-grid" style={{ marginBottom: '24px' }}>
              <div className="stat-card">
                <div className="stat-label">Lifetime Platform Spend</div>
                <div className="stat-value" style={{ color: 'var(--primary)' }}>
                  ${buyerMetrics.total_spend}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Escrow Protected Orders</div>
                <div className="stat-value">{activeOrdersList.length || 2}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Refunds Processed</div>
                <div className="stat-value">$0.00</div>
              </div>
            </div>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
              All transactions on DUMMR are held safely in escrow until you approve the final delivery.
            </p>
          </div>
        )}

        {/* ── TAB: PROFILE ────────────────────────────────────────── */}
        {activeTab === 'Profile' && (
          <div className="content-block">
            <h2 className="block-title">Client Profile</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '20px', alignItems: 'center' }}>
              <div className="freelancer-avatar-lg" style={{ width: '80px', height: '80px', fontSize: '1.8rem', background: '#6366f1' }}>
                {currentUser?.avatar || 'CL'}
              </div>
              <div>
                <h3 style={{ margin: '0 0 4px 0' }}>{currentUser?.name || currentUser?.username}</h3>
                <p style={{ color: '#64748b', margin: '0 0 8px 0' }}>Client Account</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <span className="badge badge-toprated">Verified Buyer</span>
                  <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>{currentUser?.email}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {completingOrder && (
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
              maxWidth: '480px',
              width: '100%',
              padding: '28px',
            }}
          >
            <h3 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>
              Complete Order &amp; Leave Review
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '20px' }}>
              Approving delivery releases funds to the provider. Share your honest feedback.
            </p>
            <form onSubmit={handleCompleteAndReview}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Star Rating (1 - 5)
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      style={{
                        fontSize: '1.6rem',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: star <= rating ? '#f59e0b' : '#cbd5e1',
                      }}
                      onClick={() => setRating(star)}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Review Feedback
                </label>
                <textarea
                  rows="4"
                  className="form-textarea"
                  placeholder="How was the communication, delivery speed, and quality of work?"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isSubmittingReview}
                  onClick={() => setCompletingOrder(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmittingReview}
                >
                  {isSubmittingReview ? 'Submitting Review...' : 'Approve & Release Funds'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
