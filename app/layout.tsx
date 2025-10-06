import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'מערכת AI של מיכל - עוזר אישי חכם',
  description: 'עוזר אישי חכם לניהול משימות, לקוחות, חובות ובירוקרטיה',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
