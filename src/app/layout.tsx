import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell/app-shell";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: "Family OS",
  description: "Family finance, tasks, points and wishes in one household app.",
  applicationName: "Family OS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Family OS",
    statusBarStyle: "default"
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg"
  }
};

export const viewport: Viewport = {
  themeColor: "#27615f"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>
        <ServiceWorkerRegistration />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
