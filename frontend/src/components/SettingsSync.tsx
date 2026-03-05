import { useEffect, useRef } from "react";
import { useTelegram } from "../hooks/useTelegram";
import { useSettings } from "../context/SettingsContext";
import { getSettings, updateSettings } from "../api";

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
          skipNextSave.current = true;
          if (data.lang) setLang(data.lang as "ru" | "en");
          if (data.theme) setTheme(data.theme as "dark" | "light");
          if (data.currency) {
            const c = data.currency === "RUB" ? "USD" : (data.currency as "BYN" | "USD");
            if (c === "BYN" || c === "USD") setCurrency(c);
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
