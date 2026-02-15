import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Admin } from "./pages/Admin";
import { SettingsProvider } from "./context/SettingsContext";
import "./index.css";

const isAdmin = typeof window !== "undefined" && window.location.pathname === "/admin";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SettingsProvider>
      {isAdmin ? <Admin /> : <App />}
    </SettingsProvider>
  </React.StrictMode>
);
