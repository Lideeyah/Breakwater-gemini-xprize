import type { Metadata } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WorkspaceProvider } from "./lib/workspace";

const geist = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist",
  weight: "100 900",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Breakwater - AI Agent Circuit Breaker",
  description:
    "Real-time circuit breaker proxy for AI agents. Monitor, intercept, and halt runaway agent loops before they burn tokens and dollars.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geist.variable} ${jetbrainsMono.variable} antialiased bg-background text-foreground font-sans`}
      >
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </body>
    </html>
  );
}
