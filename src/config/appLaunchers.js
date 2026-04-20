// src/config/appLaunchers.js
//
// Phase 3C.B — Registry for external app launcher cards.
// AppLauncherCard reads from here via appId, or accepts explicit props.
//
// LOCK 3: only "som-app" and "motesart-converter" are rendered in MotesartOS.jsx
// for this deploy. FM / Book / VitalStack entries exist here but are not
// mounted visually. Uncomment the JSX lines to enable after verification.
//
// Logo strategy:
//   - If logoSrc is set AND the file exists at that path, card renders the logo.
//   - If logoSrc is null or missing at runtime, card renders a branded initials tile.
//
// To add a real logo later:
//   1. Drop the SVG/PNG into public/brand/
//   2. Set logoSrc: "/brand/<filename>" in this file
//   3. That's it — zero component changes.

export const APP_LAUNCHERS = {
  // ─── LOCK 3: rendered in Phase 3C ──────────────────
  "som-app": {
    url: "https://school-of-motesart.netlify.app",
    label: "School of Motesart",
    subtitle: "Launch standalone app →",
    color: "#5a8fc9",        // T.blue
    logoSrc: null,            // TODO: /brand/som.svg
    initials: "S",
  },
  "motesart-converter": {
    url: "https://motesart-converter.netlify.app",
    label: "Motesart Converter",
    subtitle: "Launch standalone tool →",
    color: "#5a8fc9",        // T.blue
    logoSrc: null,            // TODO: /brand/converter.svg
    initials: "⟳",
  },

  // ─── LOCK 3: staged but NOT rendered in this deploy ──
  "fm-app": {
    url: "https://web-production-f6963.up.railway.app",
    label: "FinanceMind",
    subtitle: "Launch finance app →",
    color: "#4caf7d",        // T.green
    logoSrc: null,            // TODO: /brand/finance.svg
    initials: "F",
  },
  "book-app": {
    url: "https://motesart-book-manager.netlify.app",
    label: "Book Manager",
    subtitle: "Launch book app →",
    color: "#c9914c",        // T.amber
    logoSrc: null,            // TODO: /brand/book.svg
    initials: "B",
  },
  "vitalstack": {
    url: "https://vitalstacktracker.netlify.app",
    label: "VitalStack",
    subtitle: "Launch health tracker →",
    color: "#4caf7d",        // T.green
    logoSrc: null,            // TODO: /brand/vitalstack.svg
    initials: "V",
  },
};

export default APP_LAUNCHERS;
