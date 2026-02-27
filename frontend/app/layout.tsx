import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ClientLayoutHandler from "@/components/ClientLayoutHandler";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CrimeGraph AI Dashboard",
  description: "Intelligent FIR Relationship Mapping System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ClientLayoutHandler>{children}</ClientLayoutHandler>
      </body>
    </html>
  );
}
