import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './AuthPage.css';
import { useAuth } from './context/AuthContext';
import { forgotPassword } from './api';

export default function AuthPage({ initialMode = 'signin', onAuthSuccess, onBack }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register } = useAuth();

  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSubmitted, setForgotSubmitted] = useState(false);

  // Form Fields
  const [role, setRole] = useState('provider'); // 'provider' | 'client'
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [specialty, setSpecialty] = useState('Web & Software Development');
  const [rememberMe, setRememberMe] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(true);

  // Calculate password strength
  const getPasswordStrength = (pwd) => {
    if (!pwd) return { score: 0, text: 'None', class: '' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 1) return { score: 1, text: 'Weak', class: 'active-weak' };
    if (score === 2) return { score: 2, text: 'Fair', class: 'active-fair' };
    if (score === 3) return { score: 3, text: 'Good', class: 'active-good' };
    return { score: 4, text: 'Strong', class: 'active-strong' };
  };

  const strength = getPasswordStrength(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    if (isSignUp) {
      if (!fullName) {
        setErrorMsg('Please enter your full name.');
        return;
      }
      if (password.length < 8) {
        setErrorMsg('Password must be at least 8 characters long.');
        return;
      }
      if (!agreeTerms) {
        setErrorMsg('Please agree to the Terms of Service to continue.');
        return;
      }
    }

    setIsLoading(true);

    try {
      const generatedUsername = username || email.split('@')[0];
      let userProfile;

      if (isSignUp) {
        userProfile = await register({
          fullName,
          username: generatedUsername,
          email,
          password,
          role,
          specialty,
        });
      } else {
        userProfile = await login({
          username: email,
          password,
        });
      }

      if (onAuthSuccess) {
        onAuthSuccess(userProfile, isSignUp ? 'signup' : 'signin');
      }

      const returnPath = location.state?.from?.pathname || (userProfile.role === 'provider' ? '/seller/dashboard' : '/');
      navigate(returnPath, { replace: true });
    } catch (err) {
      setErrorMsg(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotLoading(true);
    try {
      await forgotPassword(forgotEmail);
      setForgotSubmitted(true);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to send reset link.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleBackToHome = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/');
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-card-container">
        
        {/* Left Hero Sidebar */}
        <div className="auth-sidebar-hero">
          <div>
            <div className="auth-brand-badge" onClick={handleBackToHome} style={{ cursor: 'pointer' }}>
              <svg width="18" height="14" viewBox="0 0 27 17" fill="none">
                <ellipse cx="13.25" cy="8.4" rx="13.2" ry="2.9" transform="rotate(-25 13.25 8.4)" stroke="currentColor" strokeWidth="1.25"/>
                <circle cx="13.25" cy="8.4" r="8.8" fill="#0f172a"/>
                <circle cx="13.25" cy="8.4" r="8.1" fill="currentColor"/>
              </svg>
              <span>DUMMR SERVICES</span>
            </div>

            <div className="auth-hero-main">
              <div className="auth-hero-tagline">Independent Service Platform</div>
              <h2>Where independent craft meets real client demand.</h2>
              <p>
                Join thousands of verified developers, designers, and consultants building profitable independent service businesses.
              </p>
            </div>
          </div>

          <div className="auth-features-list">
            <div className="auth-feature-row">
              <div className="auth-feature-icon">🛡️</div>
              <div className="auth-feature-info">
                <h4>Verified Reviews & Escrow</h4>
                <p>Funds are secured on milestone completion with zero chargeback risk.</p>
              </div>
            </div>
            <div className="auth-feature-row">
              <div className="auth-feature-icon">⚡</div>
              <div className="auth-feature-info">
                <h4>Instant Milestone Payouts</h4>
                <p>Direct bank transfers and Razorpay/Stripe automated settlement.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Form Pane */}
        <div className="auth-form-pane">
          <div className="auth-header-actions">
            <div>
              <h3>{isSignUp ? 'Create your account' : 'Welcome back'}</h3>
              <p>
                {isSignUp
                  ? 'Start publishing services or hire top independent providers.'
                  : 'Enter your credentials to access your dashboard.'}
              </p>
            </div>
            <div className="auth-tab-switch">
              <button
                type="button"
                className={`auth-tab-btn ${!isSignUp ? 'active' : ''}`}
                onClick={() => {
                  setIsSignUp(false);
                  setErrorMsg('');
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-tab-btn ${isSignUp ? 'active' : ''}`}
                onClick={() => {
                  setIsSignUp(true);
                  setErrorMsg('');
                }}
              >
                Register
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="auth-alert-banner">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Role Chooser on Sign-Up */}
            {isSignUp && (
              <div className="auth-field-group">
                <label className="auth-label">I want to</label>
                <div className="auth-role-grid">
                  <div
                    className={`auth-role-card ${role === 'provider' ? 'selected' : ''}`}
                    onClick={() => setRole('provider')}
                  >
                    <div className="auth-role-radio" />
                    <div>
                      <div className="auth-role-title">Offer Services</div>
                      <div className="auth-role-desc">Publish gigs, take orders, get paid</div>
                    </div>
                  </div>
                  <div
                    className={`auth-role-card ${role === 'client' ? 'selected' : ''}`}
                    onClick={() => setRole('client')}
                  >
                    <div className="auth-role-radio" />
                    <div>
                      <div className="auth-role-title">Hire Talent</div>
                      <div className="auth-role-desc">Order services, message pros</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sign Up Fields */}
            {isSignUp && (
              <>
                <div className="auth-field-row">
                  <div className="auth-field-group">
                    <label className="auth-label">Full Name</label>
                    <input
                      type="text"
                      className="auth-input"
                      style={{ paddingLeft: '14px' }}
                      placeholder="e.g. Sarah Chen"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="auth-field-group">
                    <label className="auth-label">Username</label>
                    <input
                      type="text"
                      className="auth-input"
                      style={{ paddingLeft: '14px' }}
                      placeholder="e.g. sarahchen"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </div>
                </div>

                {role === 'provider' && (
                  <div className="auth-field-group">
                    <label className="auth-label">Primary Specialty / Expertise</label>
                    <input
                      type="text"
                      className="auth-input"
                      style={{ paddingLeft: '14px' }}
                      placeholder="e.g. React & Node Full-Stack"
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                    />
                  </div>
                )}
              </>
            )}

            {/* Email Field */}
            <div className="auth-field-group">
              <label className="auth-label">Email Address</label>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">✉️</span>
                <input
                  type="email"
                  className="auth-input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="auth-field-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="auth-label">Password</label>
                {!isSignUp && (
                  <button
                    type="button"
                    className="auth-forgot-link"
                    onClick={() => {
                      setShowForgotModal(true);
                      setForgotSubmitted(false);
                      setForgotEmail(email);
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="auth-input-wrapper">
                <span className="auth-input-icon">🔒</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="auth-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              {/* Password Strength Meter (Sign-up only) */}
              {isSignUp && password && (
                <div className="auth-strength-container">
                  <div className="auth-strength-bars">
                    <div className={`auth-strength-bar ${strength.score >= 1 ? strength.class : ''}`} />
                    <div className={`auth-strength-bar ${strength.score >= 2 ? strength.class : ''}`} />
                    <div className={`auth-strength-bar ${strength.score >= 3 ? strength.class : ''}`} />
                    <div className={`auth-strength-bar ${strength.score >= 4 ? strength.class : ''}`} />
                  </div>
                  <div className="auth-strength-text">
                    Password strength: <strong>{strength.text}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Terms / Remember Me */}
            <div className="auth-remember-row">
              <label className="auth-checkbox-label">
                <input
                  type="checkbox"
                  checked={isSignUp ? agreeTerms : rememberMe}
                  onChange={(e) =>
                    isSignUp
                      ? setAgreeTerms(e.target.checked)
                      : setRememberMe(e.target.checked)
                  }
                />
                <span>
                  {isSignUp
                    ? 'I agree to the Terms of Service & Privacy Policy'
                    : 'Remember this device for 30 days'}
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="auth-submit-btn"
              disabled={isLoading}
            >
              {isLoading ? (
                <span>Connecting to DUMMR...</span>
              ) : isSignUp ? (
                <span>Create DUMMR Account →</span>
              ) : (
                <span>Sign in to Dashboard →</span>
              )}
            </button>
          </form>

          <div className="auth-terms-note">
            By signing up, you agree to DUMMR's independent contractor guidelines.
            Your storefront URL is uniquely reserved for your brand.
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="auth-modal-backdrop" onClick={() => setShowForgotModal(false)}>
          <div className="auth-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Reset your password</h3>
            {!forgotSubmitted ? (
              <form onSubmit={handleForgotSubmit}>
                <p>
                  Enter the email associated with your DUMMR account and we will send you a secure link to reset your password.
                </p>
                <div className="auth-field-group">
                  <label className="auth-label">Email address</label>
                  <input
                    type="email"
                    className="auth-input"
                    style={{ paddingLeft: '14px' }}
                    placeholder="you@domain.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="auth-modal-actions">
                  <button
                    type="button"
                    className="auth-tab-btn"
                    onClick={() => setShowForgotModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="auth-submit-btn"
                    style={{ width: 'auto', padding: '0 20px', marginTop: 0 }}
                    disabled={forgotLoading}
                  >
                    {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="auth-modal-success">
                <div className="auth-success-icon">✓</div>
                <h4>Reset link sent!</h4>
                <p>
                  If an account exists for <strong>{forgotEmail}</strong>, instructions to reset your password have been dispatched.
                </p>
                <button
                  type="button"
                  className="auth-submit-btn"
                  onClick={() => setShowForgotModal(false)}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
