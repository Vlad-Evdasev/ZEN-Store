import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { Admin } from "./pages/Admin";
import { SettingsProvider } from "./context/SettingsContext";
import "./index.css";

// Buffer/process полифиллы инжектятся vite-plugin-node-polyfills.

// Customer-app + TonConnect грузятся отдельным chunk'ом — admin не тянет
// SDK и BoC-бандл (~600KB). Админ-страница инициализируется мгновенно.
const ClientShell = lazy(() => import("./ClientShell"));

const isAdmin = typeof window !== "undefined" && window.location.pathname === "/admin";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SettingsProvider>
      {isAdmin ? (
        <Admin />
      ) : (
        <Suspense fallback={null}>
          <ClientShell />
        </Suspense>
      )}
    </SettingsProvider>
  </React.StrictMode>
);
