/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        vaniki: {
          primary: '#0F6E56',       // Industrial Teal Primary
          secondary: '#1D9E75',     // Success/verified
          bg: '#E1F5EE',            // Background
          card: '#FFFFFF',          // Card White
          text: '#1F2933',          // Text Dark Gray
          success: '#1D9E75',       // Success Green/Teal
          error: '#DC2626',         // Error Red
          warning: '#BA7517',       // Alert/mismatch
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
