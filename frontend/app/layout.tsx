import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SQMS - Smart Queue Management System',
  description: 'Virtual queuing solution for small businesses',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
