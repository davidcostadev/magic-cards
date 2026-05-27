import { useState, useEffect, useRef } from "react";
import { cn } from "@/utils/cn";

interface TimerProps {
  seconds: number;
  running: boolean;
  onTimeout: () => void;
  onTick?: (elapsed: number) => void;
}

export function Timer({ seconds, running, onTimeout, onTick }: TimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const startRef = useRef(Date.now());

  useEffect(() => {
    setRemaining(seconds);
    startRef.current = Date.now();
  }, [seconds]);

  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      const left = Math.max(0, seconds - elapsed);
      setRemaining(left);
      onTick?.(elapsed);

      if (left <= 0) {
        clearInterval(interval);
        onTimeout();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [running, seconds, onTimeout, onTick]);

  const percentage = (remaining / seconds) * 100;
  const isLow = remaining <= 10;
  const isCritical = remaining <= 5;

  return (
    <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary">
      <div
        className={cn(
          "h-full transition-all duration-100",
          isCritical ? "bg-destructive" : isLow ? "bg-warning" : "bg-primary"
        )}
        style={{ width: `${percentage}%` }}
      />
      <span
        className={cn(
          "absolute right-0 -top-7 text-sm font-mono font-semibold",
          isCritical ? "text-destructive" : isLow ? "text-warning" : "text-muted-foreground"
        )}
      >
        {Math.ceil(remaining)}s
      </span>
    </div>
  );
}

export function getElapsedSeconds(startTime: number): number {
  return (Date.now() - startTime) / 1000;
}

export function calculateQuality(
  correct: boolean,
  elapsedSeconds: number,
  usedHint: boolean,
  timedOut: boolean
): 1 | 3 | 4 | 5 {
  if (!correct || timedOut) return 1;
  if (usedHint) return 3;
  if (elapsedSeconds < 10) return 5;
  if (elapsedSeconds < 20) return 4;
  return 3;
}
