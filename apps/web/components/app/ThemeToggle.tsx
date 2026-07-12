"use client";

import { useEffect, useState } from "react";

function applyTheme(theme: "light" | "dark") {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("digital-cip-theme", theme);
}

type ThemeToggleProps = {
  variant?: "default" | "sidebar";
};

export function ThemeToggle({ variant = "default" }: ThemeToggleProps) {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";
  const className =
    variant === "sidebar"
      ? "grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-white/25 bg-white/10 text-white transition hover:bg-white hover:text-formital-green"
      : "grid h-12 w-12 place-items-center rounded-xl border border-slate-200 bg-white text-formital-green shadow-sm transition hover:border-formital-green hover:bg-formital-green/10 dark:border-[#315941] dark:bg-[#102218] dark:text-[#64d889] dark:hover:bg-[#183c27]";

  return (
    <button
      type="button"
      onClick={() => {
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }}
      className={className}
      aria-label={theme === "dark" ? "Activer le mode clair" : "Activer le mode sombre"}
      title={theme === "dark" ? "Mode clair" : "Mode sombre"}
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path d="M12 4V2m0 20v-2m8-8h2M2 12h2m14.95-6.95 1.42-1.42M3.63 20.37l1.42-1.42m0-13.9L3.63 3.63m16.74 16.74-1.42-1.42" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path d="M20 14.6A8 8 0 0 1 9.4 4a7 7 0 1 0 10.6 10.6Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
        </svg>
      )}
    </button>
  );
}
