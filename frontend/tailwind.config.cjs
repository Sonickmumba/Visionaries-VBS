/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        forest: "#0D3B2E",
        emerald: "#127A5A",
        gold: "#D9A227",
        cream: "#F7F4EE",
        mist: "#E6E8EB",
        charcoal: "#1F2933",
        alert: "#E25D5D",
        brand: {
          forest: "#0D3B2E",
          emerald: "#127A5A",
          gold: "#D9A227",
          cream: "#F7F4EE",
          mist: "#E6E8EB",
          charcoal: "#1F2933",
          alert: "#E25D5D",
        },
      },
      fontFamily: {
        sans: ["Poppins", "Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        soft: "0 14px 34px rgba(31, 41, 51, 0.08)",
        lift: "0 18px 46px rgba(31, 41, 51, 0.14)",
      },
      borderRadius: {
        app: "8px",
        mobile: "22px",
      },
    },
  },
  plugins: [],
};
