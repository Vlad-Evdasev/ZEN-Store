import { useEffect, useRef } from "react";
import { useTelegram } from "../hooks/useTelegram";
import { useSettings } from "../context/SettingsContext";
import { SETTINGS_STORAGE_KEY } from "../context/SettingsContext";
import { getSettings, updateSettings } from "../api";

function hasLocalTheme(): boolean {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { theme?: string };
    return parsed.theme === "dark" || parsed.theme === "light";
  } catch {
    return false;
  }
}

export function SettingsSync() {
  const { userId } = useTelegram();
  const { settings, setLang, setTheme, setCurrency } = useSettings();
  const skipNextSave = useRef(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!userId) return;
    getSettings(userId)
      .then((data) => {
        hasFetched.current = true;
        if (data) {
          const preferLocalTheme = hasLocalTheme();
          if (data.theme) {
            if (preferLocalTheme) {
              skipNextSave.current = true;
              updateSettings(userId, { theme: settings.theme }).catch(() => {});
            } else {
              setTheme(data.theme as "dark" | "light");
            }
          }
          if (!preferLocalTheme) skipNextSave.current = true;
          if (data.lang) setLang(data.lang as "ru" | "en");
          if (data.currency) {
            const raw = data.currency as string | undefined;
            const c = raw === "RUB" ? "USD" : (raw === "BYN" || raw === "USD" ? raw : null);
            if (c) setCurrency(c);
          }
        }
      })
      .catch(() => { hasFetched.current = true; });
  }, [userId]);

  useEffect(() => {
    if (!userId || !hasFetched.current) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    updateSettings(userId, {
      lang: settings.lang,
      theme: settings.theme,
      currency: settings.currency,
    }).catch(() => {});
  }, [userId, settings.lang, settings.theme, settings.currency]);

  return null;
}
