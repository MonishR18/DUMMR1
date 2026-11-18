import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  fetchOrderById,
  acceptOrder,
  startOrder,
  deliverOrder,
  requestRevision,
  completeOrder,
  cancelOrder,
  createReview,
} from '../api';
import { useAuth } from '../context/AuthContext';

export default function OrderDetailPage({ onNotice }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Modals
  const [showDeliverModal, setShowDeliverModal] = useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState('');

  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadOrder = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await fetchOrderById(id);
      setOrder(data);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load order.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  const isSeller = currentUser && order && currentUser.id === order.seller_id;
  const isBuyer = currentUser && order && currentUser.id === order.buyer_id;
  const isAdmin = currentUser && currentUser.role?.toUpperCase() === 'ADMIN';

  // Actions
  const handleAccept = async () => {
    try {
      await acceptOrder(order.id);
      if (onNotice) onNotice(`Order #${order.id} accepted!`);
      loadOrder();
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Failed to accept order.');
    }
  };

  const handleStart = async () => {
    try {
      await startOrder(order.id);
      if (onNotice) onNotice(`Order #${order.id} marked as in progress!`);
      loadOrder();
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Failed to start order.');
    }
  };

  const handleDeliver = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await deliverOrder(order.id, { message: deliveryMessage, files: [] });
      if (onNotice) onNotice(`Order #${order.id} delivered!`);
      setShowDeliverModal(false);
      setDeliveryMessage('');
      loadOrder();
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Failed to deliver order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevision = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await requestRevision(order.id, { message: revisionNote });
      if (onNotice) onNotice(`Revision requested for Order #${order.id}!`);
      setShowRevisionModal(false);
      setRevisionNote('');
      loadOrder();
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Failed to request revision.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteAndReview = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await completeOrder(order.id);
      await createReview(order.id, { rating: Number(rating), comment: reviewComment });
      if (onNotice) onNotice(`Order #${order.id} completed & review submitted!`);
      setShowReviewModal(false);
      setReviewComment('');
      loadOrder();
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Failed to complete order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm(`Are you sure you want to cancel order #${order.id}?`)) return;
    try {
      await cancelOrder(order.id);
      if (onNotice) onNotice(`Order #${order.id} cancelled.`);
      loadOrder();
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Failed to cancel order.');
    }
  };

  if (isLoading) {
    return <div style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>Loading order details...</div>;
  }

  if (errorMessage || !order) {
    return (
      <div style={{ maxWidth: '600px', margin: '80px auto', textAlign: 'center', padding: '0 20px' }}>
        <h2>Order Not Found</h2>
        <p style={{ color: '#64748b', marginBottom: '20px' }}>{errorMessage || 'Unable to retrieve order details.'}</p>
        <button type="button" className="btn-primary" onClick={() => navigate('/orders')}>
          Back to Orders
        </button>
      </div>
    );
  }

  const orderStatus = order.status?.toUpperCase() || 'PENDING';
  const steps = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'DELIVERED', 'COMPLETED'];
  const currentStepIndex = steps.indexOf(orderStatus);

  return (
    <div style={{ maxWidth: '960px', margin: '40px auto', padding: '0 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <Link
            to={isSeller ? '/seller/dashboard?tab=Orders' : '/buyer/dashboard?tab=Active%20Orders'}
            style={{ color: '#6366f1', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 600 }}
          >
            &larr; Back to Dashboard
          </Link>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '8px' }}>
            Order #{order.id}
          </h1>
        </div>
        <span className={`badge-status badge-${orderStatus.toLowerCase().replace('_', '-')}`} style={{ fontSize: '0.9rem', padding: '6px 14px' }}>
          {orderStatus.replace('_', ' ')}
        </span>
      </div>

      {/* Timeline tracker */}
      {orderStatus !== 'CANCELLED' && (
        <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
            {steps.map((st, idx) => {
              const isPast = currentStepIndex >= idx;
              const isCurrent = currentStepIndex === idx;
              return (
                <div key={st} style={{ flex: 1, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      background: isPast ? '#6366f1' : '#f1f5f9',
                      color: isPast ? '#fff' : '#94a3b8',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 8px auto',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      border: isCurrent ? '2px solid #4338ca' : 'none',
                    }}
                  >
                    {isPast ? '✓' : idx + 1}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: isCurrent ? 700 : 500, color: isCurrent ? '#1e293b' : '#64748b' }}>
                    {st.replace('_', ' ')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Order Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
        <div>
          {/* Service Details Card */}
          <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px' }}>
              Service Ordered
            </h2>
            <h3 style={{ fontSize: '1.05rem', color: '#1e293b', marginBottom: '8px' }}>
              {order.service?.title || `Service #${order.service_id}`}
            </h3>
            {order.service?.description && (
              <p style={{ color: '#64748b', fontSize: '0.9rem', lineHeight: '1.5' }}>
                {order.service.description}
              </p>
            )}

            {order.requirements && (
              <div style={{ marginTop: '20px', padding: '16px', background: '#f8fafc', borderRadius: '12px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569', marginBottom: '6px' }}>
                  Client Requirements
                </h4>
                <p style={{ fontSize: '0.9rem', color: '#1e293b', margin: 0 }}>
                  {order.requirements}
                </p>
              </div>
            )}
          </div>

          {/* Delivery Note & Files Card */}
          {(order.delivery_message || orderStatus === 'DELIVERED' || orderStatus === 'COMPLETED') && (
            <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px' }}>
                Deliverables &amp; Submission
              </h2>
              {order.delivery_message ? (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '16px', borderRadius: '12px' }}>
                  <div style={{ fontWeight: 700, color: '#166534', marginBottom: '6px', fontSize: '0.9rem' }}>
                    Seller Delivery Note:
                  </div>
                  <p style={{ color: '#14532d', fontSize: '0.9rem', margin: 0 }}>
                    {order.delivery_message}
                  </p>
                </div>
              ) : (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Awaiting deliverable submission.</p>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Info & Actions */}
        <div>
          <div style={{ background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Order Summary</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Order Price</span>
              <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>${order.amount}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Created Date</span>
              <span style={{ fontSize: '0.85rem' }}>{new Date(order.created_at).toLocaleDateString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#64748b' }}>Buyer ID</span>
              <span style={{ fontSize: '0.85rem' }}>#{order.buyer_id}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ color: '#64748b' }}>Seller ID</span>
              <span style={{ fontSize: '0.85rem' }}>#{order.seller_id}</span>
            </div>

            {/* Actions for Seller */}
            {isSeller && (
              <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {orderStatus === 'PENDING' && (
                  <button type="button" className="btn-primary" onClick={handleAccept}>
                    Accept Order
                  </button>
                )}
                {orderStatus === 'CONFIRMED' && (
                  <button type="button" className="btn-primary" style={{ background: '#0284c7' }} onClick={handleStart}>
                    Start Work
                  </button>
                )}
                {(orderStatus === 'IN_PROGRESS' || orderStatus === 'REVISION_REQUESTED') && (
                  <button type="button" className="btn-primary" style={{ background: '#16a34a' }} onClick={() => setShowDeliverModal(true)}>
                    Deliver Completed Work
                  </button>
                )}
                {['PENDING', 'CONFIRMED'].includes(orderStatus) && (
                  <button type="button" className="btn-secondary" style={{ color: '#dc2626' }} onClick={handleCancel}>
                    Cancel Order
                  </button>
                )}
              </div>
            )}

            {/* Actions for Buyer */}
            {isBuyer && (
              <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {orderStatus === 'DELIVERED' && (
                  <>
                    <button type="button" className="btn-primary" style={{ background: '#16a34a' }} onClick={() => setShowReviewModal(true)}>
                      Accept &amp; Complete Order
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => setShowRevisionModal(true)}>
                      Request Revision
                    </button>
                  </>
                )}
                {['PENDING', 'CONFIRMED', 'IN_PROGRESS'].includes(orderStatus) && (
                  <button type="button" className="btn-secondary" style={{ color: '#dc2626' }} onClick={handleCancel}>
                    Cancel Order
                  </button>
                )}
              </div>
            )}

            {isAdmin && orderStatus !== 'CANCELLED' && orderStatus !== 'COMPLETED' && (
              <div style={{ marginTop: '16px' }}>
                <button type="button" className="btn-secondary" style={{ width: '100%', color: '#dc2626' }} onClick={handleCancel}>
                  Cancel as Admin
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Deliver Modal */}
      {showDeliverModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '500px', width: '100%', padding: '28px' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>Deliver Work for Order #{order.id}</h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px' }}>
              Enter message, delivery notes, or links for the buyer.
            </p>
            <form onSubmit={handleDeliver}>
              <div style={{ marginBottom: '16px' }}>
                <textarea
                  rows="4"
                  className="form-textarea"
                  placeholder="Here are your finished files..."
                  value={deliveryMessage}
                  onChange={(e) => setDeliveryMessage(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-secondary" disabled={isSubmitting} onClick={() => setShowDeliverModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Submit Delivery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Revision Modal */}
      {showRevisionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '500px', width: '100%', padding: '28px' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>Request a Revision</h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px' }}>
              Detail what changes or corrections you would like the seller to make.
            </p>
            <form onSubmit={handleRevision}>
              <div style={{ marginBottom: '16px' }}>
                <textarea
                  rows="4"
                  className="form-textarea"
                  placeholder="Please adjust the colors in the title slide and revise the audio levels..."
                  value={revisionNote}
                  onChange={(e) => setRevisionNote(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-secondary" disabled={isSubmitting} onClick={() => setShowRevisionModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Send Revision Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', maxWidth: '500px', width: '100%', padding: '28px' }}>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '8px' }}>Complete Order &amp; Leave Review</h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '16px' }}>
              Rate your experience with this seller to finalize the order.
            </p>
            <form onSubmit={handleCompleteAndReview}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Rating</label>
                <select className="form-input" value={rating} onChange={(e) => setRating(e.target.value)}>
                  <option value="5">★★★★★ (5 - Excellent)</option>
                  <option value="4">★★★★☆ (4 - Good)</option>
                  <option value="3">★★★☆☆ (3 - Average)</option>
                  <option value="2">★★☆☆☆ (2 - Poor)</option>
                  <option value="1">★☆☆☆☆ (1 - Terrible)</option>
                </select>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>Feedback Comments</label>
                <textarea
                  rows="3"
                  className="form-textarea"
                  placeholder="Share details about the quality, turnaround time, and communication..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn-secondary" disabled={isSubmitting} onClick={() => setShowReviewModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting...' : 'Complete &amp; Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

