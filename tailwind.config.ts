import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        michal: {
          bg: '#e6d3d9',          // רקע כללי - ורוד-בז' עדין
          card: '#f9f6f7',        // כרטיסיות/טבלאות
          hover: '#f2e9ec',       // שורות בהובר
          primary: '#96758d',     // כפתור ראשי - סגול רך-עמוק
          secondary: '#75968c',   // כפתור משני - ירוק-טורקיז רגוע
          text: {
            primary: '#000000',   // כותרות
            secondary: '#333333', // טקסט רגיל
            muted: '#96758d',     // טקסט משני
          },
          border: '#dddddd',      // גבולות
        },
      },
    },
  },
  plugins: [],
}
export default config
