import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

export function SignupForm() {
  const { t } = useTranslation();
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    signup(email, password, username);
    navigate({ to: "/dashboard" });
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>{t("auth.signupTitle")}</CardTitle>
        <CardDescription>{t("auth.signupSubtitle")}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5">
          <div className="space-y-2.5">
            <Label htmlFor="username">{t("auth.username")}</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
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
            {t("auth.signupButton")}
          </Button>
          <p className="text-base text-muted-foreground">
            {t("auth.hasAccount")}{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              {t("auth.loginLink")}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
