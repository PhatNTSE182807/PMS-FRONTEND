import { useState, useEffect } from 'react';
import { systemService } from '../api/system.service';
import { getApiBaseUrl, setApiBaseUrlOverride } from '../config/env';
import { t, tMaybe } from '@/i18n'

// The runtime URL override is a development aid; production builds use VITE_API_BASE_URL.
const canConfigureUrl = import.meta.env.DEV;
const PING_INTERVAL_MS = import.meta.env.DEV ? 60_000 : 5 * 60_000;

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
    // Developers watch the badge while switching backends; elsewhere a check every 5 minutes is plenty.
    // A hidden tab skips the check, and coming back to it or getting the network back checks at once.
    const interval = setInterval(() => {
      if (!document.hidden) checkStatus();
    }, PING_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) checkStatus();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', checkStatus);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', checkStatus);
    };
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
        title={t('Click to view or configure Backend API connection')}
      >
        <span className="api-status-badge__dot"></span>
        <span className="api-status-badge__text">
          {t('API:')}{' '}{isOnline ? t('Connected') : t('Offline')}
        </span>
      </button>

      {isOpen && (
        <div className="api-modal-backdrop" onClick={() => setIsOpen(false)}>
          <div className="api-modal" onClick={(e) => e.stopPropagation()}>
            <div className="api-modal__header">
              <h3>{t('Backend API Connection')}</h3>
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
                  {isOnline ? t('● Backend Is Online') : t('○ Backend Disconnected')}
                </span>
                <p className="api-modal__status-msg">{tMaybe(statusMessage)}</p>
              </div>

              {canConfigureUrl && (
                <>
                  <div className="api-modal__form-group">
                    <label>{t('Backend API Base URL (.NET Web API):')}</label>
                    <div className="api-modal__input-row">
                      <input
                        type="text"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        placeholder={t('https://localhost:44391/api')}
                        className="api-modal__input"
                      />
                      <button
                        type="button"
                        className="btn btn-primary-cyan btn-sm"
                        onClick={handleSaveUrl}
                        disabled={isChecking}
                      >
                        {t('Save & Test')}
                      </button>
                    </div>
                  </div>

                  <div className="api-modal__presets">
                    <span className="api-modal__presets-label">{t('Quick Presets (from PMS.sln launchSettings):')}</span>
                    <div className="api-modal__presets-buttons">
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() => handleQuickPreset('https://localhost:44391/api')}
                      >
                        {t('IIS Express (44391)')}
                      </button>
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() => handleQuickPreset('https://localhost:5001/api')}
                      >
                        {t('Kestrel HTTPS (5001)')}
                      </button>
                      <button
                        type="button"
                        className="preset-btn"
                        onClick={() => handleQuickPreset('http://localhost:5000/api')}
                      >
                        {t('Kestrel HTTP (5000)')}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <div className="api-modal__tip">
                <p>
                  <strong>{t('Tip:')}</strong>{' '}{t('Make sure the .NET backend is started to access all features.')}
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
                {isChecking ? t('Checking...') : t('Ping Server')}
              </button>
              <button
                type="button"
                className="btn btn-primary-cyan"
                onClick={() => setIsOpen(false)}
              >
                {t('Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
