import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { seam, type DataSeam } from "@/lib/data";
import "./index.css";

// EVT-10 AC-8, AC-9. The end-to-end suite must write a description STRAIGHT TO THE DATASTORE, as
// ADR-005 lets anyone do to the real API, without the form's sanitise. Only in a build pinned to
// the mock seam: `VITE_DATA_SEAM` is replaced at build time, so a real build drops this block.
declare global {
  interface Window {
    __calechipMockSeam?: DataSeam;
  }
}
if (import.meta.env.VITE_DATA_SEAM === "mock") window.__calechipMockSeam = seam;

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
