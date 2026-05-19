import { useCallback, useEffect, useState } from "react";

export function useCooldown(key: string, seconds: number) {
  const storageKey = `cooldown:${key}`;
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const tick = () => {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return setRemaining(0);
      const expiresAt = parseInt(raw, 10);
      const left = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) localStorage.removeItem(storageKey);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [storageKey]);

  const start = useCallback(() => {
    const expiresAt = Date.now() + seconds * 1000;
    localStorage.setItem(storageKey, String(expiresAt));
    setRemaining(seconds);
  }, [seconds, storageKey]);

  return { remaining, start, active: remaining > 0 };
}
