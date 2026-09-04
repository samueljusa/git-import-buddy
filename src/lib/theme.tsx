import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const THEMES = ["Sombre", "Bleu de nuit", "Clair", "Système"] as const;
export type ThemeName = (typeof THEMES)[number];

const ATTR_BY_THEME: Record<ThemeName, string> = {
  Sombre: "dark",
  "Bleu de nuit": "midnight",
  Clair: "light",
  Système: "system",
};

const STORAGE_KEY = "samflash.theme";

function resolve(theme: ThemeName): string {
  const attr = ATTR_BY_THEME[theme];
  if (attr !== "system") return attr;
  const prefersLight =
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches;
  return prefersLight ? "light" : "dark";
}

type ThemeValue = { theme: ThemeName; setTheme: (t: ThemeName) => void };

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>("Sombre");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeName | null;
    if (stored && (THEMES as readonly string[]).includes(stored)) setThemeState(stored);
  }, []);

  useEffect(() => {
    const apply = () => {
      const value = resolve(theme);
      document.documentElement.dataset["theme"] = value;
      document.documentElement.classList.toggle("dark", value !== "light");
    };
    apply();
    if (theme !== "Système") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t);
    window.localStorage.setItem(STORAGE_KEY, t);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
