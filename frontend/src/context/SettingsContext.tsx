import { createContext, useContext, useState, useEffect, useCallback } from "react";

export type Lang = "ru" | "en";
export type Theme = "dark" | "light";
export type Currency = "BYN" | "RUB" | "USD";

interface Settings {
  lang: Lang;
  theme: Theme;
  currency: Currency;
}

const STORAGE_KEY = "zen-settings";

const defaultSettings: Settings = {
  lang: "ru",
  theme: "light",
  currency: "RUB",
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
}

function saveSettings(s: Settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

const SettingsContext = createContext<{
  settings: Settings;
  setLang: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;
  setCurrency: (currency: Currency) => void;
  formatPrice: (price: number) => string;
} | null>(null);

const CURRENCY_RATES: Record<Currency, number> = { RUB: 1, BYN: 0.034, USD: 0.011 };
const CURRENCY_SYMBOLS: Record<Currency, string> = { RUB: "₽", BYN: "Br", USD: "$" };

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    const s = loadSettings();
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", s.theme);
    }
    return s;
  });

  useEffect(() => {
    saveSettings(settings);
    document.documentElement.setAttribute("data-theme", settings.theme);
  }, [settings]);

  const setLang = useCallback((lang: Lang) => setSettings((s) => ({ ...s, lang })), []);
  const setTheme = useCallback((theme: Theme) => setSettings((s) => ({ ...s, theme })), []);
  const setCurrency = useCallback((currency: Currency) => setSettings((s) => ({ ...s, currency })), []);

  const formatPrice = useCallback(
    (price: number) => {
      const converted = Math.round(price * CURRENCY_RATES[settings.currency]);
      return `${converted.toLocaleString()} ${CURRENCY_SYMBOLS[settings.currency]}`;
    },
    [settings.currency]
  );

  return (
    <SettingsContext.Provider value={{ settings, setLang, setTheme, setCurrency, formatPrice }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be inside SettingsProvider");
  return ctx;
}
