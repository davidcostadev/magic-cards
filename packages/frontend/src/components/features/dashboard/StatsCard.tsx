import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  subtext?: string;
}

export function StatsCard({ icon, label, value, subtext }: StatsCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-5 p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-base text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold">{value}</p>
          {subtext && <p className="text-sm text-muted-foreground">{subtext}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
