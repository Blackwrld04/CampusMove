/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        oau: {
          blue: '#1E3A8A',
          gold: '#F59E0B',
          green: '#10B981',
          dark: '#0F172A'
        }
      }
    }
  },
  plugins: []
};
