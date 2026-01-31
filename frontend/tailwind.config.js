/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 상승/하락 색상
        rise: '#ef5350',
        fall: '#26a69a',
        // 배경 색상
        'bg-dark': '#1a1a2e',
        'bg-card': '#16213e',
        'bg-hover': '#0f3460',
      },
    },
  },
  plugins: [],
}
