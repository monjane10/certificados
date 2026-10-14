/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dbe6fe',
          200: '#bfd0fe',
          300: '#93b0fd',
          400: '#6088fa',
          500: '#3b63f6',
          600: '#2549eb',
          700: '#1d3ad8',
          800: '#1e32af',
          900: '#0f2357',
          950: '#0a1638',
        },
        accent: {
          50: '#effef4',
          100: '#d9fbe4',
          500: '#16a34a',
          600: '#15803d',
          700: '#166534',
        },
        // Tokens da interface do painel (referência visual Microlegal).
        ink: '#11245C', // azul-marinho principal
        muted: '#7486A8', // texto secundário
        soft: '#EDF5FF', // fundos suaves
        line: '#E2E9F3', // bordas finas
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'Cambria', 'serif'],
      },
      borderRadius: {
        control: '9px', // campos, botões secundários
        button: '10px',
        item: '11px', // itens de menu, blocos compactos
        card: '12px',
        banner: '14px',
      },
      spacing: {
        sidebar: '232px',
        header: '64px',
        gutter: '28px', // margem lateral do conteúdo
      },
      boxShadow: {
        card: '0 1px 2px rgba(17, 36, 92, 0.04)',
        menu: '0 8px 24px rgba(17, 36, 92, 0.08)',
      },
    },
  },
  plugins: [],
};
