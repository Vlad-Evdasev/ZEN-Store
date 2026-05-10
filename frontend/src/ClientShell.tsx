import { TonConnectUIProvider } from "@tonconnect/ui-react";
import App from "./App";

// Манифест публично доступен на vercel — фронт отдаёт
// public/tonconnect-manifest.json по корню.
const tonConnectManifestUrl =
  typeof window !== "undefined"
    ? `${window.location.origin}/tonconnect-manifest.json`
    : "/tonconnect-manifest.json";

// Customer-shell: TonConnectUIProvider + App. Грузится лениво из main.tsx,
// чтобы /admin не тащил @tonconnect/ui-react и @ton/core (~600KB).
export default function ClientShell() {
  return (
    <TonConnectUIProvider manifestUrl={tonConnectManifestUrl}>
      <App />
    </TonConnectUIProvider>
  );
}
