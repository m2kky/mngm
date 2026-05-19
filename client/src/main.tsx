import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress Vite HMR WebSocket errors in Replit's dev environment
// (wss://localhost:undefined is a known Replit quirk, not an app error)
window.addEventListener("unhandledrejection", (event) => {
  const msg = event.reason?.message ?? "";
  if (msg.includes("localhost:undefined") || msg.includes("wss://localhost")) {
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
