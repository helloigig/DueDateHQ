import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces — Mercury-aligned cool neutral palette (2026-05-03 refresh).
        // The previous warm cream (#FAFAF7) gave the product a paper feeling
        // but read as "Notion-ish" not "operational". Cool neutral pairs with
        // the indigo accent cleanly and matches the Mercury / Sana / Oku
        // reference family.
        canvas: "#F8F9FB",
        surface: "#FFFFFF",
        sunken: "#F2F3F5",

        // Text
        ink: {
          900: "#0F172A",
          700: "#334155",
          500: "#64748B",
          400: "#94A3B8",
          300: "#CBD5E1",
        },

        // Border
        line: "#E2E8F0",
        "line-strong": "#CBD5E1",

        // Single accent (legacy slate — kept for back-compat with existing
        // surfaces; do not use on new design-system surfaces)
        accent: {
          DEFAULT: "#0F172A",
          hover: "#1E293B",
        },

        // Design-system accent (per DESIGN.md §Taste principles T2 + §Colors).
        // Indigo — reserved for "the next action" only (T2: one accent, one
        // viewport, one action).
        indigo: {
          DEFAULT: "#5B5BD6",
          hover: "#4A4AC9",
          soft: "#ECECFE",
          ink: "#3D3DAF",
        },

        // Status
        danger: { bg: "#FEF2F2", border: "#FCA5A5", ink: "#B91C1C", solid: "#DC2626" },
        warn:   { bg: "#FFFBEB", border: "#FCD34D", ink: "#92400E", solid: "#D97706" },
        ok:     { bg: "#ECFDF5", border: "#86EFAC", ink: "#047857", solid: "#059669" },
        info:   { bg: "#EFF6FF", border: "#93C5FD", ink: "#1D4ED8", solid: "#2563EB" },
      },

      fontFamily: {
        sans: [
          "-apple-system", "BlinkMacSystemFont", "Segoe UI",
          "Roboto", "Helvetica Neue", "Arial", "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },

      fontSize: {
        "2xs": ["11px", { lineHeight: "16px", letterSpacing: "0.01em" }],
        xs:   ["12px", { lineHeight: "16px" }],
        sm:   ["13px", { lineHeight: "20px" }],
        base: ["14px", { lineHeight: "20px" }],
        lg:   ["16px", { lineHeight: "24px" }],
        xl:   ["18px", { lineHeight: "26px" }],
        "2xl":["22px", { lineHeight: "28px", letterSpacing: "-0.01em" }],

        // DESIGN.md named typography tokens (preferred over numeric scale
        // when the role is semantic — `text-display` reads more clearly
        // in JSX than `text-2xl font-semibold`).
        display:      ["22px", { lineHeight: "28px", letterSpacing: "-0.01em" }],
        title:        ["18px", { lineHeight: "26px" }],
        "body-lg":    ["14px", { lineHeight: "20px", fontWeight: "500" }],
        body:         ["14px", { lineHeight: "20px" }],
        label:        ["13px", { lineHeight: "20px", fontWeight: "500" }],
        caption:      ["12px", { lineHeight: "16px" }],
        micro:        ["11px", { lineHeight: "16px", fontWeight: "600", letterSpacing: "0.05em" }],
        // Mercury-style headline numeric (page-level KPIs only).
        "numeric-lg": ["26px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "600" }],
      },

      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
        xl: "12px",
        pill: "9999px", // T3: actions are pill-shaped (buttons, status pills, search bar)
      },

      boxShadow: {
        pop: "0 2px 8px rgba(15, 23, 42, 0.06)",
        overlay: "0 8px 24px rgba(15, 23, 42, 0.12)",
      },

      spacing: {
        // DueDateHQ rhythm scale (see DESIGN.md "Layout & Spacing").
        // Anything outside these four values is a bug — use them via
        // `gap-section`, `p-region`, etc. Tailwind's default 4px scale
        // (gap-2 = 8, gap-4 = 16, gap-6 = 24, gap-12 = 48) remains
        // available and produces identical results; the named tokens
        // exist so intent reads at a glance in JSX.
        inline:  "8px",   // within a row
        region:  "16px",  // inside a card
        card:    "24px",  // card → card
        section: "48px",  // section → section
      },

      width: {
        // The "co-pilot pane" width — used by /alerts (right pane) and
        // anywhere else a side workspace pane lives. One named token so
        // visual rebalancing is a single edit.
        pane: "440px",
      },

      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [animate],
};
