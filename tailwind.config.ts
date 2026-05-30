import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:       "var(--bg)",
        surface: {
          DEFAULT: "var(--surface)",
          2:       "var(--surface-2)",
          3:       "var(--surface-3)",
        },
        border: {
          DEFAULT: "var(--border)",
          2:       "var(--border-2)",
        },
        foreground:       "var(--text)",
        "muted-foreground": "var(--text-2)",
        "dim-foreground":   "var(--text-3)",
        accent: {
          DEFAULT: "rgb(var(--accent-ch) / <alpha-value>)",
          hover:   "var(--accent-hover)",
        },
        success: "rgb(var(--success-ch) / <alpha-value>)",
        error:   "rgb(var(--error-ch)   / <alpha-value>)",
        warning: "rgb(var(--warning-ch) / <alpha-value>)",
        info:    "rgb(var(--info-ch)    / <alpha-value>)",
        "grade-s": "rgb(var(--grade-s-ch) / <alpha-value>)",
        "grade-a": "rgb(var(--grade-a-ch) / <alpha-value>)",
        "grade-b": "rgb(var(--grade-b-ch) / <alpha-value>)",
        "grade-c": "rgb(var(--grade-c-ch) / <alpha-value>)",
        "grade-d": "rgb(var(--grade-d-ch) / <alpha-value>)",
      },
      fontFamily: {
        heading: ["Helvetica Neue", "Helvetica", "Arial", "var(--font-body)", "sans-serif"],
        body:    ["Helvetica Neue", "Helvetica", "Arial", "var(--font-body)", "sans-serif"],
        sans:    ["Helvetica Neue", "Helvetica", "Arial", "var(--font-body)", "sans-serif"],
        serif:   ["var(--font-serif)", "Instrument Serif", "Georgia", "serif"],
        mono:    ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      borderRadius: {
        sm:    "6px",
        DEFAULT: "6px",
        md:    "10px",
        lg:    "14px",
        xl:    "20px",
        "2xl": "28px",
        full:  "9999px",
      },
      fontSize: {
        xs:   ["11px", { lineHeight: "1.5" }],
        sm:   ["13px", { lineHeight: "1.5" }],
        base: ["15px", { lineHeight: "1.6" }],
        md:   ["17px", { lineHeight: "1.5" }],
        lg:   ["20px", { lineHeight: "1.4" }],
        xl:   ["24px", { lineHeight: "1.3" }],
        "2xl": ["32px", { lineHeight: "1.2" }],
        "3xl": ["48px", { lineHeight: "1.1" }],
      },
    },
  },
  plugins: [],
};

export default config;
