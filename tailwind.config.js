/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#13ecc8",
                "primary-hover": "#0fbda0",
                "background-light": "#f6f8f8",
                "background-dark": "#10221f",
                "card-light": "#ffffff",
                "card-dark": "#162e2a",
                "text-primary-dark": "#10221f",
                "text-secondary-light": "#5b6b68",
                "editor-bg": "#1e1e1e",
                "editor-sidebar": "#252526",
            },
            fontFamily: {
                "display": ["Inter", "sans-serif"],
                "mono": ["Fira Code", "Consolas", "Monaco", "monospace"]
            },
            borderRadius: { "DEFAULT": "0.5rem", "lg": "1rem", "xl": "1.5rem", "full": "9999px" },
        },
    },
    plugins: [
        require("@tailwindcss/forms"),
    ],
}
