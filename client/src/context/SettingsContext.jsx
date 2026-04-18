import { createContext, useContext, useState, useEffect } from 'react';
import { getSettings } from '../services/settingsService';

const SettingsContext = createContext(null);

const CACHE_KEY    = 'pos_settings';
const CACHE_VERSION = 'v2'; // bump this to force a cache clear

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    // Load from cache instantly — no flicker on refresh
    try {
      const version = localStorage.getItem(CACHE_KEY + '_version');
      if (version !== CACHE_VERSION) {
        // Stale cache — clear it so we fetch fresh from server
        localStorage.removeItem(CACHE_KEY);
        localStorage.setItem(CACHE_KEY + '_version', CACHE_VERSION);
      }
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch {}
    return {
      shop_name:      '',
      currency:       'GHS',
      receipt_header: '',
      receipt_footer: 'Thank you for your patronage!',
      shop_address:   '',
      phone_number:   '',
      logo_url:       '',
    };
  });

  useEffect(() => {
    getSettings()
      .then((s) => {
        if (s) {
          setSettings(s);
          localStorage.setItem(CACHE_KEY, JSON.stringify(s));
        }
      })
      .catch(() => {});
  }, []);

  const updateSettings = (s) => {
    const next = typeof s === 'function' ? s(settings) : s;
    setSettings(next);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch {}
  };

  return (
    <SettingsContext.Provider value={{ settings, setSettings: updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be inside SettingsProvider');
  return ctx;
}
