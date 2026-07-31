import { useEffect, useState } from "react";

function apply(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("ascо-theme", dark ? "dark" : "light");
}

export function useTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("ascо-theme");
    const isDark = stored === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
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
