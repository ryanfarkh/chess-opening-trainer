import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { TrainerProvider } from "@/context/TrainerContext";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Opening Trainer",
  description: "Learn chess openings with interactive boards and Anki-style spaced repetition.",
  applicationName: "Opening Trainer",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Openings",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.className}>
      <body>
        <TrainerProvider>
          <AppShell>{children}</AppShell>
        </TrainerProvider>
      </body>
    </html>
  );
}
