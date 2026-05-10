/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        ring: "var(--ring)",

        // 👇 ADD THESE
        primary: '#E91E63',   // pink beauty vibe
        secondary: '#FFF0F5', // soft background
      },
    },
  },
  plugins: [],
}