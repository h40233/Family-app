"use client";

import { useEffect, useState } from "react";

type ThemeId = "classic" | "ocean" | "sunset";
type ApiEnvelope<T> = { data?: T; error?: { message?: string } };
type PreferencesResponse = { preferences: { theme: ThemeId } };

const themes: Array<{
  id: ThemeId;
  name: string;
  paid: boolean;
  colors: string[];
}> = [
  { id: "classic", name: "經典", paid: false, colors: ["#f7f7f4", "#2f7d68", "#e3a93b"] },
  { id: "ocean", name: "海洋", paid: true, colors: ["#eef7fb", "#1d6f8f", "#e08e45"] },
  { id: "sunset", name: "夕陽", paid: true, colors: ["#fff6f0", "#9b4d4d", "#3c6e71"] }
];

export function ThemePicker({
  familyId,
  canUseMultipleThemes
}: {
  familyId: string | null;
  canUseMultipleThemes: boolean;
}) {
  const [selected, setSelected] = useState<ThemeId>("classic");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPreferences() {
      if (!familyId) {
        applyTheme("classic");
        setSelected("classic");
        return;
      }

      try {
        const preferences = await fetchPreferences(familyId);
        if (cancelled) return;

        const nextTheme = canUseMultipleThemes ? preferences.theme : "classic";
        setSelected(nextTheme);
        applyTheme(nextTheme);
        setMessage("");
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "主題載入失敗。");
        }
      }
    }

    void loadPreferences();
    return () => {
      cancelled = true;
    };
  }, [familyId, canUseMultipleThemes]);

  async function chooseTheme(theme: ThemeId, paid: boolean) {
    if (paid && !canUseMultipleThemes) {
      setMessage("此主題需要付費方案。");
      return;
    }
    if (!familyId) return;

    try {
      const preferences = await savePreferences(familyId, theme);
      const nextTheme = canUseMultipleThemes ? preferences.theme : "classic";
      setSelected(nextTheme);
      applyTheme(nextTheme);
      setMessage("主題已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "主題更新失敗。");
    }
  }

  return (
    <section className="panel theme-picker">
      <h2>主題設定</h2>
      {message ? <p className="muted">{message}</p> : null}
      <div className="theme-options" role="list">
        {themes.map((theme) => {
          const locked = theme.paid && !canUseMultipleThemes;
          return (
            <button
              key={theme.id}
              type="button"
              className={selected === theme.id ? "theme-option active" : "theme-option"}
              onClick={() => void chooseTheme(theme.id, theme.paid)}
              disabled={locked || !familyId}
              aria-pressed={selected === theme.id}
            >
              <span>{theme.name}</span>
              <span className="theme-swatches" aria-hidden="true">
                {theme.colors.map((color) => (
                  <i key={color} style={{ background: color }} />
                ))}
              </span>
              <small>{locked ? "付費方案" : selected === theme.id ? "使用中" : "可使用"}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

async function fetchPreferences(familyId: string) {
  const response = await fetch(`/api/v1/preferences?familyId=${encodeURIComponent(familyId)}`);
  return readPreferencesResponse(response);
}

async function savePreferences(familyId: string, theme: ThemeId) {
  const response = await fetch("/api/v1/preferences", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ familyId, theme })
  });
  return readPreferencesResponse(response);
}

async function readPreferencesResponse(response: Response) {
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<PreferencesResponse>;
  if (!response.ok || body.error) {
    throw new Error(body.error?.message ?? "主題請求失敗。");
  }

  return body.data?.preferences ?? { theme: "classic" as const };
}

function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
}
