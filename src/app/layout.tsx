import type { Metadata } from "next";
import { Syne, DM_Sans, JetBrains_Mono } from "next/font/google";
import { Nav } from "@/components/layout/Nav";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-head",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Audiobaaz — Buy & Sell Secondhand Audio Gear",
  description:
    "India's managed marketplace for secondhand headphones, speakers, DACs, amps, and more. Every listing verified. Every transaction protected.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${syne.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-bg font-sans text-foreground antialiased">
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
