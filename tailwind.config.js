/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#EAF3F0",
          100: "#D3E7E0",
          200: "#A7CFC1",
          300: "#7BB7A3",
          400: "#3F8F79",
          500: "#1F5D50",
          600: "#184B41",
          700: "#123D34",
          800: "#0D2E27",
          900: "#081F1A",
        },
        ochre: {
          50: "#FBF3E7",
          100: "#F6E9D3",
          200: "#ECD1A5",
          300: "#E0B876",
          400: "#D3A04C",
          500: "#C98A2C",
          600: "#A66F20",
          700: "#7A5416",
        },
      },
      boxShadow: {
        soft: "0 1px 2px rgba(15, 23, 20, 0.04), 0 8px 24px -12px rgba(15, 23, 20, 0.12)",
        pop: "0 12px 32px -8px rgba(15, 23, 20, 0.28)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      animation: {
        "fade-in": "fadeIn .18s ease-out",
        "slide-up": "slideUp .22s cubic-bezier(.16,1,.3,1)",
        "toast-in": "toastIn .25s cubic-bezier(.16,1,.3,1)",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: "translateY(8px) scale(.98)" }, to: { opacity: 1, transform: "translateY(0) scale(1)" } },
        toastIn: { from: { opacity: 0, transform: "translateY(12px)" }, to: { opacity: 1, transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};
