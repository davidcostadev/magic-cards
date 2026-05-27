import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Target, GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { buttonVariants } from "@/components/ui/button";
import { StatsCard } from "@/components/features/dashboard/StatsCard";
import { StreakWidget } from "@/components/features/dashboard/StreakWidget";
import { WeakCardsWidget } from "@/components/features/dashboard/WeakCardsWidget";
import { UpcomingReviews } from "@/components/features/dashboard/UpcomingReviews";
import { useAuth } from "@/context/AuthContext";
import { mockCards, mockCardProgress, mockSubjects } from "@/mocks/data";

const MOCK_REVIEWED_TODAY = 12;
const MOCK_STREAK = 7;
const MOCK_ACCURACY_7D = 82;
const MOCK_ACCURACY_30D = 78;

export function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const statusCounts = {
    new: mockCardProgress.filter((p) => p.status === "new").length,
    learning: mockCardProgress.filter((p) => p.status === "learning").length,
    reviewing: mockCardProgress.filter((p) => p.status === "reviewing").length,
    mastered: mockCardProgress.filter((p) => p.status === "mastered").length,
  };

  const weakCards = mockCardProgress
    .filter((p) => p.easeFactor < 2.0)
    .sort((a, b) => a.easeFactor - b.easeFactor)
    .slice(0, 5)
    .map((p) => {
      const card = mockCards.find((c) => c.id === p.cardId)!;
      const subject = mockSubjects.find((s) => s.id === card.subjectId)!;
      return {
        id: card.id,
        question: card.question,
        easeFactor: p.easeFactor,
        subjectTitle: subject.title,
      };
    });

  return (
    <div className="p-5 md:p-7 space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {t("dashboard.greeting", { name: user?.username ?? "" })}
          </h1>
        </div>
        <Link to="/learn" className={buttonVariants({ size: "lg" })}>
          <GraduationCap className="mr-2 h-5 w-5" />
          {t("dashboard.startStudying")}
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t("dashboard.dailyGoal")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-base">
            <span className="text-muted-foreground">
              {t("dashboard.cardsReviewed", {
                count: MOCK_REVIEWED_TODAY,
                goal: user?.dailyGoal ?? 20,
              })}
            </span>
            <span className="font-semibold">
              {Math.round((MOCK_REVIEWED_TODAY / (user?.dailyGoal ?? 20)) * 100)}%
            </span>
          </div>
          <Progress value={MOCK_REVIEWED_TODAY} max={user?.dailyGoal ?? 20} />
        </CardContent>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StreakWidget streakDays={MOCK_STREAK} />
        <StatsCard
          icon={<Target className="h-6 w-6" />}
          label={t("dashboard.accuracy")}
          value={`${MOCK_ACCURACY_7D}%`}
          subtext={`${t("dashboard.accuracy7d")} · ${MOCK_ACCURACY_30D}% ${t("dashboard.accuracy30d")}`}
        />
        <UpcomingReviews today={4} tomorrow={6} thisWeek={18} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">{t("dashboard.cardsByStatus")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {(
              [
                { key: "new" as const, label: t("dashboard.new"), color: "bg-blue-500" },
                { key: "learning" as const, label: t("dashboard.learning"), color: "bg-warning" },
                { key: "reviewing" as const, label: t("dashboard.reviewing"), color: "bg-primary" },
                { key: "mastered" as const, label: t("dashboard.mastered"), color: "bg-success" },
              ] as const
            ).map(({ key, label, color }) => (
              <div key={key} className="text-center">
                <div className={`mx-auto mb-2.5 h-3 w-16 rounded-full ${color}`} />
                <p className="text-3xl font-bold">{statusCounts[key]}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <WeakCardsWidget cards={weakCards} />
    </div>
  );
}
