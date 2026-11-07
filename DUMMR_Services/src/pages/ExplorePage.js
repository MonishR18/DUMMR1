import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchServices } from '../api';

const fallbackListingServices = [
  {
    id: 1,
    title: 'I will build your responsive website with React & Tailwind',
    description: 'Clean, modern, and accessible website development.',
    rating: 4.9,
    review_count: 124,
    price: 30,
    seller: { name: 'John Studio', initials: 'JS', bg: '#3b82f6' },
  },
  {
    id: 2,
    title: 'I will develop responsive React web applications',
    description: 'Production-ready web apps with clean architecture and testing.',
    rating: 4.8,
    review_count: 95,
    price: 45,
    seller: { name: 'Emma Web', initials: 'EW', bg: '#7c3aed' },
  },
  {
    id: 3,
    title: 'I will create custom Python scripts and automation bots',
    description: 'Fast, reliable web scrapers, data pipelines, and automation tools.',
    rating: 5.0,
    review_count: 230,
    price: 35,
    seller: { name: 'Dev Kevin', initials: 'DK', bg: '#ef4444' },
  },
  {
    id: 4,
    title: 'I will create a cinematic 4K promotional video',
    description: 'Video production, color grading, sound design, and motion effects.',
    rating: 4.9,
    review_count: 142,
    price: 60,
    seller: { name: 'Alex Motion', initials: 'AM', bg: '#10b981' },
  },
  {
    id: 5,
    title: 'I will design a unique brand identity and logo system',
    description: 'Vector logos, brand guidelines, stationery, and social media kits.',
    rating: 4.9,
    review_count: 188,
    price: 40,
    seller: { name: 'Priya Design', initials: 'PD', bg: '#f59e0b' },
  },
  {
    id: 6,
    title: 'I will fine-tune and integrate custom AI models & LLMs',
    description: 'RAG pipelines, custom agents, and OpenAI/Gemini integrations.',
    rating: 5.0,
    review_count: 77,
    price: 80,
    seller: { name: 'Sarah Tech', initials: 'ST', bg: '#6366f1' },
  },
];

export default function ExplorePage({ onNotice }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentCategory = searchParams.get('category') || 'All';
  const currentQuery = searchParams.get('q') || '';
  const currentSort = searchParams.get('sort') || 'recommended';

  const [searchInput, setSearchInput] = useState(currentQuery);
  const [services, setServices] = useState(fallbackListingServices);
  const [isLoading, setIsLoading] = useState(true);
  const [priceFilter, setPriceFilter] = useState('');
  const [page, setPage] = useState(1);

  // Sync search input if query param changes externally
  useEffect(() => {
    setSearchInput(currentQuery);
  }, [currentQuery]);

  useEffect(() => {
    let isMounted = true;
    const loadServices = async () => {
      setIsLoading(true);
      try {
        const queryParams = {
          q: currentQuery || undefined,
          category: currentCategory !== 'All' ? currentCategory : undefined,
          sort: currentSort,
          page,
          limit: 12,
        };

        if (priceFilter === 'under25') queryParams.max_price = 25;
        if (priceFilter === '25to50') {
          queryParams.min_price = 25;
          queryParams.max_price = 50;
        }
        if (priceFilter === '50to100') {
          queryParams.min_price = 50;
          queryParams.max_price = 100;
        }

        const res = await fetchServices(queryParams);
        const list = Array.isArray(res) ? res : res?.data || [];

        if (isMounted) {
          if (list.length > 0) {
            const mapped = list.map((item) => ({
              id: item.id,
              title: item.title,
              description: item.description,
              rating: Number(item.rating_avg || item.rating || 5.0),
              review_count: Number(item.review_count || 0),
              price: Number(item.packages?.[0]?.price || item.price || 30),
              seller: {
                name: item.seller?.name || item.seller?.username || 'DUMMR Seller',
                initials: (item.seller?.name || item.seller?.username || 'DS').substring(0, 2).toUpperCase(),
                bg: '#3b82f6',
              },
            }));
            setServices(mapped);
          } else {
            // If backend returned empty list, filter the fallback list locally by category / query
            let filtered = fallbackListingServices;
            if (currentCategory !== 'All') {
              filtered = filtered.filter((s) =>
                s.title.toLowerCase().includes(currentCategory.toLowerCase()) ||
                s.description.toLowerCase().includes(currentCategory.toLowerCase())
              );
            }
            if (currentQuery) {
              const q = currentQuery.toLowerCase();
              filtered = filtered.filter((s) =>
                s.title.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q)
              );
            }
            setServices(filtered.length > 0 ? filtered : fallbackListingServices);
          }
        }
      } catch (err) {
        if (isMounted) {
          setServices(fallbackListingServices);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadServices();
    return () => {
      isMounted = false;
    };
  }, [currentCategory, currentQuery, currentSort, priceFilter, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      newParams.set('q', searchInput.trim());
    } else {
      newParams.delete('q');
    }
    setSearchParams(newParams);
  };

  const handleCategoryChange = (cat) => {
    const newParams = new URLSearchParams(searchParams);
    if (cat === 'All') {
      newParams.delete('category');
    } else {
      newParams.set('category', cat);
    }
    setSearchParams(newParams);
  };

  const handleSortChange = (e) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('sort', e.target.value);
    setSearchParams(newParams);
  };

  const handleLoadMore = () => {
    if (onNotice) onNotice('Loaded more services.');
    setPage((prev) => prev + 1);
  };

  const categories = ['All', 'Design', 'Video', 'Programming', 'AI', 'Writing'];

  return (
    <div className="listing-section">
      <form className="listing-search-row" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          className="listing-search-input"
          placeholder="Search services..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button type="submit" className="btn-primary">
          Search
        </button>
      </form>

      <div className="listing-category-tabs">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`cat-tab ${currentCategory === cat ? 'active' : ''}`}
            onClick={() => handleCategoryChange(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="listing-header-row">
        <h1 className="page-title">
          {currentCategory === 'All' ? 'All Services' : `${currentCategory} Services`}
        </h1>
        <div className="sort-container">
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Sort:
          </span>
          <select className="sort-select" value={currentSort} onChange={handleSortChange}>
            <option value="recommended">Recommended</option>
            <option value="best-selling">Best Selling</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>

      <div className="listing-body-layout">
        <aside className="filters-sidebar">
          <div className="filter-group">
            <h3 className="filter-group-title">Price</h3>
            <label className="filter-option">
              <input
                type="radio"
                name="price"
                checked={priceFilter === ''}
                onChange={() => setPriceFilter('')}
              /> All Prices
            </label>
            <label className="filter-option">
              <input
                type="radio"
                name="price"
                checked={priceFilter === 'under25'}
                onChange={() => setPriceFilter('under25')}
              /> Under $25
            </label>
            <label className="filter-option">
              <input
                type="radio"
                name="price"
                checked={priceFilter === '25to50'}
                onChange={() => setPriceFilter('25to50')}
              /> $25–$50
            </label>
            <label className="filter-option">
              <input
                type="radio"
                name="price"
                checked={priceFilter === '50to100'}
                onChange={() => setPriceFilter('50to100')}
              /> $50–$100
            </label>
          </div>

          <div className="filter-group">
            <h3 className="filter-group-title">Delivery Time</h3>
            <label className="filter-option">
              <input type="checkbox" defaultChecked /> Any Time
            </label>
            <label className="filter-option">
              <input type="checkbox" /> Up to 24 Hours
            </label>
            <label className="filter-option">
              <input type="checkbox" /> Up to 3 Days
            </label>
            <label className="filter-option">
              <input type="checkbox" /> Up to 7 Days
            </label>
          </div>

          <div className="filter-group">
            <h3 className="filter-group-title">Seller Level</h3>
            <label className="filter-option">
              <input type="checkbox" defaultChecked /> Top Rated
            </label>
            <label className="filter-option">
              <input type="checkbox" /> Verified Independent
            </label>
          </div>
        </aside>

        <div>
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
              Loading services...
            </div>
          ) : services.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
              No services found matching your criteria.
            </div>
          ) : (
            <div className="services-grid">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="service-card"
                  onClick={() => navigate(`/services/${service.id}`)}
                >
                  <div className="service-card-image" style={{ background: '#e2e8f0' }}>
                    <span>💼 Service</span>
                  </div>
                  <div className="service-card-body">
                    <div className="service-card-seller-info">
                      <div className="mini-avatar" style={{ background: service.seller?.bg || '#3b82f6' }}>
                        {service.seller?.initials || 'DS'}
                      </div>
                      <span className="seller-name-small">{service.seller?.name || 'DUMMR Seller'}</span>
                    </div>
                    <h2 className="service-card-title">
                      {service.title}
                    </h2>
                    <div className="service-card-rating">
                      <span className="rating-star">★ {Number(service.rating || 5.0).toFixed(1)}</span>
                      <span style={{ color: 'var(--text-muted)' }}>({service.review_count || 0})</span>
                    </div>
                    <div className="service-card-footer">
                      <span className="price-label">Starting at</span>
                      <span className="price-amount">${Number(service.price || 25)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="load-more-row">
            <button
              type="button"
              className="btn-secondary"
              onClick={handleLoadMore}
            >
              Load More
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
