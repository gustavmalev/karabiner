/** @type {import('tailwindcss').Config} */
const { heroui } = require("@heroui/theme");

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        'primary-foreground': "var(--color-primary-foreground)",
        secondary: "var(--color-secondary)",
        danger: "var(--color-danger)",
        muted: "var(--color-muted)",
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      spacing: {
        xs: "var(--space-xs, 4px)",
        sm: "var(--space-sm, 8px)",
        md: "var(--space-md, 12px)",
        lg: "var(--space-lg, 16px)",
        xl: "var(--space-xl, 24px)",
      },
    },
  },
  plugins: [heroui({ defaultTheme: "light" })],
}
