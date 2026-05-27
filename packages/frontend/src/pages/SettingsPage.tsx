import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { user, updatePreferences } = useAuth();
  const { theme, setTheme } = useTheme();
  const [dailyGoal, setDailyGoal] = useState(user?.dailyGoal ?? 20);
  const [saved, setSaved] = useState(false);

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    updatePreferences({ language: lang });
  };

  const handleThemeChange = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    updatePreferences({ theme: newTheme });
  };

  const handleDailyGoalSave = () => {
    updatePreferences({ dailyGoal });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-7 p-5 md:p-7">
      <h1 className="text-3xl font-bold">{t("settings.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("settings.language")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {[
              { code: "en", label: t("settings.english") },
              { code: "pt", label: t("settings.portuguese") },
            ].map(({ code, label }) => (
              <Button
                key={code}
                variant={i18n.language === code ? "default" : "outline"}
                onClick={() => handleLanguageChange(code)}
                className="flex-1"
                size="lg"
              >
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("settings.theme")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {[
              { value: "light" as const, label: t("settings.lightMode") },
              { value: "dark" as const, label: t("settings.darkMode") },
            ].map(({ value, label }) => (
              <Button
                key={value}
                variant={theme === value ? "default" : "outline"}
                onClick={() => handleThemeChange(value)}
                className="flex-1"
                size="lg"
              >
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("settings.dailyGoal")}</CardTitle>
          <CardDescription>{t("settings.dailyGoalDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label htmlFor="dailyGoal" className="sr-only">
              {t("settings.dailyGoal")}
            </Label>
            <Input
              id="dailyGoal"
              type="number"
              min={1}
              max={100}
              value={dailyGoal}
              onChange={(e) => setDailyGoal(Number(e.target.value))}
              className="w-28"
            />
            <Button onClick={handleDailyGoalSave}>
              {t("common.save")}
            </Button>
            {saved && (
              <span className="flex items-center gap-1.5 text-base text-success animate-[fadeIn_200ms_ease-in]">
                <Check className="h-5 w-5" />
                {t("settings.saved")}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
