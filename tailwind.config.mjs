import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  // Single perfected light theme — no dark mode classes anywhere.
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Manrope',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      colors: {
        bg: {
          DEFAULT: 'var(--bg)',
          card: 'var(--bg)',
          muted: 'var(--surface)',
          elevated: 'var(--bg)',
        },
        fg: {
          DEFAULT: 'var(--text)',
          muted: 'var(--muted)',
        },
        line: {
          DEFAULT: 'var(--divider)',
          strong: 'var(--divider)',
        },
        brand: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent)',
          link: 'var(--accent)',
          soft: 'rgba(109, 40, 217, 0.08)',
        },
        btn: {
          DEFAULT: 'var(--btn)',
          hover: 'var(--btn-hover)',
        },
        semantic: {
          success: 'var(--muted)',
          warning: '#B45309',
          error: '#B91C1C',
        },
      },
      maxWidth: {
        shell: '1380px',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [typography],
};
