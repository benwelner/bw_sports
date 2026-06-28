import './globals.css'; // Add this line!

export const metadata = {
  title: 'B Sports',
  description: 'B Sports',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* Remove the inline style so your CSS file can handle margins */}
      <body>
        {children}
      </body>
    </html>
  )
}