/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx,html}'
  ],
  theme: {
    extend: {
      colors: {
        'gaming-dark': '#0f172a',
        'gaming-blue': '#3b82f6',
        'gaming-green': '#22c55e'
      }
    }
  },
  plugins: []
}
