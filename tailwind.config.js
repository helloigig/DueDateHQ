/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces
        canvas: "#FAFAF7",
        surface: "#FFFFFF",
        sunken: "#F5F4EF",

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

        // Single accent
        accent: {
          DEFAULT: "#0F172A",
          hover: "#1E293B",
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
      },

      borderRadius: {
        sm: "4px",
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
        xl: "12px",
      },

      boxShadow: {
        pop: "0 2px 8px rgba(15, 23, 42, 0.06)",
        overlay: "0 8px 24px rgba(15, 23, 42, 0.12)",
      },

      spacing: {},
    },
  },
  plugins: [],
};
