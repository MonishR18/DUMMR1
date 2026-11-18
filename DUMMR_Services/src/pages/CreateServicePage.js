import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchCategories,
  createService,
  createServicePackage,
  publishService,
  uploadFile,
  addServiceMedia,
} from '../api';

export default function CreateServicePage({ onNotice }) {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [categories, setCategories] = useState([]);
  const [isLoadingCats, setIsLoadingCats] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form Fields
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugCustomized, setIsSlugCustomized] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');

  // Media upload state
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Packages state
  const [basicPrice, setBasicPrice] = useState(25);
  const [basicDelivery, setBasicDelivery] = useState(2);
  const [basicRevisions, setBasicRevisions] = useState(1);

  const [stdPrice, setStdPrice] = useState(60);
  const [stdDelivery, setStdDelivery] = useState(4);
  const [stdRevisions, setStdRevisions] = useState(3);

  const [premPrice, setPremPrice] = useState(120);
  const [premDelivery, setPremDelivery] = useState(7);
  const [premRevisions, setPremRevisions] = useState(99);

  useEffect(() => {
    let isMounted = true;
    const loadCats = async () => {
      try {
        const data = await fetchCategories();
        if (isMounted && Array.isArray(data) && data.length > 0) {
          setCategories(data);
          setCategoryId(data[0].id);
        } else if (isMounted) {
          const fallback = [
            { id: 1, name: 'Design' },
            { id: 2, name: 'Video' },
            { id: 3, name: 'Programming' },
            { id: 4, name: 'AI' },
            { id: 5, name: 'Writing' },
          ];
          setCategories(fallback);
          setCategoryId(fallback[0].id);
        }
      } catch (err) {
        if (isMounted) {
          const fallback = [
            { id: 1, name: 'Design' },
            { id: 2, name: 'Video' },
            { id: 3, name: 'Programming' },
            { id: 4, name: 'AI' },
            { id: 5, name: 'Writing' },
          ];
          setCategories(fallback);
          setCategoryId(fallback[0].id);
        }
      } finally {
        if (isMounted) setIsLoadingCats(false);
      }
    };

    loadCats();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleTitleChange = (e) => {
    const val = e.target.value;
    setTitle(val);
    if (!isSlugCustomized) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setSlug(generated);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setMediaPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setMediaPreview('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const finalSlug = slug.trim() || undefined;
      const createdService = await createService({
        title,
        slug: finalSlug,
        description,
        category_id: Number(categoryId) || undefined,
      });

      const serviceId = createdService.id;

      // Handle media upload if selected
      if (mediaFile) {
        setIsUploadingMedia(true);
        try {
          const uploadRes = await uploadFile(mediaFile, 'media');
          if (uploadRes?.url) {
            await addServiceMedia(serviceId, {
              media_type: mediaFile.type.startsWith('video/') ? 'video' : 'image',
              url: uploadRes.url,
            });
          }
        } catch (mediaErr) {
          console.warn('Media upload non-fatal failure:', mediaErr);
        } finally {
          setIsUploadingMedia(false);
        }
      }

      // Create packages with name & JSON string features
      await Promise.allSettled([
        createServicePackage(serviceId, {
          name: 'Basic',
          tier: 'basic',
          price: Number(basicPrice),
          delivery_days: Number(basicDelivery),
          revisions: Number(basicRevisions),
          features: JSON.stringify(['Basic deliverable', `${basicRevisions} Revision`]),
        }),
        createServicePackage(serviceId, {
          name: 'Standard',
          tier: 'standard',
          price: Number(stdPrice),
          delivery_days: Number(stdDelivery),
          revisions: Number(stdRevisions),
          features: JSON.stringify(['Standard deliverable', `${stdRevisions} Revisions`, 'High resolution']),
        }),
        createServicePackage(serviceId, {
          name: 'Premium',
          tier: 'premium',
          price: Number(premPrice),
          delivery_days: Number(premDelivery),
          revisions: Number(premRevisions),
          features: JSON.stringify(['Full commercial deliverable', 'Source project files', 'Priority support']),
        }),
      ]);

      // Publish service
      try {
        await publishService(serviceId);
      } catch (publishErr) {
        // Status may already be published or updated
      }

      if (onNotice) {
        onNotice('Service published successfully!');
      }
      navigate('/seller/dashboard?tab=My%20Services');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to publish service. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="create-service-section">
      <div className="form-card">
        <h1 className="page-title" style={{ marginBottom: '24px' }}>
          Create a Service Storefront
        </h1>

        {errorMessage && (
          <div
            style={{
              background: '#fee2e2',
              color: '#991b1b',
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '0.9rem',
              marginBottom: '20px',
            }}
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="service-title-input" className="form-label">
              Service Title
            </label>
            <input
              id="service-title-input"
              type="text"
              className="form-input"
              placeholder="I will do something I am really good at..."
              value={title}
              onChange={handleTitleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="service-slug-input" className="form-label">
              Service Slug (URL Identifier)
            </label>
            <input
              id="service-slug-input"
              type="text"
              className="form-input"
              placeholder="e.g. i-will-create-4k-video"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setIsSlugCustomized(true);
              }}
            />
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Auto-generated from your title. Leave as is or customize.
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="service-cat-select" className="form-label">
              Category
            </label>
            <select
              id="service-cat-select"
              className="form-select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={isLoadingCats}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="service-desc-input" className="form-label">
              Description
            </label>
            <textarea
              id="service-desc-input"
              className="form-textarea"
              rows="5"
              placeholder="Describe your service in detail: what you offer, what tools you use, your workflow, and what the buyer receives..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <span className="form-label">Gallery &amp; Media Cover</span>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
              onChange={handleFileSelect}
            />
            <div className="gallery-dropzone-row">
              <div
                className="dropzone-box"
                style={{ cursor: 'pointer', border: mediaFile ? '2px solid #6366f1' : '2px dashed #cbd5e1' }}
                onClick={() => fileInputRef.current?.click()}
              >
                {mediaPreview ? (
                  <img
                    src={mediaPreview}
                    alt="Media Preview"
                    style={{ maxHeight: '90px', borderRadius: '8px', objectFit: 'cover' }}
                  />
                ) : (
                  <>
                    <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>📷</div>
                    <span className="btn-secondary">
                      {mediaFile ? mediaFile.name : '+ Upload Cover Media'}
                    </span>
                  </>
                )}
              </div>
            </div>
            {mediaFile && (
              <span style={{ fontSize: '0.8rem', color: '#16a34a', marginTop: '6px', display: 'block' }}>
                Selected: {mediaFile.name} ({(mediaFile.size / (1024 * 1024)).toFixed(2)} MB)
              </span>
            )}
          </div>

          <div className="form-group">
            <span className="form-label">Pricing Packages</span>
            <div className="packages-editor-grid">
              {/* Basic Package */}
              <div className="package-editor-card">
                <div className="package-editor-title">Basic Tier</div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Price ($)</label>
                <input
                  type="number"
                  className="form-input"
                  min="5"
                  value={basicPrice}
                  onChange={(e) => setBasicPrice(e.target.value)}
                  style={{ marginBottom: '12px' }}
                  required
                />

                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Delivery (Days)</label>
                <select
                  className="form-select"
                  value={basicDelivery}
                  onChange={(e) => setBasicDelivery(e.target.value)}
                  style={{ marginBottom: '12px' }}
                >
                  <option value="1">1 Day</option>
                  <option value="2">2 Days</option>
                  <option value="3">3 Days</option>
                  <option value="5">5 Days</option>
                </select>

                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Revisions</label>
                <select
                  className="form-select"
                  value={basicRevisions}
                  onChange={(e) => setBasicRevisions(e.target.value)}
                >
                  <option value="1">1 Revision</option>
                  <option value="2">2 Revisions</option>
                  <option value="3">3 Revisions</option>
                </select>
              </div>

              {/* Standard Package */}
              <div className="package-editor-card">
                <div className="package-editor-title">Standard Tier</div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Price ($)</label>
                <input
                  type="number"
                  className="form-input"
                  min="10"
                  value={stdPrice}
                  onChange={(e) => setStdPrice(e.target.value)}
                  style={{ marginBottom: '12px' }}
                  required
                />

                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Delivery (Days)</label>
                <select
                  className="form-select"
                  value={stdDelivery}
                  onChange={(e) => setStdDelivery(e.target.value)}
                  style={{ marginBottom: '12px' }}
                >
                  <option value="2">2 Days</option>
                  <option value="3">3 Days</option>
                  <option value="4">4 Days</option>
                  <option value="7">7 Days</option>
                </select>

                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Revisions</label>
                <select
                  className="form-select"
                  value={stdRevisions}
                  onChange={(e) => setStdRevisions(e.target.value)}
                >
                  <option value="2">2 Revisions</option>
                  <option value="3">3 Revisions</option>
                  <option value="5">5 Revisions</option>
                </select>
              </div>

              {/* Premium Package */}
              <div className="package-editor-card">
                <div className="package-editor-title">Premium Tier</div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Price ($)</label>
                <input
                  type="number"
                  className="form-input"
                  min="20"
                  value={premPrice}
                  onChange={(e) => setPremPrice(e.target.value)}
                  style={{ marginBottom: '12px' }}
                  required
                />

                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Delivery (Days)</label>
                <select
                  className="form-select"
                  value={premDelivery}
                  onChange={(e) => setPremDelivery(e.target.value)}
                  style={{ marginBottom: '12px' }}
                >
                  <option value="5">5 Days</option>
                  <option value="7">7 Days</option>
                  <option value="10">10 Days</option>
                  <option value="14">14 Days</option>
                </select>

                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Revisions</label>
                <select
                  className="form-select"
                  value={premRevisions}
                  onChange={(e) => setPremRevisions(e.target.value)}
                >
                  <option value="5">5 Revisions</option>
                  <option value="10">10 Revisions</option>
                  <option value="99">Unlimited Revisions</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-actions-row">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/seller/dashboard')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || isUploadingMedia}
            >
              {isSubmitting ? 'Publishing Service...' : 'Publish Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
