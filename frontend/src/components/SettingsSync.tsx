import { useEffect, useRef } from "react";
import { useTelegram } from "../hooks/useTelegram";
import { useSettings } from "../context/SettingsContext";
import { SETTINGS_STORAGE_KEY } from "../context/SettingsContext";
import { getSettings, updateSettings } from "../api";

// Какие из трёх полей уже лежат в localStorage. Используется чтобы решить,
// доверять серверу или локалу при первой синхронизации после монтирования.
// Локал — источник правды: если юзер тут что-то выставил, мы не имеем права
// перезатереть его значением из БД (которое могло устареть, если предыдущий
// updateSettings молча упал — сеть, 401, что угодно).
function hasLocalSettings(): { lang: boolean; theme: boolean; currency: boolean } {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { lang: false, theme: false, currency: false };
    const parsed = JSON.parse(raw) as { lang?: string; theme?: string; currency?: string };
    return {
      lang: parsed.lang === "ru" || parsed.lang === "en",
      theme: parsed.theme === "dark" || parsed.theme === "light",
      currency: parsed.currency === "USD" || parsed.currency === "BYN",
    };
  } catch {
    return { lang: false, theme: false, currency: false };
  }
}

export function SettingsSync() {
  const { userId } = useTelegram();
  const { settings, setLang, setTheme, setCurrency } = useSettings();
  const skipNextSave = useRef(false);
  const hasFetched = useRef(false);
  // Текущие settings через ref — closure внутри fetch'а ниже захватывает
  // settings один раз на mount. Без ref'а push-местечко при preferLocal
  // отправлял бы в БД устаревшее значение, если юзер уже успел кликнуть
  // переключатель пока летел getSettings.
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    if (!userId) return;
    getSettings(userId)
      .then((data) => {
        hasFetched.current = true;
        if (!data) return;

        const local = hasLocalSettings();
        const push: { lang?: string; theme?: string; currency?: string } = {};
        let didOverrideLocal = false;

        if (data.theme) {
          if (local.theme) {
            push.theme = settingsRef.current.theme;
          } else {
            setTheme(data.theme as "dark" | "light");
            didOverrideLocal = true;
          }
        }
        if (data.lang) {
          if (local.lang) {
            push.lang = settingsRef.current.lang;
          } else {
            setLang(data.lang as "ru" | "en");
            didOverrideLocal = true;
          }
        }
        if (data.currency) {
          const raw = data.currency as string | undefined;
          const c = raw === "RUB" ? "USD" : (raw === "BYN" || raw === "USD" ? raw : null);
          if (c) {
            if (local.currency) {
              push.currency = settingsRef.current.currency;
            } else {
              setCurrency(c);
              didOverrideLocal = true;
            }
          }
        }

        // Если хоть одно поле подтянули из БД (локал был пуст), не даём
        // save-эффекту ниже ту же только что прочитанную пачку отправить
        // обратно в БД — иначе бесполезный round-trip.
        if (didOverrideLocal) skipNextSave.current = true;
        // Пушим в БД поля, по которым локал был источником правды. Это
        // лечит случай stale-DB: значение в БД отставало (предыдущая
        // запись молча упала), теперь подтягиваем DB к локалу.
        if (Object.keys(push).length > 0) {
          updateSettings(userId, push).catch(() => {});
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
