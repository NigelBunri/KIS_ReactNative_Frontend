// src/screens/calls/hooks/useCallTimer.ts
import { useEffect, useRef, useState } from 'react';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export function useCallTimer(startedAt: string | null | undefined, running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running || !startedAt) {
      if (ref.current) { clearInterval(ref.current); ref.current = null; }
      return;
    }
    const base = Date.parse(startedAt);
    const tick = () => setElapsed(Math.floor((Date.now() - base) / 1000));
    tick();
    ref.current = setInterval(tick, 1000);
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [running, startedAt]);

  return { elapsed, label: formatDuration(elapsed) };
}
