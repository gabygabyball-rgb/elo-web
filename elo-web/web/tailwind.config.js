/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: '#04052E',
        foreground: '#f5f5f5',
        'muted-foreground': '#9ca3af'
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        brand: ['Orbitron', '"Space Grotesk"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
