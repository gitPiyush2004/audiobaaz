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
        bg: "var(--bg)",
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
        },
        border: "var(--border)",
        foreground: "var(--text)",
        "muted-foreground": "var(--text-2)",
        accent: {
          DEFAULT: "rgb(var(--accent-ch) / <alpha-value>)",
          dark: "var(--accent-dark)",
        },
        success: "rgb(var(--success-ch) / <alpha-value>)",
        error:   "rgb(var(--error-ch)   / <alpha-value>)",
        warning: "rgb(var(--warning-ch) / <alpha-value>)",
        info:    "rgb(var(--info-ch)    / <alpha-value>)",
      },
      fontFamily: {
        heading: ["var(--font-syne)",     "sans-serif"],
        body:    ["var(--font-dm-sans)",  "sans-serif"],
        sans:    ["var(--font-dm-sans)",  "sans-serif"],
        mono:    ["var(--font-mono)",     "monospace"],
      },
      borderRadius: {
        sm:    "4px",
        DEFAULT: "8px",
        md:    "8px",
        lg:    "12px",
        xl:    "16px",
        "2xl": "24px",
        "3xl": "32px",
        full:  "9999px",
      },
      spacing: {
        18:  "4.5rem",
        88:  "22rem",
        128: "32rem",
      },
    },
  },
  plugins: [],
};

export default config;
