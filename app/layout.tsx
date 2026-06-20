import type { Metadata, Viewport } from 'next';
import { ChatOnlyGuard, SessionCleanup } from '@/components/AuthGuard';
import { LanguageProvider } from '@/components/LanguageProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Report Workflow Hackthon',
  description: 'Fill, navigate, and view report workflow app.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <SessionCleanup />
          <ChatOnlyGuard />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
