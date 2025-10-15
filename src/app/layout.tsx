import type { Metadata } from "next";
import "./globals.css";

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export const metadata: Metadata = {
  title: "ADSO - Google Ad Spend Optimizer",
  description: "Optimize your Google Ads campaigns with AI-powered insights",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
