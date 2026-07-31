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

export function useCallTimer(
  startedAt: string | null | undefined,
  running: boolean,
  endedAt?: string | null,
) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!startedAt) {
      if (ref.current) { clearInterval(ref.current); ref.current = null; }
      setElapsed(0);
      return;
    }
    const base = Date.parse(startedAt);

    if (!running) {
      // Frozen (call ended/missed): show the final elapsed duration up to
      // endedAt instead of resetting to 0 — this is a fresh component
      // instance (the ended screen mounts a new CallTimer), so without this
      // it would otherwise never tick and stay at its initial state.
      if (ref.current) { clearInterval(ref.current); ref.current = null; }
      const end = endedAt ? Date.parse(endedAt) : Date.now();
      setElapsed(Math.max(0, Math.floor((end - base) / 1000)));
      return;
    }

    const tick = () => setElapsed(Math.floor((Date.now() - base) / 1000));
    tick();
    ref.current = setInterval(tick, 1000);
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [running, startedAt, endedAt]);

  return { elapsed, label: formatDuration(elapsed) };
}
