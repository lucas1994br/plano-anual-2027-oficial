import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Global error logging for debugging blank-screen issues
window.addEventListener("error", (event) => {
  console.error("Global error caught:", event.error || event.message, event);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});

createRoot(document.getElementById("root")!).render(<App />);
