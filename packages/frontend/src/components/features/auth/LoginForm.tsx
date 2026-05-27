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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
            />
          </div>
          <div className="space-y-2.5">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
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
