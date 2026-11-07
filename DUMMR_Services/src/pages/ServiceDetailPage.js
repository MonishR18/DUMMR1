import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { fetchServiceById, createOrder, toggleSaveService } from '../api';
import { useAuth } from '../context/AuthContext';

export default function ServiceDetailPage({ onNotice }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, isProvider } = useAuth();

  const [service, setService] = useState(null);
  const [selectedPackageTier, setSelectedPackageTier] = useState('standard');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  // Order Modal state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderRequirements, setOrderRequirements] = useState('');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderError, setOrderError] = useState('');

  useEffect(() => {
    let isMounted = true;
    const loadDetail = async () => {
      setIsLoading(true);
      try {
        const data = await fetchServiceById(id);
        if (isMounted && data) {
          setService(data);
        }
      } catch (err) {
        // Fallback default service data if ID doesn't exist in backend yet
        if (isMounted) {
          setService({
            id: Number(id) || 1,
            title: 'I will create a cinematic 4K video for your brand or campaign',
            description: 'I am a professional video director and editor with over 8 years of experience crafting commercials, short films, YouTube content, and corporate videos. Every video is produced in 4K resolution with custom color grading, sound design, and royalty-free background audio.',
            rating_avg: 4.9,
            review_count: 127,
            seller: {
              name: 'John Studio',
              initials: 'JS',
              rating: 4.9,
              completed_orders: '250+',
            },
            packages: [
              {
                id: 101,
                tier: 'basic',
                price: 25,
                delivery_days: 2,
                revisions: 1,
                features: ['Up to 1080p resolution output', '1 Revision included', 'Sound design & audio mastering'],
              },
              {
                id: 102,
                tier: 'standard',
                price: 60,
                delivery_days: 4,
                revisions: 3,
                features: ['Up to 4K resolution output', '3 Revisions included', 'Sound design & audio mastering', 'Custom color grading included'],
              },
              {
                id: 103,
                tier: 'premium',
                price: 120,
                delivery_days: 7,
                revisions: 99,
                features: ['Up to 4K resolution output', 'Unlimited Revisions', 'Sound design & audio mastering', 'Custom color grading included', 'Source project files included'],
              },
            ],
            reviews: [
              {
                id: 1,
                buyer_name: 'Michael C.',
                rating: 5,
                comment: 'Outstanding cinematic quality! John delivered ahead of schedule and the 4K grading looked phenomenal on our landing page.',
              },
              {
                id: 2,
                buyer_name: 'Anna R.',
                rating: 5,
                comment: 'Very communicative and took all revisions into account seamlessly. Highly recommended for any video project.',
              },
            ],
          });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadDetail();
    return () => {
      isMounted = false;
    };
  }, [id]);

  if (isLoading) {
    return (
      <div style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>
        Loading service details...
      </div>
    );
  }

  if (!service) {
    return (
      <div style={{ padding: '80px', textAlign: 'center' }}>
        <h2>Service not found</h2>
        <button type="button" className="btn-primary" onClick={() => navigate('/explore')}>
          Browse All Services
        </button>
      </div>
    );
  }

  // Find active package by tier
  const packagesList = service.packages && service.packages.length > 0
    ? service.packages
    : [
        { id: 101, tier: 'basic', price: 25, delivery_days: 2, revisions: 1, features: ['Basic delivery'] },
        { id: 102, tier: 'standard', price: 60, delivery_days: 4, revisions: 3, features: ['Standard delivery with revisions'] },
        { id: 103, tier: 'premium', price: 120, delivery_days: 7, revisions: 99, features: ['Full commercial delivery'] },
      ];

  const currentPkg = packagesList.find((p) => p.tier?.toLowerCase() === selectedPackageTier.toLowerCase()) || packagesList[0];

  const handleToggleSave = async () => {
    if (!currentUser) {
      navigate('/login', { state: { from: location } });
      return;
    }
    try {
      const res = await toggleSaveService(service.id);
      setIsSaved(res.saved);
      if (onNotice) {
        onNotice(res.saved ? 'Service saved to favorites!' : 'Service removed from favorites.');
      }
    } catch (err) {
      setIsSaved(!isSaved);
    }
  };

  const handleOrderClick = () => {
    if (!currentUser) {
      navigate('/login', { state: { from: location } });
      return;
    }
    if (isProvider) {
      if (onNotice) {
        onNotice('Providers cannot place orders. Please use a Client account.');
      } else {
        alert('Providers cannot place orders. Please use a Client account.');
      }
      return;
    }
    setShowOrderModal(true);
  };

  const handleConfirmOrder = async (e) => {
    e.preventDefault();
    setOrderError('');
    setIsPlacingOrder(true);

    try {
      await createOrder({
        service_id: service.id,
        package_id: currentPkg.id,
        requirements: orderRequirements,
      });

      setShowOrderModal(false);
      if (onNotice) {
        onNotice(`Order placed successfully for ${currentPkg.tier.toUpperCase()} package!`);
      }
      navigate('/buyer/dashboard?tab=Active%20Orders');
    } catch (err) {
      setOrderError(err.message || 'Failed to place order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const reviewsList = service.reviews && service.reviews.length > 0 ? service.reviews : [
    {
      id: 1,
      buyer_name: 'Michael C.',
      rating: 5,
      comment: 'Outstanding cinematic quality! Delivered ahead of schedule and the 4K grading looked phenomenal.',
    },
    {
      id: 2,
      buyer_name: 'Anna R.',
      rating: 5,
      comment: 'Very communicative and took all revisions into account seamlessly. Highly recommended!',
    },
  ];

  return (
    <div className="detail-section">
      <div className="detail-layout">
        <div className="service-main-col">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
            <h1 className="detail-service-title" style={{ flex: 1 }}>
              {service.title}
            </h1>
            <button
              type="button"
              className="btn-secondary"
              style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={handleToggleSave}
            >
              {isSaved ? '❤️ Saved' : '🤍 Save'}
            </button>
          </div>

          <div className="seller-header-bar">
            <div className="seller-avatar-large">
              {(service.seller?.name || service.seller?.username || 'JS').substring(0, 2).toUpperCase()}
            </div>
            <div className="seller-meta-info">
              <span className="seller-name-bold">{service.seller?.name || service.seller?.username || 'John Studio'}</span>
              <span className="seller-sub-meta">
                <span className="rating-star">★ {Number(service.rating_avg || 4.9).toFixed(1)}</span> • {service.review_count || 127}+ Orders Completed
              </span>
            </div>
            <span className="badge badge-toprated">Top Rated</span>
          </div>

          <div className="media-preview-box">
            <span className="media-preview-badge">4K Cinematic Preview</span>
            <div style={{ fontSize: '3rem', marginBottom: '8px' }}>▶</div>
            <p style={{ fontWeight: 600 }}>Interactive Video Player &amp; Gallery</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', margin: '16px 0' }}>
            <span className="rating-star">★ {Number(service.rating_avg || 4.9).toFixed(1)}</span>
            <span style={{ fontWeight: 700 }}>{service.review_count || reviewsList.length} Reviews</span>
          </div>

          <div className="content-block">
            <h2 className="block-title">About This Service</h2>
            <p className="block-text">
              {service.description}
            </p>
          </div>

          <div className="content-block">
            <h2 className="block-title">Reviews ({reviewsList.length})</h2>
            <div className="reviews-list">
              {reviewsList.map((rev, index) => (
                <div key={rev.id || index} className="review-item">
                  <div className="reviewer-header">
                    <div className="mini-avatar" style={{ background: '#0284c7' }}>
                      {(rev.buyer?.name || rev.buyer_name || 'CL').substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="reviewer-name">{rev.buyer?.name || rev.buyer_name || 'Client'}</div>
                      <span className="rating-star">{'★'.repeat(rev.rating || 5)}</span>
                    </div>
                  </div>
                  <p className="block-text">
                    "{rev.comment || 'Great experience working with this seller.'}"
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="content-block">
            <h2 className="block-title">Related Services</h2>
            <div className="services-grid" style={{ marginBottom: 0 }}>
              <div
                className="service-card"
                onClick={() => navigate('/explore?category=Video')}
              >
                <div className="service-card-image" style={{ height: '120px' }}>
                  <span>💼 Video</span>
                </div>
                <div className="service-card-body">
                  <h3 className="service-card-title" style={{ fontSize: '0.9rem' }}>
                    I will do YouTube video editing and color correction
                  </h3>
                  <div className="service-card-footer">
                    <span className="price-label">Starting at</span>
                    <span className="price-amount">$30</span>
                  </div>
                </div>
              </div>

              <div
                className="service-card"
                onClick={() => navigate('/explore?category=Design')}
              >
                <div className="service-card-image" style={{ height: '120px' }}>
                  <span>💼 Design</span>
                </div>
                <div className="service-card-body">
                  <h3 className="service-card-title" style={{ fontSize: '0.9rem' }}>
                    I will create custom motion graphics and logo intro
                  </h3>
                  <div className="service-card-footer">
                    <span className="price-label">Starting at</span>
                    <span className="price-amount">$50</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Package Selector Card */}
        <div>
          <div className="package-box">
            <div className="package-tabs">
              {['basic', 'standard', 'premium'].map((tier) => (
                <button
                  key={tier}
                  type="button"
                  className={`package-tab-btn ${selectedPackageTier === tier ? 'active' : ''}`}
                  onClick={() => setSelectedPackageTier(tier)}
                  style={{ textTransform: 'capitalize' }}
                >
                  {tier}
                </button>
              ))}
            </div>

            <div className="package-content">
              <div className="package-price-row">
                <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>
                  {currentPkg.tier || selectedPackageTier} Package
                </span>
                <span className="package-price">
                  ${currentPkg.price}
                </span>
              </div>

              <div className="package-delivery-row">
                <span>⏱ Delivery Time:</span>
                <span>{currentPkg.delivery_days} Days</span>
              </div>

              <div className="package-delivery-row">
                <span>🔄 Revisions:</span>
                <span>{currentPkg.revisions >= 50 ? 'Unlimited' : `${currentPkg.revisions} Revisions`}</span>
              </div>

              <ul className="package-features-list">
                {Array.isArray(currentPkg.features) && currentPkg.features.length > 0 ? (
                  currentPkg.features.map((feature, i) => (
                    <li key={i}>✓ {feature}</li>
                  ))
                ) : (
                  <>
                    <li>✓ High quality output deliverable</li>
                    <li>✓ {currentPkg.revisions} Revisions included</li>
                    <li>✓ Commercial usage rights</li>
                  </>
                )}
              </ul>

              <button
                type="button"
                className="btn-primary order-now-btn"
                onClick={handleOrderClick}
              >
                Order Now (${currentPkg.price})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Order Placement Modal */}
      {showOrderModal && (
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
              maxWidth: '520px',
              width: '100%',
              padding: '32px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
            }}
          >
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>
              Confirm Your Order
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px' }}>
              You are ordering the <strong>{currentPkg.tier.toUpperCase()}</strong> package for <strong>${currentPkg.price}</strong>.
            </p>

            {orderError && (
              <div
                style={{
                  background: '#fee2e2',
                  color: '#991b1b',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  marginBottom: '16px',
                }}
              >
                {orderError}
              </div>
            )}

            <form onSubmit={handleConfirmOrder}>
              <div style={{ marginBottom: '20px' }}>
                <label
                  htmlFor="order-req"
                  style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}
                >
                  Project Requirements &amp; Instructions
                </label>
                <textarea
                  id="order-req"
                  rows="4"
                  className="form-textarea"
                  placeholder="Describe your project, reference links, format requirements, brand guidelines..."
                  value={orderRequirements}
                  onChange={(e) => setOrderRequirements(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isPlacingOrder}
                  onClick={() => setShowOrderModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isPlacingOrder}
                >
                  {isPlacingOrder ? 'Processing Order...' : `Pay & Place Order ($${currentPkg.price})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
