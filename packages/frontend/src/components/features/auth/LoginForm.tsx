import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

export function LoginForm() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = t("validation.required");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = t("validation.email");
    if (!password) next.password = t("validation.required");
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    login(email, password);
    navigate({ to: "/dashboard" });
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>{t("auth.loginTitle")}</CardTitle>
        <CardDescription>{t("auth.loginSubtitle")}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5">
          <div className="space-y-2.5">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "login-email-error" : undefined}
            />
            {errors.email && (
              <p id="login-email-error" className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>
          <div className="space-y-2.5">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "login-password-error" : undefined}
            />
            {errors.password && (
              <p id="login-password-error" className="text-sm text-destructive">{errors.password}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-5">
          <Button type="submit" className="w-full" size="lg">
            {t("auth.loginButton")}
          </Button>
          <p className="text-base text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link to="/signup" className="text-primary font-medium hover:underline">
              {t("auth.signupLink")}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
