import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);
const STORAGE_KEY = "smart-building-theme";
const systemQuery = window.matchMedia("(prefers-color-scheme: dark)");

function savedPreference() {
  const value = localStorage.getItem(STORAGE_KEY);
  return ["light", "dark", "system"].includes(value) ? value : "system";
}
function resolvedTheme(preference) {
  return preference === "system" ? (systemQuery.matches ? "dark" : "light") : preference;
}

export const useTheme = () => useContext(ThemeContext);
export function ThemeProvider({ children }) {
  const [preference, setPreference] = useState(savedPreference);
  const apply = (value) => document.documentElement.dataset.theme = resolvedTheme(value);
  useEffect(() => {
    apply(preference);
    localStorage.setItem(STORAGE_KEY, preference);
    if (preference !== "system") return undefined;
    const update = () => apply("system");
    systemQuery.addEventListener("change", update);
    return () => systemQuery.removeEventListener("change", update);
  }, [preference]);
  return (
    <ThemeContext.Provider value={{ preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}
