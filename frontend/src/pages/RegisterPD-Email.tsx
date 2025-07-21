import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext-Email';
import './RegisterPD.css';

interface PDFormData {
  email: string;
  password: string;
  confirmPassword: string;
  displayName?: string;
}

interface StreamConfig {
  srtUrl: string;
  streamKey: string;
  staffUrl: string;
  websocketUrl: string;
}

const RegisterPDEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [formData, setFormData] = useState<PDFormData>({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [streamConfig, setStreamConfig] = useState<StreamConfig | null>(null);
  
  const isPDSoftware = searchParams.get('source') === 'pd_software';
  const token = searchParams.get('token');

  useEffect(() => {
    // Add class to body for special styling
    document.body.classList.add('pd-registration');
    
    return () => {
      document.body.classList.remove('pd-registration');
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validateForm = (): boolean => {
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      setError('All required fields must be filled.');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const payload = {
        email: formData.email,
        password: formData.password,
        displayName: formData.displayName || undefined,
        isPDSoftware,
        token,
        softwareVersion: searchParams.get('version') || '1.0.0',
        vmixPort: searchParams.get('vmixPort') || 8088,
      };

      const response = await fetch('/api/pd-auth/register-pd', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setRegistrationSuccess(true);
        setStreamConfig(data.streamConfig);
        
        // Auto-login after registration
        if (data.tokens.authToken) {
          login(data.tokens.authToken, data.user);
        }

        // If from PD software, send message to parent window
        if (isPDSoftware && window.opener) {
          window.opener.postMessage({
            type: 'PD_REGISTRATION_SUCCESS',
            data: {
              tokens: data.tokens,
              streamConfig: data.streamConfig,
              user: data.user,
            },
          }, '*');
        }
      } else {
        setError(data.message || 'An error occurred during registration.');
      }
    } catch (err) {
      setError('Failed to connect to the server.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  if (registrationSuccess && streamConfig) {
    return (
      <div className="pd-register-container">
        <div className="pd-register-success">
          <div className="success-icon">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
          </div>
          
          <h1>PD Account Created Successfully!</h1>
          <p className="success-subtitle">Welcome to ReturnFeed Professional Broadcasting System.</p>
          
          <div className="config-section">
            <h2>Streaming Configuration</h2>
            
            <div className="config-item">
              <label>SRT Streaming URL</label>
              <div className="config-value">
                <code>{streamConfig.srtUrl}</code>
                <button onClick={() => copyToClipboard(streamConfig.srtUrl)} className="copy-btn">
                  Copy
                </button>
              </div>
              <small>Enter this URL in your vMix streaming output.</small>
            </div>
            
            <div className="config-item">
              <label>Stream Key</label>
              <div className="config-value">
                <code>{streamConfig.streamKey}</code>
                <button onClick={() => copyToClipboard(streamConfig.streamKey)} className="copy-btn">
                  Copy
                </button>
              </div>
              <small>Keep this key private and secure.</small>
            </div>
            
            <div className="config-item">
              <label>Staff Access URL</label>
              <div className="config-value">
                <code>{streamConfig.staffUrl}</code>
                <button onClick={() => copyToClipboard(streamConfig.staffUrl)} className="copy-btn">
                  Copy
                </button>
              </div>
              <small>Share this link with your camera operators and staff.</small>
            </div>
            
            <div className="config-item">
              <label>WebSocket URL</label>
              <div className="config-value">
                <code>{streamConfig.websocketUrl}</code>
                <button onClick={() => copyToClipboard(streamConfig.websocketUrl)} className="copy-btn">
                  Copy
                </button>
              </div>
              <small>WebSocket address for tally system connection.</small>
            </div>
          </div>
          
          <div className="action-buttons">
            {isPDSoftware ? (
              <button onClick={() => window.close()} className="primary-btn">
                Return to PD Software
              </button>
            ) : (
              <button onClick={() => navigate('/dashboard')} className="primary-btn">
                Go to Dashboard
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pd-register-container">
      <div className="pd-register-card">
        <div className="pd-header">
          <img src="/returnfeed_logo.png" alt="ReturnFeed" className="pd-logo" />
          <h1>Create PD Account</h1>
          <p>ReturnFeed Professional Broadcasting Platform</p>
          {isPDSoftware && (
            <div className="pd-badge">
              <span>PD Software Integration</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="pd-form">
          <div className="form-group">
            <label htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="example@email.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="displayName">Display Name (optional)</label>
            <input
              type="text"
              id="displayName"
              name="displayName"
              value={formData.displayName}
              onChange={handleChange}
              placeholder="Your display name"
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Minimum 8 characters"
              required
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password *</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter your password"
              required
              autoComplete="new-password"
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create PD Account'}
          </button>

          <div className="form-footer">
            <p>Already have an account?</p>
            <a href="/login" className="login-link">Sign In</a>
          </div>
        </form>

        <div className="pd-features">
          <h3>PD Account Benefits</h3>
          <ul>
            <li>✅ vMix Tally System Integration</li>
            <li>✅ SRT Streaming Support</li>
            <li>✅ Unlimited Staff Access</li>
            <li>✅ Real-time Broadcast Monitoring</li>
            <li>✅ Dedicated Technical Support</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RegisterPDEmail;