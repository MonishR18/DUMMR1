import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  fetchBuyerDashboard,
  fetchOrders,
  fetchSavedServices,
  completeOrder,
  cancelOrder,
  requestRevision,
  createReview,
  fetchConversations,
  fetchMessages,
  sendMessage,
  markConversationRead,
  blockUser,
  createReport,
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

  // State initialized to 0
  const [buyerMetrics, setBuyerMetrics] = useState({
    active_orders_count: 0,
    total_spend: 0,
    saved_count: 0,
  });
  const [orders, setOrders] = useState([]);
  const [savedServices, setSavedServices] = useState([]);

  // Review & Complete Modal
  const [completingOrder, setCompletingOrder] = useState(null);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // Revision Modal
  const [revisionOrder, setRevisionOrder] = useState(null);
  const [revisionNote, setRevisionNote] = useState('');
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);

  // Report Modal
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);

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
        const val = dashRes.value;
        setBuyerMetrics({
          active_orders_count: val.active_orders ?? val.active_orders_count ?? 0,
          total_spend: val.total_spent ?? val.spend ?? 0,
          saved_count: val.saved_services ?? val.favorites ?? 0,
        });
      }

      if (ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value)) {
        setOrders(ordersRes.value);
      }

      if (savedRes.status === 'fulfilled' && Array.isArray(savedRes.value)) {
        setSavedServices(savedRes.value);
      }
    } catch (err) {
      // Keep state clean
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
          if (isMounted && Array.isArray(convList)) {
            setConversations(convList);
            if (convList.length > 0) {
              const activeConv = convList[activeThreadIndex] || convList[0];
              if (activeConv?.id) {
                // Call markConversationRead to clear unread counts!
                try {
                  await markConversationRead(activeConv.id);
                  activeConv.unread_count = 0;
                } catch (readErr) {
                  // Non-fatal
                }

                const msgList = await fetchMessages(activeConv.id);
                if (isMounted && Array.isArray(msgList)) {
                  setMessages(msgList);
                }
              }
            } else {
              setMessages([]);
            }
          }
        } catch (err) {
          if (isMounted) {
            setConversations([]);
            setMessages([]);
          }
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
    if (activeConv?.id) {
      try {
        await sendMessage(activeConv.id, text);
        const updated = await fetchMessages(activeConv.id);
        setMessages(updated);
      } catch (err) {
        setMessages((prev) => [...prev, { sender_id: currentUser?.id, content: text, created_at: new Date().toISOString() }]);
      }
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

  const handleRequestRevision = async (e) => {
    e.preventDefault();
    if (!revisionOrder || !revisionNote.trim()) return;
    setIsSubmittingRevision(true);
    try {
      await requestRevision(revisionOrder.id, { message: revisionNote.trim() });
      if (onNotice) onNotice(`Revision requested for Order #${revisionOrder.id}!`);
      setRevisionOrder(null);
      setRevisionNote('');
      loadData();
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Failed to request revision.');
    } finally {
      setIsSubmittingRevision(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm(`Are you sure you want to cancel order #${orderId}?`)) return;
    try {
      await cancelOrder(orderId);
      if (onNotice) onNotice(`Order #${orderId} cancelled.`);
      loadData();
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Failed to cancel order.');
    }
  };

  const handleBlockUserInChat = async () => {
    const activeConv = conversations[activeThreadIndex];
    const otherUserId = activeConv?.buyer_id === currentUser?.id ? activeConv?.seller_id : activeConv?.buyer_id;
    if (!otherUserId) return;
    if (!window.confirm('Block this user? You will no longer receive messages or orders from them.')) return;
    try {
      await blockUser(otherUserId);
      if (onNotice) onNotice('User blocked.');
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Failed to block user.');
    }
  };

  const handleReportUserInChat = async (e) => {
    e.preventDefault();
    if (!reportTarget || !reportReason.trim()) return;
    setIsReporting(true);
    try {
      await createReport({
        target_type: 'USER',
        target_id: reportTarget,
        reason: reportReason.trim(),
      });
      if (onNotice) onNotice('Report submitted to moderators.');
      setReportTarget(null);
      setReportReason('');
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Failed to submit report.');
    } finally {
      setIsReporting(false);
    }
  };

  // Case-insensitive status filtering
  const activeOrdersList = orders.filter((o) =>
    !['COMPLETED', 'CANCELLED', 'REFUNDED'].includes((o.status || '').toUpperCase())
  );
  const completedOrdersList = orders.filter((o) =>
    ['COMPLETED', 'CANCELLED', 'REFUNDED'].includes((o.status || '').toUpperCase())
  );

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
                activeOrdersList.map((ord) => {
                  const rawStatus = (ord.status || 'PENDING').toUpperCase();
                  const isDelivered = rawStatus === 'DELIVERED';
                  const isInProgress = rawStatus === 'IN_PROGRESS';
                  return (
                    <div key={ord.id} className="progress-card">
                      <div className="progress-header">
                        <span>
                          <Link to={`/orders/${ord.id}`} style={{ color: '#6366f1', textDecoration: 'none', fontWeight: 700 }}>
                            Order #{ord.id}:
                          </Link>{' '}
                          <strong>{ord.service?.title || `Service #${ord.service_id}`}</strong>
                        </span>
                        <span>
                          Price: <strong>${ord.amount || ord.price || 0}</strong> • Status:{' '}
                          <strong style={{ textTransform: 'capitalize' }}>
                            {rawStatus.replace('_', ' ')}
                          </strong>
                        </span>
                      </div>
                      <div className="progress-bar-bg">
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: isDelivered ? '100%' : isInProgress ? '65%' : '30%',
                          }}
                        />
                      </div>
                      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <Link
                          to={`/orders/${ord.id}`}
                          className="btn-secondary"
                          style={{ padding: '5px 12px', fontSize: '0.8rem', textDecoration: 'none' }}
                        >
                          View Details
                        </Link>
                        {isDelivered && (
                          <>
                            <button
                              type="button"
                              className="btn-primary"
                              style={{ padding: '5px 12px', fontSize: '0.8rem', background: '#16a34a' }}
                              onClick={() => setCompletingOrder(ord)}
                            >
                              Accept Delivery &amp; Leave Review
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '5px 12px', fontSize: '0.8rem' }}
                              onClick={() => setRevisionOrder(ord)}
                            >
                              Request Revision
                            </button>
                          </>
                        )}
                        {['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(rawStatus) && (
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '5px 12px', fontSize: '0.8rem', color: '#dc2626' }}
                            onClick={() => handleCancelOrder(ord.id)}
                          >
                            Cancel Order
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                  No active orders right now.{' '}
                  <Link to="/explore" style={{ color: '#6366f1', fontWeight: 600 }}>
                    Explore Services
                  </Link>{' '}
                  to hire freelance talent.
                </div>
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
                            <span className="price-amount">${s.packages?.[0]?.price || s.price || 0}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px', color: '#64748b', gridColumn: '1 / -1' }}>
                    No saved services yet. Click the heart icon on any service listing to save it.
                  </div>
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
              activeOrdersList.map((ord) => {
                const rawStatus = (ord.status || 'PENDING').toUpperCase();
                const isDelivered = rawStatus === 'DELIVERED';
                const isInProgress = rawStatus === 'IN_PROGRESS';
                return (
                  <div key={ord.id} className="progress-card">
                    <div className="progress-header">
                      <div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                          <Link to={`/orders/${ord.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            Order #{ord.id}: {ord.service?.title || `Service #${ord.service_id}`}
                          </Link>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '4px' }}>
                          Seller: {ord.seller?.name || ord.seller?.username || `Seller #${ord.seller_id}`} • Price: ${ord.amount || ord.price}
                        </div>
                      </div>
                      <span className={`badge-status badge-${rawStatus.toLowerCase().replace('_', '-')}`}>
                        {rawStatus.replace('_', ' ')}
                      </span>
                    </div>

                    {ord.delivery_message && (
                      <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', margin: '12px 0', fontSize: '0.85rem' }}>
                        <strong>Seller Note:</strong> {ord.delivery_message}
                      </div>
                    )}

                    <div className="progress-bar-bg" style={{ marginTop: '14px' }}>
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: isDelivered ? '100%' : isInProgress ? '60%' : '20%',
                        }}
                      />
                    </div>

                    <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <Link
                        to={`/orders/${ord.id}`}
                        className="btn-secondary"
                        style={{ textDecoration: 'none' }}
                      >
                        Order Details
                      </Link>
                      {isDelivered && (
                        <>
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ background: '#16a34a' }}
                            onClick={() => setCompletingOrder(ord)}
                          >
                            Accept Delivery &amp; Leave Review
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setRevisionOrder(ord)}
                          >
                            Request Revision
                          </button>
                        </>
                      )}
                      {['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(rawStatus) && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ color: '#dc2626' }}
                          onClick={() => handleCancelOrder(ord.id)}
                        >
                          Cancel Order
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
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
                  <div className="inbox-avatar" style={{ background: '#7c3aed' }}>
                    {(t.name || `S${t.id}`).substring(0, 2).toUpperCase()}
                  </div>
                  <div className="inbox-thread-meta">
                    <div className="inbox-thread-top">
                      <span className="inbox-thread-name">{t.name || `Seller #${t.seller_id || t.id}`}</span>
                      <span className="inbox-thread-time">
                        {t.updated_at ? new Date(t.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                      </span>
                    </div>
                    <div className="inbox-thread-service">{t.order_id ? `Order #${t.order_id}` : 'Direct Conversation'}</div>
                    <div className="inbox-thread-preview">{t.last_message || 'Open conversation'}</div>
                  </div>
                  {t.unread_count > 0 && <span className="inbox-unread-badge">{t.unread_count}</span>}
                </button>
              ))}
              {conversations.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                  No messages yet. When you contact sellers or place orders, chats will appear here.
                </div>
              )}
            </div>

            <div className="inbox-chat">
              {conversations.length > 0 ? (
                <>
                  <div className="inbox-chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="inbox-avatar" style={{ background: '#7c3aed', width: '38px', height: '38px', fontSize: '0.85rem' }}>
                        {(conversations[activeThreadIndex]?.name || 'DS').substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700 }}>
                          {conversations[activeThreadIndex]?.name || `Seller #${conversations[activeThreadIndex]?.seller_id || ''}`}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {conversations[activeThreadIndex]?.order_id ? `Order #${conversations[activeThreadIndex].order_id}` : 'Direct Chat'}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                        onClick={() => {
                          const otherId = conversations[activeThreadIndex]?.buyer_id === currentUser?.id ? conversations[activeThreadIndex]?.seller_id : conversations[activeThreadIndex]?.buyer_id;
                          setReportTarget(otherId);
                        }}
                      >
                        🚩 Report
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '4px 8px', color: '#dc2626' }}
                        onClick={handleBlockUserInChat}
                      >
                        🚫 Block
                      </button>
                    </div>
                  </div>

                  <div className="inbox-messages">
                    {messages.map((msg, i) => {
                      const isMine = msg.from === 'me' || msg.sender_id === currentUser?.id;
                      return (
                        <div key={i} className={`inbox-bubble-row ${isMine ? 'mine' : 'theirs'}`}>
                          <div className="inbox-bubble-wrap">
                            <div className={`inbox-bubble ${isMine ? 'bubble-mine' : 'bubble-theirs'}`}>
                              {msg.content || msg.text}
                            </div>
                            <span className="inbox-bubble-ts">
                              {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (msg.ts || 'Now')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {messages.length === 0 && (
                      <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                        Start of your conversation. Send a message below!
                      </div>
                    )}
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
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                  Select or start a conversation to view messages.
                </div>
              )}
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
                          <span className="price-amount">${s.packages?.[0]?.price || s.price || 0}</span>
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
            <div className="table-header">Completed &amp; Past Orders ({completedOrdersList.length})</div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Service</th>
                  <th>Seller</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {completedOrdersList.map((ord) => {
                  const rawStatus = (ord.status || 'COMPLETED').toUpperCase();
                  return (
                    <tr key={ord.id}>
                      <td style={{ fontWeight: 600 }}>
                        <Link to={`/orders/${ord.id}`} style={{ color: '#6366f1', textDecoration: 'none' }}>
                          #{ord.id}
                        </Link>
                      </td>
                      <td>{ord.service?.title || `Service #${ord.service_id}`}</td>
                      <td>{ord.seller?.name || ord.seller?.username || `Seller #${ord.seller_id}`}</td>
                      <td>${ord.amount || ord.price || 0}</td>
                      <td>
                        <span className={`badge-status badge-${rawStatus.toLowerCase().replace('_', '-')}`}>
                          {rawStatus.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <Link to={`/orders/${ord.id}`} className="btn-secondary" style={{ padding: '3px 8px', fontSize: '0.75rem', textDecoration: 'none' }}>
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {completedOrdersList.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      No past orders completed yet.
                    </td>
                  </tr>
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
                <div className="stat-value">{activeOrdersList.length}</div>
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
              Accept Delivery &amp; Leave Review
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px' }}>
              Finalize Order #{completingOrder.id} and share your feedback with the seller.
            </p>
            <form onSubmit={handleCompleteAndReview}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Rating
                </label>
                <select
                  className="form-input"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                >
                  <option value="5">★★★★★ (5 - Excellent)</option>
                  <option value="4">★★★★☆ (4 - Good)</option>
                  <option value="3">★★★☆☆ (3 - Average)</option>
                  <option value="2">★★☆☆☆ (2 - Poor)</option>
                  <option value="1">★☆☆☆☆ (1 - Terrible)</option>
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                  Review Comments
                </label>
                <textarea
                  rows="3"
                  className="form-textarea"
                  placeholder="Share details about the deliverable, communication, and speed..."
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
                  {isSubmittingReview ? 'Submitting...' : 'Complete &amp; Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revision Modal */}
      {revisionOrder && (
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
              Request Revision for Order #{revisionOrder.id}
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px' }}>
              Specify the changes needed before approving the final delivery.
            </p>
            <form onSubmit={handleRequestRevision}>
              <div style={{ marginBottom: '16px' }}>
                <textarea
                  rows="4"
                  className="form-textarea"
                  placeholder="Please specify exactly what needs modification..."
                  value={revisionNote}
                  onChange={(e) => setRevisionNote(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isSubmittingRevision}
                  onClick={() => setRevisionOrder(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSubmittingRevision}
                >
                  {isSubmittingRevision ? 'Submitting...' : 'Submit Revision Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportTarget && (
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
              maxWidth: '460px',
              width: '100%',
              padding: '24px',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Report User</h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px' }}>
              Describe the issue or policy violation (e.g. spam, harassment, fraudulent activity).
            </p>
            <form onSubmit={handleReportUserInChat}>
              <textarea
                rows="4"
                className="form-textarea"
                placeholder="Reason for report..."
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                required
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setReportTarget(null)}
                  disabled={isReporting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ background: '#dc2626' }}
                  disabled={isReporting}
                >
                  {isReporting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
