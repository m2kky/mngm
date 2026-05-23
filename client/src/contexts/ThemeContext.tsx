import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
export type Language = "en" | "ar";
export type Density = "comfortable" | "compact";

export const ACCENT_COLORS = [
  { label: "Indigo", value: "indigo", hsl: "231, 98%, 65%" },
  { label: "Purple", value: "purple", hsl: "271, 91%, 65%" },
  { label: "Blue", value: "blue", hsl: "217, 91%, 60%" },
  { label: "Green", value: "green", hsl: "142, 71%, 45%" },
  { label: "Orange", value: "orange", hsl: "25, 95%, 53%" },
  { label: "Rose", value: "rose", hsl: "347, 89%, 60%" },
] as const;

export type AccentColor = typeof ACCENT_COLORS[number]["value"];

interface ThemeContextType {
  theme: Theme;
  language: Language;
  accentColor: AccentColor;
  density: Density;
  setTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  setAccentColor: (color: AccentColor) => void;
  setDensity: (density: Density) => void;
  isRTL: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

function applyAccentColor(hsl: string) {
  const root = document.documentElement;
  root.style.setProperty("--primary", `hsl(${hsl})`);
  root.style.setProperty("--ring", `hsl(${hsl})`);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("theme") as Theme;
    return stored || "system";
  });

  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem("language") as Language;
    return stored || "en";
  });

  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    const stored = localStorage.getItem("accentColor") as AccentColor;
    return stored || "indigo";
  });

  const [density, setDensityState] = useState<Density>(() => {
    const stored = localStorage.getItem("wk_density") as Density;
    return stored || "comfortable";
  });

  const isRTL = language === "ar";

  useEffect(() => {
    localStorage.setItem("theme", theme);

    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("language", language);
    document.documentElement.dir = isRTL ? "rtl" : "ltr";
    document.documentElement.lang = language;
  }, [language, isRTL]);

  useEffect(() => {
    localStorage.setItem("accentColor", accentColor);
    const preset = ACCENT_COLORS.find((c) => c.value === accentColor);
    if (preset) applyAccentColor(preset.hsl);
  }, [accentColor]);

  useEffect(() => {
    localStorage.setItem("wk_density", density);
    document.documentElement.setAttribute("data-density", density);
  }, [density]);

  const setAccentColor = (color: AccentColor) => {
    setAccentColorState(color);
  };

  const setDensity = (d: Density) => {
    setDensityState(d);
  };

  const value = {
    theme,
    language,
    accentColor,
    density,
    setTheme,
    setLanguage,
    setAccentColor,
    setDensity,
    isRTL,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
