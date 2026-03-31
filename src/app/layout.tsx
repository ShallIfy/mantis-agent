import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import FloatingChat from "@/app/components/FloatingChat";
import Footer from "@/app/components/Footer";
import Providers from "@/app/components/Providers";
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
  title: "MANTIS — Autonomous CeDeFi Agent on Mantle",
  description: "Mantle Autonomous Network Trading & Intelligence System. The first autonomous DeFi agent built for Mantle's CeDeFi flywheel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          {children}
          <Footer />
          <FloatingChat />
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
