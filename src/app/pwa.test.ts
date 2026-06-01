import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("PWA assets", () => {
  it("defines an installable manifest with shell shortcuts", async () => {
    const manifestText = await readFile(
      path.join(root, "public", "manifest.webmanifest"),
      "utf8"
    );
    const manifest = JSON.parse(manifestText) as {
      display: string;
      start_url: string;
      icons: Array<{ src: string; purpose?: string }>;
      shortcuts: Array<{ url: string }>;
    };

    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.icons.some((icon) => icon.purpose === "maskable")).toBe(true);
    expect(manifest.shortcuts.map((shortcut) => shortcut.url)).toEqual([
      "/money/personal",
      "/tasks",
      "/wishes"
    ]);
  });

  it("caches the MVP shell routes without caching API responses", async () => {
    const worker = await readFile(path.join(root, "public", "sw.js"), "utf8");

    expect(worker).toContain("family-os-shell-v1");
    expect(worker).toContain("/money/personal");
    expect(worker).toContain("/tasks");
    expect(worker).toContain("/wishes");
    expect(worker).toContain('url.pathname.startsWith("/api/")');
  });

  it("handles Web Push notifications", async () => {
    const worker = await readFile(path.join(root, "public", "sw.js"), "utf8");

    expect(worker).toContain('self.addEventListener("push"');
    expect(worker).toContain("showNotification");
    expect(worker).toContain('self.addEventListener("notificationclick"');
    expect(worker).toContain("openWindow");
  });
});
