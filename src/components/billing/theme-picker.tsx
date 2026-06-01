"use client";

import { useEffect, useState } from "react";

type ThemeId = "classic" | "ocean" | "sunset";

const themes: Array<{
  id: ThemeId;
  name: string;
  paid: boolean;
  colors: string[];
}> = [
  { id: "classic", name: "Classic", paid: false, colors: ["#f7f7f4", "#2f7d68", "#e3a93b"] },
  { id: "ocean", name: "Ocean", paid: true, colors: ["#eef7fb", "#1d6f8f", "#e08e45"] },
  { id: "sunset", name: "Sunset", paid: true, colors: ["#fff6f0", "#9b4d4d", "#3c6e71"] }
];

export function ThemePicker({
  canUseMultipleThemes
}: {
  canUseMultipleThemes: boolean;
}) {
  const [selected, setSelected] = useState<ThemeId>("classic");

  useEffect(() => {
    const stored = window.localStorage.getItem("family-os-theme") as ThemeId | null;
    const next = stored && themes.some((theme) => theme.id === stored) ? stored : "classic";
    applyTheme(canUseMultipleThemes ? next : "classic");
    setSelected(canUseMultipleThemes ? next : "classic");
  }, [canUseMultipleThemes]);

  function chooseTheme(theme: ThemeId, paid: boolean) {
    if (paid && !canUseMultipleThemes) return;

    setSelected(theme);
    window.localStorage.setItem("family-os-theme", theme);
    applyTheme(theme);
  }

  return (
    <section className="panel theme-picker">
      <h2>Theme Picker</h2>
      <div className="theme-options" role="list">
        {themes.map((theme) => {
          const locked = theme.paid && !canUseMultipleThemes;
          return (
            <button
              key={theme.id}
              type="button"
              className={selected === theme.id ? "theme-option active" : "theme-option"}
              onClick={() => chooseTheme(theme.id, theme.paid)}
              disabled={locked}
              aria-pressed={selected === theme.id}
            >
              <span>{theme.name}</span>
              <span className="theme-swatches" aria-hidden="true">
                {theme.colors.map((color) => (
                  <i key={color} style={{ background: color }} />
                ))}
              </span>
              <small>{locked ? "Paid plan" : selected === theme.id ? "Active" : "Available"}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
}
