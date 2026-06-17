import { db } from "../db/schema.js";

/** Reads a value from the key-value app_settings table. */
export function getAppSetting(key: string): string | null {
  const row = db
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

/** Reads a numeric app setting, falling back to `fallback` when missing/invalid. */
export function getAppSettingNumber(key: string, fallback: number): number {
  const raw = getAppSetting(key);
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Upserts a value into app_settings. */
export function setAppSetting(key: string, value: string): void {
  db.prepare(
    "INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}
