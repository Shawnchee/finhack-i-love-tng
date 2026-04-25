/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FFFFFF",
        surface: "#F7F8FA",
        ink: "#0B0F1A",
        "ink-muted": "#5A6473",
        rule: "#E4E7EC",
        blue: {
          DEFAULT: "#005ABE",
          soft: "#005ABE14",
        },
        yellow: {
          DEFAULT: "#FFCD00",
        },
        good: "#0BA66C",
        bad: "#D14343",
      },
      fontFamily: {
        display: ['"Instrument Serif"', "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      fontSize: {
        "display-xl": ["88px", { lineHeight: "0.95", letterSpacing: "-0.02em" }],
        "display-lg": ["56px", { lineHeight: "1.0", letterSpacing: "-0.015em" }],
      },
      boxShadow: {
        card: "0 1px 2px rgba(11,15,26,0.04), 0 8px 24px rgba(11,15,26,0.04)",
        focus: "0 0 0 2px #fff, 0 0 0 4px #005ABE",
      },
      transitionTimingFunction: {
        "out-quart": "cubic-bezier(0.25, 1, 0.5, 1)",
      },
    },
  },
  plugins: [],
};
