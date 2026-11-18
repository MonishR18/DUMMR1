import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  fetchServiceById,
  fetchCategories,
  updateService,
  publishService,
  pauseService,
  deleteService,
} from '../api';

export default function EditServicePage({ onNotice }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('PUBLISHED');

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [serviceData, catData] = await Promise.all([
        fetchServiceById(id),
        fetchCategories(),
      ]);

      if (Array.isArray(catData)) {
        setCategories(catData);
      }

      if (serviceData) {
        setTitle(serviceData.title || '');
        setSlug(serviceData.slug || '');
        setCategoryId(serviceData.category_id || (catData[0]?.id || ''));
        setDescription(serviceData.description || '');
        setStatus(serviceData.status?.toUpperCase() || 'PUBLISHED');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load service details.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await updateService(id, {
        title,
        slug,
        category_id: Number(categoryId),
        description,
      });

      if (onNotice) {
        onNotice('Service updated successfully!');
      }
      navigate('/seller/dashboard?tab=My%20Services');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update service.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePublish = async () => {
    try {
      if (status === 'PUBLISHED') {
        await pauseService(id);
        setStatus('PAUSED');
        if (onNotice) onNotice('Service paused.');
      } else {
        await publishService(id);
        setStatus('PUBLISHED');
        if (onNotice) onNotice('Service published!');
      }
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Action failed.');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this service storefront?')) return;
    try {
      await deleteService(id);
      if (onNotice) onNotice('Service deleted.');
      navigate('/seller/dashboard?tab=My%20Services');
    } catch (err) {
      if (onNotice) onNotice(err.message || 'Failed to delete service.');
    }
  };

  if (isLoading) {
    return <div style={{ padding: '80px', textAlign: 'center', color: '#64748b' }}>Loading service...</div>;
  }

  return (
    <div className="create-service-section">
      <div className="form-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <Link to="/seller/dashboard?tab=My%20Services" style={{ color: '#6366f1', textDecoration: 'none', fontSize: '0.9rem' }}>
              &larr; Back to My Services
            </Link>
            <h1 className="page-title" style={{ marginTop: '6px' }}>Edit Service Storefront</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleTogglePublish}
            >
              {status === 'PUBLISHED' ? '⏸ Pause Service' : '▶ Publish Service'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ color: '#dc2626', borderColor: '#fca5a5' }}
              onClick={handleDelete}
            >
              🗑 Delete
            </button>
          </div>
        </div>

        {errorMessage && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem' }}>
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Service Title</label>
            <input
              type="text"
              className="form-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Service Slug (URL identifier)</label>
            <input
              type="text"
              className="form-input"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-input"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Detailed Description</label>
            <textarea
              className="form-textarea"
              rows="6"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <Link to="/seller/dashboard?tab=My%20Services" className="btn-secondary" style={{ textDecoration: 'none' }}>
              Cancel
            </Link>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

