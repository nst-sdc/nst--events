import type { Metadata } from "next";
import { Geist, Geist_Mono, Syne, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "../providers/QueryProvider";
import { AppThemeProvider } from "../providers/ThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://events.nstsdc.org';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'NST Events | Newton School of Technology (NST SDC)',
    template: '%s | NST Events — Newton School of Technology',
  },
  description:
    'Official events portal for Newton School of Technology (NST) and NST SDC. Discover upcoming campus hackathons, technical workshops, coding competitions, Neutron techno-cultural fest, and developer sessions.',
  keywords: [
    'NST Events',
    'Newton School of Technology',
    'NST SDC',
    'NST ADYPU',
    'NST Hackathons',
    'Newton School Events',
    'Neutron Fest',
    'Campus Technical Events',
    'Coding Competitions',
    'Tech Workshops Pune',
  ],
  authors: [{ name: 'NST SDC', url: 'https://events.nstsdc.org' }],
  creator: 'Newton School of Technology Student Developer Community',
  publisher: 'Newton School of Technology',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    url: siteUrl,
    siteName: 'NST Events',
    title: 'NST Events | Newton School of Technology (NST SDC)',
    description:
      'Official events portal for Newton School of Technology (NST) and NST SDC. Discover upcoming campus hackathons, technical workshops, coding competitions, and developer sessions.',
    images: [
      {
        url: '/icon.png',
        width: 512,
        height: 512,
        alt: 'NST Events — Newton School of Technology',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NST Events | Newton School of Technology (NST SDC)',
    description:
      'Official events portal for Newton School of Technology (NST) and NST SDC. Discover upcoming campus hackathons, technical workshops, and coding competitions.',
    images: ['/icon.png'],
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon.png', type: 'image/png' },
      { url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'NST Events',
      alternateName: [
        'Newton School of Technology Events',
        'NST SDC Events',
        'NST ADYPU Events',
        'NST Campus Events',
      ],
      description:
        'Official events portal for Newton School of Technology (NST) and NST SDC. Discover upcoming campus hackathons, technical workshops, coding competitions, Neutron techno-cultural fest, and developer sessions.',
      publisher: {
        '@id': `${siteUrl}/#organization`,
      },
    },
    {
      '@type': 'EducationalOrganization',
      '@id': `${siteUrl}/#organization`,
      name: 'Newton School of Technology',
      alternateName: ['NST', 'NST SDC', 'NST ADYPU'],
      url: siteUrl,
      logo: `${siteUrl}/icon.png`,
      sameAs: [
        'https://www.newtonschool.co',
        'https://github.com/nst-sdc',
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${syne.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased scroll-smooth`}
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AppThemeProvider>
          <QueryProvider>
            {children}
          </QueryProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
