import type { Metadata } from 'next';
import Link from 'next/link';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: 'Contribution Finder',
    template: '%s · Contribution Finder',
  },
  description:
    'Find beginner-friendly GitHub issues that fit your public activity, with the scoring explained.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <header className="site-header">
          <div className="site-header-inner">
            <Link className="wordmark" href="/">
              Contribution Finder
            </Link>
          </div>
        </header>
        <main id="content" className="page">
          {children}
        </main>
      </body>
    </html>
  );
}
