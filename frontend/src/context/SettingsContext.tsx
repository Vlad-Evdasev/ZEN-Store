import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getCurrencyRate } from "../api";

export type Lang = "ru" | "en";
export type Theme = "dark" | "light";
export type Currency = "BYN" | "USD";

interface Settings {
  lang: Lang;
  theme: Theme;
  currency: Currency;
}

export const SETTINGS_STORAGE_KEY = "zen-settings";
const STORAGE_KEY = SETTINGS_STORAGE_KEY;

const defaultSettings: Settings = {
  lang: "ru",
  theme: "dark",
  currency: "USD",
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const rawCurrency = parsed.currency as string | undefined;
    const currency: Currency = rawCurrency === "RUB" ? "USD" : (rawCurrency === "BYN" || rawCurrency === "USD" ? rawCurrency : defaultSettings.currency);
    return { ...defaultSettings, ...parsed, currency };
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

const CURRENCY_SYMBOLS: Record<Currency, string> = { USD: "$", BYN: "Br" };
const DEFAULT_BYN_RATE = 3.2;
// Кешируем последний полученный USD→BYN курс в localStorage, иначе при
// каждом cold-старте цены сначала отрисовывались по hardcoded 3.2, а через
// ~секунду «прыгали» к актуальному. Теперь стартуем с последнего известного
// (обычно ≈ совпадает с актуальным) и в фоне обновляем.
const BYN_RATE_CACHE_KEY = "zen-byn-rate";
function loadBynRateCache(): number | null {
  try {
    const raw = localStorage.getItem(BYN_RATE_CACHE_KEY);
    if (!raw) return null;
    const n = parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
}
function saveBynRateCache(rate: number): void {
  try { localStorage.setItem(BYN_RATE_CACHE_KEY, String(rate)); } catch {}
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    const s = loadSettings();
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", s.theme);
    }
    return s;
  });
  const [currencyRateByn, setCurrencyRateByn] = useState<number>(() => loadBynRateCache() ?? DEFAULT_BYN_RATE);

  useEffect(() => {
    getCurrencyRate()
      .then(({ rate }) => {
        setCurrencyRateByn(rate);
        saveBynRateCache(rate);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    saveSettings(settings);
    document.documentElement.setAttribute("data-theme", settings.theme);
  }, [settings]);

  const setLang = useCallback((lang: Lang) => setSettings((s) => ({ ...s, lang })), []);
  const setTheme = useCallback((theme: Theme) => setSettings((s) => ({ ...s, theme })), []);
  const setCurrency = useCallback((currency: Currency) => setSettings((s) => ({ ...s, currency })), []);

  const formatPrice = useCallback(
    (price: number) => {
      const rate = settings.currency === "BYN" ? currencyRateByn : 1;
      const converted = Math.round(price * rate);
      return `${converted.toLocaleString()} ${CURRENCY_SYMBOLS[settings.currency]}`;
    },
    [settings.currency, currencyRateByn]
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
