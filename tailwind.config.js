/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // 'class' lets the app control light/dark itself; 'media' crashes NativeWind on web.
  darkMode: 'class',
  theme: {
    extend: {
      colors: require('./src/theme/colors.js'),
      fontFamily: {
        sans: ['Inter_400Regular'],
        medium: ['Inter_500Medium'],
        semibold: ['Inter_600SemiBold'],
        bold: ['Inter_700Bold'],
        black: ['Inter_900Black'],
        logo: ['LilitaOne_400Regular'],
      },
    },
  },
  plugins: [],
};
