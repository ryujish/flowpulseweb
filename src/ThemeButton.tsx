import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "dark" | "light";
const darkRules = new Set<CSSMediaRule>();

function findDarkRules() {
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule instanceof CSSMediaRule && rule.conditionText.includes("prefers-color-scheme: dark")) darkRules.add(rule);
      }
    } catch {}
  }
}

function applyTheme(theme: Theme) {
  findDarkRules();
  darkRules.forEach((rule) => { rule.media.mediaText = theme === "dark" ? "all" : "not all"; });
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export default function ThemeButton() {
  const [theme, setTheme] = useState<Theme>(() => localStorage.getItem("flowpulse-theme") as Theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  useEffect(() => { applyTheme(theme); }, [theme]);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem("flowpulse-theme", next);
    setTheme(next);
  };
  return <button className="capture-button theme-toggle" onClick={toggle} aria-label={`${theme === "dark" ? "라이트" : "다크"} 모드로 전환`} title={`${theme === "dark" ? "라이트" : "다크"} 모드`}>{theme === "dark" ? <Sun/> : <Moon/>}</button>;
}
