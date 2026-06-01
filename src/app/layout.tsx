import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/app-shell/app-shell";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import "./globals.css";

export const metadata: Metadata = {
  title: "家庭 OS",
  description: "整合家庭記帳、任務、點數與願望管理的家庭 App。",
  applicationName: "家庭 OS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "家庭 OS",
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
