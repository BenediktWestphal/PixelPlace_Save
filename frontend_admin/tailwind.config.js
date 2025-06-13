/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // gridTemplateColumns: { // Remove this
      //   '100': 'repeat(100, minmax(0, 1fr))',
      // }
    },
  },
  plugins: [],
}
