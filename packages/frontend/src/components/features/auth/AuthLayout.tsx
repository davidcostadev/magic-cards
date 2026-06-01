import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center p-5">
      <div className="w-full max-w-lg space-y-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <Sparkles className="h-14 w-14 text-primary" />
        </div>
        {children}
      </div>
    </div>
  );
}
