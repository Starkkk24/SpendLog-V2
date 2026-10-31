
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SpendLog",
  description: "Track expenses and split bills with ease.",
  applicationName: "SpendLog",
  manifest: "/manifest.webmanifest",
  // Favicon and home-screen icons come from app/favicon.ico, app/icon.svg
  // and app/apple-icon.png (Next.js file conventions).
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SpendLog",
  },
};

export const viewport: Viewport = {
  themeColor: "#2C302E",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        </body>
    </html>
  );
}
