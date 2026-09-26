import { useEffect, useState } from "react";

function apply(dark: boolean) {
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", dark);
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("steelnest-theme", dark ? "dark" : "light");
    localStorage.setItem("ascо-theme", dark ? "dark" : "light");
  }
}

export function useTheme() {
  // Always default to false (Light Mode) as requested by user
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Check if user explicitly set dark mode, otherwise default to false (Light Mode)
    const stored =
      localStorage.getItem("steelnest-theme") || localStorage.getItem("ascо-theme");
    const isDark = stored === "dark";
    setDark(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      // Set to light mode explicitly
      localStorage.setItem("steelnest-theme", "light");
      localStorage.setItem("ascо-theme", "light");
    }
  }, []);

  return {
    dark,
    toggle: () => {
      setDark((d) => {
        apply(!d);
        return !d;
      });
    },
  };
}

