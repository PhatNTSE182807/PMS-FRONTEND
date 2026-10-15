import { useState, useEffect } from 'react';
import { systemService } from '../api/system.service';
import { getApiBaseUrl, setApiBaseUrlOverride } from '../config/env';

// The runtime URL override is a development aid; production builds use VITE_API_BASE_URL.
const canConfigureUrl = import.meta.env.DEV;

export default function ApiStatusBadge() {
  const [isOpen, setIsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [inputUrl, setInputUrl] = useState(getApiBaseUrl());
  const [statusMessage, setStatusMessage] = useState('');

  const checkStatus = async () => {
    setIsChecking(true);
    setStatusMessage('Checking connection to Backend...');
    const result = await systemService.ping();
    setIsOnline(result.online);
    setIsChecking(false);
    if (result.online) {
      setStatusMessage(`Connected to Backend successfully! (Status: ${result.status || 200})`);
    } else {
      setStatusMessage('Unable to reach backend. .NET API is not running or CORS blocked.');
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveUrl = () => {
    setApiBaseUrlOverride(inputUrl);
    checkStatus();
  };

  const handleQuickPreset = (presetUrl) => {
    setInputUrl(presetUrl);
    setApiBaseUrlOverride(presetUrl);
    setTimeout(checkStatus, 100);
  };

  return (
    <>
      <button
        type="button"
        className={`api-status-badge ${isOnline ? 'api-status-badge--online' : 'api-status-badge--offline'}`}
        onClick={() => setIsOpen(true)}
        title="Click to view or configure Backend API connection"
      >
        <span className="api-status-badge__dot"></span>
        <span className="api-status-badge__text">
          API: {isOnline ? 'Connected' : 'Offline (Demo Mode)'}
        </span>
        <span className="api-status-badge__gear">⚙️</span>
      </button>

      {isOpen && (
        <div className="api-modal-backdrop" onClick={() => setIsOpen(false)}>
          <div className="api-modal" onClick={(e) => e.stopPropagation()}>
            <div className="api-modal__header">
              <h3>Backend API Connection</h3>
              <button
                type="button"
                className="api-modal__close"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="api-modal__body">
              <div className="api-modal__status-box">
                <span className={`status-pill ${isOnline ? 'status-pill--success' : 'status-pill--warning'}`}>
                  {isOnline ? '● Backend Is Online' : '○ Backend Disconnected'}
                </span>
                <p className="api-modal__status-msg">{statusMessage}</p>
              </div>

              {canConfigureUrl && (
                <>
                  <div className="api-modal__form-group">
                    <label>Backend API Base URL (.NET Web API):</label>
                    <div className="api-modal__input-row">
                      <input
                        type="text"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        placeholder="https://localhost:44391/api"
                        className="api-modal__input"
                      />
                      <button
                        type="button"
                        className="btn btn-primary-cyan btn-sm"
                        onClick={handleSaveUrl}
                        disabled={isChecking}
                      >
                        Save & Test
                      </button>
                    </div>
                  </div>

                  <div className="api-modal__presets">
                    <span className="api-modal__presets-label">Quick Presets (from PMS.sln launchSettings):</span>
                    <div className="api-modal__presets-buttons">
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() => handleQuickPreset('https://localhost:44391/api')}
                      >
                        IIS Express (44391)
                      </button>
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() => handleQuickPreset('https://localhost:5001/api')}
                      >
                        Kestrel HTTPS (5001)
                      </button>
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() => handleQuickPreset('http://localhost:5000/api')}
                      >
                        Kestrel HTTP (5000)
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="api-modal__tip">
                <p>
                  💡 <strong>Tip:</strong> If the .NET backend is not yet started, you can still use the <strong>Instant Demo</strong> credentials on the login screen to explore the entire UI seamlessly!
                </p>
              </div>
            </div>

            <div className="api-modal__footer">
              <button
                type="button"
                className="btn btn-outline-cyan"
                onClick={checkStatus}
                disabled={isChecking}
              >
                {isChecking ? 'Checking...' : 'Ping Server'}
              </button>
              <button
                type="button"
                className="btn btn-primary-cyan"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
