import React from "react";
import ReactDOM from "react-dom/client";
import { TonConnectUIProvider } from "@tonconnect/ui-react";
import App from "./App";
import { Admin } from "./pages/Admin";
import { SettingsProvider } from "./context/SettingsContext";
import "./index.css";

const isAdmin = typeof window !== "undefined" && window.location.pathname === "/admin";

// Манифест должен быть публично доступен по HTTPS — Vercel отдаёт
// public/tonconnect-manifest.json по корневому пути.
const tonConnectManifestUrl =
  typeof window !== "undefined"
    ? `${window.location.origin}/tonconnect-manifest.json`
    : "/tonconnect-manifest.json";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TonConnectUIProvider manifestUrl={tonConnectManifestUrl}>
      <SettingsProvider>
        {isAdmin ? <Admin /> : <App />}
      </SettingsProvider>
    </TonConnectUIProvider>
  </React.StrictMode>
);
