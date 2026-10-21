import "./utils/latinDigits";   // English digits everywhere — first, before anything formats
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// One service worker at the root scope: push notifications + offline app shell
// (sw-push.js imports sw-pos.js). Production only, registered once.
if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator && !window.__dlSwRegistered) {
  window.__dlSwRegistered = true;
  window.addEventListener("load", () => {
    navigator.serviceWorker.getRegistrations()
      .then((regs) => regs.forEach((r) => {
        const url = (r.active || r.waiting || r.installing || {}).scriptURL || "";
        if (url.endsWith("/sw-update.js")) r.unregister();
      }))
      .catch(() => {})
      .finally(() => { navigator.serviceWorker.register("/sw-push.js").catch(() => {}); });
  });
}
