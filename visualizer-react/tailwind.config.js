/** @type {import('tailwindcss').Config} */
const { heroui } = require("@heroui/theme");

module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/@heroui/**/*.{js,ts,jsx,tsx}",
  ],
  theme: { extend: {} },
  plugins: [heroui({ defaultTheme: "light" })],
}
