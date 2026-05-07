import './globals.css';

export const metadata = {
  title: 'CTA Position Tracker',
  description: 'S&P 500 Managed Money Positioning — CFTC COT Data',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-white antialiased">{children}</body>
    </html>
  );
}
