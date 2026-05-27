import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Trophy, Target, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

interface SessionSummaryProps {
  cardsReviewed: number;
  correctCount: number;
  timeSpentMs: number;
}

export function SessionSummary({ cardsReviewed, correctCount, timeSpentMs }: SessionSummaryProps) {
  const { t } = useTranslation();
  const accuracy = cardsReviewed > 0 ? Math.round((correctCount / cardsReviewed) * 100) : 0;
  const minutes = Math.floor(timeSpentMs / 60000);
  const seconds = Math.floor((timeSpentMs % 60000) / 1000);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-5">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Trophy className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-3xl">{t("learn.sessionComplete")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid grid-cols-3 gap-5">
            <div className="space-y-1.5">
              <div className="flex justify-center">
                <Target className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold">{cardsReviewed}</p>
              <p className="text-sm text-muted-foreground">{t("learn.cardsReviewed")}</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-center">
                <Trophy className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold">{accuracy}%</p>
              <p className="text-sm text-muted-foreground">{t("learn.accuracyRate")}</p>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-center">
                <Clock className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold">{minutes}:{seconds.toString().padStart(2, "0")}</p>
              <p className="text-sm text-muted-foreground">{t("learn.timeSpent")}</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link to="/dashboard" className={buttonVariants({ size: "lg" })}>
              {t("learn.backToDashboard")}
            </Link>
            <Link to="/learn" className={buttonVariants({ variant: "outline", size: "lg" })}>
              {t("learn.studyMore")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
