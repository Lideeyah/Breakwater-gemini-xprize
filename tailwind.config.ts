import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    // Tremor UI components live in node_modules — Tailwind must scan them.
    "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#020617",
        surface: "#0f172a",
        elevated: "#111827",
        accent: "#7c8ba1",
        neutral: "#94a3b8",
        foreground: "#e2e8f0",
        secondary: "#94a3b8",
        muted: "#64748b",
        border: "#1e293b",
        "border-strong": "#334155",
        success: "#2fb98a",
        pending: "#c89b2c",
        failure: "#d16a7e",
        // --- Tremor design tokens (dark-first, matched to our palette) ---
        tremor: {
          brand: {
            faint: "#0B1220",
            muted: "#172554",
            subtle: "#1e40af",
            DEFAULT: "#2fb98a",
            emphasis: "#34d399",
            inverted: "#020617",
          },
          background: {
            muted: "#0f172a",
            subtle: "#111827",
            DEFAULT: "#0f172a",
            emphasis: "#e2e8f0",
          },
          border: { DEFAULT: "#1e293b" },
          ring: { DEFAULT: "#1e293b" },
          content: {
            subtle: "#64748b",
            DEFAULT: "#94a3b8",
            emphasis: "#e2e8f0",
            strong: "#f8fafc",
            inverted: "#020617",
          },
        },
        "dark-tremor": {
          brand: {
            faint: "#0B1220",
            muted: "#172554",
            subtle: "#1e40af",
            DEFAULT: "#2fb98a",
            emphasis: "#34d399",
            inverted: "#020617",
          },
          background: {
            muted: "#0f172a",
            subtle: "#111827",
            DEFAULT: "#0f172a",
            emphasis: "#e2e8f0",
          },
          border: { DEFAULT: "#1e293b" },
          ring: { DEFAULT: "#1e293b" },
          content: {
            subtle: "#64748b",
            DEFAULT: "#94a3b8",
            emphasis: "#e2e8f0",
            strong: "#f8fafc",
            inverted: "#020617",
          },
        },
      },
      boxShadow: {
        "tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "tremor-card":
          "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "tremor-dropdown":
          "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        "dark-tremor-input": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        "dark-tremor-card":
          "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
        "dark-tremor-dropdown":
          "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        "tremor-small": "0.375rem",
        "tremor-default": "0.5rem",
        "tremor-full": "9999px",
      },
      fontSize: {
        "tremor-label": ["0.75rem", { lineHeight: "1rem" }],
        "tremor-default": ["0.875rem", { lineHeight: "1.25rem" }],
        "tremor-title": ["1.125rem", { lineHeight: "1.75rem" }],
        "tremor-metric": ["1.875rem", { lineHeight: "2.25rem" }],
      },
      fontFamily: {
        sans: ["var(--font-geist)"],
        operational: ["var(--font-jetbrains)"],
      },
    },
  },
  // Tremor applies color classes dynamically at runtime, so they must survive
  // Tailwind's purge. Scoped to the families the dashboard actually renders.
  safelist: [
    {
      pattern:
        /^(bg|text|border|ring|stroke|fill)-(emerald|rose|red|amber)-(400|500|600)$/,
      variants: ["hover", "ui-selected"],
    },
    {
      pattern:
        /^(bg|text|border|ring|stroke|fill)-(tremor|dark-tremor)-(brand|background|border|content)(-\w+)?$/,
    },
  ],
  plugins: [],
};
export default config;
