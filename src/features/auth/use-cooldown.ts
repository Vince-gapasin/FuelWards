import { useEffect, useState } from 'react';

/** Seconds left before an action (like "resend code") may run again. */
export function useCooldown(seconds: number) {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  return { left, start: () => setLeft(seconds) };
}
