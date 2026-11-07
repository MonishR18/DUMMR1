import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchServices } from '../api';

const fallbackServices = [
  {
    id: 1,
    title: 'I will design a modern minimalist brand identity and logo',
    description: 'Brand identity and logo design for startups and personal brands.',
    rating: 4.9,
    review_count: 124,
    price: 25,
    seller: { name: 'John Studio', id: 1 },
  },
  {
    id: 2,
    title: 'I will create a cinematic 4K promotional commercial video',
    description: 'Short-form commercial and campaign footage for brands.',
    rating: 4.8,
    review_count: 86,
    price: 40,
    seller: { name: 'Alex Motion', id: 2 },
  },
  {
    id: 3,
    title: 'I will build your responsive React and Node web application',
    description: 'Full-stack development for web platforms and internal tools.',
    rating: 5.0,
    review_count: 215,
    price: 30,
    seller: { name: 'Sarah Tech', id: 3 },
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [services, setServices] = useState(fallbackServices);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const loadFeatured = async () => {
      try {
        const response = await fetchServices({ limit: 6 });
        const list = Array.isArray(response) ? response : response?.data || [];
        if (isMounted && list.length > 0) {
          const mapped = list.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            rating: Number(item.rating_avg || item.rating || 5.0),
            review_count: Number(item.review_count || 0),
            price: Number(item.packages?.[0]?.price || item.price || 25),
            seller: item.seller || { name: 'DUMMR Seller', id: item.seller_id },
          }));
          setServices(mapped);
        }
      } catch (err) {
        // Fallback already set
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadFeatured();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explore?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/explore');
    }
  };

  const handleCategoryClick = (cat) => {
    navigate(`/explore?category=${encodeURIComponent(cat)}`);
  };

  const handlePopularClick = (term) => {
    navigate(`/explore?q=${encodeURIComponent(term)}`);
  };

  return (
    <div className="home-section">
      <div className="hero-search-banner">
        <div className="hero-eyebrow-pill" onClick={() => navigate('/explore')}>
          <span className="pill-chip">New</span>
          <span className="pill-text">Own your expertise. Earn your value.</span>
          <span className="pill-arrow">→</span>
        </div>
        <h1 className="hero-title">
          Own your expertise.<br />
          <span>Earn your value.</span>
        </h1>
        <p className="hero-subtitle">
          A one-stop platform for independent service providing — storefronts, bookings, invoicing, and client management on your terms.
        </p>
        <form className="hero-search-box" onSubmit={handleSearch}>
          <input
            type="text"
            className="hero-search-input"
            placeholder="Search independent services, storefronts, or skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="hero-search-btn">
            Search
          </button>
        </form>
      </div>

      <div className="categories-shortcuts-row">
        <h2 className="section-heading">Categories</h2>
        <div className="category-pills">
          {['Design', 'Video', 'Programming', 'AI', 'Writing'].map((cat) => (
            <button
              key={cat}
              type="button"
              className="category-pill-btn"
              onClick={() => handleCategoryClick(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '48px' }}>
        <h2 className="section-heading">Featured Services</h2>
        <div className="services-grid">
          {isLoading ? (
            <div className="service-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '220px' }}>
              <span>Loading services from DUMMR...</span>
            </div>
          ) : (
            services.slice(0, 6).map((service) => (
              <div
                key={service.id}
                className="service-card"
                onClick={() => navigate(`/services/${service.id}`)}
              >
                <div className="service-card-image" style={{ background: '#e0f2fe' }}>
                  <span>💼 Service</span>
                </div>
                <div className="service-card-body">
                  <div className="service-card-seller-info">
                    <div className="mini-avatar">{(service.seller?.name || 'DS').substring(0, 2).toUpperCase()}</div>
                    <span className="seller-name-small">{service.seller?.name || 'DUMMR Seller'}</span>
                  </div>
                  <h3 className="service-card-title">{service.title}</h3>
                  <div className="service-card-rating">
                    <span className="rating-star">★ {Number(service.rating || 0).toFixed(1)}</span>
                    <span style={{ color: 'var(--text-muted)' }}>({service.review_count || 0})</span>
                  </div>
                  <div className="service-card-footer">
                    <span className="price-label">Starting at</span>
                    <span className="price-amount">${Number(service.price || 0)}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="popular-services-row">
        <h2 className="section-heading" style={{ marginBottom: '16px' }}>
          Popular Services
        </h2>
        <div className="popular-chips">
          {['Website Development', 'Logo Design', 'Video Editing', 'Voice Over', 'Search Engine Optimization', 'AI Art & Prompts'].map((item) => (
            <span
              key={item}
              className="popular-chip"
              style={{ cursor: 'pointer' }}
              onClick={() => handlePopularClick(item)}
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="top-rated-row">
        <h2 className="section-heading">Top-Rated Freelancers</h2>
        <div className="freelancers-grid">
          <div className="freelancer-card">
            <div className="freelancer-avatar-lg" style={{ background: '#3b82f6' }}>
              JS
            </div>
            <h3 className="freelancer-name">John Studio</h3>
            <p className="freelancer-role">Video Editor &amp; Director</p>
            <span className="badge badge-toprated">Top Rated</span>
          </div>

          <div className="freelancer-card">
            <div className="freelancer-avatar-lg" style={{ background: '#10b981' }}>
              ST
            </div>
            <h3 className="freelancer-name">Sarah Tech</h3>
            <p className="freelancer-role">Full-Stack Engineer</p>
            <span className="badge badge-toprated">Top Rated</span>
          </div>

          <div className="freelancer-card">
            <div className="freelancer-avatar-lg" style={{ background: '#8b5cf6' }}>
              AD
            </div>
            <h3 className="freelancer-name">Alex Designs</h3>
            <p className="freelancer-role">UI/UX &amp; Brand Strategist</p>
            <span className="badge badge-toprated">Top Rated</span>
          </div>
        </div>
      </div>

      <div className="become-seller-banner">
        <div className="banner-text">
          <h3>Launch your Independent Storefront</h3>
          <p>
            Keep 100% of your earnings with automated booking, direct client relationships, and custom invoicing.
          </p>
        </div>
        <Link
          to="/seller/services/new"
          className="btn-primary"
          style={{ padding: '14px 28px', fontSize: '1.05rem', textDecoration: 'none', display: 'inline-block' }}
        >
          Create Storefront →
        </Link>
      </div>
    </div>
  );
}
