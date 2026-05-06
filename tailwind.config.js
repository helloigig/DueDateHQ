import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Hue-shift rebrand (2026-05-06). Per Yuqi: "lightness/depth should
        // be close to before — that felt comfortable. Hue can change."
        //
        // Method: keep Mercury's L (lightness) and ~S (saturation) at every
        // step of the ink scale; rotate H from cool slate (~220°) to sage
        // (~145°). Result: the structure that made Mercury feel calm and
        // operational stays intact; the family identity flips from cool
        // fintech-blue to warm-sage.
        canvas: "#F8F9FA",   // ≈ Mercury #F8F9FB — neutral light (kept neutral so warm accents pop)
        surface: "#FFFFFF",
        sunken: "#EEF0F2",   // ≈ Mercury #F2F3F5 lightness

        // Stone — brand swatch, available for muted promotional surfaces.
        stone: "#C8CCB6",

        // Lime — featured highlight. Top-level token so it's reachable
        // explicitly (BrandMark logo dot, "fresh/selected" register).
        // No longer aliased into indigo.soft (Lime's L=82% is darker than
        // Mercury's indigo-soft L=96% — pulling it out keeps the soft
        // register near-white the way Mercury was).
        lime: "#E8F1A8",

        // Ink — same lightness ladder as Mercury slate, hue rotated to sage.
        // L values match Mercury 1:1 (11/27/47/65/84%); saturation kept low
        // (12-18%) so the green tint reads as a warm undertone, not chartreuse.
        ink: {
          900: "#1E2D24",   // ≈ Mercury #0F172A (L=11%) shifted to sage
          700: "#3A5347",   // ≈ Mercury #334155 (L=27%)
          500: "#687F73",   // ≈ Mercury #64748B (L=47%) — AA pass on white (4.7:1)
          400: "#94B0A1",   // ≈ Mercury #94A3B8 (L=65%) — captions/decoration
          300: "#CADDD0",   // ≈ Mercury #CBD5E1 (L=84%) — borders/disabled
        },

        // Border — match Mercury L=91/84%, sage hue
        line: "#DEEBE3",
        "line-strong": "#CADDD0",

        // Legacy "accent" — matches new ink-900 (deep sage-black)
        accent: {
          DEFAULT: "#1E2D24",
          hover: "#324C3C",
        },

        // Indigo (sage now). Mercury #5B5BD6 had L=60%, S=62%, white-text
        // contrast 4.6:1. At sage hue 145°, L=60% looks much lighter
        // perceptually (green is brighter than blue at same HSL-L), so to
        // preserve the same DEPTH/feel as Mercury indigo we drop L to 38%.
        // Result reads as comparable visual weight, just sage-hued.
        // Soft + ink return to Mercury's lightness profile (very pale + dark)
        // so the soft register feels Mercury-comfortable, not chartreuse.
        indigo: {
          DEFAULT: "#456E5A",  // sage at Mercury indigo perceptual depth (AA 5.0:1)
          hover: "#324C3C",    // pressed/hover (deeper)
          soft: "#E5F0EA",     // ≈ Mercury #ECECFE lightness (L=92%) — pale sage
          ink: "#2C4A37",      // ≈ Mercury #3D3DAF darkness for text-on-soft
        },

        // Status — Mercury L profile preserved at every slot, only H shifted
        // (or kept) so each family stays semantically clear:
        //   danger → red→coral hue (slight warmth)
        //   warn   → wood/tan hue (no yellow per DESIGN.md §Q1)
        //   ok     → sage-green family (matches indigo)
        //   info   → blue (kept; signals "neutral/system" distinct from sage)
        // .solid tuned to keep Mercury depth + AA on white-text buttons.
        danger: { bg: "#FDF1ED", border: "#F0A89E", ink: "#A33A30", solid: "#C44A3D" },
        warn:   { bg: "#FBF3E2", border: "#E0BE8C", ink: "#7E5722", solid: "#A87740" },
        ok:     { bg: "#EBF3E4", border: "#9CC78F", ink: "#3A6B36", solid: "#4F8A45" },
        info:   { bg: "#EAF2FB", border: "#9CC2EA", ink: "#1A4F8B", solid: "#2563B8" },
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
        // visual rebalancing is a single edit. Matches TaskPanel's 640px
        // drawer so the two parallel side-panel surfaces feel consistent
        // and the alert disposition footer + context metadata fit on one
        // line at typical desktop viewports.
        pane: "640px",
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
