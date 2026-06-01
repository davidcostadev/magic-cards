import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthError, useAuth } from '@/context/AuthContext';

export function SignupForm() {
  const { t } = useTranslation();
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [errors, setErrors] = useState<{ username?: string; email?: string; password?: string }>(
    {}
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: { username?: string; email?: string; password?: string } = {};
    if (!username.trim()) next.username = t('validation.required');
    if (!email.trim()) next.email = t('validation.required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = t('validation.email');
    if (!password) next.password = t('validation.required');
    else if (password.length < 8) next.password = t('validation.passwordMin');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await signup(email, password, username);
      navigate({ to: '/dashboard' });
    } catch (err) {
      const code = err instanceof AuthError ? err.code : 'errors.internal';
      setSubmitError(t(code, { defaultValue: t('errors.internal') }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>{t('auth.signupTitle')}</CardTitle>
        <CardDescription>{t('auth.signupSubtitle')}</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5">
          <div className="space-y-2.5">
            <Label htmlFor="username">{t('auth.username')}</Label>
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-invalid={!!errors.username}
              aria-describedby={errors.username ? 'signup-username-error' : undefined}
            />
            {errors.username && (
              <p id="signup-username-error" className="text-sm text-destructive">
                {errors.username}
              </p>
            )}
          </div>
          <div className="space-y-2.5">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'signup-email-error' : undefined}
            />
            {errors.email && (
              <p id="signup-email-error" className="text-sm text-destructive">
                {errors.email}
              </p>
            )}
          </div>
          <div className="space-y-2.5">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'signup-password-error' : undefined}
            />
            {errors.password && (
              <p id="signup-password-error" className="text-sm text-destructive">
                {errors.password}
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex-col gap-5">
          {submitError && (
            <p role="alert" className="w-full text-sm text-destructive text-center">
              {submitError}
            </p>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {submitting ? t('auth.signupButtonLoading') : t('auth.signupButton')}
          </Button>
          <p className="text-base text-muted-foreground">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="text-primary font-medium hover:underline">
              {t('auth.loginLink')}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
