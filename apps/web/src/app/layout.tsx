import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const appSiteUrl = new URL(
  process.env.NEXT_PUBLIC_APP_SITE_URL ??
    process.env.APP_SITE_URL ??
    "https://localhost.hirahul.xyz",
);

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: appSiteUrl,
  title: "Localhost Status",
  description:
    "Download Localhost Status, the macOS app by Yamparala Rahul for seeing active localhost servers and terminating them locally.",
  applicationName: "Localhost Status",
  icons: {
    icon: "/icon.svg",
  },
  authors: [{ name: "Yamparala Rahul", url: "https://www.hirahul.xyz" }],
  creator: "Yamparala Rahul",
  publisher: "Yamparala Rahul",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: appSiteUrl.toString(),
    title: "Localhost Status",
    description:
      "A macOS app by Yamparala Rahul for inspecting localhost listeners and stopping them without leaving your desktop.",
    siteName: "Localhost Status",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Localhost Status by Yamparala Rahul",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Localhost Status",
    description:
      "A macOS app by Yamparala Rahul for inspecting localhost listeners and stopping them without leaving your desktop.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
