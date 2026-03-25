/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx,html}'
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0B0F1A',
        'bg-card': '#131825',
        'bg-elevated': '#1A2035',
        'accent-green': '#00FF87',
        'accent-red': '#FF3B5C',
        'accent-gold': '#FFD700',
        'accent-blue': '#3B82F6',
      },
      keyframes: {
        flash: {
          '0%': { backgroundColor: 'rgba(255, 215, 0, 0.3)', transform: 'scale(1.2)' },
          '100%': { backgroundColor: 'transparent', transform: 'scale(1)' },
        },
        wave: {
          '0%, 100%': { height: '8px' },
          '50%': { height: '32px' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        micRing: {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
        scoreScale: {
          '0%': { transform: 'scale(1.25)', color: '#FFD700' },
          '100%': { transform: 'scale(1)', color: '#F1F5F9' },
        },
      },
      animation: {
        flash: 'flash 0.5s ease-out forwards',
        wave: 'wave 1s ease-in-out infinite',
        slideInLeft: 'slideInLeft 0.3s ease-out forwards',
        micRing: 'micRing 1.5s ease-out infinite',
        scoreScale: 'scoreScale 0.3s ease-out forwards',
      },
    }
  },
  plugins: []
}
