"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type TickPayload = {
  started?: unknown[];
  completed?: unknown[];
};

function hasAutomationChanges(payload: TickPayload) {
  return (payload.started?.length ?? 0) > 0 || (payload.completed?.length ?? 0) > 0;
}

export function CipAutomationTicker() {
  const router = useRouter();
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (cancelled || inFlight.current || document.visibilityState === "hidden") return;

      inFlight.current = true;
      try {
        const response = await fetch("/api/cip/automation/tick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store"
        });

        if (!response.ok) return;

        const payload = (await response.json()) as TickPayload;
        if (!cancelled && hasAutomationChanges(payload)) {
          router.refresh();
        }
      } finally {
        inFlight.current = false;
      }
    }

    void tick();
    const interval = window.setInterval(() => void tick(), 30_000);
    document.addEventListener("visibilitychange", tick);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  return null;
}
